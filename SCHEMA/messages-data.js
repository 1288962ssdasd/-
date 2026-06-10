/**
 * MessagesData - 消息数据 Schema 辅助函数
 * 
 * 扩展支持：voice(语音)、redpacket(红包)、transfer(转账)、sticker(表情)
 * 
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数
 */

;(function () {
  'use strict';

  const DOMAIN = 'messages';

  // 消息类型常量
  const MESSAGE_TYPES = {
    TEXT: 'text',           // 文本消息
    IMAGE: 'image',         // 图片消息
    VOICE: 'voice',         // 语音消息
    REDPACKET: 'redpacket', // 红包
    TRANSFER: 'transfer',   // 转账
    STICKER: 'sticker',     // 表情
    VIDEO: 'video',         // 视频
    LOCATION: 'location',   // 位置
  };

  /**
   * MessagesData 消息数据操作类
   */
  class MessagesData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有消息
     * @returns {Promise<Object>} { [friendId]: Message[] }
     */
    async getAll() {
      return await this._get('all', {});
    }

    /**
     * 获取与某个好友的消息
     * @param {string} friendId
     * @returns {Promise<Array>}
     */
    async getByFriendId(friendId) {
      const all = await this.getAll();
      return all[friendId] || [];
    }

    /**
     * 获取待发送队列
     * @returns {Promise<Array>}
     */
    async getPending() {
      return await this._get('pending', []);
    }

    /**
     * 获取最后同步时间
     * @returns {Promise<number>}
     */
    async getLastSync() {
      return await this._get('lastSync', 0);
    }

    // ==================== 写入操作 - 通用 ====================

    /**
     * 添加消息（通用方法）
     * @param {string} friendId
     * @param {Object} message - 消息对象，根据type不同有不同字段
     * @returns {Promise<Object>}
     */
    async add(friendId, message) {
      // [S-11] 数据验证（仅警告，不阻止写入）
      if (window.PhoneSchemas) {
        const result = window.PhoneSchemas.validate('messages', 'list', message);
        if (!result.valid) {
          console.warn('[MessagesData] 数据验证警告:', result.error);
        }
      }

      const all = await this.getAll();
      
      if (!all[friendId]) {
        all[friendId] = [];
      }

      const baseMessage = {
        id: message.id || this._generateId(),
        senderId: message.senderId || 'me',
        timestamp: message.timestamp || Date.now(),
        time: message.time || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        read: message.read || false,
      };

      // 根据类型构建不同的消息结构
      let newMessage;
      switch (message.type) {
        case MESSAGE_TYPES.VOICE:
          newMessage = this._buildVoiceMessage(baseMessage, message);
          break;
        case MESSAGE_TYPES.REDPACKET:
          newMessage = this._buildRedpacketMessage(baseMessage, message);
          break;
        case MESSAGE_TYPES.TRANSFER:
          newMessage = this._buildTransferMessage(baseMessage, message);
          break;
        case MESSAGE_TYPES.STICKER:
          newMessage = this._buildStickerMessage(baseMessage, message);
          break;
        case MESSAGE_TYPES.IMAGE:
          newMessage = this._buildImageMessage(baseMessage, message);
          break;
        case MESSAGE_TYPES.VIDEO:
          newMessage = this._buildVideoMessage(baseMessage, message);
          break;
        case MESSAGE_TYPES.LOCATION:
          newMessage = this._buildLocationMessage(baseMessage, message);
          break;
        case 'file':
          newMessage = this._buildFileMessage(baseMessage, message);
          break;
        default:
          newMessage = this._buildTextMessage(baseMessage, message);
      }

      all[friendId].push(newMessage);
      await this._set('all', all);
      
      this._emit('messages:added', { friendId, message: newMessage });
      return newMessage;
    }

    // ==================== 各类型消息构建 ====================

    _buildTextMessage(base, message) {
      // 兼容 text 和 content 两种字段名，确保渲染层能正确读取
      const textContent = message.text || message.content || '';
      return {
        ...base,
        type: MESSAGE_TYPES.TEXT,
        text: textContent,
        content: textContent, // 添加 content 字段以兼容渲染层
      };
    }

    _buildVoiceMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.VOICE,
        duration: message.duration || 0,        // 语音时长（秒）
        text: message.text || '',               // 语音转文字内容（可选）
        audioUrl: message.audioUrl || '',       // 音频URL（可选）
        played: message.played || false,        // 是否已播放
      };
    }

    _buildRedpacketMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.REDPACKET,
        redpacketId: message.redpacketId || this._generateId(),
        title: message.title || '红包',         // 红包标题
        amount: message.amount || 0,            // 总金额（分）
        count: message.count || 1,              // 红包个数
        isLucky: message.isLucky || false,      // 是否拼手气红包
        status: message.status || 'unclaimed',  // unclaimed/claimed/expired
        claimedAmount: message.claimedAmount || 0, // 领取金额
        claimedBy: message.claimedBy || [],     // 领取记录
        senderName: message.senderName || '',   // 发送者名称
      };
    }

    _buildTransferMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.TRANSFER,
        transferId: message.transferId || this._generateId(),
        amount: message.amount || 0,            // 转账金额（分）
        remark: message.remark || '转账',       // 转账备注
        status: message.status || 'unclaimed',  // unclaimed/claimed/refunded
        claimedAt: message.claimedAt || null,   // 收款时间
        senderName: message.senderName || '',
      };
    }

    _buildStickerMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.STICKER,
        stickerId: message.stickerId || '',     // 表情ID
        stickerEmoji: message.stickerEmoji || '', // 表情字符
        stickerName: message.stickerName || '', // 表情名称
      };
    }

    _buildImageMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.IMAGE,
        imageUrl: message.imageUrl || '',       // 图片URL
        thumbnailUrl: message.thumbnailUrl || '', // 缩略图URL
        width: message.width || 0,
        height: message.height || 0,
      };
    }

    _buildVideoMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.VIDEO,
        videoUrl: message.videoUrl || '',       // 视频URL
        duration: message.duration || 0,        // 时长（秒）
        thumbnailUrl: message.thumbnailUrl || '', // 缩略图URL
      };
    }

    _buildLocationMessage(base, message) {
      return {
        ...base,
        type: MESSAGE_TYPES.LOCATION,
        latitude: message.latitude || 0,
        longitude: message.longitude || 0,
        name: message.name || '位置分享',
        address: message.address || '',
      };
    }

    _buildFileMessage(base, message) {
      return {
        ...base,
        type: 'file',
        fileUrl: message.fileUrl || '',
        fileName: message.fileName || '未知文件',
        fileSize: message.fileSize || 0,
        mimeType: message.mimeType || 'application/octet-stream',
      };
    }

    // ==================== 红包操作 ====================

    /**
     * 领取红包
     * @param {string} friendId
     * @param {string} messageId
     * @param {string} userId
     * @param {string} userName
     * @returns {Promise<Object|null>} 领取结果
     */
    async claimRedpacket(friendId, messageId, userId, userName) {
      const all = await this.getAll();
      const messages = all[friendId];
      
      if (!messages) return null;
      
      const message = messages.find(m => m.id === messageId);
      if (!message || message.type !== MESSAGE_TYPES.REDPACKET) return null;
      if (message.status !== 'unclaimed') return null;
      
      // 计算领取金额
      let claimedAmount;
      if (message.isLucky) {
        // 拼手气红包：随机金额
        const claimedTotal = message.claimedBy.reduce((sum, c) => sum + (c.amount || 0), 0);
        const remaining = Math.max(0, message.amount - claimedTotal);
        const remainingCount = message.count - message.claimedBy.length;
        
        if (remainingCount <= 1) {
          claimedAmount = remaining;
        } else if (remaining <= 0) {
          claimedAmount = 0;
        } else {
          // 随机分配，但保证至少1分，且不超过剩余金额
          const max = Math.min(remaining - remainingCount + 1, remaining * 0.5);
          claimedAmount = Math.max(1, Math.min(Math.floor(Math.random() * max), remaining - remainingCount + 1));
        }
      } else {
        // 普通红包：均分
        claimedAmount = Math.floor(message.amount / message.count);
      }
      
      // 更新红包状态
      message.claimedBy.push({
        userId,
        userName,
        amount: claimedAmount,
        claimedAt: Date.now(),
      });
      
      // 检查是否领完
      if (message.claimedBy.length >= message.count) {
        message.status = 'claimed';
      }
      
      await this._set('all', all);
      
      this._emit('messages:redpacketClaimed', { 
        friendId, 
        messageId, 
        userId, 
        amount: claimedAmount 
      });
      
      return {
        amount: claimedAmount,
        isLucky: message.isLucky,
        totalCount: message.count,
        claimedCount: message.claimedBy.length,
      };
    }

    /**
     * 收款转账
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<boolean>}
     */
    async claimTransfer(friendId, messageId) {
      const all = await this.getAll();
      const messages = all[friendId];
      
      if (!messages) return false;
      
      const message = messages.find(m => m.id === messageId);
      if (!message || message.type !== MESSAGE_TYPES.TRANSFER) return false;
      if (message.status !== 'unclaimed') return false;
      
      message.status = 'claimed';
      message.claimedAt = Date.now();
      
      await this._set('all', all);
      
      this._emit('messages:transferClaimed', { friendId, messageId, amount: message.amount });
      return true;
    }

    // ==================== 语音操作 ====================

    /**
     * 标记语音已播放
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<boolean>}
     */
    async markVoicePlayed(friendId, messageId) {
      const all = await this.getAll();
      const messages = all[friendId];
      
      if (!messages) return false;
      
      const message = messages.find(m => m.id === messageId);
      if (!message || message.type !== MESSAGE_TYPES.VOICE) return false;
      
      message.played = true;
      await this._set('all', all);
      
      return true;
    }

    // ==================== 通用操作 ====================

    /**
     * 标记消息为已读
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async markAsRead(friendId) {
      const all = await this.getAll();
      const messages = all[friendId];
      
      if (!messages || messages.length === 0) return false;
      
      let changed = false;
      for (const msg of messages) {
        if (!msg.read && msg.senderId !== 'me') {
          msg.read = true;
          changed = true;
        }
      }
      
      if (changed) {
        await this._set('all', all);
        this._emit('messages:read', { friendId });
      }
      
      return changed;
    }

    /**
     * 删除消息
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<boolean>}
     */
    async remove(friendId, messageId) {
      const all = await this.getAll();
      const messages = all[friendId];
      
      if (!messages) return false;
      
      const index = messages.findIndex(m => m.id === messageId);
      if (index === -1) return false;
      
      const removed = messages.splice(index, 1)[0];
      await this._set('all', all);
      
      this._emit('messages:removed', { friendId, messageId, message: removed });
      return true;
    }

    /**
     * 清空与某个好友的所有消息
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async clear(friendId) {
      const all = await this.getAll();
      
      if (!all[friendId]) return false;
      
      delete all[friendId];
      await this._set('all', all);
      
      this._emit('messages:cleared', { friendId });
      return true;
    }

    /**
     * 添加到待发送队列
     * @param {Object} message - { friendId, friendName, text, type? }
     * @returns {Promise<Object>}
     */
    async addToPending(message) {
      const pending = await this.getPending();
      
      const pendingMessage = {
        id: this._generateId(),
        friendId: message.friendId,
        friendName: message.friendName,
        text: message.text,
        type: message.type || MESSAGE_TYPES.TEXT,
        timestamp: Date.now(),
        status: 'pending',
      };
      
      pending.push(pendingMessage);
      await this._set('pending', pending);
      
      this._emit('messages:pendingAdded', { message: pendingMessage });
      return pendingMessage;
    }

    /**
     * 从待发送队列移除
     * @param {string} messageId
     * @returns {Promise<boolean>}
     */
    async removeFromPending(messageId) {
      const pending = await this.getPending();
      const index = pending.findIndex(m => m.id === messageId);
      
      if (index === -1) return false;
      
      const removed = pending.splice(index, 1)[0];
      await this._set('pending', pending);
      
      this._emit('messages:pendingRemoved', { messageId, message: removed });
      return true;
    }

    /**
     * 更新待发送消息状态
     * @param {string} messageId
     * @param {string} status - 'pending' | 'sent' | 'failed'
     * @returns {Promise<boolean>}
     */
    async updatePendingStatus(messageId, status) {
      const pending = await this.getPending();
      const message = pending.find(m => m.id === messageId);
      
      if (!message) return false;
      
      message.status = status;
      message.updatedAt = Date.now();
      
      await this._set('pending', pending);
      this._emit('messages:pendingUpdated', { messageId, status });
      return true;
    }

    /**
     * 更新最后同步时间
     * @returns {Promise<boolean>}
     */
    async updateLastSync() {
      await this._set('lastSync', Date.now());
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅消息变更
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    subscribeAll(callback) {
      return this._subscribe('all', callback);
    }

    /**
     * 订阅待发送队列变更
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    subscribePending(callback) {
      return this._subscribe('pending', callback);
    }

    // ==================== 内部方法 ====================

    async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[MessagesData] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[MessagesData] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

    async _set(key, value) {
      if (!this._platform) {
        console.warn('[MessagesData] Platform 未初始化，无法写入数据');
        return false;
      }
      
      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, key, value, { persist: true });
      
      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      return this._platform.subscribeData(DOMAIN, key, callback);
    }

    /**
     * @deprecated 事件发射已迁移到 Service 层（铁则三）
     * 保留此方法以兼容旧代码调用，但不再实际发射事件
     */
    _emit(eventType, data) {
      // no-op: 事件发射由 MessageService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'msg_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Messages = MessagesData;
  window.PhoneData.Messages.TYPES = MESSAGE_TYPES;

  console.log('[Schema] MessagesData 已加载（扩展版）');
})();
