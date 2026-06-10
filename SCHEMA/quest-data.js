/**
 * QuestData - 任务数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:quest:{key}
 *
 * 任务状态机：locked → available → active → reward → completed
 *                                      ↓
 *                                   failed
 */

;(function () {
  'use strict';

  const DOMAIN = 'quest';

  // 任务状态常量
  const QUEST_STATUS = {
    LOCKED: 'locked',         // 条件未满足
    AVAILABLE: 'available',   // 可以接取
    ACTIVE: 'active',         // 正在进行
    REWARD: 'reward',         // 完成待领奖
    COMPLETED: 'completed',   // 已完成归档
    FAILED: 'failed',         // 失败
    ARCHIVED: 'archived',     // 已归档
  };

  class QuestData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 基础CRUD ====================

    async getRegistry(charId) {
      return await this._platform.data(DOMAIN, charId + ':registry', null);
    }

    async saveRegistry(charId, registry) {
      await this._platform.setData(DOMAIN, charId + ':registry', registry);
    }

    async getById(charId, questId) {
      const registry = await this.getRegistry(charId);
      if (!registry || !registry.quests) return null;
      return registry.quests.find(q => q.id === questId) || null;
    }

    async save(charId, quest) {
      const registry = await this.getRegistry(charId) || { quests: [], version: '2.0' };
      const idx = registry.quests.findIndex(q => q.id === quest.id);
      if (idx >= 0) {
        registry.quests[idx] = quest;
      } else {
        registry.quests.push(quest);
      }
      await this.saveRegistry(charId, registry);
      return quest;
    }

    // ==================== 查询操作 ====================

    async getAll(charId) {
      const registry = await this.getRegistry(charId);
      return registry?.quests || [];
    }

    async getByStatus(charId, status) {
      const quests = await this.getAll(charId);
      return quests.filter(q => q.status === status);
    }

    async getActive(charId) {
      return await this.getByStatus(charId, QUEST_STATUS.ACTIVE);
    }

    async getAvailable(charId) {
      return await this.getByStatus(charId, QUEST_STATUS.AVAILABLE);
    }

    async getCompleted(charId) {
      return await this.getByStatus(charId, QUEST_STATUS.COMPLETED);
    }

    // ==================== 状态变更 ====================

    /** @deprecated 状态变更逻辑已迁移到 QuestService，请通过 Service 层调用 */
    async updateStatus(charId, questId, newStatus, extra = {}) {
      const quest = await this.getById(charId, questId);
      if (!quest) return null;

      quest.status = newStatus;
      quest.updatedAt = Date.now();

      if (newStatus === QUEST_STATUS.ACTIVE && !quest.startedAt) {
        quest.startedAt = Date.now();
      }
      if (newStatus === QUEST_STATUS.COMPLETED && !quest.completedAt) {
        quest.completedAt = Date.now();
      }
      if (newStatus === QUEST_STATUS.FAILED && !quest.failedAt) {
        quest.failedAt = Date.now();
      }

      Object.assign(quest, extra);
      await this.save(charId, quest);
      return quest;
    }

    /** @deprecated 步骤完成逻辑已迁移到 QuestService，请通过 Service 层调用 */
    async completeStep(charId, questId, stepIndex) {
      const quest = await this.getById(charId, questId);
      if (!quest || !quest.steps) return null;

      if (quest.steps[stepIndex]) {
        quest.steps[stepIndex].completed = true;
        quest.steps[stepIndex].completedAt = Date.now();
      }

      // 检查是否所有步骤完成
      const allCompleted = quest.steps.every(s => s.completed);
      if (allCompleted && quest.status === QUEST_STATUS.ACTIVE) {
        quest.status = QUEST_STATUS.REWARD;
      }

      quest.updatedAt = Date.now();
      await this.save(charId, quest);
      return quest;
    }

    // ==================== 邀约相关 ====================

    async getInvitations(charId) {
      const quests = await this.getAll(charId);
      return quests.filter(q => q.invitation && !q.invitation.responded);
    }

    /** @deprecated 邀约响应逻辑已迁移到 QuestService，请通过 Service 层调用 */
    async respondToInvitation(charId, questId, accepted) {
      const quest = await this.getById(charId, questId);
      if (!quest || !quest.invitation) return null;

      quest.invitation.responded = true;
      quest.invitation.accepted = accepted;
      quest.invitation.respondedAt = Date.now();

      if (accepted) {
        quest.status = QUEST_STATUS.ACTIVE;
        quest.startedAt = Date.now();
      } else {
        quest.status = QUEST_STATUS.ARCHIVED;
      }

      await this.save(charId, quest);
      return quest;
    }

    // ==================== 推演相关 ====================

    async savePrediction(charId, questId, prediction) {
      const quest = await this.getById(charId, questId);
      if (!quest) return null;

      quest.prediction = prediction;
      quest.updatedAt = Date.now();
      await this.save(charId, quest);
      return quest;
    }

    // ==================== 清理 ====================

    async delete(charId, questId) {
      const registry = await this.getRegistry(charId);
      if (!registry || !registry.quests) return false;

      const idx = registry.quests.findIndex(q => q.id === questId);
      if (idx >= 0) {
        registry.quests.splice(idx, 1);
        await this.saveRegistry(charId, registry);
        return true;
      }
      return false;
    }

    async clearAll(charId) {
      await this._platform.setData(DOMAIN, charId + ':registry', null);
    }
  }

  // 挂载到全局
  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Quest = QuestData;
  window.QUEST_STATUS = QUEST_STATUS;

  console.log('[Schema] QuestData 已加载');
})();
