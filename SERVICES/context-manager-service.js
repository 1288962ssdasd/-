/**
 * ContextManagerService - 上下文管理服务
 *
 * [铁则合规]
 * - 铁则六：通过适配器获取角色信息
 * - 铁则九：错误降级
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  class ContextManagerService {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    /**
     * 构建消息上下文（支持群组）
     * @param {Object} options - { charId, groupId }
     * @returns {Promise<Object>}
     */
    async buildMessageContext(options = {}) {
      const { charId, groupId } = options;
      const context = {};

      if (groupId) {
        const Friends = window.PhoneData?.Friends;
        if (Friends) {
          const friendsData = new Friends(this._platform);
          context.groupInfo = await friendsData.getGroupContext(groupId);
        }
      }

      return context;
    }

    /**
     * 刷新角色元数据缓存
     * @param {string} charId
     */
    async refreshCharacterMeta(charId) {
      const CharacterMetadata = window.PhoneData?.CharacterMetadata;
      if (!CharacterMetadata) return;

      try {
        // [铁则六] 通过适配器获取角色信息
        const charInfo = await this._platform?.adapter?.getCharacterInfo?.();
        if (charInfo) {
          const meta = new CharacterMetadata(this._platform);
          await meta.set(charId, {
            ...charInfo,
            updatedAt: Date.now(),
          });
        }
      } catch (e) {
        console.warn('[ContextManagerService] 刷新角色元数据失败:', e);
      }
    }
  }

  // 暴露到全局
  if (!window.PhoneServices) window.PhoneServices = {};
  window.PhoneServices.ContextManager = ContextManagerService;

  console.log('[Service] ContextManagerService 已加载');
})();
