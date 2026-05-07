/**
 * TaskAppNew - 任务应用重写模块
 * 继承 ContextDrivenApp 基类，使用 ES6+ 语法
 * 兼容 Mvu 框架和 SillyTavern context
 */
;(function () {
  'use strict';

  class TaskAppNew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'TaskAppNew' });

      /** @type {'available'|'inProgress'|'completed'} 当前激活的 tab */
      this._currentView = 'available';

      /** @type {Array<{id:string, name:string, status:string, desc:string, reward:string}>} 内部任务列表 */
      this._tasks = [];

      /** @type {string} 视图标题映射 */
      this._viewTitles = {
        available: '可接任务',
        inProgress: '进行中',
        completed: '已完成',
      };
    }

    /* ------------------------------------------------------------------ */
    /*  生命周期                                                           */
    /* ------------------------------------------------------------------ */

    onInit() {
      console.log('[TaskAppNew] 初始化');
      this._parseTasksFromContext();
    }

    onDestroy() {
      this._tasks = [];
    }

    /* ------------------------------------------------------------------ */
    /*  数据层                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * 获取目标消息 ID（向上查找最近有 AI 消息的楼层）
     * @returns {string|number}
     */
    _resolveTargetMessageId() {
      if (typeof window.getLastMessageId !== 'function' || typeof window.getChatMessages !== 'function') {
        return 'latest';
      }
      let currentId = window.getLastMessageId();
      while (currentId >= 0) {
        const message = window.getChatMessages(currentId).at(-1);
        if (message && message.role !== 'user') {
          return currentId;
        }
        currentId--;
      }
      return 'latest';
    }

    /**
     * 从 Mvu / SillyTavern context 读取原始任务数据
     * @returns {Object|null}
     */
    _getCurrentTaskData() {
      // 路径 1: Mvu
      if (window.Mvu && typeof window.Mvu.getMvuData === 'function') {
        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (mvuData?.stat_data?.['任务']) {
          return mvuData.stat_data['任务'];
        }
        if (mvuData?.['任务']) {
          return mvuData['任务'];
        }
      }

      // 路径 2: SillyTavern context（备用）
      if (window.SillyTavern) {
        const ctx = typeof window.SillyTavern.getContext === 'function'
          ? window.SillyTavern.getContext()
          : window.SillyTavern;
        const statData = ctx?.chatMetadata?.variables?.['stat_data'];
        if (statData?.['任务']) {
          return statData['任务'];
        }
        const direct = ctx?.chatMetadata?.variables?.['任务'];
        if (direct && typeof direct === 'object') {
          return direct;
        }
      }

      return null;
    }

    /**
     * 将 Mvu 原始格式解析为内部格式
     * @param {Object} rawData
     * @returns {Array<{id:string, name:string, status:string, desc:string, reward:string}>}
     */
    _parseTaskData(rawData) {
      if (!rawData || typeof rawData !== 'object') return [];

      const tasks = [];
      for (const key of Object.keys(rawData)) {
        if (key === '$meta') continue;

        const entry = rawData[key];
        if (!entry || typeof entry !== 'object') continue;

        const val = (field) =>
          Array.isArray(entry[field]) ? entry[field][0] : (entry[field] || '');

        const name = val('任务名称') || key;
        const statusText = val('任务状态') || '可接';

        let status = 'available';
        if (statusText === '进行中') status = 'inProgress';
        else if (statusText === '已完成') status = 'completed';

        tasks.push({
          id: key,
          name,
          status,
          desc: val('任务描述') || '',
          reward: val('任务奖励') || val('奖励') || '',
        });
      }
      return tasks;
    }

    /**
     * 从上下文解析并更新内部任务列表
     */
    _parseTasksFromContext() {
      const raw = this._getCurrentTaskData();
      if (raw) {
        this._tasks = this._parseTaskData(raw);
        console.log(`[TaskAppNew] 解析到 ${this._tasks.length} 个任务`);
      } else {
        this._tasks = [];
        console.log('[TaskAppNew] 未找到任务数据');
      }
    }

    /**
     * 计算数据哈希（用于变更检测）
     * @returns {string}
     */
    _computeDataHash() {
      try {
        return JSON.stringify(this._tasks);
      } catch (_) {
        return '';
      }
    }

    /* ------------------------------------------------------------------ */
    /*  任务操作                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * 接取任务（修改 Mvu 变量状态为"进行中"）
     * @param {string} taskId
     */
    async _acceptTask(taskId) {
      const task = this._tasks.find((t) => t.id === taskId && t.status === 'available');
      if (!task) {
        this.showToast('任务不存在或已接取', 'warning');
        return;
      }

      try {
        if (!window.Mvu) throw new Error('Mvu 不可用');

        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (!mvuData?.stat_data?.['任务']) {
          throw new Error('任务数据不存在');
        }

        await window.Mvu.setMvuVariable(
          mvuData,
          `任务.${taskId}.任务状态[0]`,
          '进行中',
          { reason: `接受任务：${task.name}`, is_recursive: false },
        );

        await window.Mvu.replaceMvuData(mvuData, { type: 'message', message_id: targetId });

        this.showToast('任务接取成功', 'success');
        this._parseTasksFromContext();
        this.refresh();
      } catch (err) {
        console.error('[TaskAppNew] 接取任务失败:', err);
        this.showToast('接取失败: ' + err.message, 'error');
      }
    }

    /**
     * 完成任务（修改 Mvu 变量状态为"已完成"）
     * @param {string} taskId
     */
    async _completeTask(taskId) {
      const task = this._tasks.find((t) => t.id === taskId && t.status === 'inProgress');
      if (!task) {
        this.showToast('任务不存在或未在进行中', 'warning');
        return;
      }

      try {
        if (!window.Mvu) throw new Error('Mvu 不可用');

        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (!mvuData?.stat_data?.['任务']) {
          throw new Error('任务数据不存在');
        }

        await window.Mvu.setMvuVariable(
          mvuData,
          `任务.${taskId}.任务状态[0]`,
          '已完成',
          { reason: `完成任务：${task.name}`, is_recursive: false },
        );

        await window.Mvu.replaceMvuData(mvuData, { type: 'message', message_id: targetId });

        this.showToast('任务已完成', 'success');
        this._parseTasksFromContext();
        this.refresh();
      } catch (err) {
        console.error('[TaskAppNew] 完成任务失败:', err);
        this.showToast('完成失败: ' + err.message, 'error');
      }
    }

    /**
     * 通过手机内部 AI 生成内容
     * @param {string} message
     * @returns {Promise<string|null>}
     */
    async generateViaPhoneAI(message) {
      // 方法 1: customAPI
      if (window.mobileCustomAPIConfig?.isAPIAvailable?.()) {
        try {
          const res = await window.mobileCustomAPIConfig.callAPI(
            [{ role: 'user', content: message }],
            { temperature: 0.8, maxTokens: 500 },
          );
          if (typeof res === 'string') return res;
          if (res?.choices?.[0]?.message?.content) return res.choices[0].message.content;
        } catch (e) {
          console.warn('[TaskAppNew] customAPI failed:', e);
        }
      }
      // 方法 2: RoleAPI
      if (window.RoleAPI?.isEnabled?.()) {
        try {
          const res = await window.RoleAPI.sendMessage('system', 'system', message, { skipHistory: true });
          if (res) return res;
        } catch (e) {
          console.warn('[TaskAppNew] RoleAPI failed:', e);
        }
      }
      // 方法 3: XBBridge
      if (window.XBBridge?.isAvailable?.()) {
        try {
          const res = await new Promise((resolve, reject) => {
            window.XBBridge.generate.generate({ prompt: message }, resolve, reject);
          });
          if (res) return res;
        } catch (e) {
          console.warn('[TaskAppNew] XBBridge failed:', e);
        }
      }
      console.warn('[TaskAppNew] 所有 AI 后端不可用');
      return null;
    }

    /* ------------------------------------------------------------------ */
    /*  渲染                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * 按状态筛选任务
     * @param {string} status
     * @returns {Array}
     */
    _filterTasks(status) {
      return this._tasks.filter((t) => t.status === status);
    }

    /**
     * 生成单个任务卡片 HTML
     * @param {Object} task
     * @param {string} actionBtn - 操作按钮 HTML
     * @returns {string}
     */
    _renderTaskCard(task, actionBtn) {
      const statusLabel = { available: '可接', inProgress: '进行中', completed: '已完成' };
      const statusClass = { available: 'available', inProgress: 'in-progress', completed: 'completed' };

      return `
        <div class="task-new-card ${statusClass[task.status] || ''}" data-task-id="${task.id}">
          <div class="task-new-card-header">
            <span class="task-new-name">${this._esc(task.name)}</span>
            <span class="task-new-badge ${statusClass[task.status]}">${statusLabel[task.status] || ''}</span>
          </div>
          ${task.desc ? `<div class="task-new-desc">${this._esc(task.desc)}</div>` : ''}
          ${task.reward ? `<div class="task-new-reward">${this._esc(task.reward)}</div>` : ''}
          <div class="task-new-footer">
            <span class="task-new-id">ID: ${this._esc(task.id)}</span>
            ${actionBtn}
          </div>
        </div>`;
    }

    /**
     * 渲染 Tab 导航栏
     * @returns {string}
     */
    _renderTabs() {
      const counts = {
        available: this._filterTasks('available').length,
        inProgress: this._filterTasks('inProgress').length,
        completed: this._filterTasks('completed').length,
      };

      const tabs = [
        { key: 'available', label: '可接任务' },
        { key: 'inProgress', label: '进行中' },
        { key: 'completed', label: '已完成' },
      ];

      return `
        <div class="task-new-tabs">
          ${tabs
            .map(
              (t) => `
            <button class="task-new-tab ${this._currentView === t.key ? 'active' : ''}" data-view="${t.key}">
              ${t.label} (${counts[t.key]})
            </button>`,
            )
            .join('')}
        </div>`;
    }

    /**
     * 渲染空状态
     * @param {string} icon
     * @param {string} title
     * @param {string} [subtitle]
     * @returns {string}
     */
    _renderEmpty(icon, title, subtitle) {
      return `
        <div class="task-new-empty">
          <div class="task-new-empty-icon">${icon}</div>
          <div class="task-new-empty-title">${title}</div>
          ${subtitle ? `<div class="task-new-empty-sub">${subtitle}</div>` : ''}
        </div>`;
    }

    /** 渲染可接任务列表 */
    _renderAvailable() {
      const tasks = this._filterTasks('available');
      if (tasks.length === 0) {
        return this._renderEmpty('📋', '暂无可接任务', '等待新的任务发布');
      }
      return tasks
        .map((t) =>
          this._renderTaskCard(
            t,
            `<button class="task-new-btn task-new-btn-accept" data-task-id="${t.id}">接取</button>`,
          ),
        )
        .join('');
    }

    /** 渲染进行中任务列表 */
    _renderInProgress() {
      const tasks = this._filterTasks('inProgress');
      if (tasks.length === 0) {
        return this._renderEmpty('⏳', '暂无进行中任务', '快去接取一些任务吧');
      }
      return tasks
        .map((t) =>
          this._renderTaskCard(
            t,
            `<button class="task-new-btn task-new-btn-complete" data-task-id="${t.id}">完成</button>`,
          ),
        )
        .join('');
    }

    /** 渲染已完成任务列表 */
    _renderCompleted() {
      const tasks = this._filterTasks('completed');
      if (tasks.length === 0) {
        return this._renderEmpty('✅', '暂无已完成任务', '完成任务后会在这里显示');
      }
      return tasks.map((t) => this._renderTaskCard(t, '')).join('');
    }

    /**
     * 返回应用完整 HTML
     * @returns {string}
     */
    getAppContent() {
      // 每次渲染时重新解析数据，保证最新
      this._parseTasksFromContext();

      const viewMap = {
        available: () => this._renderAvailable(),
        inProgress: () => this._renderInProgress(),
        completed: () => this._renderCompleted(),
      };

      const content = (viewMap[this._currentView] || viewMap.available)();

      return `
        <div class="task-new-app">
          ${this._renderTabs()}
          <div class="task-new-list">${content}</div>
        </div>`;
    }

    /* ------------------------------------------------------------------ */
    /*  事件绑定                                                           */
    /* ------------------------------------------------------------------ */

    bindEvents() {
      const container = document.getElementById(this._containerId);
      if (!container) return;

      // Tab 切换
      container.querySelectorAll('.task-new-tab').forEach((tab) => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._switchView(e.currentTarget.dataset.view);
        });
      });

      // 接取任务
      container.querySelectorAll('.task-new-btn-accept').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._acceptTask(e.currentTarget.dataset.taskId);
        });
      });

      // 完成任务
      container.querySelectorAll('.task-new-btn-complete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._completeTask(e.currentTarget.dataset.taskId);
        });
      });
    }

    /**
     * 切换 Tab 视图
     * @param {string} view
     */
    _switchView(view) {
      if (!this._viewTitles[view]) return;
      this._currentView = view;
      this.updateHeader(this._viewTitles[view]);
      this.render();
    }

    /* ------------------------------------------------------------------ */
    /*  工具方法                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * 简单 HTML 转义
     * @param {string} str
     * @returns {string}
     */
    _esc(str) {
      if (!str) return '';
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(str).replace(/[&<>"']/g, (c) => map[c]);
    }
  }

  window.TaskAppNew = new TaskAppNew();
  console.log('[TaskAppNew] 模块加载完成');
})();
