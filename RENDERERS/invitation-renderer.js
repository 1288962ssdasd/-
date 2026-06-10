/**
 * @layer Renderer
 * @file   invitation-renderer.js
 *
 * 职责: 邀约UI渲染 - 小白板风格设计
 * 禁止: 包含业务逻辑、调用Service
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class InvitationRenderer {
    constructor() {
      this._styles = null;
    }

    injectStyles() {
      if (this._styles) return;

      const style = document.createElement('style');
      style.textContent = `
        .inv-card {
          background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          border-left: 4px solid #f0ad4e;
          transition: all 0.2s ease;
        }
        .inv-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .inv-npc { font-size: 15px; font-weight: 600; color: #2c3e50; }
        .inv-type { font-size: 11px; padding: 3px 8px; border-radius: 10px; background: rgba(240,173,78,0.2); color: #d58512; font-weight: 500; }
        .inv-message { font-size: 13px; color: #5a6c7d; line-height: 1.5; margin-bottom: 12px; }
        .inv-actions { display: flex; gap: 8px; }
        .inv-btn {
          padding: 8px 16px; border-radius: 8px; border: none; font-size: 13px;
          font-weight: 500; cursor: pointer; transition: all 0.2s ease;
        }
        .inv-btn-accept { background: linear-gradient(90deg, #27ae60, #2ecc71); color: white; }
        .inv-btn-accept:hover { box-shadow: 0 2px 8px rgba(39,174,96,0.3); }
        .inv-btn-decline { background: #ecf0f1; color: #7f8c8d; }
        .inv-btn-decline:hover { background: #e0e4e8; }
        .inv-expiry { font-size: 11px; color: #95a5a6; margin-top: 8px; }
      `;
      document.head.appendChild(style);
      this._styles = style;
    }

    renderInvitationList(invitations, callbacks = {}) {
      this.injectStyles();
      const container = document.createElement('div');
      container.className = 'inv-container';

      if (!invitations || invitations.length === 0) {
        // [v4.3-fix] 返回有样式的空状态提示，而不是空 div
        container.innerHTML = '<div class="inv-empty" style="text-align:center;padding:40px 20px;color:#999;">暂无邀约</div>';
        return container;
      }

      invitations.forEach(inv => {
        const card = document.createElement('div');
        card.className = 'inv-card';

        const typeLabels = { social: '社交', quest: '任务', location: '地点', special: '特殊' };
        const typeLabel = typeLabels[inv.type] || inv.type;

        // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
        const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
        const safeNpcName = escapeHtml(inv.npcName || '未知');
        const safeMessage = escapeHtml(inv.message || '');
        const safeId = escapeHtml(inv.id);

        card.innerHTML = `
          <div class="inv-header">
            <span class="inv-npc">${safeNpcName}</span>
            <span class="inv-type">${typeLabel}</span>
          </div>
          <div class="inv-message">${safeMessage}</div>
          <div class="inv-actions">
            <button class="inv-btn inv-btn-accept" data-id="${safeId}">接受</button>
            <button class="inv-btn inv-btn-decline" data-id="${safeId}">拒绝</button>
          </div>
          ${inv.expiresAt ? `<div class="inv-expiry">${this._formatExpiry(inv.expiresAt)}</div>` : ''}
        `;

        card.querySelector('.inv-btn-accept').addEventListener('click', () => callbacks.onAccept?.(inv.id));
        card.querySelector('.inv-btn-decline').addEventListener('click', () => callbacks.onDecline?.(inv.id));

        container.appendChild(card);
      });

      return container;
    }

    renderInvitationDetail(invitation, callbacks = {}) {
      this.injectStyles();
      const modal = document.createElement('div');
      modal.className = 'lwb-modal-overlay';

      // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
      const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
      const safeNpcName = escapeHtml(invitation.npcName || '邀约详情');
      const safeMessage = escapeHtml(invitation.message || '');
      const safeLocation = escapeHtml(invitation.location);

      modal.innerHTML = `
        <div class="lwb-modal">
          <div class="lwb-modal-header">
            <h3 style="margin:0;font-size:18px;">${safeNpcName}</h3>
            <button class="lwb-modal-close">&times;</button>
          </div>
          <div class="lwb-modal-body">
            <p style="color:#5a6c7d;line-height:1.6;">${safeMessage}</p>
            ${invitation.location ? `<p style="margin-top:12px;font-size:13px;color:#7f8c8d;">地点: ${safeLocation}</p>` : ''}
            ${invitation.expiresAt ? `<p style="margin-top:8px;font-size:12px;color:#95a5a6;">${this._formatExpiry(invitation.expiresAt)}</p>` : ''}
          </div>
          <div class="lwb-modal-footer">
            <button class="lwb-btn lwb-btn-primary" data-action="accept">接受</button>
            <button class="lwb-btn lwb-btn-secondary" data-action="decline">拒绝</button>
            <button class="lwb-btn lwb-btn-secondary" data-action="close">关闭</button>
          </div>
        </div>
      `;

      modal.querySelector('.lwb-modal-close').onclick = () => { callbacks.onClose?.(); modal.remove(); };
      modal.querySelector('[data-action="close"]')?.addEventListener('click', () => { callbacks.onClose?.(); modal.remove(); });
      modal.querySelector('[data-action="accept"]')?.addEventListener('click', () => { callbacks.onAccept?.(); modal.remove(); });
      modal.querySelector('[data-action="decline"]')?.addEventListener('click', () => { callbacks.onDecline?.(); modal.remove(); });
      modal.addEventListener('click', (e) => { if (e.target === modal) { callbacks.onClose?.(); modal.remove(); } });

      return modal;
    }

    _formatExpiry(timestamp) {
      const diff = timestamp - Date.now();
      if (diff <= 0) return '已过期';
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return hours > 0 ? `${hours}小时${mins}分钟后过期` : `${mins}分钟后过期`;
    }
  }

  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Invitation = InvitationRenderer;

  console.log('[Renderer] InvitationRenderer 已加载');
})();
