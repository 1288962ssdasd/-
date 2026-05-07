/**
 * ForumUINew - 论坛 UI 重写模块
 * 继承 ContextDrivenApp 基类，复用旧 ForumManager 的 API 调用能力
 * 使用 CSS 类名前缀 forum-new- 避免与旧版冲突
 */
;(function () {
  'use strict';

  const AVATAR_COLORS = [
    'linear-gradient(to top, #fad0c4 0%, #ffd1ff 100%)',
    '#b28cb9', '#e2b3d4', '#f7d1e6', '#d49ec2',
    '#f3c6d7', '#ec97b7', '#d66a88', '#b74d66',
    '#e3d6a7', '#c8ac6d', '#a0d8e1', '#2e8b9b',
    '#1a6369', '#0e3d45', '#6ba1e1', '#1f5e8d',
    '#b7d3a8', '#3e7b41', '#f9e79f', '#a3b4e2',
  ];

  class ForumUINew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'ForumUINew' });
      this._forumManager = null;
      this._configManager = null;
      this._currentThreadId = null;
      this._likesData = {};
      this._replyLikesData = {};
      this._clickHandler = null;
      this._likeHandler = null;
    }

    // ───────── 生命周期 ─────────

    onInit() {
      this._forumManager = this.getService('forumManager');
      this._configManager = this.getService('configManager');
      console.log('[ForumUINew] 初始化完成, forumManager=', !!this._forumManager);
    }

    onDestroy() {
      this._removeDocumentListeners();
    }

    // ───────── 数据访问 ─────────

    /** 从 ConfigManager 读取帖子列表 */
    async _loadData() {
      try {
        const raw = this._configManager
          ? await this._configManager.get('xb.forum.threads')
          : await ConfigManager.get('xb.forum.threads');
        if (!raw) return [];
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('[ForumUINew] 读取论坛数据失败:', e);
        return [];
      }
    }

    /** 保存帖子列表到 ConfigManager */
    async _saveData(threads) {
      const json = JSON.stringify(threads);
      if (this._configManager) {
        await this._configManager.set('xb.forum.threads', json);
      } else if (typeof ConfigManager !== 'undefined') {
        await ConfigManager.set('xb.forum.threads', json);
      }
    }

    /** 计算数据哈希，用于变更检测 */
    _computeDataHash() {
      // 简易哈希：取 threads JSON 长度 + 首帖 id
      if (!this._threads) return '';
      return `${this._threads.length}:${this._threads[0] ? this._threads[0].id : ''}`;
    }

    // ───────── 渲染 ─────────

    /** 返回论坛主界面 HTML */
    async getAppContent() {
      this._threads = await this._loadData();
      this._dataHash = this._computeDataHash();
      return `
        <div class="forum-new-app">
          <div class="forum-new-content" id="forum-new-content">
            ${this._renderThreadList(this._threads)}
          </div>
          ${this._renderPostDialog()}
        </div>`;
    }

    /** 渲染帖子列表 */
    _renderThreadList(threads) {
      if (!threads || threads.length === 0) {
        return `
          <div class="forum-new-empty">
            <div class="forum-new-empty-icon">&#x1F4AC;</div>
            <div class="forum-new-empty-text">暂无帖子</div>
            <div class="forum-new-empty-hint">点击发帖按钮开始讨论</div>
          </div>`;
      }

      const sorted = this._sortByLatestActivity(threads);
      return sorted.map(t => this._renderThreadCard(t)).join('');
    }

    /** 按最新活动时间排序 */
    _sortByLatestActivity(threads) {
      const latestTime = (thread) => {
        let t = new Date(thread.timestamp || Date.now());
        (thread.replies || []).forEach(r => {
          const rt = new Date(r.timestamp || Date.now());
          if (rt > t) t = rt;
          (r.subReplies || []).forEach(sr => {
            const srt = new Date(sr.timestamp || Date.now());
            if (srt > t) t = srt;
          });
        });
        return t;
      };
      return threads.slice().sort((a, b) => latestTime(b) - latestTime(a));
    }

    /** 渲染单个帖子卡片 */
    _renderThreadCard(thread) {
      const avatar = this._avatarHTML(thread.author);
      const likeInfo = this._getLikeInfo(thread.id);
      const replyCount = (thread.replies || []).length;
      return `
        <div class="forum-new-thread" data-thread-id="${thread.id}">
          <div class="forum-new-thread-header">
            ${avatar}
            <div class="forum-new-thread-author">
              <div class="forum-new-author-name">${this._esc(thread.author)}</div>
            </div>
            <div class="forum-new-thread-id">t${this._esc(thread.id)}</div>
            <button class="forum-new-delete-btn" data-thread-id="${thread.id}">删除</button>
          </div>
          <div class="forum-new-post-content">
            <div class="forum-new-thread-title">${this._esc(thread.title)}</div>
            <div class="forum-new-thread-body">${this._formatContent(thread.content)}</div>
          </div>
          <div class="forum-new-thread-actions">
            <button class="forum-new-action-btn forum-new-like-btn" data-thread-id="${thread.id}">
              <i class="${likeInfo.isLiked ? 'fas' : 'far'} fa-heart"></i> ${likeInfo.count}
            </button>
            <button class="forum-new-action-btn forum-new-comment-btn" data-thread-id="${thread.id}">
              <i class="far fa-comment-dots"></i> ${replyCount}
            </button>
          </div>
        </div>`;
    }

    /** 渲染帖子详情 */
    _renderThreadDetail(thread) {
      const avatar = this._avatarHTML(thread.author, 'large');
      const likeInfo = this._getLikeInfo(thread.id);
      const replies = thread.replies || [];
      return `
        <div class="forum-new-detail">
          <div class="forum-new-detail-post">
            <div class="forum-new-detail-header">
              ${avatar}
              <div class="forum-new-author-info">
                <span class="forum-new-author-name">${this._esc(thread.author)}</span>
              </div>
            </div>
            <div class="forum-new-detail-title">${this._esc(thread.title)}</div>
            <div class="forum-new-detail-body">${this._formatContent(thread.content)}</div>
            <div class="forum-new-detail-actions">
              <button class="forum-new-action-btn forum-new-like-btn" data-thread-id="${thread.id}">
                <i class="${likeInfo.isLiked ? 'fas' : 'far'} fa-heart"></i> ${likeInfo.count}
              </button>
              <button class="forum-new-action-btn"><i class="far fa-comment-dots"></i> ${replies.length}</button>
            </div>
          </div>
          <div class="forum-new-reply-list">
            <div class="forum-new-reply-header">全部回复 (${replies.length})</div>
            ${this._renderReplies(replies)}
          </div>
          <div class="forum-new-reply-bar">
            <input type="text" class="forum-new-reply-input" id="forum-new-reply-input" placeholder="留下你的想法">
            <button class="forum-new-send-btn" id="forum-new-send-reply"><i class="fas fa-paper-plane"></i></button>
          </div>
        </div>`;
    }

    /** 渲染回复列表 */
    _renderReplies(replies) {
      if (!replies.length) {
        return `<div class="forum-new-no-reply">暂无回复，来抢沙发吧</div>`;
      }
      return replies.map((r, i) => {
        const floor = i + 2;
        const rLike = this._getReplyLikeInfo(r.id);
        return `
          <div class="forum-new-reply-item" data-reply-id="${r.id}" data-floor="${floor}">
            <div class="forum-new-reply-top">
              <div class="forum-new-reply-author">
                ${this._avatarHTML(r.author)}
                <div class="forum-new-author-info">
                  <span class="forum-new-author-name">${this._esc(r.author)}</span>
                </div>
              </div>
              <span class="forum-new-floor">${floor}楼</span>
            </div>
            <div class="forum-new-reply-body">${this._formatContent(r.content)}</div>
            <div class="forum-new-reply-actions">
              <button class="forum-new-action-btn forum-new-reply-like-btn" data-reply-id="${r.id}">
                <i class="${rLike.isLiked ? 'fas' : 'far'} fa-heart"></i> ${rLike.count}
              </button>
              <button class="forum-new-action-btn forum-new-sub-reply-btn" data-reply-id="${r.id}" data-parent-author="${this._esc(r.author)}" data-floor="${floor}">
                <i class="fas fa-reply"></i> 回复
              </button>
            </div>
            <div class="forum-new-sub-reply-box" id="forum-new-sub-${r.id}" style="display:none">
              <div class="forum-new-sub-reply-target">回复 ${this._esc(r.author)}:</div>
              <textarea class="forum-new-sub-reply-textarea" rows="2" placeholder="写下你的回复..."></textarea>
              <div class="forum-new-sub-reply-actions">
                <button class="forum-new-cancel-sub" data-reply-id="${r.id}">取消</button>
                <button class="forum-new-submit-sub" data-reply-id="${r.id}" data-parent-author="${this._esc(r.author)}" data-floor="${floor}">发送</button>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    /** 发帖对话框 HTML */
    _renderPostDialog() {
      return `
        <div class="forum-new-dialog" id="forum-new-dialog" style="display:none">
          <div class="forum-new-overlay" id="forum-new-overlay"></div>
          <div class="forum-new-dialog-box">
            <div class="forum-new-dialog-head">
              <h3>发新帖</h3>
              <button class="forum-new-close-btn" id="forum-new-close-dialog">&times;</button>
            </div>
            <div class="forum-new-dialog-body">
              <input type="text" class="forum-new-title-input" id="forum-new-post-title" placeholder="请输入帖子标题...">
              <textarea class="forum-new-content-input" id="forum-new-post-content" placeholder="分享你的想法..."></textarea>
            </div>
            <div class="forum-new-dialog-foot">
              <button class="forum-new-cancel-btn" id="forum-new-cancel-post">取消</button>
              <button class="forum-new-submit-btn" id="forum-new-submit-post">发布</button>
            </div>
          </div>
        </div>`;
    }

    // ───────── 事件绑定 ─────────

    bindEvents() {
      this._removeDocumentListeners();

      // 帖子列表点击委托
      this._clickHandler = (e) => this._handleClick(e);
      document.addEventListener('click', this._clickHandler);

      // 点赞委托
      this._likeHandler = (e) => this._handleLike(e);
      document.addEventListener('click', this._likeHandler);

      // 发帖按钮（头部导航栏）
      const newPostBtn = document.getElementById('new-post-btn');
      if (newPostBtn) newPostBtn.addEventListener('click', () => this._showDialog());

      // 刷新按钮
      const refreshBtn = document.getElementById('refresh-forum-btn');
      if (refreshBtn) refreshBtn.addEventListener('click', () => this._refresh());

      // 发帖对话框
      this._bindDialogEvents();

      // 回复发送
      this._bindReplyEvents();
    }

    _removeDocumentListeners() {
      if (this._clickHandler) {
        document.removeEventListener('click', this._clickHandler);
        this._clickHandler = null;
      }
      if (this._likeHandler) {
        document.removeEventListener('click', this._likeHandler);
        this._likeHandler = null;
      }
    }

    /** 统一点击处理 */
    _handleClick(e) {
      // 删除帖子
      const delBtn = e.target.closest('.forum-new-delete-btn');
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        this._deleteThread(delBtn.dataset.threadId);
        return;
      }

      // 帖子卡片 → 查看详情
      const card = e.target.closest('.forum-new-thread');
      if (card && !e.target.closest('.forum-new-action-btn') && !e.target.closest('.forum-new-delete-btn')) {
        this._showDetail(card.dataset.threadId);
        return;
      }

      // 评论按钮 → 显示输入框
      const commentBtn = e.target.closest('.forum-new-comment-btn');
      if (commentBtn) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleReplyBar();
        return;
      }

      // 楼中楼回复按钮
      const subBtn = e.target.closest('.forum-new-sub-reply-btn');
      if (subBtn) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleSubReplyBox(subBtn.dataset.replyId);
        return;
      }

      // 取消楼中楼
      const cancelSub = e.target.closest('.forum-new-cancel-sub');
      if (cancelSub) {
        e.preventDefault();
        this._hideSubReplyBox(cancelSub.dataset.replyId);
        return;
      }

      // 提交楼中楼
      const submitSub = e.target.closest('.forum-new-submit-sub');
      if (submitSub) {
        e.preventDefault();
        this._submitSubReply(submitSub);
        return;
      }
    }

    /** 点赞处理 */
    _handleLike(e) {
      const threadLike = e.target.closest('.forum-new-like-btn[data-thread-id]');
      if (threadLike) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleLike(threadLike.dataset.threadId);
        return;
      }

      const replyLike = e.target.closest('.forum-new-reply-like-btn[data-reply-id]');
      if (replyLike) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleReplyLike(replyLike.dataset.replyId);
        return;
      }
    }

    /** 绑定发帖对话框事件 */
    _bindDialogEvents() {
      const close = () => this._hideDialog();
      const closeBtn = document.getElementById('forum-new-close-dialog');
      const cancelBtn = document.getElementById('forum-new-cancel-post');
      const overlay = document.getElementById('forum-new-overlay');
      [closeBtn, cancelBtn, overlay].forEach(el => {
        if (el) el.addEventListener('click', close);
      });

      const submitBtn = document.getElementById('forum-new-submit-post');
      if (submitBtn) submitBtn.addEventListener('click', () => this._submitPost());
    }

    /** 绑定回复发送事件 */
    _bindReplyEvents() {
      const sendBtn = document.getElementById('forum-new-send-reply');
      if (sendBtn) {
        sendBtn.addEventListener('click', () => this._submitMainReply());
      }
      const replyInput = document.getElementById('forum-new-reply-input');
      if (replyInput) {
        replyInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this._submitMainReply();
        });
      }
    }

    // ───────── 业务操作 ─────────

    /** 发帖 */
    async _submitPost() {
      const titleEl = document.getElementById('forum-new-post-title');
      const contentEl = document.getElementById('forum-new-post-content');
      const title = titleEl ? titleEl.value.trim() : '';
      const content = contentEl ? contentEl.value.trim() : '';

      if (!title || !content) {
        this.showToast('请填写标题和内容', 'warn');
        return;
      }

      this._hideDialog();

      const postFormat = `[标题|我|帖子|${title}|${content}]`;
      this.showToast('帖子已发布', 'success');

      if (this._forumManager && this._forumManager.sendPostToAPI) {
        try {
          await this._forumManager.sendPostToAPI(postFormat);
          setTimeout(() => this._refresh(), 1000);
        } catch (err) {
          console.error('[ForumUINew] 发帖失败:', err);
          this.showToast('发帖失败，请重试', 'error');
        }
      } else {
        this.showToast('发帖功能不可用', 'error');
      }
    }

    /** 提交主回复 */
    async _submitMainReply() {
      const input = document.getElementById('forum-new-reply-input');
      if (!input) return;
      const content = input.value.trim();
      if (!content) {
        this.showToast('请输入回复内容', 'warn');
        return;
      }

      input.value = '';
      this._hideReplyBar();

      const threads = await this._loadData();
      const thread = threads.find(t => t.id === this._currentThreadId);
      if (!thread) {
        this.showToast('无法找到当前帖子', 'error');
        return;
      }

      const prefix = `我回复帖子'${thread.author}|${thread.id}|${thread.title}'`;
      const replyFormat = `[回复|我|${this._currentThreadId}|${content}]`;
      const fullReply = `${prefix}\n${replyFormat}`;

      this.showToast('回复已发送', 'success');

      if (this._forumManager && this._forumManager.sendReplyToAPI) {
        try {
          await this._forumManager.sendReplyToAPI(fullReply);
          setTimeout(() => this._refresh(), 500);
        } catch (err) {
          console.error('[ForumUINew] 回复失败:', err);
          this.showToast('回复失败，请重试', 'error');
        }
      } else {
        this.showToast('回复功能不可用', 'error');
      }
    }

    /** 提交楼中楼回复 */
    async _submitSubReply(btn) {
      const replyId = btn.dataset.replyId;
      const parentAuthor = btn.dataset.parentAuthor;
      const parentFloor = btn.dataset.floor;
      const box = document.getElementById(`forum-new-sub-${replyId}`);
      if (!box) return;

      const textarea = box.querySelector('.forum-new-sub-reply-textarea');
      const content = textarea ? textarea.value.trim() : '';
      if (!content) {
        this.showToast('请输入回复内容', 'warn');
        return;
      }

      this._hideSubReplyBox(replyId);

      const prefix = `我回复评论'${parentAuthor}|${this._currentThreadId}|${content}'`;
      const replyFormat = `[回复|我|${this._currentThreadId}|回复${parentAuthor}：${content}]`;
      const fullReply = `${prefix}\n${replyFormat}`;

      this.showToast('回复已发送', 'success');

      if (this._forumManager && this._forumManager.sendReplyToAPI) {
        try {
          await this._forumManager.sendReplyToAPI(fullReply);
          setTimeout(() => this._refresh(), 500);
        } catch (err) {
          console.error('[ForumUINew] 楼中楼回复失败:', err);
          this.showToast('回复失败，请重试', 'error');
        }
      } else {
        this.showToast('回复功能不可用', 'error');
      }
    }

    /** 点赞帖子 */
    _toggleLike(threadId) {
      const info = this._getLikeInfo(threadId);
      if (info.isLiked) {
        info.count--;
        info.isLiked = false;
      } else {
        info.count++;
        info.isLiked = true;
      }
      this._updateLikeButtons(`.forum-new-like-btn[data-thread-id="${threadId}"]`, info);
    }

    /** 点赞回复 */
    _toggleReplyLike(replyId) {
      const info = this._getReplyLikeInfo(replyId);
      if (info.isLiked) {
        info.count--;
        info.isLiked = false;
      } else {
        info.count++;
        info.isLiked = true;
      }
      this._updateLikeButtons(`.forum-new-reply-like-btn[data-reply-id="${replyId}"]`, info);
    }

    /** 更新点赞按钮 DOM */
    _updateLikeButtons(selector, info) {
      document.querySelectorAll(selector).forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = `${info.isLiked ? 'fas' : 'far'} fa-heart`;
          icon.style.color = info.isLiked ? '#e74c3c' : '';
        }
        // 更新文本节点
        const nodes = btn.childNodes;
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].nodeType === Node.TEXT_NODE) {
            nodes[i].textContent = ` ${info.count}`;
            break;
          }
        }
        btn.classList.toggle('forum-new-liked', info.isLiked);
      });
    }

    /** 删除帖子 */
    async _deleteThread(threadId) {
      if (!confirm(`确定要删除帖子 t${threadId} 及其所有回复吗？此操作不可撤销。`)) return;

      try {
        const threads = await this._loadData();
        const filtered = threads.filter(t => String(t.id) !== String(threadId));
        await this._saveData(filtered);
        this.showToast('帖子已删除', 'success');
        setTimeout(() => this._refresh(), 300);
      } catch (err) {
        console.error('[ForumUINew] 删除失败:', err);
        this.showToast('删除失败: ' + err.message, 'error');
      }
    }

    /** 刷新：重新读取数据并 render */
    async _refresh() {
      this._threads = await this._loadData();
      this._dataHash = this._computeDataHash();
      this._currentThreadId = null;
      this.render();
    }

    /** 查看帖子详情 */
    async _showDetail(threadId) {
      this._currentThreadId = threadId;
      const threads = await this._loadData();
      const thread = threads.find(t => String(t.id) === String(threadId));
      if (!thread) {
        this.showToast('帖子不存在', 'error');
        return;
      }

      // 推送状态
      if (window.mobilePhone && window.mobilePhone.pushAppState) {
        window.mobilePhone.pushAppState({
          app: 'forum',
          title: '帖子详情',
          view: 'threadDetail',
          threadId,
        });
      }

      const content = document.getElementById('forum-new-content');
      if (content) {
        content.innerHTML = this._renderThreadDetail(thread);
        this._bindReplyEvents();
      }
    }

    // ───────── 对话框 / 输入框 ─────────

    _showDialog() {
      const dialog = document.getElementById('forum-new-dialog');
      if (dialog) dialog.style.display = 'flex';
      const titleEl = document.getElementById('forum-new-post-title');
      const contentEl = document.getElementById('forum-new-post-content');
      if (titleEl) titleEl.value = '';
      if (contentEl) contentEl.value = '';
    }

    _hideDialog() {
      const dialog = document.getElementById('forum-new-dialog');
      if (dialog) dialog.style.display = 'none';
    }

    _toggleReplyBar() {
      const bar = document.querySelector('.forum-new-reply-bar');
      if (bar) {
        bar.classList.toggle('forum-new-show');
        if (bar.classList.contains('forum-new-show')) {
          const input = bar.querySelector('input');
          if (input) setTimeout(() => input.focus(), 100);
        }
      }
    }

    _hideReplyBar() {
      const bar = document.querySelector('.forum-new-reply-bar');
      if (bar) bar.classList.remove('forum-new-show');
    }

    _toggleSubReplyBox(replyId) {
      // 先隐藏所有
      document.querySelectorAll('.forum-new-sub-reply-box').forEach(el => el.style.display = 'none');
      const box = document.getElementById(`forum-new-sub-${replyId}`);
      if (box) {
        box.style.display = 'block';
        const ta = box.querySelector('textarea');
        if (ta) ta.focus();
      }
    }

    _hideSubReplyBox(replyId) {
      const box = document.getElementById(`forum-new-sub-${replyId}`);
      if (box) {
        box.style.display = 'none';
        const ta = box.querySelector('textarea');
        if (ta) ta.value = '';
      }
    }

    // ───────── 工具方法 ─────────

    /** 获取帖子点赞信息 */
    _getLikeInfo(threadId) {
      if (!this._likesData[threadId]) {
        this._likesData[threadId] = {
          count: Math.floor(Math.random() * 50) + 10,
          isLiked: false,
        };
      }
      return this._likesData[threadId];
    }

    /** 获取回复点赞信息 */
    _getReplyLikeInfo(replyId) {
      if (!this._replyLikesData[replyId]) {
        this._replyLikesData[replyId] = {
          count: Math.floor(Math.random() * 10) + 1,
          isLiked: false,
        };
      }
      return this._replyLikesData[replyId];
    }

    /** 生成头像 HTML */
    _avatarHTML(username, size) {
      const hash = this._hashStr(username || '?');
      const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
      const initial = (username || '?')[0];
      const sizeClass = size === 'large' ? ' forum-new-avatar-lg' : '';
      return `<div class="forum-new-avatar${sizeClass}" style="background:${color}">${initial}</div>`;
    }

    /** 简易字符串哈希 */
    _hashStr(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      }
      return Math.abs(h);
    }

    /** HTML 转义 */
    _esc(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /** 格式化内容文本 */
    _formatContent(content) {
      if (!content) return '';
      let s = content;
      s = s.replace(/表情:\s*([^,\s]+)/g, '<span class="forum-new-emoji">[$1]</span>');
      s = s.replace(/@([^\s]+)/g, '<span class="forum-new-mention">@$1</span>');
      s = s.replace(/\n/g, '<br>');
      return s;
    }
  }

  window.ForumUINew = new ForumUINew();
  console.log('[ForumUINew] 模块加载完成');
})();
