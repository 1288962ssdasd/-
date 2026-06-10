/**
 * WeiboService - 微博业务逻辑
 * 纯数据操作，无 DOM，无渲染
 */

;(function () {
  'use strict';

  class WeiboService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._weiboData = new (window.PhoneData?.Weibo || function(){})(this._platform);
      this._aiService = null;
      this._mediaService = null;
    }

    /** [延迟初始化] 获取 AI 服务 */
    _getAIService() {
      if (!this._aiService) {
        try {
          this._aiService = this._platform?.get?.('aiService') || null;
        } catch (e) {
          console.warn('[WeiboService] 获取 AIService 失败:', e);
        }
      }
      return this._aiService;
    }

    /** [延迟初始化] 获取媒体服务 */
    _getMediaService() {
      if (!this._mediaService) {
        try {
          this._mediaService = this._platform?.get?.('mediaLocalService') || null;
        } catch (e) {
          console.warn('[WeiboService] 获取 MediaLocalService 失败:', e);
        }
      }
      return this._mediaService;
    }

    /** [新增] 从IMAGES文件夹获取随机图片 */
    async _getRandomImage() {
      try {
        const media = this._getMediaService();
        if (media?.getRandomImageFromFolder) {
          const url = await media.getRandomImageFromFolder();
          if (url) return url;
        }
      } catch (e) {
        console.warn('[WeiboService] _getRandomImage 通过 MediaLocalService 获取失败:', e);
      }
      // 降级：使用硬编码文件清单随机选取
      return this._getRandomImageFallback();
    }

    /** [降级] 从硬编码文件清单随机获取图片URL */
    _getRandomImageFallback() {
      try {
        const MediaData = window.PhoneData?.Media;
        if (MediaData) {
          const md = new MediaData(this._platform);
          const files = md.scanImagesFolder();
          if (files && files.length > 0) {
            const randomFile = files[Math.floor(Math.random() * files.length)];
            const baseUrl = md.imagesFolderUrl || './scripts/extensions/third-party/mobile/IMAGES/';
            return baseUrl + randomFile;
          }
        }
      } catch (e) {
        console.warn('[WeiboService] _getRandomImageFallback 失败:', e);
      }
      return '';
    }

    // ==================== 读取操作 ====================

    /**
     * 获取微博列表
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getPosts(limit = 50) {
      const posts = await this._weiboData.getPosts();
      // 防御性编程：确保返回数组
      if (!Array.isArray(posts)) {
        console.warn('[WeiboService] getPosts 返回非数组:', posts);
        return [];
      }
      return posts.slice(0, limit);
    }

    /**
     * 获取我的微博
     * @returns {Promise<Array>}
     */
    async getMyPosts() {
      const posts = await this._weiboData.getPosts();
      // 防御性编程：确保返回数组
      if (!Array.isArray(posts)) {
        console.warn('[WeiboService] getPosts 返回非数组:', posts);
        return [];
      }
      const account = await this._weiboData.getAccount();
      return posts.filter(p => p.author === account.name);
    }

    /**
     * 获取单条微博
     * @param {string} postId
     * @returns {Promise<Object|null>}
     */
    async getPost(postId) {
      return await this._weiboData.getPostById(postId);
    }

    /**
     * 获取热搜列表
     * @returns {Promise<Array>}
     */
    async getHotSearches() {
      return await this._weiboData.getHotSearches();
    }

    /**
     * 获取用户统计
     * @returns {Promise<Object>}
     */
    async getUserStats() {
      return await this._weiboData.getUserStats();
    }

    // ==================== 写入操作 ====================

    /**
     * 发布微博
     * @param {string} content
     * @param {Object} options - { images?, type? }
     * @returns {Promise<Object>}
     */
    async publish(content, options = {}) {
      if (!content?.trim()) {
        console.warn('[WeiboService] publish: 微博内容不能为空');
        return null;
      }

      const post = {
        content: content.trim(),
        images: options.images || [],
        type: options.type || 'normal',
      };

      const result = await this._weiboData.addPost(post);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('weibo:published', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'weibo:published',
          data: { postId: result.id || result, content: content.trim() },
          timestamp: Date.now(),
          source: 'weibo-service'
        });
      }

      return result;
    }

    /**
     * AI 生成并发布微博
     * @returns {Promise<Object>}
     */
    async publishAI() {
      const content = await this._getAIService()?.generateWeibo();
      
      if (!content) {
        console.warn('[WeiboService] publishAI: AI 生成失败');
        return null;
      }

      // [新增] 50%概率附带随机图片
      let images = [];
      if (Math.random() < 0.5) {
        const img = await this._getRandomImage();
        if (img) images = [img];
      }

      return await this.publish(content, images);
    }

    /**
     * 点赞/取消点赞
     * @param {string} postId
     * @returns {Promise<Object>}
     */
    async toggleLike(postId) {
      const result = await this._weiboData.togglePostLike(postId);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('weibo:likeToggled', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'weibo:likeToggled',
          data: { postId, liked: result?.liked },
          timestamp: Date.now(),
          source: 'weibo-service'
        });
      }

      return result;
    }

    /**
     * 评论
     * @param {string} postId
     * @param {string} content
     * @param {Object} options - { replyTo? }
     * @returns {Promise<Object>}
     */
    async comment(postId, content, options = {}) {
      if (!content?.trim()) {
        console.warn('[WeiboService] comment: 评论内容不能为空');
        return null;
      }

      const result = await this._weiboData.addComment(postId, {
        content: content.trim(),
        replyTo: options.replyTo,
      });

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('weibo:commented', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'weibo:commented',
          data: { postId, commentId: result.id || result },
          timestamp: Date.now(),
          source: 'weibo-service'
        });
      }

      return result;
    }

    /**
     * AI 生成评论
     * @param {string} postId
     * @returns {Promise<Object>}
     */
    async commentAI(postId) {
      const post = await this._weiboData.getPostById(postId);
      if (!post) {
        console.warn('[WeiboService] commentAI: 微博不存在');
        return null;
      }

      const content = await this._getAIService()?.generateWeiboComment(post.content);
      
      if (!content) {
        console.warn('[WeiboService] commentAI: AI 生成失败');
        return null;
      }

      return await this.comment(postId, content);
    }

    /**
     * 转发微博
     * @param {string} postId
     * @param {string} reason
     * @returns {Promise<Object>}
     */
    async repost(postId, reason) {
      const post = await this._weiboData.getPostById(postId);
      if (!post) {
        console.warn('[WeiboService] repost: 微博不存在');
        return null;
      }

      const result = await this._weiboData.repost(postId, reason?.trim() || '');

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('weibo:reposted', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'weibo:reposted',
          data: { postId, originalPostId: post.id || postId },
          timestamp: Date.now(),
          source: 'weibo-service'
        });
      }

      return result;
    }

    /**
     * 删除微博
     * @param {string} postId
     * @returns {Promise<boolean>}
     */
    async delete(postId) {
      const result = await this._weiboData.removePost(postId);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('weibo:deleted', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'weibo:deleted',
          data: { postId },
          timestamp: Date.now(),
          source: 'weibo-service'
        });
      }

      return result;
    }

    /**
     * 导演/事件分发：发布帖子（兼容 addPost）
     */
    async addPost(post) {
      try {
        if (!post?.content?.trim()) return null;
        return await this._weiboData.addPost({
          content: post.content.trim(),
          author: post.author || post.authorName || '世界新闻',
          avatar: post.avatar || '',
          images: post.images || [],
          type: post.type || 'news',
        });
      } catch (e) {
        console.warn('[WeiboService] addPost 失败:', e);
        return null;
      }
    }

    /**
     * 更新热搜榜
     * @param {Array} items - [{ title, heat?, tag? }]
     */
    async updateHotSearches(items) {
      try {
        const list = (items || []).map((item, i) => ({
          title: item.title || item.name || String(item),
          heat: item.heat != null ? item.heat : Math.max(10, 500 - i * 37),
          tag: item.tag || (i < 3 ? '沸' : i < 6 ? '热' : ''),
        }));
        await this._weiboData.updateHotSearches(list);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('weibo:hotSearchesUpdated', {
            id: 'evt_' + Date.now(),
            type: 'weibo:hotSearchesUpdated',
            data: { hotSearches: list },
            timestamp: Date.now(),
            source: 'weibo-service',
          });
        }
        return list;
      } catch (e) {
        console.warn('[WeiboService] updateHotSearches 失败:', e);
        return [];
      }
    }

    // ==================== 订阅 ====================

    /**
     * 订阅微博列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribePosts(callback) {
      return this._weiboData.subscribePosts(callback);
    }

    /**
     * 订阅用户统计变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeUserStats(callback) {
      return this._weiboData.subscribeAccount(callback);
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Weibo = WeiboService;

  console.log('[Service] WeiboService 已加载');
})();
