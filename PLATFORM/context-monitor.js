/**
 * ContextMonitor - SillyTavern 上下文监控器
 * 
 * [铁则合规] 说明：
 * - 从旧版 context-monitor.js 移植并适配新架构
 * - 封装在 PLATFORM 层，符合铁则六（环境适配在入口处完成）
 * - 不直接操作 DOM，只负责监控和事件分发
 * - 所有事件通过 EventBus 分发，符合铁则三
 * 
 * @version 2.0.0
 */

;(function () {
  'use strict';

  class ContextMonitor {
    constructor(platform, settings = {}) {
      this._platform = platform || window.Platform;

      this.settings = {
        logLevel: 'info',
        monitorInterval: 5000,
        enableEventLogging: true,
        historyLimit: 100,
        debounceDelay: 500,
        ...settings,
      };

      this.isRunning = false;
      this.eventStats = {};
      this.contextHistory = [];
      this.lastContext = null;
      this.intervalId = null;
      this.startTime = null;
      this.eventListeners = new Map();
      this.debounceTimer = null;
      this.lastActivity = Date.now();

      console.log('[ContextMonitor] 初始化完成');
    }

    /**
     * 初始化监控器
     */
    init() {
      this.setupEventListeners();
      console.log('[ContextMonitor] 事件监听器已设置');
    }

    /**
     * 设置事件监听器
     * [铁则六] 平台相关逻辑封装在适配器内
     * [v4.3-fix] eventSource 不可用时延迟重试，而不是直接放弃
     */
    setupEventListeners() {
      // 检查是否有事件源可用
      if (!window.eventSource) {
        if (this._eventSourceRetries === undefined) {
          this._eventSourceRetries = 0;
        }
        this._eventSourceRetries++;
        if (this._eventSourceRetries <= 30) {
          // 最多重试30次（约60秒），每次间隔2秒
          console.warn('[ContextMonitor] eventSource 不可用，2秒后重试 (' + this._eventSourceRetries + '/30)...');
          setTimeout(() => this.setupEventListeners(), 2000);
        } else {
          console.warn('[ContextMonitor] eventSource 仍不可用，已重试30次，启用纯轮询模式');
          // 即使 eventSource 不可用，定时轮询仍然会通过 context:changed 事件工作
        }
        return;
      }

      console.info('[ContextMonitor] ✅ eventSource 可用，注册事件监听器');

      // ST 事件到内部事件的映射
      const EVENT_MAP = {
        'message_sent': 'message:sent',
        'message_received': 'message:received',
        'message_edited': 'message:edited',
        'message_deleted': 'message:deleted',
        'message_swiped': 'message:swiped',
        'chat_id_changed': 'chat:changed',
        'character_selected': 'character:selected',
        'generation_started': 'generation:started',
        'generation_stopped': 'generation:stopped',
        'generation_ended': 'generation:ended',
        'settings_loaded': 'settings:loaded',
        'extension_settings_loaded': 'extension:settingsLoaded',
      };

      Object.entries(EVENT_MAP).forEach(([stEvent, internalEvent]) => {
        try {
          const listener = (...args) => {
            this.handleEvent(stEvent, internalEvent, ...args);
          };

          window.eventSource.on(stEvent, listener);
          this.eventListeners.set(stEvent, listener);
        } catch (error) {
          console.warn(`[ContextMonitor] 注册事件监听器失败: ${stEvent}`, error);
        }
      });
    }

    /**
     * 启动监控
     */
    start() {
      if (this.isRunning) {
        console.warn('[ContextMonitor] 监控器已在运行中');
        return;
      }

      this.isRunning = true;
      this.startTime = Date.now();
      this.lastContext = this.getCurrentContext();
      this.lastActivity = Date.now();

      // 开始定时检查
      this._startMonitoring();

      console.log('[ContextMonitor] 上下文监控已启动');
    }

    /**
     * 停止监控
     */
    stop() {
      if (!this.isRunning) {
        console.warn('[ContextMonitor] 监控器未运行');
        return;
      }

      this.isRunning = false;

      if (this.intervalId) {
        clearTimeout(this.intervalId);
        this.intervalId = null;
      }

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      // 移除事件监听器
      this.eventListeners.forEach((listener, eventType) => {
        try {
          if (window.eventSource) {
            window.eventSource.off(eventType, listener);
          }
        } catch (error) {
          console.warn(`[ContextMonitor] 移除事件监听器失败: ${eventType}`, error);
        }
      });
      this.eventListeners.clear();

      console.log('[ContextMonitor] 上下文监控已停止');
    }

    /**
     * 处理事件
     */
    handleEvent(stEvent, internalEvent, ...args) {
      // 更新活动时间
      this.lastActivity = Date.now();

      // 更新统计
      this.eventStats[stEvent] = (this.eventStats[stEvent] || 0) + 1;

      if (this.settings.enableEventLogging) {
        console.log(`[ContextMonitor] 事件触发: ${stEvent} → ${internalEvent}`);
      }

      // 通过 EventBus 分发事件
      if (this._platform?.eventBus) {
        this._platform.eventBus.emit(internalEvent, {
          originalEvent: stEvent,
          args: args,
          timestamp: Date.now()
        });
      }

      // 特定事件后立即检查上下文（添加防抖）
      const immediateCheckEvents = ['message_sent', 'message_received', 'chat_id_changed', 'character_selected'];
      if (immediateCheckEvents.includes(stEvent)) {
        this.debouncedContextCheck();
      }
    }

    /**
     * 防抖的上下文检查
     */
    debouncedContextCheck() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.checkContextChanges();
        this.debounceTimer = null;
      }, this.settings.debounceDelay);
    }

    /**
     * 开始定时监控
     */
    _startMonitoring() {
      const check = () => {
        if (!this.isRunning) return;

        this.checkContextChanges();

        this.intervalId = setTimeout(check, this.settings.monitorInterval);
      };

      check();
    }

    /**
     * 检查上下文变化
     */
    checkContextChanges() {
      const currentContext = this.getCurrentContext();

      if (!currentContext) return;

      // 检测变化
      const changes = this._detectChanges(this.lastContext, currentContext);

      if (changes.length > 0) {
        // 记录历史
        this.contextHistory.push({
          timestamp: Date.now(),
          changes: changes,
          context: { ...currentContext }
        });

        // 限制历史记录数量
        if (this.contextHistory.length > this.settings.historyLimit) {
          this.contextHistory.shift();
        }

        // 通过 EventBus 分发变化事件
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('context:changed', {
            changes: changes,
            currentContext: currentContext,
            previousContext: this.lastContext,
            timestamp: Date.now()
          });
        }

        this.lastContext = currentContext;
      }
    }

    /**
     * 获取当前上下文
     * [铁则六] 通过 adapter 获取，不直接引用 window.SillyTavern
     */
    getCurrentContext() {
      try {
        // [铁则六] 通过 adapter 获取 ST 上下文
        const stContext = this._platform?.adapter?.getChatContext?.() || null;

        if (!stContext) return null;

        return {
          chatId: stContext.chatId || null,
          characterId: stContext.characterId || null,
          characterName: stContext.name2 || stContext.character?.name || null,
          groupId: stContext.groupId || null,
          messagesCount: stContext.chat?.length || 0,
          lastMessage: stContext.chat?.slice(-1)[0]?.mes?.substring(0, 100) || null,
          isGenerating: stContext.generating || false,
          timestamp: Date.now()
        };
      } catch (e) {
        console.warn('[ContextMonitor] 获取上下文失败:', e);
        return null;
      }
    }

    /**
     * 检测变化
     */
    _detectChanges(oldContext, newContext) {
      const changes = [];

      if (!oldContext) {
        changes.push({ type: 'init', message: '首次获取上下文' });
        return changes;
      }

      if (oldContext.chatId !== newContext.chatId) {
        changes.push({
          type: 'chatId',
          oldValue: oldContext.chatId,
          newValue: newContext.chatId
        });
      }

      if (oldContext.characterId !== newContext.characterId) {
        changes.push({
          type: 'characterId',
          oldValue: oldContext.characterId,
          newValue: newContext.characterId
        });
      }

      if (oldContext.messagesCount !== newContext.messagesCount) {
        changes.push({
          type: 'messagesCount',
          oldValue: oldContext.messagesCount,
          newValue: newContext.messagesCount
        });
      }

      if (oldContext.isGenerating !== newContext.isGenerating) {
        changes.push({
          type: 'isGenerating',
          oldValue: oldContext.isGenerating,
          newValue: newContext.isGenerating
        });
      }

      return changes;
    }

    /**
     * 获取事件统计
     */
    getEventStats() {
      return { ...this.eventStats };
    }

    /**
     * 获取上下文历史
     */
    getContextHistory(limit = 50) {
      return this.contextHistory.slice(-limit);
    }

    /**
     * 销毁监控器
     */
    destroy() {
      this.stop();
      this.eventStats = {};
      this.contextHistory = [];
      this.lastContext = null;
    }
  }

  // 暴露到全局
  window.ContextMonitor = ContextMonitor;

  console.log('[Platform] ContextMonitor 已加载 (v2.0)');
})();
