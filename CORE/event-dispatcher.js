/**
 * EventDispatcher - 事件分发器
 *
 * [铁则合规]
 * - 铁则三：CORE 层不操作 DOM
 * - 铁则十二：Service 层是唯一数据加工厂，这里只调用 Service 方法
 * - 铁则九：错误降级
 *
 * 关键设计：通过 Platform.get() 获取已注册服务实例，不 new Service()
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  /**
   * EventDispatcher 事件分发器
   */
  class EventDispatcher {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._handlers = new Map();
      this._registerDefaultHandlers();
    }

    /**
     * 注册默认事件处理器
     * @private
     */
    _registerDefaultHandlers() {
      // 消息事件 → 通过 Platform.get 获取 messageService
      this.register('message', async (event) => {
        const npc = this._platform?.get?.('npcSocialService');
        if (npc?.deliverMessage) {
          return await npc.deliverMessage(event);
        }
        const svc = this._platform?.get?.('messageService');
        if (!svc?.receiveFromNPC) {
          console.warn('[EventDispatcher] message 处理不可用');
          return null;
        }
        return await svc.receiveFromNPC(event);
      });

      // 任务事件 → 通过 Platform.get 获取 questService
      // [v4.3-fix] 使用正确的 createQuest 方法名，自动获取 charId
      // [v4.31.0-fix] 支持 event.data 格式（DirectorServiceV2 传递的格式）
      this.register('quest', async (event) => {
        const svc = this._platform?.get?.('questService');
        if (!svc) {
          console.warn('[EventDispatcher] questService 未注册');
          return null;
        }
        // [v4.31.0-fix] 优先使用 event.data（DirectorServiceV2 格式），其次使用 event.questData
        var questData = event.data || event.questData || {
          id: event.id || event.questId,
          questType: event.questType,
          name: event.name,
          description: event.description,
          reward: event.reward || event.rewards,
          steps: event.steps || [],
          friendId: event.friendId,
          issuerName: event.from || event.issuerName,
        };
        // [v4.3-fix] 获取 charId 并调用正确的方法
        var charId = event.charId || 'default';
        try {
          var adapter = this._platform?.adapter;
          if (adapter?.getCurrentCharacterId) {
            charId = await adapter.getCurrentCharacterId() || charId;
          }
        } catch (e) {
          // 使用默认值
        }
        if (typeof svc.createQuest === 'function') {
          return await svc.createQuest(charId, questData);
        } else if (typeof svc.createAndAddTask === 'function') {
          return await svc.createAndAddTask(questData);
        } else {
          console.error('[EventDispatcher] questService 缺少 createQuest/createAndAddTask 方法');
          return null;
        }
      });

      // 热搜榜更新
      this.register('hotSearch', async (event) => {
        const svc = this._platform?.get?.('weiboService');
        if (!svc?.updateHotSearches) {
          console.warn('[EventDispatcher] weiboService.updateHotSearches 不可用');
          return null;
        }
        const items = event.items || event.hotSearches || event.list || [];
        if (event.title && !items.length) {
          items.push({ title: event.title, heat: event.heat || 100, tag: event.tag || '热' });
        }
        return await svc.updateHotSearches(items);
      });

      // NPC 生成事件 → 通过 Platform.get 获取 npcGeneratorService
      this.register('npc', async (event) => {
        const svc = this._platform?.get?.('npcGeneratorService');
        if (!svc) {
          console.warn('[EventDispatcher] npcGeneratorService 未注册');
          return null;
        }
        return await svc.generate(event.npcContext);
      });

      // 状态变更事件 → 通过 Platform.get 获取 statusService
      this.register('status', async (event) => {
        const svc = this._platform?.get?.('statusService');
        if (!svc) {
          console.warn('[EventDispatcher] statusService 未注册');
          return null;
        }
        return await svc.updateField(event.target, event.change);
      });

      // 朋友圈事件 → 通过 Schema 写入
      this.register('moment', async (event) => {
        const npc = this._platform?.get?.('npcSocialService');
        if (npc?.publishMomentAsNPC) {
          return await npc.publishMomentAsNPC(event);
        }
        const FriendsCircle = window.PhoneData?.FriendsCircle;
        if (!FriendsCircle) return null;
        const data = new FriendsCircle(this._platform);
        return await data.publish({
          authorId: event.authorId || event.fromId || 'npc_unknown',
          authorName: event.author || event.authorName || event.name || 'NPC',
          authorAvatar: event.avatar || '',
          content: event.content,
          images: event.images || [],
        });
      });

      // 直播事件 → 通过 Platform.get 获取 liveService
      this.register('live', async (event) => {
        const svc = this._platform?.get?.('liveService');
        if (!svc) {
          console.warn('[EventDispatcher] liveService 未注册');
          return null;
        }
        return await svc.handleDirectorEvent(event);
      });

      // 微博/世界资讯事件 → 通过 Platform.get 获取 weiboService
      this.register('news', async (event) => {
        const svc = this._platform?.get?.('weiboService');
        if (!svc) {
          console.warn('[EventDispatcher] weiboService 未注册');
          return null;
        }
        return await svc.addPost({
          author: event.author || '世界新闻',
          content: event.content,
          type: 'news',
          timestamp: Date.now(),
        });
      });

      // 好友请求事件 → 通过 Schema 写入
      // [P1修复] 补充 friendId 和 message 字段，与 _dispatchEvent 保持一致
      this.register('friend', async (event) => {
        const Friends = window.PhoneData?.Friends;
        if (!Friends) {
          console.warn('[EventDispatcher] Friends Schema 未加载');
          return null;
        }
        const data = new Friends(this._platform);
        return await data.addRequest({
          id: event.id,
          name: event.name,
          friendId: event.friendId || null,
          avatar: event.avatar,
          message: event.message || null,
          source: 'director',
        });
      });

      // 工作流触发事件 → 通过 Platform.get 获取 workflowEngine
      this.register('workflow', async (event) => {
        const engine = this._platform?.get?.('workflowEngine');
        if (!engine) {
          console.warn('[EventDispatcher] workflowEngine 未注册');
          return null;
        }
        return await engine.execute(event.workflowId, event.data);
      });

      // [新增] 世界事件 → 通过 Platform.get 获取 worldService
      this.register('world', async (event) => {
        const svc = this._platform?.get?.('worldService');
        if (!svc) {
          console.warn('[EventDispatcher] worldService 未注册');
          return null;
        }
        // 世界事件由 WorldService 处理（如添加世界事件记录）
        return await svc.addWorldEvent(event.data);
      });

      // [新增] 档案/经济更新事件 → 通过 Platform.get 获取 profileService
      this.register('profile', async (event) => {
        const svc = this._platform?.get?.('profileService');
        if (!svc) {
          console.warn('[EventDispatcher] profileService 未注册');
          return null;
        }
        return await svc.updateFromDirector(event.data);
      });

      // [新增] 地图事件 → 通过 Platform.get 获取 mapService（预留）
      this.register('map', async (event) => {
        console.log('[EventDispatcher] 地图事件:', event.type, event.data);
        return null;
      });

      // [v4.31.0-fix] 世界阶段揭示事件 → 通过 Platform.get 获取 worldService
      this.register('stage_reveal', async (event) => {
        console.log('[EventDispatcher] 世界阶段揭示:', event.data);
        // 更新世界阶段
        const worldService = this._platform?.get?.('worldService');
        if (worldService?.updateStage) {
          try {
            const charId = event.charId || 'default';
            const newStage = event.data?.newStage || event.newStage;
            if (newStage) {
              await worldService.updateStage(charId, newStage);
              console.log('[EventDispatcher] 世界阶段已更新为:', newStage);
            }
          } catch (e) {
            console.warn('[EventDispatcher] 更新世界阶段失败:', e);
          }
        }
        // 发送通知
        if (event.notification) {
          console.log('[EventDispatcher] 阶段揭示通知:', event.notification.message);
        }
        return event.data;
      });

      // 邀约事件 → 通过 Platform.get 获取 invitationService
      this.register('invitation', async (event) => {
        const svc = this._platform?.get?.('invitationService');
        if (!svc) {
          console.warn('[EventDispatcher] invitationService 未注册');
          return null;
        }
        return await svc.createInvitation({
          charId: event.charId || event.data?.charId || 'default',
          npcId: event.npcId || event.data?.npcId,
          npcName: event.npcName || event.data?.npcName,
          type: event.type || event.data?.type || 'social',
          message: event.message || event.data?.message || '',
          relatedQuestId: event.relatedQuestId || event.data?.relatedQuestId || null,
        });
      });
    }

    /**
     * 注册事件处理器
     * @param {string} eventType
     * @param {Function} handler
     */
    register(eventType, handler) {
      this._handlers.set(eventType, handler);
    }

    /**
     * 分发单个事件
     * @param {Object} event - { type, ...data }
     * @returns {Promise<any>}
     */
    async dispatch(event) {
      // [铁则十] 数据契约：event 必须是非空对象且包含 type 字符串
      if (!event || typeof event !== 'object' || !event.type || typeof event.type !== 'string') {
        console.warn('[EventDispatcher] 无效事件:', event);
        return null;
      }

      const handler = this._handlers.get(event.type);
      if (!handler) {
        console.warn('[EventDispatcher] 未知事件类型:', event.type);
        return null;
      }

      try {
        return await handler(event);
      } catch (e) {
        // [铁则九] 错误降级
        console.warn('[EventDispatcher] 事件处理失败:', event.type, e);
        return null;
      }
    }

    /**
     * 批量分发事件
     * @param {Array} events
     * @returns {Promise<Array>}
     */
    async dispatchAll(events) {
      if (!Array.isArray(events)) {
        console.warn('[EventDispatcher] events 必须是数组');
        return [];
      }

      const results = [];
      for (const event of events) {
        const result = await this.dispatch(event);
        results.push({ event, result });
      }
      return results;
    }

    /**
     * 获取已注册的事件类型列表
     * @returns {Array<string>}
     */
    getRegisteredTypes() {
      return Array.from(this._handlers.keys());
    }

    /**
     * 注销事件处理器
     * @param {string} eventType
     */
    unregister(eventType) {
      this._handlers.delete(eventType);
    }
  }

  // 暴露到全局
  window.EventDispatcher = EventDispatcher;

  console.log('[Core] EventDispatcher 已加载');
})();
