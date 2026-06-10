/**
 * StatusData - 状态数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Status
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'status';

  /**
   * StatusData 状态数据操作类
   */
  class StatusData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 用户状态 ====================

    /**
     * 获取用户状态
     * @returns {Promise<Object>}
     */
    async getUserStatus() {
      return await this._get('userStatus', {
        name: '',
        level: 1,
        exp: 0,
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        gold: 0,
        outfit: {
          head: null,
          body: null,
          accessory: null,
        },
        memories: [],
      });
    }

    /**
     * 更新用户状态
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateUserStatus(updates) {
      const current = await this.getUserStatus();
      await this._set('userStatus', { ...current, ...updates });
      this._emit('status:userUpdated', { updates });
      return true;
    }

    /**
     * 更新着装
     * @param {string} slot
     * @param {Object} item
     * @returns {Promise<boolean>}
     */
    async updateOutfit(slot, item) {
      const status = await this.getUserStatus();
      status.outfit = status.outfit || {};
      status.outfit[slot] = item;
      await this._set('userStatus', status);
      this._emit('status:outfitUpdated', { slot, item });
      return true;
    }

    /**
     * 添加记忆
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async addMemory(memory) {
      const status = await this.getUserStatus();
      status.memories = status.memories || [];
      status.memories.push({
        id: this._generateId(),
        content: memory.content || '',
        timestamp: Date.now(),
        importance: memory.importance || 0,
      });
      await this._set('userStatus', status);
      this._emit('status:memoryAdded', { memory });
      return true;
    }

    // ==================== NPC 状态 ====================

    /**
     * 获取 NPC 列表
     * @returns {Promise<Array>}
     */
    async getNPCList() {
      return await this._get('npcList', []);
    }

    /**
     * 获取单个 NPC 状态
     * @param {string} npcId
     * @returns {Promise<Object|null>}
     */
    async getNPCStatus(npcId) {
      const npcs = await this.getNPCList();
      return npcs.find(n => n.id === npcId) || null;
    }

    /**
     * 设置 NPC 列表
     * @param {Array} npcs
     * @returns {Promise<boolean>}
     */
    async setNPCList(npcs) {
      await this._set('npcList', npcs);
      this._emit('status:npcsUpdated', { npcs });
      return true;
    }

    /**
     * 添加 NPC
     * @param {Object} npc
     * @returns {Promise<Object>}
     */
    async addNPC(npc) {
      const npcs = await this.getNPCList();

      const newNPC = {
        id: npc.id || this._generateId(),
        name: npc.name || '未知NPC',
        avatar: npc.avatar || '',
        relationship: npc.relationship || 0,
        mood: npc.mood || 'neutral',
        location: npc.location || '',
        memories: npc.memories || [],
        attributes: npc.attributes || {},
      };

      npcs.push(newNPC);
      await this._set('npcList', npcs);

      this._emit('status:npcAdded', { npc: newNPC });
      return newNPC;
    }

    /**
     * 更新 NPC 状态
     * @param {string} npcId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateNPCStatus(npcId, updates) {
      const npcs = await this.getNPCList();
      const npc = npcs.find(n => n.id === npcId);

      if (!npc) return false;

      Object.assign(npc, updates);
      await this._set('npcList', npcs);

      this._emit('status:npcUpdated', { npcId, updates });
      return true;
    }

    /**
     * 添加 NPC 记忆
     * @param {string} npcId
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async addNPCMemory(npcId, memory) {
      const npcs = await this.getNPCList();
      const npc = npcs.find(n => n.id === npcId);

      if (!npc) return false;

      npc.memories = npc.memories || [];
      npc.memories.push({
        id: this._generateId(),
        content: memory.content || '',
        timestamp: Date.now(),
      });

      await this._set('npcList', npcs);
      this._emit('status:npcMemoryAdded', { npcId, memory });
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅用户状态变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeUserStatus(callback) {
      return this._subscribe('userStatus', callback);
    }

    /**
     * 订阅 NPC 列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeNPCList(callback) {
      return this._subscribe('npcList', callback);
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
      // no-op: 事件发射由 StatusService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'npc_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Status = StatusData;

  console.log('[Schema] StatusData 已加载');
})();
