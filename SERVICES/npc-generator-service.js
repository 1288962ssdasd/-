/**
 * NPCGeneratorService - NPC 生成服务
 *
 * [铁则合规]
 * - 铁则一：数据通过 Schema 写入
 * - 铁则六：通过适配器获取角色信息
 * - 铁则九：错误降级
 * - 铁则十二：Service 层是唯一数据加工厂
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  class NPCGeneratorService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._friendsData = new (window.PhoneData?.Friends)(this._platform);
    }

    /**
     * 生成 NPC 并添加到通讯录
     * @param {Object} context - { name, role, description }
     * @returns {Promise<Object|null>}
     */
    async generate(context) {
      const { name, role, description } = context;

      try {
        // 调用 AI 生成人设
        const llmGateway = new window.LLMGateway(this._platform);
        const npcProfile = await llmGateway.generate('npc-generator', {
          name,
          role,
          description,
          existingNPCs: await this._getExistingNPCNames(),
        });

        if (!npcProfile) {
          console.warn('[NPCGeneratorService] AI 生成失败');
          return null;
        }

        // [铁则一] 通过 Schema 写入
        const npcData = {
          id: this._generateId(),
          name: npcProfile.name || name,
          avatar: npcProfile.avatar || null,
          remark: role || '',
          personality: npcProfile.personality || '',
          source: 'auto-generated',
          createdAt: Date.now(),
        };

        await this._friendsData.add(npcData);

        // 记录事件到时间线
        await this._recordEvent(npcData);

        return npcData;
      } catch (e) {
        console.warn('[NPCGeneratorService] 生成失败:', e);
        return null;
      }
    }

    async _getExistingNPCNames() {
      const list = await this._friendsData.getList();
      return list.map(f => f.name);
    }

    _generateId() {
      return 'npc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    async _recordEvent(npcData) {
      const StoryEvents = window.PhoneData?.StoryEvents;
      if (!StoryEvents) return;

      try {
        const eventsData = new StoryEvents(this._platform);
        await eventsData.add({
          id: 'evt_' + Date.now().toString(36),
          type: 'npc-generated',
          summary: `新角色「${npcData.name}」加入了通讯录`,
          actors: [npcData.name],
        });
      } catch (e) {
        console.warn('[NPCGeneratorService] 记录事件失败:', e);
      }
    }
  }

  // 暴露到全局
  if (!window.PhoneServices) window.PhoneServices = {};
  window.PhoneServices.NPCGenerator = NPCGeneratorService;

  console.log('[Service] NPCGeneratorService 已加载');
})();
