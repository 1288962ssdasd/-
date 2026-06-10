/**
 * StatusService - 状态业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Status
 */

;(function () {
  'use strict';

  class StatusService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._statusData = new (window.PhoneData?.Status || function(){})(this._platform);
    }

    // 用户状态
    async getUserStatus() {
      try { return await this._statusData.getUserStatus(); }
      catch (e) { console.warn('[StatusService] getUserStatus 失败:', e); return null; }
    }

    /**
     * 导演 status 事件：target 为字段名，change 为增量或目标值
     */
    async updateField(target, change) {
      try {
        if (!target) return false;
        const field = String(target).toLowerCase();
        const map = { 金币: 'gold', money: 'gold', 金钱: 'gold' };
        const key = map[field] || field;

        const status = await this.getUserStatus() || {};
        const current = Number(status[key]) || 0;
        const raw = String(change ?? '').trim();
        let next = change;

        if (/^[+-]?\d+(\.\d+)?$/.test(raw)) {
          const num = parseFloat(raw);
          if (raw.startsWith('+') || raw.startsWith('-')) {
            next = current + num;
          } else {
            next = current + num;
          }
        }

        const economy = this._platform?.get?.('economyService');
        if (economy && (key === 'gold' || key === 'money')) {
          const delta = Number(next) - current;
          if (delta > 0) await economy.add(delta, 'gold', 'director_status');
          else if (delta < 0) await economy.spend(-delta, 'gold', 'director_status');
          return true;
        }

        return await this.updateUserStatus({ [key]: next });
      } catch (e) {
        console.warn('[StatusService] updateField 失败:', e);
        return false;
      }
    }

    async updateUserStatus(updates) {
      try {
        const result = await this._statusData.updateUserStatus(updates);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('status:userUpdated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'status:userUpdated',
            data: { field: Object.keys(updates || {}) },
            timestamp: Date.now(),
            source: 'status-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[StatusService] updateUserStatus 失败:', e); return false; }
    }

    async updateOutfit(slot, item) {
      try { return await this._statusData.updateOutfit(slot, item); }
      catch (e) { console.warn('[StatusService] updateOutfit 失败:', e); return false; }
    }

    async addMemory(memory) {
      try {
        const result = await this._statusData.addMemory(memory);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('status:memoryAdded', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'status:memoryAdded',
            data: { memoryId: result?.id },
            timestamp: Date.now(),
            source: 'status-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[StatusService] addMemory 失败:', e); return false; }
    }

    // NPC 状态
    async getNPCList() {
      try { return await this._statusData.getNPCList(); }
      catch (e) { console.warn('[StatusService] getNPCList 失败:', e); return []; }
    }

    async getNPCStatus(npcId) {
      try { return await this._statusData.getNPCStatus(npcId); }
      catch (e) { console.warn('[StatusService] getNPCStatus 失败:', e); return null; }
    }

    async addNPC(npc) {
      try {
        const result = await this._statusData.addNPC(npc);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('status:npcAdded', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'status:npcAdded',
            data: { npcId: result?.id, name: npc?.name },
            timestamp: Date.now(),
            source: 'status-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[StatusService] addNPC 失败:', e); return false; }
    }

    async updateNPCStatus(npcId, updates) {
      try {
        const result = await this._statusData.updateNPCStatus(npcId, updates);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('status:npcUpdated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'status:npcUpdated',
            data: { npcId },
            timestamp: Date.now(),
            source: 'status-service'
          });
        }
        return result;
      }
      catch (e) { console.warn('[StatusService] updateNPCStatus 失败:', e); return false; }
    }

    async addNPCMemory(npcId, memory) {
      try { return await this._statusData.addNPCMemory(npcId, memory); }
      catch (e) { console.warn('[StatusService] addNPCMemory 失败:', e); return false; }
    }

    // 订阅
    subscribeUserStatus(callback) {
      return this._statusData.subscribeUserStatus(callback);
    }

    subscribeNPCList(callback) {
      return this._statusData.subscribeNPCList(callback);
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Status = StatusService;

  console.log('[Service] StatusService 已加载');
})();
