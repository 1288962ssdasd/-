/**
 * 已读回执系统
 * 
 * 通过Schema更新消息的read状态，数据流正确
 * 铁则合规：数据更新通过Schema，纯UI状态显示
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  class ReadReceipt {
    /**
     * @param {Object} platform - Platform实例
     */
    constructor(platform) {
      this._platform = platform;
    }

    /**
     * 标记消息为已读
     * @param {string} friendId - 好友ID
     * @param {string} messageId - 消息ID（可选，不传则标记全部）
     */
    async markAsRead(friendId, messageId) {
      try {
        // 通过Schema更新消息的read状态
        const messages = await this._platform.data('messages', 'all', {});
        const chatKey = friendId;
        const chatMessages = messages[chatKey] || [];

        let updated = false;
        chatMessages.forEach(msg => {
          if (msg.senderId !== 'me' && !msg.isRead) {
            if (!messageId || msg.id === messageId) {
              msg.isRead = true;
              msg.readAt = Date.now();
              updated = true;
            }
          }
        });

        if (updated) {
          messages[chatKey] = chatMessages;
          await this._platform.setData('messages', 'all', messages, { persist: true });
        }
      } catch (e) {
        console.warn('[ReadReceipt] 标记已读失败:', e);
      }
    }

    /**
     * 获取消息的已读状态图标
     * @param {Object} msg - 消息对象
     * @param {boolean} isSelf - 是否是自己发的消息
     * @returns {string} HTML字符串
     */
    getStatusIcon(msg, isSelf) {
      if (!isSelf) return '';

      if (!msg.isDelivered) {
        return '<span class="receipt-icon" style="color:var(--color-text-time);font-size:10px;">⏳</span>';
      }
      if (!msg.isRead) {
        return '<span class="receipt-icon" style="color:var(--color-text-time);font-size:10px;">✓✓</span>';
      }
      return '<span class="receipt-icon" style="color:var(--color-brand-blue);font-size:10px;">✓✓</span>';
    }

    /**
     * 获取未读消息数
     * @param {string} friendId - 好友ID
     * @returns {Promise<number>}
     */
    async getUnreadCount(friendId) {
      try {
        const messages = await this._platform.data('messages', 'all', {});
        const chatMessages = messages[friendId] || [];
        return chatMessages.filter(m => m.senderId !== 'me' && !m.isRead).length;
      } catch (e) {
        return 0;
      }
    }

    /**
     * 获取已读详情（长按消息查看）
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<Object>}
     */
    async getReadDetails(friendId, messageId) {
      try {
        const messages = await this._platform.data('messages', 'all', {});
        const chatMessages = messages[friendId] || [];
        const msg = chatMessages.find(m => m.id === messageId);
        if (!msg) return null;

        return {
          messageId: msg.id,
          isRead: msg.isRead || false,
          readAt: msg.readAt || null,
          deliveredAt: msg.deliveredAt || null
        };
      } catch (e) {
        return null;
      }
    }
  }

  window.ReadReceipt = ReadReceipt;

})();
