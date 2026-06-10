/**
 * ForumData - 论坛数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Forum
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'forum';

  // 论坛风格常量
  const FORUM_STYLES = {
    NORMAL: 'normal',       // 普通论坛
    ANONYMOUS: 'anonymous', // 匿名论坛
    ROLEPLAY: 'roleplay',   // 角色扮演论坛
  };

  /**
   * ForumData 论坛数据操作类
   */
  class ForumData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 帖子操作 ====================

    /**
     * 获取帖子列表
     * @param {Object} options - { style?, limit? }
     * @returns {Promise<Array>}
     */
    async getPosts(options = {}) {
      const posts = await this._get('posts', []);
      let result = posts;

      // 按风格筛选
      if (options.style) {
        result = result.filter(p => p.style === options.style);
      }

      // 限制数量
      if (options.limit) {
        result = result.slice(0, options.limit);
      }

      return result;
    }

    /**
     * 获取单个帖子
     * @param {string} postId
     * @returns {Promise<Object|null>}
     */
    async getById(postId) {
      const posts = await this._get('posts', []);
      return posts.find(p => p.id === postId) || null;
    }

    /**
     * 发布帖子
     * @param {Object} post - { title, content, author?, style? }
     * @returns {Promise<Object>}
     */
    async addPost(post) {
      const posts = await this._get('posts', []);

      const newPost = {
        id: this._generateId(),
        title: post.title || '无标题',
        content: post.content || '',
        author: post.author || '匿名用户',
        authorId: post.authorId || 'anonymous',
        style: post.style || FORUM_STYLES.NORMAL,
        replies: [],
        likes: 0,
        views: 0,
        isPinned: false,
        isHot: false,
        createdAt: Date.now(),
        time: new Date().toLocaleString('zh-CN'),
      };

      posts.unshift(newPost);
      await this._set('posts', posts);

      this._emit('forum:postAdded', { post: newPost });
      return newPost;
    }

    /**
     * 删除帖子
     * @param {string} postId
     * @returns {Promise<boolean>}
     */
    async deletePost(postId) {
      const posts = await this._get('posts', []);
      const index = posts.findIndex(p => p.id === postId);

      if (index === -1) return false;

      const removed = posts.splice(index, 1)[0];
      await this._set('posts', posts);

      this._emit('forum:postDeleted', { postId, post: removed });
      return true;
    }

    /**
     * 更新帖子
     * @param {string} postId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updatePost(postId, updates) {
      const posts = await this._get('posts', []);
      const post = posts.find(p => p.id === postId);

      if (!post) return false;

      Object.assign(post, updates, { updatedAt: Date.now() });
      await this._set('posts', posts);

      this._emit('forum:postUpdated', { postId, updates });
      return true;
    }

    // ==================== 回复操作 ====================

    /**
     * 添加回复
     * @param {string} postId
     * @param {Object} reply - { content, author?, replyTo? }
     * @returns {Promise<Object|null>}
     */
    async addReply(postId, reply) {
      const posts = await this._get('posts', []);
      const post = posts.find(p => p.id === postId);

      if (!post) return null;

      const newReply = {
        id: this._generateId(),
        content: reply.content || '',
        author: reply.author || '匿名用户',
        authorId: reply.authorId || 'anonymous',
        replyTo: reply.replyTo || null,
        likes: 0,
        createdAt: Date.now(),
        time: new Date().toLocaleString('zh-CN'),
      };

      post.replies = post.replies || [];
      post.replies.push(newReply);
      await this._set('posts', posts);

      this._emit('forum:replyAdded', { postId, reply: newReply });
      return newReply;
    }

    /**
     * 删除回复
     * @param {string} postId
     * @param {string} replyId
     * @returns {Promise<boolean>}
     */
    async deleteReply(postId, replyId) {
      const posts = await this._get('posts', []);
      const post = posts.find(p => p.id === postId);

      if (!post || !post.replies) return false;

      const index = post.replies.findIndex(r => r.id === replyId);
      if (index === -1) return false;

      post.replies.splice(index, 1);
      await this._set('posts', posts);

      this._emit('forum:replyDeleted', { postId, replyId });
      return true;
    }

    // ==================== 互动操作 ====================

    /**
     * 点赞帖子
     * @param {string} postId
     * @returns {Promise<number>}
     */
    async likePost(postId) {
      const posts = await this._get('posts', []);
      const post = posts.find(p => p.id === postId);

      if (!post) return 0;

      post.likes = (post.likes || 0) + 1;
      await this._set('posts', posts);

      return post.likes;
    }

    /**
     * 点赞回复
     * @param {string} postId
     * @param {string} replyId
     * @returns {Promise<number>}
     */
    async likeReply(postId, replyId) {
      const posts = await this._get('posts', []);
      const post = posts.find(p => p.id === postId);

      if (!post || !post.replies) return 0;

      const reply = post.replies.find(r => r.id === replyId);
      if (!reply) return 0;

      reply.likes = (reply.likes || 0) + 1;
      await this._set('posts', posts);

      return reply.likes;
    }

    /**
     * 增加浏览量
     * @param {string} postId
     * @returns {Promise<number>}
     */
    async incrementViews(postId) {
      const posts = await this._get('posts', []);
      const post = posts.find(p => p.id === postId);

      if (!post) return 0;

      post.views = (post.views || 0) + 1;
      await this._set('posts', posts);

      return post.views;
    }

    // ==================== 设置操作 ====================

    /**
     * 获取论坛设置
     * @returns {Promise<Object>}
     */
    async getSettings() {
      return await this._get('settings', {
        style: FORUM_STYLES.NORMAL,
        messageThreshold: 5,
        autoGenerate: true,
        allowAnonymous: true,
      });
    }

    /**
     * 更新论坛设置
     * @param {Object} settings
     * @returns {Promise<boolean>}
     */
    async updateSettings(settings) {
      const current = await this.getSettings();
      await this._set('settings', { ...current, ...settings });
      this._emit('forum:settingsUpdated', { settings });
      return true;
    }

    /**
     * 获取当前风格
     * @returns {Promise<string>}
     */
    async getStyle() {
      const settings = await this.getSettings();
      return settings.style || FORUM_STYLES.NORMAL;
    }

    /**
     * 设置风格
     * @param {string} style
     * @returns {Promise<boolean>}
     */
    async setStyle(style) {
      return await this.updateSettings({ style });
    }

    /**
     * 获取消息阈值
     * @returns {Promise<number>}
     */
    async getThreshold() {
      const settings = await this.getSettings();
      return settings.messageThreshold || 5;
    }

    /**
     * 设置消息阈值
     * @param {number} threshold
     * @returns {Promise<boolean>}
     */
    async setThreshold(threshold) {
      return await this.updateSettings({ messageThreshold: threshold });
    }

    // ==================== 订阅 ====================

    /**
     * 订阅帖子列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribePosts(callback) {
      return this._subscribe('posts', callback);
    }

    /**
     * 订阅设置变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeSettings(callback) {
      return this._subscribe('settings', callback);
    }

    // ==================== 内部方法 ====================

        async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[Schema] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

        async _set(key, value) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }
      
      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, key, value, { persist: true });
      
      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      return this._platform.subscribeData(DOMAIN, key, callback);
    }

    /**
     * @deprecated 事件发射已迁移到 Service 层（铁则三）
     * 保留此方法以兼容旧代码调用，但不再实际发射事件
     */
    _emit(eventType, data) {
      // no-op: 事件发射由 ForumService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'forum_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Forum = ForumData;
  window.PhoneData.Forum.STYLES = FORUM_STYLES;

  console.log('[Schema] ForumData 已加载');
})();
