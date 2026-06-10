/**
 * NPCData - NPC数据 Schema
 *
 * @deprecated v4.31.0 已废弃，请使用 FriendsData 替代
 * 
 * 迁移说明：
 * - NPCData.getAll(charId) → FriendsData.getNPCs()
 * - NPCData.getById(charId, npcId) → FriendsData.getNPCById(npcId)
 * - NPCData.add(charId, npc) → FriendsData.addNPC(npc)
 * - NPCData.update(charId, npcId, updates) → FriendsData.updateNPC(npcId, updates)
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:npc:{key}
 * 
 * [v4.31.0] 数据源合并：NPC 数据统一存储在 FriendsData 中
 */

;(function () {
  'use strict';

  var DOMAIN = 'npc';

  class NPCData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    async getAll(charId) {
      var data = await this._platform.data(DOMAIN, charId + ':list', null);
      return data || [];
    }

    async saveAll(charId, npcs) {
      await this._platform.setData(DOMAIN, charId + ':list', npcs);
    }

    async getById(charId, npcId) {
      var npcs = await this.getAll(charId);
      return npcs.find(function (n) { return n.id === npcId; }) || null;
    }

    async add(charId, npc) {
      var npcs = await this.getAll(charId);
      npcs.push(npc);
      await this.saveAll(charId, npcs);
      return npc;
    }

    async update(charId, npcId, updates) {
      var npcs = await this.getAll(charId);
      var idx = npcs.findIndex(function (n) { return n.id === npcId; });
      if (idx >= 0) {
        npcs[idx] = Object.assign({}, npcs[idx], updates);
        await this.saveAll(charId, npcs);
        return npcs[idx];
      }
      return null;
    }

    async getContacts(charId) {
      var npcs = await this.getAll(charId);
      return npcs.filter(function (n) { return n.isContact; });
    }

    async getStrangers(charId) {
      var npcs = await this.getAll(charId);
      return npcs.filter(function (n) { return !n.isContact; });
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.NPC = NPCData;

  console.log('[Schema] NPCData 已加载');
})();
