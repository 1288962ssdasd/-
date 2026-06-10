/**
 * @layer Renderer
 * @file   quest-renderer.js
 * 
 * 职责: 任务UI渲染 - 小白板风格设计
 * 禁止: 包含业务逻辑、调用Service
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class QuestRenderer {
    constructor() {
      this._styles = null;
    }

    /**
     * 注入样式
     */
    injectStyles() {
      if (this._styles) return;
      
      const style = document.createElement('style');
      style.textContent = `
        /* 小白板风格 - 任务系统 */
        .lwb-panel {
          background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
        
        .lwb-header {
          background: linear-gradient(90deg, #4a90d9 0%, #5ba3e8 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.2);
        }
        
        .lwb-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .lwb-badge {
          background: rgba(255,255,255,0.25);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .lwb-content {
          padding: 20px;
          max-height: 500px;
          overflow-y: auto;
        }
        
        .lwb-section {
          margin-bottom: 24px;
        }
        
        .lwb-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #5a6c7d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .lwb-section-title::before {
          content: '';
          width: 4px;
          height: 16px;
          background: linear-gradient(180deg, #4a90d9, #5ba3e8);
          border-radius: 2px;
        }
        
        .lwb-quest-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          border-left: 4px solid #4a90d9;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .lwb-quest-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        
        .lwb-quest-card.active {
          border-left-color: #e74c3c;
          background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
        }
        
        .lwb-quest-card.available {
          border-left-color: #27ae60;
        }
        
        .lwb-quest-card.completed {
          border-left-color: #95a5a6;
          opacity: 0.8;
        }
        
        .lwb-quest-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        
        .lwb-quest-name {
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
          margin: 0;
        }
        
        .lwb-quest-status {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }
        
        .lwb-quest-status.active {
          background: #ffeaea;
          color: #e74c3c;
        }
        
        .lwb-quest-status.available {
          background: #e8f8f0;
          color: #27ae60;
        }
        
        .lwb-quest-status.completed {
          background: #ecf0f1;
          color: #7f8c8d;
        }
        
        .lwb-quest-desc {
          font-size: 13px;
          color: #5a6c7d;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        
        .lwb-quest-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          color: #7f8c8d;
        }
        
        .lwb-quest-reward {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #f39c12;
          font-weight: 500;
        }
        
        .lwb-quest-issuer {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .lwb-empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #95a5a6;
        }
        
        .lwb-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .lwb-empty-text {
          font-size: 14px;
        }
        
        .lwb-btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        .lwb-btn-primary {
          background: linear-gradient(90deg, #4a90d9, #5ba3e8);
          color: white;
        }
        
        .lwb-btn-primary:hover {
          background: linear-gradient(90deg, #3a7bc8, #4a90d9);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
        }
        
        .lwb-btn-secondary {
          background: #ecf0f1;
          color: #5a6c7d;
        }
        
        .lwb-btn-secondary:hover {
          background: #e0e4e8;
        }

        /* [v4.31.0-fix] 步骤按钮样式 */
        .lwb-btn-sm {
          padding: 5px 12px;
          font-size: 12px;
          border-radius: 6px;
        }

        .lwb-btn-sm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        .lwb-step-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .lwb-step.current {
          background: rgba(74, 144, 217, 0.08);
          border-left: 3px solid #4a90d9;
        }
        
        .lwb-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        
        .lwb-modal {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 480px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        
        .lwb-modal-header {
          background: linear-gradient(90deg, #4a90d9, #5ba3e8);
          color: white;
          padding: 20px;
          position: relative;
        }
        
        .lwb-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        .lwb-modal-close:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .lwb-modal-body {
          padding: 20px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .lwb-modal-footer {
          padding: 16px 20px;
          background: #f8f9fa;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        
        .lwb-steps {
          margin-top: 16px;
        }
        
        .lwb-step {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #ecf0f1;
        }
        
        .lwb-step:last-child {
          border-bottom: none;
        }
        
        .lwb-step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #ecf0f1;
          color: #7f8c8d;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .lwb-step.completed .lwb-step-number {
          background: #27ae60;
          color: white;
        }
        
        .lwb-step-content {
          flex: 1;
        }
        
        .lwb-step-title {
          font-size: 14px;
          font-weight: 500;
          color: #2c3e50;
          margin-bottom: 4px;
        }
        
        .lwb-step-hint {
          font-size: 12px;
          color: #95a5a6;
        }
      `;
      
      document.head.appendChild(style);
      this._styles = style;
    }

    /**
     * 渲染任务列表
     */
    renderQuestList({ active = [], available = [] }) {
      this.injectStyles();
      
      const container = document.createElement('div');
      container.className = 'lwb-panel';
      
      // 头部
      const header = document.createElement('div');
      header.className = 'lwb-header';
      header.innerHTML = `
        <div class="lwb-title">
          📋 任务面板
          <span class="lwb-badge">${active.length + available.length}</span>
        </div>
      `;
      container.appendChild(header);
      
      // 内容区
      const content = document.createElement('div');
      content.className = 'lwb-content';
      
      // 进行中任务
      if (active.length > 0) {
        const activeSection = this._renderSection('进行中', active, 'active');
        content.appendChild(activeSection);
      }
      
      // 可接取任务
      if (available.length > 0) {
        const availableSection = this._renderSection('可接取', available, 'available');
        content.appendChild(availableSection);
      }
      
      // 空状态
      if (active.length === 0 && available.length === 0) {
        content.appendChild(this._renderEmptyState());
      }
      
      container.appendChild(content);
      return container;
    }

    /**
     * 渲染任务详情弹窗
     */
    renderQuestDetail(quest, callbacks = {}) {
      this.injectStyles();
      
      const modal = document.createElement('div');
      modal.className = 'lwb-modal-overlay';

      // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
      const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
      const safeQuestName = escapeHtml(quest.name);
      const safeQuestDesc = escapeHtml(quest.description || '暂无描述');
      const safeIssuerName = escapeHtml(quest.issuerName || '未知');

      modal.innerHTML = `
        <div class="lwb-modal">
          <div class="lwb-modal-header">
            <h3 style="margin:0;font-size:18px;">${safeQuestName}</h3>
            <button class="lwb-modal-close">&times;</button>
          </div>
          <div class="lwb-modal-body">
            <p style="color:#5a6c7d;line-height:1.6;">${safeQuestDesc}</p>

            <div style="display:flex;gap:16px;margin:16px 0;padding:12px;background:#f8f9fa;border-radius:8px;">
              <div>
                <div style="font-size:12px;color:#95a5a6;">发布者</div>
                <div style="font-weight:500;color:#2c3e50;">${safeIssuerName}</div>
              </div>
              <div>
                <div style="font-size:12px;color:#95a5a6;">奖励</div>
                <div style="font-weight:500;color:#f39c12;">💰 ${quest.rewards?.gold || 0} 金币</div>
              </div>
            </div>

            ${quest.steps ? `
              <div class="lwb-steps">
                <div class="lwb-section-title">任务步骤</div>
                ${quest.steps.map((step, i) => {
                  const safeStepHint = escapeHtml(step.hint || step.type || step.label || ('步骤 ' + (i + 1)));
                  const safeStepWith = escapeHtml(step.with);
                  const isCompleted = !!step.completed;
                  const isActive = !isCompleted && quest.status === 'active';
                  const goApp = isActive && step.type === 'open_app' && (step.app || step.target);
                  const stepActions = [];

                  if (isActive) {
                    if (goApp) {
                      stepActions.push('<button class="lwb-btn lwb-btn-sm" data-action="go-step-app" data-step-index="' + i + '" data-app="' + escapeHtml(step.app || step.target) + '">前往' + escapeHtml(step.app || step.target) + '</button>');
                    }
                    stepActions.push('<button class="lwb-btn lwb-btn-sm lwb-btn-primary" data-action="complete-step" data-step-index="' + i + '">完成此步</button>');
                  }

                  return `
                    <div class="lwb-step ${isCompleted ? 'completed' : ''} ${isActive && !isCompleted ? 'current' : ''}">
                      <div class="lwb-step-number">${isCompleted ? '✓' : i + 1}</div>
                      <div class="lwb-step-content">
                        <div class="lwb-step-title">${safeStepHint}</div>
                        ${step.with ? '<div class="lwb-step-hint">与 ' + safeStepWith + ' 对话</div>' : ''}
                        ${stepActions.length ? '<div class="lwb-step-actions">' + stepActions.join('') + '</div>' : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
          <div class="lwb-modal-footer">
            ${quest.status === 'available' ? 
              `<button class="lwb-btn lwb-btn-primary" data-action="accept">接受任务</button>` : ''}
            ${quest.status === 'active' ? 
              `<button class="lwb-btn lwb-btn-secondary" data-action="abandon">放弃任务</button>` : ''}
            <button class="lwb-btn lwb-btn-secondary" data-action="close">关闭</button>
          </div>
        </div>
      `;
      
      // 绑定事件
      modal.querySelector('.lwb-modal-close').onclick = () => {
        callbacks.onClose?.();
        modal.remove();
      };
      
      modal.querySelector('[data-action="close"]')?.addEventListener('click', () => {
        callbacks.onClose?.();
        modal.remove();
      });
      
      modal.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
        callbacks.onAccept?.();
        modal.remove();
      });
      
      modal.querySelector('[data-action="abandon"]')?.addEventListener('click', () => {
        callbacks.onAbandon?.();
        modal.remove();
      });

      // [v4.31.0-fix] 绑定步骤交互按钮
      modal.querySelectorAll('[data-action="complete-step"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const stepIndex = parseInt(btn.dataset.stepIndex, 10);
          callbacks.onCompleteStep?.(stepIndex);
          // 更新按钮状态
          btn.disabled = true;
          btn.textContent = '已完成 ✓';
          btn.classList.remove('lwb-btn-primary');
          const stepEl = btn.closest('.lwb-step');
          if (stepEl) {
            stepEl.classList.add('completed');
            stepEl.classList.remove('current');
            stepEl.querySelector('.lwb-step-number').textContent = '✓';
          }
        });
      });

      modal.querySelectorAll('[data-action="go-step-app"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const app = btn.dataset.app;
          callbacks.onGoApp?.(app);
        });
      });
      
      // 点击遮罩关闭
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          callbacks.onClose?.();
          modal.remove();
        }
      });
      
      return modal;
    }

    /**
     * 渲染空状态
     */
    renderEmptyState() {
      const empty = document.createElement('div');
      empty.className = 'lwb-empty-state';
      empty.innerHTML = `
        <div class="lwb-empty-icon">📋</div>
        <div class="lwb-empty-text">暂无任务</div>
        <div style="font-size:12px;margin-top:8px;">任务会在剧情发展中自动生成</div>
      `;
      return empty;
    }

    /**
     * 渲染分区
     */
    _renderSection(title, quests, statusClass) {
      const section = document.createElement('div');
      section.className = 'lwb-section';
      
      const titleEl = document.createElement('div');
      titleEl.className = 'lwb-section-title';
      titleEl.textContent = title;
      section.appendChild(titleEl);
      
      quests.forEach(quest => {
        const card = this._renderQuestCard(quest, statusClass);
        section.appendChild(card);
      });
      
      return section;
    }

    /**
     * 渲染任务卡片
     */
    _renderQuestCard(quest, statusClass) {
      const card = document.createElement('div');
      card.className = `lwb-quest-card ${statusClass}`;

      const statusText = {
        active: '进行中',
        available: '可接取',
        completed: '已完成'
      }[statusClass] || statusClass;

      // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
      const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
      const safeQuestName = escapeHtml(quest.name);
      const safeQuestDesc = escapeHtml(quest.description || '暂无描述');
      const safeIssuerName = escapeHtml(quest.issuerName || '未知');

      card.innerHTML = `
        <div class="lwb-quest-header">
          <h4 class="lwb-quest-name">${safeQuestName}</h4>
          <span class="lwb-quest-status ${statusClass}">${statusText}</span>
        </div>
        <div class="lwb-quest-desc">${safeQuestDesc}</div>
        <div class="lwb-quest-meta">
          <div class="lwb-quest-issuer">
            <span>👤</span>
            <span>${safeIssuerName}</span>
          </div>
          <div class="lwb-quest-reward">
            <span>💰</span>
            <span>${quest.rewards?.gold || 0}</span>
          </div>
        </div>
      `;

      return card;
    }
  }

  // 挂载到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Quest = QuestRenderer;

  console.log('[Renderer] QuestRenderer (小白板风格) 已加载');
})();
