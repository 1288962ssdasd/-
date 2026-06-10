/**
 * @layer Renderer
 * @file   status-renderer.js
 *
 * 职责: 状态 UI 渲染 - 游戏角色面板、NPC 列表/详情、编辑表单、穿搭、记忆
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 stat- 前缀
 */

;(function () {
  'use strict';

  class StatusRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.id = 'stat-module-styles';
      style.textContent = `
        /* ===== stat-app: Game Character Panel Style ===== */
        .stat-app {
          width: 100%;
          height: 100%;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
          color: #1C1C1E;
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .stat-app *, .stat-app *::before, .stat-app *::after {
          box-sizing: border-box;
        }

        /* ===== stat-header ===== */
        .stat-header {
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          padding: 12px 20px;
          flex-shrink: 0;
        }
        .stat-title {
          font-size: 18px;
          font-weight: 700;
          color: #FFFFFF;
          text-align: center;
          letter-spacing: 1px;
          margin: 0;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        /* ===== stat-views ===== */
        .stat-views {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 12px 14px 24px;
        }

        /* ===== stat-main ===== */
        .stat-main {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* ===== stat-user-card: Character status card ===== */
        .stat-user-card {
          background: #fff;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .stat-user-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .stat-user-avatar {
          width: 52px;
          height: 52px;
          border-radius: 26px;
          background: rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
          border: 2px solid rgba(255,255,255,0.4);
        }
        .stat-user-meta {
          flex: 1;
          min-width: 0;
        }
        .stat-user-name {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 2px;
        }
        .stat-user-level {
          font-size: 12px;
          color: rgba(255,255,255,0.8);
          font-weight: 500;
        }
        .stat-user-level-badge {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          padding: 1px 8px;
          border-radius: 8px;
          font-weight: 600;
        }

        /* ===== HP/MP Bars ===== */
        .stat-bars {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .stat-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .stat-bar-label {
          font-size: 12px;
          font-weight: 700;
          color: #555;
          width: 28px;
          flex-shrink: 0;
        }
        .stat-bar-track {
          flex: 1;
          height: 14px;
          background: #eee;
          border-radius: 7px;
          overflow: hidden;
          position: relative;
        }
        .stat-bar-fill {
          height: 100%;
          border-radius: 7px;
          transition: width 0.4s ease;
        }
        .stat-bar-fill.stat-bar-hp {
          background: linear-gradient(90deg, #e74c3c, #ff6b6b);
        }
        .stat-bar-fill.stat-bar-mp {
          background: linear-gradient(90deg, #3498db, #74b9ff);
        }
        .stat-bar-text {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          width: 70px;
          text-align: right;
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }

        /* ===== stat-stats-grid ===== */
        .stat-stats-grid {
          padding: 0 16px 14px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .stat-stat-item {
          text-align: center;
          background: #f8f8fa;
          border-radius: 10px;
          padding: 10px 4px;
        }
        .stat-stat-val {
          font-size: 18px;
          font-weight: 700;
          color: #2c3e50;
          line-height: 1.2;
        }
        .stat-stat-label {
          font-size: 11px;
          color: #888;
          font-weight: 500;
          margin-top: 2px;
        }

        /* ===== stat-user-actions ===== */
        .stat-user-actions {
          display: flex;
          gap: 8px;
          padding: 0 16px 14px;
        }

        /* ===== stat-btn ===== */
        .stat-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          outline: none;
          background: #667eea;
          color: #FFFFFF;
          flex: 1;
        }
        .stat-btn:active {
          opacity: 0.7;
          transform: scale(0.97);
        }

        /* ===== stat-section-title ===== */
        .stat-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0 0 10px;
          padding-left: 10px;
          border-left: 3px solid #667eea;
          line-height: 1.2;
        }

        /* ===== stat-npc-section ===== */
        .stat-npc-section {
          background: #fff;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        /* ===== stat-btn-add-npc ===== */
        .stat-btn-add-npc {
          background: rgba(102,126,234,0.1);
          color: #667eea;
          border: 1px dashed #667eea;
          margin-bottom: 12px;
          width: 100%;
        }

        /* ===== stat-npc-list ===== */
        .stat-npc-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* ===== stat-npc-item ===== */
        .stat-npc-item {
          background: #f8f8fa;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s ease;
          cursor: pointer;
        }
        .stat-npc-item:active {
          background: #eee;
        }
        .stat-npc-item-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .stat-npc-avatar {
          width: 36px;
          height: 36px;
          border-radius: 18px;
          background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .stat-npc-name {
          font-size: 14px;
          font-weight: 600;
          color: #1C1C1E;
        }
        .stat-npc-relationship {
          font-size: 12px;
          color: #888;
          font-weight: 500;
        }

        /* ===== NPC Detail ===== */
        .stat-npc-detail {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stat-npc-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stat-npc-detail-title {
          font-size: 17px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0;
        }
        .stat-npc-detail-body {
          background: #fff;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .stat-npc-detail-actions {
          display: flex;
          gap: 10px;
        }

        /* ===== stat-row ===== */
        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 0.5px solid #f0f0f0;
        }
        .stat-row:last-child {
          border-bottom: none;
        }
        .stat-label {
          font-size: 14px;
          color: #888;
          font-weight: 400;
        }
        .stat-value {
          font-size: 14px;
          color: #1C1C1E;
          font-weight: 600;
        }

        /* ===== Edit Views (iOS-style grouped form) ===== */
        .stat-edit-user,
        .stat-edit-npc {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stat-edit-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stat-edit-title {
          font-size: 17px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0;
        }
        .stat-edit-body {
          background: #fff;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .stat-edit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 0.5px solid #f0f0f0;
        }
        .stat-edit-row:last-child {
          border-bottom: none;
        }
        .stat-edit-label {
          font-size: 15px;
          color: #1C1C1E;
          font-weight: 400;
          flex-shrink: 0;
          margin-right: 12px;
        }
        .stat-edit-input {
          width: 120px;
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
        .stat-edit-input:focus {
          border-color: #667eea;
          background: #fff;
        }
        .stat-edit-input::placeholder {
          color: #bbb;
        }
        .stat-edit-actions {
          padding: 4px 0;
        }

        /* ===== stat-btn-save ===== */
        .stat-btn-save {
          background: #667eea;
          color: #FFFFFF;
          padding: 12px 32px;
          border-radius: 12px;
          font-size: 16px;
          width: 100%;
        }

        /* ===== stat-outfit ===== */
        .stat-outfit {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stat-outfit-body {
          background: #fff;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        /* ===== stat-memory ===== */
        .stat-memory {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stat-memory-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-memory-item {
          background: #fff;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: #555;
          line-height: 1.5;
          border-left: 3px solid #667eea;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }

        /* ===== stat-empty / stat-error ===== */
        .stat-empty,
        .stat-error {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 48px 20px;
          font-size: 15px;
          color: #999;
        }
        .stat-error {
          color: #e74c3c;
        }

        /* ===== Inline Modal ===== */
        .stat-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .stat-modal-box {
          background: #fff;
          border-radius: 14px;
          padding: 20px;
          width: 280px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        .stat-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0 0 12px;
        }
        .stat-modal-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 14px;
        }
        .stat-modal-input:focus {
          border-color: #667eea;
        }
        .stat-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .stat-modal-btn {
          padding: 8px 18px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .stat-modal-cancel {
          background: #eee;
          color: #555;
        }
        .stat-modal-confirm {
          background: #667eea;
          color: #fff;
        }
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

    // ==================== 主框架渲染 ====================

    renderShell() {
      return `
        <div class="stat-app">
          <div class="stat-header">
            <h3 class="stat-title">状态</h3>
          </div>
          <div class="stat-views">
            <div class="stat-view" data-view="MAIN"></div>
            <div class="stat-view" data-view="NPC_DETAIL" style="display:none;"></div>
            <div class="stat-view" data-view="EDIT_USER" style="display:none;"></div>
            <div class="stat-view" data-view="EDIT_NPC" style="display:none;"></div>
            <div class="stat-view" data-view="OUTFIT" style="display:none;"></div>
            <div class="stat-view" data-view="MEMORY" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    // ==================== 主视图 ====================

    renderMain(userStatus, npcs) {
      const hp = userStatus?.hp || 0;
      const maxHp = userStatus?.maxHp || 100;
      const mp = userStatus?.mp || 0;
      const maxMp = userStatus?.maxMp || 50;
      const hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
      const mpPercent = maxMp > 0 ? Math.round((mp / maxMp) * 100) : 0;

      const container = document.createElement('div');
      container.className = 'stat-main';
      container.innerHTML = `
        <div class="stat-user-card">
          <div class="stat-user-card-header">
            <div class="stat-user-avatar">&#x1F9CD;</div>
            <div class="stat-user-meta">
              <div class="stat-user-name">冒险者</div>
              <div class="stat-user-level">Lv.<span class="stat-user-level-badge">${userStatus?.level || 1}</span></div>
            </div>
          </div>
          <div class="stat-bars">
            <div class="stat-bar-row">
              <span class="stat-bar-label">HP</span>
              <div class="stat-bar-track">
                <div class="stat-bar-fill stat-bar-hp" style="width:${hpPercent}%"></div>
              </div>
              <span class="stat-bar-text">${hp}/${maxHp}</span>
            </div>
            <div class="stat-bar-row">
              <span class="stat-bar-label">MP</span>
              <div class="stat-bar-track">
                <div class="stat-bar-fill stat-bar-mp" style="width:${mpPercent}%"></div>
              </div>
              <span class="stat-bar-text">${mp}/${maxMp}</span>
            </div>
          </div>
          <div class="stat-stats-grid">
            <div class="stat-stat-item">
              <div class="stat-stat-val">${userStatus?.level || 1}</div>
              <div class="stat-stat-label">等级</div>
            </div>
            <div class="stat-stat-item">
              <div class="stat-stat-val">${userStatus?.gold || 0}</div>
              <div class="stat-stat-label">金币</div>
            </div>
            <div class="stat-stat-item">
              <div class="stat-stat-val">${npcs.length}</div>
              <div class="stat-stat-label">NPC</div>
            </div>
          </div>
          <div class="stat-user-actions">
            <button class="stat-btn" data-action="edit-user">编辑</button>
            <button class="stat-btn" data-action="show-outfit">穿搭</button>
            <button class="stat-btn" data-action="add-memory">记忆</button>
          </div>
        </div>
        <div class="stat-npc-section">
          <h4 class="stat-section-title">NPC (${npcs.length})</h4>
          <button class="stat-btn stat-btn-add-npc" data-action="add-npc">+ 添加NPC</button>
          <div class="stat-npc-list">
            ${npcs.map(npc => `
              <div class="stat-npc-item" data-npc-id="${this._escapeHtml(npc.id || npc.npcId)}">
                <div class="stat-npc-item-left">
                  <div class="stat-npc-avatar">&#x1F9D1;</div>
                  <div>
                    <div class="stat-npc-name">${this._escapeHtml(npc.name)}</div>
                    <div class="stat-npc-relationship">好感度: ${npc.relationship || 0}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      return container;
    }

    // ==================== NPC 详情视图 ====================

    renderNpcDetail(npcStatus) {
      const container = document.createElement('div');
      container.className = 'stat-npc-detail';
      container.innerHTML = `
        <div class="stat-npc-detail-header">
          <button class="stat-btn" data-action="back">&larr; 返回</button>
          <h4 class="stat-npc-detail-title">${this._escapeHtml(npcStatus?.name || 'NPC')}</h4>
        </div>
        <div class="stat-npc-detail-body">
          <div class="stat-row"><span class="stat-label">好感度:</span><span class="stat-value">${npcStatus?.relationship || 0}</span></div>
          <div class="stat-row"><span class="stat-label">状态:</span><span class="stat-value">${this._escapeHtml(npcStatus?.status || '正常')}</span></div>
        </div>
        <div class="stat-npc-detail-actions">
          <button class="stat-btn" data-action="edit-npc">编辑状态</button>
          <button class="stat-btn" data-action="add-npc-memory">添加记忆</button>
        </div>
      `;
      return container;
    }

    // ==================== 编辑用户状态视图 ====================

    renderEditUser(userStatus) {
      const container = document.createElement('div');
      container.className = 'stat-edit-user';
      container.innerHTML = `
        <div class="stat-edit-header">
          <button class="stat-btn" data-action="back">&larr; 返回</button>
          <h4 class="stat-edit-title">编辑用户状态</h4>
        </div>
        <div class="stat-edit-body">
          <div class="stat-edit-row">
            <label class="stat-edit-label">等级:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-level" value="${userStatus?.level || 1}" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">HP:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-hp" value="${userStatus?.hp || 0}" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">最大HP:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-maxhp" value="${userStatus?.maxHp || 100}" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">MP:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-mp" value="${userStatus?.mp || 0}" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">最大MP:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-maxmp" value="${userStatus?.maxMp || 50}" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">金币:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-gold" value="${userStatus?.gold || 0}" />
          </div>
        </div>
        <div class="stat-edit-actions">
          <button class="stat-btn stat-btn-save" data-action="save-user-status">保存</button>
        </div>
      `;
      return container;
    }

    // ==================== 编辑 NPC 状态视图 ====================

    renderEditNpc(npcStatus) {
      const container = document.createElement('div');
      container.className = 'stat-edit-npc';
      container.innerHTML = `
        <div class="stat-edit-header">
          <button class="stat-btn" data-action="back">&larr; 返回</button>
          <h4 class="stat-edit-title">编辑 ${this._escapeHtml(npcStatus?.name || 'NPC')} 状态</h4>
        </div>
        <div class="stat-edit-body">
          <div class="stat-edit-row">
            <label class="stat-edit-label">好感度:</label>
            <input class="stat-edit-input" type="number" data-ref="stat-edit-npc-rel" value="${npcStatus?.relationship || 0}" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">状态:</label>
            <input class="stat-edit-input" type="text" data-ref="stat-edit-npc-status" value="${this._escapeHtml(npcStatus?.status || '')}" />
          </div>
        </div>
        <div class="stat-edit-actions">
          <button class="stat-btn stat-btn-save" data-action="save-npc-status">保存</button>
        </div>
      `;
      return container;
    }

    // ==================== 穿搭视图 ====================

    renderOutfit() {
      const container = document.createElement('div');
      container.className = 'stat-outfit';
      container.innerHTML = `
        <div class="stat-edit-header">
          <button class="stat-btn" data-action="back">&larr; 返回</button>
          <h4 class="stat-edit-title">穿搭</h4>
        </div>
        <div class="stat-outfit-body">
          <div class="stat-edit-row">
            <label class="stat-edit-label">槽位:</label>
            <input class="stat-edit-input" type="text" data-ref="stat-outfit-slot" placeholder="如: head, body, weapon" />
          </div>
          <div class="stat-edit-row">
            <label class="stat-edit-label">物品:</label>
            <input class="stat-edit-input" type="text" data-ref="stat-outfit-item" placeholder="物品名称" />
          </div>
        </div>
        <div class="stat-edit-actions">
          <button class="stat-btn" data-action="update-outfit">更新穿搭</button>
        </div>
      `;
      return container;
    }

    // ==================== 记忆视图 ====================

    renderMemory(memories) {
      const container = document.createElement('div');
      container.className = 'stat-memory';
      container.innerHTML = `
        <div class="stat-edit-header">
          <button class="stat-btn" data-action="back">&larr; 返回</button>
          <h4 class="stat-edit-title">记忆</h4>
        </div>
        <div class="stat-memory-list">
          ${memories.length > 0
            ? memories.map(m => `<div class="stat-memory-item">${this._escapeHtml(typeof m === 'string' ? m : JSON.stringify(m))}</div>`).join('')
            : '<div class="stat-empty">暂无记忆</div>'
          }
        </div>
      `;
      return container;
    }

    // ==================== 输入弹窗 ====================

    renderInputModal(title, placeholder, defaultValue) {
      const overlay = document.createElement('div');
      overlay.className = 'stat-modal-overlay';
      overlay.innerHTML = `
        <div class="stat-modal-box">
          <div class="stat-modal-title">${this._escapeHtml(title)}</div>
          <input class="stat-modal-input" type="text" placeholder="${this._escapeHtml(placeholder)}" value="${this._escapeHtml(defaultValue || '')}" />
          <div class="stat-modal-actions">
            <button class="stat-modal-btn stat-modal-cancel">取消</button>
            <button class="stat-modal-btn stat-modal-confirm">确定</button>
          </div>
        </div>
      `;
      return overlay;
    }

    // ==================== 空状态 / 错误 ====================

    renderEmpty(message) {
      const el = document.createElement('div');
      el.className = 'stat-empty';
      el.textContent = message || '暂无数据';
      return el;
    }

    renderError(message) {
      const el = document.createElement('div');
      el.className = 'stat-error';
      el.textContent = message || '加载失败，请重试';
      return el;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Status = StatusRenderer;

  console.log('[Renderer] StatusRenderer 已加载');
})();
