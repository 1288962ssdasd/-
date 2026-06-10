/**
 * @layer CORE
 * @file   ui-feedback.js
 * @description UI反馈系统 - 加载状态、调试面板、实时日志
 *
 * 功能：
 * 1. 全局加载指示器（显示当前AI调用状态）
 * 2. 调试浮动面板（显示实时日志）
 * 3. 操作反馈提示（成功/失败）
 */

;(function () {
  'use strict';

  // ==================== 全局加载指示器 ====================

  class LoadingIndicator {
    constructor() {
      this._container = null;
      this._currentOperations = new Map();
      this._isVisible = false;
    }

    init() {
      this._createContainer();
      this._bindEvents();
    }

    _createContainer() {
      if (this._container) return;

      this._container = document.createElement('div');
      this._container.id = 'phone-loading-indicator';
      this._container.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
        pointer-events: none;
        transition: opacity 0.3s ease;
        opacity: 0;
      `;

      document.body.appendChild(this._container);
    }

    _bindEvents() {
      // 监听LLM加载事件
      window.addEventListener('llm:loading', (e) => {
        const { role, status } = e.detail;
        if (status === 'start') {
          this.addOperation(role, this._getRoleDisplayName(role));
        } else if (status === 'complete' || status === 'error') {
          this.removeOperation(role);
        }
      });

      // 监听世界生成事件
      window.addEventListener('world:generated', () => {
        this.showToast('✅ 世界生成完成', 'success');
      });

      // 监听导演计划事件
      if (window.Platform?.eventBus) {
        window.Platform.eventBus.on('director:plan', (data) => {
          const eventCount = data?.data?.events?.length || 0;
          if (eventCount > 0) {
            this.showToast(`🎬 导演生成 ${eventCount} 个事件`, 'info');
          }
        });
      }
    }

    _getRoleDisplayName(role) {
      const names = {
        'world-generator': '🌍 生成世界',
        'world-outline': '📋 生成大纲',
        'world-director': '🎬 导演规划',
        'world-director-deep': '🔍 深度分析',
        'chat-reply': '💬 生成回复',
        'content-creator': '✍️ 创作内容',
        'npc-generator': '👤 生成NPC',
        'deviation-analyzer': '📊 分析偏差'
      };
      return names[role] || role;
    }

    addOperation(id, label) {
      this._currentOperations.set(id, {
        label,
        startTime: Date.now()
      });
      this._render();
    }

    removeOperation(id) {
      this._currentOperations.delete(id);
      this._render();
    }

    _render() {
      if (this._currentOperations.size === 0) {
        this._container.style.opacity = '0';
        this._isVisible = false;
        return;
      }

      const items = Array.from(this._currentOperations.entries()).map(([id, op]) => {
        const elapsed = Math.floor((Date.now() - op.startTime) / 1000);
        return `
          <div style="
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 14px;
            border-radius: 10px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          ">
            <div style="
              width: 16px;
              height: 16px;
              border: 2px solid rgba(255,255,255,0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: phone-spin 1s linear infinite;
            "></div>
            <span>${op.label}</span>
            <span style="color: rgba(255,255,255,0.6); font-size: 12px;">${elapsed}s</span>
          </div>
        `;
      }).join('');

      this._container.innerHTML = items;
      this._container.style.opacity = '1';
      this._isVisible = true;
    }

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      const colors = {
        success: '#34C759',
        error: '#FF3B30',
        info: '#007AFF',
        warning: '#FF9500'
      };

      toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        pointer-events: none;
      `;
      toast.textContent = message;

      document.body.appendChild(toast);

      // 动画显示
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });

      // 自动消失
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  // ==================== 调试浮动面板 ====================

  class DebugPanel {
    constructor() {
      this._panel = null;
      this._logContainer = null;
      this._isOpen = false;
      this._logs = [];
      this._maxLogs = 100;
      // [v3.3.2-fix] 过滤器配置：包含这些关键词的日志将被隐藏
      this._filters = {
        enabled: true,
        keywords: ['[DataStore]', '刷新写入', 'debounce', 'Cancelled', 'debounced'],
        showFiltered: false  // 是否显示被过滤的日志数量
      };
      this._filteredCount = 0;
      this._filterPanel = null;
    }

    init() {
      this._createPanel();
      this._interceptConsole();
    }

    _createPanel() {
      // 创建触发按钮
      const trigger = document.createElement('button');
      trigger.id = 'phone-debug-trigger';
      trigger.innerHTML = '🐛';
      trigger.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 25px;
        border: none;
        background: #007AFF;
        color: white;
        font-size: 24px;
        cursor: pointer;
        z-index: 999998;
        box-shadow: 0 4px 12px rgba(0,122,255,0.4);
        transition: transform 0.2s ease;
      `;
      trigger.addEventListener('click', () => this.toggle());
      trigger.addEventListener('mousedown', () => {
        trigger.style.transform = 'scale(0.9)';
      });
      trigger.addEventListener('mouseup', () => {
        trigger.style.transform = 'scale(1)';
      });

      document.body.appendChild(trigger);

      // 创建面板
      this._panel = document.createElement('div');
      this._panel.id = 'phone-debug-panel';
      this._panel.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 400px;
        max-height: 500px;
        background: rgba(30, 30, 30, 0.95);
        border-radius: 16px;
        z-index: 999997;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1);
        transform: scale(0.9) translateY(20px);
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s ease;
      `;

      // 头部
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 12px 16px;
        background: rgba(0,0,0,0.3);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      header.innerHTML = `
        <span style="color: white; font-weight: 600; font-size: 14px;">🔍 调试面板</span>
        <div style="display: flex; gap: 8px;">
          <button id="phone-debug-filter" style="
            background: rgba(255,149,0,0.3);
            border: 1px solid rgba(255,149,0,0.5);
            color: #FFD60A;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
          ">🔈</button>
          <button id="phone-debug-clear" style="
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
          ">清空</button>
          <button id="phone-debug-close" style="
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
          ">关闭</button>
        </div>
      `;

      // 日志容器
      this._logContainer = document.createElement('div');
      this._logContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        font-family: 'SF Mono', Monaco, monospace;
        font-size: 12px;
        line-height: 1.5;
      `;

      // 状态栏
      const statusBar = document.createElement('div');
      statusBar.id = 'phone-debug-status';
      statusBar.style.cssText = `
        padding: 8px 16px;
        background: rgba(0,0,0,0.3);
        border-top: 1px solid rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.6);
        font-size: 11px;
        display: flex;
        justify-content: space-between;
      `;
      statusBar.innerHTML = `
        <span>就绪</span>
        <span id="phone-debug-log-count">0 条日志</span>
      `;

      this._panel.appendChild(header);
      this._panel.appendChild(this._logContainer);
      this._panel.appendChild(statusBar);
      document.body.appendChild(this._panel);

      // 绑定事件
      document.getElementById('phone-debug-clear').addEventListener('click', () => this.clear());
      document.getElementById('phone-debug-close').addEventListener('click', () => this.close());
      document.getElementById('phone-debug-filter').addEventListener('click', () => this._showFilterPanel());

      // 添加CSS动画
      const style = document.createElement('style');
      style.textContent = `
        @keyframes phone-spin {
          to { transform: rotate(360deg); }
        }
        #phone-debug-panel::-webkit-scrollbar {
          width: 6px;
        }
        #phone-debug-panel::-webkit-scrollbar-track {
          background: transparent;
        }
        #phone-debug-panel::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
        }
      `;
      document.head.appendChild(style);
    }

    _interceptConsole() {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = (...args) => {
        this._addLog('log', args);
        originalLog.apply(console, args);
      };

      console.warn = (...args) => {
        this._addLog('warn', args);
        originalWarn.apply(console, args);
      };

      console.error = (...args) => {
        this._addLog('error', args);
        originalError.apply(console, args);
      };
    }

    _addLog(level, args) {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      // [v3.3.2-fix] 过滤噪音日志
      if (this._filters.enabled) {
        const shouldFilter = this._filters.keywords.some(keyword =>
          message.includes(keyword)
        );
        if (shouldFilter) {
          this._filteredCount++;
          return; // 不显示也不记录
        }
      }

      const log = {
        time: new Date().toLocaleTimeString(),
        level,
        message: message.substring(0, 500) // 限制长度
      };

      this._logs.push(log);

      // 限制日志数量
      if (this._logs.length > this._maxLogs) {
        this._logs.shift();
      }

      this._renderLog(log);
      this._updateStatus();
    }

    _renderLog(log) {
      const colors = {
        log: '#E0E0E0',
        warn: '#FFD54F',
        error: '#FF6B6B'
      };

      const div = document.createElement('div');
      div.style.cssText = `
        margin-bottom: 6px;
        padding: 6px 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 6px;
        border-left: 3px solid ${colors[log.level]};
        word-break: break-word;
      `;
      div.innerHTML = `
        <div style="color: rgba(255,255,255,0.4); font-size: 10px; margin-bottom: 2px;">${log.time}</div>
        <div style="color: ${colors[log.level]};">${this._escapeHtml(log.message)}</div>
      `;

      this._logContainer.appendChild(div);
      this._logContainer.scrollTop = this._logContainer.scrollHeight;
    }

    _escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    _updateStatus() {
      const countEl = document.getElementById('phone-debug-log-count');
      if (countEl) {
        const filteredText = this._filteredCount > 0 ? ` (已过滤 ${this._filteredCount} 条)` : '';
        countEl.textContent = `${this._logs.length} 条日志${filteredText}`;
      }
    }

    // [v3.3.2-fix] 显示过滤器面板
    _showFilterPanel() {
      if (this._filterPanel && this._filterPanel.parentNode) {
        this._filterPanel.remove();
        this._filterPanel = null;
        return;
      }

      this._filterPanel = document.createElement('div');
      this._filterPanel.style.cssText = `
        position: absolute;
        top: 50px;
        left: 10px;
        width: 300px;
        background: rgba(40, 40, 40, 0.98);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 16px;
        z-index: 1000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      `;

      const isEnabled = this._filters.enabled;
      this._filterPanel.innerHTML = `
        <div style="color: white; font-size: 14px; font-weight: 600; margin-bottom: 12px;">🔈 日志过滤器</div>
        <label style="display: flex; align-items: center; gap: 8px; color: #E0E0E0; font-size: 13px; margin-bottom: 12px; cursor: pointer;">
          <input type="checkbox" id="filter-enabled" ${isEnabled ? 'checked' : ''}>
          启用过滤
        </label>
        <div style="color: rgba(255,255,255,0.5); font-size: 11px; margin-bottom: 8px;">已过滤 ${this._filteredCount} 条噪音日志</div>
        <div style="color: rgba(255,255,255,0.4); font-size: 11px;">点击关键词移除过滤（双击输入框可添加关键词）</div>
        <div id="filter-keywords" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
          ${this._filters.keywords.map(k => `
            <span style="
              background: rgba(255,149,0,0.2);
              color: #FFD60A;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
            " data-keyword="${k}" title="点击移除">✕ ${k}</span>
          `).join('')}
        </div>
      `;

      this._panel.appendChild(this._filterPanel);

      // 绑定事件
      document.getElementById('filter-enabled').addEventListener('change', (e) => {
        this._filters.enabled = e.target.checked;
        this._filteredCount = 0;
        this._updateStatus();
      });

      this._filterPanel.querySelectorAll('[data-keyword]').forEach(el => {
        el.addEventListener('click', () => {
          const keyword = el.dataset.keyword;
          this._filters.keywords = this._filters.keywords.filter(k => k !== keyword);
          el.remove();
        });
      });
    }

    toggle() {
      if (this._isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      this._panel.style.transform = 'scale(1) translateY(0)';
      this._panel.style.opacity = '1';
      this._panel.style.pointerEvents = 'auto';
      this._isOpen = true;
    }

    close() {
      this._panel.style.transform = 'scale(0.9) translateY(20px)';
      this._panel.style.opacity = '0';
      this._panel.style.pointerEvents = 'none';
      this._isOpen = false;
    }

    clear() {
      this._logs = [];
      this._logContainer.innerHTML = '';
      this._updateStatus();
    }
  }

  // ==================== 初始化 ====================

  function initUIFeedback() {
    // 等待DOM就绪
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init);
    } else {
      _init();
    }
  }

  function _init() {
    // 初始化加载指示器
    window._phoneLoadingIndicator = new LoadingIndicator();
    window._phoneLoadingIndicator.init();

    // 初始化调试面板
    window._phoneDebugPanel = new DebugPanel();
    window._phoneDebugPanel.init();

    console.log('[UIFeedback] UI反馈系统已初始化');
  }

  // 暴露到全局
  window.UIFeedback = {
    init: initUIFeedback,
    LoadingIndicator,
    DebugPanel
  };

  // 自动初始化
  initUIFeedback();
})();
