/**
 * FriendModule - 好友管理模块
 * 职责：生命周期管理、事件绑定、调用渲染器
 * 禁止：直接操作数据（必须通过 FriendService）
 */

;(function () {
  'use strict';

  // ==================== SVG 图标 ====================

  const ICONS = {
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    newFriend: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#07C160" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
    groupChat: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#07C160" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    defaultAvatar: `<svg viewBox="0 0 42 42" width="42" height="42" fill="none"><rect width="42" height="42" rx="6" fill="#C9C9C9"/><circle cx="21" cy="16" r="6" fill="#A8A8A8"/><ellipse cx="21" cy="34" rx="11" ry="9" fill="#A8A8A8"/></svg>`,
  };

  // ==================== 样式注入 ====================

  let _stylesInjected = false;

  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* ========== 好友模块 - 全局容器 ========== */
      .friend-app {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
        background: #ededed;
        color: #181818;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        -webkit-font-smoothing: antialiased;
      }

      /* ========== 顶部搜索栏 ========== */
      .friend-search-bar {
        padding: 8px 12px;
        background: #ededed;
        flex-shrink: 0;
      }
      .friend-search-input-wrap {
        display: flex;
        align-items: center;
        background: #FFFFFF;
        border-radius: 8px;
        padding: 0 10px;
        height: 36px;
        gap: 6px;
      }
      .friend-search-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .friend-search-input {
        flex: 1;
        border: none;
        background: none;
        font-size: 15px;
        color: #181818;
        outline: none;
        height: 100%;
      }
      .friend-search-input::placeholder {
        color: #C7C7CC;
      }

      /* ========== 特殊入口（新的朋友/群聊） ========== */
      .friend-shortcuts {
        background: #FFFFFF;
        margin-top: 0;
      }
      .friend-shortcut-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        position: relative;
        cursor: pointer;
        -webkit-tap-highlight-color: rgba(0,0,0,0.05);
        transition: background 0.15s;
      }
      .friend-shortcut-item:active {
        background: #ECECEC;
      }
      .friend-shortcut-item:not(:last-child)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 68px;
        right: 0;
        height: 0.5px;
        background: #E5E5E5;
      }
      .friend-shortcut-icon {
        width: 42px;
        height: 42px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: 12px;
        background: #F0FFF4;
      }
      .friend-shortcut-info {
        flex: 1;
        min-width: 0;
      }
      .friend-shortcut-name {
        font-size: 16px;
        font-weight: 400;
        color: #181818;
        line-height: 1.3;
      }
      .friend-shortcut-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-left: 8px;
      }

      /* ========== 字母分组标题 ========== */
      .friend-section-title {
        padding: 6px 16px;
        font-size: 13px;
        font-weight: 500;
        color: #888888;
        background: #ededed;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      /* ========== 右侧字母索引 ========== */
      .friend-index-bar {
        position: absolute;
        right: 2px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 10;
        padding: 2px;
      }
      .friend-index-letter {
        font-size: 10px;
        color: #07C160;
        padding: 1px 4px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        line-height: 1.2;
        font-weight: 500;
      }
      .friend-index-letter:active {
        color: #181818;
        font-weight: 700;
      }

      /* ========== 视图容器 ========== */
      .friend-views {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        position: relative;
      }

      /* ========== 好友列表 ========== */
      .friend-list {
        background: #FFFFFF;
      }
      .friend-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        position: relative;
        cursor: pointer;
        -webkit-tap-highlight-color: rgba(0,0,0,0.05);
        transition: background 0.15s;
      }
      .friend-item:active {
        background: #ECECEC;
      }
      .friend-item:not(:last-child)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 72px;
        right: 0;
        height: 0.5px;
        background: #E5E5E5;
      }
      .friend-avatar {
        width: 42px;
        height: 42px;
        border-radius: 6px;
        background: #C9C9C9;
        color: #FFFFFF;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: 12px;
        overflow: hidden;
      }
      .friend-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
      }
      .friend-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .friend-name {
        font-size: 16px;
        font-weight: 400;
        color: #181818;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .friend-signature {
        font-size: 12px;
        color: #999999;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .friend-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-left: 8px;
        pointer-events: none;
      }

      /* ========== 空状态 ========== */
      .friend-empty {
        text-align: center;
        color: #999999;
        font-size: 14px;
        padding: 60px 20px;
      }

      /* ========== 好友请求 ========== */
      .friend-request-list {
        padding: 0;
      }
      .friend-request-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        background: #FFFFFF;
        border-bottom: 0.5px solid #E5E5E5;
        position: relative;
      }
      .friend-request-item:first-child {
        margin-top: 8px;
      }
      .friend-request-avatar {
        width: 44px;
        height: 44px;
        border-radius: 6px;
        flex-shrink: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #C9C9C9;
      }
      .friend-request-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
      }
      .friend-request-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-left: 12px;
      }
      .friend-request-name {
        font-size: 16px;
        font-weight: 500;
        color: #181818;
      }
      .friend-request-message {
        font-size: 13px;
        color: #888888;
        line-height: 1.4;
      }
      .friend-request-actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
        margin-left: 12px;
      }
      .friend-btn-accept {
        border: none;
        background: #07C160;
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 500;
        padding: 6px 16px;
        border-radius: 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: opacity 0.15s;
      }
      .friend-btn-accept:active {
        opacity: 0.8;
      }
      .friend-btn-reject {
        border: none;
        background: none;
        color: #888888;
        font-size: 13px;
        font-weight: 400;
        padding: 6px 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .friend-btn-reject:active {
        color: #555555;
      }

      /* ========== 添加好友表单 ========== */
      .friend-add-form {
        padding: 24px 16px;
        background: #FFFFFF;
        margin-top: 8px;
      }
      .friend-form-group {
        margin-bottom: 20px;
      }
      .friend-form-group label {
        display: block;
        font-size: 13px;
        color: #888888;
        margin-bottom: 6px;
        font-weight: 400;
      }
      .friend-form-group input {
        width: 100%;
        box-sizing: border-box;
        height: 42px;
        border: 0.5px solid #D6D6D6;
        border-radius: 8px;
        padding: 0 12px;
        font-size: 16px;
        color: #181818;
        background: #F7F7F7;
        outline: none;
        transition: border-color 0.2s, background 0.2s;
        -webkit-appearance: none;
      }
      .friend-form-group input:focus {
        border-color: #07C160;
        background: #FFFFFF;
      }
      .friend-form-group input::placeholder {
        color: #C7C7CC;
      }
      .friend-btn-submit {
        width: 100%;
        height: 46px;
        border: none;
        background: #07C160;
        color: #FFFFFF;
        font-size: 17px;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        margin-top: 8px;
        -webkit-tap-highlight-color: transparent;
        transition: opacity 0.15s;
      }
      .friend-btn-submit:active {
        opacity: 0.85;
      }
    `;
    document.head.appendChild(style);
  }

  // ==================== 模块类 ====================

  class FriendModule extends PhoneApp {
    constructor() {
      super({
        id: 'friend',
        name: '好友',
        icon: '👥',
      });

      this._service = null;
      this._currentView = 'LIST'; // LIST | REQUESTS | ADD
      this._unsubscribers = [];
      this._addFormData = { id: '', name: '' }; // 缓存表单数据
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Friend(window.Platform);
    }

    onResume(params) {
      setTimeout(() => {
        if (this._currentView === 'LIST') {
          this._renderFriendList();
        } else if (this._currentView === 'REQUESTS') {
          this._renderRequests();
        } else if (this._currentView === 'ADD') {
          this._restoreAddForm();
        }
      }, 50);
    }

    onPause() {
      // 切换离开前缓存表单数据
      this._cacheAddFormData();
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch (e) {} });
      this._unsubscribers = [];
    }

    // ==================== 渲染 ====================

    onRender() {
      _injectStyles();

      return `
        <div class="friend-app">
          <div class="friend-search-bar">
            <div class="friend-search-input-wrap">
              <span class="friend-search-icon">${ICONS.search}</span>
              <input class="friend-search-input" type="text" placeholder="搜索" data-ref="friend-search-input" />
            </div>
          </div>
          <div class="friend-views">
            <div class="friend-list-view" data-view="LIST"></div>
            <div class="friend-requests-view" data-view="REQUESTS" style="display:none;"></div>
            <div class="friend-add-view" data-view="ADD" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        // 点击事件委托
        this._container.addEventListener('click', async (e) => {
          // 特殊入口：新的朋友
          if (e.target.closest('[data-action="go-requests"]')) {
            this._switchView('REQUESTS');
            return;
          }

          // 特殊入口：群聊
          if (e.target.closest('[data-action="go-group"]')) {
            await this._handleCreateGroup();
            return;
          }

          // 好友请求：接受
          if (e.target.closest('[data-action="accept-request"]')) {
            const requestEl = e.target.closest('[data-request-id]');
            if (requestEl) {
              await this._handleRequest(requestEl.dataset.requestId, true);
            }
            return;
          }

          // 好友请求：拒绝
          if (e.target.closest('[data-action="reject-request"]')) {
            const requestEl = e.target.closest('[data-request-id]');
            if (requestEl) {
              await this._handleRequest(requestEl.dataset.requestId, false);
            }
            return;
          }

          // 添加好友：提交
          if (e.target.closest('[data-action="add-friend"]')) {
            await this._handleAddFriend();
            return;
          }
        });

        // 添加好友：回车提交
        this._container.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter' && e.target.matches('[data-ref="friend-id-input"], [data-ref="friend-name-input"]')) {
            await this._handleAddFriend();
          }
        });

        // 搜索过滤
        this._container.addEventListener('input', (e) => {
          if (e.target.matches('[data-ref="friend-search-input"]')) {
            this._filterFriendList(e.target.value.trim());
          }
        });

        // 订阅数据 + 初始渲染
        this._subscribeData();
        this._renderFriendList();
      }, 0);
    }

    // ==================== 视图切换 ====================

    _switchView(view) {
      // 离开当前视图前缓存表单数据
      this._cacheAddFormData();

      this._currentView = view;

      // 切换视图显示
      const views = this._container?.querySelectorAll('.friend-views > div');
      views?.forEach(v => {
        v.style.display = v.dataset.view === view ? 'block' : 'none';
      });

      // 渲染对应内容
      if (view === 'LIST') {
        this._renderFriendList();
      } else if (view === 'REQUESTS') {
        this._renderRequests();
      } else if (view === 'ADD') {
        this._renderAddForm();
      }
    }

    // ==================== 好友列表（只读） ====================

    async _renderFriendList() {
      const container = this._container?.querySelector('.friend-list-view');
      if (!container) return;

      try {
        const friends = await this._service.getList();
        container.innerHTML = '';

        if (!friends || friends.length === 0) {
          container.innerHTML = '<div class="friend-empty">暂无好友</div>';
          return;
        }

        // 特殊入口
        const shortcuts = document.createElement('div');
        shortcuts.className = 'friend-shortcuts';

        const newFriendItem = document.createElement('div');
        newFriendItem.className = 'friend-shortcut-item';
        newFriendItem.dataset.action = 'go-requests';
        newFriendItem.innerHTML = `
          <div class="friend-shortcut-icon">${ICONS.newFriend}</div>
          <div class="friend-shortcut-info"><div class="friend-shortcut-name">新的朋友</div></div>
          <div class="friend-shortcut-arrow">${ICONS.arrowRight}</div>
        `;
        shortcuts.appendChild(newFriendItem);

        const groupItem = document.createElement('div');
        groupItem.className = 'friend-shortcut-item';
        groupItem.dataset.action = 'go-group';
        groupItem.innerHTML = `
          <div class="friend-shortcut-icon">${ICONS.groupChat}</div>
          <div class="friend-shortcut-info"><div class="friend-shortcut-name">群聊</div></div>
          <div class="friend-shortcut-arrow">${ICONS.arrowRight}</div>
        `;
        shortcuts.appendChild(groupItem);
        container.appendChild(shortcuts);

        // 按首字母分组
        const grouped = this._groupByLetter(friends);
        const letters = Object.keys(grouped).sort();

        // 字母索引
        const indexBar = document.createElement('div');
        indexBar.className = 'friend-index-bar';
        letters.forEach(letter => {
          const letterEl = document.createElement('span');
          letterEl.className = 'friend-index-letter';
          letterEl.textContent = letter;
          letterEl.dataset.letter = letter;
          indexBar.appendChild(letterEl);
        });
        container.appendChild(indexBar);

        // 好友列表
        const listEl = document.createElement('div');
        listEl.className = 'friend-list';

        letters.forEach(letter => {
          const sectionTitle = document.createElement('div');
          sectionTitle.className = 'friend-section-title';
          sectionTitle.textContent = letter;
          sectionTitle.dataset.section = letter;
          listEl.appendChild(sectionTitle);

          grouped[letter].forEach(friend => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.dataset.friendId = friend.id;

            const avatar = document.createElement('div');
            avatar.className = 'friend-avatar';
            if (friend.avatar && friend.avatar !== friend.name?.charAt(0)) {
              avatar.innerHTML = `<img src="${friend.avatar}" alt="" />`;
            } else {
              avatar.textContent = friend.name ? friend.name.charAt(0) : '?';
            }

            const info = document.createElement('div');
            info.className = 'friend-info';

            const name = document.createElement('div');
            name.className = 'friend-name';
            name.textContent = friend.name || friend.id;

            const signature = document.createElement('div');
            signature.className = 'friend-signature';
            signature.textContent = friend.signature || '';

            info.appendChild(name);
            if (friend.signature) info.appendChild(signature);

            const arrow = document.createElement('span');
            arrow.className = 'friend-arrow';
            arrow.innerHTML = ICONS.arrowRight;

            item.appendChild(avatar);
            item.appendChild(info);
            item.appendChild(arrow);

            listEl.appendChild(item);
          });
        });

        container.appendChild(listEl);

        // 字母索引点击滚动
        indexBar.addEventListener('click', (e) => {
          const letterEl = e.target.closest('[data-letter]');
          if (!letterEl) return;
          const section = listEl.querySelector(`[data-section="${letterEl.dataset.letter}"]`);
          if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });

      } catch (err) {
        console.error('[FriendModule] 渲染好友列表失败:', err);
        container.innerHTML = '<div class="friend-empty">加载失败</div>';
      }
    }

    _filterFriendList(keyword) {
      const items = this._container?.querySelectorAll('.friend-item');
      if (!items) return;

      const kw = keyword.toLowerCase();
      items.forEach(item => {
        const name = item.querySelector('.friend-name')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(kw) ? 'flex' : 'none';
      });
    }

    _groupByLetter(friends) {
      const grouped = {};
      friends.forEach(friend => {
        const name = friend.name || friend.id || '';
        let letter = name.charAt(0).toUpperCase();
        // 非字母开头归入 # 组
        if (!/[A-Z]/.test(letter)) {
          letter = '#';
        }
        if (!grouped[letter]) grouped[letter] = [];
        grouped[letter].push(friend);
      });
      return grouped;
    }

    // ==================== 好友请求列表 ====================

    async _renderRequests() {
      const container = this._container?.querySelector('.friend-requests-view');
      if (!container) return;

      try {
        const requests = await this._service.getRequests();
        container.innerHTML = '';

        if (!requests || requests.length === 0) {
          container.innerHTML = '<div class="friend-empty">暂无好友请求</div>';
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'friend-request-list';

        requests.forEach(request => {
          const item = document.createElement('div');
          item.className = 'friend-request-item';
          item.dataset.requestId = request.id;

          // 使用 DOM 元素渲染头像，替代伪元素
          const avatar = document.createElement('div');
          avatar.className = 'friend-request-avatar';
          avatar.innerHTML = ICONS.defaultAvatar;

          const info = document.createElement('div');
          info.className = 'friend-request-info';

          const name = document.createElement('div');
          name.className = 'friend-request-name';
          name.textContent = request.name || request.id;

          const message = document.createElement('div');
          message.className = 'friend-request-message';
          message.textContent = request.message || '请求添加你为好友';

          info.appendChild(name);
          info.appendChild(message);

          const actions = document.createElement('div');
          actions.className = 'friend-request-actions';

          const acceptBtn = document.createElement('button');
          acceptBtn.className = 'friend-btn-accept';
          acceptBtn.dataset.action = 'accept-request';
          acceptBtn.textContent = '接受';

          const rejectBtn = document.createElement('button');
          rejectBtn.className = 'friend-btn-reject';
          rejectBtn.dataset.action = 'reject-request';
          rejectBtn.textContent = '拒绝';

          actions.appendChild(acceptBtn);
          actions.appendChild(rejectBtn);

          item.appendChild(avatar);
          item.appendChild(info);
          item.appendChild(actions);

          listEl.appendChild(item);
        });

        container.appendChild(listEl);
      } catch (err) {
        console.error('[FriendModule] 渲染好友请求失败:', err);
        container.innerHTML = '<div class="friend-empty">加载失败</div>';
      }
    }

    // ==================== 添加好友 ====================

    _cacheAddFormData() {
      const idInput = this._container?.querySelector('[data-ref="friend-id-input"]');
      const nameInput = this._container?.querySelector('[data-ref="friend-name-input"]');
      if (idInput) this._addFormData.id = idInput.value;
      if (nameInput) this._addFormData.name = nameInput.value;
    }

    _restoreAddForm() {
      const idInput = this._container?.querySelector('[data-ref="friend-id-input"]');
      const nameInput = this._container?.querySelector('[data-ref="friend-name-input"]');
      if (idInput) idInput.value = this._addFormData.id;
      if (nameInput) nameInput.value = this._addFormData.name;
    }

    _renderAddForm() {
      const container = this._container?.querySelector('.friend-add-view');
      if (!container) return;

      // 仅在表单尚未创建时才重建 DOM
      if (container.querySelector('.friend-add-form')) {
        this._restoreAddForm();
        return;
      }

      container.innerHTML = '';

      const form = document.createElement('div');
      form.className = 'friend-add-form';

      const idGroup = document.createElement('div');
      idGroup.className = 'friend-form-group';
      const idLabel = document.createElement('label');
      idLabel.textContent = '好友 ID';
      const idInput = document.createElement('input');
      idInput.type = 'text';
      idInput.dataset.ref = 'friend-id-input';
      idInput.placeholder = '请输入好友ID';
      idInput.value = this._addFormData.id;
      idGroup.appendChild(idLabel);
      idGroup.appendChild(idInput);

      const nameGroup = document.createElement('div');
      nameGroup.className = 'friend-form-group';
      const nameLabel = document.createElement('label');
      nameLabel.textContent = '好友名称';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.dataset.ref = 'friend-name-input';
      nameInput.placeholder = '请输入好友名称';
      nameInput.value = this._addFormData.name;
      nameGroup.appendChild(nameLabel);
      nameGroup.appendChild(nameInput);

      const submitBtn = document.createElement('button');
      submitBtn.className = 'friend-btn-submit';
      submitBtn.dataset.action = 'add-friend';
      submitBtn.textContent = '发送请求';

      form.appendChild(idGroup);
      form.appendChild(nameGroup);
      form.appendChild(submitBtn);
      container.appendChild(form);
    }

    // ==================== 业务处理 ====================

    async _handleRequest(requestId, accept) {
      try {
        await this._service.handleRequest(requestId, accept);
        // 处理完成后刷新请求列表
        this._renderRequests();
      } catch (err) {
        this.showToast((accept ? '接受' : '拒绝') + '好友请求失败: ' + err.message);
      }
    }

    async _handleAddFriend() {
      const idInput = this._container?.querySelector('[data-ref="friend-id-input"]');
      const nameInput = this._container?.querySelector('[data-ref="friend-name-input"]');

      const friendId = idInput?.value?.trim();
      const friendName = nameInput?.value?.trim();

      if (!friendId || !friendName) {
        this.showToast('请输入好友ID和名称');
        return;
      }

      try {
        await this._service.sendRequest({ id: friendId, name: friendName });
        this.showToast('好友请求已发送');
        // 清空表单并重置缓存
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        this._addFormData = { id: '', name: '' };
      } catch (err) {
        this.showToast('发送好友请求失败: ' + err.message);
      }
    }

    // ==================== 群聊功能 ====================

    async _handleCreateGroup() {
      try {
        const friends = await this._service.getList();
        
        if (!friends || friends.length === 0) {
          this.showToast('请先添加好友再创建群聊', 'info');
          return;
        }

        // 使用 PhoneDialog 的输入功能
        const groupName = await window.PhoneDialog?.showPrompt({
          title: '创建群聊',
          message: '请输入群聊名称',
          placeholder: '群聊名称'
        });

        if (!groupName?.trim()) {
          return;
        }

        // [v4.31.0-fix] 铁则十：通过 Service 层创建群聊，不在 Module 层拼装数据对象
        // TODO: 数据选取应迁移到 FriendService（铁则十二）
        // 当前临时保留，后续由 Service 层提供 createGroupWithDefaultMembers(groupName) 方法
        const memberIds = friends.slice(0, 5).map(f => f.id); // 默认添加前5个好友
        const result = await this._service.createGroup(groupName.trim(), memberIds);
        
        if (result) {
          this.showToast('群聊创建成功', 'success');
          this._renderFriendList();
        } else {
          this.showToast('群聊创建失败', 'error');
        }
      } catch (err) {
        console.error('[FriendModule] 创建群聊失败:', err);
        this.showToast('创建群聊失败: ' + err.message, 'error');
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      // 订阅好友列表变更
      try {
        const unsubList = this._service.subscribeList(() => {
          if (this._currentView === 'LIST') {
            this._renderFriendList();
          }
        });
        if (unsubList) this._unsubscribers.push(unsubList);
      } catch (e) {
        console.warn('[FriendModule] 订阅好友列表失败:', e);
      }

      // 订阅好友请求变更
      try {
        const unsubRequests = this._service.subscribeRequests(() => {
          if (this._currentView === 'REQUESTS') {
            this._renderRequests();
          }
        });
        if (unsubRequests) this._unsubscribers.push(unsubRequests);
      } catch (e) {
        console.warn('[FriendModule] 订阅好友请求失败:', e);
      }

      // 订阅 director:friend 事件（断裂点2修复）
      try {
        const eventBus = window.Platform?.eventBus;
        if (eventBus) {
          eventBus.on('director:friend', async (payload) => {
            console.log('[FriendModule] 收到director:friend事件', payload);
            try {
              if (this._currentView === 'LIST') {
                await this._renderFriendList();
              } else if (this._currentView === 'REQUESTS') {
                await this._renderRequests();
              }
            } catch (e) {
              console.warn('[FriendModule] 处理director:friend事件失败:', e);
            }
          });
        }
      } catch (e) {
        console.warn('[FriendModule] 订阅director:friend事件失败:', e);
      }
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new FriendModule();
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
  window.PhoneModules.Friend = FriendModule;

  console.log('[Module] FriendModule 已加载');
})();
