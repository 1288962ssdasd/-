/**
 * @layer Renderer
 * @file   task-renderer.js
 *
 * 职责: 任务 UI 渲染 - iOS 提醒事项风格任务列表、详情、家族信息
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 设计原则:
 *   - 所有公开方法返回 HTML 字符串（纯函数，输入数据 → 输出 HTML）
 *   - 交互通过 data-action / data-task-id / data-step-index 属性标记
 *   - Module 层通过事件委托处理交互
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 task- 前缀
 */

;(function () {
  'use strict';

  class TaskRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.textContent = `
        /* ===== task-app: iOS 提醒事项风格 ===== */
        .task-app {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          color: #000;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .task-app *, .task-app *::before, .task-app *::after {
          box-sizing: border-box;
        }

        /* ===== task-header: 白色标题栏 ===== */
        .task-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #ffffff;
          border-bottom: 0.5px solid #e5e5e5;
          padding: 14px 20px;
          flex-shrink: 0;
        }
        .task-title {
          font-size: 28px;
          font-weight: 700;
          color: #000;
          letter-spacing: -0.3px;
          margin: 0;
        }

        /* ===== task-toolbar: 工具栏 ===== */
        .task-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          background: #f5f5f5;
        }
        .task-toolbar::-webkit-scrollbar {
          display: none;
        }

        /* ===== task-btn: 通用按钮 ===== */
        .task-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 14px;
          border: none;
          border-radius: 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          outline: none;
          white-space: nowrap;
          flex-shrink: 0;
          background: #e5e5e5;
          color: #333;
        }
        .task-btn:active {
          opacity: 0.7;
          transform: scale(0.97);
        }

        /* ===== task-btn-filter: 筛选按钮 ===== */
        .task-btn-filter {
          background: #e5e5e5;
          color: #333;
        }
        .task-btn-filter.task-btn-active {
          background: #007aff;
          color: #ffffff;
        }

        /* ===== task-btn-family: 家族按钮 ===== */
        .task-btn-family {
          background: rgba(175, 82, 222, 0.1);
          color: #af52de;
        }

        /* ===== task-btn-add: 添加按钮 ===== */
        .task-btn-add {
          background: #007aff;
          color: #ffffff;
        }

        /* ===== task-views 容器 ===== */
        .task-views {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0 16px 24px;
        }

        /* ===== task-item: 白色卡片 ===== */
        .task-item {
          background: #ffffff;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 8px;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
          transition: transform 0.15s ease;
          cursor: pointer;
        }
        .task-item:active {
          transform: scale(0.985);
        }

        /* ===== task-item-info ===== */
        .task-item-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* ===== task-name: 任务名称 ===== */
        .task-name {
          font-size: 16px;
          font-weight: 600;
          color: #000;
          line-height: 1.3;
        }

        /* ===== task-desc: 任务描述 ===== */
        .task-desc {
          font-size: 13px;
          color: #999;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ===== task-item-bottom: 底部信息行 ===== */
        .task-item-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }

        /* ===== task-status: 状态标签 ===== */
        .task-status {
          display: inline-block;
          font-size: 12px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 6px;
          align-self: flex-start;
          background: #e5e5e5;
          color: #999;
        }
        .task-status.task-status-active {
          background: rgba(0, 122, 255, 0.1);
          color: #007aff;
        }

        /* ===== task-priority: 优先级标签 ===== */
        .task-priority {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .task-priority-high {
          background: rgba(255, 59, 48, 0.1);
          color: #ff3b30;
        }
        .task-priority-medium {
          background: rgba(255, 149, 0, 0.1);
          color: #ff9500;
        }
        .task-priority-low {
          background: rgba(52, 199, 89, 0.1);
          color: #34c759;
        }

        /* ===== task-due: 截止日期 ===== */
        .task-due {
          font-size: 12px;
          color: #999;
        }

        /* ===== task-progress: 进度条 ===== */
        .task-progress {
          font-size: 13px;
          color: #007aff;
          font-weight: 500;
        }
        .task-progress-bar {
          width: 100%;
          height: 4px;
          background: #e5e5e5;
          border-radius: 2px;
          margin-top: 4px;
          overflow: hidden;
        }
        .task-progress-fill {
          height: 100%;
          background: #007aff;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* ===== task-detail: 详情页 ===== */
        .task-detail {
          padding-top: 8px;
        }
        .task-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .task-detail-title {
          font-size: 20px;
          font-weight: 700;
          color: #000;
          margin: 0;
        }

        /* ===== task-detail-body: iOS设置风格属性列表 ===== */
        .task-detail-body {
          background: #ffffff;
          border-radius: 12px;
          padding: 0;
          margin-bottom: 20px;
          overflow: hidden;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }

        /* ===== task-detail-row: key-value行 ===== */
        .task-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px 16px;
          border-bottom: 0.5px solid #f0f0f0;
        }
        .task-detail-row:last-child {
          border-bottom: none;
        }
        .task-detail-label {
          font-size: 15px;
          color: #999;
          font-weight: 400;
        }
        .task-detail-value {
          font-size: 15px;
          color: #000;
          font-weight: 500;
          text-align: right;
        }

        /* ===== task-detail-progress: 详情页进度条 ===== */
        .task-detail-progress {
          padding: 16px;
          background: #ffffff;
          border-radius: 12px;
          margin-bottom: 20px;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }
        .task-detail-progress-label {
          font-size: 13px;
          color: #999;
          margin-bottom: 8px;
        }
        .task-detail-progress-bar {
          width: 100%;
          height: 6px;
          background: #e5e5e5;
          border-radius: 3px;
          overflow: hidden;
        }
        .task-detail-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007aff, #5ac8fa);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .task-detail-progress-text {
          font-size: 13px;
          color: #007aff;
          font-weight: 500;
          margin-top: 6px;
          text-align: right;
        }

        /* ===== task-detail-actions: 操作按钮区 ===== */
        .task-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* ===== task-btn-accept: 蓝色按钮 ===== */
        .task-btn-accept {
          background: #007aff;
          color: #ffffff;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 14px;
        }

        /* ===== task-btn-progress: 橙色按钮 ===== */
        .task-btn-progress {
          background: #ff9500;
          color: #ffffff;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 14px;
        }

        /* ===== task-btn-complete: 绿色按钮 ===== */
        .task-btn-complete {
          background: #34c759;
          color: #ffffff;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 14px;
        }

        /* ===== task-btn-delete: 红色按钮 ===== */
        .task-btn-delete {
          background: #ff3b30;
          color: #ffffff;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 14px;
        }

        /* ===== task-family: 家族视图 ===== */
        .task-family {
          padding-top: 8px;
        }
        .task-family-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .task-family-title {
          font-size: 20px;
          font-weight: 700;
          color: #000;
          margin: 0;
        }
        .task-family-body {
          background: #ffffff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }
        .task-family-info {
          font-size: 13px;
          color: #333;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
          font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
        }

        /* ===== task-empty / task-error: 居中提示 ===== */
        .task-empty,
        .task-error {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 48px 20px;
          font-size: 15px;
          color: #999;
        }
        .task-error {
          color: #ff3b30;
        }

        /* ===== 多步骤任务 ===== */
        .task-steps {
          margin-top: 12px;
          background: #fff;
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 0.5px 2px rgba(0,0,0,0.04);
        }
        .task-steps-title {
          font-size: 13px;
          font-weight: 600;
          color: #666;
          margin-bottom: 10px;
        }
        .task-step-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 0.5px solid #eee;
        }
        .task-step-item:last-child { border-bottom: none; }
        .task-step-check {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #c7c7cc;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: #fff;
        }
        .task-step-done .task-step-check {
          background: #34c759;
          border-color: #34c759;
        }
        .task-step-current .task-step-check {
          border-color: #007aff;
        }
        .task-step-body { flex: 1; min-width: 0; }
        .task-step-label { font-size: 15px; font-weight: 500; color: #000; }
        .task-step-hint { font-size: 12px; color: #8e8e93; margin-top: 2px; }
        .task-step-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
        .task-step-btn {
          font-size: 13px;
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          background: #007aff;
          color: #fff;
          cursor: pointer;
        }
        .task-step-btn-secondary {
          background: #f2f2f7;
          color: #007aff;
        }
        .task-reward-box {
          margin-top: 12px;
          padding: 10px 12px;
          background: #fff8e6;
          border-radius: 10px;
          font-size: 13px;
          color: #8a6d00;
        }
        .task-issuer {
          font-size: 12px;
          color: #8e8e93;
          margin-top: 4px;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 辅助方法 ====================

    /**
     * HTML 转义，防止 XSS
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // ==================== 主框架渲染 ====================

    /**
     * 渲染应用外壳 HTML
     * @returns {string} HTML 字符串
     */
    renderShell() {
      return `
        <div class="task-app">
          <div class="task-header">
            <h3 class="task-title">任务列表</h3>
          </div>
          <div class="task-toolbar">
            <button class="task-btn task-btn-filter task-btn-active" data-action="filter-all">全部</button>
            <button class="task-btn task-btn-filter" data-action="filter-active">进行中</button>
            <button class="task-btn task-btn-filter" data-action="filter-status">按状态</button>
            <button class="task-btn task-btn-family" data-action="show-family">家族</button>
            <button class="task-btn task-btn-add" data-action="add-task">+ 新任务</button>
          </div>
          <div class="task-views">
            <div class="task-view" data-view="LIST"></div>
            <div class="task-view" data-view="DETAIL" style="display:none;"></div>
            <div class="task-view" data-view="FAMILY" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    // ==================== 列表视图 ====================

    /**
     * 渲染任务列表 HTML
     * @param {Array} tasks - 任务数组
     * @param {Function} statusLabelFn - 状态标签格式化函数 (status) => string
     * @returns {string} HTML 字符串
     */
    renderList(tasks, statusLabelFn) {
      if (!tasks || tasks.length === 0) {
        return '<div class="task-empty">暂无任务<br><span style="font-size:13px;color:#aaa">AI 管家会在剧情推进时发布新任务</span></div>';
      }

      return tasks.map(task => {
        const stepTotal = task.steps?.length || 0;
        const stepDone = task.steps?.filter(s => s.completed).length || 0;
        const isActive = task.status === 'active';
        const statusLabel = statusLabelFn ? statusLabelFn(task.status) : task.status;

        return `
          <div class="task-item" data-task-id="${this.escapeHtml(task.id)}">
            <div class="task-item-info">
              <div class="task-name">${this.escapeHtml(task.name)}</div>
              ${task.description ? `<div class="task-desc">${this.escapeHtml(task.description)}</div>` : ''}
              ${task.friendId || task.issuerName ? `<div class="task-issuer">来自: ${this.escapeHtml(task.issuerName || task.friendId)}</div>` : ''}
              <div class="task-item-bottom">
                <span class="task-status ${isActive ? 'task-status-active' : ''}">${this.escapeHtml(statusLabel)}</span>
                ${stepTotal ? `<span class="task-priority task-priority-medium">步骤 ${stepDone}/${stepTotal}</span>` : ''}
              </div>
              ${isActive && stepTotal ? `
                <div class="task-progress-bar">
                  <div class="task-progress-fill" style="width: ${Math.round((stepDone / stepTotal) * 100)}%"></div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // ==================== 详情视图 ====================

    /**
     * 渲染任务详情 HTML
     * @param {Object} task - 任务对象
     * @param {Function} statusLabelFn - 状态标签格式化函数 (status) => string
     * @param {Function} rewardTextFn - 奖励文本格式化函数 (rewards) => string
     * @param {Function} stepHintFn - 步骤提示格式化函数 (step) => string
     * @returns {string} HTML 字符串
     */
    renderDetail(task, statusLabelFn, rewardTextFn, stepHintFn) {
      const stepsHtml = this._renderStepsHtml(task, stepHintFn);
      const rewardText = rewardTextFn ? rewardTextFn(task.rewards) : '';
      const isAvailable = task.status === 'available';
      const isActive = task.status === 'active';
      const canComplete = isActive && (!task.steps?.length || task.steps.every(s => s.completed));
      const statusLabel = statusLabelFn ? statusLabelFn(task.status) : task.status;

      return `
        <div class="task-detail">
          <div class="task-detail-header">
            <button class="task-btn" data-action="back">&larr; 返回</button>
            <h4 class="task-detail-title">${this.escapeHtml(task.name)}</h4>
          </div>
          <div class="task-detail-body">
            <div class="task-detail-row">
              <span class="task-detail-label">状态</span>
              <span class="task-detail-value">${this.escapeHtml(statusLabel)}</span>
            </div>
            ${task.friendId || task.issuerName ? `
              <div class="task-detail-row">
                <span class="task-detail-label">发布者</span>
                <span class="task-detail-value">${this.escapeHtml(task.issuerName || task.friendId)}</span>
              </div>
            ` : ''}
            ${task.description ? `
              <div class="task-detail-row">
                <span class="task-detail-label">描述</span>
                <span class="task-detail-value">${this.escapeHtml(task.description)}</span>
              </div>
            ` : ''}
          </div>
          ${rewardText ? `<div class="task-reward-box">🎁 奖励: ${this.escapeHtml(rewardText)}</div>` : ''}
          ${stepsHtml}
          <div class="task-detail-actions">
            ${isAvailable ? `<button class="task-btn task-btn-accept" data-action="accept" data-task-id="${this.escapeHtml(task.id)}">接受任务</button>` : ''}
            ${isActive && task.steps?.length ? `<button class="task-btn task-btn-progress" data-action="mark-step" data-task-id="${this.escapeHtml(task.id)}">完成当前步骤</button>` : ''}
            ${canComplete || (isActive && !task.steps?.length) ? `<button class="task-btn task-btn-complete" data-action="complete" data-task-id="${this.escapeHtml(task.id)}">领取奖励</button>` : ''}
            <button class="task-btn task-btn-delete" data-action="delete" data-task-id="${this.escapeHtml(task.id)}">删除任务</button>
          </div>
        </div>
      `;
    }

    // ==================== 步骤渲染 ====================

    /**
     * 渲染步骤列表 HTML（内部方法）
     * @param {Object} task - 任务对象
     * @param {Function} stepHintFn - 步骤提示格式化函数 (step) => string
     * @returns {string} HTML 字符串
     */
    _renderStepsHtml(task, stepHintFn) {
      if (!task.steps?.length) return '';
      const cur = task.currentStep ?? 0;
      const items = task.steps.map((step, i) => {
        const done = !!step.completed;
        const isCurrent = !done && i === cur && task.status === 'active';
        const hint = stepHintFn ? stepHintFn(step) : (step.description || '');
        const goApp = step.type === 'open_app' && step.app;
        const actions = [];
        if (isCurrent && goApp) {
          actions.push(`<button class="task-step-btn" data-action="go-step-app" data-task-id="${this.escapeHtml(task.id)}" data-step-index="${i}">前往 ${this.escapeHtml(step.app)}</button>`);
        }
        if (isCurrent) {
          actions.push(`<button class="task-step-btn task-step-btn-secondary" data-action="mark-step" data-task-id="${this.escapeHtml(task.id)}">我已完成</button>`);
        }
        return `
          <div class="task-step-item ${done ? 'task-step-done' : ''} ${isCurrent ? 'task-step-current' : ''}">
            <div class="task-step-check">${done ? '✓' : i + 1}</div>
            <div class="task-step-body">
              <div class="task-step-label">${this.escapeHtml(step.label || '步骤 ' + (i + 1))}</div>
              ${hint ? `<div class="task-step-hint">${this.escapeHtml(hint)}</div>` : ''}
              ${actions.length ? `<div class="task-step-actions">${actions.join('')}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      return `<div class="task-steps"><div class="task-steps-title">任务步骤</div>${items}</div>`;
    }

    // ==================== 家族视图 ====================

    /**
     * 渲染家族信息 HTML
     * @param {Object|null} familyInfo - 家族信息对象
     * @returns {string} HTML 字符串
     */
    renderFamily(familyInfo) {
      return `
        <div class="task-family">
          <div class="task-family-header">
            <button class="task-btn" data-action="back">&larr; 返回</button>
            <h4 class="task-family-title">家族信息</h4>
          </div>
          <div class="task-family-body">
            ${familyInfo
              ? `<div class="task-family-info">${this.escapeHtml(JSON.stringify(familyInfo, null, 2))}</div>`
              : '<div class="task-empty">暂无家族信息</div>'
            }
          </div>
        </div>
      `;
    }

    // ==================== 空状态 / 错误 ====================

    /**
     * 渲染空状态 HTML
     * @param {string} message
     * @returns {string} HTML 字符串
     */
    renderEmpty(message) {
      return `<div class="task-empty">${this.escapeHtml(message || '暂无任务')}</div>`;
    }

    /**
     * 渲染错误状态 HTML
     * @param {string} message
     * @returns {string} HTML 字符串
     */
    renderError(message) {
      return `<div class="task-error">${this.escapeHtml(message || '加载失败，请重试')}</div>`;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Task = TaskRenderer;

  console.log('[Renderer] TaskRenderer 已加载');
})();
