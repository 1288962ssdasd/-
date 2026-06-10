/**
 * TaskModule - 任务模块
 * 职责：生命周期管理、事件绑定、调用 Service
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Task
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 task- 前缀隔离（铁则十一）
 *   - DOM 操作委托给 TaskRenderer（铁则三）
 */

;(function () {
  'use strict';

  class TaskModule extends PhoneApp {
    constructor() {
      super({
        id: 'task',
        name: '任务',
        icon: '\uD83D\uDCCB',
        iconBg: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
      });
      this._service = null;
      this._unsubscribers = [];
      this._currentFilter = 'all'; // all | active | status
      this._currentStatusFilter = '';
      this._currentView = 'LIST'; // LIST | DETAIL
      this._currentTaskId = null;
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Quest(window.Platform);
      this._questStatus = window.PhoneServices.Quest?.STATUS || {};
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 渲染（委托 Renderer） ====================

    /**
     * 获取 TaskRenderer 实例
     * @returns {TaskRenderer|null}
     */
    _getRenderer() {
      const RendererClass = window.PhoneRenderers?.Task;
      if (!RendererClass) {
        console.warn('[TaskModule] TaskRenderer 不可用');
        return null;
      }
      // 使用懒加载单例，避免重复创建
      if (!this._rendererInstance) {
        this._rendererInstance = new RendererClass();
      }
      return this._rendererInstance;
    }

    onRender() {
      const renderer = this._getRenderer();
      if (renderer) {
        renderer.injectStyles();
        return renderer.renderShell();
      }
      // 降级：Renderer 不可用时返回最小结构
      return '<div class="task-app"><div class="task-error">渲染器不可用</div></div>';
    }

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 筛选按钮
          const filterBtn = e.target.closest('[data-action^="filter-"]');
          if (filterBtn) {
            const filter = filterBtn.dataset.action.replace('filter-', '');
            await this._handleFilter(filter);
            return;
          }

          // 家族信息
          if (e.target.closest('[data-action="show-family"]')) {
            await this._showFamilyView();
            return;
          }

          // 新增任务
          if (e.target.closest('[data-action="add-task"]')) {
            await this._handleAddTask();
            return;
          }

          // 返回列表
          if (e.target.closest('[data-action="back"]')) {
            await this._showListView();
            return;
          }

          // 接受任务
          if (e.target.closest('[data-action="accept"]')) {
            const taskId = e.target.closest('[data-action]').dataset.taskId;
            await this._handleAcceptTask(taskId);
            return;
          }

          // 前往步骤 App
          if (e.target.closest('[data-action="go-step-app"]')) {
            const el = e.target.closest('[data-action]');
            await this._handleGoStepApp(el.dataset.taskId, parseInt(el.dataset.stepIndex, 10));
            return;
          }

          // 标记当前步骤完成
          if (e.target.closest('[data-action="mark-step"]')) {
            const el = e.target.closest('[data-action]');
            await this._handleMarkStep(el.dataset.taskId);
            return;
          }

          // 更新进度（无步骤的遗留任务）
          if (e.target.closest('[data-action="progress"]')) {
            const taskId = e.target.closest('[data-action]').dataset.taskId;
            await this._handleUpdateProgress(taskId);
            return;
          }

          // 完成任务
          if (e.target.closest('[data-action="complete"]')) {
            const taskId = e.target.closest('[data-action]').dataset.taskId;
            await this._handleCompleteTask(taskId);
            return;
          }

          // 删除任务
          if (e.target.closest('[data-action="delete"]')) {
            const taskId = e.target.closest('[data-action]').dataset.taskId;
            await this._handleDeleteTask(taskId);
            return;
          }

          // 点击任务项查看详情
          const taskItem = e.target.closest('[data-task-id]');
          if (taskItem && !e.target.closest('[data-action]')) {
            await this._showTaskDetail(taskItem.dataset.taskId);
            return;
          }
        });

        this._subscribeData();
        this._renderList();
      }, 0);
    }

    // ==================== 视图切换 ====================

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      this._currentView = viewName;
    }

    async _showListView() {
      this._currentTaskId = null;
      this._showView('LIST');
      await this._renderList();
    }

    async _showTaskDetail(taskId) {
      this._currentTaskId = taskId;
      this._showView('DETAIL');
      await this._renderDetail();
    }

    async _showFamilyView() {
      this._showView('FAMILY');
      await this._renderFamily();
    }

    // ==================== 列表视图（委托 Renderer） ====================

    async _renderList() {
      const container = this._container?.querySelector('[data-view="LIST"]');
      if (!container) return;

      try {
        let tasks;
        if (this._currentFilter === 'active') {
          tasks = await this._service.getActiveQuests();
        } else if (this._currentFilter === 'status' && this._currentStatusFilter) {
          tasks = await this._service.getQuestsByStatus(this._currentStatusFilter);
        } else {
          tasks = await this._service.getAllQuests();
        }

        const renderer = this._getRenderer();
        if (!renderer) {
          container.innerHTML = '<div class="task-error">渲染器不可用</div>';
          return;
        }

        container.innerHTML = renderer.renderList(tasks, this._statusLabel.bind(this));
      } catch (e) {
        console.warn('[TaskModule] 渲染失败:', e);
        const renderer = this._getRenderer();
        container.innerHTML = renderer
          ? renderer.renderError('加载失败，请重试')
          : '<div class="task-error">加载失败，请重试</div>';
      }
    }

    // ==================== 详情视图（委托 Renderer） ====================

    async _renderDetail() {
      const container = this._container?.querySelector('[data-view="DETAIL"]');
      if (!container || !this._currentTaskId) return;

      try {
        const task = await this._service.getQuest(this._currentTaskId);
        if (!task) {
          const renderer = this._getRenderer();
          container.innerHTML = renderer
            ? renderer.renderError('任务不存在')
            : '<div class="task-error">任务不存在</div>';
          return;
        }

        const renderer = this._getRenderer();
        if (!renderer) {
          container.innerHTML = '<div class="task-error">渲染器不可用</div>';
          return;
        }

        container.innerHTML = renderer.renderDetail(
          task,
          this._statusLabel.bind(this),
          this._formatRewards.bind(this),
          this._getStepActionHint.bind(this)
        );
      } catch (e) {
        console.warn('[TaskModule] 渲染详情失败:', e);
        const renderer = this._getRenderer();
        container.innerHTML = renderer
          ? renderer.renderError('加载失败，请重试')
          : '<div class="task-error">加载失败，请重试</div>';
      }
    }

    // ==================== 家族视图（委托 Renderer） ====================

    async _renderFamily() {
      const container = this._container?.querySelector('[data-view="FAMILY"]');
      if (!container) return;

      try {
        const familyInfo = await this._service.getFamilyInfo();
        const renderer = this._getRenderer();
        if (!renderer) {
          container.innerHTML = '<div class="task-error">渲染器不可用</div>';
          return;
        }

        container.innerHTML = renderer.renderFamily(familyInfo);
      } catch (e) {
        console.warn('[TaskModule] 渲染家族信息失败:', e);
        const renderer = this._getRenderer();
        container.innerHTML = renderer
          ? renderer.renderError('加载失败，请重试')
          : '<div class="task-error">加载失败，请重试</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handleFilter(filter) {
      if (filter === 'status') {
        const status = await this.showPrompt({ message: '请输入要筛选的任务状态:' });
        if (!status?.trim()) return;
        this._currentStatusFilter = status.trim();
        this._currentFilter = 'status';
      } else {
        this._currentFilter = filter;
        this._currentStatusFilter = '';
      }

      // 更新按钮高亮
      this._container?.querySelectorAll('[data-action^="filter-"]').forEach(btn => {
        btn.classList.toggle('task-btn-active', btn.dataset.action === 'filter-' + filter);
      });

      await this._renderList();
    }

    async _handleAddTask() {
      const name = await this.showPrompt({ message: '任务名称:' });
      if (!name?.trim()) return;

      try {
        const task = await this._service.createQuest({ name: name.trim(), source: 'manual' });
        if (task) {
          await this._renderList();
          this.showToast('任务已添加', 'success');
        } else {
          this.showToast('添加任务失败', 'error');
        }
      } catch (err) {
        console.error('[TaskModule] 添加任务失败:', err);
        this.showToast('添加任务失败: ' + err.message, 'error');
      }
    }

    async _handleAcceptTask(taskId) {
      try {
        const result = await this._service.acceptQuest(taskId);
        if (result) {
          this.showToast('已接受任务', 'success');
          await this._renderDetail();
        } else {
          this.showToast('无法接受（可能前置条件未满足）', 'error');
        }
      } catch (err) {
        console.error('[TaskModule] 接受任务失败:', err);
        this.showToast('接受任务失败: ' + err.message, 'error');
      }
    }

    async _handleMarkStep(taskId) {
      try {
        const ok = await this._service.markStepDone(taskId);
        if (ok) {
          this.showToast('步骤已完成', 'success');
          await this._renderDetail();
          const q = await this._service.getQuest(taskId);
          if (q?.status === 'completed') {
            this.showToast('任务完成，奖励已发放', 'success');
            await this._showListView();
          }
        } else {
          this.showToast('步骤更新失败', 'error');
        }
      } catch (err) {
        this.showToast('步骤更新失败', 'error');
      }
    }

    async _handleGoStepApp(taskId, stepIndex) {
      try {
        const task = await this._service.getQuest(taskId);
        const step = task?.steps?.[stepIndex];
        if (!step?.app) return;

        const appId = step.app === 'msg' ? 'message' : step.app;
        const params = { ...(step.params || {}), questId: taskId, fromQuest: true };
        if (step.streamId) params.streamId = step.streamId;
        if (step.friendId) params.friendId = step.friendId;

        if (window.__phoneShell?.launchApp) {
          await window.__phoneShell.launchApp(appId, params);
          await this._service.tryAutoCompleteFromAction('open_app', { app: step.app, questId: taskId });
        } else {
          this.showToast('无法打开应用: ' + appId, 'error');
        }
      } catch (e) {
        console.warn('[TaskModule] 跳转应用失败:', e);
      }
    }

    async _handleUpdateProgress(taskId) {
      await this._handleMarkStep(taskId);
    }

    async _handleCompleteTask(taskId) {
      if (!await this.confirm('确定领取任务奖励吗？')) return;

      try {
        const result = await this._service.completeQuest(taskId);
        if (result) {
          this.showToast('任务已完成，奖励已发放', 'success');
          await this._showListView();
        } else {
          this.showToast('还有未完成的步骤', 'error');
        }
      } catch (err) {
        console.error('[TaskModule] 完成任务失败:', err);
        this.showToast('完成任务失败: ' + err.message, 'error');
      }
    }

    async _handleDeleteTask(taskId) {
      if (!await this.confirm('确定删除此任务吗？')) return;

      try {
        const result = await this._service.deleteQuest(taskId);
        if (result) {
          this.showToast('任务已删除', 'success');
          await this._showListView();
        } else {
          this.showToast('删除任务失败', 'error');
        }
      } catch (err) {
        console.error('[TaskModule] 删除任务失败:', err);
        this.showToast('删除任务失败: ' + err.message, 'error');
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsub = this._service.subscribeQuests(() => {
          if (this._currentView === 'LIST') this._renderList();
          else if (this._currentView === 'DETAIL' && this._currentTaskId) this._renderDetail();
        });
        if (unsub) this._unsubscribers.push(unsub);
      } catch (e) {
        console.warn('[TaskModule] 订阅任务数据失败:', e);
      }

      const refresh = async () => {
        if (this._currentView === 'LIST') await this._renderList();
        else if (this._currentView === 'DETAIL' && this._currentTaskId) await this._renderDetail();
      };

      // EventBus 补充订阅（仅订阅 subscribeQuests 未覆盖的事件）
      ['director:quest', 'quest:stepAdvanced', 'economy:spent'].forEach(ev => {
        try {
          const bus = window.Platform?.eventBus;
          if (!bus) return;
          const fn = () => refresh();
          bus.on(ev, fn);
          this._unsubscribers.push(() => { try { bus.off(ev, fn); } catch (_) {} });
        } catch (_) {}
      });
    }

    // ==================== 数据格式化工具 ====================

    _statusLabel(status) {
      const map = {
        available: '可接取',
        active: '进行中',
        completed: '已完成',
        failed: '已失败',
        locked: '未解锁',
        archived: '已归档',
      };
      return map[status] || status || '未知';
    }

    _formatRewards(rewards) {
      if (!rewards) return '';
      if (typeof rewards === 'string') return rewards;
      const parts = [];
      if (rewards.gold) parts.push(rewards.gold + ' 金币');
      if (rewards.exp) parts.push(rewards.exp + ' 经验');
      if (rewards.hp) parts.push(rewards.hp + ' HP');
      if (rewards.description) parts.push(rewards.description);
      return parts.join(' · ') || '';
    }

    /**
     * 获取步骤操作提示文本（委托 Service 或降级）
     * @param {Object} step - 步骤对象
     * @returns {string}
     */
    _getStepActionHint(step) {
      if (this._service?.getStepActionHint) {
        return this._service.getStepActionHint(step);
      }
      return step.description || '';
    }

    // ==================== 静态工厂方法 ====================

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new TaskModule();
      return {
        id: instance.id,
        name: instance.name,
        icon: instance.icon,
        iconBg: instance.iconBg,
        init: (phone, params) => instance.init(phone, params),
        resume: (params) => instance.resume(params),
        pause: () => instance.pause(),
        destroy: () => instance.destroy(),
        render: () => instance.render(),
      };
    }
  }

  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Task = TaskModule;

  console.log('[Module] TaskModule 已加载');
})();
