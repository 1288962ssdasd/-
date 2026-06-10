/**
 * @layer Renderer
 * @file   profile-renderer.js
 *
 * 职责: 个人资料 UI 渲染 - iOS 设置风格资料卡片、编辑表单
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 prof- 前缀
 */

;(function () {
  'use strict';

  class ProfileRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.textContent = `
        /* ===== prof-app: iOS 设置风格 ===== */
        .prof-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f2f2f7;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          color: #1C1C1E;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }
        .prof-app *, .prof-app *::before, .prof-app *::after { box-sizing: border-box; }

        /* ===== prof-header ===== */
        .prof-header {
          background: #f2f2f7;
          padding: 20px 16px 12px;
          flex-shrink: 0;
        }
        .prof-title {
          font-size: 28px;
          font-weight: 700;
          color: #000;
          letter-spacing: -0.3px;
          margin: 0;
        }

        /* ===== prof-views ===== */
        .prof-views {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0 16px 24px;
        }

        /* ===== prof-card: 白色圆角卡片 ===== */
        .prof-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
          box-shadow: 0 0.5px 2px rgba(0,0,0,0.04);
        }

        /* ===== prof-avatar-section ===== */
        .prof-avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px 12px 0 0;
        }
        .prof-avatar {
          width: 80px;
          height: 80px;
          border-radius: 40px;
          background: rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          border: 3px solid rgba(255,255,255,0.4);
          overflow: hidden;
        }
        .prof-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .prof-name {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin-top: 10px;
        }
        .prof-bio {
          font-size: 13px;
          color: rgba(255,255,255,0.8);
          margin-top: 4px;
          text-align: center;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ===== prof-row: key-value 行 ===== */
        .prof-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px 16px;
          border-bottom: 0.5px solid #f0f0f0;
        }
        .prof-row:last-child { border-bottom: none; }
        .prof-label {
          font-size: 15px;
          color: #1C1C1E;
          font-weight: 400;
        }
        .prof-value {
          font-size: 15px;
          color: #8E8E93;
          font-weight: 400;
          text-align: right;
          max-width: 50%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ===== prof-actions ===== */
        .prof-actions {
          display: flex;
          gap: 10px;
          padding: 16px;
          background: #fff;
          border-radius: 12px;
          margin-bottom: 16px;
          box-shadow: 0 0.5px 2px rgba(0,0,0,0.04);
        }

        /* ===== prof-btn ===== */
        .prof-btn {
          flex: 1;
          padding: 10px 0;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }
        .prof-btn:active {
          opacity: 0.7;
          transform: scale(0.97);
        }
        .prof-btn-primary {
          background: #667eea;
          color: #fff;
        }
        .prof-btn-secondary {
          background: #f2f2f7;
          color: #667eea;
        }
        .prof-btn-danger {
          background: #ff3b30;
          color: #fff;
        }

        /* ===== prof-edit: 编辑视图 ===== */
        .prof-edit {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .prof-edit-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .prof-edit-title {
          font-size: 17px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0;
        }
        .prof-edit-body {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 0.5px 2px rgba(0,0,0,0.04);
        }
        .prof-edit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 0.5px solid #f0f0f0;
        }
        .prof-edit-row:last-child { border-bottom: none; }
        .prof-edit-label {
          font-size: 15px;
          color: #1C1C1E;
          font-weight: 400;
          flex-shrink: 0;
          margin-right: 12px;
        }
        .prof-edit-input {
          width: 140px;
          background: #f8f8fa;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 15px;
          color: #1C1C1E;
          text-align: right;
          outline: none;
          transition: border-color 0.2s ease;
          -webkit-appearance: none;
        }
        .prof-edit-input:focus {
          border-color: #667eea;
          background: #fff;
        }
        .prof-edit-input::placeholder { color: #bbb; }
        .prof-edit-textarea {
          width: 100%;
          min-height: 80px;
          background: #f8f8fa;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 10px;
          font-size: 15px;
          color: #1C1C1E;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          font-family: inherit;
        }
        .prof-edit-textarea:focus {
          border-color: #667eea;
          background: #fff;
        }
        .prof-edit-textarea::placeholder { color: #bbb; }
        .prof-edit-textarea-row {
          padding: 12px 16px;
          border-bottom: 0.5px solid #f0f0f0;
        }
        .prof-edit-textarea-row:last-child { border-bottom: none; }
        .prof-edit-actions {
          padding: 4px 0;
        }

        /* ===== prof-empty / prof-error ===== */
        .prof-empty,
        .prof-error {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 48px 20px;
          font-size: 15px;
          color: #999;
        }
        .prof-error { color: #ff3b30; }
      `;
      document.head.appendChild(style);
    }

    // ==================== 辅助方法 ====================

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ==================== 主框架 ====================

    renderShell() {
      return `
        <div class="prof-app">
          <div class="prof-header">
            <h3 class="prof-title">个人资料</h3>
          </div>
          <div class="prof-views">
            <div class="prof-view" data-view="MAIN"></div>
            <div class="prof-view" data-view="EDIT" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    // ==================== 主视图 ====================

    renderProfile(profile) {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="prof-card">
          <div class="prof-avatar-section">
            <div class="prof-avatar">&#x1F9CD;</div>
            <div class="prof-name">${this._escapeHtml(profile?.name || '未设置')}</div>
            <div class="prof-bio">${this._escapeHtml(profile?.bio || profile?.description || '')}</div>
          </div>
          <div class="prof-row">
            <span class="prof-label">昵称</span>
            <span class="prof-value">${this._escapeHtml(profile?.name || '-')}</span>
          </div>
          <div class="prof-row">
            <span class="prof-label">性别</span>
            <span class="prof-value">${this._escapeHtml(profile?.gender || '-')}</span>
          </div>
          <div class="prof-row">
            <span class="prof-label">地区</span>
            <span class="prof-value">${this._escapeHtml(profile?.location || '-')}</span>
          </div>
          <div class="prof-row">
            <span class="prof-label">生日</span>
            <span class="prof-value">${this._escapeHtml(profile?.birthday || '-')}</span>
          </div>
          <div class="prof-row">
            <span class="prof-label">签名</span>
            <span class="prof-value">${this._escapeHtml(profile?.bio || '-')}</span>
          </div>
        </div>
        <div class="prof-actions">
          <button class="prof-btn prof-btn-primary" data-action="edit">编辑资料</button>
          <button class="prof-btn prof-btn-secondary" data-action="share">分享</button>
        </div>
      `;
      return container;
    }

    // ==================== 编辑视图 ====================

    renderEdit(profile) {
      const container = document.createElement('div');
      container.className = 'prof-edit';
      container.innerHTML = `
        <div class="prof-edit-header">
          <button class="prof-btn prof-btn-secondary" data-action="back" style="flex:0;padding:8px 14px;">&larr; 返回</button>
          <h4 class="prof-edit-title">编辑资料</h4>
        </div>
        <div class="prof-edit-body">
          <div class="prof-edit-row">
            <label class="prof-edit-label">昵称:</label>
            <input class="prof-edit-input" type="text" data-ref="prof-edit-name" value="${this._escapeHtml(profile?.name || '')}" placeholder="输入昵称" />
          </div>
          <div class="prof-edit-row">
            <label class="prof-edit-label">性别:</label>
            <input class="prof-edit-input" type="text" data-ref="prof-edit-gender" value="${this._escapeHtml(profile?.gender || '')}" placeholder="性别" />
          </div>
          <div class="prof-edit-row">
            <label class="prof-edit-label">地区:</label>
            <input class="prof-edit-input" type="text" data-ref="prof-edit-location" value="${this._escapeHtml(profile?.location || '')}" placeholder="地区" />
          </div>
          <div class="prof-edit-row">
            <label class="prof-edit-label">生日:</label>
            <input class="prof-edit-input" type="text" data-ref="prof-edit-birthday" value="${this._escapeHtml(profile?.birthday || '')}" placeholder="生日" />
          </div>
          <div class="prof-edit-textarea-row">
            <label class="prof-edit-label" style="display:block;margin-bottom:8px;">签名:</label>
            <textarea class="prof-edit-textarea" data-ref="prof-edit-bio" placeholder="个性签名">${this._escapeHtml(profile?.bio || '')}</textarea>
          </div>
        </div>
        <div class="prof-edit-actions">
          <button class="prof-btn prof-btn-primary prof-btn-save" data-action="save" style="width:100%;">保存</button>
        </div>
      `;
      return container;
    }

    // ==================== 空状态 / 错误 ====================

    renderEmpty(message) {
      const el = document.createElement('div');
      el.className = 'prof-empty';
      el.textContent = message || '暂无资料';
      return el;
    }

    renderError(message) {
      const el = document.createElement('div');
      el.className = 'prof-error';
      el.textContent = message || '加载失败，请重试';
      return el;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Profile = ProfileRenderer;

  console.log('[Renderer] ProfileRenderer 已加载');
})();
