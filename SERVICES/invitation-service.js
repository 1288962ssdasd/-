/**
 * @layer Service
 * @file   invitation-service.js
 * @depends InvitationData, NPCData, HistoryData, Platform
 * @emits  invitation:created, invitation:accepted, invitation:declined, invitation:expired
 *
 * 职责: NPC邀约管理 - 创建、响应、过期处理
 * 禁止: 操作DOM、直接调用SillyTavern API
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class InvitationService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._invitationData = new (window.PhoneData?.Invitation || function () {})(this._platform);
      this._npcData = new (window.PhoneData?.NPC || function () {})(this._platform);
      this._historyData = new (window.PhoneData?.History || function () {})(this._platform);

      // 配置
      this._checkInterval = null;
      this._defaultExpiry = 24 * 60 * 60 * 1000; // 24小时
    }

    /**
     * 初始化服务
     */
    async init() {
      console.log('[InvitationService] 初始化...');

      // 启动过期检查定时器
      this._startExpiryCheck();

      console.log('[InvitationService] 初始化完成');
    }

    /**
     * 创建邀约
     * [铁则十二] Service是唯一数据加工厂
     */
    async createInvitation(charId, {
      npcId,
      type = window.INVITATION_TYPE?.SOCIAL || 'social',
      message,
      location,
      expiresAt,
      relatedQuestId = null,
      metadata = {}
    }) {
      try {
        // 获取NPC信息
        const npc = await this._npcData.getById(charId, npcId);
        const npcName = npc?.name || '未知NPC';

        // 创建邀约
        const invitation = await this._invitationData.create(charId, {
          npcId,
          npcName,
          type,
          message: message || `${npcName} 向你发出了一个邀约`,
          location,
          expiresAt: expiresAt || (Date.now() + this._defaultExpiry),
          relatedQuestId,
          metadata
        });

        // 记录历史
        await this._historyData.recordInvitationSent(charId, invitation.id, npcId, npcName);

        // 发射事件
        this._emitEvent('invitation:created', {
          invitationId: invitation.id,
          npcId,
          npcName,
          type
        });

        console.log('[InvitationService] 邀约已创建:', invitation.id, '来自', npcName);
        return invitation;
      } catch (e) {
        console.warn('[InvitationService] 创建邀约失败:', e);
        return null;
      }
    }

    /**
     * 接受邀约
     */
    async acceptInvitation(charId, invitationId, extra = {}) {
      try {
        const invitation = await this._invitationData.accept(charId, invitationId, extra);
        if (!invitation) return null;

        // 记录历史
        await this._historyData.recordInvitationAccepted(
          charId,
          invitationId,
          invitation.npcId,
          invitation.npcName
        );

        // 发射事件
        this._emitEvent('invitation:accepted', {
          invitationId,
          npcId: invitation.npcId,
          npcName: invitation.npcName,
          relatedQuestId: invitation.relatedQuestId
        });

        // 如果有关联任务，触发任务开始
        if (invitation.relatedQuestId) {
          const questService = this._platform.get?.('questService');
          if (questService?.acceptQuest) {
            await questService.acceptQuest(charId, invitation.relatedQuestId);
          }
        }

        console.log('[InvitationService] 邀约已接受:', invitationId);
        return invitation;
      } catch (e) {
        console.warn('[InvitationService] 接受邀约失败:', e);
        return null;
      }
    }

    /**
     * 拒绝邀约
     */
    async declineInvitation(charId, invitationId, reason = '') {
      try {
        const invitation = await this._invitationData.decline(charId, invitationId, reason);
        if (!invitation) return null;

        // 发射事件
        this._emitEvent('invitation:declined', {
          invitationId,
          npcId: invitation.npcId,
          npcName: invitation.npcName,
          reason
        });

        console.log('[InvitationService] 邀约已拒绝:', invitationId);
        return invitation;
      } catch (e) {
        console.warn('[InvitationService] 拒绝邀约失败:', e);
        return null;
      }
    }

    /**
     * 获取待处理邀约
     */
    async getPendingInvitations(charId) {
      try {
        // 先检查过期
        await this._invitationData.checkExpired(charId);
        return await this._invitationData.getPending(charId);
      } catch (e) {
        console.warn('[InvitationService] 获取待处理邀约失败:', e);
        return [];
      }
    }

    /**
     * 获取所有邀约
     */
    async getAllInvitations(charId) {
      try {
        await this._invitationData.checkExpired(charId);
        return await this._invitationData.getAll(charId);
      } catch (e) {
        console.warn('[InvitationService] 获取所有邀约失败:', e);
        return [];
      }
    }

    /**
     * 获取NPC的邀约
     */
    async getInvitationsByNPC(charId, npcId) {
      try {
        return await this._invitationData.getByNPC(charId, npcId);
      } catch (e) {
        console.warn('[InvitationService] 获取NPC邀约失败:', e);
        return [];
      }
    }

    /**
     * 取消邀约
     */
    async cancelInvitation(charId, invitationId) {
      try {
        const invitation = await this._invitationData.cancel(charId, invitationId);
        if (invitation) {
          this._emitEvent('invitation:cancelled', {
            invitationId,
            npcId: invitation.npcId,
            npcName: invitation.npcName
          });
        }
        return invitation;
      } catch (e) {
        console.warn('[InvitationService] 取消邀约失败:', e);
        return null;
      }
    }

    /**
     * 删除邀约
     */
    async deleteInvitation(charId, invitationId) {
      try {
        return await this._invitationData.delete(charId, invitationId);
      } catch (e) {
        console.warn('[InvitationService] 删除邀约失败:', e);
        return false;
      }
    }

    /**
     * 清理已完成邀约
     */
    async clearCompleted(charId) {
      try {
        const count = await this._invitationData.clearCompleted(charId);
        console.log('[InvitationService] 已清理', count, '个已完成邀约');
        return count;
      } catch (e) {
        console.warn('[InvitationService] 清理邀约失败:', e);
        return 0;
      }
    }

    /**
     * 启动过期检查
     */
    _startExpiryCheck() {
      // 每5分钟检查一次过期
      this._checkInterval = setInterval(() => {
        this._checkAllExpired();
      }, 5 * 60 * 1000);
    }

    /**
     * 检查所有角色卡的过期邀约
     */
    async _checkAllExpired() {
      try {
        // 获取当前角色卡ID
        const charId = await this._getCurrentCharId();
        if (!charId) return;

        const expired = await this._invitationData.checkExpired(charId);
        if (expired.length > 0) {
          console.log('[InvitationService] 发现', expired.length, '个过期邀约');
          for (const inv of expired) {
            this._emitEvent('invitation:expired', {
              invitationId: inv.id,
              npcId: inv.npcId,
              npcName: inv.npcName
            });
          }
        }
      } catch (e) {
        console.warn('[InvitationService] 检查过期失败:', e);
      }
    }

    /**
     * 获取当前角色卡ID
     */
    async _getCurrentCharId() {
      try {
        if (this._platform?.adapter?.getCurrentCharacterId) {
          return await this._platform.adapter.getCurrentCharacterId();
        }
        // 降级方案
        const ctx = this._platform?.adapter?.getContext?.();
        return ctx?.characterId || ctx?.charId || null;
      } catch (e) {
        return null;
      }
    }

    /**
     * 发射事件
     */
    _emitEvent(eventName, data) {
      try {
        const eventBus = this._platform?.eventBus;
        if (eventBus?.emit) {
          eventBus.emit(eventName, {
            id: this._generateId(),
            type: eventName,
            data,
            timestamp: Date.now(),
            source: 'invitation-service'
          });
        }
      } catch (e) {
        console.warn('[InvitationService] 发射事件失败:', e);
      }
    }

    _generateId() {
      return 'inv_svc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 销毁服务
     */
    destroy() {
      if (this._checkInterval) {
        clearInterval(this._checkInterval);
        this._checkInterval = null;
      }
    }
  }

  // 挂载到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Invitation = InvitationService;

  console.log('[Service] InvitationService 已加载');
})();
