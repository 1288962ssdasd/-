/**
 * WeiboUINew - 微博 UI 重写模块（基于 ContextDrivenApp）
 * 与旧版 WeiboUI 功能对等，使用新架构
 */
;(function () {
  'use strict';

  class WeiboUINew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'WeiboUINew' });
      this._currentPage = 'hot';
      this._likesData = {};
      this._commentLikesData = {};
      this._weiboManager = null;
      this._configManager = null;
      this._events = null;
      this._cachedData = null;
      this._avatarColors = [
        '#C4B7D6', '#b28cb9', '#e2b3d4', '#f7d1e6', '#d49ec2',
        '#f3c6d7', '#ec97b7', '#d66a88', '#b74d66', '#e3d6a7',
        '#c8ac6d', '#a0d8e1', '#2e8b9b', '#1a6369', '#6ba1e1',
        '#1f5e8d', '#b7d3a8', '#3e7b41', '#f9e79f', '#a3b4e2',
      ];
    }

    // ── 生命周期 ──────────────────────────────────────────────

    onInit() {
      this._weiboManager = this.getService('weiboManager');
      this._configManager = this.getService('configManager');
      this._events = this.getEvents();
      if (this._events) {
        const off = this._events.on('weibo:dataChanged', () => this.refresh());
        this._offFunctions.push(() => off());
      }
      this.updateHeader('微博');
      console.log('[WeiboUINew] 初始化完成');
    }

    onDestroy() {
      this._cachedData = null;
      this._likesData = {};
      this._commentLikesData = {};
    }

    // ── 数据层 ────────────────────────────────────────────────

    _computeDataHash() {
      const cm = this._configManager;
      if (!cm) return '';
      return JSON.stringify({
        hot: cm.get('xb.weibo.hotSearches'),
        posts: cm.get('xb.weibo.posts'),
        stats: cm.get('xb.weibo.userStats'),
      });
    }

    _parse(raw, fallback) {
      if (!raw) return fallback;
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
      catch { return fallback; }
    }

    async _loadData() {
      try {
        const cm = this._configManager;
        if (!cm) return this._emptyData();
        const posts = this._parse(cm.get('xb.weibo.posts'), []);
        const hotSearches = this._parse(cm.get('xb.weibo.hotSearches'), []);
        const userStats = this._parse(cm.get('xb.weibo.userStats'), null);
        const rankingPosts = posts.filter(p => p.type === 'ranking');
        const comments = {};
        posts.forEach(post => {
          comments[post.id] = Array.isArray(post.comments) ? post.comments.map(c => ({
            id: c.id || ('c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)),
            postId: post.id, author: c.author, content: c.content,
            timestamp: c.timestamp ? new Date(c.timestamp * 1000).toLocaleString() : new Date().toLocaleString(),
            likes: c.likes || 0, type: c.type || 'comment', isReply: c.type === 'reply',
          })) : [];
        });
        return (this._cachedData = { posts, hotSearches, rankingPosts, userStats, comments });
      } catch (e) {
        console.error('[WeiboUINew] 数据加载失败:', e);
        return this._cachedData || this._emptyData();
      }
    }

    _emptyData() {
      return { posts: [], hotSearches: [], rankingPosts: [], userStats: null, comments: {} };
    }

    // ── 渲染入口 ──────────────────────────────────────────────

    getAppContent() {
      const tabs = [
        { page: 'hot', icon: 'fa-fire', label: '热搜' },
        { page: 'ranking', icon: 'fa-trophy', label: '榜单' },
        { page: 'user', icon: 'fa-user', label: '用户' },
      ];
      const tabHTML = tabs.map(t =>
        `<div class="weibo-new-tab${this._currentPage === t.page ? ' active' : ''}" data-page="${t.page}">` +
        `<i class="fas ${t.icon}"></i><span>${t.label}</span></div>`
      ).join('');
      return `<div class="weibo-new-app"><div class="weibo-new-tabs">${tabHTML}</div>` +
        `<div class="weibo-new-content" id="weibo-new-content">` +
        `<div class="weibo-new-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div></div></div>`;
    }

    async bindEvents() {
      const bind = (sel, evt, fn) => document.querySelectorAll(sel).forEach(el => el.addEventListener(evt, fn));
      bind('.weibo-new-tab', 'click', e => { e.preventDefault(); this._switchPage(e.currentTarget.dataset.page); });
      bind('.weibo-new-delete-btn', 'click', e => { e.stopPropagation(); this._deletePost(e.currentTarget.dataset.postId); });
      bind('.weibo-new-like-btn', 'click', e => { e.preventDefault(); this._toggleLike(e.currentTarget.dataset.postId); });
      bind('.weibo-new-comment-like-btn', 'click', e => { e.preventDefault(); this._toggleCommentLike(e.currentTarget.dataset.commentId); });
      bind('.weibo-new-comment-btn', 'click', e => { e.preventDefault(); this._showReplyInput(e.currentTarget.dataset.postId); });
      bind('.weibo-new-reply-btn', 'click', e => {
        e.preventDefault();
        this._showReplyInput(e.currentTarget.dataset.postId, e.currentTarget.dataset.commentId);
      });
      bind('.weibo-new-send-reply-btn', 'click', e => { e.preventDefault(); this._sendReply(e.currentTarget); });
      bind('.weibo-new-cancel-reply-btn', 'click', e => { e.preventDefault(); this._hideReplyInput(e.currentTarget); });
      bind('.weibo-new-switch-account-btn', 'click', e => { e.preventDefault(); this._switchAccount(); });
      await this._renderCurrentPage();
    }

    // ── 页面切换 ──────────────────────────────────────────────

    _switchPage(page) {
      if (this._currentPage === page) return;
      this._currentPage = page;
      document.querySelectorAll('.weibo-new-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.page === page));
      if (this._weiboManager && this._weiboManager.setCurrentPage) {
        this._weiboManager.setCurrentPage(page);
      }
      this._renderCurrentPage();
    }

    async _renderCurrentPage() {
      const data = await this._loadData();
      const container = document.getElementById('weibo-new-content');
      if (!container) return;
      const renderers = { hot: '_renderHotPage', ranking: '_renderRankingPage', user: '_renderUserPage' };
      container.innerHTML = this[renderers[this._currentPage] || '_renderHotPage'](data);
      this.bindEvents();
      container.scrollTop = 0;
    }

    // ── 页面渲染 ──────────────────────────────────────────────

    _renderHotPage(data) {
      const hotPosts = data.posts.filter(p => p.type === 'hot').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      let html = '<div class="weibo-new-page">';
      html += '<div class="weibo-new-section"><div class="weibo-new-section-header"><i class="fas fa-fire"></i> 微博热搜</div>';
      html += '<div class="weibo-new-hot-list">';
      data.hotSearches.forEach(s => {
        const icon = s.rank <= 3 ? '<i class="fas fa-fire" style="color:#ff8500"></i>'
          : s.rank <= 10 ? '<i class="fas fa-arrow-up" style="color:#ff9500"></i>'
          : '<i class="fas fa-circle" style="color:#999"></i>';
        html += `<div class="weibo-new-hot-item"><span class="weibo-new-hot-rank">${s.rank}</span>` +
          `<div class="weibo-new-hot-body"><div class="weibo-new-hot-title">${s.title}</div>` +
          `<div class="weibo-new-hot-heat">${s.heat}</div></div>` +
          `<span class="weibo-new-hot-icon">${icon}</span></div>`;
      });
      html += '</div></div>';
      if (hotPosts.length) {
        html += '<div class="weibo-new-section"><div class="weibo-new-section-header"><i class="fas fa-comments"></i> 热搜讨论</div>';
        html += '<div class="weibo-new-posts-list">';
        hotPosts.forEach(p => { html += this._renderPost(p, data.comments[p.id] || [], true); });
        html += '</div></div>';
      }
      return html + '</div>';
    }

    _renderRankingPage(data) {
      const posts = (data.rankingPosts || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      let html = '<div class="weibo-new-page">';
      if (posts.length) {
        html += '<div class="weibo-new-section"><div class="weibo-new-section-header"><i class="fas fa-comments"></i> 榜单讨论</div>';
        html += '<div class="weibo-new-posts-list">';
        posts.forEach(p => { html += this._renderPost(p, data.comments[p.id] || [], false); });
        html += '</div></div>';
      } else {
        html += '<div class="weibo-new-empty"><i class="fas fa-trophy"></i><p>暂无榜单内容</p></div>';
      }
      return html + '</div>';
    }

    _renderUserPage(data) {
      const username = this._getCurrentUsername();
      const isMain = this._isMainAccount();
      const stats = data.userStats || {};
      const fans = isMain ? (stats.mainAccountFans || '0') : (stats.aliasAccountFans || '0');
      const userPosts = data.posts.filter(p => p.type === 'user')
        .filter(p => this._matchAuthor(p.author, username))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      let html = '<div class="weibo-new-page">';
      html += '<div class="weibo-new-user-card">';
      html += `<div class="weibo-new-user-header">${this._avatarHTML(username, 'large')}` +
        `<div class="weibo-new-user-info"><div class="weibo-new-user-name">${username}</div>` +
        `<div class="weibo-new-account-type">${isMain ? '大号' : '小号'}</div></div></div>`;
      html += '<div class="weibo-new-user-stats">';
      html += `<div class="weibo-new-stat"><div class="weibo-new-stat-num">${userPosts.length}</div><div class="weibo-new-stat-label">微博</div></div>` +
        `<div class="weibo-new-stat"><div class="weibo-new-stat-num">100</div><div class="weibo-new-stat-label">关注</div></div>` +
        `<div class="weibo-new-stat"><div class="weibo-new-stat-num">${fans}</div><div class="weibo-new-stat-label">粉丝</div></div>`;
      html += '</div><button class="weibo-new-switch-account-btn"><i class="fas fa-exchange-alt"></i> 切换账户</button></div>';
      if (userPosts.length) {
        html += '<div class="weibo-new-section"><div class="weibo-new-section-header"><i class="fas fa-user"></i> 我的微博</div>';
        html += '<div class="weibo-new-posts-list">';
        userPosts.forEach(p => { html += this._renderPost(p, data.comments[p.id] || [], true); });
        html += '</div></div>';
      } else {
        html += '<div class="weibo-new-empty"><i class="fas fa-edit"></i><p>还没有发布过微博</p></div>';
      }
      return html + '</div>';
    }

    // ── 博文卡片 ──────────────────────────────────────────────

    _renderPost(post, comments, canReply) {
      const ld = this._likesData[post.id] || { likes: post.likes || 0, isLiked: false };
      let html = `<div class="weibo-new-post" data-post-id="${post.id}">`;
      // 头部
      html += '<div class="weibo-new-post-header">' +
        `<div class="weibo-new-post-author">${this._avatarHTML(post.author)}` +
        `<div class="weibo-new-author-info"><div class="weibo-new-author-name">${post.author}</div>` +
        `<div class="weibo-new-post-time">${post.timestamp}</div></div></div>` +
        `<button class="weibo-new-delete-btn" data-post-id="${post.id}">删除</button></div>`;
      // 内容
      html += `<div class="weibo-new-post-content">${this._formatContent(post.content)}</div>`;
      // 操作按钮
      html += '<div class="weibo-new-post-actions">' +
        `<button class="weibo-new-action-btn weibo-new-like-btn${ld.isLiked ? ' liked' : ''}" data-post-id="${post.id}">` +
        `<i class="fas fa-heart"></i><span>${ld.likes}</span></button>`;
      if (canReply) {
        html += `<button class="weibo-new-action-btn weibo-new-comment-btn" data-post-id="${post.id}">` +
          `<i class="fas fa-comment"></i><span>${comments.length}</span></button>`;
      } else {
        html += `<span class="weibo-new-action-info"><i class="fas fa-comment"></i><span>${comments.length}</span></span>`;
      }
      html += `<button class="weibo-new-action-btn" data-post-id="${post.id}">` +
        `<i class="fas fa-share"></i><span>${post.shares || 0}</span></button></div>`;
      // 评论列表
      if (comments.length) {
        html += `<div class="weibo-new-comments"><div class="weibo-new-comments-header">评论 ${comments.length}</div>`;
        comments.forEach(c => {
          const cld = this._commentLikesData[c.id] || { likes: c.likes, isLiked: false };
          html += `<div class="weibo-new-comment-item" data-comment-id="${c.id}">` +
            `<div class="weibo-new-comment-author">${this._avatarHTML(c.author, 'small')}` +
            `<div class="weibo-new-comment-info"><div class="weibo-new-comment-author-name">${c.author}</div>` +
            `<div class="weibo-new-comment-time">${c.timestamp}</div></div></div>` +
            `<div class="weibo-new-comment-content">${this._formatCommentContent(c.content)}</div>` +
            `<div class="weibo-new-comment-actions">` +
            `<button class="weibo-new-action-btn weibo-new-comment-like-btn${cld.isLiked ? ' liked' : ''}" data-comment-id="${c.id}">` +
            `<i class="fas fa-heart"></i><span>${cld.likes}</span></button>`;
          if (canReply) {
            html += `<button class="weibo-new-action-btn weibo-new-reply-btn" data-comment-id="${c.id}" data-post-id="${post.id}">` +
              `<i class="fas fa-reply"></i> 回复</button>`;
          }
          html += '</div></div>';
        });
        html += '</div>';
      }
      // 回复输入框
      if (canReply) {
        html += '<div class="weibo-new-reply-container" style="display:none">' +
          '<textarea class="weibo-new-reply-textarea" placeholder="写评论..." maxlength="140"></textarea>' +
          '<div class="weibo-new-reply-actions">' +
          '<button class="weibo-new-cancel-reply-btn">取消</button>' +
          '<button class="weibo-new-send-reply-btn">发送</button></div></div>';
      }
      return html + '</div>';
    }

    // ── 交互逻辑 ──────────────────────────────────────────────

    _toggleLike(postId) {
      if (!this._likesData[postId]) {
        const btn = document.querySelector(`.weibo-new-like-btn[data-post-id="${postId}"]`);
        this._likesData[postId] = { likes: btn ? parseInt(btn.querySelector('span').textContent) || 0 : 0, isLiked: false };
      }
      const ld = this._likesData[postId];
      ld.isLiked = !ld.isLiked;
      ld.likes = Math.max(0, ld.likes + (ld.isLiked ? 1 : -1));
      const btn = document.querySelector(`.weibo-new-like-btn[data-post-id="${postId}"]`);
      if (btn) { btn.classList.toggle('liked', ld.isLiked); btn.querySelector('span').textContent = ld.likes; }
    }

    _toggleCommentLike(commentId) {
      if (!this._commentLikesData[commentId]) {
        const btn = document.querySelector(`.weibo-new-comment-like-btn[data-comment-id="${commentId}"]`);
        this._commentLikesData[commentId] = { likes: btn ? parseInt(btn.querySelector('span').textContent) || 0 : 0, isLiked: false };
      }
      const ld = this._commentLikesData[commentId];
      ld.isLiked = !ld.isLiked;
      ld.likes = Math.max(0, ld.likes + (ld.isLiked ? 1 : -1));
      const btn = document.querySelector(`.weibo-new-comment-like-btn[data-comment-id="${commentId}"]`);
      if (btn) { btn.classList.toggle('liked', ld.isLiked); btn.querySelector('span').textContent = ld.likes; }
    }

    async _deletePost(postId) {
      if (!confirm('确定删除该微博及其所有评论吗？')) return;
      try {
        const cm = this._configManager;
        if (!cm) { this.showToast('ConfigManager 未就绪', 'error'); return; }
        const posts = this._parse(cm.get('xb.weibo.posts'), []);
        const filtered = posts.filter(p => p.id !== postId);
        if (filtered.length === posts.length) { this.showToast('未找到该微博', 'error'); return; }
        cm.set('xb.weibo.posts', JSON.stringify(filtered));
        this.showToast('微博已删除', 'success');
        setTimeout(() => this._renderCurrentPage(), 500);
      } catch (e) {
        console.error('[WeiboUINew] 删除失败:', e);
        this.showToast('删除失败: ' + e.message, 'error');
      }
    }

    _showReplyInput(postId, commentId) {
      document.querySelectorAll('.weibo-new-reply-container').forEach(c => { c.style.display = 'none'; });
      const postEl = document.querySelector(`.weibo-new-post[data-post-id="${postId}"]`);
      if (!postEl) return;
      const container = postEl.querySelector('.weibo-new-reply-container');
      if (!container) return;
      container.style.display = 'block';
      const ta = container.querySelector('.weibo-new-reply-textarea');
      if (commentId) {
        const cEl = document.querySelector(`.weibo-new-comment-item[data-comment-id="${commentId}"]`);
        if (cEl) {
          const name = cEl.querySelector('.weibo-new-comment-author-name').textContent;
          ta.placeholder = '回复 ' + name + '...';
          ta.dataset.replyTo = name;
          ta.dataset.commentId = commentId;
        }
      } else {
        ta.placeholder = '写评论...';
        delete ta.dataset.replyTo;
        delete ta.dataset.commentId;
      }
      ta.focus();
    }

    _hideReplyInput(btn) {
      const c = btn.closest('.weibo-new-reply-container');
      if (!c) return;
      c.style.display = 'none';
      const ta = c.querySelector('.weibo-new-reply-textarea');
      ta.value = ''; ta.placeholder = '写评论...';
      delete ta.dataset.replyTo; delete ta.dataset.commentId;
    }

    async _sendReply(btn) {
      const container = btn.closest('.weibo-new-reply-container');
      const postEl = btn.closest('.weibo-new-post');
      if (!container || !postEl) return;
      const ta = container.querySelector('.weibo-new-reply-textarea');
      const content = ta.value.trim();
      if (!content) { this.showToast('请输入回复内容', 'error'); return; }
      const postId = postEl.dataset.postId;
      const replyTo = ta.dataset.replyTo;
      const commentId = ta.dataset.commentId;
      ta.value = ''; container.style.display = 'none';
      this.showToast('正在发送回复...', 'info');
      try {
        const fmt = (replyTo && commentId)
          ? `[回复|${this._getCurrentUsername()}|${postId}|回复${replyTo}：${content}]`
          : `[评论|${this._getCurrentUsername()}|${postId}|${content}]`;
        if (this._weiboManager && this._weiboManager.sendReplyToAPI) {
          await this._weiboManager.sendReplyToAPI(fmt);
          this.showToast('回复成功', 'success');
          setTimeout(() => this._renderCurrentPage(), 1000);
        } else {
          this.showToast('微博管理器未就绪', 'error');
        }
      } catch (e) {
        console.error('[WeiboUINew] 回复失败:', e);
        this.showToast('回复失败: ' + e.message, 'error');
      }
    }

    _switchAccount() {
      if (this._weiboManager && this._weiboManager.switchAccount) {
        this._weiboManager.switchAccount();
        this.showToast('账户已切换', 'success');
        setTimeout(() => this._renderCurrentPage(), 500);
      } else {
        this.showToast('微博管理器未就绪', 'error');
      }
    }

    // ── 工具方法 ──────────────────────────────────────────────

    _getCurrentUsername() {
      if (this._weiboManager && this._weiboManager.getCurrentUsername) {
        const name = this._weiboManager.getCurrentUsername();
        if (name && name !== '{{user}}') return name;
      }
      if (typeof window.name1 !== 'undefined' && window.name1 && window.name1.trim() && window.name1 !== '{{user}}') {
        return window.name1.trim();
      }
      return 'User';
    }

    _isMainAccount() {
      return (this._weiboManager && this._weiboManager.currentAccount)
        ? this._weiboManager.currentAccount.isMainAccount : true;
    }

    _matchAuthor(author, username) {
      return [username, '{{user}}', 'User'].some(n =>
        n && (author === n || author.toLowerCase() === n.toLowerCase()));
    }

    _hashStr(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
      return Math.abs(h);
    }

    _avatarColor(username) {
      if (this._matchAuthor(username, this._getCurrentUsername())) {
        return this._isMainAccount() ? '#C4B7D6' : '#A37070';
      }
      return this._avatarColors[this._hashStr(username) % this._avatarColors.length];
    }

    _avatarHTML(username, size) {
      const cls = size ? ' weibo-new-avatar-' + size : '';
      return `<div class="weibo-new-avatar${cls}" style="background:${this._avatarColor(username)}">${(username || '?')[0]}</div>`;
    }

    _formatContent(text) {
      return (text || '')
        .replace(/#([^#\s]+)#/g, '<span class="weibo-new-topic">#$1#</span>')
        .replace(/@([^\s@]+)/g, '<span class="weibo-new-mention">@$1</span>')
        .replace(/\n/g, '<br>');
    }

    _formatCommentContent(text) {
      return (text || '')
        .replace(/回复([^：]+)：/g, '<span class="weibo-new-reply-to">回复$1：</span>')
        .replace(/#([^#\s]+)#/g, '<span class="weibo-new-topic">#$1#</span>')
        .replace(/@([^\s@]+)/g, '<span class="weibo-new-mention">@$1</span>')
        .replace(/\n/g, '<br>');
    }
  }

  window.WeiboUINew = new WeiboUINew();
})();
