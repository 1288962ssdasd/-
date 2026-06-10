/**
 * FriendsCircleData - 朋友圈数据 Schema 辅助函数
 *
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数，不直接调用 Platform.setData()
 */

;(function () {
  'use strict';

  const DOMAIN = 'friendsCircle';

  /**
   * FriendsCircleData 朋友圈数据操作类
   */
  class FriendsCircleData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有朋友圈动态
     * @returns {Promise<Array>}
     */
    async getCircles() {
      return await this._get('circles', []);
    }

    /**
     * 获取我发布的朋友圈
     * @returns {Promise<Array>}
     */
    async getMyCircles() {
      return await this._get('myCircles', []);
    }

    /**
     * 获取单条朋友圈
     * @param {string} circleId
     * @returns {Promise<Object|null>}
     */
    async getById(circleId) {
      const circles = await this.getCircles();
      return circles.find(c => c.id === circleId) || null;
    }

    /**
     * 获取朋友圈设置
     * @returns {Promise<Object>}
     */
    async getSettings() {
      return await this._get('settings', {
        visibleToAll: true,
        allowComments: true,
        allowLikes: true,
      });
    }

    /**
     * 获取我的头像
     * @returns {Promise<string>}
     */
    async getMyAvatar() {
      return await this._get('myAvatar', '');
    }

    /**
     * 设置我的头像
     * @param {string} avatarUrl
     * @returns {Promise<boolean>}
     */
    async setMyAvatar(avatarUrl) {
      await this._set('myAvatar', avatarUrl);
      this._emit('friendsCircle:avatarUpdated', { avatarUrl });
      return true;
    }

    // ==================== 写入操作 ====================

    /**
     * 发布朋友圈
     * @param {Object} circle - { authorId, authorName, authorAvatar, content, images? }
     * @returns {Promise<Object>}
     */
    async publish(circle) {
      const circles = await this.getCircles();
      const myCircles = await this.getMyCircles();

      const newCircle = {
        id: this._generateId(),
        authorId: circle.authorId || 'me',
        authorName: circle.authorName || '我',
        authorAvatar: circle.authorAvatar || (await this._platform.data('friendsCircle', 'myAvatar', '')) || '',
        content: circle.content || '',
        images: circle.images || [],
        likes: [],
        comments: [],
        createdAt: Date.now(),
        time: new Date().toLocaleString('zh-CN', { 
          month: 'numeric', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
      };

      circles.unshift(newCircle);
      if ((newCircle.authorId || 'me') === 'me') {
        myCircles.unshift(newCircle);
      }

      await this._set('circles', circles);
      await this._set('myCircles', myCircles);

      this._emit('friendsCircle:published', { circle: newCircle });
      return newCircle;
    }

    /**
     * 删除朋友圈
     * @param {string} circleId
     * @returns {Promise<boolean>}
     */
    async delete(circleId) {
      const circles = await this.getCircles();
      const myCircles = await this.getMyCircles();

      const circleIndex = circles.findIndex(c => c.id === circleId);
      const myIndex = myCircles.findIndex(c => c.id === circleId);

      if (circleIndex === -1) return false;

      const removed = circles.splice(circleIndex, 1)[0];
      if (myIndex !== -1) {
        myCircles.splice(myIndex, 1);
      }

      await this._set('circles', circles);
      await this._set('myCircles', myCircles);

      this._emit('friendsCircle:deleted', { circleId, circle: removed });
      return true;
    }

    /**
     * 点赞朋友圈
     * @param {string} circleId
     * @param {string} userId
     * @param {string} userName
     * @returns {Promise<boolean>}
     */
    async like(circleId, userId, userName) {
      const circles = await this.getCircles();
      const circle = circles.find(c => c.id === circleId);

      if (!circle) return false;

      // 检查是否已点赞
      const existingLike = circle.likes.find(l => l.userId === userId);
      if (existingLike) {
        // 取消点赞
        circle.likes = circle.likes.filter(l => l.userId !== userId);
      } else {
        // 添加点赞
        circle.likes.push({
          userId,
          userName,
          timestamp: Date.now(),
        });
      }

      await this._set('circles', circles);
      this._emit('friendsCircle:liked', { circleId, userId, liked: !existingLike });
      return true;
    }

    /**
     * 评论朋友圈
     * @param {string} circleId
     * @param {Object} comment - { userId, userName, content, replyTo? }
     * @returns {Promise<Object>}
     */
    async comment(circleId, comment) {
      const circles = await this.getCircles();
      const circle = circles.find(c => c.id === circleId);

      if (!circle) return null;

      const newComment = {
        id: this._generateId(),
        userId: comment.userId || 'me',
        userName: comment.userName || '我',
        content: comment.content,
        replyTo: comment.replyTo || null, // 回复的评论ID或用户名
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };

      circle.comments.push(newComment);
      await this._set('circles', circles);

      this._emit('friendsCircle:commented', { circleId, comment: newComment });
      return newComment;
    }

    /**
     * 删除评论
     * @param {string} circleId
     * @param {string} commentId
     * @returns {Promise<boolean>}
     */
    async deleteComment(circleId, commentId) {
      const circles = await this.getCircles();
      const circle = circles.find(c => c.id === circleId);

      if (!circle) return false;

      const index = circle.comments.findIndex(c => c.id === commentId);
      if (index === -1) return false;

      const removed = circle.comments.splice(index, 1)[0];
      await this._set('circles', circles);

      this._emit('friendsCircle:commentDeleted', { circleId, commentId, comment: removed });
      return true;
    }

    /**
     * 更新设置
     * @param {Object} settings
     * @returns {Promise<boolean>}
     */
    async updateSettings(settings) {
      const current = await this.getSettings();
      await this._set('settings', { ...current, ...settings });
      this._emit('friendsCircle:settingsUpdated', { settings });
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅朋友圈变更
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    subscribeCircles(callback) {
      return this._subscribe('circles', callback);
    }

    /**
     * 订阅我的朋友圈变更
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    subscribeMyCircles(callback) {
      return this._subscribe('myCircles', callback);
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

    _emit(event, data) {
      if (this._platform?.emit) {
        this._platform.emit(event, data);
      }
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'fc_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局（通过命名空间，不直接污染 window）
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.FriendsCircle = FriendsCircleData;

  console.log('[Schema] FriendsCircleData 已加载');
})();
