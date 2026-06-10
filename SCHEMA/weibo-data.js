/**
 * WeiboData - 微博数据 Schema 辅助函数
 *
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数
 */

;(function () {
  'use strict';

  const DOMAIN = 'weibo';

  /**
   * WeiboData 微博数据操作类
   */
  class WeiboData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取博文列表
     * @returns {Promise<Array>}
     */
    async getPosts() {
      return await this._get('posts', []);
    }

    /**
     * 获取单条博文
     * @param {string} postId
     * @returns {Promise<Object|null>}
     */
    async getPostById(postId) {
      const posts = await this.getPosts();
      return posts.find(p => p.id === postId) || null;
    }

    /**
     * 获取热搜列表
     * @returns {Promise<Array>}
     */
    async getHotSearches() {
      return await this._get('hotSearches', []);
    }

    /**
     * 获取排行榜
     * @returns {Promise<Array>}
     */
    async getRanking() {
      return await this._get('ranking', []);
    }

    /**
     * 获取用户统计
     * @returns {Promise<Object>}
     */
    async getUserStats() {
      return await this._get('userStats', {
        followers: 0,
        following: 0,
        posts: 0,
        likes: 0,
      });
    }

    /**
     * 获取设置
     * @returns {Promise<Object>}
     */
    async getSettings() {
      return await this._get('settings', {
        autoRefresh: true,
        refreshInterval: 30,
        showHot: true,
        showRanking: true,
      });
    }

    /**
     * 获取当前账户
     * @returns {Promise<Object>}
     */
    async getAccount() {
      return await this._get('account', {
        id: 'user_1',
        name: '用户',
        avatar: '',
        isMain: true,
      });
    }

    /**
     * 获取UI状态
     * @returns {Promise<Object>}
     */
    async getUiState() {
      return await this._get('uiState', {
        currentPage: 'hot',
        draftContent: '',
        draftImages: [],
      });
    }

    // ==================== 写入操作 ====================

    /**
     * 发布微博
     * @param {Object} post - { content, images?, author?, type? }
     * @returns {Promise<Object>}
     */
    async addPost(post) {
      // [S-11] 数据验证（仅警告，不阻止写入）
      if (window.PhoneSchemas) {
        const result = window.PhoneSchemas.validate('weibo', 'posts', post);
        if (!result.valid) {
          console.warn('[WeiboData] 数据验证警告:', result.error);
        }
      }

      const posts = await this.getPosts();
      
      const newPost = {
        id: this._generateId(),
        content: post.content,
        author: post.author || (await this.getAccount()).name,
        avatar: post.avatar || (await this.getAccount()).avatar || '',
        images: post.images || [],
        type: post.type || 'normal',
        timestamp: Date.now(),
        time: new Date().toLocaleString('zh-CN'),
        likes: 0,
        comments: 0,
        shares: 0,
        liked: false,
        commentList: [],
      };

      posts.unshift(newPost); // 新微博放前面
      await this._set('posts', posts);
      
      // 更新用户统计
      await this._incrementUserStat('posts', 1);
      
      this._emit('weibo:posted', { post: newPost });
      return newPost;
    }

    /**
     * 删除微博
     * @param {string} postId
     * @returns {Promise<boolean>}
     */
    async removePost(postId) {
      const posts = await this.getPosts();
      const index = posts.findIndex(p => p.id === postId);
      
      if (index === -1) return false;
      
      const removed = posts.splice(index, 1)[0];
      await this._set('posts', posts);
      
      // 更新用户统计
      await this._incrementUserStat('posts', -1);
      
      this._emit('weibo:deleted', { postId, post: removed });
      return true;
    }

    /**
     * 点赞微博
     * @param {string} postId
     * @returns {Promise<boolean>}
     */
    async likePost(postId) {
      const posts = await this.getPosts();
      const post = posts.find(p => p.id === postId);
      
      if (!post || post.liked) return false;
      
      post.liked = true;
      post.likes++;
      
      await this._set('posts', posts);
      await this._incrementUserStat('likes', 1);
      
      this._emit('weibo:liked', { postId });
      return true;
    }

    /**
     * 取消点赞
     * @param {string} postId
     * @returns {Promise<boolean>}
     */
    async unlikePost(postId) {
      const posts = await this.getPosts();
      const post = posts.find(p => p.id === postId);
      
      if (!post || !post.liked) return false;
      
      post.liked = false;
      post.likes = Math.max(0, post.likes - 1);
      
      await this._set('posts', posts);
      await this._incrementUserStat('likes', -1);
      
      this._emit('weibo:unliked', { postId });
      return true;
    }

    /**
     * 切换点赞状态
     * @param {string} postId
     * @returns {Promise<boolean>} 是否点赞
     */
    async togglePostLike(postId) {
      const posts = await this.getPosts();
      const post = posts.find(p => p.id === postId);
      
      if (!post) return false;
      
      if (post.liked) {
        await this.unlikePost(postId);
        return false;
      } else {
        await this.likePost(postId);
        return true;
      }
    }

    /**
     * 添加评论
     * @param {string} postId
     * @param {Object} comment - { content, author? }
     * @returns {Promise<Object>}
     */
    async addComment(postId, comment) {
      const posts = await this.getPosts();
      const post = posts.find(p => p.id === postId);
      
      if (!post) return null;
      
      const newComment = {
        id: this._generateId(),
        content: comment.content,
        author: comment.author || (await this.getAccount()).name,
        timestamp: Date.now(),
        time: new Date().toLocaleString('zh-CN'),
        likes: 0,
        liked: false,
        replies: [],
      };
      
      if (!post.commentList) post.commentList = [];
      post.commentList.push(newComment);
      post.comments++;
      
      await this._set('posts', posts);
      
      this._emit('weibo:commented', { postId, comment: newComment });
      return newComment;
    }

    /**
     * 转发微博
     * @param {string} postId
     * @param {string} extraContent
     * @returns {Promise<Object>}
     */
    /** @deprecated 业务逻辑已迁移到 WeiboService，请通过 Service 层调用 */
    async repost(postId, extraContent = '') {
      const posts = await this.getPosts();
      const originalPost = posts.find(p => p.id === postId);
      
      if (!originalPost) return null;
      
      const repostContent = extraContent
        ? `${extraContent} //@${originalPost.author}: ${originalPost.content}`
        : `转发微博 //@${originalPost.author}: ${originalPost.content}`;
      
      const newPost = await this.addPost({
        content: repostContent,
        type: 'repost',
        originalPostId: postId,
      });
      
      // 更新原微博转发数
      originalPost.shares = (originalPost.shares || 0) + 1;
      await this._set('posts', posts);
      
      this._emit('weibo:reposted', { postId, newPostId: newPost.id });
      return newPost;
    }

    /**
     * 更新设置
     * @param {Object} settings
     * @returns {Promise<boolean>}
     */
    async updateSettings(settings) {
      const current = await this.getSettings();
      await this._set('settings', { ...current, ...settings });
      this._emit('weibo:settingsUpdated', { settings });
      return true;
    }

    /**
     * 更新账户信息
     * @param {Object} account
     * @returns {Promise<boolean>}
     */
    async updateAccount(account) {
      const current = await this.getAccount();
      await this._set('account', { ...current, ...account });
      this._emit('weibo:accountChanged', { account });
      return true;
    }

    /**
     * 更新UI状态
     * @param {Object} state
     * @returns {Promise<boolean>}
     */
    async updateUiState(state) {
      const current = await this.getUiState();
      await this._set('uiState', { ...current, ...state });
      return true;
    }

    /**
     * 保存草稿
     * @param {string} content
     * @param {Array} images
     * @returns {Promise<boolean>}
     */
    async saveDraft(content, images = []) {
      return await this.updateUiState({
        draftContent: content,
        draftImages: images,
      });
    }

    /**
     * 清空草稿
     * @returns {Promise<boolean>}
     */
    async clearDraft() {
      return await this.updateUiState({
        draftContent: '',
        draftImages: [],
      });
    }

    /**
     * 更新热搜
     * @param {Array} hotSearches
     * @returns {Promise<boolean>}
     */
    async updateHotSearches(hotSearches) {
      await this._set('hotSearches', hotSearches);
      this._emit('weibo:hotSearchesUpdated', { hotSearches });
      return true;
    }

    /**
     * 更新排行榜
     * @param {Array} ranking
     * @returns {Promise<boolean>}
     */
    async updateRanking(ranking) {
      await this._set('ranking', ranking);
      this._emit('weibo:rankingUpdated', { ranking });
      return true;
    }

    // ==================== 订阅 ====================

    subscribePosts(callback) {
      return this._subscribe('posts', callback);
    }

    subscribeHotSearches(callback) {
      return this._subscribe('hotSearches', callback);
    }

    subscribeSettings(callback) {
      return this._subscribe('settings', callback);
    }

    subscribeAccount(callback) {
      return this._subscribe('account', callback);
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

    /** @deprecated 业务逻辑已迁移到 WeiboService，请通过 Service 层调用 */
    async _incrementUserStat(key, delta) {
      const stats = await this.getUserStats();
      stats[key] = (stats[key] || 0) + delta;
      await this._set('userStats', stats);
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
      // no-op: 事件发射由 WeiboService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'wb_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Weibo = WeiboData;

  console.log('[Schema] WeiboData 已加载');
})();
