/**
 * InvitationData - NPC邀约数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:invitation:{key}
 *
 * 邀约类型：社交/任务/地点/特殊
 */

;(function () {
  'use strict';

  const DOMAIN = 'invitation';

  // 邀约类型
  const INVITATION_TYPE = {
    SOCIAL: 'social',     // 社交邀约（喝咖啡、吃饭等）
    QUEST: 'quest',       // 任务邀约（请求帮助）
    LOCATION: 'location', // 地点邀约（来某地见面）
    SPECIAL: 'special',   // 特殊邀约（节日、事件等）
  };

  // 邀约状态
  const INVITATION_STATUS = {
    PENDING: 'pending',     // 待响应
    ACCEPTED: 'accepted',   // 已接受
    DECLINED: 'declined',   // 已拒绝
    EXPIRED: 'expired',     // 已过期
    CANCELLED: 'cancelled', // 已取消
  };

  class InvitationData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 基础CRUD ====================

    async getList(charId) {
      return await this._platform.data(DOMAIN, charId + ':list', []);
    }

    async saveList(charId, list) {
      await this._platform.setData(DOMAIN, charId + ':list', list);
    }

    async getById(charId, invitationId) {
      const list = await this.getList(charId);
      return list.find(inv => inv.id === invitationId) || null;
    }

    async save(charId, invitation) {
      const list = await this.getList(charId);
      const idx = list.findIndex(inv => inv.id === invitation.id);
      if (idx >= 0) {
        list[idx] = invitation;
      } else {
        list.push(invitation);
      }
      await this.saveList(charId, list);
      return invitation;
    }

    // ==================== 创建邀约 ====================

    async create(charId, {
      npcId,
      npcName,
      type = INVITATION_TYPE.SOCIAL,
      message,
      location,
      expiresAt,
      relatedQuestId = null,
      metadata = {}
    }) {
      const invitation = {
        id: this._generateId(),
        npcId,
        npcName,
        type,
        message,
        location,
        status: INVITATION_STATUS.PENDING,
        createdAt: Date.now(),
        expiresAt: expiresAt || (Date.now() + 24 * 60 * 60 * 1000), // 默认24小时过期
        respondedAt: null,
        relatedQuestId,
        metadata,
      };

      await this.save(charId, invitation);
      return invitation;
    }

    // ==================== 查询操作 ====================

    async getAll(charId) {
      return await this.getList(charId);
    }

    async getPending(charId) {
      const list = await this.getList(charId);
      return list.filter(inv => inv.status === INVITATION_STATUS.PENDING);
    }

    async getByNPC(charId, npcId) {
      const list = await this.getList(charId);
      return list.filter(inv => inv.npcId === npcId);
    }

    async getByType(charId, type) {
      const list = await this.getList(charId);
      return list.filter(inv => inv.type === type);
    }

    // ==================== 响应操作 ====================

    async accept(charId, invitationId, extra = {}) {
      const invitation = await this.getById(charId, invitationId);
      if (!invitation) return null;

      invitation.status = INVITATION_STATUS.ACCEPTED;
      invitation.respondedAt = Date.now();
      Object.assign(invitation, extra);

      await this.save(charId, invitation);
      return invitation;
    }

    async decline(charId, invitationId, reason = '') {
      const invitation = await this.getById(charId, invitationId);
      if (!invitation) return null;

      invitation.status = INVITATION_STATUS.DECLINED;
      invitation.respondedAt = Date.now();
      invitation.declineReason = reason;

      await this.save(charId, invitation);
      return invitation;
    }

    async cancel(charId, invitationId) {
      const invitation = await this.getById(charId, invitationId);
      if (!invitation) return null;

      invitation.status = INVITATION_STATUS.CANCELLED;
      invitation.cancelledAt = Date.now();

      await this.save(charId, invitation);
      return invitation;
    }

    // ==================== 过期检查 ====================

    async checkExpired(charId) {
      const list = await this.getList(charId);
      const now = Date.now();
      let hasChanges = false;

      for (const inv of list) {
        if (inv.status === INVITATION_STATUS.PENDING && inv.expiresAt < now) {
          inv.status = INVITATION_STATUS.EXPIRED;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.saveList(charId, list);
      }

      return list.filter(inv => inv.status === INVITATION_STATUS.EXPIRED);
    }

    // ==================== 清理 ====================

    async delete(charId, invitationId) {
      const list = await this.getList(charId);
      const idx = list.findIndex(inv => inv.id === invitationId);
      if (idx >= 0) {
        list.splice(idx, 1);
        await this.saveList(charId, list);
        return true;
      }
      return false;
    }

    async clearAll(charId) {
      await this._platform.setData(DOMAIN, charId + ':list', []);
    }

    async clearCompleted(charId) {
      const list = await this.getList(charId);
      const filtered = list.filter(inv =>
        inv.status === INVITATION_STATUS.PENDING
      );
      await this.saveList(charId, filtered);
      return list.length - filtered.length;
    }

    // ==================== 工具方法 ====================

    _generateId() {
      return 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // 挂载到全局
  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Invitation = InvitationData;
  window.INVITATION_TYPE = INVITATION_TYPE;
  window.INVITATION_STATUS = INVITATION_STATUS;

  console.log('[Schema] InvitationData 已加载');
})();
