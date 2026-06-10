/**
 * StatusModule - 状态模块
 * 职责：生命周期管理、事件绑定、调用 Service
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Status
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 stat- 前缀隔离（铁则十一）
 */

;(function () {
  'use strict';

  class StatusModule extends PhoneApp {
    constructor() {
      super({
        id: 'status',
        name: '状态',
        icon: '\uD83D\uDCCA',
        iconBg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      });
      this._service = null;
      this._unsubscribers = [];
      this._currentView = 'MAIN'; // MAIN | NPC_DETAIL | EDIT_USER | EDIT_NPC | OUTFIT | MEMORY
      this._currentNpcId = null;
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Status(window.Platform);
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 渲染 ====================

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (document.getElementById('stat-module-styles')) return;
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

    onRender() {
      this._injectStyles();
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

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 返回
          if (e.target.closest('[data-action="back"]')) {
            await this._showView('MAIN');
            return;
          }

          // 编辑用户状态
          if (e.target.closest('[data-action="edit-user"]')) {
            await this._showEditUserView();
            return;
          }

          // 穿搭
          if (e.target.closest('[data-action="show-outfit"]')) {
            await this._showOutfitView();
            return;
          }

          // 添加记忆
          if (e.target.closest('[data-action="add-memory"]')) {
            await this._handleAddMemory();
            return;
          }

          // 查看记忆
          if (e.target.closest('[data-action="show-memory"]')) {
            await this._showMemoryView();
            return;
          }

          // 添加 NPC
          if (e.target.closest('[data-action="add-npc"]')) {
            await this._handleAddNPC();
            return;
          }

          // 点击 NPC 查看详情
          const npcItem = e.target.closest('[data-npc-id]');
          if (npcItem && !e.target.closest('[data-action]')) {
            await this._showNpcDetail(npcItem.dataset.npcId);
            return;
          }

          // 编辑 NPC 状态
          if (e.target.closest('[data-action="edit-npc"]')) {
            await this._showEditNpcView();
            return;
          }

          // 添加 NPC 记忆
          if (e.target.closest('[data-action="add-npc-memory"]')) {
            await this._handleAddNpcMemory();
            return;
          }

          // 更新穿搭
          if (e.target.closest('[data-action="update-outfit"]')) {
            await this._handleUpdateOutfit();
            return;
          }

          // 保存用户状态
          if (e.target.closest('[data-action="save-user-status"]')) {
            await this._handleSaveUserStatus();
            return;
          }

          // 保存 NPC 状态
          if (e.target.closest('[data-action="save-npc-status"]')) {
            await this._handleSaveNpcStatus();
            return;
          }
        });

        this._subscribeData();
        this._renderMain();
      }, 0);
    }

    // ==================== 视图切换 ====================

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      this._currentView = viewName;
    }

    // ==================== 主视图 ====================

    async _renderMain() {
      const container = this._container?.querySelector('[data-view="MAIN"]');
      if (!container) return;

      try {
        const userStatus = await this._service.getUserStatus();
        const npcs = await this._service.getNPCList();
        const hp = userStatus?.hp || 0;
        const maxHp = userStatus?.maxHp || 100;
        const mp = userStatus?.mp || 0;
        const maxMp = userStatus?.maxMp || 50;
        const hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
        const mpPercent = maxMp > 0 ? Math.round((mp / maxMp) * 100) : 0;

        container.innerHTML = `
          <div class="stat-main">
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
          </div>
        `;
      } catch (e) {
        console.warn('[StatusModule] 渲染失败:', e);
        container.innerHTML = '<div class="stat-error">加载失败，请重试</div>';
      }
    }

    // ==================== NPC 详情视图 ====================

    async _showNpcDetail(npcId) {
      this._currentNpcId = npcId;
      this._showView('NPC_DETAIL');
      await this._renderNpcDetail();
    }

    async _renderNpcDetail() {
      const container = this._container?.querySelector('[data-view="NPC_DETAIL"]');
      if (!container || !this._currentNpcId) return;

      try {
        const npcStatus = await this._service.getNPCStatus(this._currentNpcId);

        container.innerHTML = `
          <div class="stat-npc-detail">
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
          </div>
        `;
      } catch (e) {
        console.warn('[StatusModule] 渲染NPC详情失败:', e);
        container.innerHTML = '<div class="stat-error">加载失败，请重试</div>';
      }
    }

    // ==================== 编辑用户状态视图 ====================

    async _showEditUserView() {
      this._showView('EDIT_USER');
      await this._renderEditUser();
    }

    async _renderEditUser() {
      const container = this._container?.querySelector('[data-view="EDIT_USER"]');
      if (!container) return;

      try {
        const userStatus = await this._service.getUserStatus();

        container.innerHTML = `
          <div class="stat-edit-user">
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
          </div>
        `;
      } catch (e) {
        console.warn('[StatusModule] 渲染编辑视图失败:', e);
        container.innerHTML = '<div class="stat-error">加载失败，请重试</div>';
      }
    }

    // ==================== 编辑 NPC 状态视图 ====================

    async _showEditNpcView() {
      this._showView('EDIT_NPC');
      await this._renderEditNpc();
    }

    async _renderEditNpc() {
      const container = this._container?.querySelector('[data-view="EDIT_NPC"]');
      if (!container || !this._currentNpcId) return;

      try {
        const npcStatus = await this._service.getNPCStatus(this._currentNpcId);

        container.innerHTML = `
          <div class="stat-edit-npc">
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
          </div>
        `;
      } catch (e) {
        console.warn('[StatusModule] 渲染编辑NPC视图失败:', e);
        container.innerHTML = '<div class="stat-error">加载失败，请重试</div>';
      }
    }

    // ==================== 穿搭视图 ====================

    async _showOutfitView() {
      this._showView('OUTFIT');
      await this._renderOutfit();
    }

    async _renderOutfit() {
      const container = this._container?.querySelector('[data-view="OUTFIT"]');
      if (!container) return;

      try {
        const userStatus = await this._service.getUserStatus();

        container.innerHTML = `
          <div class="stat-outfit">
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
          </div>
        `;
      } catch (e) {
        console.warn('[StatusModule] 渲染穿搭视图失败:', e);
        container.innerHTML = '<div class="stat-error">加载失败，请重试</div>';
      }
    }

    // ==================== 记忆视图 ====================

    async _showMemoryView() {
      this._showView('MEMORY');
      await this._renderMemory();
    }

    async _renderMemory() {
      const container = this._container?.querySelector('[data-view="MEMORY"]');
      if (!container) return;

      try {
        const userStatus = await this._service.getUserStatus();
        const memories = userStatus?.memories || [];

        container.innerHTML = `
          <div class="stat-memory">
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
          </div>
        `;
      } catch (e) {
        console.warn('[StatusModule] 渲染记忆视图失败:', e);
        container.innerHTML = '<div class="stat-error">加载失败，请重试</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handleSaveUserStatus() {
      try {
        const container = this._container?.querySelector('[data-view="EDIT_USER"]');
        const level = parseInt(container?.querySelector('[data-ref="stat-edit-level"]')?.value, 10) || 1;
        const hp = parseInt(container?.querySelector('[data-ref="stat-edit-hp"]')?.value, 10) || 0;
        const maxHp = parseInt(container?.querySelector('[data-ref="stat-edit-maxhp"]')?.value, 10) || 100;
        const mp = parseInt(container?.querySelector('[data-ref="stat-edit-mp"]')?.value, 10) || 0;
        const maxMp = parseInt(container?.querySelector('[data-ref="stat-edit-maxmp"]')?.value, 10) || 50;
        const gold = parseInt(container?.querySelector('[data-ref="stat-edit-gold"]')?.value, 10) || 0;

        const result = await this._service.updateUserStatus({ level, hp, maxHp, mp, maxMp, gold });
        if (result) {
          this.showToast('状态已更新', 'success');
          await this._showView('MAIN');
        } else {
          this.showToast('更新失败', 'error');
        }
      } catch (err) {
        console.error('[StatusModule] 保存用户状态失败:', err);
        this.showToast('保存失败: ' + err.message, 'error');
      }
    }

    async _handleSaveNpcStatus() {
      if (!this._currentNpcId) return;

      try {
        const container = this._container?.querySelector('[data-view="EDIT_NPC"]');
        const relationship = parseInt(container?.querySelector('[data-ref="stat-edit-npc-rel"]')?.value, 10) || 0;
        const status = container?.querySelector('[data-ref="stat-edit-npc-status"]')?.value || '';

        const result = await this._service.updateNPCStatus(this._currentNpcId, { relationship, status });
        if (result) {
          this.showToast('NPC状态已更新', 'success');
          await this._showView('MAIN');
        } else {
          this.showToast('更新失败', 'error');
        }
      } catch (err) {
        console.error('[StatusModule] 保存NPC状态失败:', err);
        this.showToast('保存失败: ' + err.message, 'error');
      }
    }

    async _handleAddMemory() {
      const memory = await this._showInputModal('添加记忆', '请输入记忆内容', '');
      if (!memory?.trim()) return;

      try {
        const result = await this._service.addMemory({ content: memory.trim() });
        if (result) {
          this.showToast('记忆已添加', 'success');
          await this._renderMain();
        } else {
          this.showToast('添加失败', 'error');
        }
      } catch (err) {
        console.error('[StatusModule] 添加记忆失败:', err);
        this.showToast('添加失败: ' + err.message, 'error');
      }
    }

    async _handleAddNPC() {
      const name = await this._showInputModal('添加NPC', '请输入NPC名称', '');
      if (!name?.trim()) return;

      try {
        const result = await this._service.addNPC({ name: name.trim() });
        if (result) {
          this.showToast('NPC已添加', 'success');
          await this._renderMain();
        } else {
          this.showToast('添加NPC失败', 'error');
        }
      } catch (err) {
        console.error('[StatusModule] 添加NPC失败:', err);
        this.showToast('添加NPC失败: ' + err.message, 'error');
      }
    }

    async _handleAddNpcMemory() {
      if (!this._currentNpcId) return;

      const memory = await this._showInputModal('NPC记忆', '请输入NPC记忆内容', '');
      if (!memory?.trim()) return;

      try {
        const result = await this._service.addNPCMemory(this._currentNpcId, { content: memory.trim() });
        if (result) {
          this.showToast('NPC记忆已添加', 'success');
          await this._renderNpcDetail();
        } else {
          this.showToast('添加失败', 'error');
        }
      } catch (err) {
        console.error('[StatusModule] 添加NPC记忆失败:', err);
        this.showToast('添加失败: ' + err.message, 'error');
      }
    }

    async _handleUpdateOutfit() {
      const container = this._container?.querySelector('[data-view="OUTFIT"]');
      const slot = container?.querySelector('[data-ref="stat-outfit-slot"]')?.value?.trim();
      const item = container?.querySelector('[data-ref="stat-outfit-item"]')?.value?.trim();
      if (!slot || !item) {
        this.showToast('请填写槽位和物品', 'warning');
        return;
      }

      try {
        const result = await this._service.updateOutfit(slot, { name: item });
        if (result) {
          this.showToast('穿搭已更新', 'success');
        } else {
          this.showToast('更新失败', 'error');
        }
      } catch (err) {
        console.error('[StatusModule] 更新穿搭失败:', err);
        this.showToast('更新失败: ' + err.message, 'error');
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsubUser = this._service.subscribeUserStatus(() => {
          if (this._currentView === 'MAIN') {
            this._renderMain();
          }
        });
        if (unsubUser) this._unsubscribers.push(unsubUser);
      } catch (e) {
        console.warn('[StatusModule] 订阅用户状态失败:', e);
      }

      try {
        const unsubNpc = this._service.subscribeNPCList(() => {
          if (this._currentView === 'MAIN') {
            this._renderMain();
          }
        });
        if (unsubNpc) this._unsubscribers.push(unsubNpc);
      } catch (e) {
        console.warn('[StatusModule] 订阅NPC列表失败:', e);
      }

      // 订阅 director:status 事件（断裂点2修复）
      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      try {
        const eventBus = window.Platform?.eventBus;
        if (eventBus) {
          const unsub = eventBus.on('director:status', async (payload) => {
            console.log('[StatusModule] 收到director:status事件', payload);
            try {
              if (this._currentView === 'MAIN') {
                await this._renderMain();
              } else if (this._currentView === 'NPC_DETAIL' && this._currentNpcId) {
                await this._renderNpcDetail();
              }
            } catch (e) {
              console.warn('[StatusModule] 处理director:status事件失败:', e);
            }
          });
          if (unsub) this._unsubscribers.push(unsub);
        }
      } catch (e) {
        console.warn('[StatusModule] 订阅director:status事件失败:', e);
      }
    }

    // ==================== 辅助方法 ====================

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    _showInputModal(title, placeholder, defaultValue) {
      return new Promise((resolve) => {
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
        document.body.appendChild(overlay);

        const input = overlay.querySelector('.stat-modal-input');
        const cancelBtn = overlay.querySelector('.stat-modal-cancel');
        const confirmBtn = overlay.querySelector('.stat-modal-confirm');

        const cleanup = (val) => {
          overlay.remove();
          resolve(val);
        };

        cancelBtn.addEventListener('click', () => cleanup(null));
        confirmBtn.addEventListener('click', () => cleanup(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') cleanup(input.value);
          if (e.key === 'Escape') cleanup(null);
        });
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cleanup(null);
        });

        setTimeout(() => input.focus(), 50);
      });
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new StatusModule();
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
  window.PhoneModules.Status = StatusModule;

  console.log('[Module] StatusModule 已加载');
})();
