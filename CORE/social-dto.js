/**
 * @layer CORE
 * @file   social-dto.js
 * @depends (无外部依赖)
 * @emits  (无)
 *
 * 职责: 社交数据标准化转换器，将朋友圈/微博/论坛/直播四种Schema的异构数据转换为统一格式
 * 禁止: 包含业务逻辑、调用Service、操作DOM、直接读写DataStore
 *
 * 统一格式:
 * {
 *   id: string,
 *   sourceType: 'moment' | 'weibo' | 'forum' | 'live',
 *   author: { id: string, name: string, avatar: string },
 *   content: string,
 *   timestamp: number,
 *   engagement: { likes: number, comments: number, commentList: Array },
 *   // 以下为可选扩展字段
 *   raw: Object,           // 原始数据引用
 *   images: Array,         // 图片列表
 *   title: string,         // 标题（论坛帖子）
 *   extra: Object          // 其他扩展信息
 * }
 *
 * [铁则合规]
 * - 铁则三: 纯数据转换层，不包含业务逻辑
 * - 铁则九: 所有方法有防御性处理，不抛出异常
 */

;(function () {
  'use strict';

  // 支持的来源类型
  var SOURCE_TYPES = {
    MOMENT: 'moment',
    WEIBO: 'weibo',
    FORUM: 'forum',
    LIVE: 'live',
  };

  /**
   * SocialDTO - 社交数据标准化转换器
   */
  var SocialDTO = {
    SOURCE_TYPES: SOURCE_TYPES,

    /**
     * 将异构社交数据转换为统一格式
     * @param {string} sourceType - 来源类型 (moment/weibo/forum/live)
     * @param {Object} rawData - 原始数据对象
     * @returns {Object|null} 统一格式数据，转换失败返回 null
     */
    normalize: function (sourceType, rawData) {
      if (!rawData || typeof rawData !== 'object') {
        console.warn('[SocialDTO] normalize: rawData 无效');
        return null;
      }

      try {
        switch (sourceType) {
          case SOURCE_TYPES.MOMENT:
            return this._normalizeMoment(rawData);
          case SOURCE_TYPES.WEIBO:
            return this._normalizeWeibo(rawData);
          case SOURCE_TYPES.FORUM:
            return this._normalizeForum(rawData);
          case SOURCE_TYPES.LIVE:
            return this._normalizeLive(rawData);
          default:
            console.warn('[SocialDTO] normalize: 不支持的来源类型:', sourceType);
            return null;
        }
      } catch (e) {
        console.warn('[SocialDTO] normalize 转换失败:', sourceType, e);
        return null;
      }
    },

    /**
     * 批量转换并排序
     * @param {Array} items - { sourceType, data } 数组
     * @param {Object} options - { sortBy?, sortOrder?, limit? }
     * @returns {Array} 统一格式数组
     */
    normalizeBatch: function (items, options) {
      if (!Array.isArray(items)) return [];

      options = options || {};
      var sortBy = options.sortBy || 'timestamp';
      var sortOrder = options.sortOrder || 'desc';
      var limit = options.limit || 0;

      var results = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item || !item.sourceType || !item.data) continue;

        var normalized = this.normalize(item.sourceType, item.data);
        if (normalized) {
          results.push(normalized);
        }
      }

      // 排序
      results.sort(function (a, b) {
        var valA = a[sortBy] || 0;
        var valB = b[sortBy] || 0;
        if (sortOrder === 'asc') {
          return valA - valB;
        }
        return valB - valA;
      });

      // 限制数量
      if (limit > 0 && results.length > limit) {
        results.length = limit;
      }

      return results;
    },

    /**
     * 将统一格式转回原始格式
     * @param {string} targetType - 目标类型 (moment/weibo/forum/live)
     * @param {Object} unified - 统一格式数据
     * @returns {Object|null} 原始格式数据，转换失败返回 null
     */
    denormalize: function (targetType, unified) {
      if (!unified || typeof unified !== 'object') {
        console.warn('[SocialDTO] denormalize: unified 数据无效');
        return null;
      }

      try {
        switch (targetType) {
          case SOURCE_TYPES.MOMENT:
            return this._denormalizeToMoment(unified);
          case SOURCE_TYPES.WEIBO:
            return this._denormalizeToWeibo(unified);
          case SOURCE_TYPES.FORUM:
            return this._denormalizeToForum(unified);
          case SOURCE_TYPES.LIVE:
            return this._denormalizeToLive(unified);
          default:
            console.warn('[SocialDTO] denormalize: 不支持的目标类型:', targetType);
            return null;
        }
      } catch (e) {
        console.warn('[SocialDTO] denormalize 转换失败:', targetType, e);
        return null;
      }
    },

    /**
     * 验证统一格式数据的完整性
     * @param {Object} data - 待验证数据
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate: function (data) {
      var errors = [];

      if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['数据为空或非对象'] };
      }

      // 必填字段检查
      if (!data.id || typeof data.id !== 'string') {
        errors.push('缺少有效的 id 字段');
      }
      if (!data.sourceType || typeof data.sourceType !== 'string') {
        errors.push('缺少有效的 sourceType 字段');
      }
      if (!data.author || typeof data.author !== 'object') {
        errors.push('缺少有效的 author 对象');
      } else {
        if (!data.author.id && !data.author.name) {
          errors.push('author 对象缺少 id 或 name');
        }
      }
      if (typeof data.content !== 'string') {
        errors.push('缺少有效的 content 字段');
      }
      if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
        errors.push('缺少有效的 timestamp 字段');
      }
      if (!data.engagement || typeof data.engagement !== 'object') {
        errors.push('缺少有效的 engagement 对象');
      }

      return {
        valid: errors.length === 0,
        errors: errors,
      };
    },

    // ==================== 内部转换方法 ====================

    /**
     * 朋友圈 -> 统一格式
     * 原始结构: { id, authorId, authorName, authorAvatar, content, images, likes[], comments[], createdAt }
     */
    _normalizeMoment: function (raw) {
      return {
        id: raw.id,
        sourceType: SOURCE_TYPES.MOMENT,
        author: {
          id: raw.authorId || '',
          name: raw.authorName || '未知',
          avatar: raw.authorAvatar || '',
        },
        content: raw.content || '',
        timestamp: raw.createdAt || raw.timestamp || 0,
        engagement: {
          likes: Array.isArray(raw.likes) ? raw.likes.length : 0,
          comments: Array.isArray(raw.comments) ? raw.comments.length : 0,
          commentList: (raw.comments || []).map(function (c) {
            return {
              id: c.id,
              userId: c.userId,
              userName: c.userName,
              content: c.content,
              timestamp: c.timestamp,
            };
          }),
        },
        images: raw.images || [],
        raw: raw,
      };
    },

    /**
     * 微博 -> 统一格式
     * 原始结构: { id, content, author, avatar, images, likes, comments, commentList[], timestamp }
     */
    _normalizeWeibo: function (raw) {
      return {
        id: raw.id,
        sourceType: SOURCE_TYPES.WEIBO,
        author: {
          id: raw.authorId || '',
          name: raw.author || '未知',
          avatar: raw.avatar || '',
        },
        content: raw.content || '',
        timestamp: raw.timestamp || 0,
        engagement: {
          likes: typeof raw.likes === 'number' ? raw.likes : 0,
          comments: typeof raw.comments === 'number' ? raw.comments : 0,
          commentList: (raw.commentList || []).map(function (c) {
            return {
              id: c.id,
              userId: c.userId || '',
              userName: c.author || '',
              content: c.content,
              timestamp: c.timestamp,
            };
          }),
        },
        images: raw.images || [],
        extra: {
          shares: raw.shares || 0,
          liked: raw.liked || false,
          type: raw.type || 'normal',
        },
        raw: raw,
      };
    },

    /**
     * 论坛 -> 统一格式
     * 原始结构: { id, title, content, author, authorId, replies[], likes, views, createdAt }
     */
    _normalizeForum: function (raw) {
      return {
        id: raw.id,
        sourceType: SOURCE_TYPES.FORUM,
        author: {
          id: raw.authorId || '',
          name: raw.author || '匿名用户',
          avatar: '',
        },
        content: raw.content || '',
        timestamp: raw.createdAt || raw.timestamp || 0,
        engagement: {
          likes: typeof raw.likes === 'number' ? raw.likes : 0,
          comments: Array.isArray(raw.replies) ? raw.replies.length : 0,
          commentList: (raw.replies || []).map(function (r) {
            return {
              id: r.id,
              userId: r.authorId || '',
              userName: r.author || '匿名用户',
              content: r.content,
              timestamp: r.createdAt || r.timestamp || 0,
            };
          }),
        },
        title: raw.title || '',
        extra: {
          views: raw.views || 0,
          isPinned: raw.isPinned || false,
          isHot: raw.isHot || false,
          style: raw.style || 'normal',
        },
        raw: raw,
      };
    },

    /**
     * 直播 -> 统一格式
     * 原始结构: { id, streamerId, streamerName, streamerAvatar, title, viewers, isLive, startedAt }
     */
    _normalizeLive: function (raw) {
      return {
        id: raw.id,
        sourceType: SOURCE_TYPES.LIVE,
        author: {
          id: raw.streamerId || '',
          name: raw.streamerName || '未知主播',
          avatar: raw.streamerAvatar || '',
        },
        content: raw.title || '未命名直播',
        timestamp: raw.startedAt || raw.timestamp || 0,
        engagement: {
          likes: 0,
          comments: 0,
          commentList: [],
        },
        extra: {
          viewers: raw.viewers || 0,
          isLive: raw.isLive || false,
          endedAt: raw.endedAt || null,
          totalGifts: raw.totalGifts || 0,
          totalGiftValue: raw.totalGiftValue || 0,
        },
        raw: raw,
      };
    },

    // ==================== 反向转换方法 ====================

    /**
     * 统一格式 -> 朋友圈格式
     */
    _denormalizeToMoment: function (u) {
      return {
        id: u.id,
        authorId: u.author.id,
        authorName: u.author.name,
        authorAvatar: u.author.avatar,
        content: u.content,
        images: u.images || [],
        likes: (u.engagement.commentList || []).map(function (c) {
          return { userId: c.userId, userName: c.userName, timestamp: c.timestamp };
        }),
        comments: (u.engagement.commentList || []).map(function (c) {
          return {
            id: c.id,
            userId: c.userId,
            userName: c.userName,
            content: c.content,
            timestamp: c.timestamp,
          };
        }),
        createdAt: u.timestamp,
        time: new Date(u.timestamp).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    },

    /**
     * 统一格式 -> 微博格式
     */
    _denormalizeToWeibo: function (u) {
      return {
        id: u.id,
        content: u.content,
        author: u.author.name,
        authorId: u.author.id,
        avatar: u.author.avatar,
        images: u.images || [],
        likes: u.engagement.likes || 0,
        comments: u.engagement.comments || 0,
        commentList: (u.engagement.commentList || []).map(function (c) {
          return {
            id: c.id,
            content: c.content,
            author: c.userName,
            userId: c.userId,
            timestamp: c.timestamp,
            likes: 0,
            liked: false,
            replies: [],
          };
        }),
        shares: (u.extra && u.extra.shares) || 0,
        liked: (u.extra && u.extra.liked) || false,
        type: (u.extra && u.extra.type) || 'normal',
        timestamp: u.timestamp,
        time: new Date(u.timestamp).toLocaleString('zh-CN'),
      };
    },

    /**
     * 统一格式 -> 论坛格式
     */
    _denormalizeToForum: function (u) {
      return {
        id: u.id,
        title: u.title || '无标题',
        content: u.content,
        author: u.author.name,
        authorId: u.author.id,
        replies: (u.engagement.commentList || []).map(function (c) {
          return {
            id: c.id,
            content: c.content,
            author: c.userName,
            authorId: c.userId,
            likes: 0,
            createdAt: c.timestamp,
            time: new Date(c.timestamp).toLocaleString('zh-CN'),
          };
        }),
        likes: u.engagement.likes || 0,
        views: (u.extra && u.extra.views) || 0,
        isPinned: (u.extra && u.extra.isPinned) || false,
        isHot: (u.extra && u.extra.isHot) || false,
        style: (u.extra && u.extra.style) || 'normal',
        createdAt: u.timestamp,
        time: new Date(u.timestamp).toLocaleString('zh-CN'),
      };
    },

    /**
     * 统一格式 -> 直播格式
     */
    _denormalizeToLive: function (u) {
      return {
        id: u.id,
        streamerId: u.author.id,
        streamerName: u.author.name,
        streamerAvatar: u.author.avatar,
        title: u.content || '未命名直播',
        viewers: (u.extra && u.extra.viewers) || 0,
        isLive: (u.extra && u.extra.isLive) || false,
        startedAt: u.timestamp,
        endedAt: (u.extra && u.extra.endedAt) || null,
        totalGifts: (u.extra && u.extra.totalGifts) || 0,
        totalGiftValue: (u.extra && u.extra.totalGiftValue) || 0,
      };
    },
  };

  // 暴露到全局
  window.SocialDTO = SocialDTO;

  console.log('[CORE] SocialDTO 已加载');
})();
