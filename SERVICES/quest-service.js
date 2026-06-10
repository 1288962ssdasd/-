/**
 * @layer Service
 * @file   quest-service.js
 * @depends QuestData, FriendsData, HistoryData, EconomyData, Platform
 * @emits  quest:created, quest:started, quest:completed, quest:failed, quest:stepCompleted
 *
 * 职责: 任务业务逻辑 - 创建、管理、完成任务
 * 禁止: 操作DOM、直接调用SillyTavern API
 * [v4.31.0] 数据源合并：NPC 数据从 FriendsData 获取
 * [v2.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class QuestService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._questData = new (window.PhoneData?.Quest || function () {})(this._platform);
      // [v4.31.0] 数据源合并：NPC 数据从 FriendsData 获取
      this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);
      this._historyData = new (window.PhoneData?.History || function () {})(this._platform);
      this._economyData = new (window.PhoneData?.Economy || function () {})(this._platform);
    }

    /**
     * 初始化服务
     */
    async init() {
      console.log('[QuestService] 初始化...');
      console.log('[QuestService] 初始化完成');
    }

    /**
     * 获取所有任务
     */
    async getAllQuests(charId) {
      try {
        return await this._questData.getAll(charId);
      } catch (e) {
        console.warn('[QuestService] 获取所有任务失败:', e);
        return [];
      }
    }

    /**
     * 获取单个任务
     */
    async getQuest(charId, questId) {
      try {
        return await this._questData.getById(charId, questId);
      } catch (e) {
        console.warn('[QuestService] 获取任务失败:', e);
        return null;
      }
    }

    /**
     * 获取进行中任务
     */
    async getActiveQuests(charId) {
      try {
        return await this._questData.getActive(charId);
      } catch (e) {
        console.warn('[QuestService] 获取活跃任务失败:', e);
        return [];
      }
    }

    /**
     * 获取可接取任务
     */
    async getAvailableQuests(charId) {
      try {
        return await this._questData.getAvailable(charId);
      } catch (e) {
        console.warn('[QuestService] 获取可用任务失败:', e);
        return [];
      }
    }

    /**
     * 获取已完成任务
     */
    async getCompletedQuests(charId) {
      try {
        return await this._questData.getCompleted(charId);
      } catch (e) {
        console.warn('[QuestService] 获取已完成任务失败:', e);
        return [];
      }
    }

    /**
     * 创建任务
     * [铁则十二] Service是唯一数据加工厂
     */
    async createQuest(charId, questData) {
      try {
        // [v4.31.0-fix] 确保 id 不会被 undefined 覆盖
        const questId = questData?.id || 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const quest = {
          id: questId,
          name: questData.name || '未命名任务',
          description: questData.description || '',
          issuer: questData.issuer || null,
          issuerName: questData.issuerName || '未知',
          type: questData.type || 'side',
          status: questData.status || 'available',
          steps: questData.steps || [],
          rewards: questData.rewards || { gold: 0, relationship: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...questData,
          id: questId // 再次确保 id 正确
        };

        await this._questData.save(charId, quest);

        // 记录历史
        await this._historyData.recordQuestGenerated(charId, quest.id, quest.name);

        // 发射事件
        this._emitEvent('quest:created', {
          questId: quest.id,
          questName: quest.name,
          quest
        });

        console.log('[QuestService] 任务已创建:', quest.id);
        return quest;
      } catch (e) {
        console.warn('[QuestService] 创建任务失败:', e);
        return null;
      }
    }

    /**
     * 接受任务
     */
    async acceptQuest(charId, questId) {
      try {
        const quest = await this._questData.updateStatus(charId, questId, 'active', {
          startedAt: Date.now()
        });

        if (!quest) return null;

        // 记录历史
        await this._historyData.recordQuestStarted(charId, questId, quest.name);

        // 发射事件
        this._emitEvent('quest:started', {
          questId,
          questName: quest.name,
          quest
        });

        console.log('[QuestService] 任务已接受:', questId);
        return quest;
      } catch (e) {
        console.warn('[QuestService] 接受任务失败:', e);
        return null;
      }
    }

    /**
     * 完成任务步骤
     */
    async completeStep(charId, questId, stepIndex) {
      try {
        const quest = await this._questData.completeStep(charId, questId, stepIndex);

        if (!quest) return null;

        // 发射步骤完成事件
        this._emitEvent('quest:stepCompleted', {
          questId,
          stepIndex,
          step: quest.steps[stepIndex],
          quest
        });

        // 检查任务是否完成
        if (quest.status === 'reward') {
          // 自动完成任务
          await this.completeQuest(charId, questId);
        }

        console.log('[QuestService] 步骤已完成:', questId, stepIndex);
        return quest;
      } catch (e) {
        console.warn('[QuestService] 完成步骤失败:', e);
        return null;
      }
    }

    /**
     * 完成任务
     */
    async completeQuest(charId, questId) {
      try {
        const quest = await this._questData.updateStatus(charId, questId, 'completed', {
          completedAt: Date.now()
        });

        if (!quest) return null;

        // 发放奖励
        if (quest.rewards) {
          if (quest.rewards.gold > 0) {
            await this._economyData.addBalance(
              charId,
              'gold',
              quest.rewards.gold,
              `任务奖励: ${quest.name}`
            );
          }
        }

        // 记录历史
        await this._historyData.recordQuestCompleted(charId, questId, quest.name, quest.rewards);

        // 发射事件
        this._emitEvent('quest:completed', {
          questId,
          questName: quest.name,
          rewards: quest.rewards,
          quest
        });

        console.log('[QuestService] 任务已完成:', questId);
        return quest;
      } catch (e) {
        console.warn('[QuestService] 完成任务失败:', e);
        return null;
      }
    }

    /**
     * 放弃任务
     */
    async abandonQuest(charId, questId) {
      try {
        const quest = await this._questData.updateStatus(charId, questId, 'failed', {
          failedAt: Date.now(),
          failReason: '玩家放弃'
        });

        if (!quest) return null;

        // 记录历史
        await this._historyData.recordQuestFailed(charId, questId, quest.name, '玩家放弃');

        // 发射事件
        this._emitEvent('quest:failed', {
          questId,
          questName: quest.name,
          reason: '玩家放弃',
          quest
        });

        console.log('[QuestService] 任务已放弃:', questId);
        return quest;
      } catch (e) {
        console.warn('[QuestService] 放弃任务失败:', e);
        return null;
      }
    }

    /**
     * 失败任务
     */
    async failQuest(charId, questId, reason = '') {
      try {
        const quest = await this._questData.updateStatus(charId, questId, 'failed', {
          failedAt: Date.now(),
          failReason: reason
        });

        if (!quest) return null;

        // 记录历史
        await this._historyData.recordQuestFailed(charId, questId, quest.name, reason);

        // 发射事件
        this._emitEvent('quest:failed', {
          questId,
          questName: quest.name,
          reason,
          quest
        });

        console.log('[QuestService] 任务已失败:', questId);
        return quest;
      } catch (e) {
        console.warn('[QuestService] 标记任务失败失败:', e);
        return null;
      }
    }

    /**
     * 删除任务
     */
    async deleteQuest(charId, questId) {
      try {
        const result = await this._questData.delete(charId, questId);
        console.log('[QuestService] 任务已删除:', questId);
        return result;
      } catch (e) {
        console.warn('[QuestService] 删除任务失败:', e);
        return false;
      }
    }

    /**
     * 清空所有任务
     */
    async clearAllQuests(charId) {
      try {
        await this._questData.clearAll(charId);
        console.log('[QuestService] 所有任务已清空');
        return true;
      } catch (e) {
        console.warn('[QuestService] 清空任务失败:', e);
        return false;
      }
    }

    /**
     * 获取任务统计
     */
    async getQuestStats(charId) {
      try {
        const all = await this._questData.getAll(charId);
        return {
          total: all.length,
          active: all.filter(q => q.status === 'active').length,
          completed: all.filter(q => q.status === 'completed').length,
          failed: all.filter(q => q.status === 'failed').length,
          available: all.filter(q => q.status === 'available').length
        };
      } catch (e) {
        console.warn('[QuestService] 获取统计失败:', e);
        return { total: 0, active: 0, completed: 0, failed: 0, available: 0 };
      }
    }

    // ==================== TaskModule 兼容方法 ====================
    // [铁则七] TaskModule 调用的方法签名与 QuestService 不一致，
    // 这里提供兼容适配，内部自动获取 charId

    /**
     * 获取当前角色卡ID（内部辅助）
     * [修复] 优先使用 Platform.adapter.getCurrentCharacterId()
     */
    async _getCharId() {
      try {
        // [铁则六] 通过适配器获取当前角色ID
        const adapter = this._platform?.get?.('adapter') || this._platform?.adapter;
        if (adapter && typeof adapter.getCurrentCharacterId === 'function') {
          const charId = await adapter.getCurrentCharacterId();
          if (charId) return charId;
        }
        // 降级：尝试从平台上下文获取
        const ctxCharId = this._platform?.context?.getCurrentCharId?.();
        if (ctxCharId) return ctxCharId;
        return 'default';
      } catch (e) {
        console.warn('[QuestService] 获取角色ID失败:', e);
        return 'default';
      }
    }

    /**
     * 兼容: getAllQuests() 无参版本
     */
    async getAllQuestsCompat() {
      return await this.getAllQuests(await this._getCharId());
    }

    /**
     * 兼容: getActiveQuests() 无参版本
     */
    async getActiveQuestsCompat() {
      return await this.getActiveQuests(await this._getCharId());
    }

    /**
     * 兼容: getQuest(questId) 无 charId 版本
     */
    async getQuestCompat(questId) {
      return await this.getQuest(await this._getCharId(), questId);
    }

    /**
     * 兼容: getQuestsByStatus(status)
     */
    async getQuestsByStatus(status) {
      try {
        const charId = await this._getCharId();
        return await this._questData.getByStatus(charId, status);
      } catch (e) {
        console.warn('[QuestService] getQuestsByStatus 失败:', e);
        return [];
      }
    }

    /**
     * 兼容: markStepDone(taskId)
     */
    async markStepDone(taskId, stepIndex) {
      try {
        const charId = await this._getCharId();
        const quest = await this._questData.getById(charId, taskId);
        if (!quest || !quest.steps) return null;

        // 如果没指定 stepIndex，找到第一个未完成的步骤
        if (stepIndex === undefined) {
          stepIndex = quest.steps.findIndex(s => !s.completed);
          if (stepIndex < 0) return quest;
        }

        return await this.completeStep(charId, taskId, stepIndex);
      } catch (e) {
        console.warn('[QuestService] markStepDone 失败:', e);
        return null;
      }
    }

    /**
     * 兼容: getStepActionHint(step)
     */
    getStepActionHint(step) {
      if (!step) return '';
      const hints = {
        chat: '与对方对话',
        action: '完成指定操作',
        go: '前往目标地点',
        deliver: '交付物品',
        fight: '进行战斗',
        investigate: '调查线索',
        open_app: '打开对应应用'
      };
      return hints[step.type] || step.hint || '继续推进任务';
    }

    /**
     * 兼容: getFamilyInfo()
     */
    async getFamilyInfo() {
      try {
        const charId = await this._getCharId();
        const quests = await this._questData.getAll(charId);
        return {
          activeCount: quests.filter(q => q.status === 'active').length,
          availableCount: quests.filter(q => q.status === 'available').length,
          completedCount: quests.filter(q => q.status === 'completed').length
        };
      } catch (e) {
        console.warn('[QuestService] getFamilyInfo 失败:', e);
        return { activeCount: 0, availableCount: 0, completedCount: 0 };
      }
    }

    /**
     * 兼容: tryAutoCompleteFromAction()
     */
    async tryAutoCompleteFromAction(taskId, actionType) {
      try {
        const charId = await this._getCharId();
        const quest = await this._questData.getById(charId, taskId);
        if (!quest || quest.status !== 'active') return null;

        // 查找匹配 actionType 的未完成步骤
        const stepIndex = quest.steps.findIndex(s =>
          !s.completed && (s.type === actionType || s.actionType === actionType)
        );

        if (stepIndex >= 0) {
          return await this.completeStep(charId, taskId, stepIndex);
        }

        return quest;
      } catch (e) {
        console.warn('[QuestService] tryAutoCompleteFromAction 失败:', e);
        return null;
      }
    }

    /**
     * 兼容: subscribeQuests(callback) - 事件订阅
     */
    subscribeQuests(callback) {
      const eventBus = this._platform?.eventBus;
      if (!eventBus) {
        console.warn('[QuestService] EventBus 不可用，无法订阅');
        return () => {};
      }

      const handler = () => {
        try { callback(); } catch (e) { console.warn('[QuestService] 订阅回调异常:', e); }
      };

      eventBus.on('quest:created', handler);
      eventBus.on('quest:started', handler);
      eventBus.on('quest:completed', handler);
      eventBus.on('quest:failed', handler);
      eventBus.on('quest:stepCompleted', handler);

      // 返回取消订阅函数
      return () => {
        try {
          eventBus.off('quest:created', handler);
          eventBus.off('quest:started', handler);
          eventBus.off('quest:completed', handler);
          eventBus.off('quest:failed', handler);
          eventBus.off('quest:stepCompleted', handler);
        } catch (e) {}
      };
    }

    /**
     * 发射事件
     */
    _emitEvent(eventName, data) {
      try {
        const eventBus = this._platform?.eventBus;
        if (eventBus?.emit) {
          eventBus.emit(eventName, {
            id: 'quest_' + Date.now(),
            type: eventName,
            data,
            timestamp: Date.now(),
            source: 'quest-service'
          });
        }
      } catch (e) {
        console.warn('[QuestService] 发射事件失败:', e);
      }
    }
  }

  // 挂载到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Quest = QuestService;

  console.log('[Service] QuestService 已加载');
})();
