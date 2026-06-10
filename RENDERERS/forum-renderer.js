/**
 * @layer Renderer
 * @file   forum-renderer.js
 *
 * 职责: 论坛 UI 渲染 - 小红书风格帖子列表、详情、评论、设置
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 forum- 前缀
 */

;(function () {
  'use strict';

  class ForumRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
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

    // ==================== 列表视图 ====================

    renderList(posts) {
      const fragment = document.createDocumentFragment();

      // 操作按钮
      const actionsEl = document.createElement('div');
      actionsEl.className = 'forum-actions';
      actionsEl.innerHTML = `
        <button data-action="publish">发帖</button>
        <button data-action="ai-publish">AI 生成</button>
      `;
      fragment.appendChild(actionsEl);

      if (!posts || posts.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'forum-empty';
        emptyEl.textContent = '暂无帖子，快来发布第一条吧！';
        fragment.appendChild(emptyEl);
        return fragment;
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

      fragment.appendChild(listEl);
      return fragment;
    }

    // ==================== 帖子详情 ====================

    renderPostDetail(post) {
      const container = document.createElement('div');
      container.className = 'forum-detail';
      container.innerHTML = `
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
          ${this.renderReplies(post.replies || [])}
        </div>
      `;
      return container;
    }

    // ==================== 评论区 ====================

    renderReplies(replies) {
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

    // ==================== 设置视图 ====================

    renderSettings(settings) {
      const container = document.createElement('div');
      container.className = 'forum-settings';
      container.innerHTML = `
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
      `;
      return container;
    }

    // ==================== 空状态 / 错误 ====================

    renderEmpty(message) {
      const el = document.createElement('div');
      el.className = 'forum-empty';
      el.textContent = message || '暂无帖子，快来发布第一条吧！';
      return el;
    }

    renderError(message) {
      const el = document.createElement('div');
      el.className = 'forum-error';
      el.textContent = message || '加载失败，请重试';
      return el;
    }

    // ==================== 加载遮罩 ====================

    renderLoading() {
      const el = document.createElement('div');
      el.className = 'forum-loading';
      el.innerHTML = '<div class="forum-loading-spinner"></div>';
      return el;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Forum = ForumRenderer;

  console.log('[Renderer] ForumRenderer 已加载');
})();
