/**
 * @deprecated DirectorService V1 已废弃，请使用 DirectorServiceV2
 *
 * 本文件保留仅为向后兼容。新功能请使用 director-service-v2.js。
 *
 * 铁则十六/十七说明：
 * - V1 与 V2 共存会导致事件重复触发（两者都监听 generation:ended 和 context:changed）
 * - V1 超过 800 行限制（当前 2632 行）
 * - 建议在下一个大版本中完全移除 V1
 *
 * 当前通过 service-registry.js 只注册 V2 来避免冲突。
 *
 * @layer Service
 * @file   director-service.js
 * @depends LLMGateway, DirectorData, ApiConfigData, FriendsData, Platform, WorldData
 * @emits  director:plan, director:message, director:quest, director:moment, director:live, director:friend, director:status
 *
 * 职责: AI导演决策 - 分析剧情上下文，生成手机事件计划
 * 禁止: 操作DOM、直接调用SillyTavern API、直接实例化AIService
 * [v4.1] 增加总开关 + ST上下文变化量驱动 + 世界感知
 */

;(function () {
  'use strict';

  class DirectorService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._directorData = new (window.PhoneData?.Director || function () {})(this._platform);
      this._apiConfig = new (window.PhoneData?.ApiConfig || function () {})(this._platform);
      // [Task 5.1修复] 移除 _friendsData 和 _messagesData 直接实例化
      // 跨域数据操作改为通过 EventBus 发射事件，由 Module 层订阅并调用对应 Service
      // this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);
      // this._messagesData = new (window.PhoneData?.Messages || function () {})(this._platform);

      // [新增 v4.1] ContextAssembler + EventDispatcher
      this._contextAssembler = null;
      this._eventDispatcher = null;

      // 状态
      this._enabled = false;          // 旧版启用状态（保留兼容）
      this._masterSwitch = true;      // [v4.3修复] 总开关，默认开启（确保管家正常工作）
      this._running = false;
      this._lastRun = 0;
      this._cooldown = 10000; // 10秒冷却
      this._lastPlanHash = '';
      this._lastContextHash = '';     // [v4.1] 上次上下文哈希，用于检测变化
      this._minContextDelta = 0.3;    // [v4.1] 最小上下文变化阈值(30%)

      // [v4.2] NPC行为调度相关
      this._npcCooldowns = new Map();
      this._actionPoolCache = new Map();
      this._narrativeBeatCounter = 0;
      this._directorConfig = null;

      // [v4.3] 去重相关：记录最近分发的事件指纹，防止重复生成
      this._recentEventFingerprints = [];
      this._maxFingerprintCache = 50; // 最多缓存50条指纹

      // [Task 4.2] 冷却机制
      this._cooldownConfig = {
        message: 5 * 60 * 1000,       // 5分钟
        moment: 15 * 60 * 1000,       // 15分钟
        weibo: 20 * 60 * 1000,        // 20分钟
        forum: 30 * 60 * 1000,        // 30分钟
        'world-news': 10 * 60 * 1000, // 10分钟
        'economy-event': 10 * 60 * 1000,
        'atmosphere-event': 10 * 60 * 1000,
        'quest-notify': 15 * 60 * 1000,
      };
      this._globalMinInterval = 2 * 60 * 1000;   // 全局最小间隔：2分钟
      this._npcMinInterval = 10 * 60 * 1000;      // 同一 NPC 最小间隔：10分钟
      this._maxEventsPerHour = 12;                 // 每小时上限：12个事件
      this._lastEventTime = new Map();              // 按事件类型记录最后触发时间
      this._lastNPCEventTime = new Map();           // 按 NPC 记录最后触发时间
      this._eventCountThisHour = 0;                // 每小时事件计数器
      this._hourResetTime = Date.now();             // 小时计数器重置时间

      // [Task 4.4] 节奏控制系统
      this._tensionLevel = 'normal';                // 当前张力等级
      this._consecutiveTypeCount = 0;               // 连续同类型事件计数
      this._lastEventType = '';                     // 上一次事件类型
      this._maxConsecutiveSameType = 3;             // 强制轮换阈值
      this._rhythmConfig = {
        tension_high: { intervalMultiplier: 0.5, maxEventsPerHour: 18 },
        tension_normal: { intervalMultiplier: 1.0, maxEventsPerHour: 12 },
        tension_low: { intervalMultiplier: 2.0, maxEventsPerHour: 6 },
      };
    }

    /**
     * 初始化导演服务
     */
    async init() {
      console.log('[DirectorService] 初始化...');

      // [v4.3] 总开关：默认开启，只在用户明确关闭时才关闭
      try {
        var settings = null;
        if (this._platform?.data) {
          settings = await this._platform.data('settings', 'main', null);
        }
        if (settings && typeof settings === 'object' && settings.directorEnabled === false) {
          // 只有用户明确设置为 false 时才关闭
          this._masterSwitch = false;
          console.log('[DirectorService] 总开关状态: ❌ 关闭（用户手动关闭）');
        } else {
          this._masterSwitch = true;
          console.log('[DirectorService] 总开关状态: ✅ 开启');
        }
      } catch (e) {
        console.warn('[DirectorService] 读取总开关失败，默认开启:', e);
        this._masterSwitch = true;
      }

      // 读取状态（旧版兼容）- [v4.3修复] 默认启用
      try {
        const status = await this._directorData.getStatus();
        this._enabled = status ? (status.enabled !== false) : true; // null 时默认 true
        this._cooldown = (status && status.cooldown) || 10000;
      } catch (e) {
        console.warn('[DirectorService] 读取状态失败，默认启用:', e);
        this._enabled = true;
      }

      // [新增 v4.1] 初始化 ContextAssembler
      if (window.ContextAssembler) {
        this._contextAssembler = new window.ContextAssembler(this._platform);
        console.log('[DirectorService] ✅ ContextAssembler 已初始化');
      } else {
        console.warn('[DirectorService] ⚠️ ContextAssembler 不可用，将使用旧版 _collectContext');
      }

      // [新增 v4.1] 初始化 EventDispatcher
      if (window.EventDispatcher) {
        this._eventDispatcher = new window.EventDispatcher(this._platform);
        console.log('[DirectorService] ✅ EventDispatcher 已初始化');
      } else {
        console.warn('[DirectorService] ⚠️ EventDispatcher 不可用，将使用旧版 _dispatchEvents');
      }

      // 监听 ContextMonitor 的生成结束事件
      this._setupEventListeners();

      console.log('[DirectorService] 初始化完成, 启用状态:', this._enabled);
    }

    /**
     * 设置事件监听
     * [铁则六] 平台相关逻辑通过适配器处理
     */
    _setupEventListeners() {
      if (this._platform?.eventBus) {
        // 监听 ContextMonitor 的生成结束事件（主要触发路径）
        this._platform.eventBus.on('generation:ended', () => {
          console.log('[DirectorService] 收到 generation:ended 事件');
          this.trigger();
        });

        // [v4.3-fix] 监听上下文变化事件（备用触发路径）
        // 当 eventSource 不可用时，ContextMonitor 的定时轮检仍会发射此事件
        this._platform.eventBus.on('context:changed', (data) => {
          if (data && data.changes) {
            // 只在有消息数量变化或角色切换时触发
            var shouldTrigger = data.changes.some(function (c) {
              return c.type === 'messagesCount' || c.type === 'characterId' || c.type === 'chatId';
            });
            if (shouldTrigger) {
              console.log('[DirectorService] 收到 context:changed 事件（变化类型:', data.changes.map(function(c){return c.type}).join(','), '）');
              this.trigger();
            }
          }
        });

        // 监听变量变更（用于检测外部写入的 director.plan）
        this._platform.eventBus.on('variable:changed', (data) => {
          if (data.key === 'xb.director.plan' && data.value) {
            this._lastPlanHash = this._hashString(JSON.stringify(data.value));
          }
        });
      }
    }

    /**
     * 触发导演决策
     * [铁则七] 通过 LLMGateway 调用 AI，不直接实例化 AIService
     */
    async trigger() {
      const now = Date.now();

      // [v4.3] 总开关检查（最高优先级）
      if (!this._masterSwitch) {
        console.log('[DirectorService] trigger() 跳过: 总开关关闭');
        return;
      }

      // 冷却检查
      if (now - this._lastRun < this._cooldown) {
        return; // 冷却中，静默跳过
      }

      // 检查是否启用（旧版兼容）
      if (!this._enabled) {
        console.log('[DirectorService] trigger() 跳过: _enabled = false');
        return;
      }

      // 防止并发
      if (this._running) {
        return;
      }

      // 检查 LLMGateway 是否可用
      if (typeof window.LLMGateway === 'undefined') {
        console.warn('[DirectorService] LLMGateway 不可用，跳过本次触发');
        return;
      }

      // 检查 API 配置
      const config = await this._apiConfig.getMainConfig();
      // [铁则十] 数据契约：config 返回值 null 守卫
      if (!config || typeof config !== 'object') {
        console.warn('[DirectorService] ⚠️ API 配置读取失败（返回值无效）');
        return;
      }
      if (!config.baseUrl || !config.apiKey) {
        // [P0修复] 添加调试日志，消除静默跳过
        console.warn('[DirectorService] ⚠️ API 未配置，跳过触发');
        console.warn('  baseUrl:', config.baseUrl || '(未设置)');
        console.warn('  apiKey:', config.apiKey ? '***' + String(config.apiKey).slice(-4) : '(未设置)');
        return;
      }

      // [v4.1] ST上下文变化量检测 - 只有上下文有足够变化才触发
      var contextChanged = await this._checkContextDelta();
      if (!contextChanged) {
        console.log('[DirectorService] 上下文变化量不足，跳过本次触发');
        return;
      }

      this._running = true;
      this._lastRun = now;

      try {
        // [改造 v3.0] 实时提取变量（零存储），注入到 context
        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const variables = await this._getVariables(charId);

        // 检测是否有世界数据
        var hasWorldData = !!(variables['world.name'] && variables['world.name'] !== '未知');

        // 构建 context：变量直接作为顶层字段，供 world-director 的 {{world.xxx}} 等占位符使用
        let context = Object.assign({}, variables);

        // [v3.0] 无论是否有世界数据，都附加 ST 上下文（管家不能停摆）
        if (this._contextAssembler) {
          const assembledText = await this._contextAssembler.assemble({ charId });
          context.assembledContext = assembledText;
          console.log('[DirectorService] ✅ 使用 ContextAssembler 装配上下文');
        } else {
          // 降级：使用旧方法
          var fallbackContext = await this._collectContext();
          context.assembledContext = fallbackContext.assembledContext || '';
          console.log('[DirectorService] ⚠️ 使用旧版 _collectContext');
        }

        if (hasWorldData) {
          console.log('[DirectorService] ✅ 世界数据已就绪，变量数:', Object.keys(variables).length);
        } else {
          console.log('[DirectorService] ⚠️ 无世界数据，管家基于 ST 上下文独立运行');
        }

        // 通过 LLMGateway 调用 AI
        const llmGateway = new window.LLMGateway(this._platform);
        const result = await llmGateway.generate('world-director', context);

        // [v3.0] 深度分析降级：变量不足时切换到 world-director-deep
        if (result && result.needDeepAnalysis) {
          console.log('[DirectorService] 变量不足，触发深度分析');
          try {
            var fullContext = '';
            if (this._contextAssembler && typeof this._contextAssembler.assemble === 'function') {
              fullContext = await this._contextAssembler.assemble({ charId: charId, forceRefresh: true });
            }
            var deepResult = await llmGateway.generate('world-director-deep', {
              worldContext: JSON.stringify(variables),
              fullContext: fullContext
            });
            if (deepResult) {
              result = deepResult;
            }
          } catch (deepErr) {
            console.warn('[DirectorService] 深度分析失败，使用原始结果:', deepErr);
          }
        }

        if (result) {
          // 解析结果
          const plan = this._parseResult(result);

          if (plan && plan.events && plan.events.length > 0) {
            plan.events = this._routePlanEvents(plan.events);

            // [v4.3] 去重过滤：在分发前移除重复事件
            plan.events = await this._filterDuplicateEvents(plan.events, charId);
            if (plan.events.length === 0) {
              console.log('[DirectorService] 所有事件被去重过滤，跳过本次分发');
              return;
            }
            console.log('[DirectorService] 去重后剩余事件:', plan.events.length, '个');

            // [Phase 2] 专家系统路由：根据事件类型路由到对应专家生成详细内容
            plan.events = await this._routeToExperts(plan.events, charId);
            if (plan.events.length === 0) {
              console.log('[DirectorService] 专家路由后无事件，跳过本次分发');
              return;
            }

            // 保存计划
            await this._directorData.setPlan(plan);

            // [改造 v4.1] 使用 EventDispatcher 替代 _dispatchEvents
            if (this._eventDispatcher) {
              await this._eventDispatcher.dispatchAll(plan.events);
              console.log('[DirectorService] ✅ 使用 EventDispatcher 分发事件');
              // [修复] EventDispatcher只做数据写入，不发射EventBus事件
              // 必须补充发射，否则Module层收不到通知
              for (const event of plan.events) {
                this._emitEvent('director:' + event.type, event);
              }
            } else {
              // 降级：使用旧方法（旧方法内部会调用_emitEvent）
              await this._dispatchEvents(plan.events);
              console.log('[DirectorService] ⚠️ 使用旧版 _dispatchEvents');
            }

            // [新增 v4.1] 记录事件到 StoryEventsData
            await this._recordEventsToTimeline(plan.events);

            // [Task 4.2/4.4] 对每个分发的事件记录冷却
            for (var evtIdx = 0; evtIdx < plan.events.length; evtIdx++) {
              var pe = plan.events[evtIdx];
              if (pe && pe.type) {
                this._onEventTriggered(pe.type, pe.fromId || pe.authorId || pe.friendId || null);
              }
            }

            // [Task 4.3] 尝试生成世界事件（基于世界上下文）
            try {
              var worldCtx = await this._getWorldContext();
              if (worldCtx && worldCtx.name && worldCtx.name !== '未知世界') {
                var worldEvt = await this._generateWorldEvent(worldCtx);
                if (worldEvt) {
                  // 发射世界事件
                  this._emitEvent('director:' + worldEvt.type, worldEvt);
                  console.log('[DirectorService] 世界事件已生成:', worldEvt.type);
                }
              }
            } catch (worldEvtErr) {
              console.warn('[DirectorService] 世界事件生成失败（不阻断）:', worldEvtErr);
            }

            // 记录历史
            await this._directorData.addHistory({
              events: plan.events,
              context: context,
              success: true,
            });

            // 发布计划事件（铁则十二标准载荷）
            this._emitEvent('director:plan', plan);

            console.log('[DirectorService] 生成计划:', plan.events.length, '个事件');
          }

          // 清除已消费的闭环变量
          await this._clearFeedbackVars();
        }

        // 更新状态
        const status = await this._directorData.getStatus();
        await this._directorData.updateStatus({
          lastRun: now,
          runCount: (status.runCount || 0) + 1,
        });

      } catch (error) {
        console.error('[DirectorService] 执行失败:', error);

        // [铁则九] 错误处理降级：更新错误计数，不抛出
        try {
          const status = await this._directorData.getStatus();
          await this._directorData.updateStatus({
            errorCount: (status.errorCount || 0) + 1,
          });

          // 记录失败历史
          await this._directorData.addHistory({
            events: [],
            success: false,
            error: error.message,
          });
        } catch (statusError) {
          console.error('[DirectorService] 更新错误状态失败:', statusError);
        }

      } finally {
        this._running = false;
      }
    }

    /**
     * 收集上下文信息（旧版降级路径）
     * [铁则六] 通过适配器获取平台数据，不直接调用 window.SillyTavern
     * [P0修复] 返回值包含字符串格式，与 buildContext 的占位符匹配
     * [P1修复] characterInfo 和 userBehavior 转为字符串格式，避免数据被浪费
     */
    async _collectContext() {
      const context = {
        recentMessages: [],
        gameState: {},
        activeQuests: [],
        userBehavior: {},
      };

      // 获取最近聊天消息（通过适配器）
      try {
        if (this._platform?.adapter?.getRecentChatMessages) {
          const messages = await this._platform.adapter.getRecentChatMessages(6);
          if (Array.isArray(messages)) {
            context.recentMessages = messages.map((msg) => ({
              role: msg.is_user ? '玩家' : (msg.name || 'AI'),
              content: (msg.mes || '').substring(0, 300),
            }));
          }
        }
      } catch (e) {
        console.warn('[DirectorService] 获取聊天消息失败:', e);
      }

      // 获取角色信息（通过适配器）
      // [P1修复] 将 characterInfo 转为字符串格式，合并到 assembledContext 中
      let characterInfoStr = '';
      try {
        if (this._platform?.adapter?.getCharacterInfo) {
          const charInfo = await this._platform.adapter.getCharacterInfo();
          if (charInfo) {
            context.characterInfo = charInfo;
            // [P1修复] 转为字符串格式，供 prompt 占位符使用
            if (typeof charInfo === 'object') {
              characterInfoStr = Object.entries(charInfo)
                .map(([k, v]) => k + ': ' + v)
                .join('\n');
            } else {
              characterInfoStr = String(charInfo);
            }
          }
        }
      } catch (e) {
        // 忽略，非关键数据
      }

      // 获取游戏状态
      try {
        if (this._platform?.data) {
          context.gameState = {
            money: await this._platform.data('game', 'money', '未知'),
            scene: await this._platform.data('game', 'scene', '未知'),
            time: await this._platform.data('game', 'time', '未知'),
          };
        }
      } catch (e) {
        // 忽略
      }

      // 获取活跃任务
      try {
        const questRegistry = await this._platform?.data('quest', 'registry', null);
        if (questRegistry) {
          const parsed = typeof questRegistry === 'string' ? JSON.parse(questRegistry) : questRegistry;
          if (parsed?.quests) {
            context.activeQuests = parsed.quests
              .filter(q => q.status === 'active')
              .slice(0, 5)
              .map(q => ({ name: q.name, status: q.status }));
          }
        }
      } catch (e) {
        // 忽略
      }

      // 获取用户行为闭环数据
      // [P1修复] 将 userBehavior 转为字符串格式，合并到 assembledContext 中
      let userBehaviorStr = '';
      try {
        context.userBehavior = {
          interaction: await this._directorData.getLastInteraction(),
          userChoice: await this._directorData.getLastUserChoice(),
          taskResult: await this._directorData.getLastTaskResult(),
        };
        // [P1修复] 转为字符串格式，供 prompt 使用
        var ubParts = [];
        if (context.userBehavior.interaction) {
          ubParts.push('最近交互: ' + JSON.stringify(context.userBehavior.interaction));
        }
        if (context.userBehavior.userChoice) {
          ubParts.push('玩家选择: ' + String(context.userBehavior.userChoice));
        }
        if (context.userBehavior.taskResult) {
          ubParts.push('任务结果: ' + String(context.userBehavior.taskResult));
        }
        userBehaviorStr = ubParts.join('\n');
      } catch (e) {
        // 忽略
      }

      // [P0修复] 构建 assembledContext 字符串，包含 characterInfo 和 userBehavior
      // 这样 buildContext 不会覆盖这些数据，且 prompt 中的 {{assembledContext}} 占位符能使用
      var assembledParts = [];
      if (characterInfoStr) {
        assembledParts.push('## 角色信息\n' + characterInfoStr);
      }
      if (userBehaviorStr) {
        assembledParts.push('## 用户行为闭环\n' + userBehaviorStr);
      }
      context.assembledContext = assembledParts.join('\n\n');

      return context;
    }

    /**
     * 事件路由：重要剧情 → 多步骤任务；否则 → 消息/朋友圈
     */
    _routePlanEvents(events) {
      if (!Array.isArray(events)) return [];
      const routed = [];

      for (const e of events) {
        if (!e || !e.type) continue;

        const isImportant =
          e.importance === 'high' ||
          e.questType === '主线' ||
          (Array.isArray(e.steps) && e.steps.length > 0);

        if (e.type === 'quest' && isImportant) {
          routed.push({
            ...e,
            steps: e.steps || [
              { type: 'open_app', app: 'live', label: '前往目标应用' },
              { type: 'custom', label: '完成剧情互动' },
            ],
          });
          continue;
        }

        if (e.type === 'quest' && !isImportant) {
          if (Math.random() < 0.45) {
            routed.push({
              type: 'message',
              fromId: e.friendId || ('npc_' + Date.now()),
              from: e.name || e.issuerName || '陌生人',
              content: e.description || e.name || '你好',
            });
          } else {
            routed.push({
              type: 'moment',
              authorId: e.friendId || ('npc_' + Date.now()),
              author: e.name || 'NPC',
              content: e.description || e.name || '动态更新',
            });
          }
          continue;
        }

        if (e.type === 'moment') {
          routed.push({
            ...e,
            authorId: e.authorId || e.fromId || e.friendId,
            author: e.author || e.authorName || e.name,
          });
          continue;
        }

        if (e.type === 'message') {
          routed.push({
            ...e,
            fromId: e.fromId || e.friendId,
            from: e.from || e.name,
          });
          continue;
        }

        routed.push(e);
      }

      return routed;
    }

    // =========================================================================
    // [v4.3] 去重过滤系统
    // =========================================================================

    /**
     * 生成事件指纹（用于去重比较）
     * 指纹 = type + 核心标识字段（fromId/authorId/name/content等）
     */
    _generateEventFingerprint(event) {
      switch (event.type) {
        case 'friend':
          // 好友请求：按名字去重
          return 'friend:' + (event.name || event.friendName || '').trim().toLowerCase();
        case 'message':
          // 消息：按发送者去重（同一NPC短时间内不应重复发消息）
          return 'message:' + (event.fromId || event.friendId || '').trim().toLowerCase();
        case 'moment':
          // 朋友圈：按作者去重（同一NPC同一天只发一条）
          var today = new Date().toDateString();
          return 'moment:' + today + ':' + (event.authorId || event.fromId || '').trim().toLowerCase();
        case 'quest':
          // 任务：按名称去重
          return 'quest:' + (event.name || '').trim().toLowerCase();
        case 'news':
        case 'hotSearch':
          // 新闻/热搜：按标题去重
          return (event.type || 'news') + ':' + (event.title || event.content || '').trim().toLowerCase().substring(0, 50);
        case 'status':
          // 状态变更：按目标去重
          return 'status:' + (event.target || '').trim().toLowerCase();
        default:
          // 其他类型：按type+name去重
          return (event.type || 'unknown') + ':' + (event.name || event.content || '').trim().toLowerCase().substring(0, 50);
      }
    }

    /**
     * 检查单个事件是否与已有数据重复（数据层去重）
     * 查询各Schema，判断该事件是否已经在数据库中存在
     */
    async _checkDataLayerDuplicate(event) {
      try {
        switch (event.type) {
          case 'friend': {
            // [Task 5.1修复] 不再直接调用 _friendsData，改为发射事件由 Module 层处理
            // 数据层去重检查委托给 Module 层通过 Service 完成
            // 此处仅做指纹去重（第一层已处理），数据层去重由 Module 层订阅 director:npc_action 事件时处理
            return false;
          }
          case 'message': {
            // [Task 5.1修复] 不再直接调用 _messagesData，改为发射事件由 Module 层处理
            // 数据层去重检查委托给 Module 层通过 Service 完成
            return false;
          }
          case 'moment': {
            // 朋友圈去重由指纹系统处理（同一天同一作者）
            return false;
          }
          default:
            return false;
        }
      } catch (e) {
        // [铁则九] 去重检查失败不阻断
        console.warn('[DirectorService] 数据层去重检查失败:', e);
        return false;
      }
    }

    /**
     * [Phase 2] 专家系统路由
     * 根据事件类型路由到对应专家生成详细内容
     * @param {Array} events - 事件列表
     * @param {string} charId - 角色ID
     * @returns {Promise<Array>} 处理后的事件列表
     */
    async _routeToExperts(events, charId) {
      if (!Array.isArray(events)) return [];

      const routedEvents = [];

      for (const event of events) {
        if (!event || !event.type) continue;

        try {
          const expertResult = await this._callExpertForEvent(event, charId);
          if (expertResult) {
            routedEvents.push(expertResult);
          }
        } catch (e) {
          // [铁则九] 错误降级：专家调用失败时保留原事件
          console.warn('[DirectorService] 专家路由失败，保留原事件:', event.type, e);
          routedEvents.push(event);
        }
      }

      return routedEvents;
    }

    /**
     * [Phase 2] 调用对应专家处理事件
     * @param {Object} event - 原始事件
     * @param {string} charId - 角色ID
     * @returns {Promise<Object|null>} 处理后的事件
     */
    async _callExpertForEvent(event, charId) {
      const platform = this._platform;
      const context = {
        charId: charId,
        worldContext: await this._getWorldContext(),
        triggerEvent: event,
      };

      switch (event.type) {
        case 'message': {
          // NPC消息专家
          if (typeof window.NPCExpert === 'undefined') {
            return event;
          }
          const npcExpert = new window.NPCExpert(platform);
          const result = await npcExpert.generate({
            ...context,
            npcId: event.fromId,
            npcName: event.from,
            messageType: 'chat',
          });
          if (result && result.messages && result.messages.length > 0) {
            const msg = result.messages[0];
            return {
              ...event,
              content: msg.content || event.content,
              emotion: msg.emotion || 'neutral',
              _expertEnhanced: true,
            };
          }
          return event;
        }

        case 'quest': {
          // 任务专家
          if (typeof window.QuestExpert === 'undefined') {
            return event;
          }
          const questExpert = new window.QuestExpert(platform);
          const result = await questExpert.generate({
            ...context,
            questType: event.questType || 'side',
            importance: event.importance || 'medium',
            npcId: event.friendId || event.issuerId,
            npcName: event.name,
          });
          if (result && result.quests && result.quests.length > 0) {
            const quest = result.quests[0];
            return {
              ...event,
              name: quest.name || event.name,
              description: quest.description || event.description,
              steps: quest.steps || event.steps,
              reward: quest.rewards || event.reward,
              _expertEnhanced: true,
            };
          }
          return event;
        }

        case 'moment': {
          // 社交专家 - 朋友圈
          if (typeof window.SocialExpert === 'undefined') {
            return event;
          }
          const socialExpert = new window.SocialExpert(platform);
          const result = await socialExpert.generate({
            ...context,
            npcId: event.authorId || event.fromId,
            npcName: event.author,
            interactionType: 'moment',
          });
          if (result && result.interactions && result.interactions.length > 0) {
            const interaction = result.interactions[0];
            return {
              ...event,
              content: interaction.content || event.content,
              _expertEnhanced: true,
            };
          }
          return event;
        }

        case 'news':
        case 'hotSearch': {
          // 新闻专家
          if (typeof window.NewsExpert === 'undefined') {
            return event;
          }
          const newsExpert = new window.NewsExpert(platform);
          const result = await newsExpert.generate({
            ...context,
            newsCount: event.items ? event.items.length : 1,
          });
          if (result && result.news && result.news.length > 0) {
            if (event.type === 'hotSearch') {
              return {
                ...event,
                items: result.news.map((n, i) => ({
                  title: n.title,
                  heat: 999999 - i * 100000,
                  tag: i < 3 ? '沸' : '热',
                })),
                _expertEnhanced: true,
              };
            }
            return {
              ...event,
              content: result.news[0].content || event.content,
              author: result.news[0].author || event.author,
              _expertEnhanced: true,
            };
          }
          return event;
        }

        case 'shop': {
          // 商店专家
          if (typeof window.ShopExpert === 'undefined') {
            return event;
          }
          const shopExpert = new window.ShopExpert(platform);
          const result = await shopExpert.generate({
            ...context,
            itemCount: event.itemCount || 8,
          });
          if (result && result.items && result.items.length > 0) {
            return {
              ...event,
              items: result.items,
              _expertEnhanced: true,
            };
          }
          return event;
        }

        default:
          // 其他类型事件直接返回
          return event;
      }
    }

    /**
     * 过滤重复事件（集中去重入口）
     * 两层去重：指纹缓存去重 + 数据层去重
     */
    async _filterDuplicateEvents(events, charId) {
      if (!Array.isArray(events)) return [];

      var self = this;
      var filtered = [];

      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        if (!event || !event.type) continue;

        // 第一层：指纹缓存去重（快速，内存操作）
        var fingerprint = self._generateEventFingerprint(event);
        if (self._recentEventFingerprints.indexOf(fingerprint) !== -1) {
          console.log('[DirectorService] 指纹去重: 跳过', event.type, '-', (event.name || event.from || event.content || '').substring(0, 30));
          continue;
        }

        // 第二层：数据层去重（慢速，需要查Schema）
        var isDuplicate = await self._checkDataLayerDuplicate(event);
        if (isDuplicate) {
          continue;
        }

        // 通过去重检查，加入结果
        filtered.push(event);
        // 记录指纹
        self._recentEventFingerprints.push(fingerprint);
      }

      // 清理过期指纹（保留最近的N条）
      if (self._recentEventFingerprints.length > self._maxFingerprintCache) {
        self._recentEventFingerprints = self._recentEventFingerprints.slice(-self._maxFingerprintCache);
      }

      return filtered;
    }

    /**
     * 获取事件历史（供 UI）
     */
    async getEventHistory(limit) {
      try {
        return await this._directorData.getHistory(limit || 30);
      } catch (e) {
        console.warn('[DirectorService] getEventHistory 失败:', e);
        return [];
      }
    }

    /**
     * 解析 AI 返回结果
     * [铁则七修复] LLMGateway 在 outputFormat='json' 时返回已解析的对象
     */
    _parseResult(result) {
      // [铁则九] 类型守卫：确保 result 是可处理的类型
      if (result === null || result === undefined) return null;

      // 情况1：LLMGateway 已解析为对象（outputFormat='json'）
      if (typeof result === 'object') {
        // 验证结构
        if (result.events && Array.isArray(result.events)) {
          return result;
        }
        console.warn('[DirectorService] 结果对象缺少 events 数组');
        return null;
      }

      // 情况2：字符串格式（需要手动解析）
      if (typeof result !== 'string') {
        console.warn('[DirectorService] 结果类型异常:', typeof result, result);
        return null;
      }

      if (window.JsonRepair) {
        const parsed = window.JsonRepair.parse(result, { events: [] });
        if (parsed?.events && Array.isArray(parsed.events)) return parsed;
        return null;
      }

      try {
        const content = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(content);
        if (!parsed.events || !Array.isArray(parsed.events)) return null;
        return parsed;
      } catch (e) {
        console.warn('[DirectorService] JSON 解析失败:', e);
        return null;
      }
    }

    /**
     * 分发事件到各模块
     */
    async _dispatchEvents(events) {
      for (const event of events) {
        try {
          await this._dispatchEvent(event);
        } catch (e) {
          console.error('[DirectorService] 分发事件失败:', event.type, e);
        }
      }
    }

    /**
     * 分发单个事件
     * [铁则十二] 事件载荷必须包含 id/type/data/timestamp/source
     * [P0修复] 统一与 EventDispatcher 的数据结构期望一致
     */
    async _dispatchEvent(event) {
      switch (event.type) {
        case 'message':
          try {
            // [Task 5.1修复] 不再直接调用 _messagesData，改为发射 director:npc_action 事件
            // Module 层订阅后调用对应 MessageService 处理
            this._emitEvent('director:npc_action', {
              actionType: 'message',
              npcId: event.fromId || event.to,
              npcName: event.from || null,
              content: event.content,
              type: 'text',
            });
          } catch (e) {
            console.error('[DirectorService] 投递消息失败:', e);
          }
          this._emitEvent('director:message', event);
          break;

        case 'quest':
          // [v4.3-fix] 通过 QuestService 写入（铁则一：数据读写唯一通道）
          try {
            var questData = event.questData || {
              questType: event.questType,
              name: event.name,
              description: event.description,
              reward: event.reward || event.rewards,
              steps: event.steps || [],
              friendId: event.friendId,
              issuerName: event.from || event.issuerName,
            };
            var questSvc = this._platform?.get?.('questService');
            if (questSvc?.createQuest) {
              var charId = event.charId || 'default';
              try {
                var adapter = this._platform?.adapter;
                if (adapter?.getCurrentCharacterId) {
                  charId = await adapter.getCurrentCharacterId() || charId;
                }
              } catch (e) { /* 使用默认值 */ }
              await questSvc.createQuest(charId, questData);
              console.log('[DirectorService] ✅ 任务已通过 QuestService 创建:', questData.name);
            } else {
              console.warn('[DirectorService] questService.createQuest 不可用，跳过任务写入');
            }
          } catch (e) {
            console.error('[DirectorService] 写入任务失败:', e);
          }
          this._emitEvent('director:quest', event);
          break;

        case 'moment':
          // [v4.3-fix] 通过 NPCSocialService 写入（铁则一）
          try {
            const npcSvc = this._platform?.get?.('npcSocialService');
            if (npcSvc?.publishMomentAsNPC) {
              await npcSvc.publishMomentAsNPC(event);
            } else {
              console.warn('[DirectorService] npcSocialService.publishMomentAsNPC 不可用，跳过朋友圈写入');
            }
          } catch (e) {
            console.error('[DirectorService] 写入朋友圈失败:', e);
          }
          this._emitEvent('director:moment', event);
          break;

        case 'live':
          this._emitEvent('director:live', event);
          break;

        case 'friend':
          // [Task 5.1修复] 不再直接调用 _friendsData，改为发射 director:npc_action 事件
          // Module 层订阅后调用对应 FriendsService 处理
          try {
            this._emitEvent('director:npc_action', {
              actionType: 'friend_request',
              friendId: event.friendId || null,
              name: event.name,
              avatar: event.avatar || null,
              message: event.message || null,
              id: event.id || this._generateId(),
            });
          } catch (e) {
            console.error('[DirectorService] 创建好友请求失败:', e);
          }
          this._emitEvent('director:friend', event);
          break;

        case 'status':
          // [v4.3-fix] 通过 StatusService 写入（铁则一）
          if (event.target && event.change !== undefined) {
            try {
              var statusSvc = this._platform?.get?.('statusService');
              if (statusSvc?.updateField) {
                await statusSvc.updateField(event.target, event.change);
              } else {
                console.warn('[DirectorService] statusService.updateField 不可用，跳过状态更新');
              }
            } catch (e) {
              console.error('[DirectorService] 更新游戏状态失败:', e);
            }
          }
          this._emitEvent('director:status', event);
          break;

        // [v4.3-fix] news 通过 EventDispatcher 或 WeiboService 写入（铁则一）
        case 'news':
          try {
            if (this._eventDispatcher) {
              await this._eventDispatcher.dispatch(event);
            } else {
              var weiboSvc = this._platform?.get?.('weiboService');
              if (weiboSvc?.addPost) {
                await weiboSvc.addPost({
                  author: event.author || '世界新闻',
                  content: event.content,
                  source: 'director'
                });
              } else {
                console.warn('[DirectorService] weiboService.addPost 不可用，跳过新闻写入');
              }
            }
          } catch (e) {
            console.error('[DirectorService] 写入世界资讯失败:', e);
          }
          this._emitEvent('director:news', event);
          break;

        // [v4.3-fix] 添加 hotSearch case
        case 'hotSearch':
          try {
            var weiboSvc = this._platform?.get?.('weiboService');
            if (weiboSvc?.updateHotSearches && event.items && event.items.length > 0) {
              await weiboSvc.updateHotSearches(event.items);
              console.log('[DirectorService] ✅ 热搜已更新:', event.items.length, '条');
            } else if (event.items && event.items.length > 0) {
              // 降级：直接写入 Schema
              if (this._platform?.data) {
                var hotList = event.items.map(function(item, i) {
                  return {
                    title: item.title || item.name || String(item),
                    heat: item.heat != null ? item.heat : (999999 - i * 100000),
                    tag: item.tag || (i < 3 ? '沸' : '热')
                  };
                });
                await this._platform.data('weibo', 'hotSearches', hotList);
              }
            }
          } catch (e) {
            console.error('[DirectorService] 更新热搜失败:', e);
          }
          this._emitEvent('weibo:hotSearchesUpdated', event);
          break;

        default:
          console.warn('[DirectorService] 未知事件类型:', event.type);
      }
    }

    /**
     * 发射标准事件载荷
     * [铁则十二] 载荷结构: { id, type, data, timestamp, source }
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    _emitEvent(eventName, data) {
      if (!this._platform?.eventBus) return;

      const payload = {
        id: this._generateId(),
        type: eventName,
        data: data,
        timestamp: Date.now(),
        source: 'director-service',
      };

      this._platform.eventBus.emit(eventName, payload);
    }

    /**
     * 生成唯一 ID
     * @returns {string}
     */
    _generateId() {
      return 'dir_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    /**
     * 清除已消费的闭环变量
     */
    async _clearFeedbackVars() {
      try {
        // [T4修复] 通过 DirectorData Schema 方法清除反馈变量
        if (this._directorData) {
          await this._directorData.recordInteraction('__cleared__', {});
          await this._directorData.recordUserChoice('__cleared__', '');
          await this._directorData.recordTaskResult('__cleared__', 'cleared');
        }
      } catch (e) {
        console.warn('[DirectorService] 清除反馈变量失败:', e);
      }
    }

    /**
     * 字符串哈希
     */
    _hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    }

    /**
     * 启用/禁用导演
     */
    async setEnabled(enabled) {
      this._enabled = enabled;
      await this._directorData.setEnabled(enabled);
    }

    /**
     * 获取导演状态
     */
    async getStatus() {
      return await this._directorData.getStatus();
    }

    /**
     * 手动触发
     */
    async manualTrigger() {
      await this.trigger();
    }

    /**
     * [新增 v4.1] 记录事件到 StoryEventsData 时间线
     * [铁则一] 通过 Schema 写入
     * @param {Array} events
     */
    async _recordEventsToTimeline(events) {
      // [修复] 同时写入 StoryEvents（旧）和 StoryEvolution（新），确保两个面板都能读到
      var StoryEvents = window.PhoneData?.StoryEvents;
      var StoryEvolution = window.PhoneData?.StoryEvolution;
      
      if (!StoryEvents && !StoryEvolution) {
        console.warn('[DirectorService] StoryEvents/StoryEvolution Schema 均未加载，跳过记录');
        return;
      }

      // 写入 StoryEvents（旧Schema）
      if (StoryEvents) {
        var eventsData = new StoryEvents(this._platform);
        for (var i = 0; i < events.length; i++) {
          var event = events[i];
          try {
            await eventsData.add({
              id: event.id || this._generateId(),
              time: Date.now(),
              type: event.type,
              summary: this._summarizeEvent(event),
              actors: this._extractActors(event),
              location: event.location || null,
              impact: event.impact || null,
            });
          } catch (e) {
            console.warn('[DirectorService] 记录事件到StoryEvents失败:', event.type, e);
          }
        }
      }

      // [v4.1] 写入 StoryEvolution（新Schema，日记面板剧情推演用）
      if (StoryEvolution) {
        var evoData = new StoryEvolution(this._platform);
        for (var j = 0; j < events.length; j++) {
          var evt = events[j];
          try {
            await evoData.addPoint('default', {
              id: evt.id || this._generateId(),
              timestamp: Date.now(),
              type: this._classifyEventType(evt.type),
              text: this._summarizeEvent(evt),
              description: evt.content || evt.description || '',
              source: evt.type,
              actors: this._extractActors(evt)
            });
          } catch (e) {
            console.warn('[DirectorService] 记录事件到StoryEvolution失败:', evt.type, e);
          }
        }
        console.log('[DirectorService] ✅ 已记录', events.length, '个事件到剧情推演时间线');
      }
    }

    /**
     * [v4.1] 事件类型分类：major/minor/background
     */
    _classifyEventType(type) {
      var majorTypes = ['quest', 'message', 'friend'];
      var minorTypes = ['moment', 'status', 'live'];
      if (majorTypes.indexOf(type) >= 0) return 'major';
      if (minorTypes.indexOf(type) >= 0) return 'minor';
      return 'background';
    }

    /**
     * [新增 v4.1] 生成事件摘要
     * @private
     */
    _summarizeEvent(event) {
      switch (event.type) {
        case 'message':
          return `${event.from || '某人'} 发来消息: ${(event.content || '').substring(0, 50)}`;
        case 'quest':
          return `新任务: ${event.name || '未命名任务'}`;
        case 'friend':
          return `新好友请求: ${event.name || '未知'}`;
        case 'status':
          return `状态变更: ${event.target || '未知'} → ${event.change || '?'}`;
        case 'moment':
          return `${event.author || '某人'} 发布了朋友圈`;
        case 'live':
          return `直播事件: ${event.action || 'unknown'}`;
        case 'news':
          return `世界资讯: ${(event.content || '').substring(0, 50)}`;
        default:
          return `事件: ${event.type}`;
      }
    }

    /**
     * [新增 v4.1] 提取事件参与者
     * @private
     */
    _extractActors(event) {
      const actors = [];
      if (event.from) actors.push(event.from);
      if (event.name && event.type === 'friend') actors.push(event.name);
      if (event.author) actors.push(event.author);
      return actors;
    }

    /**
     * [v4.1] 检测ST上下文变化量
     * 通过对比最近聊天消息的哈希来判断是否有足够变化
     * @returns {Promise<boolean>} true=有足够变化，应该触发
     */
    async _checkContextDelta() {
      // 首次运行，没有上次哈希，允许触发
      if (!this._lastContextHash) {
        return true;
      }

      try {
        var recentMessages = [];
        if (this._platform?.adapter?.getRecentChatMessages) {
          var msgs = await this._platform.adapter.getRecentChatMessages(3);
          if (Array.isArray(msgs)) {
            recentMessages = msgs.map(function (m) {
              return (m.mes || '').substring(0, 200);
            }).join('|');
          }
        }

        if (!recentMessages) {
          return true; // 无法获取消息时允许触发
        }

        var currentHash = this._hashString(recentMessages);

        // 如果哈希完全相同，说明上下文没变化
        if (currentHash === this._lastContextHash) {
          return false;
        }

        // 更新哈希
        this._lastContextHash = currentHash;
        return true;
      } catch (e) {
        console.warn('[DirectorService] 上下文变化检测失败，允许触发:', e);
        return true;
      }
    }

    /**
     * [v4.1] 获取世界概况（用于Director上下文增强）
     * [铁则一] 通过 WorldData Schema 读取
     * @param {string} charId
     * @returns {Promise<string|null>} 世界概况文本，null表示无世界数据
     */
    async _getWorldContext(charId) {
      try {
        if (this._worldData && typeof this._worldData.get === 'function') {
          var world = await this._worldData.get(charId);
          if (world) {
            return JSON.stringify({
              name: world.name,
              era: world.era,
              theme: world.theme,
              description: world.description,
              npcs: (world.npcs || []).map(function (n) { return n.name; }),
              locations: world.keyLocations || []
            });
          }
        }
        return '暂无世界数据';
      } catch (e) {
        return '暂无世界数据';
      }
    }

    // ==================== [v3.0] 变量化相关方法 ====================

    /**
     * [v3.0 改造] 实时从源头 Schema 提取变量（零存储、零双写）
     * 每次调用时从 WorldData/NPCData/StoryEvents/FriendsData 等读取摘要
     * 铁则一：所有读取通过 Schema
     * 铁则八：不维护内存副本
     *
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 变量键值对
     */
    async _getVariables(charId) {
      var variables = {};

      // ---- world.* 变量（从 WorldData 实时读取）----
      try {
        var WorldDataClass = window.PhoneData?.World;
        if (WorldDataClass) {
          var worldData = new WorldDataClass(this._platform);
          var world = await worldData.get(charId);
          if (world) {
            variables['world.name'] = world.name || '未知';
            variables['world.era'] = world.era || '未知';
            variables['world.theme'] = world.theme || '未知';
            variables['world.atmosphere'] = world.atmosphere || '未知';
            variables['world.keyLocations'] = Array.isArray(world.keyLocations) ? world.keyLocations.join('、') : '';
            // [v4.3-fix] factions 可能是字符串数组或对象数组
            variables['world.factions'] = Array.isArray(world.factions)
              ? world.factions.map(function(f) { return typeof f === 'string' ? f : (f.name || ''); }).filter(Boolean).join('、')
              : '';
            variables['world.rules'] = Array.isArray(world.rules) ? world.rules.join('；') : '';
            variables['world.currentStage'] = String(await worldData.getStage(charId));
            variables['world.revealedTruth'] = this._formatRevealedTruth(world, await worldData.getStage(charId));
            variables['world.activeNPCs'] = Array.isArray(world.npcs) ? world.npcs.map(function (n) {
              return (n.name || '未知') + '(' + (n.location || '未知') + ')[' + (n.relationship || '未知') + ']';
            }).join('、') : '';
            variables['world.recentNews'] = this._formatRecentNews(world);
          }
        }
      } catch (e) {
        console.warn('[DirectorService] 读取世界变量失败:', e);
      }

      // ---- story.* 变量（从 StoryEvents/FriendsData 实时读取）----
      try {
        // 玩家位置
        var WorldFactsClass = window.PhoneData?.WorldFacts;
        if (WorldFactsClass) {
          var factsData = new WorldFactsClass(this._platform);
          variables['story.playerLocation'] = await factsData.getCurrentLocation() || '未知';
        } else {
          variables['story.playerLocation'] = '未知';
        }

        // 最新玩家行为（从 ST 适配器获取）
        if (this._platform?.adapter?.getRecentChatMessages) {
          var recentMsgs = this._platform.adapter.getRecentChatMessages(1);
          if (Array.isArray(recentMsgs) && recentMsgs.length > 0) {
            var lastMsg = recentMsgs[recentMsgs.length - 1];
            variables['story.playerAction'] = (lastMsg.is_user ? '玩家: ' : (lastMsg.name || 'AI') + ': ') + (lastMsg.mes || '').substring(0, 50);
          } else {
            variables['story.playerAction'] = '暂无';
          }
        } else {
          variables['story.playerAction'] = '暂无';
        }

        // 最近事件（从 StoryEvents 读取）
        variables['story.lastEvent'] = await this._extractLastEvent(charId);

        // 活跃任务
        variables['story.activeQuests'] = await this._formatActiveQuests(charId);

        // 偏差分数
        variables['story.deviationScore'] = String(this._deviationScore || 0);

        // 关键关系（从 FriendsData 读取）
        variables['story.keyRelationships'] = await this._formatKeyRelationships(charId);
      } catch (e) {
        console.warn('[DirectorService] 读取剧情变量失败:', e);
      }

      // ---- sys.* 变量（运行时状态）----
      variables['sys.pendingTasks'] = String(this._pendingTaskCount || 0);
      variables['sys.triggerCount'] = String(this._todayTriggerCount || 0);

      return variables;
    }

    /**
     * [v3.0] 格式化已揭示的真相
     */
    _formatRevealedTruth(world, stage) {
      if (!world || !world.meta || !world.meta.onion_layers) return '暂无世界信息';
      var s = stage || this._currentStage || 1;
      var parts = [];
      var layerMap = { 1: 'L1_TheVeil', 2: 'L2_TheDistortion', 3: 'L3_TheLaw', 4: 'L4_TheAgent', 5: 'L5_TheAxiom' };
      for (var i = 1; i <= s && i <= 5; i++) {
        var layerKey = layerMap[i];
        var layerData = world.meta.onion_layers[layerKey];
        if (layerData && layerData.length) {
          var items = layerData.map(function (item) { return '- ' + (item.name || '') + ': ' + (item.description || ''); });
          parts.push('【' + layerKey + '】\n' + items.join('\n'));
        }
      }
      return parts.join('\n\n') || '暂无已揭示信息';
    }

    /**
     * [v3.0] 格式化最近世界资讯
     */
    _formatRecentNews(world) {
      if (!world || !world.news || !Array.isArray(world.news)) return '暂无资讯';
      return world.news.slice(0, 3).map(function (n) {
        return '- ' + (n.title || '') + ': ' + ((n.content || '').substring(0, 50));
      }).join('\n');
    }

    /**
     * [v3.0] 提取最近事件
     */
    async _extractLastEvent(charId) {
      try {
        if (this._storyEventsData && typeof this._storyEventsData.query === 'function') {
          var events = await this._storyEventsData.query({ charId: charId }, { limit: 1, sort: 'desc' });
          if (events && events.length > 0) {
            return (events[0].type || '') + ': ' + ((events[0].description || '').substring(0, 50));
          }
        }
        return '暂无事件';
      } catch (e) {
        return '暂无事件';
      }
    }

    /**
     * [v3.0] 格式化活跃任务
     */
    async _formatActiveQuests(charId) {
      try {
        if (this._questData && typeof this._questData.query === 'function') {
          var quests = await this._questData.query({ charId: charId, status: 'active' });
          if (quests && quests.length > 0) {
            return quests.map(function (q) { return (q.name || '未知') + '(' + (q.status || '进行中') + ')'; }).join('、');
          }
        }
        return '暂无活跃任务';
      } catch (e) {
        return '暂无活跃任务';
      }
    }

    /**
     * [v3.0] 格式化关键关系
     */
    async _formatKeyRelationships(charId) {
      try {
        // [Task 5.1修复] 不再直接调用 _friendsData，改为通过 WorldData 读取 NPC 关系
        var WorldDataClass = window.PhoneData?.World;
        if (WorldDataClass) {
          var worldData = new WorldDataClass(this._platform);
          var world = await worldData.get(charId);
          if (world && Array.isArray(world.npcs) && world.npcs.length > 0) {
            return world.npcs.slice(0, 5).map(function (n) {
              return (n.name || '未知') + ': ' + (n.relationship || '普通');
            }).join('；');
          }
        }
        return '暂无关系数据';
      } catch (e) {
        return '暂无关系数据';
      }
    }

    /**
     * [v4.1] 设置总开关
     * @param {boolean} enabled
     */
    async setMasterSwitch(enabled) {
      this._masterSwitch = !!enabled;
      console.log('[DirectorService] 总开关已设置为:', this._masterSwitch ? '开启' : '关闭');

      // 持久化到全局设置
      try {
        if (this._platform?.data) {
          var settings = await this._platform.data('settings', 'main', null);
          settings = settings || {};
          settings.directorEnabled = this._masterSwitch;
          await this._platform.setData('settings', 'main', settings);
        }
      } catch (e) {
        console.warn('[DirectorService] 保存总开关设置失败:', e);
      }
    }

    /**
     * [v4.1] 获取总开关状态
     * @returns {boolean}
     */
    isMasterSwitchOn() {
      return this._masterSwitch;
    }

    // ==================== [v4.2] NPC行为调度系统 ====================

    /**
     * NPC行为调度检查
     * 由叙事节拍触发，决定哪些NPC应该行动
     * [铁则九] 所有操作有 try/catch 错误处理
     * [铁则十二] 事件载荷使用 PayloadBuilder 构造
     */
    async scheduleBehaviorCheck() {
      try {
        var config = await this._getDirectorConfig();
        this._narrativeBeatCounter++;

        // 每隔 narrativeBeatInterval 个节拍执行一次NPC行为检查
        if (this._narrativeBeatCounter % config.narrativeBeatInterval !== 0) {
          return;
        }

        var activeNPCs = await this._getActiveNPCs(config.npcActivationPerBeat);
        if (!activeNPCs || activeNPCs.length === 0) {
          return;
        }

        for (var i = 0; i < activeNPCs.length; i++) {
          try {
            var npc = activeNPCs[i];
            var action = await this._decideNPCAction(npc, config);
            if (action) {
              await this._executeNPCAction(npc, action);
            }
          } catch (npcErr) {
            console.warn('[DirectorService] NPC行为调度失败:', activeNPCs[i].name, npcErr);
          }
        }

        // 推演大世界
        if (this._narrativeBeatCounter % config.worldEvolutionInterval === 0) {
          await this._evolveWorld();
        }
      } catch (e) {
        console.warn('[DirectorService] scheduleBehaviorCheck 失败:', e);
      }
    }

    /**
     * 获取导演配置
     * [铁则一] 通过 ApiConfigData Schema 读取
     * @returns {Promise<Object>}
     * @private
     */
    async _getDirectorConfig() {
      try {
        if (this._directorConfig) {
          return this._directorConfig;
        }
        if (this._apiConfig && typeof this._apiConfig.getDirectorConfig === 'function') {
          this._directorConfig = await this._apiConfig.getDirectorConfig();
          return this._directorConfig;
        }
        // 降级默认值
        return {
          narrativeBeatInterval: 10,
          npcCooldownMinutes: 15,
          npcActivationPerBeat: 0.4,
          worldEvolutionInterval: 2,
          infoUpdateHours: 6,
          offlineCatchUpThreshold: 24,
          messageArchiveDays: 7,
          messagePurgeDays: 90,
        };
      } catch (e) {
        console.warn('[DirectorService] _getDirectorConfig 失败:', e);
        return {
          narrativeBeatInterval: 10,
          npcCooldownMinutes: 15,
          npcActivationPerBeat: 0.4,
          worldEvolutionInterval: 2,
          infoUpdateHours: 6,
          offlineCatchUpThreshold: 24,
          messageArchiveDays: 7,
          messagePurgeDays: 90,
        };
      }
    }

    /**
     * 获取活跃NPC列表
     * @param {number} activationRatio - 激活比例 (0~1)
     * @returns {Promise<Array>}
     * @private
     */
    async _getActiveNPCs(activationRatio) {
      try {
        var WorldDataClass = window.PhoneData?.World;
        if (!WorldDataClass) return [];

        var charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        var worldData = new WorldDataClass(this._platform);
        var world = await worldData.get(charId);

        if (!world || !Array.isArray(world.npcs) || world.npcs.length === 0) {
          return [];
        }

        // 过滤掉冷却中的NPC
        var now = Date.now();
        var cooldownMs = 15 * 60 * 1000; // 默认15分钟冷却
        try {
          var config = await this._getDirectorConfig();
          cooldownMs = (config.npcCooldownMinutes || 15) * 60 * 1000;
        } catch (e) { /* 使用默认值 */ }

        var available = world.npcs.filter(function (npc) {
          var lastActionTime = 0;
          if (npc._lastActionTime) {
            lastActionTime = npc._lastActionTime;
          }
          return (now - lastActionTime) >= cooldownMs;
        });

        // 按激活比例随机选取
        var count = Math.max(1, Math.floor(available.length * (activationRatio || 0.4)));
        var shuffled = available.slice().sort(function () { return Math.random() - 0.5; });
        return shuffled.slice(0, count);
      } catch (e) {
        console.warn('[DirectorService] _getActiveNPCs 失败:', e);
        return [];
      }
    }

    /**
     * 决定NPC行为
     * @param {Object} npc - NPC数据
     * @param {Object} config - 导演配置
     * @returns {Promise<Object|null>} 行为对象
     * @private
     */
    async _decideNPCAction(npc, config) {
      try {
        var actionPool = await this._getActionPool(npc);
        if (!actionPool || actionPool.length === 0) {
          return null;
        }

        var action = this._weightedRandomSelect(actionPool);
        if (!action) return null;

        // 使用 LLM 生成行为内容
        if (typeof window.LLMGateway !== 'undefined') {
          try {
            var llmGateway = new window.LLMGateway(this._platform);
            var worldContext = await this._getWorldContext();
            var result = await llmGateway.generate('npc-behavior', {
              npcName: npc.name || '未知',
              npcPersonality: npc.personality || '普通',
              npcRelationship: npc.relationship || '陌生人',
              worldContext: worldContext,
              actionType: action.type,
            });

            if (result && typeof result === 'object') {
              return {
                type: action.type,
                content: result.content || '',
                reason: result.reason || '',
                mood: result.mood || '平静',
                npcName: npc.name,
                npcId: npc.id || npc.name,
              };
            }
          } catch (llmErr) {
            console.warn('[DirectorService] LLM NPC行为生成失败，使用默认:', llmErr);
          }
        }

        // 降级：使用 _getProactiveTrigger 生成触发语作为内容
        var triggerText = this._getProactiveTrigger(npc, action.type);
        return {
          type: action.type,
          content: triggerText,
          reason: '降级模式（触发语池）',
          mood: '平静',
          npcName: npc.name,
          npcId: npc.id || npc.name,
        };
      } catch (e) {
        console.warn('[DirectorService] _decideNPCAction 失败:', e);
        return null;
      }
    }

    /**
     * [Task 6.2] 获取NPC主动消息触发语
     * 包含多样化触发语池：日常闲聊、分享、情绪表达、询问近况等 8+ 种动机模板
     * @param {Object} npc - NPC数据
     * @param {string} actionType - 行为类型（message/moment/weibo等）
     * @returns {string} 触发语
     * @private
     */
    _getProactiveTrigger(npc, actionType) {
      var personality = (npc.personality || '').toLowerCase();
      var relationship = (npc.relationship || '').toLowerCase();
      var name = npc.name || '某人';

      // 8种动机模板，每种有多个变体
      var triggerPool = {
        // 1. 日常闲聊
        daily_chat: [
          '突然想到你，发个消息聊聊',
          '闲着没事，找你说说话',
          '今天过得怎么样？',
          '好久没联系了，最近忙吗？',
          '刚吃完饭，你在干嘛呢？',
        ],
        // 2. 分享见闻
        share: [
          '刚刚看到一件很有趣的事，想告诉你',
          '今天遇到了一个特别的人，跟你分享下',
          '发现了一个好地方，下次一起去吧',
          '刚听到一个消息，你肯定想不到',
          '拍到了一张好看的照片，给你看看',
        ],
        // 3. 情绪表达
        emotion: [
          '今天心情特别好，想跟你说说',
          '有点不开心，想找个人聊聊',
          '突然觉得很感动，想分享给你',
          '有点烦，能陪我聊会儿吗？',
          '太激动了！等不及要告诉你',
        ],
        // 4. 询问近况
        check_in: [
          '最近怎么样？一切还好吗？',
          '好几天没见了，你还好吧？',
          '在忙什么呢？有空吗？',
          '突然想到你，想问问你最近的情况',
          '好久没聚了，什么时候有空？',
        ],
        // 5. 请求帮助
        request_help: [
          '有件事想请你帮忙',
          '遇到点麻烦，你能帮我看看吗？',
          '想请教一下你的意见',
          '有个问题想问你，方便吗？',
          '需要你帮个忙，不知道方不方便',
        ],
        // 6. 关心提醒
        care_reminder: [
          '天气变凉了，记得多穿点',
          '别忘了今天还有事要做哦',
          '提醒你一下，别忘了吃饭',
          '看你最近挺忙的，注意休息',
          '今天好像有什么事，别忘了',
        ],
        // 7. 邀约互动
        invite: [
          '有空出来坐坐吗？',
          '周末有什么安排？一起出去玩吧',
          '在附近吗？要不要见个面？',
          '有个活动挺有意思的，一起去看看？',
          '好久没一起吃饭了，约一个？',
        ],
        // 8. 事件触发
        event_trigger: [
          '出大事了，你知道吗？',
          '刚刚收到一个消息，跟你有关',
          '有个紧急的事情要告诉你',
          '你听说了吗？最近发生了好多事',
          '出状况了，需要你帮忙处理一下',
        ],
        // 9. 情感暗示
        romantic_hint: [
          '今天看到一样东西，让我想起了你',
          '突然很想见你',
          '你在想我吗？',
          '今天的风很温柔，像你一样',
          '有些话一直想说，不知道该不该说',
        ],
        // 10. 信息交换
        info_exchange: [
          '上次说的那件事有进展了',
          '告诉你一个好消息',
          '有个内部消息，你想知道吗？',
          '上次聊到的话题，我又想了想',
          '有些新情况，跟你同步一下',
        ],
      };

      // 根据NPC性格和关系选择合适的动机类别
      var selectedCategory;
      var categories = Object.keys(triggerPool);

      // 根据性格偏好选择类别
      if (personality.indexOf('活泼') >= 0 || personality.indexOf('外向') >= 0) {
        selectedCategory = ['daily_chat', 'share', 'invite', 'emotion'][Math.floor(Math.random() * 4)];
      } else if (personality.indexOf('温柔') >= 0 || personality.indexOf('体贴') >= 0) {
        selectedCategory = ['care_reminder', 'check_in', 'emotion', 'romantic_hint'][Math.floor(Math.random() * 4)];
      } else if (personality.indexOf('冷漠') >= 0 || personality.indexOf('高冷') >= 0) {
        selectedCategory = ['event_trigger', 'info_exchange', 'request_help'][Math.floor(Math.random() * 3)];
      } else if (personality.indexOf('热情') >= 0 || personality.indexOf('开朗') >= 0) {
        selectedCategory = ['share', 'invite', 'daily_chat', 'info_exchange'][Math.floor(Math.random() * 4)];
      } else {
        // 默认随机选择
        selectedCategory = categories[Math.floor(Math.random() * categories.length)];
      }

      // 根据关系深度调整：关系亲密时增加浪漫/情感类触发
      if (relationship.indexOf('恋人') >= 0 || relationship.indexOf('亲密') >= 0 || relationship.indexOf('暧昧') >= 0) {
        var intimateCategories = ['romantic_hint', 'emotion', 'care_reminder', 'daily_chat'];
        selectedCategory = intimateCategories[Math.floor(Math.random() * intimateCategories.length)];
      }

      // 从选中的类别中随机选择一条触发语
      var triggers = triggerPool[selectedCategory] || triggerPool.daily_chat;
      var trigger = triggers[Math.floor(Math.random() * triggers.length)];

      console.log('[DirectorService] NPC主动触发语:', name, '类别:', selectedCategory, '触发语:', trigger);

      return trigger;
    }

    /**
     * 获取NPC行为池
     * @param {Object} npc - NPC数据
     * @returns {Promise<Array>}
     * @private
     */
    async _getActionPool(npc) {
      try {
        // 检查缓存
        var cacheKey = npc.id || npc.name;
        if (this._actionPoolCache.has(cacheKey)) {
          return this._actionPoolCache.get(cacheKey);
        }

        // 基础行为池
        var pool = [
          { type: 'message', weight: 30, description: '发送消息', layer: 0 },
          { type: 'moment', weight: 20, description: '发朋友圈', layer: 0 },
          { type: 'weibo', weight: 15, description: '发微博', layer: 0 },
          { type: 'forum', weight: 10, description: '发论坛帖子', layer: 0 },
          { type: 'live', weight: 5, description: '开直播', layer: 0 },
          { type: 'idle', weight: 20, description: '无行动', layer: 0 },
          // [Task 4.1] 新增世界事件层和任务通知
          { type: 'world-news', weight: 10, description: '世界新闻', layer: 1 },
          { type: 'economy-event', weight: 5, description: '经济事件', layer: 1 },
          { type: 'atmosphere-event', weight: 3, description: '氛围事件', layer: 1 },
          { type: 'quest-notify', weight: 10, description: '任务通知', layer: 3 },
        ];

        // 根据NPC性格调整权重
        var personality = (npc.personality || '').toLowerCase();
        if (personality.indexOf('活跃') >= 0 || personality.indexOf('外向') >= 0) {
          pool[0].weight = 40; // message
          pool[1].weight = 25; // moment
          pool[5].weight = 5;  // idle
        } else if (personality.indexOf('内向') >= 0 || personality.indexOf('安静') >= 0) {
          pool[0].weight = 15; // message
          pool[1].weight = 15; // moment
          pool[5].weight = 40; // idle
        }

        this._actionPoolCache.set(cacheKey, pool);
        return pool;
      } catch (e) {
        console.warn('[DirectorService] _getActionPool 失败:', e);
        return [];
      }
    }

    /**
     * 加权随机选择
     * @param {Array} items - { weight, ... } 数组
     * @returns {Object|null}
     * @private
     */
    _weightedRandomSelect(items) {
      if (!items || items.length === 0) return null;

      var totalWeight = 0;
      for (var i = 0; i < items.length; i++) {
        totalWeight += (items[i].weight || 1);
      }

      var random = Math.random() * totalWeight;
      var cumulative = 0;

      for (var j = 0; j < items.length; j++) {
        cumulative += (items[j].weight || 1);
        if (random <= cumulative) {
          return items[j];
        }
      }

      return items[items.length - 1];
    }

    /**
     * 执行NPC行为
     * @param {Object} npc - NPC数据
     * @param {Object} action - 行为对象
     * @private
     */
    async _executeNPCAction(npc, action) {
      try {
        // [Task 4.2] 冷却检查：NPC 行为触发前检查冷却
        if (!this._canTriggerEvent(action.type, npc.id || npc.name)) {
          console.log('[DirectorService] NPC行为冷却: 跳过', action.npcName, action.type);
          return;
        }

        // [Task 4.4] 节奏控制：检查是否应强制切换类型
        if (this._shouldForceSwitch(action.type)) {
          console.log('[DirectorService] 节奏控制: 强制切换事件类型，跳过', action.type);
          return;
        }

        // [v4.3] NPC行为去重检查：生成指纹并检查是否重复
        var npcEvent = {
          type: action.type,
          fromId: action.npcId || npc.id,
          authorId: action.npcId || npc.id,
          name: action.npcName || npc.name,
          content: action.content,
        };
        var npcFingerprint = this._generateEventFingerprint(npcEvent);
        if (this._recentEventFingerprints.indexOf(npcFingerprint) !== -1) {
          console.log('[DirectorService] NPC行为去重: 跳过', action.npcName, action.type);
          return;
        }
        this._recentEventFingerprints.push(npcFingerprint);

        // 更新NPC冷却时间
        var cacheKey = npc.id || npc.name;
        this._npcCooldowns.set(cacheKey, Date.now());

        // [Task 4.2] 记录事件已触发
        this._onEventTriggered(action.type, npc.id || npc.name);

        // 分发行为到对应模块
        await this._dispatchNPCAction(action.type, {
          npcId: action.npcId,
          npcName: action.npcName,
          content: action.content,
          reason: action.reason,
          mood: action.mood,
        });

        console.log('[DirectorService] NPC行为已执行:', action.npcName, action.type);
      } catch (e) {
        console.warn('[DirectorService] _executeNPCAction 失败:', e);
      }
    }

    /**
     * 分发NPC行为到对应模块
     * @param {string} actionType - 行为类型
     * @param {Object} event - 事件数据
     * @private
     */
    async _dispatchNPCAction(actionType, event) {
      try {
        switch (actionType) {
          case 'message':
            // [Task 5.1修复] 不再直接调用 _messagesData，改为发射 director:npc_action 事件
            // Module 层订阅后调用对应 MessageService 处理
            this._emitEvent('director:npc_action', {
              actionType: 'message',
              npcId: event.npcId,
              npcName: event.npcName,
              content: event.content,
              type: 'text',
            });
            break;

          case 'moment':
            // [v4.3-fix] 通过 NPCSocialService 写入（铁则一）
            try {
              var npcSvc2 = this._platform?.get?.('npcSocialService');
              if (npcSvc2?.publishMomentAsNPC) {
                await npcSvc2.publishMomentAsNPC({
                  author: event.npcName,
                  authorId: event.npcId,
                  content: event.content,
                  source: 'npc-behavior'
                });
              } else {
                console.warn('[DirectorService] npcSocialService 不可用，跳过NPC朋友圈写入');
              }
            } catch (e) {
              console.error('[DirectorService] NPC朋友圈写入失败:', e);
            }
            break;

          case 'weibo':
            // [v4.3-fix] 通过 WeiboService 写入（铁则一）
            try {
              var weiboSvc2 = this._platform?.get?.('weiboService');
              if (weiboSvc2?.addPost) {
                await weiboSvc2.addPost({
                  author: event.npcName,
                  content: event.content,
                  source: 'npc-behavior'
                });
              } else {
                console.warn('[DirectorService] weiboService 不可用，跳过NPC微博写入');
              }
            } catch (e) {
              console.error('[DirectorService] NPC微博写入失败:', e);
            }
            break;

          case 'forum':
            // [v4.3-fix] 通过 ForumService 写入（铁则一）
            try {
              var forumSvc = this._platform?.get?.('forumService');
              if (forumSvc?.createPost) {
                await forumSvc.createPost({
                  author: event.npcName,
                  content: event.content,
                  source: 'npc-behavior'
                });
              } else {
                console.warn('[DirectorService] forumService 不可用，跳过NPC论坛写入');
              }
            } catch (e) {
              console.error('[DirectorService] NPC论坛写入失败:', e);
            }
            break;

          case 'live':
            // [v4.3-fix] 通过 LiveService 写入（铁则一）
            try {
              var liveSvc = this._platform?.get?.('liveService');
              if (liveSvc?.handleDirectorEvent) {
                await liveSvc.handleDirectorEvent({
                  streamerName: event.npcName,
                  streamerId: event.npcId,
                  title: event.content,
                  source: 'npc-behavior'
                });
              } else {
                console.warn('[DirectorService] liveService 不可用，跳过NPC直播写入');
              }
            } catch (e) {
              console.error('[DirectorService] NPC直播写入失败:', e);
            }
            break;

          case 'idle':
            // 无行动，不处理
            break;

          default:
            console.warn('[DirectorService] 未知NPC行为类型:', actionType);
        }

        // [铁则十二] 发射NPC行为事件
        if (this._platform?.eventBus && actionType !== 'idle') {
          var payload;
          if (window.PayloadBuilder) {
            payload = window.PayloadBuilder.npc.action(event.npcId, actionType, event, 'director-service');
          } else {
            payload = {
              id: this._generateId(),
              type: 'npc:action',
              data: { npcId: event.npcId, actionType: actionType, actionData: event },
              timestamp: Date.now(),
              source: 'director-service',
            };
          }
          this._platform.eventBus.emit('npc:action', payload);
        }
      } catch (e) {
        console.warn('[DirectorService] _dispatchNPCAction 失败:', actionType, e);
      }
    }

    /**
     * 推演大世界
     * [铁则九] try/catch 错误处理
     * [铁则十二] 使用 PayloadBuilder 构造事件载荷
     * @private
     */
    async _evolveWorld() {
      try {
        if (typeof window.LLMGateway === 'undefined') {
          return;
        }

        var worldContext = await this._getWorldContext();
        if (!worldContext || worldContext === '暂无世界数据') {
          return;
        }

        var charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        var WorldDataClass = window.PhoneData?.World;
        if (!WorldDataClass) return;

        var worldData = new WorldDataClass(this._platform);
        var world = await worldData.get(charId);
        if (!world) return;

        var llmGateway = new window.LLMGateway(this._platform);
        var result = await llmGateway.generate('world-simulator', {
          worldName: world.name || '未知',
          currentStage: String(await worldData.getStage(charId)),
          deviationScore: String(this._deviationScore || 0),
          worldTruth: this._formatRevealedTruth(world, await worldData.getStage(charId)),
          recentEvents: this._formatRecentNews(world),
          recentPlayerActions: '暂无',
        });

        if (result && typeof result === 'object') {
          // [铁则十二] 发射世界推演事件
          if (this._platform?.eventBus) {
            var payload;
            if (window.PayloadBuilder) {
              payload = window.PayloadBuilder.director.worldEvolved(result, 'director-service');
            } else {
              payload = {
                id: this._generateId(),
                type: 'director:worldEvolved',
                data: result,
                timestamp: Date.now(),
                source: 'director-service',
              };
            }
            this._platform.eventBus.emit('director:worldEvolved', payload);
          }

          // 处理NPC关系变化
          if (result.npc_changes && Array.isArray(result.npc_changes)) {
            for (var i = 0; i < result.npc_changes.length; i++) {
              await this._updateNPCRelationship(result.npc_changes[i]);
            }
          }

          console.log('[DirectorService] 大世界推演完成');
        }
      } catch (e) {
        console.warn('[DirectorService] _evolveWorld 失败:', e);
      }
    }

    /**
     * 获取世界上下文
     * @returns {Promise<string>}
     * @private
     */
    async _getWorldContext() {
      try {
        var charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        var WorldDataClass = window.PhoneData?.World;
        if (!WorldDataClass) return { name: '未知世界', npcs: [] };

        var worldData = new WorldDataClass(this._platform);
        var world = await worldData.get(charId);
        if (!world) return { name: '未知世界', npcs: [] };

        // [修复] 直接返回对象，不要JSON.stringify
        return {
          name: world.name,
          era: world.era,
          theme: world.theme,
          description: world.description,
          npcs: (world.npcs || []).map(function (n) {
            return { id: n.id, name: n.name, personality: n.personality, relationship: n.relationship, role: n.role };
          }),
          locations: world.keyLocations || [],
          atmosphere: world.atmosphere || '',
        };
      } catch (e) {
        console.warn('[DirectorService] _getWorldContext 失败:', e);
        return { name: '未知世界', npcs: [] };
      }
    }

    /**
     * 更新NPC关系
     * @param {Object} change - { name, change, reason }
     * @private
     */
    async _updateNPCRelationship(change) {
      try {
        if (!change || !change.name) return;

        var charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        var WorldDataClass = window.PhoneData?.World;
        if (!WorldDataClass) return;

        var worldData = new WorldDataClass(this._platform);
        var world = await worldData.get(charId);
        if (!world || !Array.isArray(world.npcs)) return;

        var npc = world.npcs.find(function (n) { return n.name === change.name; });
        if (npc && change.change) {
          npc.relationship = change.change;
          await worldData.save(charId, world);

          // [铁则十二] 发射NPC关系变化事件
          if (this._platform?.eventBus) {
            var payload;
            if (window.PayloadBuilder) {
              payload = window.PayloadBuilder.npc.relationshipChanged(
                npc.id || npc.name,
                change,
                'director-service'
              );
            } else {
              payload = {
                id: this._generateId(),
                type: 'npc:relationshipChanged',
                data: { npcId: npc.id || npc.name, change: change },
                timestamp: Date.now(),
                source: 'director-service',
              };
            }
            this._platform.eventBus.emit('npc:relationshipChanged', payload);
          }
        }
      } catch (e) {
        console.warn('[DirectorService] _updateNPCRelationship 失败:', e);
      }
    }

    // ==================== [Task 4.2] 冷却机制 ====================

    /**
     * 检查事件是否可以触发（冷却检查）
     * [铁则九] try/catch 错误处理，失败时允许触发（降级）
     * @param {string} eventType - 事件类型
     * @param {string|null} npcId - NPC ID（可选）
     * @returns {boolean} true=可以触发
     * @private
     */
    _canTriggerEvent(eventType, npcId) {
      try {
        var now = Date.now();

        // 重置每小时计数器
        if (now - this._hourResetTime >= 60 * 60 * 1000) {
          this._eventCountThisHour = 0;
          this._hourResetTime = now;
        }

        // [Task 4.4] 根据张力等级调整每小时上限
        var rhythmCfg = this._rhythmConfig[this._tensionLevel] || this._rhythmConfig.tension_normal;
        var effectiveMaxPerHour = rhythmCfg.maxEventsPerHour;

        // 检查每小时上限
        if (this._eventCountThisHour >= effectiveMaxPerHour) {
          console.log('[DirectorService] 冷却: 每小时事件上限已达 (' + this._eventCountThisHour + '/' + effectiveMaxPerHour + ')');
          return false;
        }

        // 检查全局最小间隔
        var lastGlobalTime = this._lastEventTime.get('__global__');
        if (lastGlobalTime && (now - lastGlobalTime) < this._globalMinInterval) {
          console.log('[DirectorService] 冷却: 全局最小间隔未到');
          return false;
        }

        // 检查事件类型冷却
        var typeCooldown = this._cooldownConfig[eventType];
        if (typeCooldown) {
          var lastTypeTime = this._lastEventTime.get(eventType);
          if (lastTypeTime && (now - lastTypeTime) < typeCooldown) {
            console.log('[DirectorService] 冷却: ' + eventType + ' 类型冷却中');
            return false;
          }
        }

        // 检查 NPC 冷却
        if (npcId) {
          var lastNPCTime = this._lastNPCEventTime.get(npcId);
          if (lastNPCTime && (now - lastNPCTime) < this._npcMinInterval) {
            console.log('[DirectorService] 冷却: NPC ' + npcId + ' 冷却中');
            return false;
          }
        }

        // [Task 4.4] 检查连续同类型强制轮换
        if (this._lastEventType === eventType && this._consecutiveTypeCount >= this._maxConsecutiveSameType) {
          console.log('[DirectorService] 冷却: 连续 ' + this._consecutiveTypeCount + ' 次同类型 (' + eventType + ')，强制切换');
          return false;
        }

        return true;
      } catch (e) {
        // [铁则九] 冷却检查失败时允许触发（降级）
        console.warn('[DirectorService] _canTriggerEvent 检查失败，允许触发:', e);
        return true;
      }
    }

    /**
     * 记录事件已触发（更新冷却状态）
     * [铁则九] try/catch 错误处理
     * @param {string} eventType - 事件类型
     * @param {string|null} npcId - NPC ID（可选）
     * @private
     */
    _onEventTriggered(eventType, npcId) {
      try {
        var now = Date.now();

        // 更新全局最后触发时间
        this._lastEventTime.set('__global__', now);

        // 更新类型最后触发时间
        this._lastEventTime.set(eventType, now);

        // 更新 NPC 最后触发时间
        if (npcId) {
          this._lastNPCEventTime.set(npcId, now);
        }

        // 增加每小时计数
        this._eventCountThisHour++;

        // [Task 4.4] 更新连续同类型计数
        if (this._lastEventType === eventType) {
          this._consecutiveTypeCount++;
        } else {
          this._consecutiveTypeCount = 1;
        }
        this._lastEventType = eventType;

        console.log('[DirectorService] 冷却记录: ' + eventType + (npcId ? ' (NPC:' + npcId + ')' : '') + ' | 本小时事件数: ' + this._eventCountThisHour);
      } catch (e) {
        console.warn('[DirectorService] _onEventTriggered 失败:', e);
      }
    }

    // ==================== [Task 4.3] 世界事件通道 ====================

    /**
     * 世界事件入口
     * 根据事件类型路由到对应的世界事件生成方法
     * [铁则九] try/catch 错误处理
     * [铁则十一] 事件载荷标准化
     * @param {Object} worldContext - 世界上下文
     * @returns {Promise<Object|null>} 生成的事件
     * @private
     */
    async _generateWorldEvent(worldContext) {
      try {
        if (!worldContext || typeof worldContext !== 'object') {
          return null;
        }

        // 随机选择世界事件类型
        var worldEventTypes = ['world-news', 'economy-event', 'atmosphere-event'];
        var eventType = worldEventTypes[Math.floor(Math.random() * worldEventTypes.length)];

        // 冷却检查
        if (!this._canTriggerEvent(eventType, null)) {
          return null;
        }

        var event = null;
        switch (eventType) {
          case 'world-news':
            event = await this._generateWorldNews(worldContext);
            break;
          case 'economy-event':
            event = await this._generateEconomyEvent(worldContext);
            break;
          case 'atmosphere-event':
            event = await this._generateAtmosphereEvent(worldContext);
            break;
        }

        if (event) {
          this._onEventTriggered(eventType, null);
        }

        return event;
      } catch (e) {
        // [铁则九] 世界事件生成失败不阻断
        console.warn('[DirectorService] _generateWorldEvent 失败:', e);
        return null;
      }
    }

    /**
     * 生成世界新闻
     * 调用 news-expert 生成世界新闻
     * [铁则九] try/catch 错误处理
     * @param {Object} worldContext - 世界上下文
     * @returns {Promise<Object|null>}
     * @private
     */
    async _generateWorldNews(worldContext) {
      try {
        var worldName = worldContext.name || '未知世界';

        // 尝试通过 LLMGateway 调用 news-expert
        if (typeof window.LLMGateway !== 'undefined') {
          try {
            var llmGateway = new window.LLMGateway(this._platform);
            var result = await llmGateway.generate('news-expert', {
              worldName: worldName,
              worldTheme: worldContext.theme || '现代',
              worldEra: worldContext.era || '当代',
              atmosphere: worldContext.atmosphere || '',
            });

            if (result && typeof result === 'object' && result.content) {
              return {
                type: 'world-news',
                content: result.content,
                title: result.title || '世界新闻',
                source: 'director-world-event',
                timestamp: Date.now(),
              };
            }
          } catch (llmErr) {
            console.warn('[DirectorService] news-expert LLM 调用失败，使用模板:', llmErr);
          }
        }

        // 降级：使用模板生成
        var templates = [
          worldName + '今日发生了一件引人注目的事件',
          worldName + '的局势正在悄然变化',
          worldName + '传来新的消息，引发了广泛关注',
        ];
        return {
          type: 'world-news',
          content: templates[Math.floor(Math.random() * templates.length)],
          title: '世界新闻',
          source: 'director-world-event',
          timestamp: Date.now(),
        };
      } catch (e) {
        console.warn('[DirectorService] _generateWorldNews 失败:', e);
        return null;
      }
    }

    /**
     * 生成经济事件
     * 基于经济系统状态生成经济事件
     * [铁则九] try/catch 错误处理
     * @param {Object} worldContext - 世界上下文
     * @returns {Promise<Object|null>}
     * @private
     */
    async _generateEconomyEvent(worldContext) {
      try {
        var worldName = worldContext.name || '未知世界';

        // 降级：使用模板生成经济事件
        var templates = [
          worldName + '的市场出现了波动',
          worldName + '的物价最近有所变化',
          worldName + '的商业区传来新的消息',
        ];
        return {
          type: 'economy-event',
          content: templates[Math.floor(Math.random() * templates.length)],
          title: '经济动态',
          source: 'director-world-event',
          timestamp: Date.now(),
        };
      } catch (e) {
        console.warn('[DirectorService] _generateEconomyEvent 失败:', e);
        return null;
      }
    }

    /**
     * 生成氛围事件
     * 基于世界氛围生成环境事件
     * [铁则九] try/catch 错误处理
     * @param {Object} worldContext - 世界上下文
     * @returns {Promise<Object|null>}
     * @private
     */
    async _generateAtmosphereEvent(worldContext) {
      try {
        var worldName = worldContext.name || '未知世界';
        var atmosphere = worldContext.atmosphere || '';

        // 降级：使用模板生成氛围事件
        var templates = [
          worldName + '的天空变得有些不同寻常',
          worldName + '的空气中弥漫着一种微妙的气息',
          worldName + '的街道上，人们似乎感受到了什么变化',
        ];
        return {
          type: 'atmosphere-event',
          content: templates[Math.floor(Math.random() * templates.length)],
          title: '氛围变化',
          atmosphere: atmosphere,
          source: 'director-world-event',
          timestamp: Date.now(),
        };
      } catch (e) {
        console.warn('[DirectorService] _generateAtmosphereEvent 失败:', e);
        return null;
      }
    }

    // ==================== [Task 4.4] 节奏控制系统 ====================

    /**
     * 更新张力等级
     * 基于世界状态或外部输入调整节奏
     * [铁则九] try/catch 错误处理
     * @param {string} level - 'high' | 'normal' | 'low'
     * @private
     */
    _updateTensionLevel(level) {
      try {
        if (['high', 'normal', 'low'].indexOf(level) === -1) {
          console.warn('[DirectorService] 无效的张力等级:', level);
          return;
        }
        var oldLevel = this._tensionLevel;
        this._tensionLevel = level;
        if (oldLevel !== level) {
          console.log('[DirectorService] 张力等级变更: ' + oldLevel + ' -> ' + level);
        }
      } catch (e) {
        console.warn('[DirectorService] _updateTensionLevel 失败:', e);
      }
    }

    /**
     * 获取当前节奏配置
     * [铁则九] try/catch 错误处理
     * @returns {Object} { intervalMultiplier, maxEventsPerHour }
     * @private
     */
    _getRhythmConfig() {
      try {
        return this._rhythmConfig[this._tensionLevel] || this._rhythmConfig.tension_normal;
      } catch (e) {
        console.warn('[DirectorService] _getRhythmConfig 失败:', e);
        return this._rhythmConfig.tension_normal;
      }
    }

    /**
     * 检查是否应强制切换事件类型（节奏控制）
     * [铁则九] try/catch 错误处理
     * @param {string} eventType - 待检查的事件类型
     * @returns {boolean} true=应强制切换
     * @private
     */
    _shouldForceSwitch(eventType) {
      try {
        return this._lastEventType === eventType && this._consecutiveTypeCount >= this._maxConsecutiveSameType;
      } catch (e) {
        console.warn('[DirectorService] _shouldForceSwitch 失败:', e);
        return false;
      }
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Director = DirectorService;

  console.log('[Service] DirectorService 已加载');
})();
