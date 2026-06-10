/**
 * StoryEventsData - 事件时间线 Schema 辅助函数
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过 Schema 辅助函数
 * - 铁则十三：数据隔离 {charId}:{domain}:{key}
 *
 * 用途：结构化存储事件因果链，替代碎片化聊天抓取
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  const DOMAIN = 'story';

  /**
   * StoryEventsData 事件时间线操作类
   */
  class StoryEventsData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 事件操作 ====================

    /**
     * 添加事件
     * @param {Object} event - { id?, time?, type, summary, actors?, location?, impact?, relatedEvents? }
     * @returns {Promise<Object>}
     */
    async add(event) {
      const events = await this._get('events', []);

      const newEvent = {
        id: event.id || this._generateId(),
        time: event.time || Date.now(),
        type: event.type || 'unknown',
        summary: event.summary || '',
        actors: event.actors || [],
        location: event.location || null,
        impact: event.impact || null,
        relatedEvents: event.relatedEvents || [],
      };

      // 按时间倒序插入（最新的在前面）
      events.unshift(newEvent);

      // 限制数量，防止无限增长
      if (events.length > 200) {
        events.length = 200;
      }

      await this._set('events', events);
      this._emit('story:eventAdded', { event: newEvent });
      return newEvent;
    }

    /**
     * 获取最近 N 条事件
     * @param {number} count - 默认 10
     * @returns {Promise<Array>}
     */
    async getRecent(count = 10) {
      const events = await this._get('events', []);
      return events.slice(0, count);
    }

    /**
     * 按类型筛选事件
     * @param {string} type
     * @param {number} limit - 默认 20
     * @returns {Promise<Array>}
     */
    async getByType(type, limit = 20) {
      const events = await this._get('events', []);
      return events.filter(e => e.type === type).slice(0, limit);
    }

    /**
     * 按参与者筛选事件
     * @param {string} actorName
     * @param {number} limit - 默认 20
     * @returns {Promise<Array>}
     */
    async getByActor(actorName, limit = 20) {
      const events = await this._get('events', []);
      return events.filter(e =>
        e.actors && e.actors.includes(actorName)
      ).slice(0, limit);
    }

    /**
     * 按地点筛选事件
     * @param {string} location
     * @param {number} limit - 默认 20
     * @returns {Promise<Array>}
     */
    async getByLocation(location, limit = 20) {
      const events = await this._get('events', []);
      return events.filter(e => e.location === location).slice(0, limit);
    }

    /**
     * 获取单个事件
     * @param {string} eventId
     * @returns {Promise<Object|null>}
     */
    async getById(eventId) {
      const events = await this._get('events', []);
      return events.find(e => e.id === eventId) || null;
    }

    /**
     * 删除事件
     * @param {string} eventId
     * @returns {Promise<boolean>}
     */
    async delete(eventId) {
      const events = await this._get('events', []);
      const index = events.findIndex(e => e.id === eventId);

      if (index === -1) return false;

      const deleted = events.splice(index, 1)[0];
      await this._set('events', events);
      this._emit('story:eventDeleted', { eventId, event: deleted });
      return true;
    }

    // ==================== 关联操作 ====================

    /**
     * 建立事件关联
     * @param {string} eventId1
     * @param {string} eventId2
     * @returns {Promise<boolean>}
     */
    async linkEvents(eventId1, eventId2) {
      const events = await this._get('events', []);

      const event1 = events.find(e => e.id === eventId1);
      const event2 = events.find(e => e.id === eventId2);

      if (!event1 || !event2) return false;

      // 双向关联
      if (!event1.relatedEvents) event1.relatedEvents = [];
      if (!event2.relatedEvents) event2.relatedEvents = [];

      if (!event1.relatedEvents.includes(eventId2)) {
        event1.relatedEvents.push(eventId2);
      }
      if (!event2.relatedEvents.includes(eventId1)) {
        event2.relatedEvents.push(eventId1);
      }

      await this._set('events', events);
      this._emit('story:eventsLinked', { eventId1, eventId2 });
      return true;
    }

    /**
     * 获取关联事件
     * @param {string} eventId
     * @returns {Promise<Array>}
     */
    async getRelated(eventId) {
      const event = await this.getById(eventId);
      if (!event || !event.relatedEvents) return [];

      const related = [];
      for (const relatedId of event.relatedEvents) {
        const e = await this.getById(relatedId);
        if (e) related.push(e);
      }
      return related;
    }

    // ==================== 时间线操作 ====================

    /**
     * 获取时间线（按时间范围）
     * @param {number} start - 开始时间戳
     * @param {number} end - 结束时间戳
     * @returns {Promise<Array>}
     */
    async getTimeline(start, end) {
      const events = await this._get('events', []);

      if (!start && !end) return events;

      return events.filter(e => {
        if (start && e.time < start) return false;
        if (end && e.time > end) return false;
        return true;
      });
    }

    /**
     * 获取事件统计
     * @returns {Promise<Object>}
     */
    async getStats() {
      const events = await this._get('events', []);

      const stats = {
        total: events.length,
        byType: {},
        byActor: {},
        byLocation: {},
      };

      for (const event of events) {
        // 按类型统计
        stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

        // 按参与者统计
        for (const actor of (event.actors || [])) {
          stats.byActor[actor] = (stats.byActor[actor] || 0) + 1;
        }

        // 按地点统计
        if (event.location) {
          stats.byLocation[event.location] = (stats.byLocation[event.location] || 0) + 1;
        }
      }

      return stats;
    }

    /**
     * 清空所有事件
     * @returns {Promise<boolean>}
     */
    async clearAll() {
      await this._set('events', []);
      this._emit('story:eventsCleared', {});
      return true;
    }

    // ==================== 订阅 ====================

    subscribeEvents(callback) {
      return this._subscribe('events', callback);
    }

    // ==================== 内部方法 ====================

    async _get(key, defaultValue) {
      if (!this._platform) {
        console.warn('[StoryEventsData] Platform 未初始化');
        return defaultValue;
      }

      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[StoryEventsData] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }

      const result = await this._platform.data(DOMAIN, key, defaultValue);
      return result !== undefined && result !== null ? result : defaultValue;
    }

    async _set(key, value) {
      if (!this._platform) {
        console.warn('[StoryEventsData] Platform 未初始化，无法写入数据');
        return false;
      }

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
      return 'evt_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.StoryEvents = StoryEventsData;

  console.log('[Schema] StoryEventsData 已加载 v1.0.0');
})();
