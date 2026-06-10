/**
 * NPCSocialService - NPC 社交一致性、好友.ensure、NPC 发声
 * [铁则一] 通过 Schema 读写
 * [铁则三] 不操作 DOM
 */

;(function () {
  'use strict';

  class NPCSocialService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);
      this._messagesData = new (window.PhoneData?.Messages || function () {})(this._platform);
      this._circleData = new (window.PhoneData?.FriendsCircle || function () {})(this._platform);
      this._weiboData = new (window.PhoneData?.Weibo || function () {})(this._platform);
      this._forumData = new (window.PhoneData?.Forum || function () {})(this._platform);
      this._profileData = new (window.PhoneData?.Profile || function () {})(this._platform);
      this._setupListeners();
    }

    _setupListeners() {
      const bus = this._platform?.eventBus;
      if (!bus) return;

      const reply = (type, p) => this._maybeNPCReply(type, p?.data || p);
      bus.on('friendsCircle:published', (p) => reply('moment_user', p));
      bus.on('friendsCircle:commented', (p) => reply('moment_comment', p));
      bus.on('friendsCircle:likeToggled', (p) => {
        if (p?.data?.liked !== false) reply('moment_like', p);
      });
      bus.on('weibo:published', (p) => reply('weibo_user', p));
      bus.on('weibo:commented', (p) => reply('weibo_comment', p));
      bus.on('weibo:likeToggled', (p) => {
        if (p?.data?.liked !== false) reply('weibo_like', p);
      });
      bus.on('message:sent', (p) => reply('message_user', p));
      bus.on('live:giftSent', (p) => reply('live_gift', p));
    }

    /**
     * 从大世界/NPC/档案合并人设
     * [v4.31.0] 数据源合并：优先从 FriendsData 获取 NPC
     */
    async resolveNPCProfile(npcId, name) {
      const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
      let profile = { id: npcId, name: name || npcId, personality: '', description: '', source: 'unknown' };

      // [v4.31.0] 优先从 FriendsData 获取（统一数据源）
      try {
        const FriendsData = window.PhoneData?.Friends;
        if (FriendsData) {
          const fd = new FriendsData(this._platform);
          const npc = await fd.getNPCById(npcId);
          if (npc) {
            profile = {
              id: npc.id,
              name: npc.name || name || npcId,
              avatar: npc.avatar,
              personality: npc.personality || '',
              description: npc.description || '',
              backstory: npc.backstory || '',
              mood: npc.mood || 'neutral',
              relationship: npc.relationship || 0,
              source: npc.source || 'friends',
            };
            console.log('[NPCSocialService] 从 FriendsData 获取到 NPC:', npcId);
            return profile;
          }
        }
      } catch (e) {
        console.warn('[NPCSocialService] 读取 FriendsData 失败:', e);
      }

      // [v4.31.0] 兼容：尝试从旧 NPCData 获取（已废弃）
      try {
        const NPCData = window.PhoneData?.NPC;
        if (NPCData) {
          const nd = new NPCData(this._platform);
          const list = await nd.getAll(charId);
          const hit = (list || []).find((n) => n.id === npcId || n.name === name);
          if (hit) {
            profile = {
              id: hit.id,
              name: hit.name,
              personality: hit.personality || '',
              description: hit.description || hit.backstory || '',
              emoji: hit.emoji,
              relationship: hit.plotRelation,
              source: 'world-npc',
            };
          }
        }
      } catch (e) {
        console.warn('[NPCSocialService] 读取 NPCData 失败:', e);
      }

      try {
        const profiles = await this._profileData.getProfiles();
        const pHit = (profiles || []).find((p) => p.id === npcId || p.name === name);
        if (pHit) {
          profile = {
            ...profile,
            ...pHit,
            name: pHit.name || profile.name,
            source: 'profile-archive',
          };
        }
      } catch (_) {}

      try {
        const WorldFacts = window.PhoneData?.WorldFacts;
        if (WorldFacts) {
          const wf = new WorldFacts(this._platform);
          const facts = await wf.getAllFacts();
          if (facts && name && facts['NPC.' + name]) {
            profile.worldNote = facts['NPC.' + name];
          }
        }
      } catch (_) {}

      return profile;
    }

    /**
     * 确保 NPC 在通讯录（自动加好友，非请求）
     */
    async ensureContact(npc) {
      if (!npc) return null;
      const id = npc.id || npc.friendId || ('npc_' + (npc.name || 'unknown').replace(/\s+/g, '_'));
      const name = (npc.name || npc.from || id).trim();

      let existing = await this._friendsData.getById(id);
      if (!existing && name) {
        const list = await this._friendsData.getList();
        existing = list.find((f) => (f.name || '').trim() === name) || null;
      }

      if (existing) return existing;

      const profile = await this.resolveNPCProfile(id, name);
      await this._friendsData.add({
        id: existing?.id || id,
        name: name,
        avatar: npc.avatar || profile.emoji || null,
        remark: profile.personality || '',
        source: npc.source || 'npc-auto',
        isNPC: true,
      });

      return (await this._friendsData.getById(id)) || { id, name };
    }

    /**
     * NPC 发来消息（自动 ensure 好友）
     */
    async deliverMessage(event) {
      const fromId = event.fromId || event.friendId || event.to;
      const fromName = event.from || event.name || fromId;
      const content = event.content || event.text || '';
      if (!content.trim()) return null;

      const contact = await this.ensureContact({ id: fromId, name: fromName, avatar: event.avatar });
      const fid = contact.id;

      const msg = await this._messagesData.add(fid, {
        type: 'text',
        content: content.trim(),
        senderId: fid,
      });

      await this._friendsData.updateLastMessage(fid, content.trim(), null, 1);

      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('message:received', {
          id: 'evt_' + Date.now(),
          type: 'message:received',
          data: { friendId: fid, friendName: fromName, messageId: msg?.id },
          timestamp: Date.now(),
          source: 'npc-social-service',
        });
      }

      return msg;
    }

    /**
     * NPC 发布朋友圈（非用户口吻）
     */
    async publishMomentAsNPC(event) {
      const authorId = event.authorId || event.fromId || event.friendId;
      const authorName = event.author || event.authorName || event.name || authorId;
      const content = event.content || '';
      if (!content.trim()) return null;

      const contact = await this.ensureContact({ id: authorId, name: authorName, avatar: event.avatar });
      const circle = await this._circleData.publish({
        authorId: contact.id,
        authorName: contact.name,
        authorAvatar: event.avatar || contact.avatar || '',
        content: content.trim(),
        images: event.images || [],
        source: 'npc',
      });

      if (this._platform?.eventBus) {
        // [铁则十一修复] 添加缺失的 id 字段
        this._platform.eventBus.emit('friendsCircle:npcPublished', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'friendsCircle:npcPublished',
          data: { circle },
          timestamp: Date.now(),
          source: 'npc-social-service',
        });
      }

      return circle;
    }

    /**
     * 随机 NPC 回复用户社交行为
     */
    async _maybeNPCReply(actionType, data) {
      try {
        const isSocial = /like|comment|moment|weibo/i.test(actionType || '');
        const threshold = /like/i.test(actionType || '') ? 0.15 : isSocial ? 0.35 : 0.55;
        if (Math.random() > threshold) return;

        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const worldSvc = this._platform?.get?.('worldService');
        const generated = worldSvc ? await worldSvc.isWorldGenerated(charId) : false;
        if (!generated) return;

        const friends = await this._friendsData.getList();
        const npcFriends = friends.filter((f) => f.isNPC || (f.id && String(f.id).startsWith('npc')));
        const pool = npcFriends.length ? npcFriends : friends;
        if (!pool.length) return;

        const pick = pool[Math.floor(Math.random() * pool.length)];
        const profile = await this.resolveNPCProfile(pick.id, pick.name);

        const llm = this._platform?.get?.('AI') || (window.PhoneServices?.AI && new window.PhoneServices.AI(this._platform));
        if (!llm?.generate) return;

        const prompt =
          '你是' + profile.name + '。性格：' + (profile.personality || '普通') +
          '。背景：' + (profile.description || '') +
          '\n用户在手机里进行了：' + actionType +
          '\n请生成一句简短自然的回复（15-40字），符合人设。只输出回复正文。';

        const reply = await llm.generate(prompt, { moduleId: 'npc-social', maxTokens: 80 });
        if (!reply?.trim()) return;

        if (actionType === 'moment_comment' || actionType === 'weibo_comment' || actionType === 'moment_like' || actionType === 'weibo_like') {
          await this.deliverMessage({ fromId: pick.id, from: pick.name, content: reply.trim() });
        } else if (actionType === 'weibo_user') {
          await this.deliverMessage({ fromId: pick.id, from: pick.name, content: reply.trim() });
        } else if (actionType === 'moment_user') {
          await this.publishMomentAsNPC({ authorId: pick.id, author: pick.name, content: reply.trim() });
        } else {
          await this.deliverMessage({ fromId: pick.id, from: pick.name, content: reply.trim() });
        }
      } catch (e) {
        console.warn('[NPCSocialService] NPC 回复失败:', e);
      }
    }

    /**
     * [v4.31.0-fix] 获取所有 NPC 列表（供 Module 层调用）
     * @param {string} charId - 角色ID，默认 'default'
     * @returns {Promise<Array>} NPC 列表
     */
    async getAllNPCs(charId) {
      charId = charId || this._platform?.context?.getCurrentCharId?.() || 'default';
      
      // [v4.31.0] 数据源合并：优先从 FriendsData 获取
      try {
        const FriendsData = window.PhoneData?.Friends;
        if (FriendsData) {
          const fd = new FriendsData(this._platform);
          const npcs = await fd.getNPCs();
          if (npcs && npcs.length > 0) {
            console.log('[NPCSocialService] 从 FriendsData 获取到', npcs.length, '个 NPC');
            return npcs;
          }
        }
      } catch (e) {
        console.warn('[NPCSocialService] 从 FriendsData 获取 NPC 列表失败:', e);
      }
      
      // [v4.31.0] 兼容：尝试从旧 NPCData 获取（已废弃）
      try {
        const NPCData = window.PhoneData?.NPC;
        if (!NPCData) return [];
        const nd = new NPCData(this._platform);
        return await nd.getAll(charId) || [];
      } catch (e) {
        console.warn('[NPCSocialService] 获取 NPC 列表失败:', e);
        return [];
      }
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.NPCSocial = NPCSocialService;
  console.log('[Service] NPCSocialService 已加载');
})();
