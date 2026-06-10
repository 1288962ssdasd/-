/**
 * MessageService - 消息业务逻辑
 * 纯数据操作，无 DOM，无渲染
 */

;(function () {
  'use strict';

  const MESSAGE_TYPES = {
    TEXT: 'text',
    VOICE: 'voice',
    REDPACKET: 'redpacket',
    TRANSFER: 'transfer',
    STICKER: 'sticker',
    IMAGE: 'image',
  };

  class MessageService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._messagesData = new (window.PhoneData?.Messages || function(){})(this._platform);
      this._friendsData = new (window.PhoneData?.Friends || function(){})(this._platform);
      this._aiService = new (window.PhoneServices?.AI || function(){})(this._platform);
    }

    // ==================== 读取操作 ====================

    /**
     * 获取好友列表（带最后消息）
     * @returns {Promise<Array>}
     */
    async getFriendList() {
      try {
        const friends = await this._friendsData.getList();
        return friends.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
      } catch (e) {
        console.warn('[MessageService] getFriendList 失败:', e);
        return [];
      }
    }

    /**
     * 获取与某好友的消息列表
     * @param {string} friendId
     * @returns {Promise<Array>}
     */
    async getMessages(friendId) {
      try {
        return await this._messagesData.getByFriendId(friendId);
      } catch (e) {
        console.warn('[MessageService] getMessages 失败:', e);
        return [];
      }
    }

    /**
     * 获取好友信息
     * @param {string} friendId
     * @returns {Promise<Object|null>}
     */
    async getFriend(friendId) {
      try {
        return await this._friendsData.getById(friendId);
      } catch (e) {
        console.warn('[MessageService] getFriend 失败:', e);
        return null;
      }
    }

    // ==================== 写入操作 ====================

    /**
     * 发送文本消息
     * @param {string} friendId
     * @param {string} content
     * @returns {Promise<Object>}
     */
    /**
     * 接收 NPC/导演 发来的消息（自动加好友）
     */
    async receiveFromNPC(event) {
      try {
        const npc = this._platform?.get?.('npcSocialService');
        if (npc?.deliverMessage) return await npc.deliverMessage(event);

        const fromId = event.fromId || event.friendId || event.to;
        const fromName = event.from || event.name || fromId;
        const content = event.content || event.text || '';
        if (!content.trim()) return null;

        let friend = await this._friendsData.getById(fromId);
        if (!friend) {
          await this._friendsData.add({
            id: fromId,
            name: fromName,
            source: 'director-auto',
            isNPC: true,
          });
          friend = await this._friendsData.getById(fromId);
        }

        const fid = friend?.id || fromId;
        const result = await this._messagesData.add(fid, {
          type: MESSAGE_TYPES.TEXT,
          content: content.trim(),
          senderId: fid,
        });
        await this._friendsData.updateLastMessage(fid, content.trim(), null, 1);
        return result;
      } catch (e) {
        console.warn('[MessageService] receiveFromNPC 失败:', e);
        return null;
      }
    }

    async sendText(friendId, content) {
      if (!content?.trim()) {
        console.warn('[MessageService] sendText: 消息内容为空');
        return null;
      }

      const message = {
        type: MESSAGE_TYPES.TEXT,
        content: content.trim(),
        senderId: 'me',
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, content.trim());

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:sent', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:sent',
          data: { friendId, messageId: result.id || result, type: 'text' },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 发送语音消息
     * @param {string} friendId
     * @param {number} duration - 秒
     * @returns {Promise<Object>}
     */
    async sendVoice(friendId, duration) {
      if (!duration || duration <= 0) {
        console.warn('[MessageService] sendVoice: 语音时长无效');
        return null;
      }

      const message = {
        type: MESSAGE_TYPES.VOICE,
        duration: Math.round(duration),
        senderId: 'me',
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, '[语音消息]');

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:sent', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:sent',
          data: { friendId, messageId: result.id || result, type: 'voice' },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 发送带文字内容的语音消息
     * @param {string} friendId
     * @param {string} text - 语音转文字内容
     * @param {number} duration - 秒
     * @returns {Promise<Object>}
     */
    async sendVoiceWithText(friendId, text, duration) {
      if (!text?.trim()) {
        console.warn('[MessageService] sendVoiceWithText: 语音内容不能为空');
        return null;
      }

      const message = {
        type: MESSAGE_TYPES.VOICE,
        text: text.trim(),
        content: text.trim(), // 兼容渲染层
        duration: Math.round(duration || Math.ceil(text.trim().length / 5)),
        senderId: 'me',
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, '[语音消息]');
      
      return result;
    }

    /**
     * 发送红包
     * @param {string} friendId
     * @param {number} amount
     * @param {string} remark
     * @returns {Promise<Object>}
     */
    async sendRedpacket(friendId, amount, remark) {
      amount = parseFloat(amount);
      if (isNaN(amount) || amount <= 0) {
        console.warn('[MessageService] sendRedpacket: 红包金额必须大于0');
        return null;
      }

      const message = {
        type: MESSAGE_TYPES.REDPACKET,
        amount: amount,
        remark: remark?.trim() || '恭喜发财',
        senderId: 'me',
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, '[红包] ' + message.remark);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:sent', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:sent',
          data: { friendId, messageId: result.id || result, type: 'redpacket', amount },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 领取红包
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<Object>}
     */
    async claimRedpacket(friendId, messageId) {
      // 构建领取者信息（铁则12：Service 是数据加工厂）
      const userId = 'me';
      const userName = '我';
      const result = await this._messagesData.claimRedpacket(friendId, messageId, userId, userName);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:redpacketClaimed', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:redpacketClaimed',
          data: { friendId, messageId, amount: result?.amount },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 发送转账
     * @param {string} friendId
     * @param {number} amount
     * @param {string} remark
     * @returns {Promise<Object>}
     */
    async sendTransfer(friendId, amount, remark) {
      amount = parseFloat(amount);
      if (isNaN(amount) || amount <= 0) {
        console.warn('[MessageService] sendTransfer: 转账金额必须大于0');
        return null;
      }

      const message = {
        type: MESSAGE_TYPES.TRANSFER,
        amount: amount,
        remark: remark?.trim() || '',
        senderId: 'me',
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, '[转账] ' + (message.remark || amount + '元'));

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:sent', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:sent',
          data: { friendId, messageId: result.id || result, type: 'transfer', amount },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 领取转账
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<Object>}
     */
    async claimTransfer(friendId, messageId) {
      const result = await this._messagesData.claimTransfer(friendId, messageId);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:transferClaimed', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:transferClaimed',
          data: { friendId, messageId, amount: result?.amount },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 发送表情
     * @param {string} friendId
     * @param {string} stickerId
     * @returns {Promise<Object>}
     */
    async sendSticker(friendId, stickerId) {
      if (!stickerId) {
        console.warn('[MessageService] sendSticker: 表情ID不能为空');
        return null;
      }

      const message = {
        type: MESSAGE_TYPES.STICKER,
        stickerId: stickerId,
        senderId: 'me',
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, '[表情]');

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:sent', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:sent',
          data: { friendId, messageId: result.id || result, type: 'sticker' },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * AI 生成并发送回复
     * @param {string} friendId
     * @returns {Promise<Object>}
     */
    async sendAIReply(friendId) {
      const friend = await this._friendsData.getById(friendId);
      if (!friend) {
        console.warn('[MessageService] sendAIReply: 好友不存在');
        return null;
      }

      const history = await this._messagesData.getByFriendId(friendId);
      // 防御性编程：确保返回数组
      if (!Array.isArray(history)) {
        console.warn('[MessageService] getByFriendId 返回非数组:', history);
        console.warn('[MessageService] sendAIReply: 消息历史数据异常');
        return null;
      }
      const context = history.slice(-10).map(m => {
        let content = '[非文本消息]';
        if (m.type === 'text') {
          content = m.text || m.content || '';
        } else if (m.type === 'voice') {
          content = '[语音消息 ' + (m.duration || '') + '秒]';
        } else if (m.type === 'redpacket') {
          content = '[红包: ' + (m.remark || '恭喜发财') + (m.opened ? ' 已领取' : '') + ']';
        } else if (m.type === 'sticker' || m.type === 'emoji') {
          content = '[表情]';
        } else if (m.type === 'transfer') {
          content = '[转账 ' + (m.amount || 0) + '元]';
        } else if (m.text || m.content) {
          content = m.text || m.content;
        }
        return {
          sender: m.senderId === 'me' ? '我' : friend.name,
          content: content,
        };
      });

      const reply = await this._aiService.generateChatReply(friend.name, context);
      
      if (!reply) {
        console.warn('[MessageService] sendAIReply: AI 生成失败');
        return null;
      }

      // AI 回复的 senderId 必须是好友ID（不是 'me'），这样才能正确渲染为对方消息
      const message = {
        type: MESSAGE_TYPES.TEXT,
        content: reply.trim(),
        senderId: friendId,
      };

      const result = await this._messagesData.add(friendId, message);
      await this._friendsData.updateLastMessage(friendId, reply.trim());

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:sent', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:sent',
          data: { friendId, messageId: result.id || result, type: 'text', isAI: true },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 标记语音已播放
     * @param {string} friendId
     * @param {string} messageId
     * @returns {Promise<boolean>}
     */
    async markVoicePlayed(friendId, messageId) {
      const result = await this._messagesData.markVoicePlayed(friendId, messageId);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:voicePlayed', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:voicePlayed',
          data: { friendId, messageId },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    /**
     * 清空与某好友的聊天记录
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async clearChat(friendId) {
      const result = await this._messagesData.clear(friendId);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:chatCleared', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'message:chatCleared',
          data: { friendId },
          timestamp: Date.now(),
          source: 'message-service'
        });
      }

      return result;
    }

    // ==================== 附件发送支持（供 AttachmentService 调用） ====================

    /**
     * 发送图片消息（内部方法，供 AttachmentService 调用）
     * @param {string} friendId
     * @param {Object} imageMessage
     * @returns {Promise<Object>}
     */
    async _sendImageMessage(friendId, imageMessage) {
      const result = await this._messagesData.add(friendId, imageMessage);
      await this._friendsData.updateLastMessage(friendId, '[图片]');
      return result;
    }

    /**
     * 发送文件消息（内部方法，供 AttachmentService 调用）
     * @param {string} friendId
     * @param {Object} fileMessage
     * @returns {Promise<Object>}
     */
    async _sendFileMessage(friendId, fileMessage) {
      const result = await this._messagesData.add(friendId, fileMessage);
      await this._friendsData.updateLastMessage(friendId, '[文件] ' + fileMessage.fileName);
      return result;
    }

    /**
     * 发送语音消息（内部方法，供 AttachmentService 调用）
     * @param {string} friendId
     * @param {Object} voiceMessage
     * @returns {Promise<Object>}
     */
    async _sendVoiceMessage(friendId, voiceMessage) {
      const result = await this._messagesData.add(friendId, voiceMessage);
      await this._friendsData.updateLastMessage(friendId, '[语音]');
      return result;
    }

    /**
     * 发送视频消息（内部方法，供 AttachmentService 调用）
     * @param {string} friendId
     * @param {Object} videoMessage
     * @returns {Promise<Object>}
     */
    async _sendVideoMessage(friendId, videoMessage) {
      const result = await this._messagesData.add(friendId, videoMessage);
      await this._friendsData.updateLastMessage(friendId, '[视频]');
      return result;
    }

    /**
     * 发送位置消息（内部方法，供 AttachmentService 调用）
     * @param {string} friendId
     * @param {Object} locationMessage
     * @returns {Promise<Object>}
     */
    async _sendLocationMessage(friendId, locationMessage) {
      const result = await this._messagesData.add(friendId, locationMessage);
      await this._friendsData.updateLastMessage(friendId, '[位置] ' + (locationMessage.name || ''));
      return result;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅消息变更（按好友）
     * @param {string} friendId
     * @param {Function} callback
     * @returns {Function} 取消订阅函数
     */
    subscribeMessages(friendId, callback) {
      // MessagesData 没有 subscribeByFriend，降级到 subscribeAll
      return this.subscribeAll(callback);
    }

    /**
     * 订阅所有消息变更
     * @param {Function} callback
     * @returns {Function} 取消订阅函数
     */
    subscribeAll(callback) {
      return this._messagesData.subscribeAll(callback);
    }

    /**
     * 订阅好友列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeFriends(callback) {
      return this._friendsData.subscribeList(callback);
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Message = MessageService;

  console.log('[Service] MessageService 已加载');
})();
