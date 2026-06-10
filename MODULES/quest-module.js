/**
 * @layer Module
 * @file   quest-module.js
 * @depends QuestService, QuestData, Platform
 * @subscribes quest:created, quest:started, quest:completed, quest:failed
 *
 * 职责: 任务模块 - 管理任务UI、用户交互、任务状态展示
 * 禁止: 直接操作数据、直接调用Schema
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  const MODULE_ID = 'quest';

  class QuestModule {
    constructor() {
      this.id = MODULE_ID;
      this._platform = null;
      this._service = null;
      this._renderer = null;
      this._unsubscribers = [];
      this._isInitialized = false;
    }

    /**
     * 初始化模块
     * [铁则四] 在MODULES_READY后初始化
     */
    async init(platform) {
      console.log(`[${MODULE_ID}] 初始化任务模块...`);
      this._platform = platform;

      // 获取Service
      this._service = this._platform.get?.('questService');
      if (!this._service) {
        console.warn(`[${MODULE_ID}] QuestService 未就绪`);
      }

      // 初始化Renderer
      if (window.PhoneRenderers?.Quest) {
        this._renderer = new window.PhoneRenderers.Quest();
      }

      // 订阅事件
      this._subscribeEvents();

      // 渲染初始UI
      this._renderInitialUI();

      this._isInitialized = true;
      console.log(`[${MODULE_ID}] 初始化完成`);
    }

    /**
     * 订阅事件
     * [铁则三] Module只能订阅事件，不能发射
     */
    _subscribeEvents() {
      const eventBus = this._platform?.eventBus;
      if (!eventBus) return;

      // 订阅任务相关事件
      this._unsubscribers.push(
        eventBus.on('quest:created', (data) => this._onQuestCreated(data)),
        eventBus.on('quest:started', (data) => this._onQuestStarted(data)),
        eventBus.on('quest:completed', (data) => this._onQuestCompleted(data)),
        eventBus.on('quest:failed', (data) => this._onQuestFailed(data)),
        eventBus.on('quest:stepCompleted', (data) => this._onStepCompleted(data)),
        eventBus.on('director:contentReady', (data) => this._onDirectorContent(data)),
        // [v4.3-fix] 同时监听 director:quest 事件（DirectorService 发射的标准事件名）
        eventBus.on('director:quest', (data) => this._onQuestCreated(data))
      );
    }

    /**
     * 渲染初始UI
     * [铁则三] render()返回由Renderer生成的节点
     */
    _renderInitialUI() {
      // 任务列表容器
      const container = document.getElementById('task-list');
      if (container && this._renderer) {
        const emptyState = this._renderer.renderEmptyState();
        container.innerHTML = '';
        container.appendChild(emptyState);
      }
    }

    /**
     * 渲染任务列表
     */
    async render() {
      if (!this._service) {
        return this._renderErrorState('任务服务未就绪');
      }

      try {
        const charId = await this._getCurrentCharId();
        if (!charId) {
          return this._renderErrorState('无法获取角色ID');
        }

        // 获取任务数据
        const activeQuests = await this._service.getActiveQuests(charId);
        const availableQuests = await this._service.getAvailableQuests(charId);

        // 使用Renderer生成UI
        if (this._renderer) {
          return this._renderer.renderQuestList({
            active: activeQuests,
            available: availableQuests
          });
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] 渲染任务列表失败:`, e);
      }

      return this._renderErrorState('任务加载失败');
    }

    // [v4.3-fix] 错误状态渲染，避免返回 null 导致空白
    _renderErrorState(message) {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 40px; text-align: center; color: #999;';
      div.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
        <div style="font-size: 14px;">${message || '任务加载失败'}</div>
      `;
      return div;
    }

    /**
     * [v4.31.0-fix] onRender 生命周期方法 - 返回模块初始HTML结构
     * 修复任务生成后无法显示到UI的问题
     */
    onRender() {
      // 延迟初始化UI，确保容器已挂载
      setTimeout(() => this._renderInitialUI(), 0);

      return `
        <div id="quest-module-container" style="height:100%;display:flex;flex-direction:column;">
          <div id="task-list" style="flex:1;overflow-y:auto;"></div>
        </div>
      `;
    }

    /**
     * 接受任务
     * [铁则十二] 调用Service方法，不直接操作数据
     */
    async acceptQuest(questId) {
      if (!this._service) {
        console.warn(`[${MODULE_ID}] QuestService 不可用`);
        return false;
      }

      try {
        const charId = await this._getCurrentCharId();
        const result = await this._service.acceptQuest(charId, questId);

        if (result) {
          // 刷新UI
          await this.refreshUI();
          this._showNotification('任务已接受', 'success');
        }

        return result;
      } catch (e) {
        console.warn(`[${MODULE_ID}] 接受任务失败:`, e);
        this._showNotification('接受任务失败', 'error');
        return false;
      }
    }

    /**
     * 完成任务步骤
     */
    async completeStep(questId, stepIndex) {
      if (!this._service) return false;

      try {
        const charId = await this._getCurrentCharId();
        const result = await this._service.completeStep(charId, questId, stepIndex);

        if (result) {
          await this.refreshUI();
        }

        return result;
      } catch (e) {
        console.warn(`[${MODULE_ID}] 完成步骤失败:`, e);
        return false;
      }
    }

    /**
     * 放弃任务
     */
    async abandonQuest(questId) {
      if (!this._service) return false;

      try {
        const charId = await this._getCurrentCharId();
        const result = await this._service.abandonQuest(charId, questId);

        if (result) {
          await this.refreshUI();
          this._showNotification('任务已放弃', 'info');
        }

        return result;
      } catch (e) {
        console.warn(`[${MODULE_ID}] 放弃任务失败:`, e);
        return false;
      }
    }

    /**
     * 刷新UI
     */
    async refreshUI() {
      const container = document.getElementById('task-list');
      if (!container) return;

      const content = await this.render();
      if (content) {
        container.innerHTML = '';
        container.appendChild(content);
      }
    }

    /**
     * 显示任务详情弹窗
     */
    async showQuestDetail(questId) {
      if (!this._service) return;

      try {
        const charId = await this._getCurrentCharId();
        const quest = await this._service.getQuest(charId, questId);

        if (!quest) return;

        // 使用Renderer渲染详情
        if (this._renderer) {
          const modal = this._renderer.renderQuestDetail(quest, {
            onAccept: () => this.acceptQuest(questId),
            onAbandon: () => this.abandonQuest(questId),
            onClose: () => this._closeModal(),
            // [v4.31.0-fix] 步骤交互回调
            onCompleteStep: (stepIndex) => this.completeStep(questId, stepIndex),
            onGoApp: (app) => {
              // 关闭弹窗并切换到对应APP
              this._closeModal();
              // [v4.31.0-fix] 通过 PhoneCore.launchApp 切换应用
              if (window.__phoneCore?.launchApp) {
                window.__phoneCore.launchApp(app);
              } else if (window.__phoneShell?._core?.launchApp) {
                window.__phoneShell._core.launchApp(app);
              }
            }
          });

          this._showModal(modal);
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] 显示任务详情失败:`, e);
      }
    }

    // ==================== 事件处理器 ====================

    _onQuestCreated(data) {
      console.log(`[${MODULE_ID}] 新任务创建:`, data);
      this._showNotification(`新任务: ${data.quest?.name || '未知'}`, 'info');
      this.refreshUI();
    }

    _onQuestStarted(data) {
      console.log(`[${MODULE_ID}] 任务开始:`, data);
      this._showNotification(`任务开始: ${data.questName}`, 'success');
      this.refreshUI();
    }

    _onQuestCompleted(data) {
      console.log(`[${MODULE_ID}] 任务完成:`, data);
      this._showNotification(
        `任务完成！获得 ${data.rewards?.gold || 0} 金币`,
        'success'
      );
      this.refreshUI();
    }

    _onQuestFailed(data) {
      console.log(`[${MODULE_ID}] 任务失败:`, data);
      this._showNotification(`任务失败: ${data.reason || ''}`, 'error');
      this.refreshUI();
    }

    _onStepCompleted(data) {
      console.log(`[${MODULE_ID}] 步骤完成:`, data);
      this.refreshUI();
    }

    _onDirectorContent(data) {
      // 处理导演系统生成的内容
      if (data.type === 'quest') {
        this._onQuestCreated(data);
      }
    }

    // ==================== UI辅助方法 ====================

    _showNotification(message, type = 'info') {
      if (window.PhoneShell?.showNotification) {
        window.PhoneShell.showNotification('task', '任务系统', message);
      }
    }

    _showModal(content) {
      // 创建模态框容器
      let modal = document.getElementById('quest-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quest-modal';
        modal.className = 'phone-modal';
        document.body.appendChild(modal);
      }

      modal.innerHTML = '';
      modal.appendChild(content);
      modal.style.display = 'flex';
    }

    _closeModal() {
      const modal = document.getElementById('quest-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }

    async _getCurrentCharId() {
      try {
        return await this._platform?.adapter?.getCurrentCharacterId?.() || 'default';
      } catch (e) {
        return 'default';
      }
    }

    /**
     * 销毁模块
     */
    destroy() {
      // 取消事件订阅
      this._unsubscribers.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      this._unsubscribers = [];

      this._isInitialized = false;
      console.log(`[${MODULE_ID}] 模块已销毁`);
    }
  }

  // [v4.31.0-fix] 铁则五：模块注册必须使用普通对象，不能使用类实例
  // 将类转换为普通对象
  const questModule = {
    id: MODULE_ID,
    _platform: null,
    _service: null,
    _renderer: null,
    _unsubscribers: [],
    _isInitialized: false,

    init: function (platform) {
      console.log(`[${MODULE_ID}] 初始化任务模块...`);
      this._platform = platform;

      // 获取Service
      this._service = this._platform.get?.('questService');
      if (!this._service) {
        console.warn(`[${MODULE_ID}] QuestService 未就绪`);
      }

      // 初始化Renderer
      if (window.PhoneRenderers?.Quest) {
        this._renderer = new window.PhoneRenderers.Quest();
      }

      // 订阅事件
      this._subscribeEvents();

      // 渲染初始UI
      this._renderInitialUI();

      this._isInitialized = true;
      console.log(`[${MODULE_ID}] 初始化完成`);
    },

    _subscribeEvents: function () {
      const eventBus = this._platform?.eventBus;
      if (!eventBus) return;

      // 订阅任务相关事件
      this._unsubscribers.push(
        eventBus.on('quest:created', (data) => this._onQuestCreated(data)),
        eventBus.on('quest:started', (data) => this._onQuestStarted(data)),
        eventBus.on('quest:completed', (data) => this._onQuestCompleted(data)),
        eventBus.on('quest:failed', (data) => this._onQuestFailed(data)),
        eventBus.on('quest:stepCompleted', (data) => this._onStepCompleted(data)),
        eventBus.on('director:contentReady', (data) => this._onDirectorContent(data)),
        eventBus.on('director:quest', (data) => this._onQuestCreated(data))
      );
    },

    destroy: function () {
      // 取消事件订阅
      this._unsubscribers.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      this._unsubscribers = [];

      this._isInitialized = false;
      console.log(`[${MODULE_ID}] 模块已销毁`);
    }
  };

  // 复制其他方法到普通对象
  QuestModule.prototype && Object.getOwnPropertyNames(QuestModule.prototype).forEach(function (name) {
    if (name !== 'constructor' && typeof QuestModule.prototype[name] === 'function') {
      questModule[name] = QuestModule.prototype[name];
    }
  });

  if (window.__phoneShell?.registerModule) {
    window.__phoneShell.registerModule(questModule);
  } else {
    // 降级：直接挂载
    window.PhoneModules = window.PhoneModules || {};
    window.PhoneModules.Quest = questModule;
  }

  console.log(`[Module] QuestModule 已注册`);
})();
