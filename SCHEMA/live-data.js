/**
 * LiveData - 直播数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Live
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'live';

  // 直播状态常量
  const LIVE_STATUS = {
    LIVE: 'live',       // 直播中
    ENDED: 'ended',     // 已结束
    SCHEDULED: 'scheduled', // 预告
  };

  // 礼物类型常量
  const GIFT_TYPES = {
    FLOWER: 'flower',       // 鲜花
    LIKE: 'like',           // 点赞
    HEART: 'heart',         // 爱心
    ROCKET: 'rocket',       // 火箭
    CROWN: 'crown',         // 皇冠
    BEER: 'beer',           // 啤酒
    CAKE: 'cake',           // 蛋糕
    CANDY: 'candy',         // 糖果
  };

  // 礼物价值映射
  const GIFT_VALUES = {
    flower: 1,
    like: 1,
    heart: 5,
    rocket: 50,
    crown: 100,
    beer: 10,
    cake: 20,
    candy: 2,
  };

  /**
   * LiveData 直播数据操作类
   */
  class LiveData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 直播流操作 ====================

    /**
     * 获取直播列表
     * @param {Object} options - { isLive?, limit? }
     * @returns {Promise<Array>}
     */
    async getStreams(options = {}) {
      const streams = await this._get('streams', []);
      let result = streams;

      if (options.isLive === true) {
        result = result.filter(s => s.isLive === true);
      } else if (options.isLive === false) {
        result = result.filter(s => s.isLive !== true);
      }

      if (options.limit) {
        result = result.slice(0, options.limit);
      }

      return result;
    }

    /**
     * 获取单个直播
     * @param {string} streamId
     * @returns {Promise<Object|null>}
     */
    async getById(streamId) {
      const streams = await this._get('streams', []);
      return streams.find(s => s.id === streamId) || null;
    }

    /**
     * 添加/创建直播
     * @param {Object} stream
     * @returns {Promise<Object>}
     */
    async addStream(stream) {
      const streams = await this._get('streams', []);

      const newStream = {
        id: stream.id || this._generateId(),
        streamerId: stream.streamerId || '',
        streamerName: stream.streamerName || '未知主播',
        streamerAvatar: stream.streamerAvatar || '',
        coverImage: stream.coverImage || stream.cover || '',
        title: stream.title || '未命名直播',
        viewers: stream.viewers || 0,
        isLive: stream.isLive !== undefined ? stream.isLive : true,
        startedAt: stream.startedAt || Date.now(),
        endedAt: null,
        totalGifts: 0,
        totalGiftValue: 0,
      };

      streams.unshift(newStream);
      await this._set('streams', streams);

      this._emit('live:streamAdded', { stream: newStream });
      return newStream;
    }

    /**
     * 更新直播
     * @param {string} streamId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateStream(streamId, updates) {
      const streams = await this._get('streams', []);
      const stream = streams.find(s => s.id === streamId);

      if (!stream) return false;

      Object.assign(stream, updates);
      await this._set('streams', streams);

      this._emit('live:streamUpdated', { streamId, updates });
      return true;
    }

    /**
     * 结束直播
     * @param {string} streamId
     * @returns {Promise<boolean>}
     */
    async endStream(streamId) {
      return await this.updateStream(streamId, {
        isLive: false,
        endedAt: Date.now(),
      });
    }

    /**
     * 删除直播
     * @param {string} streamId
     * @returns {Promise<boolean>}
     */
    async deleteStream(streamId) {
      const streams = await this._get('streams', []);
      const index = streams.findIndex(s => s.id === streamId);

      if (index === -1) return false;

      streams.splice(index, 1);
      await this._set('streams', streams);

      this._emit('live:streamDeleted', { streamId });
      return true;
    }

    /**
     * 增加观众数
     * @param {string} streamId
     * @param {number} delta
     * @returns {Promise<number>}
     */
    async updateViewers(streamId, delta = 1) {
      const streams = await this._get('streams', []);
      const stream = streams.find(s => s.id === streamId);

      if (!stream) return 0;

      stream.viewers = Math.max(0, (stream.viewers || 0) + delta);
      await this._set('streams', streams);

      this._emit('live:viewersUpdated', { streamId, viewers: stream.viewers });
      return stream.viewers;
    }

    // ==================== 弹幕操作 ====================

    /**
     * 获取弹幕列表
     * @param {string} streamId
     * @returns {Promise<Array>}
     */
    async getDanmaku(streamId) {
      const key = 'danmaku_' + streamId;
      return await this._get(key, []);
    }

    /**
     * 添加弹幕
     * @param {string} streamId
     * @param {Object} danmaku
     * @returns {Promise<Object>}
     */
    async addDanmaku(streamId, danmaku) {
      const key = 'danmaku_' + streamId;
      const list = await this._get(key, []);

      const newDanmaku = {
        id: this._generateId(),
        content: danmaku.content || '',
        userId: danmaku.userId || 'anonymous',
        userName: danmaku.userName || '匿名',
        userAvatar: danmaku.userAvatar || '',
        type: danmaku.type || 'normal', // normal | system | gift
        timestamp: Date.now(),
      };

      list.push(newDanmaku);

      // 限制弹幕数量（保留最近500条）
      if (list.length > 500) {
        list.splice(0, list.length - 500);
      }

      await this._set(key, list);

      this._emit('live:danmakuAdded', { streamId, danmaku: newDanmaku });
      return newDanmaku;
    }

    /**
     * 清空弹幕
     * @param {string} streamId
     * @returns {Promise<boolean>}
     */
    async clearDanmaku(streamId) {
      const key = 'danmaku_' + streamId;
      await this._set(key, []);
      return true;
    }

    // ==================== 礼物操作 ====================

    /**
     * 获取礼物列表
     * @param {string} streamId
     * @returns {Promise<Array>}
     */
    async getGifts(streamId) {
      const key = 'gifts_' + streamId;
      return await this._get(key, []);
    }

    /**
     * 送出礼物
     * @param {string} streamId
     * @param {Object} gift
     * @returns {Promise<Object>}
     */
    /** @deprecated 业务逻辑已迁移到 LiveService，请通过 Service 层调用 */
    async sendGift(streamId, gift) {
      const key = 'gifts_' + streamId;
      const gifts = await this._get(key, []);

      const giftType = gift.type || GIFT_TYPES.FLOWER;
      const giftValue = gift.value || GIFT_VALUES[giftType] || 0;

      const newGift = {
        id: this._generateId(),
        type: giftType,
        name: gift.name || this._getGiftName(giftType),
        value: giftValue,
        userId: gift.userId || 'anonymous',
        userName: gift.userName || '匿名',
        userAvatar: gift.userAvatar || '',
        timestamp: Date.now(),
      };

      gifts.push(newGift);

      // 限制礼物记录数量
      if (gifts.length > 200) {
        gifts.splice(0, gifts.length - 200);
      }

      await this._set(key, gifts);

      // 更新直播统计
      const streams = await this._get('streams', []);
      const stream = streams.find(s => s.id === streamId);
      if (stream) {
        stream.totalGifts = (stream.totalGifts || 0) + 1;
        stream.totalGiftValue = (stream.totalGiftValue || 0) + giftValue;
        await this._set('streams', streams);
      }

      this._emit('live:giftSent', { streamId, gift: newGift });
      return newGift;
    }

    // ==================== 观看历史 ====================

    /**
     * 获取观看历史
     * @returns {Promise<Array>}
     */
    async getHistory() {
      return await this._get('history', []);
    }

    /**
     * 添加观看记录
     * @param {Object} record
     * @returns {Promise<Object>}
     */
    async addHistory(record) {
      const history = await this._get('history', []);

      const newRecord = {
        id: this._generateId(),
        streamId: record.streamId || '',
        streamerName: record.streamerName || '',
        title: record.title || '',
        watchedAt: Date.now(),
        duration: record.duration || 0,
      };

      history.unshift(newRecord);

      // 限制历史记录数量
      if (history.length > 50) {
        history.splice(50);
      }

      await this._set('history', history);
      return newRecord;
    }

    /**
     * 清空观看历史
     * @returns {Promise<boolean>}
     */
    async clearHistory() {
      await this._set('history', []);
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅直播列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeStreams(callback) {
      return this._subscribe('streams', callback);
    }

    /**
     * 订阅弹幕
     * @param {string} streamId
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeDanmaku(streamId, callback) {
      return this._subscribe('danmaku_' + streamId, callback);
    }

    /**
     * 订阅礼物
     * @param {string} streamId
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeGifts(streamId, callback) {
      return this._subscribe('gifts_' + streamId, callback);
    }

    // ==================== 内部方法 ====================

    _getGiftName(type) {
      const names = {
        flower: '鲜花',
        like: '点赞',
        heart: '爱心',
        rocket: '火箭',
        crown: '皇冠',
        beer: '啤酒',
        cake: '蛋糕',
        candy: '糖果',
      };
      return names[type] || '礼物';
    }

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
      // no-op: 事件发射由 LiveService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'live_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Live = LiveData;
  window.PhoneData.Live.STATUS = LIVE_STATUS;
  window.PhoneData.Live.GIFT_TYPES = GIFT_TYPES;
  window.PhoneData.Live.GIFT_VALUES = GIFT_VALUES;

  console.log('[Schema] LiveData 已加载');
})();
