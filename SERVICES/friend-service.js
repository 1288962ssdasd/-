/**
 * FriendService - 好友业务逻辑
 * 纯数据操作，无 DOM，无渲染
 */

;(function () {
  'use strict';

  class FriendService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._friendsData = new (window.PhoneData?.Friends || function(){})(this._platform);
    }

    // ==================== 读取操作 ====================

    /**
     * 获取好友列表
     * @returns {Promise<Array>}
     */
    async getList() {
      try {
        return await this._friendsData.getList();
      } catch (e) {
        console.warn('[FriendService] getList 失败:', e);
        return [];
      }
    }

    /**
     * 获取好友详情
     * @param {string} friendId
     * @returns {Promise<Object|null>}
     */
    async getById(friendId) {
      try {
        return await this._friendsData.getById(friendId);
      } catch (e) {
        console.warn('[FriendService] getById 失败:', e);
        return null;
      }
    }

    /**
     * 获取好友请求列表
     * @returns {Promise<Array>}
     */
    async getRequests() {
      try {
        return await this._friendsData.getRequests();
      } catch (e) {
        console.warn('[FriendService] getRequests 失败:', e);
        return [];
      }
    }

    // ==================== 写入操作 ====================

    /**
     * 添加好友
     * @param {Object} friend - { id, name, avatar?, isGroup?, members? }
     * @returns {Promise<boolean>}
     */
    async add(friend) {
      try {
        if (!friend?.id || !friend?.name) {
          console.warn('[FriendService] add: 好友ID和名称不能为空');
          return false;
        }

        // 检查是否已存在
        const existing = await this._friendsData.getById(friend.id);
        if (existing) {
          console.warn('[FriendService] add: 该好友已存在');
          return false;
        }

        const result = await this._friendsData.add(friend);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:added', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:added',
            data: { friendId: friend.id, name: friend.name },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result;
      } catch (e) {
        console.warn('[FriendService] add 失败:', e);
        return false;
      }
    }

    /**
     * 删除好友
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async remove(friendId) {
      try {
        const friend = await this._friendsData.getById(friendId);
        const result = await this._friendsData.remove(friendId);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:removed', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:removed',
            data: { friendId, name: friend?.name },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result;
      } catch (e) {
        console.warn('[FriendService] remove 失败:', e);
        return false;
      }
    }

    /**
     * 更新好友信息
     * @param {string} friendId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async update(friendId, updates) {
      try {
        const result = await this._friendsData.update(friendId, updates);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:updated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:updated',
            data: { friendId },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result;
      } catch (e) {
        console.warn('[FriendService] update 失败:', e);
        return false;
      }
    }

    /**
     * 清空未读消息数
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async clearUnread(friendId) {
      try {
        const result = await this._friendsData.clearUnread(friendId);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:unreadCleared', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:unreadCleared',
            data: { friendId },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result;
      } catch (e) {
        console.warn('[FriendService] clearUnread 失败:', e);
        return false;
      }
    }

    /**
     * 更新好友头像
     * @param {string} friendId
     * @param {string} avatarUrl - base64 data URL
     * @returns {Promise<boolean>}
     */
    async updateAvatar(friendId, avatarUrl) {
      try {
        if (!friendId || !avatarUrl) {
          console.warn('[FriendService] updateAvatar: 参数不完整');
          return false;
        }
        return await this._friendsData.update(friendId, { avatar: avatarUrl });
      } catch (e) {
        console.warn('[FriendService] updateAvatar 失败:', e);
        return false;
      }
    }

    /**
     * 发送好友请求
     * @param {Object} request - { id, name, message? }
     * @returns {Promise<boolean>}
     */
    async sendRequest(request) {
      try {
        if (!request?.id || !request?.name) {
          console.warn('[FriendService] sendRequest: 请求信息不完整');
          return false;
        }

        const result = await this._friendsData.addRequest({
          ...request,
          timestamp: Date.now(),
        });

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:requestSent', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:requestSent',
            data: { requestId: request.id, name: request.name },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result;
      } catch (e) {
        console.warn('[FriendService] sendRequest 失败:', e);
        return false;
      }
    }

    /**
     * 处理好友请求
     * @param {string} requestId
     * @param {boolean|string} accept - true/'accept' 接受，false/'reject' 拒绝
     * @returns {Promise<boolean>}
     */
    async handleRequest(requestId, accept) {
      try {
        const action = (accept === true || accept === 'accept') ? 'accept' : 'reject';
        const accepted = action === 'accept';
        const result = await this._friendsData.handleRequest(requestId, action);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:requestHandled', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:requestHandled',
            data: { requestId, accepted },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result;
      } catch (e) {
        console.warn('[FriendService] handleRequest 失败:', e);
        return false;
      }
    }

    /**
     * [v4.31.0-fix] 创建群聊
     * @param {string} groupName - 群聊名称
     * @param {Array<string>} memberIds - 成员ID列表
     * @returns {Promise<Object|null>} 创建的群聊对象
     */
    async createGroup(groupName, memberIds) {
      try {
        if (!groupName?.trim()) {
          console.warn('[FriendService] createGroup: 群聊名称不能为空');
          return null;
        }
        if (!memberIds || memberIds.length === 0) {
          console.warn('[FriendService] createGroup: 群聊成员不能为空');
          return null;
        }

        const groupId = 'group_' + Date.now().toString(36);
        const groupFriend = {
          id: groupId,
          name: groupName.trim(),
          isGroup: true,
          members: memberIds.slice(0, 50), // 最多50个成员
          avatar: null,
          createdAt: Date.now()
        };

        const result = await this._friendsData.add(groupFriend);

        if (result && this._platform?.eventBus) {
          this._platform.eventBus.emit('friend:groupCreated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'friend:groupCreated',
            data: { groupId, name: groupFriend.name, memberCount: groupFriend.members.length },
            timestamp: Date.now(),
            source: 'friend-service'
          });
        }

        return result ? groupFriend : null;
      } catch (e) {
        console.warn('[FriendService] createGroup 失败:', e);
        return null;
      }
    }

    // ==================== 订阅 ====================

    /**
     * 订阅好友列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeList(callback) {
      return this._friendsData.subscribeList(callback);
    }

    /**
     * 订阅好友请求变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeRequests(callback) {
      return this._friendsData.subscribeRequests(callback);
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Friend = FriendService;

  console.log('[Service] FriendService 已加载');
})();
