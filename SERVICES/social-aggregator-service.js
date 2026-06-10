/**
 * @layer Service
 * @file   social-aggregator-service.js
 * @depends FriendsCircleData, WeiboData, ForumData, LiveData, SocialDTO, PayloadBuilder
 * @emits  social:messageCreated, social:archived, social:purged
 *
 * 职责: 社交消息聚合服务，统一抽象层
 *       通过现有Schema读写（铁则一），不直接操作DataStore
 * 禁止: 操作DOM、包含UI逻辑
 *
 * [铁则合规]
 * - 铁则一: 所有数据读写通过 Schema 辅助函数
 * - 铁则三: 服务层不操作 DOM，只处理业务逻辑
 * - 铁则九: 所有异步操作都有错误处理
 * - 铁则十二: 事件载荷使用 PayloadBuilder 构造
 */

;(function () {
  'use strict';

  class SocialAggregatorService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      // [铁则一] 通过 Schema 实例读写数据
      this._friendsCircleData = new (window.PhoneData?.FriendsCircle || function () {})(this._platform);
      this._weiboData = new (window.PhoneData?.Weibo || function () {})(this._platform);
      this._forumData = new (window.PhoneData?.Forum || function () {})(this._platform);
      this._liveData = new (window.PhoneData?.Live || function () {})(this._platform);
    }

    // ==================== 统一创建 ====================

    /**
     * 统一创建社交消息
     * @param {string} type - 消息类型 (moment/weibo/forum/live)
     * @param {Object} data - 消息数据
     * @returns {Promise<Object|null>} 创建的消息，失败返回 null
     */
    async createMessage(type, data) {
      if (!type || !data) {
        console.warn('[SocialAggregator] createMessage: 参数无效');
        return null;
      }

      try {
        var result = null;

        switch (type) {
          case 'moment':
            result = await this._friendsCircleData.publish({
              authorId: data.authorId || data.author?.id || 'me',
              authorName: data.authorName || data.author?.name || '我',
              authorAvatar: data.authorAvatar || data.author?.avatar || '',
              content: data.content || '',
              images: data.images || [],
            });
            break;

          case 'weibo':
            result = await this._weiboData.addPost({
              content: data.content || '',
              author: data.authorName || data.author?.name || '',
              avatar: data.authorAvatar || data.author?.avatar || '',
              images: data.images || [],
              type: data.type || 'normal',
            });
            break;

          case 'forum':
            result = await this._forumData.addPost({
              title: data.title || '无标题',
              content: data.content || '',
              author: data.authorName || data.author?.name || '匿名用户',
              authorId: data.authorId || data.author?.id || 'anonymous',
              style: data.style || 'normal',
            });
            break;

          case 'live':
            result = await this._liveData.addStream({
              streamerId: data.streamerId || data.author?.id || '',
              streamerName: data.streamerName || data.author?.name || '未知主播',
              streamerAvatar: data.streamerAvatar || data.author?.avatar || '',
              title: data.title || data.content || '未命名直播',
              viewers: data.viewers || 0,
              isLive: data.isLive !== undefined ? data.isLive : true,
            });
            break;

          default:
            console.warn('[SocialAggregator] createMessage: 不支持的消息类型:', type);
            return null;
        }

        // [铁则十二] 发射标准事件载荷
        if (result && this._platform?.eventBus) {
          var payload;
          if (window.PayloadBuilder) {
            payload = window.PayloadBuilder.social.posted(type, result, 'social-aggregator');
          } else {
            payload = {
              id: this._generateId(),
              type: 'social:messageCreated',
              data: { sourceType: type, item: result },
              timestamp: Date.now(),
              source: 'social-aggregator',
            };
          }
          this._platform.eventBus.emit('social:messageCreated', payload);
        }

        return result;
      } catch (e) {
        console.warn('[SocialAggregator] createMessage 失败:', type, e);
        return null;
      }
    }

    // ==================== 统一查询 ====================

    /**
     * 统一查询社交消息，使用 SocialDTO 标准化
     * @param {Object} options - { types?, limit?, sortBy?, sortOrder?, since? }
     * @returns {Promise<Array>} 统一格式消息数组
     */
    async getMessages(options) {
      options = options || {};
      var types = options.types || ['moment', 'weibo', 'forum', 'live'];
      var limit = options.limit || 0;
      var sortBy = options.sortBy || 'timestamp';
      var sortOrder = options.sortOrder || 'desc';
      var since = options.since || 0;

      var allItems = [];

      try {
        // 收集各类型数据
        if (types.indexOf('moment') >= 0) {
          try {
            var circles = await this._friendsCircleData.getCircles();
            for (var i = 0; i < circles.length; i++) {
              allItems.push({ sourceType: 'moment', data: circles[i] });
            }
          } catch (e) {
            console.warn('[SocialAggregator] 获取朋友圈数据失败:', e);
          }
        }

        if (types.indexOf('weibo') >= 0) {
          try {
            var posts = await this._weiboData.getPosts();
            for (var j = 0; j < posts.length; j++) {
              allItems.push({ sourceType: 'weibo', data: posts[j] });
            }
          } catch (e) {
            console.warn('[SocialAggregator] 获取微博数据失败:', e);
          }
        }

        if (types.indexOf('forum') >= 0) {
          try {
            var forumPosts = await this._forumData.getPosts();
            for (var k = 0; k < forumPosts.length; k++) {
              allItems.push({ sourceType: 'forum', data: forumPosts[k] });
            }
          } catch (e) {
            console.warn('[SocialAggregator] 获取论坛数据失败:', e);
          }
        }

        if (types.indexOf('live') >= 0) {
          try {
            var streams = await this._liveData.getStreams();
            for (var l = 0; l < streams.length; l++) {
              allItems.push({ sourceType: 'live', data: streams[l] });
            }
          } catch (e) {
            console.warn('[SocialAggregator] 获取直播数据失败:', e);
          }
        }

        // 使用 SocialDTO 批量标准化
        var normalized = [];
        if (window.SocialDTO) {
          normalized = window.SocialDTO.normalizeBatch(allItems, {
            sortBy: sortBy,
            sortOrder: sortOrder,
            limit: limit || undefined,
          });
        } else {
          // 降级：直接返回原始数据
          console.warn('[SocialAggregator] SocialDTO 不可用，返回原始数据');
          normalized = allItems.map(function (item) {
            return { sourceType: item.sourceType, raw: item.data };
          });
        }

        // 时间过滤
        if (since > 0) {
          normalized = normalized.filter(function (item) {
            return (item.timestamp || 0) >= since;
          });
        }

        return normalized;
      } catch (e) {
        console.warn('[SocialAggregator] getMessages 失败:', e);
        return [];
      }
    }

    // ==================== 归档与清理 ====================

    /**
     * 归档旧消息（标记为已归档，不删除）
     * @param {number} timestamp - 归档此时间戳之前的消息
     * @returns {Promise<Object>} { archived: { moment: n, weibo: n, forum: n, live: n } }
     */
    async archiveBefore(timestamp) {
      if (!timestamp || typeof timestamp !== 'number') {
        console.warn('[SocialAggregator] archiveBefore: timestamp 无效');
        return { archived: { moment: 0, weibo: 0, forum: 0, live: 0 } };
      }

      var archived = { moment: 0, weibo: 0, forum: 0, live: 0 };

      try {
        // 归档朋友圈
        try {
          var circles = await this._friendsCircleData.getCircles();
          var activeCircles = circles.filter(function (c) {
            return (c.createdAt || c.timestamp || 0) >= timestamp;
          });
          archived.moment = circles.length - activeCircles.length;
          if (archived.moment > 0) {
            await this._friendsCircleData._set('circles', activeCircles);
          }
        } catch (e) {
          console.warn('[SocialAggregator] 归档朋友圈失败:', e);
        }

        // 归档微博
        try {
          var posts = await this._weiboData.getPosts();
          var activePosts = posts.filter(function (p) {
            return (p.timestamp || 0) >= timestamp;
          });
          archived.weibo = posts.length - activePosts.length;
          if (archived.weibo > 0) {
            await this._weiboData._set('posts', activePosts);
          }
        } catch (e) {
          console.warn('[SocialAggregator] 归档微博失败:', e);
        }

        // 归档论坛帖子
        try {
          var forumPosts = await this._forumData.getPosts();
          var activeForumPosts = forumPosts.filter(function (p) {
            return (p.createdAt || p.timestamp || 0) >= timestamp;
          });
          archived.forum = forumPosts.length - activeForumPosts.length;
          if (archived.forum > 0) {
            await this._forumData._set('posts', activeForumPosts);
          }
        } catch (e) {
          console.warn('[SocialAggregator] 归档论坛失败:', e);
        }

        // 归档直播记录
        try {
          var streams = await this._liveData.getStreams();
          var activeStreams = streams.filter(function (s) {
            return (s.startedAt || s.timestamp || 0) >= timestamp;
          });
          archived.live = streams.length - activeStreams.length;
          if (archived.live > 0) {
            await this._liveData._set('streams', activeStreams);
          }
        } catch (e) {
          console.warn('[SocialAggregator] 归档直播失败:', e);
        }

        // [铁则十二] 发射归档事件
        if (this._platform?.eventBus) {
          var payload;
          if (window.PayloadBuilder) {
            payload = window.PayloadBuilder.build('social:archived', { timestamp: timestamp, archived: archived }, 'social-aggregator');
          } else {
            payload = {
              id: this._generateId(),
              type: 'social:archived',
              data: { timestamp: timestamp, archived: archived },
              timestamp: Date.now(),
              source: 'social-aggregator',
            };
          }
          this._platform.eventBus.emit('social:archived', payload);
        }

        console.log('[SocialAggregator] 归档完成:', archived);
        return { archived: archived };
      } catch (e) {
        console.warn('[SocialAggregator] archiveBefore 失败:', e);
        return { archived: archived };
      }
    }

    /**
     * 清理过期消息（彻底删除）
     * @param {number} timestamp - 清理此时间戳之前的消息
     * @returns {Promise<Object>} { purged: { moment: n, weibo: n, forum: n, live: n } }
     */
    async purgeBefore(timestamp) {
      if (!timestamp || typeof timestamp !== 'number') {
        console.warn('[SocialAggregator] purgeBefore: timestamp 无效');
        return { purged: { moment: 0, weibo: 0, forum: 0, live: 0 } };
      }

      // 清理与归档逻辑相同（当前实现中，旧数据直接被移除）
      var result = await this.archiveBefore(timestamp);

      // [铁则十二] 发射清理事件
      if (this._platform?.eventBus) {
        var payload;
        if (window.PayloadBuilder) {
          payload = window.PayloadBuilder.build('social:purged', { timestamp: timestamp, purged: result.archived }, 'social-aggregator');
        } else {
          payload = {
            id: this._generateId(),
            type: 'social:purged',
            data: { timestamp: timestamp, purged: result.archived },
            timestamp: Date.now(),
            source: 'social-aggregator',
          };
        }
        this._platform.eventBus.emit('social:purged', payload);
      }

      return { purged: result.archived };
    }

    // ==================== 统计 ====================

    /**
     * 获取社交消息统计
     * @returns {Promise<Object>} { total, byType, latestTimestamp }
     */
    async getStats() {
      var stats = {
        total: 0,
        byType: { moment: 0, weibo: 0, forum: 0, live: 0 },
        latestTimestamp: 0,
      };

      try {
        // 朋友圈统计
        try {
          var circles = await this._friendsCircleData.getCircles();
          stats.byType.moment = circles.length;
          stats.total += circles.length;
          for (var i = 0; i < circles.length; i++) {
            var ct = circles[i].createdAt || circles[i].timestamp || 0;
            if (ct > stats.latestTimestamp) stats.latestTimestamp = ct;
          }
        } catch (e) {
          console.warn('[SocialAggregator] 统计朋友圈失败:', e);
        }

        // 微博统计
        try {
          var posts = await this._weiboData.getPosts();
          stats.byType.weibo = posts.length;
          stats.total += posts.length;
          for (var j = 0; j < posts.length; j++) {
            var pt = posts[j].timestamp || 0;
            if (pt > stats.latestTimestamp) stats.latestTimestamp = pt;
          }
        } catch (e) {
          console.warn('[SocialAggregator] 统计微博失败:', e);
        }

        // 论坛统计
        try {
          var forumPosts = await this._forumData.getPosts();
          stats.byType.forum = forumPosts.length;
          stats.total += forumPosts.length;
          for (var k = 0; k < forumPosts.length; k++) {
            var ft = forumPosts[k].createdAt || forumPosts[k].timestamp || 0;
            if (ft > stats.latestTimestamp) stats.latestTimestamp = ft;
          }
        } catch (e) {
          console.warn('[SocialAggregator] 统计论坛失败:', e);
        }

        // 直播统计
        try {
          var streams = await this._liveData.getStreams();
          stats.byType.live = streams.length;
          stats.total += streams.length;
          for (var l = 0; l < streams.length; l++) {
            var lt = streams[l].startedAt || streams[l].timestamp || 0;
            if (lt > stats.latestTimestamp) stats.latestTimestamp = lt;
          }
        } catch (e) {
          console.warn('[SocialAggregator] 统计直播失败:', e);
        }
      } catch (e) {
        console.warn('[SocialAggregator] getStats 失败:', e);
      }

      return stats;
    }

    // ==================== 内部方法 ====================

    /**
     * 生成唯一ID
     * @returns {string}
     * @private
     */
    _generateId() {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'soc_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.SocialAggregator = SocialAggregatorService;

  console.log('[Service] SocialAggregatorService 已加载');
})();
