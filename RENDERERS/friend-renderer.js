/**
 * @layer Renderer
 * @file   friend-renderer.js
 *
 * 职责: 好友 UI 渲染 - 微信风格好友列表、请求、添加表单
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 friend- 前缀
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

  class FriendRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

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

    // ==================== 主框架渲染 ====================

    renderShell() {
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

    // ==================== 好友列表 ====================

    renderFriendList(friends, grouped, letters) {
      const container = document.createDocumentFragment();

      if (!friends || friends.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'friend-empty';
        emptyEl.textContent = '暂无好友';
        container.appendChild(emptyEl);
        return container;
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
      return container;
    }

    // ==================== 好友请求列表 ====================

    renderRequests(requests) {
      const container = document.createDocumentFragment();

      if (!requests || requests.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'friend-empty';
        emptyEl.textContent = '暂无好友请求';
        container.appendChild(emptyEl);
        return container;
      }

      const listEl = document.createElement('div');
      listEl.className = 'friend-request-list';

      requests.forEach(request => {
        const item = document.createElement('div');
        item.className = 'friend-request-item';
        item.dataset.requestId = request.id;

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
      return container;
    }

    // ==================== 添加好友表单 ====================

    renderAddForm(cachedData) {
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
      idInput.value = cachedData?.id || '';
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
      nameInput.value = cachedData?.name || '';
      nameGroup.appendChild(nameLabel);
      nameGroup.appendChild(nameInput);

      const submitBtn = document.createElement('button');
      submitBtn.className = 'friend-btn-submit';
      submitBtn.dataset.action = 'add-friend';
      submitBtn.textContent = '发送请求';

      form.appendChild(idGroup);
      form.appendChild(nameGroup);
      form.appendChild(submitBtn);
      return form;
    }

    // ==================== 空状态 / 错误 ====================

    renderEmpty(message) {
      const el = document.createElement('div');
      el.className = 'friend-empty';
      el.textContent = message || '暂无好友';
      return el;
    }

    renderError(message) {
      const el = document.createElement('div');
      el.className = 'friend-empty';
      el.textContent = message || '加载失败';
      return el;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Friend = FriendRenderer;

  console.log('[Renderer] FriendRenderer 已加载');
})();
