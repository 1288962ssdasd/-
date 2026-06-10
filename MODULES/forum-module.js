/**
 * ForumModule - 论坛模块
 * 职责：生命周期管理、事件绑定、调用 Service
 * 禁止：直接操作数据（必须通过 Service）
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Forum
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 模块注册通过 __phoneShell.registerModule（铁则五）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class ForumModule extends PhoneApp {
    constructor() {
      super({
        id: 'forum',
        name: '论坛',
        icon: '💬',
        iconBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      });

      this._service = null;
      this._currentView = 'LIST'; // LIST | DETAIL | SETTINGS
      this._currentPostId = null;
      this._unsubscribers = [];
      this._isLoading = false;
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Forum(window.Platform);

      // ST5层联动：监听大世界层级更新
      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      if (this._platform?.eventBus) {
        const unsub = this._platform.eventBus.on('world:stageUpdated', async (payload) => {
          console.log(`[${this.id}] 收到世界层级更新事件:`, payload);
          await this._handleWorldUpdate(payload);
        });
        if (unsub) this._unsubscribers.push(unsub);
      }
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
        /* ===== forum-app: 小红书风格全屏容器 ===== */
        .forum-app {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* ===== forum-header: 白色导航栏 ===== */
        .forum-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          padding: 0 16px;
          height: 44px;
          flex-shrink: 0;
          border-bottom: 0.5px solid #e5e5e5;
        }

        /* ===== forum-tabs: 水平滚动分类标签栏 ===== */
        .forum-tabs {
          display: flex;
          align-items: center;
          height: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          gap: 4px;
        }
        .forum-tabs::-webkit-scrollbar {
          display: none;
        }

        /* ===== forum-tab: 分类标签 ===== */
        .forum-tab {
          padding: 8px 14px;
          font-size: 14px;
          color: #666;
          background: none;
          border: none;
          outline: none;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          border-radius: 16px;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .forum-tab.forum-active {
          color: #ff2442;
          font-weight: 600;
          background: rgba(255, 36, 66, 0.08);
        }

        /* ===== forum-publish-btn: 红色发布按钮 ===== */
        .forum-publish-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff2442, #ff5a5f);
          color: #ffffff;
          border: none;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .forum-publish-btn:active {
          transform: scale(0.9);
        }

        /* ===== forum-views: 填充剩余空间 ===== */
        .forum-views {
          flex: 1;
          overflow: hidden;
        }

        .forum-view {
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ===== forum-actions: 操作按钮栏 ===== */
        .forum-actions {
          display: flex;
          gap: 10px;
          padding: 12px 16px;
          background: #f5f5f5;
        }

        .forum-actions button {
          flex: 1;
          padding: 10px 0;
          border-radius: 20px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 0.15s ease;
        }

        .forum-actions button:first-child {
          background: linear-gradient(135deg, #ff2442, #ff5a5f);
          color: #ffffff;
        }

        .forum-actions button:last-child {
          background: #ffffff;
          color: #ff2442;
          border: 1px solid #ff2442;
        }

        .forum-actions button:active {
          opacity: 0.7;
        }

        /* ===== forum-list: 瀑布流容器 ===== */
        .forum-list {
          padding: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* ===== forum-post-item: 白色圆角卡片 ===== */
        .forum-post-item {
          width: calc(50% - 4px);
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .forum-post-item:active {
          transform: scale(0.97);
        }

        /* ===== forum-post-cover: 封面图 ===== */
        .forum-post-cover {
          width: 100%;
          aspect-ratio: 1;
          background: #eee;
          background-size: cover;
          background-position: center;
        }

        /* ===== forum-post-body: 卡片内容区 ===== */
        .forum-post-body {
          padding: 10px;
        }

        /* ===== forum-post-title: 标题两行省略 ===== */
        .forum-post-title {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 8px;
        }

        /* ===== forum-post-meta: 作者+点赞 ===== */
        .forum-post-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #999;
        }

        /* ===== forum-author: 作者信息 ===== */
        .forum-author {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #666;
          font-weight: 400;
          max-width: 60%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .forum-author-avatar {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ddd;
          flex-shrink: 0;
          background-size: cover;
          background-position: center;
        }

        /* ===== forum-post-likes: 点赞数 ===== */
        .forum-post-likes {
          display: flex;
          align-items: center;
          gap: 3px;
          color: #999;
          font-size: 12px;
        }

        .forum-post-likes-icon {
          font-size: 14px;
        }

        /* ===== forum-empty / forum-error ===== */
        .forum-empty,
        .forum-error {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #999;
          font-size: 14px;
          padding: 60px 24px;
        }

        /* ===== forum-detail: 帖子详情页 ===== */
        .forum-detail {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
        }

        /* ===== forum-detail-header: 返回+标题 ===== */
        .forum-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 44px;
          background: #ffffff;
          border-bottom: 0.5px solid #e5e5e5;
          flex-shrink: 0;
        }

        .forum-detail-header button {
          background: none;
          border: none;
          color: #333;
          font-size: 15px;
          cursor: pointer;
          padding: 4px 0;
          -webkit-tap-highlight-color: transparent;
        }

        .forum-detail-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        /* ===== forum-detail-content ===== */
        .forum-detail-content {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ===== forum-detail-cover: 详情大图 ===== */
        .forum-detail-cover {
          width: 100%;
          aspect-ratio: 4/3;
          background: #eee;
          background-size: cover;
          background-position: center;
        }

        .forum-detail-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          font-size: 13px;
          color: #999;
          background: #ffffff;
        }

        .forum-detail-author-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .forum-detail-author-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ddd;
          background-size: cover;
          background-position: center;
        }

        .forum-detail-author-name {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        /* ===== forum-detail-text ===== */
        .forum-detail-text {
          font-size: 15px;
          line-height: 1.7;
          color: #333;
          padding: 16px;
          background: #ffffff;
          margin-top: 8px;
        }

        /* ===== forum-detail-actions: 底部操作栏 ===== */
        .forum-detail-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #ffffff;
          margin-top: 8px;
        }

        .forum-detail-actions button {
          flex: 1;
          padding: 10px 0;
          border-radius: 20px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 0.15s ease;
        }

        .forum-detail-actions button:active {
          opacity: 0.7;
        }

        .forum-detail-actions .forum-like-btn {
          background: #fff0f1;
          color: #ff2442;
        }

        .forum-detail-actions .forum-reply-btn {
          background: #fff0f1;
          color: #ff2442;
        }

        .forum-detail-actions .forum-ai-reply-btn {
          background: #f0f5ff;
          color: #4a7dff;
        }

        /* ===== forum-replies: 评论区 ===== */
        .forum-replies {
          padding: 0 16px 16px;
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .forum-replies h4 {
          font-size: 15px;
          font-weight: 600;
          color: #333;
          padding: 16px 0 12px;
          background: #ffffff;
          margin-top: 8px;
        }

        .forum-no-replies {
          text-align: center;
          color: #999;
          font-size: 14px;
          padding: 24px 0;
          background: #ffffff;
        }

        /* ===== forum-reply-item: 回复卡片 ===== */
        .forum-reply-item {
          padding: 12px 0;
          border-bottom: 0.5px solid #f0f0f0;
          background: #ffffff;
        }

        .forum-reply-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #999;
          margin-bottom: 6px;
        }

        .forum-reply-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ddd;
          flex-shrink: 0;
        }

        .forum-reply-author {
          color: #666;
          font-weight: 500;
        }

        .forum-reply-content {
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          padding-left: 32px;
        }

        /* ===== forum-settings: 设置页 ===== */
        .forum-settings {
          padding: 16px;
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .forum-settings h3 {
          font-size: 13px;
          font-weight: 400;
          color: #999;
          text-transform: uppercase;
          padding: 0 0 8px 4px;
          margin-bottom: 8px;
        }

        /* ===== forum-setting-item ===== */
        .forum-setting-item {
          background: #ffffff;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .forum-setting-item label {
          display: block;
          font-size: 15px;
          font-weight: 500;
          color: #333;
          margin-bottom: 12px;
        }

        /* ===== forum-style-options ===== */
        .forum-style-options {
          display: flex;
          background: #f5f5f5;
          border-radius: 8px;
          padding: 3px;
        }

        .forum-style-btn {
          flex: 1;
          padding: 8px 4px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #666;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .forum-style-btn.forum-active {
          background: #ffffff;
          color: #ff2442;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        /* ===== forum-threshold-input ===== */
        .forum-threshold-input {
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: #f5f5f5;
          font-size: 15px;
          color: #333;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
        }

        .forum-threshold-input:focus {
          background: #ffffff;
          box-shadow: 0 0 0 2px #ff2442;
        }

        /* ===== forum-btn-refresh: 刷新按钮 ===== */
        .forum-btn-refresh {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 36, 66, 0.1);
          color: #ff2442;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          flex-shrink: 0;
        }
        .forum-btn-refresh:active {
          transform: scale(0.9);
        }
        .forum-btn-refresh.loading {
          animation: forum-spin 1s linear infinite;
        }
        @keyframes forum-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ===== forum-loading: 加载遮罩 ===== */
        .forum-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(245, 245, 245, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .forum-loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 36, 66, 0.12);
          border-top-color: #ff2442;
          border-radius: 50%;
          animation: forum-spin 0.8s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 渲染 ====================

    onRender() {
      this._injectStyles();
      return `
        <div class="forum-app">
          <div class="forum-header">
            <div class="forum-tabs">
              <button data-tab="LIST" class="forum-tab forum-active">推荐</button>
              <button data-tab="SETTINGS" class="forum-tab">设置</button>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button class="forum-btn-refresh" data-action="refresh" title="刷新">\u21BB</button>
              <button class="forum-publish-btn" data-action="publish">+</button>
            </div>
          </div>
          <div class="forum-views">
            <div class="forum-view" data-view="LIST"></div>
            <div class="forum-view" data-view="DETAIL" style="display:none;"></div>
            <div class="forum-view" data-view="SETTINGS" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 刷新按钮
          if (e.target.closest('[data-action="refresh"]')) {
            await this._handleManualRefresh();
            return;
          }

          // Tab 切换
          const tabBtn = e.target.closest('[data-tab]');
          if (tabBtn) {
            await this._switchTab(tabBtn.dataset.tab);
            return;
          }

          // 发布帖子
          if (e.target.closest('[data-action="publish"]')) {
            await this._handlePublish();
            return;
          }

          // AI 生成帖子
          if (e.target.closest('[data-action="ai-publish"]')) {
            await this._handleAIPublish();
            return;
          }

          // 查看帖子详情
          const postItem = e.target.closest('[data-post-id]');
          if (postItem && !e.target.closest('[data-action]')) {
            await this._showPostDetail(postItem.dataset.postId);
            return;
          }

          // 点赞帖子
          const likeBtn = e.target.closest('[data-action="like-post"]');
          if (likeBtn) {
            await this._handleLikePost(likeBtn.dataset.postId);
            return;
          }

          // 回复帖子
          const replyBtn = e.target.closest('[data-action="reply"]');
          if (replyBtn) {
            await this._handleReply(replyBtn.dataset.postId);
            return;
          }

          // AI 回复
          const aiReplyBtn = e.target.closest('[data-action="ai-reply"]');
          if (aiReplyBtn) {
            await this._handleAIReply(aiReplyBtn.dataset.postId);
            return;
          }

          // 返回列表
          if (e.target.closest('[data-action="back"]')) {
            await this._switchTab('LIST');
            return;
          }

          // 删除帖子
          const deleteBtn = e.target.closest('[data-action="delete-post"]');
          if (deleteBtn) {
            await this._handleDeletePost(deleteBtn.dataset.postId);
            return;
          }

          // 设置风格
          const styleBtn = e.target.closest('[data-style]');
          if (styleBtn) {
            await this._handleSetStyle(styleBtn.dataset.style);
            return;
          }
        });

        this._subscribeData();
        this._renderList();
      }, 0);
    }

    // ==================== 视图切换 ====================

    async _switchTab(tab) {
      this._currentView = tab;

      this._container.querySelectorAll('[data-tab]').forEach(btn => {
        btn.classList.toggle('forum-active', btn.dataset.tab === tab);
      });

      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === tab ? 'block' : 'none';
      });

      if (tab === 'LIST') {
        await this._renderList();
      } else if (tab === 'SETTINGS') {
        await this._renderSettings();
      }
    }

    // ==================== 视图渲染 ====================

    async _renderList() {
      const container = this._container?.querySelector('[data-view="LIST"]');
      if (!container) return;

      try {
        const posts = await this._service.getPosts();
        container.innerHTML = '';

        // 操作按钮
        const actionsEl = document.createElement('div');
        actionsEl.className = 'forum-actions';
        actionsEl.innerHTML = `
          <button data-action="publish">发帖</button>
          <button data-action="ai-publish">AI 生成</button>
        `;
        container.appendChild(actionsEl);

        if (!posts || posts.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'forum-empty';
          emptyEl.textContent = '暂无帖子，快来发布第一条吧！';
          container.appendChild(emptyEl);
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'forum-list';

        posts.forEach(post => {
          const postEl = document.createElement('div');
          postEl.className = 'forum-post-item';
          postEl.dataset.postId = post.id;

          const coverUrl = post.cover || post.image || '';
          postEl.innerHTML = `
            ${coverUrl ? `<div class="forum-post-cover" style="background-image: url('${this._escapeHtml(coverUrl)}')"></div>` : '<div class="forum-post-cover"></div>'}
            <div class="forum-post-body">
              <div class="forum-post-title">${this._escapeHtml(post.title)}</div>
              <div class="forum-post-meta">
                <span class="forum-author">
                  <span class="forum-author-avatar"></span>
                  ${this._escapeHtml(post.author || '匿名')}
                </span>
                <span class="forum-post-likes">
                  <span class="forum-post-likes-icon">&#9829;</span>
                  ${post.likes || 0}
                </span>
              </div>
            </div>
          `;

          listEl.appendChild(postEl);
        });

        container.appendChild(listEl);
      } catch (e) {
        console.warn('[ForumModule] 渲染帖子列表失败:', e);
        container.innerHTML = '<div class="forum-error">加载失败，请重试</div>';
      }
    }

    async _showPostDetail(postId) {
      const container = this._container?.querySelector('[data-view="DETAIL"]');
      if (!container) return;

      try {
        const post = await this._service.getPost(postId);
        if (!post) {
          container.innerHTML = '<div class="forum-error">帖子不存在</div>';
          return;
        }

        this._currentPostId = postId;

        container.innerHTML = `
          <div class="forum-detail">
            <div class="forum-detail-header">
              <button data-action="back">&larr; 返回</button>
              <h3>帖子详情</h3>
            </div>
            <div class="forum-detail-content">
              ${post.cover || post.image ? `<div class="forum-detail-cover" style="background-image: url('${this._escapeHtml(post.cover || post.image)}')"></div>` : ''}
              <div class="forum-detail-meta">
                <div class="forum-detail-author-info">
                  <div class="forum-detail-author-avatar"></div>
                  <span class="forum-detail-author-name">${this._escapeHtml(post.author || '匿名')}</span>
                </div>
                <span class="forum-time">${post.time || ''}</span>
              </div>
              <div class="forum-detail-text">${this._escapeHtml(post.content)}</div>
              <div class="forum-detail-actions">
                <button class="forum-like-btn" data-action="like-post" data-post-id="${post.id}">&#9829; ${post.likes || 0}</button>
                <button class="forum-reply-btn" data-action="reply" data-post-id="${post.id}">回复</button>
                <button class="forum-ai-reply-btn" data-action="ai-reply" data-post-id="${post.id}">AI 回复</button>
              </div>
            </div>
            <div class="forum-replies">
              <h4>回复 (${post.replies?.length || 0})</h4>
              ${this._renderReplies(post.replies || [])}
            </div>
          </div>
        `;

        // 显示详情视图
        this._container.querySelectorAll('[data-view]').forEach(view => {
          view.style.display = view.dataset.view === 'DETAIL' ? 'block' : 'none';
        });
      } catch (e) {
        console.warn('[ForumModule] 渲染帖子详情失败:', e);
        container.innerHTML = '<div class="forum-error">加载失败，请重试</div>';
      }
    }

    _renderReplies(replies) {
      if (!replies || replies.length === 0) {
        return '<div class="forum-no-replies">暂无回复</div>';
      }

      return replies.map(reply => `
        <div class="forum-reply-item">
          <div class="forum-reply-meta">
            <span class="forum-reply-avatar"></span>
            <span class="forum-reply-author">${this._escapeHtml(reply.author || '匿名')}</span>
            <span class="forum-time">${reply.time || ''}</span>
          </div>
          <div class="forum-reply-content">${this._escapeHtml(reply.content)}</div>
        </div>
      `).join('');
    }

    async _renderSettings() {
      const container = this._container?.querySelector('[data-view="SETTINGS"]');
      if (!container) return;

      try {
        const settings = await this._service.getSettings();

        container.innerHTML = `
          <div class="forum-settings">
            <h3>论坛设置</h3>
            <div class="forum-setting-item">
              <label>论坛风格</label>
              <div class="forum-style-options">
                <button class="forum-style-btn ${settings.style === 'normal' ? 'forum-active' : ''}" data-style="normal">普通论坛</button>
                <button class="forum-style-btn ${settings.style === 'anonymous' ? 'forum-active' : ''}" data-style="anonymous">匿名论坛</button>
                <button class="forum-style-btn ${settings.style === 'roleplay' ? 'forum-active' : ''}" data-style="roleplay">角色扮演</button>
              </div>
            </div>
            <div class="forum-setting-item">
              <label>消息阈值（自动生成帖子的消息数）</label>
              <input type="number" class="forum-threshold-input" value="${settings.messageThreshold || 5}" min="1" max="100" />
            </div>
          </div>
        `;

        // 绑定阈值输入事件
        const thresholdInput = container.querySelector('.forum-threshold-input');
        if (thresholdInput) {
          thresholdInput.addEventListener('change', async (e) => {
            const value = parseInt(e.target.value, 10);
            if (value > 0) {
              await this._service.setThreshold(value);
            }
          });
        }
      } catch (e) {
        console.warn('[ForumModule] 渲染设置失败:', e);
        container.innerHTML = '<div class="forum-error">加载失败，请重试</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handlePublish() {
      try {
        const title = await this.showPrompt({ message: '帖子标题:' });
        if (!title?.trim()) return;

        const content = await this.showPrompt({ message: '帖子内容:' });
        if (!content?.trim()) return;

        await this._service.publishPost(title.trim(), content.trim());
        this.showToast('发布成功', 'success');
        await this._renderList();
      } catch (err) {
        console.error('[ForumModule] 发布失败:', err);
        this.showToast('发帖功能暂未接入API', 'warning');
      }
    }

    async _handleAIPublish() {
      try {
        await this._service.generatePost();
        this.showToast('AI 帖子生成成功', 'success');
        await this._renderList();
      } catch (err) {
        console.error('[ForumModule] AI生成失败:', err);
        this.showToast('AI发帖功能暂未接入API', 'warning');
      }
    }

    async _handleLikePost(postId) {
      try {
        await this._service.likePost(postId);
        if (this._currentPostId === postId) {
          await this._showPostDetail(postId);
        }
      } catch (err) {
        console.error('[ForumModule] 点赞失败:', err);
      }
    }

    async _handleReply(postId) {
      const content = await this.showPrompt({ message: '回复内容:' });
      if (!content?.trim()) return;

      try {
        await this._service.reply(postId, content.trim());
        await this._showPostDetail(postId);
      } catch (err) {
        this.showToast('回复失败: ' + err.message);
      }
    }

    async _handleAIReply(postId) {
      try {
        await this._service.generateReply(postId);
        await this._showPostDetail(postId);
      } catch (err) {
        this.showToast('AI 回复失败: ' + err.message);
      }
    }

    async _handleDeletePost(postId) {
      const confirmed = await this.confirm('确定删除这篇帖子吗？');
      if (!confirmed) return;

      try {
        await this._service.deletePost(postId);
        await this._switchTab('LIST');
      } catch (err) {
        this.showToast('删除失败: ' + err.message);
      }
    }

    async _handleSetStyle(style) {
      try {
        await this._service.setStyle(style);
        await this._renderSettings();
      } catch (err) {
        console.error('[ForumModule] 设置风格失败:', err);
      }
    }

    // ==================== ST5层联动 ====================

    async _handleWorldUpdate(payload) {
      try {
        this._showLoading(true);
        // 调用 Service 方法重新生成论坛帖子（新帖子、热门讨论等）
        if (this._service?.regenerateData) {
          await this._service.regenerateData(payload);
        }
        await this._renderList();
        this._showLoading(false);
        this.showToast('论坛数据已更新', 'success');
      } catch (e) {
        this._showLoading(false);
        console.warn(`[${this.id}] 世界更新处理失败:`, e);
        // 错误降级：保留现有数据不变
      }
    }

    // ==================== 手动刷新 ====================

    async _handleManualRefresh() {
      try {
        this._showLoading(true);
        // 调用 Service 重新生成数据
        if (this._service?.regenerateData) {
          await this._service.regenerateData({ source: 'manual' });
        }
        await this._renderList();
        this._showLoading(false);
        this.showToast('刷新成功', 'success');
      } catch (e) {
        this._showLoading(false);
        console.warn('[ForumModule] 手动刷新失败:', e);
        // 错误降级：保留现有数据不变
      }
    }

    // ==================== 加载状态 ====================

    _showLoading(show) {
      this._isLoading = show;
      const views = this._container?.querySelector('.forum-views');
      const refreshBtn = this._container?.querySelector('.forum-btn-refresh');

      if (refreshBtn) {
        refreshBtn.classList.toggle('loading', show);
      }

      // 移除已有加载遮罩
      const existingLoading = this._container?.querySelector('.forum-loading');
      if (existingLoading) existingLoading.remove();

      if (show && views) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'forum-loading';
        loadingEl.innerHTML = '<div class="forum-loading-spinner"></div>';
        views.style.position = 'relative';
        views.appendChild(loadingEl);
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsub = this._service.subscribePosts(() => {
          if (this._currentView === 'LIST') {
            this._renderList();
          }
        });
        if (unsub) this._unsubscribers.push(unsub);
      } catch (e) {
        console.warn('[ForumModule] 订阅帖子失败:', e);
      }
    }

    // ==================== 辅助方法 ====================

    async _refresh() {
      if (this._currentView === 'LIST') {
        await this._renderList();
      } else if (this._currentView === 'SETTINGS') {
        await this._renderSettings();
      }
    }

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new ForumModule();
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
  window.PhoneModules.Forum = ForumModule;

  console.log('[Module] ForumModule 已加载');
})();
