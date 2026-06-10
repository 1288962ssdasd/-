/**
 * WeiboModule - 微博模块
 * 职责：生命周期管理、事件绑定、调用渲染器
 */

;(function () {
  'use strict';

  // ==================== SVG 图标 ====================

  const ICONS = {
    home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    hot: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 3-4 3-7 .5 2 1.5 3 3 3s2.5-1 3-3z"/><path d="M12 22v-7"/><path d="M8 18h8"/></svg>`,
    message: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    homeActive: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    hotActive: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 0 1-8 0c0-2.5 3-4 3-7 .5 2 1.5 3 3 3s2.5-1 3-3z"/><path d="M12 22v-7"/><path d="M8 18h8"/></svg>`,
    messageActive: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    profileActive: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    repost: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    like: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    likeActive: `<svg viewBox="0 0 24 24" width="16" height="16" fill="#E6162D" stroke="#E6162D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    defaultAvatar: `<svg viewBox="0 0 36 36" width="36" height="36" fill="none"><circle cx="18" cy="18" r="18" fill="#E0E0E0"/><circle cx="18" cy="14" r="5" fill="#BDBDBD"/><ellipse cx="18" cy="28" rx="9" ry="7" fill="#BDBDBD"/></svg>`,
    defaultAvatarLarge: `<svg viewBox="0 0 60 60" width="60" height="60" fill="none"><circle cx="30" cy="30" r="30" fill="#E0E0E0"/><circle cx="30" cy="23" r="8" fill="#BDBDBD"/><ellipse cx="30" cy="46" rx="14" ry="11" fill="#BDBDBD"/></svg>`,
  };

  // ==================== 样式注入 ====================

  let _stylesInjected = false;

  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      /* ========== 微博模块 - 全局容器 ========== */
      .weibo-app {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
        background: #f3f3f3;
        color: #222222;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        -webkit-font-smoothing: antialiased;
      }

      /* ========== 顶部导航栏 ========== */
      .weibo-navbar {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 44px;
        background: #FFFFFF;
        border-bottom: 0.5px solid #E0E0E0;
        flex-shrink: 0;
        position: relative;
      }
      .weibo-navbar-title {
        font-size: 17px;
        font-weight: 600;
        color: #222222;
      }
      .weibo-navbar-btn {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 32px;
        height: 32px;
        border: none;
        background: #FF8200;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: opacity 0.15s;
      }
      .weibo-navbar-btn:active {
        opacity: 0.8;
      }

      /* ========== 视图容器 ========== */
      .weibo-views {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* ========== 底部 Tab 栏 ========== */
      .weibo-tabbar {
        display: flex;
        background: #FFFFFF;
        border-top: 0.5px solid #E0E0E0;
        padding-bottom: env(safe-area-inset-bottom, 0);
        flex-shrink: 0;
      }
      .weibo-tabbar button {
        flex: 1;
        border: none;
        background: none;
        font-size: 10px;
        color: #999999;
        padding: 4px 0 6px;
        text-align: center;
        cursor: pointer;
        position: relative;
        -webkit-tap-highlight-color: transparent;
        transition: color 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
      }
      .weibo-tabbar button .weibo-tab-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        margin-bottom: 1px;
        transition: color 0.2s;
      }
      .weibo-tabbar button.weibo-active {
        color: #FF8200;
        font-weight: 600;
      }

      /* ========== 首页操作栏 ========== */
      .weibo-actions {
        display: flex;
        gap: 10px;
        padding: 12px 16px;
        background: #FFFFFF;
        border-bottom: 0.5px solid #E5E5E5;
      }
      .weibo-actions button {
        flex: 1;
        height: 36px;
        border: none;
        border-radius: 18px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: opacity 0.15s;
      }
      .weibo-actions button:first-child {
        background: #FF8200;
        color: #FFFFFF;
      }
      .weibo-actions button:first-child:active {
        opacity: 0.85;
      }
      .weibo-actions button:nth-child(2) {
        background: #FFF3E0;
        color: #FF8200;
        border: 0.5px solid #FFCC80;
      }
      .weibo-actions button:nth-child(2):active {
        background: #FFE0B2;
      }

      /* ========== 微博帖子卡片 ========== */
      .weibo-list {
        padding: 0;
      }
      .weibo-post {
        background: #FFFFFF;
        padding: 14px 16px;
        border-bottom: 8px solid #f3f3f3;
        border-radius: 0;
      }
      .weibo-post-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .weibo-post-avatar {
        width: 36px;
        height: 36px;
        border-radius: 18px;
        flex-shrink: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #E0E0E0;
      }
      .weibo-post-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 18px;
      }
      .weibo-post-meta {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .weibo-author {
        font-size: 15px;
        font-weight: 600;
        color: #333333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .weibo-time {
        font-size: 12px;
        color: #B0B0B0;
      }
      .weibo-post-content {
        font-size: 15px;
        line-height: 1.6;
        color: #333333;
        margin-bottom: 12px;
        word-break: break-word;
      }
      .weibo-post-images {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        margin-bottom: 12px;
        border-radius: 8px;
        overflow: hidden;
      }
      .weibo-post-images.weibo-single-img {
        grid-template-columns: 1fr;
        max-width: 200px;
      }
      .weibo-post-image-item {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        background: #F0F0F0;
        display: block;
      }
      .weibo-post-actions {
        display: flex;
        border-top: 0.5px solid #F0F0F0;
        padding-top: 10px;
        gap: 0;
      }
      .weibo-post-actions button {
        flex: 1;
        border: none;
        background: none;
        font-size: 13px;
        color: #888888;
        padding: 4px 0;
        cursor: pointer;
        text-align: center;
        -webkit-tap-highlight-color: transparent;
        transition: color 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .weibo-post-actions button:active {
        color: #FF8200;
      }
      .weibo-post-actions button.weibo-liked {
        color: #E6162D;
      }
      .weibo-action-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      /* ========== 空状态 ========== */
      .weibo-empty {
        text-align: center;
        color: #999999;
        font-size: 14px;
        padding: 60px 20px;
      }

      /* ========== 热搜榜 ========== */
      .weibo-hot-header {
        padding: 14px 16px 8px;
        font-size: 17px;
        font-weight: 600;
        color: #222222;
        background: #FFFFFF;
      }
      .weibo-hot-list {
        background: #FFFFFF;
      }
      .weibo-hot-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 0.5px solid #F0F0F0;
        gap: 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: rgba(0,0,0,0.05);
        transition: background 0.15s;
      }
      .weibo-hot-item:active {
        background: #F5F5F5;
      }
      .weibo-rank {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: #999999;
        flex-shrink: 0;
      }
      .weibo-hot-item:nth-child(1) .weibo-rank {
        background: #FF4500;
        color: #FFFFFF;
        border-radius: 6px;
      }
      .weibo-hot-item:nth-child(2) .weibo-rank {
        background: #FF6A00;
        color: #FFFFFF;
        border-radius: 6px;
      }
      .weibo-hot-item:nth-child(3) .weibo-rank {
        background: #FF8C00;
        color: #FFFFFF;
        border-radius: 6px;
      }
      .weibo-title {
        flex: 1;
        font-size: 15px;
        color: #333333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 400;
      }
      .weibo-heat {
        font-size: 12px;
        color: #B0B0B0;
        flex-shrink: 0;
      }

      /* ========== 个人资料页 ========== */
      .weibo-profile-header {
        background: #FFFFFF;
        padding: 20px 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        border-bottom: 0.5px solid #E5E5E5;
      }
      .weibo-profile-avatar {
        width: 60px;
        height: 60px;
        border-radius: 30px;
        flex-shrink: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #E0E0E0;
      }
      .weibo-profile-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 30px;
      }
      .weibo-profile-name {
        font-size: 18px;
        font-weight: 600;
        color: #222222;
      }
      .weibo-profile-bio {
        font-size: 13px;
        color: #999999;
        margin-top: 4px;
      }
      .weibo-profile-stats {
        display: flex;
        background: #FFFFFF;
        padding: 16px 16px;
        border-bottom: 0.5px solid #E5E5E5;
      }
      .weibo-stat {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .weibo-number {
        font-size: 20px;
        font-weight: 700;
        color: #222222;
      }
      .weibo-label {
        font-size: 12px;
        color: #999999;
      }
      .weibo-my-list {
        margin-top: 0;
      }
    `;
    document.head.appendChild(style);
  }

  // ==================== 模块类 ====================

  class WeiboModule extends PhoneApp {
    constructor() {
      super({
        id: 'weibo',
        name: '微博',
        icon: '📱',
        iconBg: '#E6162D',
      });

      this._service = null;
      this._currentView = 'HOME'; // HOME | HOT | MESSAGE | PROFILE
      this._unsubscribers = [];
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      // Service 层需要 Platform 实例来访问数据
      this._service = new window.PhoneServices.Weibo(window.Platform);
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 渲染 ====================

    onRender() {
      _injectStyles();

      return `
        <div class="weibo-app">
          <div class="weibo-navbar">
            <span class="weibo-navbar-title">微博</span>
            <button class="weibo-navbar-btn" data-action="publish">
              ${ICONS.plus}
            </button>
          </div>
          <div class="weibo-views">
            <div class="weibo-home-view" data-view="HOME"></div>
            <div class="weibo-hot-view" data-view="HOT" style="display:none;"></div>
            <div class="weibo-message-view" data-view="MESSAGE" style="display:none;"></div>
            <div class="weibo-profile-view" data-view="PROFILE" style="display:none;"></div>
          </div>
          <div class="weibo-tabbar">
            <button data-tab="HOME" class="weibo-active">
              <span class="weibo-tab-icon">${ICONS.home}</span>
              <span>首页</span>
            </button>
            <button data-tab="HOT">
              <span class="weibo-tab-icon">${ICONS.hot}</span>
              <span>热门</span>
            </button>
            <button data-tab="MESSAGE">
              <span class="weibo-tab-icon">${ICONS.message}</span>
              <span>消息</span>
            </button>
            <button data-tab="PROFILE">
              <span class="weibo-tab-icon">${ICONS.profile}</span>
              <span>我的</span>
            </button>
          </div>
        </div>
      `;
    }

    // 基类 render() 后调用 _bindEvents()
    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          const tabBtn = e.target.closest('[data-tab]');
          if (tabBtn) {
            await this._switchTab(tabBtn.dataset.tab);
            return;
          }
          if (e.target.closest('[data-action="publish"]')) {
            await this._handlePublish();
            return;
          }
          if (e.target.closest('[data-action="ai-publish"]')) {
            await this._handleAIPublish();
            return;
          }
          const likeBtn = e.target.closest('[data-action="like"]');
          if (likeBtn) {
            await this._handleLike(likeBtn.dataset.postId);
            return;
          }
          const commentBtn = e.target.closest('[data-action="comment"]');
          if (commentBtn) {
            await this._handleComment(commentBtn.dataset.postId);
            return;
          }
          const repostBtn = e.target.closest('[data-action="repost"]');
          if (repostBtn) {
            await this._handleRepost(repostBtn.dataset.postId);
            return;
          }
          const deleteBtn = e.target.closest('[data-action="delete"]');
          if (deleteBtn) {
            await this._handleDelete(deleteBtn.dataset.postId);
            return;
          }
        });

        // DOM 就绪后：订阅数据 + 初始渲染
        this._subscribeData();
        this._renderHome();
      }, 0);
    }

    // ==================== 视图切换 ====================

    async _switchTab(tab) {
      this._currentView = tab;

      // 更新 Tab 高亮和图标
      this._container.querySelectorAll('[data-tab]').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('weibo-active', isActive);

        const iconEl = btn.querySelector('.weibo-tab-icon');
        if (iconEl) {
          const iconMap = {
            HOME: isActive ? ICONS.homeActive : ICONS.home,
            HOT: isActive ? ICONS.hotActive : ICONS.hot,
            MESSAGE: isActive ? ICONS.messageActive : ICONS.message,
            PROFILE: isActive ? ICONS.profileActive : ICONS.profile,
          };
          iconEl.innerHTML = iconMap[btn.dataset.tab] || ICONS.home;
        }
      });

      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === tab ? 'block' : 'none';
      });

      switch (tab) {
        case 'HOME': await this._renderHome(); break;
        case 'HOT': await this._renderHot(); break;
        case 'MESSAGE': await this._renderMessage(); break;
        case 'PROFILE': await this._renderProfile(); break;
      }
    }

    // ==================== 视图渲染 ====================

    async _renderHome() {
      const container = this._container?.querySelector('.weibo-home-view');
      if (!container) return;

      const posts = await this._service.getPosts();
      container.innerHTML = '';

      const actions = document.createElement('div');
      actions.className = 'weibo-actions';
      const pubBtn = document.createElement('button');
      pubBtn.dataset.action = 'publish';
      pubBtn.textContent = '写微博';
      const aiBtn = document.createElement('button');
      aiBtn.dataset.action = 'ai-publish';
      aiBtn.textContent = 'AI 生成';
      actions.appendChild(pubBtn);
      actions.appendChild(aiBtn);
      container.appendChild(actions);

      const listEl = document.createElement('div');
      listEl.className = 'weibo-list';
      this._renderPostList(listEl, posts);
      container.appendChild(listEl);
    }

    async _renderHot() {
      const container = this._container?.querySelector('.weibo-hot-view');
      if (!container) return;

      try {
        const hotSearches = await this._service.getHotSearches();
        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'weibo-hot-header';
        header.textContent = '热搜榜';
        container.appendChild(header);

        const listEl = document.createElement('div');
        listEl.className = 'weibo-hot-list';

        hotSearches.forEach((item, index) => {
          const row = document.createElement('div');
          row.className = 'weibo-hot-item';
          const rank = document.createElement('span');
          rank.className = 'weibo-rank';
          rank.textContent = index + 1;
          const title = document.createElement('span');
          title.className = 'weibo-title';
          title.textContent = item.title || '';
          const heat = document.createElement('span');
          heat.className = 'weibo-heat';
          heat.textContent = (item.heat || 0) + '万';
          row.appendChild(rank);
          row.appendChild(title);
          row.appendChild(heat);
          listEl.appendChild(row);
        });

        container.appendChild(listEl);
      } catch (err) {
        console.error('[WeiboModule] 渲染热搜失败:', err);
        container.innerHTML = '<div class="weibo-empty">加载热搜失败</div>';
      }
    }

    async _renderMessage() {
      const container = this._container?.querySelector('.weibo-message-view');
      if (!container) return;
      container.innerHTML = '<div class="weibo-empty">暂无消息</div>';
    }

    async _renderProfile() {
      const container = this._container?.querySelector('.weibo-profile-view');
      if (!container) return;

      let myPosts = [];
      let stats = { posts: 0, followers: 0, following: 0 };
      try {
        [myPosts, stats] = await Promise.all([
          this._service.getMyPosts(),
          this._service.getUserStats(),
        ]);
      } catch (e) {}

      container.innerHTML = '';

      // 个人资料头部（头像 + 名称）
      const headerEl = document.createElement('div');
      headerEl.className = 'weibo-profile-header';

      const avatarEl = document.createElement('div');
      avatarEl.className = 'weibo-profile-avatar';
      avatarEl.innerHTML = ICONS.defaultAvatarLarge;

      const nameEl = document.createElement('div');
      nameEl.className = 'weibo-profile-name';
      nameEl.textContent = '我的微博';

      const bioEl = document.createElement('div');
      bioEl.className = 'weibo-profile-bio';
      bioEl.textContent = '这个人很懒，什么都没写';

      const metaWrap = document.createElement('div');
      metaWrap.appendChild(nameEl);
      metaWrap.appendChild(bioEl);
      headerEl.appendChild(avatarEl);
      headerEl.appendChild(metaWrap);
      container.appendChild(headerEl);

      // 统计数据
      const statsEl = document.createElement('div');
      statsEl.className = 'weibo-profile-stats';
      statsEl.innerHTML = `
        <div class="weibo-stat"><span class="weibo-number">${stats.posts || 0}</span><span class="weibo-label">微博</span></div>
        <div class="weibo-stat"><span class="weibo-number">${stats.followers || 0}</span><span class="weibo-label">粉丝</span></div>
        <div class="weibo-stat"><span class="weibo-number">${stats.following || 0}</span><span class="weibo-label">关注</span></div>
      `;
      container.appendChild(statsEl);

      const listEl = document.createElement('div');
      listEl.className = 'weibo-my-list';
      this._renderPostList(listEl, myPosts, true);
      container.appendChild(listEl);
    }

    _renderPostList(container, posts, showDelete = false) {
      if (!container) return;
      container.innerHTML = '';

      if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="weibo-empty">暂无微博</div>';
        return;
      }

      posts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'weibo-post';
        postEl.dataset.postId = post.id;

        // 帖子头部：头像 + 作者 + 时间
        const header = document.createElement('div');
        header.className = 'weibo-post-header';

        const avatar = document.createElement('div');
        avatar.className = 'weibo-post-avatar';
        avatar.innerHTML = ICONS.defaultAvatar;

        const meta = document.createElement('div');
        meta.className = 'weibo-post-meta';

        const author = document.createElement('span');
        author.className = 'weibo-author';
        author.textContent = post.author || '';

        const time = document.createElement('span');
        time.className = 'weibo-time';
        time.textContent = post.time || '';

        meta.appendChild(author);
        meta.appendChild(time);
        header.appendChild(avatar);
        header.appendChild(meta);
        postEl.appendChild(header);

        // 帖子内容
        const content = document.createElement('div');
        content.className = 'weibo-post-content';
        content.textContent = post.content || '';
        postEl.appendChild(content);

        // 帖子图片（如果有）
        if (post.images && post.images.length > 0) {
          const imagesWrap = document.createElement('div');
          imagesWrap.className = 'weibo-post-images' + (post.images.length === 1 ? ' weibo-single-img' : '');
          post.images.forEach(imgUrl => {
            const img = document.createElement('img');
            img.className = 'weibo-post-image-item';
            img.src = imgUrl;
            img.alt = '';
            imagesWrap.appendChild(img);
          });
          postEl.appendChild(imagesWrap);
        }

        // 操作按钮
        const actions = document.createElement('div');
        actions.className = 'weibo-post-actions';

        const repostBtn = document.createElement('button');
        repostBtn.dataset.action = 'repost';
        repostBtn.dataset.postId = post.id;
        const repostIcon = document.createElement('span');
        repostIcon.className = 'weibo-action-icon';
        repostIcon.innerHTML = ICONS.repost;
        repostBtn.appendChild(repostIcon);
        repostBtn.appendChild(document.createTextNode(post.shares || 0));
        actions.appendChild(repostBtn);

        const commentBtn = document.createElement('button');
        commentBtn.dataset.action = 'comment';
        commentBtn.dataset.postId = post.id;
        const commentIcon = document.createElement('span');
        commentIcon.className = 'weibo-action-icon';
        commentIcon.innerHTML = ICONS.comment;
        commentBtn.appendChild(commentIcon);
        commentBtn.appendChild(document.createTextNode(post.comments || 0));
        actions.appendChild(commentBtn);

        const likeBtn = document.createElement('button');
        likeBtn.dataset.action = 'like';
        likeBtn.dataset.postId = post.id;
        if (post.liked) likeBtn.classList.add('weibo-liked');
        const likeIcon = document.createElement('span');
        likeIcon.className = 'weibo-action-icon';
        likeIcon.innerHTML = post.liked ? ICONS.likeActive : ICONS.like;
        likeBtn.appendChild(likeIcon);
        likeBtn.appendChild(document.createTextNode(post.likes || 0));
        actions.appendChild(likeBtn);

        if (showDelete) {
          const deleteBtn = document.createElement('button');
          deleteBtn.dataset.action = 'delete';
          deleteBtn.dataset.postId = post.id;
          const deleteIcon = document.createElement('span');
          deleteIcon.className = 'weibo-action-icon';
          deleteIcon.innerHTML = ICONS.delete;
          deleteBtn.appendChild(deleteIcon);
          actions.appendChild(deleteBtn);
        }

        postEl.appendChild(actions);
        container.appendChild(postEl);
      });
    }

    // ==================== 业务处理 ====================

    async _handlePublish() {
      const content = await this.showPrompt('发布微博:');
      if (!content?.trim()) return;
      try {
        await this._service.publish(content.trim());
        await this._renderHome();
      } catch (err) {
        this.showToast('发布失败: ' + err.message);
      }
    }

    async _handleAIPublish() {
      try {
        await this._service.publishAI();
        await this._renderHome();
      } catch (err) {
        this.showToast('AI 生成失败: ' + err.message);
      }
    }

    async _handleLike(postId) {
      try {
        await this._service.toggleLike(postId);
        await this._renderHome();
      } catch (err) {
        console.error('点赞失败:', err);
      }
    }

    async _handleComment(postId) {
      const content = await this.showPrompt('评论:');
      if (!content?.trim()) return;
      try {
        await this._service.comment(postId, content.trim());
        this.showToast('评论成功');
      } catch (err) {
        this.showToast('评论失败: ' + err.message);
      }
    }

    async _handleRepost(postId) {
      const reason = (await this.showPrompt('转发理由 (可选):')) || '';
      try {
        await this._service.repost(postId, reason);
        this.showToast('转发成功');
      } catch (err) {
        this.showToast('转发失败: ' + err.message);
      }
    }

    async _handleDelete(postId) {
      const confirmed = await this.confirm('确定删除这条微博吗?');
      if (!confirmed) return;
      try {
        await this._service.delete(postId);
        await this._renderProfile();
      } catch (err) {
        this.showToast('删除失败: ' + err.message);
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsub = this._service.subscribePosts(() => {
          if (this._currentView === 'HOME') {
            this._renderHome();
          } else if (this._currentView === 'PROFILE') {
            this._renderProfile();
          }
        });
        if (unsub) this._unsubscribers.push(unsub);
      } catch (e) {
        console.warn('[WeiboModule] 订阅微博列表失败:', e);
      }

      // 订阅 director:weibo 事件（断裂点2修复）
      try {
        const eventBus = window.Platform?.eventBus;
        if (eventBus) {
          eventBus.on('director:weibo', async (payload) => {
            console.log('[WeiboModule] 收到director:weibo事件', payload);
            try {
              if (this._currentView === 'HOME') {
                await this._renderHome();
              } else if (this._currentView === 'PROFILE') {
                await this._renderProfile();
              }
            } catch (e) {
              console.warn('[WeiboModule] 处理director:weibo事件失败:', e);
            }
          });
        }
      } catch (e) {
        console.warn('[WeiboModule] 订阅director:weibo事件失败:', e);
      }

      try {
        const bus = window.Platform?.eventBus;
        if (bus) {
          const onHot = async () => {
            if (this._currentView === 'HOT') await this._renderHot();
          };
          bus.on('weibo:hotSearchesUpdated', onHot);
          bus.on('director:news', onHot);
          this._unsubscribers.push(() => { try { bus.off('weibo:hotSearchesUpdated', onHot); bus.off('director:news', onHot); } catch (_) {} });
        }
      } catch (_) {}
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new WeiboModule();
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
  window.PhoneModules.Weibo = WeiboModule;

  console.log('[Module] WeiboModule 已加载');
})();
