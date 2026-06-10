/**
 * WorldFactsData - 世界约束 + 地点数据 Schema 辅助函数
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过 Schema 辅助函数
 * - 铁则十三：数据隔离 {charId}:{domain}:{key}
 *
 * 合并了原 LocationData 的职责，地点作为世界约束的子集
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  const DOMAIN = 'worldFacts';

  /**
   * WorldFactsData 世界约束数据操作类
   */
  class WorldFactsData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 世界约束操作 ====================

    /**
     * 获取单个事实
     * @param {string} key
     * @returns {Promise<string|null>}
     */
    async getFact(key) {
      const facts = await this._get('facts', {});
      return facts[key] || null;
    }

    /**
     * 设置事实
     * @param {string} key
     * @param {string} value
     * @returns {Promise<boolean>}
     */
    async setFact(key, value) {
      const facts = await this._get('facts', {});
      facts[key] = value;
      await this._set('facts', facts);
      this._emit('world:factUpdated', { key, value });
      return true;
    }

    /**
     * 获取所有事实
     * @returns {Promise<Object>}
     */
    async getAllFacts() {
      return await this._get('facts', {});
    }

    /**
     * 删除事实
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    async deleteFact(key) {
      const facts = await this._get('facts', {});
      if (!(key in facts)) return false;
      delete facts[key];
      await this._set('facts', facts);
      this._emit('world:factDeleted', { key });
      return true;
    }

    /**
     * 批量导入事实
     * @param {Object} obj
     * @returns {Promise<boolean>}
     */
    async importFacts(obj) {
      const facts = await this._get('facts', {});
      Object.assign(facts, obj);
      await this._set('facts', facts);
      this._emit('world:factsImported', { count: Object.keys(obj).length });
      return true;
    }

    /**
     * 导出所有事实
     * @returns {Promise<Object>}
     */
    async exportFacts() {
      return await this._get('facts', {});
    }

    // ==================== 地点管理（原 LocationData 合并） ====================

    /**
     * 获取当前位置
     * @returns {Promise<string|null>}
     */
    async getCurrentLocation() {
      return await this._get('currentLocation', null);
    }

    /**
     * 设置当前位置
     * @param {string} locId
     * @returns {Promise<boolean>}
     */
    async setCurrentLocation(locId) {
      const current = await this.getCurrentLocation();
      await this._set('currentLocation', locId);

      // 添加到已访问地点
      const visited = await this._get('visitedLocations', []);
      if (!visited.includes(locId)) {
        visited.push(locId);
        await this._set('visitedLocations', visited);
      }

      this._emit('world:locationChanged', { from: current, to: locId });
      return true;
    }

    /**
     * 获取地点详情
     * @param {string} locId
     * @returns {Promise<Object|null>}
     */
    async getLocation(locId) {
      const locations = await this._get('locations', []);
      return locations.find(l => l.id === locId) || null;
    }

    /**
     * 添加地点
     * @param {Object} location - { id, name, type, description, npcs?, subLocations? }
     * @returns {Promise<boolean>}
     */
    async addLocation(location) {
      const locations = await this._get('locations', []);

      // 检查是否已存在
      if (locations.some(l => l.id === location.id)) {
        console.warn('[WorldFactsData] 地点已存在:', location.id);
        return false;
      }

      const newLocation = {
        id: location.id,
        name: location.name,
        type: location.type || 'district', // district / building / room
        description: location.description || '',
        npcs: location.npcs || [],
        subLocations: location.subLocations || [],
        createdAt: Date.now(),
      };

      locations.push(newLocation);
      await this._set('locations', locations);
      this._emit('world:locationAdded', { location: newLocation });
      return true;
    }

    /**
     * 获取地点内的 NPC
     * @param {string} locId
     * @returns {Promise<Array>}
     */
    async getNPCsAtLocation(locId) {
      const location = await this.getLocation(locId);
      return location?.npcs || [];
    }

    /**
     * 添加 NPC 到地点
     * @param {string} locId
     * @param {string} npcId
     * @returns {Promise<boolean>}
     */
    async addNPCToLocation(locId, npcId) {
      const locations = await this._get('locations', []);
      const location = locations.find(l => l.id === locId);
      if (!location) return false;

      if (!location.npcs.includes(npcId)) {
        location.npcs.push(npcId);
        await this._set('locations', locations);
      }
      return true;
    }

    /**
     * 从地点移除 NPC
     * @param {string} locId
     * @param {string} npcId
     * @returns {Promise<boolean>}
     */
    async removeNPCFromLocation(locId, npcId) {
      const locations = await this._get('locations', []);
      const location = locations.find(l => l.id === locId);
      if (!location) return false;

      location.npcs = location.npcs.filter(id => id !== npcId);
      await this._set('locations', locations);
      return true;
    }

    /**
     * 获取已访问地点
     * @returns {Promise<Array>}
     */
    async getVisitedLocations() {
      return await this._get('visitedLocations', []);
    }

    /**
     * 获取所有地点
     * @returns {Promise<Array>}
     */
    async getAllLocations() {
      return await this._get('locations', []);
    }

    // ==================== 订阅 ====================

    subscribeFacts(callback) {
      return this._subscribe('facts', callback);
    }

    subscribeLocations(callback) {
      return this._subscribe('locations', callback);
    }

    subscribeCurrentLocation(callback) {
      return this._subscribe('currentLocation', callback);
    }

    // ==================== 内部方法 ====================

    async _get(key, defaultValue) {
      if (!this._platform) {
        console.warn('[WorldFactsData] Platform 未初始化');
        return defaultValue;
      }

      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[WorldFactsData] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }

      const result = await this._platform.data(DOMAIN, key, defaultValue);
      return result !== undefined && result !== null ? result : defaultValue;
    }

    async _set(key, value) {
      if (!this._platform) {
        console.warn('[WorldFactsData] Platform 未初始化，无法写入数据');
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
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.WorldFacts = WorldFactsData;

  console.log('[Schema] WorldFactsData 已加载 v1.0.0');
})();
