/**
 * HistoryData - 事件时间线 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:history:{key}
 *
 * 用于记录世界事件历史，供AI上下文装配使用
 */

;(function () {
  'use strict';

  const DOMAIN = 'history';

  // 事件类型
  const EVENT_TYPE = {
    WORLD_GENERATED: 'world:generated',       // 世界生成完成
    WORLD_EVOLVED: 'world:evolved',           // 世界推演完成
    STAGE_REVEALED: 'world:stageRevealed',    // 洋葱层级揭示
    ATMOSPHERE_CHANGED: 'world:atmosphereChanged', // 世界氛围变化
    NPC_BEHAVIOR: 'npc:behaviorDecided',      // NPC行为意图
    NPC_MOOD: 'npc:moodChanged',              // NPC心情变化
    NPC_RELATIONSHIP: 'npc:relationshipChanged', // NPC关系变化
    NPC_EXTRACTED: 'npc:extracted',           // 陌路人提取
    QUEST_GENERATED: 'quest:generated',       // 任务生成
    QUEST_STARTED: 'quest:started',           // 玩家接取任务
    QUEST_STEP: 'quest:stepCompleted',        // 步骤完成
    QUEST_COMPLETED: 'quest:completed',       // 任务完成
    QUEST_FAILED: 'quest:failed',             // 任务失败
    QUEST_INVITATION: 'quest:invitation',     // NPC发出邀约
    INVITATION_ACCEPTED: 'quest:invitationAccepted', // 接受邀约
    MESSAGE_SENT: 'message:sent',             // 消息发送
    MESSAGE_RECEIVED: 'message:received',     // 消息接收
    MOMENT_PUBLISHED: 'moment:published',     // 朋友圈发布
    MAP_LOCATION: 'map:locationChanged',      // 位置切换
    CHARACTER_SWITCHED: 'character:switched', // 角色卡切换
    CHAT_MESSAGES: 'chat:messagesAdded',      // ST新消息
  };

  class HistoryData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 基础CRUD ====================

    async getTimeline(charId) {
      return await this._platform.data(DOMAIN, charId + ':events', []);
    }

    async saveTimeline(charId, timeline) {
      await this._platform.setData(DOMAIN, charId + ':events', timeline);
    }

    // ==================== 事件记录 ====================

    async addEvent(charId, {
      type,
      data = {},
      source = 'system',
      importance = 1, // 1-5，重要性等级
    }) {
      const event = {
        id: this._generateId(),
        type,
        data,
        source,
        importance,
        timestamp: Date.now(),
      };

      const timeline = await this.getTimeline(charId);
      timeline.push(event);

      // 按时间排序
      timeline.sort((a, b) => a.timestamp - b.timestamp);

      // 限制历史记录数量（保留最近500条）
      if (timeline.length > 500) {
        timeline.splice(0, timeline.length - 500);
      }

      await this.saveTimeline(charId, timeline);
      return event;
    }

    // ==================== 查询操作 ====================

    async getAll(charId) {
      return await this.getTimeline(charId);
    }

    async getRecent(charId, count = 10) {
      const timeline = await this.getTimeline(charId);
      return timeline.slice(-count);
    }

    async getByType(charId, type) {
      const timeline = await this.getTimeline(charId);
      return timeline.filter(e => e.type === type);
    }

    async getSince(charId, timestamp) {
      const timeline = await this.getTimeline(charId);
      return timeline.filter(e => e.timestamp >= timestamp);
    }

    async getByImportance(charId, minImportance = 3) {
      const timeline = await this.getTimeline(charId);
      return timeline.filter(e => e.importance >= minImportance);
    }

    // ==================== 世界生成记录 ====================

    async recordWorldGenerated(charId, worldData) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.WORLD_GENERATED,
        data: {
          worldName: worldData?.meta?.truth?.background?.substring(0, 100),
          stage: worldData?.meta?.currentStage || 1,
        },
        source: 'world-service',
        importance: 5,
      });
    }

    async recordWorldEvolved(charId, changes) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.WORLD_EVOLVED,
        data: changes,
        source: 'director-service',
        importance: 4,
      });
    }

    async recordStageRevealed(charId, newStage) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.STAGE_REVEALED,
        data: { newStage },
        source: 'world-service',
        importance: 5,
      });
    }

    // ==================== NPC相关记录 ====================

    async recordNPCBehavior(charId, npcId, behavior) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.NPC_BEHAVIOR,
        data: { npcId, behavior },
        source: 'npc-social-service',
        importance: 2,
      });
    }

    async recordNPCMoodChange(charId, npcId, oldMood, newMood, reason) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.NPC_MOOD,
        data: { npcId, oldMood, newMood, reason },
        source: 'npc-social-service',
        importance: 2,
      });
    }

    async recordNPCRelationshipChange(charId, npcId, delta, newValue) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.NPC_RELATIONSHIP,
        data: { npcId, delta, newValue },
        source: 'npc-social-service',
        importance: 3,
      });
    }

    async recordNPCExtracted(charId, npcData) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.NPC_EXTRACTED,
        data: { npcId: npcData.id, name: npcData.name },
        source: 'npc-generator-service',
        importance: 3,
      });
    }

    // ==================== 任务相关记录 ====================

    async recordQuestGenerated(charId, questId, questName) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.QUEST_GENERATED,
        data: { questId, questName },
        source: 'quest-service',
        importance: 3,
      });
    }

    async recordQuestStarted(charId, questId, questName) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.QUEST_STARTED,
        data: { questId, questName },
        source: 'quest-service',
        importance: 3,
      });
    }

    async recordQuestCompleted(charId, questId, questName, rewards) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.QUEST_COMPLETED,
        data: { questId, questName, rewards },
        source: 'quest-service',
        importance: 4,
      });
    }

    async recordQuestFailed(charId, questId, questName, reason) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.QUEST_FAILED,
        data: { questId, questName, reason },
        source: 'quest-service',
        importance: 3,
      });
    }

    async recordInvitationSent(charId, invitationId, npcId, npcName) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.QUEST_INVITATION,
        data: { invitationId, npcId, npcName },
        source: 'invitation-service',
        importance: 3,
      });
    }

    async recordInvitationAccepted(charId, invitationId, npcId, npcName) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.INVITATION_ACCEPTED,
        data: { invitationId, npcId, npcName },
        source: 'invitation-service',
        importance: 3,
      });
    }

    // ==================== 社交相关记录 ====================

    async recordMessageSent(charId, messageId, toNPCId) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.MESSAGE_SENT,
        data: { messageId, toNPCId },
        source: 'message-service',
        importance: 1,
      });
    }

    async recordMessageReceived(charId, messageId, fromNPCId) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.MESSAGE_RECEIVED,
        data: { messageId, fromNPCId },
        source: 'message-service',
        importance: 1,
      });
    }

    async recordMomentPublished(charId, momentId, npcId) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.MOMENT_PUBLISHED,
        data: { momentId, npcId },
        source: 'friends-circle-service',
        importance: 2,
      });
    }

    // ==================== 地图相关记录 ====================

    async recordLocationChanged(charId, oldLocation, newLocation) {
      return await this.addEvent(charId, {
        type: EVENT_TYPE.MAP_LOCATION,
        data: { oldLocation, newLocation },
        source: 'map-service',
        importance: 2,
      });
    }

    // ==================== 清理 ====================

    async clearAll(charId) {
      await this._platform.setData(DOMAIN, charId + ':events', []);
    }

    async clearOldEvents(charId, olderThan) {
      const timeline = await this.getTimeline(charId);
      const filtered = timeline.filter(e => e.timestamp >= olderThan);
      await this.saveTimeline(charId, filtered);
      return timeline.length - filtered.length;
    }

    // ==================== 工具方法 ====================

    _generateId() {
      return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 格式化时间线为AI上下文
    async formatForAI(charId, options = {}) {
      const {
        maxEvents = 20,
        minImportance = 1,
        types = null, // null表示所有类型
      } = options;

      let events = await this.getTimeline(charId);

      // 过滤
      events = events.filter(e => e.importance >= minImportance);
      if (types) {
        events = events.filter(e => types.includes(e.type));
      }

      // 取最近的事件
      events = events.slice(-maxEvents);

      // 格式化
      return events.map(e => ({
        time: new Date(e.timestamp).toISOString(),
        type: e.type,
        description: this._formatEventDescription(e),
      }));
    }

    _formatEventDescription(event) {
      const { type, data } = event;
      switch (type) {
        case EVENT_TYPE.WORLD_GENERATED:
          return `世界生成完成，当前层级: ${data.stage}`;
        case EVENT_TYPE.STAGE_REVEALED:
          return `洋葱层级揭示到 L${data.newStage}`;
        case EVENT_TYPE.QUEST_COMPLETED:
          return `完成任务: ${data.questName}`;
        case EVENT_TYPE.QUEST_STARTED:
          return `开始任务: ${data.questName}`;
        case EVENT_TYPE.INVITATION_ACCEPTED:
          return `接受邀约: ${data.npcName}`;
        case EVENT_TYPE.MAP_LOCATION:
          return `从 ${data.oldLocation} 移动到 ${data.newLocation}`;
        default:
          return `${type}: ${JSON.stringify(data).substring(0, 100)}`;
      }
    }
  }

  // 挂载到全局
  window.PhoneData = window.PhoneData || {};
  window.PhoneData.History = HistoryData;
  window.HISTORY_EVENT_TYPE = EVENT_TYPE;

  console.log('[Schema] HistoryData 已加载');
})();
