/**
 * FriendsData - 好友数据 Schema 辅助函数
 *
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数，不直接调用 Platform.setData()
 */

;(function () {
  'use strict';

  const DOMAIN = 'friends';

  /**
   * FriendsData 好友数据操作类
   */
  class FriendsData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有好友列表
     * @returns {Promise<Array>}
     */
    async getList() {
      return await this._get('list', []);
    }

    /**
     * 获取单个好友
     * @param {string} friendId
     * @returns {Promise<Object|null>}
     */
    async getById(friendId) {
      const list = await this.getList();
      return list.find(f => f.id === friendId) || null;
    }

    /**
     * 获取好友请求列表
     * @returns {Promise<Array>}
     */
    async getRequests() {
      return await this._get('requests', []);
    }

    // ==================== 写入操作 ====================

    /**
     * 添加好友
     * @param {Object} friend - { id, name, avatar?, isGroup?, members? }
     * @returns {Promise<boolean>}
     */
    async add(friend) {
      // [S-11] 数据验证（仅警告，不阻止写入）
      if (window.PhoneSchemas) {
        const result = window.PhoneSchemas.validate('friends', 'list', friend);
        if (!result.valid) {
          console.warn('[FriendsData] 数据验证警告:', result.error);
        }
      }

      const list = await this.getList();

      // 检查是否已存在（按id）
      if (list.some(f => f.id === friend.id)) {
        console.warn('[FriendsData] 好友已存在:', friend.id);
        return false;
      }

      // [修复] 按名字去重，防止AI每次生成不同id导致重复添加
      const friendName = (friend.name || '').trim();
      if (friendName && list.some(f =>
        (f.name || '').trim() === friendName
      )) {
        console.warn('[FriendsData] 同名好友已存在，跳过:', friendName);
        return false;
      }

      // 添加时间戳
      const newFriend = {
        ...friend,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        unread: 0,
        lastMessage: '',
        lastTime: '',
      };

      list.push(newFriend);
      await this._set('list', list);
      
      // 触发事件
      this._emit('friends:added', { friend: newFriend });
      return true;
    }

    /**
     * 删除好友
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async remove(friendId) {
      const list = await this.getList();
      const index = list.findIndex(f => f.id === friendId);
      
      if (index === -1) return false;
      
      const removed = list.splice(index, 1)[0];
      await this._set('list', list);
      
      this._emit('friends:removed', { friendId, friend: removed });
      return true;
    }

    /**
     * 更新好友信息
     * @param {string} friendId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async update(friendId, updates) {
      const list = await this.getList();
      const friend = list.find(f => f.id === friendId);
      
      if (!friend) return false;
      
      Object.assign(friend, updates, { updatedAt: Date.now() });
      await this._set('list', list);
      
      this._emit('friends:updated', { friendId, updates });
      return true;
    }

    /**
     * 更新最后消息
     * @param {string} friendId
     * @param {string} message
     * @param {string} time
     * @param {number} unreadDelta
     * @returns {Promise<boolean>}
     */
    async updateLastMessage(friendId, message, time, unreadDelta = 0) {
      return await this.update(friendId, {
        lastMessage: message,
        lastTime: time,
        unread: Math.max(0, (await this.getById(friendId))?.unread + unreadDelta || 0),
      });
    }

    /**
     * 清空未读数
     * @param {string} friendId
     * @returns {Promise<boolean>}
     */
    async clearUnread(friendId) {
      return await this.update(friendId, { unread: 0 });
    }

    /**
     * 添加好友请求
     * @param {Object} request - { id?, name }
     * @returns {Promise<boolean>}
     */
    async addRequest(request) {
      const requests = await this.getRequests();

      // [铁则九防御] 自动生成 ID（如果调用者未提供）
      const requestId = request.id || 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

      // 只检查待处理的请求是否重复（已处理的请求不影响重新添加）
      if (requests.some(r => r.id === requestId && r.status === 'pending')) return false;

      // [修复] 按name去重，防止AI导演重复添加同一个NPC
      const requestName = (request.name || '').trim();
      if (requestName && requests.some(r => 
        r.status === 'pending' && 
        (r.name || '').trim() === requestName
      )) {
        console.log('[FriendsData] 好友请求已存在，跳过:', requestName);
        return false;
      }

      const newRequest = {
        ...request,
        id: requestId,
        status: 'pending',
        createdAt: Date.now(),
      };

      requests.push(newRequest);

      await this._set('requests', requests);
      this._emit('friends:requestReceived', { request: newRequest });
      return true;
    }

    /**
     * 处理好友请求
     * @param {string} requestId
     * @param {string} action - 'accept' | 'reject'
     * @returns {Promise<boolean>}
     */
    async handleRequest(requestId, action) {
      const requests = await this.getRequests();
      const request = requests.find(r => r.id === requestId);
      
      if (!request || request.status !== 'pending') return false;
      
      request.status = action === 'accept' ? 'accepted' : 'rejected';
      request.handledAt = Date.now();
      
      await this._set('requests', requests);
      
      if (action === 'accept') {
        await this.add({ id: request.id, name: request.name });
      }
      
      this._emit('friends:requestHandled', { requestId, action });
      return true;
    }

    // ==================== 群组管理（新增） ====================

    /**
     * 创建群组
     * @param {Object} group - { id?, name, avatar?, members: [{charId, name}] }
     * @returns {Promise<boolean>}
     */
    async createGroup(group) {
      const groupId = group.id || this._generateGroupId();

      // [铁则十二] Service层是唯一数据加工厂，这里只是封装数据
      const groupData = {
        id: groupId,
        name: group.name,
        avatar: group.avatar || null,
        isGroup: true,
        members: (group.members || []).map(m => ({
          charId: m.charId || m.id,
          name: m.name,
          joinedAt: Date.now(),
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        unread: 0,
        lastMessage: '',
        lastTime: '',
      };

      const result = await this.add(groupData);
      if (result) {
        this._emit('friends:groupCreated', { groupId, group: groupData });
      }
      return result;
    }

    /**
     * 添加群组成员
     * @param {string} groupId
     * @param {Object} member - { charId, name }
     * @returns {Promise<boolean>}
     */
    async addGroupMember(groupId, member) {
      const group = await this.getById(groupId);
      if (!group || !group.isGroup) {
        console.warn('[FriendsData] 群组不存在或不是群组:', groupId);
        return false;
      }

      // 检查是否已在群组中
      if (group.members.some(m => m.charId === member.charId)) {
        console.warn('[FriendsData] 成员已在群组中:', member.charId);
        return false;
      }

      group.members.push({
        charId: member.charId,
        name: member.name,
        joinedAt: Date.now(),
      });
      group.updatedAt = Date.now();

      await this._set('list', await this.getList());
      this._emit('friends:groupMemberAdded', { groupId, member });
      return true;
    }

    /**
     * 移除群组成员
     * @param {string} groupId
     * @param {string} charId
     * @returns {Promise<boolean>}
     */
    async removeGroupMember(groupId, charId) {
      const group = await this.getById(groupId);
      if (!group || !group.isGroup) return false;

      const originalLength = group.members.length;
      group.members = group.members.filter(m => m.charId !== charId);

      if (group.members.length === originalLength) return false;

      group.updatedAt = Date.now();
      await this._set('list', await this.getList());
      this._emit('friends:groupMemberRemoved', { groupId, charId });
      return true;
    }

    /**
     * 获取群组上下文（用于消息层构建 prompt）
     * @param {string} groupId
     * @returns {Promise<Object|null>}
     */
    async getGroupContext(groupId) {
      const group = await this.getById(groupId);
      if (!group || !group.isGroup) return null;

      return {
        groupId: group.id,
        groupName: group.name,
        members: group.members.map(m => m.name).join('、'),
        memberCount: group.members.length,
        memberDetails: group.members,
      };
    }

    /**
     * 获取角色所在的所有群组
     * @param {string} charId
     * @returns {Promise<Array>}
     */
    async getGroupsByCharId(charId) {
      const list = await this.getList();
      return list.filter(f =>
        f.isGroup && f.members && f.members.some(m => m.charId === charId)
      );
    }

    /**
     * 更新群组设置
     * @param {string} groupId
     * @param {Object} settings
     * @returns {Promise<boolean>}
     */
    async updateGroupSettings(groupId, settings) {
      const group = await this.getById(groupId);
      if (!group || !group.isGroup) return false;

      group.settings = { ...group.settings, ...settings };
      group.updatedAt = Date.now();

      await this._set('list', await this.getList());
      this._emit('friends:groupSettingsUpdated', { groupId, settings });
      return true;
    }

    /**
     * 解散群组
     * @param {string} groupId
     * @returns {Promise<boolean>}
     */
    async dissolveGroup(groupId) {
      return await this.remove(groupId);
    }

    _generateGroupId() {
      return 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    // ==================== 订阅 ====================

    /**
     * 订阅好友列表变更
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    subscribeList(callback) {
      return this._subscribe('list', callback);
    }

    /**
     * 订阅好友请求变更
     * @param {Function} callback
     * @returns {Function} unsubscribe
     */
    subscribeRequests(callback) {
      return this._subscribe('requests', callback);
    }

    // ==================== NPC 专属方法（v4.31.0 数据源合并）====================

    /**
     * 获取 NPC 列表
     * [铁则一] 统一数据源，NPC 存储在 FriendsData 中
     * @param {string} charId - 角色卡ID（可选，不传则使用当前角色卡）
     * @returns {Promise<Array>}
     */
    async getNPCs(charId) {
      const list = await this.getList();
      return list.filter(f =>
        f.source === 'world-npc' ||
        f.source === 'auto-generated' ||
        f.id?.startsWith('npc_') ||
        f.role
      );
    }

    /**
     * 获取单个 NPC
     * @param {string} npcId
     * @returns {Promise<Object|null>}
     */
    async getNPCById(npcId) {
      const npc = await this.getById(npcId);
      if (!npc) return null;
      // 验证是否是 NPC
      if (npc.source === 'world-npc' ||
          npc.source === 'auto-generated' ||
          npc.id?.startsWith('npc_') ||
          npc.role) {
        return npc;
      }
      return null;
    }

    /**
     * 添加 NPC
     * [铁则一] 统一数据源，替代 NPCData.add()
     * @param {Object} npcData - NPC 数据对象
     * @returns {Promise<boolean>}
     */
    async addNPC(npcData) {
      const npc = {
        ...npcData,
        source: npcData.source || 'world-npc',
        isContact: true,
        relationship: npcData.relationship ?? 0,
        mood: npcData.mood || 'neutral',
        createdAt: npcData.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      // 使用现有的 add 方法（已有去重逻辑）
      const result = await this.add(npc);
      if (result) {
        this._emit('npc:added', { npc });
      }
      return result;
    }

    /**
     * 更新 NPC 信息
     * @param {string} npcId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateNPC(npcId, updates) {
      return await this.update(npcId, updates);
    }

    /**
     * 更新 NPC 好感度
     * [铁则一] 统一数据源，好感度存储在 FriendsData.relationship 字段
     * @param {string} npcId
     * @param {number} relationship - 好感度值 (-100 ~ 100)
     * @returns {Promise<boolean>}
     */
    async updateRelationship(npcId, relationship) {
      const clampedValue = Math.max(-100, Math.min(100, relationship));
      return await this.update(npcId, {
        relationship: clampedValue,
        updatedAt: Date.now(),
      });
    }

    /**
     * 获取活跃 NPC（用于导演系统）
     * @param {number} limit - 最大返回数量
     * @returns {Promise<Array>}
     */
    async getActiveNPCs(limit = 5) {
      const npcs = await this.getNPCs();
      // 按互动时间排序
      npcs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return npcs.slice(0, limit);
    }

    /**
     * 获取 NPC 好感度等级
     * @param {string} npcId
     * @returns {Promise<number>} -100~-80=-5, -79~-60=-4, ..., 96~100=+5
     */
    async getNPCLevel(npcId) {
      const npc = await this.getNPCById(npcId);
      if (!npc) return 0;

      const r = npc.relationship || 0;
      if (r >= 96) return 5;
      if (r >= 81) return 4;
      if (r >= 61) return 3;
      if (r >= 41) return 2;
      if (r >= 21) return 1;
      if (r >= 1) return 0;
      if (r >= -19) return -1;
      if (r >= -39) return -2;
      if (r >= -59) return -3;
      if (r >= -79) return -4;
      return -5;
    }

    /**
     * 获取 NPC 行为参数（供 NPCSocialService 调用）
     * @param {number} level - 好感度等级 (-5 ~ +5)
     * @returns {Object}
     */
    getNPCBehaviorParams(level) {
      const params = {
        '-5': { replyDelay: Infinity, replyChance: 0, activeMessageChance: 0, priceMultiplier: 2.0 },
        '-4': { replyDelay: 86400000, replyChance: 0.1, activeMessageChance: 0, priceMultiplier: 1.5 },
        '-3': { replyDelay: 43200000, replyChance: 0.2, activeMessageChance: 0, priceMultiplier: 1.3 },
        '-2': { replyDelay: 21600000, replyChance: 0.4, activeMessageChance: 0.05, priceMultiplier: 1.1 },
        '-1': { replyDelay: 10800000, replyChance: 0.6, activeMessageChance: 0.1, priceMultiplier: 1.0 },
        '0': { replyDelay: 3600000, replyChance: 0.8, activeMessageChance: 0.15, priceMultiplier: 1.0 },
        '1': { replyDelay: 1800000, replyChance: 0.9, activeMessageChance: 0.2, priceMultiplier: 0.95 },
        '2': { replyDelay: 600000, replyChance: 0.95, activeMessageChance: 0.35, priceMultiplier: 0.9 },
        '3': { replyDelay: 300000, replyChance: 1.0, activeMessageChance: 0.55, priceMultiplier: 0.85 },
        '4': { replyDelay: 0, replyChance: 1.0, activeMessageChance: 0.7, priceMultiplier: 0.8 },
        '5': { replyDelay: 0, replyChance: 1.0, activeMessageChance: 0.85, priceMultiplier: 0.7 },
      };
      return params[String(level)] || params['0'];
    }

    // ==================== 内部方法 ====================

    async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[FriendsData] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[FriendsData] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

    async _set(key, value) {
      if (!this._platform) {
        console.warn('[FriendsData] Platform 未初始化，无法写入数据');
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
      // no-op: 事件发射由 FriendsService 负责
    }
  }

  // 暴露到全局（通过命名空间，不直接污染 window）
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Friends = FriendsData;

  console.log('[Schema] FriendsData 已加载');
})();
