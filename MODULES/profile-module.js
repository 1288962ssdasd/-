/**
 * ProfileModule - 个人资料模块
 * 职责：生命周期管理、事件绑定、调用 Service
 * 禁止：直接操作数据（必须通过 Service）
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Profile
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 模块注册通过 __phoneShell.registerModule（铁则五）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class ProfileModule extends PhoneApp {
    constructor() {
      super({
        id: 'profile',
        name: '档案',
        icon: '👤',
        iconBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      });

      this._service = null;
      this._currentView = 'LIST'; // LIST | DETAIL | ADD | NPCS
      this._currentProfileId = null;
      this._unsubscribers = [];
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Profile(window.Platform);
    }

    onResume(params) {
      setTimeout(() => this._refresh(), 50);
    }

    onPause() {}

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.textContent = `
        /* ===== profile-app: 微信个人资料风格 ===== */
        .profile-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
          color: #1c1c1e;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* ===== profile-header: 白色头部 ===== */
        .profile-header {
          background: #ffffff;
          padding: 12px 16px 10px;
          flex-shrink: 0;
          box-shadow: 0 0.5px 0 rgba(0,0,0,0.08);
        }
        .profile-header h3 {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.3px;
          margin: 0 0 10px;
          color: #000;
        }
        .profile-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .profile-actions button {
          flex: 1;
          min-width: 0;
          padding: 8px 6px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .profile-actions button[data-action="add"] {
          background: #07c160;
          color: #fff;
        }
        .profile-actions button[data-action="generate"] {
          background: #576b95;
          color: #fff;
        }
        .profile-actions button[data-action="sync"] {
          background: #fa9d3b;
          color: #fff;
        }
        .profile-actions button:active {
          opacity: 0.7;
        }

        /* ===== profile-views ===== */
        .profile-views {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .profile-view {
          padding: 0;
        }

        /* ===== profile-list: 卡片式列表 ===== */
        .profile-list {
          padding: 8px 12px;
        }

        /* ===== profile-item: 卡片式档案条目 ===== */
        .profile-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          background: #ffffff;
          border-radius: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: transform 0.12s;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }
        .profile-item:active {
          transform: scale(0.98);
        }

        /* ===== profile-item-avatar ===== */
        .profile-item-avatar {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          background-color: #e5e5ea;
          background-size: cover;
          background-position: center;
          flex-shrink: 0;
        }
        .profile-item-avatar:not([style*="url"]) {
          background: linear-gradient(135deg, #c8c8cc 0%, #aeaeb2 100%);
        }

        /* ===== profile-item-info ===== */
        .profile-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        /* ===== profile-item-name ===== */
        .profile-item-name {
          font-size: 16px;
          font-weight: 600;
          color: #000;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ===== profile-item-desc ===== */
        .profile-item-desc {
          font-size: 13px;
          color: #999;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ===== profile-item-tags: 标签 ===== */
        .profile-item-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .profile-item-tag {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
          background: #f0f0f0;
          color: #666;
        }

        /* ===== profile-item-source ===== */
        .profile-item-source {
          flex-shrink: 0;
          font-size: 16px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f5f5f5;
        }

        /* ===== profile-empty / profile-error ===== */
        .profile-empty,
        .profile-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          text-align: center;
          color: #999;
        }
        .profile-empty p:first-child,
        .profile-error p:first-child {
          font-size: 16px;
          font-weight: 600;
          color: #666;
          margin-bottom: 6px;
        }
        .profile-empty p:last-child,
        .profile-error p:last-child {
          font-size: 13px;
          color: #bbb;
          line-height: 1.5;
        }

        /* ===== profile-detail: 详情页 ===== */
        .profile-detail {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
        }

        /* ===== profile-detail-header ===== */
        .profile-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #ffffff;
          border-bottom: 0.5px solid #e5e5e5;
          flex-shrink: 0;
        }
        .profile-detail-header button {
          background: none;
          border: none;
          font-size: 15px;
          color: #576b95;
          font-weight: 400;
          cursor: pointer;
          padding: 6px 4px;
        }
        .profile-detail-header button:active {
          opacity: 0.5;
        }

        /* ===== profile-detail-content ===== */
        .profile-detail-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px 32px;
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ===== profile-detail-card: 个人信息卡片 ===== */
        .profile-detail-card {
          width: 100%;
          background: #ffffff;
          border-radius: 12px;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 12px;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }

        /* ===== profile-detail-avatar ===== */
        .profile-detail-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background-color: #e5e5ea;
          background-size: cover;
          background-position: center;
          margin-bottom: 12px;
        }

        /* ===== profile-detail-name ===== */
        .profile-detail-name {
          font-size: 20px;
          font-weight: 700;
          color: #000;
          margin: 0 0 8px;
          text-align: center;
        }

        /* ===== profile-detail-tags ===== */
        .profile-detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          margin-bottom: 4px;
        }
        .profile-tag {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          background: #f0f5ff;
          color: #576b95;
        }
        .profile-tag:nth-child(2n) {
          background: #e8f8ee;
          color: #07c160;
        }
        .profile-tag:nth-child(3n) {
          background: #fff4e5;
          color: #fa9d3b;
        }

        /* ===== profile-detail-description ===== */
        .profile-detail-description {
          width: 100%;
          background: #fff;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 12px;
          font-size: 15px;
          line-height: 1.6;
          color: #333;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }
        .profile-detail-description p {
          margin: 0 0 8px;
        }
        .profile-detail-description p:last-child {
          margin-bottom: 0;
        }
        .profile-no-desc {
          color: #bbb;
          font-style: italic;
        }

        /* ===== profile-detail-attributes ===== */
        .profile-detail-attributes {
          width: 100%;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }
        .profile-detail-attributes h4 {
          font-size: 13px;
          font-weight: 500;
          color: #999;
          text-transform: uppercase;
          padding: 20px 16px 6px;
          margin: 0;
        }

        /* ===== profile-attribute-item ===== */
        .profile-attribute-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 11px 16px;
          border-bottom: 0.5px solid #f0f0f0;
          min-height: 44px;
        }
        .profile-attribute-item:last-child {
          border-bottom: none;
        }
        .profile-attribute-key {
          font-size: 15px;
          color: #000;
          font-weight: 400;
        }
        .profile-attribute-value {
          font-size: 15px;
          color: #999;
          text-align: right;
          max-width: 60%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ===== profile-add: 添加页 ===== */
        .profile-add {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
        }

        /* ===== profile-add-header ===== */
        .profile-add-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: #ffffff;
          border-bottom: 0.5px solid #e5e5e5;
          flex-shrink: 0;
        }
        .profile-add-header button {
          background: none;
          border: none;
          font-size: 15px;
          color: #576b95;
          cursor: pointer;
          padding: 6px 4px;
        }
        .profile-add-header h3 {
          font-size: 17px;
          font-weight: 600;
          color: #000;
          margin: 0;
        }

        /* ===== profile-add-form: iOS风格表单 ===== */
        .profile-add-form {
          padding: 16px;
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ===== profile-form-item ===== */
        .profile-form-item {
          background: #fff;
          border-radius: 12px;
          margin-bottom: 10px;
          overflow: hidden;
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
        }
        .profile-form-item label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #999;
          padding: 10px 16px 4px;
        }
        .profile-form-item input,
        .profile-form-item textarea {
          display: block;
          width: 100%;
          border: none;
          outline: none;
          font-size: 16px;
          font-weight: 400;
          color: #000;
          padding: 6px 16px 14px;
          background: transparent;
          font-family: inherit;
          box-sizing: border-box;
          resize: none;
          line-height: 1.4;
        }
        .profile-form-item input::placeholder,
        .profile-form-item textarea::placeholder {
          color: #ccc;
        }

        /* ===== profile-add-form button[data-action="confirm-add"] ===== */
        .profile-add-form button[data-action="confirm-add"] {
          display: block;
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: #07c160;
          color: #fff;
          font-size: 17px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: opacity 0.15s;
        }
        .profile-add-form button[data-action="confirm-add"]:active {
          opacity: 0.7;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 渲染 ====================

    onRender() {
      this._injectStyles();
      return `
        <div class="profile-app">
          <div class="profile-header">
            <h3>人物档案</h3>
            <div class="profile-actions">
              <button data-action="add">+ 添加</button>
              <button data-action="generate">AI 生成</button>
              <button data-action="sync">同步世界书</button>
              <button data-action="show-npcs">世界NPC</button>
            </div>
          </div>
          <div class="profile-views">
            <div class="profile-view" data-view="LIST"></div>
            <div class="profile-view" data-view="DETAIL" style="display:none;"></div>
            <div class="profile-view" data-view="ADD" style="display:none;"></div>
            <div class="profile-view" data-view="NPCS" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 添加档案
          if (e.target.closest('[data-action="add"]')) {
            await this._showAddView();
            return;
          }

          // AI 生成档案
          if (e.target.closest('[data-action="generate"]')) {
            await this._handleGenerate();
            return;
          }

          // 同步世界书
          if (e.target.closest('[data-action="sync"]')) {
            await this._handleSync();
            return;
          }

          // [v4.1] 世界NPC列表
          if (e.target.closest('[data-action="show-npcs"]')) {
            await this._showNPCsView();
            return;
          }

          // 查看档案详情
          const profileItem = e.target.closest('[data-profile-id]');
          if (profileItem && !e.target.closest('[data-action]')) {
            await this._showProfileDetail(profileItem.dataset.profileId);
            return;
          }

          // 返回列表
          if (e.target.closest('[data-action="back"]')) {
            await this._showListView();
            return;
          }

          // 删除档案
          const deleteBtn = e.target.closest('[data-action="delete"]');
          if (deleteBtn) {
            await this._handleDelete(deleteBtn.dataset.profileId);
            return;
          }

          // 确认添加
          if (e.target.closest('[data-action="confirm-add"]')) {
            await this._handleConfirmAdd();
            return;
          }
        });

        this._subscribeData();
        this._renderList();
      }, 0);
    }

    // ==================== 视图渲染 ====================

    async _renderList() {
      const container = this._container?.querySelector('[data-view="LIST"]');
      if (!container) return;

      try {
        const profiles = await this._service.getProfiles();
        container.innerHTML = '';

        if (!profiles || profiles.length === 0) {
          container.innerHTML = `
            <div class="profile-empty">
              <p>暂无档案</p>
              <p>点击"添加"创建新档案，或"同步世界书"从世界书导入</p>
            </div>
          `;
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'profile-list';

        profiles.forEach(profile => {
          const itemEl = document.createElement('div');
          itemEl.className = 'profile-item';
          itemEl.dataset.profileId = profile.id;

          const safeAvatar = this._sanitizeAvatarUrl(profile.avatar);
          itemEl.innerHTML = `
            <div class="profile-item-avatar" ${safeAvatar ? `style="background-image: url('${safeAvatar}')"` : ''}></div>
            <div class="profile-item-info">
              <div class="profile-item-name">${this._escapeHtml(profile.name)}</div>
              <div class="profile-item-desc">${this._escapeHtml(profile.description?.substring(0, 50) || '暂无描述')}...</div>
              ${profile.tags?.length ? `
                <div class="profile-item-tags">
                  ${profile.tags.slice(0, 3).map(tag => `<span class="profile-item-tag">${this._escapeHtml(tag)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
            <div class="profile-item-source">${profile.source === 'worldbook' ? 'W' : profile.source === 'ai' ? 'A' : 'E'}</div>
          `;

          listEl.appendChild(itemEl);
        });

        container.appendChild(listEl);
      } catch (e) {
        console.warn('[ProfileModule] 渲染档案列表失败:', e);
        container.innerHTML = '<div class="profile-error">加载失败，请重试</div>';
      }
    }

    async _showProfileDetail(profileId) {
      const container = this._container?.querySelector('[data-view="DETAIL"]');
      if (!container) return;

      try {
        const profile = await this._service.getProfile(profileId);
        if (!profile) {
          container.innerHTML = '<div class="profile-error">档案不存在</div>';
          return;
        }

        this._currentProfileId = profileId;

        const safeAvatar = this._sanitizeAvatarUrl(profile.avatar);
        container.innerHTML = `
          <div class="profile-detail">
            <div class="profile-detail-header">
              <button data-action="back">&larr; 返回</button>
              <button data-action="delete" data-profile-id="${profile.id}">删除</button>
            </div>
            <div class="profile-detail-content">
              <div class="profile-detail-card">
                <div class="profile-detail-avatar" ${safeAvatar ? `style="background-image: url('${safeAvatar}')"` : ''}></div>
                <h3 class="profile-detail-name">${this._escapeHtml(profile.name)}</h3>
                ${profile.tags?.length ? `
                  <div class="profile-detail-tags">
                    ${profile.tags.map(tag => `<span class="profile-tag">${this._escapeHtml(tag)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
              <div class="profile-detail-description">
                ${this._formatDescription(profile.description)}
              </div>
              ${Object.keys(profile.attributes || {}).length ? `
                <div class="profile-detail-attributes">
                  <h4>属性</h4>
                  ${Object.entries(profile.attributes).map(([key, value]) => `
                    <div class="profile-attribute-item">
                      <span class="profile-attribute-key">${this._escapeHtml(key)}</span>
                      <span class="profile-attribute-value">${this._escapeHtml(value)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;

        this._showView('DETAIL');
      } catch (e) {
        console.warn('[ProfileModule] 渲染档案详情失败:', e);
        container.innerHTML = '<div class="profile-error">加载失败，请重试</div>';
      }
    }

    async _showAddView() {
      const container = this._container?.querySelector('[data-view="ADD"]');
      if (!container) return;

      container.innerHTML = `
        <div class="profile-add">
          <div class="profile-add-header">
            <button data-action="back">&larr; 返回</button>
            <h3>添加档案</h3>
          </div>
          <div class="profile-add-form">
            <div class="profile-form-item">
              <label>名称</label>
              <input type="text" data-ref="profile-name" placeholder="角色名称" />
            </div>
            <div class="profile-form-item">
              <label>头像URL（可选）</label>
              <input type="text" data-ref="profile-avatar" placeholder="头像图片URL" />
            </div>
            <div class="profile-form-item">
              <label>描述</label>
              <textarea data-ref="profile-description" placeholder="角色描述" rows="4"></textarea>
            </div>
            <div class="profile-form-item">
              <label>标签（逗号分隔）</label>
              <input type="text" data-ref="profile-tags" placeholder="标签1, 标签2" />
            </div>
            <button data-action="confirm-add">确认添加</button>
          </div>
        </div>
      `;

      this._showView('ADD');
    }

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      this._currentView = viewName;
    }

    async _showListView() {
      this._showView('LIST');
      await this._renderList();
    }

    // ==================== [v4.1] 世界NPC视图 ====================

    async _showNPCsView() {
      this._showView('NPCS');
      await this._renderNPCs();
    }

    async _renderNPCs() {
      var container = this._container?.querySelector('[data-view="NPCS"]');
      if (!container) return;

      try {
        // [铁则一] 通过 Platform.data() 获取 NPC 数据，禁止在 Module 层直接实例化 Schema/Service
        var npcs = null;
        try {
          npcs = await window.Platform?.data?.('npcSocial', 'allNPCs');
        } catch (e) {
          console.warn('[ProfileModule] 获取 NPC 数据失败:', e);
        }

        if (!npcs || npcs.length === 0) {
          container.innerHTML = '<div class="profile-empty"><p>暂无NPC数据</p><p>请先在设置中生成大世界</p></div>';
          return;
        }

        var html = '<div class="profile-detail">';
        html += '<div class="profile-detail-header">';
        html += '<button data-action="back">&larr; 返回</button>';
        html += '<span style="font-size:17px;font-weight:600;">世界NPC (' + npcs.length + ')</span>';
        html += '<div style="width:40px;"></div>';
        html += '</div>';
        html += '<div class="profile-detail-content" style="align-items:stretch;padding:12px;">';

        npcs.forEach(function(npc) {
          html += '<div class="profile-detail-card" style="align-items:flex-start;margin-bottom:10px;">';
          html += '<div style="display:flex;align-items:center;gap:10px;width:100%;">';
          html += '<div style="width:40px;height:40px;border-radius:50%;background:#E5E5EA;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + (npc.emoji || '👤') + '</div>';
          html += '<div style="flex:1;min-width:0;">';
          html += '<div style="font-size:16px;font-weight:600;color:#000;">' + (npc.name || '未知') + '</div>';
          html += '<div style="font-size:12px;color:#8E8E93;">' + (npc.role || npc.occupation || '') + '</div>';
          html += '</div>';
          if (npc.isContact) {
            html += '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:#E8F8EE;color:#07C160;">联系人</span>';
          }
          html += '</div>';
          if (npc.personality || npc.description) {
            html += '<div style="font-size:13px;color:#666;margin-top:8px;line-height:1.5;">' + (npc.personality || npc.description || '').substring(0, 100) + '</div>';
          }
          if (npc.relationship) {
            html += '<div style="font-size:12px;color:#FF9500;margin-top:4px;">关系: ' + npc.relationship + '</div>';
          }
          html += '</div>';
        });

        html += '</div></div>';
        container.innerHTML = html;
      } catch (e) {
        console.warn('[ProfileModule] 渲染NPC列表失败:', e);
        container.innerHTML = '<div class="profile-error">加载失败</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handleGenerate() {
      const name = await this.showPrompt({ message: '请输入角色名称:' });
      if (!name?.trim()) return;

      try {
        await this._service.generateProfile(name.trim());
        await this._renderList();
      } catch (err) {
        this.showToast('AI 生成失败: ' + err.message);
      }
    }

    async _handleSync() {
      try {
        const count = await this._service.loadFromWorldbook();
        this.showToast(`从世界书加载了 ${count} 个档案`);
        await this._renderList();
      } catch (err) {
        this.showToast('同步失败: ' + err.message);
      }
    }

    async _handleDelete(profileId) {
      const confirmed = await this.confirm('确定删除这个档案吗？');
      if (!confirmed) return;

      try {
        await this._service.deleteProfile(profileId);
        await this._showListView();
      } catch (err) {
        this.showToast('删除失败: ' + err.message);
      }
    }

    async _handleConfirmAdd() {
      const name = this._container?.querySelector('[data-ref="profile-name"]')?.value?.trim();
      if (!name) {
        this.showToast('请输入名称');
        return;
      }

      const avatar = this._container?.querySelector('[data-ref="profile-avatar"]')?.value?.trim() || '';
      const description = this._container?.querySelector('[data-ref="profile-description"]')?.value?.trim() || '';
      const tagsStr = this._container?.querySelector('[data-ref="profile-tags"]')?.value?.trim() || '';
      const tags = tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean);

      try {
        // TODO: 数据组装应迁移到 ProfileService（铁则十二）
        // 当前临时保留，后续由 Service 层提供 addProfileFromForm(formData) 方法
        await this._service.addProfile({
          name,
          avatar,
          description,
          tags,
        });
        await this._showListView();
      } catch (err) {
        this.showToast('添加失败: ' + err.message);
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsub = this._service.subscribeProfiles(() => {
          if (this._currentView === 'LIST') {
            this._renderList();
          }
        });
        if (unsub) this._unsubscribers.push(unsub);
      } catch (e) {
        console.warn('[ProfileModule] 订阅档案失败:', e);
      }
    }

    // ==================== 辅助方法 ====================

    async _refresh() {
      if (this._currentView === 'LIST') {
        await this._renderList();
      }
    }

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    _sanitizeAvatarUrl(url) {
      if (!url || typeof url !== 'string') return '';
      const trimmed = url.trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return '';
    }

    _formatDescription(text) {
      if (!text) return '<p class="profile-no-desc">暂无描述</p>';
      // 将换行转换为段落
      return text.split('\n').filter(p => p.trim()).map(p => `<p>${this._escapeHtml(p)}</p>`).join('');
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new ProfileModule();
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

  // 暴露到全局
  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Profile = ProfileModule;

  console.log('[Module] ProfileModule 已加载');
})();
