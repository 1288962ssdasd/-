/**
 * @layer Service
 * @file   director-service-v2.js
 * @depends LLMGateway, DirectorData, Platform
 * @emits  director:decided, director:intentGenerated, director:contentReady, director:showNotification
 *
 * 职责: AI导演决策（两步生成模式）
 *   Step1: 导演只做决策"要不要生成"
 *   Step2: 专家系统生成意图（NPC要做什么）
 *   Step3: Service带着角色卡人设二次生成具体内容
 *
 * 禁止: 操作DOM、直接调用SillyTavern API
 * [v5.0] 两步生成模式 - 符合16项铁则架构
 * [v5.1] 铁则合规重构:
 *   - V-01: 消除状态双写，_masterSwitch/_lastRun/_cooldown/_lastContextHash 迁移到 DirectorData Schema
 *   - V-02/V-03/V-04: 服务间解耦，通过 Platform.get() 获取服务实例
 *   - V-05: Service 层 UI 边界，showNotification 改为事件发射
 *   - 专家统一接入: NPCExpert/SocialExpert/QuestExpert 通过 Platform.get() 获取
 */

;(function () {
  'use strict';

  class DirectorServiceV2 {
    constructor(platform) {
      this._platform = platform || window.Platform;

      // [F-04] 默认 charId，init() 中会更新为实际值
      this._charId = 'default';

      // [V-01] DirectorData 保留 new 实例化（它是 Schema 辅助类，不是 Service）
      // [F-04] 传入 charId 实现数据隔离（铁则十三）
      this._directorData = new (window.PhoneData?.Director || function () {})(this._platform, this._charId);

      // [V-02/V-03/V-04] 其他 Schema/Service 不在构造函数中 new，在 init() 中通过 Platform.get() 获取
      this._friendsData = null;   // → platform.get('friendService')
      this._npcData = null;       // → platform.get('npcGeneratorService')
      this._worldData = null;     // → platform.get('worldService')
      this._historyData = null;   // → platform.get('historyService') 或直接使用 Schema

      // 核心组件
      this._contextAssembler = null;
      this._eventDispatcher = null;
      this._llmGateway = null;

      // 专家系统（通过 Platform.get() 获取，不在构造函数中 new）
      this._npcExpert = null;
      this._socialExpert = null;
      this._questExpert = null;

      // 内置专家（轻量级决策逻辑，不需要外部依赖）
      this._experts = {
        quest: null,           // 任务专家（内置决策）
        npc_behavior: null,    // NPC行为专家（内置决策）- key 与 eventTypes 一致
        news: null,            // 新闻专家（内置决策）
        deviation: null,       // 偏差分析专家（内置决策）
      };

      // [V-01] 状态管理：仅保留 _running 作为内部互斥锁（内存状态允许）
      // _masterSwitch → DirectorData.isEnabled() / setEnabled()
      // _lastRun / _cooldown → DirectorData.updateStatus({lastRun, cooldown})
      // _lastContextHash → DirectorData 新增 lastContextHash 键
      // _enabled 删除（与 _masterSwitch 重复）
      // _minContextDelta 删除（未使用）
      this._running = false;
    }

    /**
     * 初始化服务
     */
    async init() {
      console.log('[DirectorServiceV2] 初始化两步生成模式...');

      // [V-01] 从 DirectorData 读取总开关状态（宽容模式：只有明确关闭才关闭）
      try {
        const masterSwitch = await this._directorData.isEnabled();
        console.log('[DirectorServiceV2] 总开关:', masterSwitch ? '开启' : '关闭');
      } catch (e) {
        console.warn('[DirectorServiceV2] 读取 DirectorData 设置失败:', e);
      }

      // [V-02/V-03/V-04] 通过 Platform.get() 获取服务实例
      try {
        // friendService 提供 FriendsData 能力（getList/getById 等）
        if (this._platform?.get) {
          this._friendsData = this._platform.get('friendService');
          if (!this._friendsData) {
            console.warn('[DirectorServiceV2] Platform.get("friendService") 失败，尝试直接实例化 FriendsData');
            this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);
          }
        } else {
          this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 friendService 失败，降级到直接实例化:', e);
        this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);
      }

      try {
        if (this._platform?.get) {
          this._npcData = this._platform.get('npcGeneratorService');
          if (!this._npcData) {
            console.warn('[DirectorServiceV2] Platform.get("npcGeneratorService") 失败，尝试直接实例化 NPCData');
            this._npcData = new (window.PhoneData?.NPC || function () {})(this._platform);
          }
        } else {
          this._npcData = new (window.PhoneData?.NPC || function () {})(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 npcGeneratorService 失败，降级到直接实例化:', e);
        this._npcData = new (window.PhoneData?.NPC || function () {})(this._platform);
      }

      try {
        if (this._platform?.get) {
          var rawWorldSvc = this._platform.get('worldService');
          if (rawWorldSvc) {
            // [P1-4] 接口适配：WorldService 方法名与 V2 调用不一致
            // 注意：getStage/updateStage 改为通过 SillyTavernAdapter 真正读写变量
            var platformAdapter = this._platform?.adapter;
            var directorSvc = this;

            this._worldData = {
              get: function(charId) {
                try {
                  return rawWorldSvc.getWorld(charId);
                } catch (e) {
                  console.warn('[DirectorServiceV2] getWorld 失败:', e);
                  return null;
                }
              },
              // [P1-4] 从 SillyTavernAdapter 读取 stage（1-5 洋葱层级）
              getStage: async function(charId) {
                try {
                  var val = await platformAdapter?.read?.('world.stage.' + (charId || 'default'));
                  var stage = parseInt(val, 10);
                  if (!isNaN(stage) && stage >= 1 && stage <= 5) return stage;
                  return 1;
                } catch (e) {
                  console.warn('[DirectorServiceV2] getStage 失败，使用默认值 1');
                  return 1;
                }
              },
              // [P1-4] 写入 stage 到 SillyTavernAdapter
              updateStage: async function(charId, newStage) {
                try {
                  await platformAdapter?.write?.('world.stage.' + (charId || 'default'), String(newStage));
                  return true;
                } catch (e) {
                  console.warn('[DirectorServiceV2] updateStage 失败:', e);
                  return false;
                }
              },
              _raw: rawWorldSvc,
            };
          } else {
            console.warn('[DirectorServiceV2] Platform.get("worldService") 失败，尝试直接实例化 WorldData');
            this._worldData = new (window.PhoneData?.World || function () {})(this._platform);
          }
        } else {
          this._worldData = new (window.PhoneData?.World || function () {})(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 worldService 失败，降级到直接实例化:', e);
        this._worldData = new (window.PhoneData?.World || function () {})(this._platform);
      }

      try {
        if (this._platform?.get) {
          this._historyData = this._platform.get('historyService');
          if (!this._historyData) {
            console.warn('[DirectorServiceV2] Platform.get("historyService") 失败，尝试直接实例化 HistoryData');
            this._historyData = new (window.PhoneData?.History || function () {})(this._platform);
          }
        } else {
          this._historyData = new (window.PhoneData?.History || function () {})(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 historyService 失败，降级到直接实例化:', e);
        this._historyData = new (window.PhoneData?.History || function () {})(this._platform);
      }

      // [专家统一接入] 通过 Platform.get() 获取专家实例
      try {
        if (this._platform?.get) {
          // NPCExpert - NPC消息生成专家
          var npcExpertSvc = this._platform.get('npcExpertService');
          if (npcExpertSvc) {
            this._npcExpert = npcExpertSvc;
          } else if (window.NPCExpert) {
            this._npcExpert = new window.NPCExpert(this._platform);
          }
        } else if (window.NPCExpert) {
          this._npcExpert = new window.NPCExpert(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 NPCExpert 失败:', e);
      }

      try {
        if (this._platform?.get) {
          // SocialExpert - 社交互动生成专家
          var socialExpertSvc = this._platform.get('socialExpertService');
          if (socialExpertSvc) {
            this._socialExpert = socialExpertSvc;
          } else if (window.SocialExpert) {
            this._socialExpert = new window.SocialExpert(this._platform);
          }
        } else if (window.SocialExpert) {
          this._socialExpert = new window.SocialExpert(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 SocialExpert 失败:', e);
      }

      try {
        if (this._platform?.get) {
          // QuestExpert - 任务生成专家
          var questExpertSvc = this._platform.get('questExpertService');
          if (questExpertSvc) {
            this._questExpert = questExpertSvc;
          } else if (window.QuestExpert) {
            this._questExpert = new window.QuestExpert(this._platform);
          }
        } else if (window.QuestExpert) {
          this._questExpert = new window.QuestExpert(this._platform);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 QuestExpert 失败:', e);
      }

      // 初始化核心组件
      if (window.ContextAssembler) {
        this._contextAssembler = new window.ContextAssembler(this._platform);
      }
      if (window.EventDispatcher) {
        this._eventDispatcher = new window.EventDispatcher(this._platform);
      }
      if (window.LLMGateway) {
        this._llmGateway = new window.LLMGateway(this._platform);
      }

      // 初始化内置专家系统（轻量级决策逻辑）
      this._initExperts();

      // 设置事件监听
      this._setupEventListeners();

      // [F-04] 获取当前 charId 并设置到 DirectorData
      try {
        const currentCharId = await this._getCurrentCharId();
        if (currentCharId && currentCharId !== 'default') {
          this._charId = currentCharId;
          this._directorData.setCharId(currentCharId);
          console.log('[DirectorServiceV2] charId 已设置:', currentCharId);
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取 charId 失败:', e);
      }

      console.log('[DirectorServiceV2] 初始化完成');
    }

    /**
     * 初始化内置专家系统（轻量级决策逻辑，不依赖 LLM）
     */
    _initExperts() {
      // QuestExpert - 任务生成专家（内置决策）
      this._experts.quest = {
        generateIntent: async (context, worldState) => {
          // 分析是否需要生成任务
          const shouldGenerate = this._shouldGenerateQuest(context, worldState);
          if (!shouldGenerate) return null;

          // [v4.31.0-fix] 必须 await 异步方法
          const suggestedNPCs = await this._selectQuestNPCs(worldState);

          return {
            type: 'quest',
            priority: this._calculateQuestPriority(context),
            suggestedNPCs: suggestedNPCs,
            questType: this._determineQuestType(context),
            reason: '基于当前剧情发展需要'
          };
        }
      };

      // NPCExpert - NPC行为专家（内置决策）
      this._experts.npc_behavior = {
        generateIntent: async (context, worldState) => {
          const activeNPCs = await this._getActiveNPCs(worldState);
          const intents = [];

          for (const npc of activeNPCs) {
            const behavior = this._deriveNPCBehavior(npc, context, worldState);
            if (behavior) {
              intents.push({
                type: 'npc_behavior',
                npcId: npc.id,
                npcName: npc.name,
                behavior: behavior.type,
                priority: behavior.priority,
                reason: behavior.reason
              });
            }
          }

          return intents;
        }
      };

      // NewsExpert - 新闻/世界事件专家（内置决策）
      this._experts.news = {
        generateIntent: async (context, worldState) => {
          const shouldGenerateNews = this._shouldGenerateNews(context, worldState);
          if (!shouldGenerateNews) return null;

          return {
            type: 'news',
            priority: 'medium',
            newsType: this._determineNewsType(worldState),
            relevance: this._calculateNewsRelevance(context, worldState)
          };
        }
      };

      // DeviationExpert - 偏差分析专家（内置决策）
      this._experts.deviation = {
        generateIntent: async (context, worldState) => {
          const deviationScore = await this._calculateDeviation(context);
          if (deviationScore < 5) return null;

          return {
            type: 'deviation',
            priority: deviationScore > 15 ? 'high' : 'medium',
            score: deviationScore,
            shouldRevealLayer: deviationScore > 10,
            suggestedStage: this._suggestStageReveal(worldState, deviationScore)
          };
        }
      };

      console.log('[DirectorServiceV2] 专家系统已初始化');
    }

    /**
     * 设置事件监听
     */
    _setupEventListeners() {
      if (this._platform?.eventBus) {
        // [F-05] 初始化 unsubscribe 收集器
        this._unsubscribers = [];

        // 监听生成结束事件（主要触发路径）
        const unsubGen = this._platform.eventBus.on('generation:ended', () => {
          this.trigger();
        });
        if (unsubGen) this._unsubscribers.push(unsubGen);

        // [P0修复] 监听上下文变化事件（备用触发路径，与V1一致）
        // 当 eventSource 不可用时，ContextMonitor 的定时轮检仍会发射此事件
        const unsubCtx = this._platform.eventBus.on('context:changed', (data) => {
          if (data && data.changes) {
            var shouldTrigger = data.changes.some(function (c) {
              return c.type === 'messagesCount' || c.type === 'characterId' || c.type === 'chatId';
            });
            if (shouldTrigger) {
              console.log('[DirectorServiceV2] 收到 context:changed 事件，触发导演');
              this.trigger();
            }
          }
        });
        if (unsubCtx) this._unsubscribers.push(unsubCtx);

        // [P0修复] 监听变量变更（用于检测外部写入的 director.plan）
        const unsubVar = this._platform.eventBus.on('variable:changed', async (data) => {
          if (data.key === 'xb.director.plan' && data.value) {
            // [V-01] 清空 DirectorData 中的哈希，强制下次触发
            try {
              await this._directorData.updateStatus({ lastContextHash: '' });
            } catch (e) {
              console.warn('[DirectorServiceV2] 清空 lastContextHash 失败:', e);
            }
            this.trigger();
          }
        });
        if (unsubVar) this._unsubscribers.push(unsubVar);

        // [F-05] 监听角色卡切换事件
        const unsubChar = this._platform.eventBus.on('character:selected', async (data) => {
          const newCharId = data?.charId || data?.characterId || data?.id;
          if (newCharId) {
            await this.onCharacterSwitch(newCharId);
          }
        });
        if (unsubChar) this._unsubscribers.push(unsubChar);
      }
    }

    /**
     * 触发导演决策（两步生成入口）
     */
    async trigger() {
      const now = Date.now();

      // [V-01] 从 DirectorData 读取总开关和冷却状态
      let masterSwitch = true;
      let lastRun = 0;
      let cooldown = 15000;

      try {
        const status = await this._directorData.getStatus();
        masterSwitch = status.enabled !== false;
        lastRun = status.lastRun || 0;
        cooldown = status.cooldown || window.DirectorConfig?.timing?.defaultCooldown || 15000;
      } catch (e) {
        console.warn('[DirectorServiceV2] 读取 DirectorData 状态失败，使用默认值:', e);
      }

      if (!masterSwitch || this._running || (now - lastRun < cooldown)) {
        return;
      }

      this._running = true;

      // [V-01] 更新 lastRun 到 DirectorData
      try {
        await this._directorData.updateStatus({ lastRun: now });
      } catch (e) {
        console.warn('[DirectorServiceV2] 更新 lastRun 失败:', e);
      }

      try {
        // ========== Step 1: 导演决策 "要不要生成？" ==========
        const charId = await this._getCurrentCharId();
        const worldState = await this._worldData.get(charId);
        const context = await this._assembleContext(charId);

        // [P0修复] 检查上下文变化量（不再传入context参数，内部从adapter获取）
        const contextChanged = await this._checkContextDelta();
        if (!contextChanged) {
          console.log('[DirectorServiceV2] 上下文变化不足，跳过');
          this._running = false;
          return;
        }

        // 导演决策：当前世界状态下应该生成什么类型的事件
        const decision = await this._makeDecision(context, worldState);

        if (!decision.shouldGenerate) {
          console.log('[DirectorServiceV2] 导演决策：不生成事件');
          this._running = false;
          return;
        }

        console.log('[DirectorServiceV2] 导演决策：生成', decision.eventTypes, '类型事件');

        // 发射决策事件
        this._emitEvent('director:decided', {
          decision,
          context: { charId, worldState }
        });

        // ========== Step 2: 专家系统生成意图 ==========
        const intents = await this._generateIntents(decision, context, worldState);

        if (intents.length === 0) {
          console.log('[DirectorServiceV2] 专家系统未生成意图');
          this._running = false;
          return;
        }

        console.log('[DirectorServiceV2] 专家系统生成', intents.length, '个意图');

        // 发射意图事件
        this._emitEvent('director:intentGenerated', { intents });

        // ========== Step 3: Service二次生成具体内容 ==========
        const contents = await this._generateContents(intents, context, worldState);

        // 分发内容到各模块
        await this._dispatchContents(contents);

        // 记录历史
        try {
          await this._historyData.addEvent(charId, {
            type: 'director:cycleCompleted',
            data: { decision, intents, contentCount: contents.length },
            importance: 3
          });
        } catch (e) {
          console.warn('[DirectorServiceV2] 记录历史失败:', e);
        }

        console.log('[DirectorServiceV2] 两步生成完成，生成', contents.length, '个内容');

      } catch (error) {
        console.error('[DirectorServiceV2] 执行失败:', error);
        // 铁则九：错误降级处理
      } finally {
        this._running = false;
      }
    }

    /**
     * [v4.31.0-fix] 获取总开关状态
     * 兼容 api-settings-module.js 和 settings-module.js 的调用
     * [V-01] 从 DirectorData 读取
     * @returns {Promise<boolean>}
     */
    async isMasterSwitchOn() {
      try {
        return await this._directorData.isEnabled();
      } catch (e) {
        console.warn('[DirectorServiceV2] isMasterSwitchOn 读取失败:', e);
        return true; // 降级：默认开启
      }
    }

    /**
     * [v4.31.0-fix] 设置总开关状态
     * [V-01] 写入 DirectorData
     * @param {boolean} on
     */
    async setMasterSwitch(on) {
      try {
        await this._directorData.setEnabled(on === true);
        console.log('[DirectorServiceV2] 总开关已', on ? '开启' : '关闭');
      } catch (e) {
        console.warn('[DirectorServiceV2] setMasterSwitch 写入失败:', e);
      }
    }

    /**
     * [v4.31.0-fix] 切换总开关
     * [V-01] 写入 DirectorData
     * @returns {Promise<boolean>} 切换后的状态
     */
    async toggleMasterSwitch() {
      try {
        const current = await this._directorData.isEnabled();
        const newValue = !current;
        await this._directorData.setEnabled(newValue);
        console.log('[DirectorServiceV2] 总开关已切换为', newValue ? '开启' : '关闭');
        return newValue;
      } catch (e) {
        console.warn('[DirectorServiceV2] toggleMasterSwitch 失败:', e);
        return true; // 降级
      }
    }

    /**
     * Step 1: 导演决策
     * 只做决策：要不要生成？生成什么类型？
     */
    async _makeDecision(context, worldState) {
      const decision = {
        shouldGenerate: false,
        eventTypes: [],
        priority: 'normal',
        reason: ''
      };

      // [v4.31.0-fix] worldState 容错处理
      const safeWorldState = worldState || {};
      const atmosphere = safeWorldState.meta?.atmosphere?.current || {};
      const tensionLevel = atmosphere.tensionLevel || 'normal';

      let recentEvents = [];
      try {
        recentEvents = await this._historyData.getRecent(context?.charId, 10);
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取历史事件失败:', e);
        recentEvents = [];
      }

      // 决策逻辑
      if (tensionLevel === 'high') {
        decision.shouldGenerate = true;
        decision.eventTypes.push('npc_behavior', 'news');
        decision.priority = 'high';
        decision.reason = '世界氛围紧张，NPC应有反应';
      } else if (recentEvents.length < 3) {
        decision.shouldGenerate = true;
        decision.eventTypes.push('npc_behavior');
        decision.priority = 'normal';
        decision.reason = '新场景需要NPC活动';
      } else {
        // [v4.31.0-fix] 提升日常事件生成概率到 80% (F-09: 外部化配置)
        if (Math.random() < (window.DirectorConfig?.decision?.dailyEventProbability || 0.8)) {
          decision.shouldGenerate = true;
          decision.eventTypes.push('npc_behavior');
          decision.priority = 'low';
          decision.reason = '日常NPC活动';
        }
      }

      // [v4.31.0-fix] 提升任务生成概率到 40% (F-09: 外部化配置)
      if (Math.random() < (window.DirectorConfig?.decision?.questAttachProbability || 0.4)) {
        decision.eventTypes.push('quest');
      }

      // 检查偏差值
      try {
        const deviationScore = await this._calculateDeviation(context);
        if (deviationScore > 10) {
          decision.eventTypes.push('deviation');
          decision.priority = 'high';
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 偏差计算失败:', e);
      }

      // [v4.31.0-fix] 兜底：如果决策为不生成，但有好友数据，强制生成 npc_behavior
      if (!decision.shouldGenerate) {
        try {
          const friends = await this._friendsData.getList();
          if (friends && friends.length > 0) {
            decision.shouldGenerate = true;
            decision.eventTypes.push('npc_behavior');
            decision.priority = 'low';
            decision.reason = '兜底：有好友数据，生成NPC行为';
          }
        } catch (e) {
          // 静默失败
        }
      }

      console.log('[DirectorServiceV2] 决策结果:', {
        shouldGenerate: decision.shouldGenerate,
        eventTypes: decision.eventTypes,
        priority: decision.priority,
        reason: decision.reason
      });

      return decision;
    }

    /**
     * Step 2: 专家系统生成意图
     */
    async _generateIntents(decision, context, worldState) {
      const allIntents = [];

      for (const eventType of decision.eventTypes) {
        const expert = this._experts[eventType];
        if (expert && expert.generateIntent) {
          try {
            const intent = await expert.generateIntent(context, worldState);
            if (intent) {
              if (Array.isArray(intent)) {
                allIntents.push(...intent);
              } else {
                allIntents.push(intent);
              }
            }
          } catch (e) {
            console.warn('[DirectorServiceV2] 专家生成意图失败:', eventType, e);
          }
        }
      }

      // 按优先级排序
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      allIntents.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

      // 限制数量
      return allIntents.slice(0, 5);
    }

    /**
     * Step 3: Service二次生成具体内容
     * 带着角色卡人设生成具体内容
     */
    async _generateContents(intents, context, worldState) {
      const contents = [];

      for (const intent of intents) {
        try {
          const content = await this._generateContentForIntent(intent, context, worldState);
          if (content) {
            contents.push(content);
          }
        } catch (e) {
          console.warn('[DirectorServiceV2] 生成内容失败:', intent.type, e);
        }
      }

      return contents;
    }

    /**
     * 根据意图生成具体内容
     */
    async _generateContentForIntent(intent, context, worldState) {
      const charId = context.charId;

      switch (intent.type) {
        case 'quest':
          return await this._generateQuestContent(intent, charId);

        case 'npc_behavior':
          return await this._generateNPCContent(intent, charId, worldState);

        case 'news':
          return await this._generateNewsContent(intent, charId, worldState);

        case 'deviation':
          return await this._generateDeviationContent(intent, charId, worldState);

        default:
          return null;
      }
    }

    /**
     * 生成任务内容
     * [断裂点修复] 通过 Platform.get('questExpertService') 获取 QuestExpert
     */
    async _generateQuestContent(intent, charId) {
      // [v4.31.0-fix] 增强诊断日志
      console.log('[DirectorServiceV2] _generateQuestContent 调用:', {
        charId,
        suggestedNPCs: intent.suggestedNPCs,
        suggestedNPCsType: typeof intent.suggestedNPCs,
        isArray: Array.isArray(intent.suggestedNPCs),
        firstNPC: intent.suggestedNPCs?.[0]
      });

      // 检查 suggestedNPCs 是否有效
      if (!intent.suggestedNPCs || !Array.isArray(intent.suggestedNPCs) || intent.suggestedNPCs.length === 0) {
        console.warn('[DirectorServiceV2] suggestedNPCs 为空或无效，尝试重新获取NPC列表');

        // 尝试重新获取 NPC（从 FriendsData）
        const friends = await this._friendsData.getList();
        console.log('[DirectorServiceV2] 重新获取好友列表:', friends?.length || 0, '个');

        if (!friends || friends.length === 0) {
          console.warn('[DirectorServiceV2] 当前角色卡无好友数据，跳过任务生成');
          return null;
        }

        // 使用第一个可用好友
        intent.suggestedNPCs = [friends[0].id];
        console.log('[DirectorServiceV2] 使用 fallback 好友:', friends[0].id, friends[0].name);
      }

      // 获取NPC信息（从 FriendsData）
      const npcId = intent.suggestedNPCs[0];
      const npc = await this._friendsData.getById(npcId);

      console.log('[DirectorServiceV2] NPC查询结果:', {
        npcId,
        found: !!npc,
        npcName: npc?.name
      });

      if (!npc) {
        console.warn('[DirectorServiceV2] 无法获取NPC信息 (id=' + npcId + ')，跳过任务生成');
        return null;
      }

      // [断裂点修复] 通过 this._questExpert 调用 QuestExpert（已在 init() 中通过 Platform.get() 获取）
      let quest = null;
      try {
        if (this._questExpert) {
          const expertContext = {
            charId: charId,
            questType: intent.questType || 'side',
            importance: intent.priority === 'high' ? 'high' : 'medium',
            triggerEvent: intent.reason || '剧情发展触发',
            questCount: 1,
            suggestedNPC: npc,
          };
          const result = await this._questExpert.generate(expertContext);
          if (result?.quests?.length > 0) {
            quest = result.quests[0];
            // 确保必要字段
            quest.issuer = quest.issuer || npc.id;
            quest.issuerName = quest.issuerName || npc.name;
            quest.status = quest.status || 'available';
            quest.createdAt = quest.createdAt || Date.now();
            console.log('[DirectorServiceV2] QuestExpert 生成任务成功:', quest.name);
          }
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] QuestExpert 生成失败，使用 fallback:', e);
      }

      // Fallback: LLM 失败时使用模板生成
      if (!quest) {
        quest = {
          id: 'quest_' + Date.now(),
          name: `${npc.name}的请求`,
          description: `${npc.name}遇到了一些困难，希望你能帮帮她。`,
          issuer: npc.id,
          issuerName: npc.name,
          status: 'available',
          type: intent.questType || 'side',
          steps: [
            { type: 'chat', with: npc.id, label: '了解具体情况', description: '与' + npc.name + '对话了解详情' },
            { type: 'custom', label: '完成任务目标', description: '执行任务要求的操作' },
            { type: 'chat', with: npc.id, label: '回报任务', description: '向' + npc.name + '汇报任务完成' }
          ],
          rewards: {
            gold: 100 + Math.floor(Math.random() * 200),
            exp: 50,
            relationship: 10
          },
          createdAt: Date.now()
        };
        console.log('[DirectorServiceV2] 使用 fallback 模板生成任务');
      }

      // 发射事件
      this._emitEvent('director:quest_trigger', {
        actionType: 'create_quest',
        charId: charId,
        quest: quest,
      });

      // 同时发射邀约事件
      this._emitEvent('director:invitation_trigger', {
        actionType: 'create_invitation',
        charId: charId,
        npcId: npc.id,
        npcName: npc.name,
        type: 'quest',
        message: `${npc.name}: "${quest.description?.substring(0, 30) || '你能帮我个忙吗？'}..."`,
        relatedQuestId: quest.id
      });

      return {
        type: 'quest',
        charId: charId,
        data: quest,
        notification: {
          title: '新任务',
          message: `${npc.name}发布了一个任务`,
          app: 'task'
        }
      };
    }

    /**
     * 生成NPC行为内容
     * [断裂点修复] message 行为调用 NPCExpert.generate()，moment 行为调用 SocialExpert.generate()
     * 保留硬编码模板作为 fallback（LLM 失败时使用）
     */
    async _generateNPCContent(intent, charId, worldState) {
      const npc = await this._npcData.getById ? await this._npcData.getById(charId, intent.npcId) : null;
      // 如果 npcData.getById 不可用，尝试从 friendsData 获取
      const npcData = npc || await this._friendsData.getById(intent.npcId);
      if (!npcData) return null;

      // 基于人设推导行为
      const behaviorType = intent.behavior;
      let content = null;

      switch (behaviorType) {
        case 'message': {
          // [断裂点修复] 尝试通过 NPCExpert 生成消息
          let messageText = null;
          try {
            if (this._npcExpert && this._npcExpert.generate) {
              const npcResult = await this._npcExpert.generate({
                npcId: npcData.id,
                npcName: npcData.name,
                npcPersonality: npcData.personality || npcData.trait || '',
                relationship: npcData.relationship || '陌生人',
                messageType: 'chat',
                triggerEvent: 'director_auto_message',
                charId: charId,
                messageCount: 1,
              });
              if (npcResult && npcResult.messages && npcResult.messages.length > 0) {
                messageText = npcResult.messages[0].content;
                console.log('[DirectorServiceV2] NPCExpert 生成消息成功');
              }
            }
          } catch (e) {
            console.warn('[DirectorServiceV2] NPCExpert 生成消息失败，使用 fallback:', e);
          }

          // Fallback: 使用硬编码模板
          if (!messageText) {
            messageText = this._generateNPCMessage(npcData, worldState);
          }

          content = {
            type: 'message',
            data: {
              fromId: npcData.id,
              from: npcData.name,
              content: messageText,
              timestamp: Date.now()
            },
            notification: {
              title: npcData.name,
              message: '发来一条消息',
              app: 'message'
            }
          };
          break;
        }

        case 'moment': {
          // [断裂点修复] 尝试通过 SocialExpert 生成朋友圈内容
          let momentText = null;
          try {
            if (this._socialExpert && this._socialExpert.generate) {
              const socialResult = await this._socialExpert.generate({
                npcId: npcData.id,
                npcName: npcData.name,
                npcPersonality: npcData.personality || npcData.trait || '',
                interactionType: 'moment',
                triggerEvent: 'director_auto_moment',
                charId: charId,
                interactionCount: 1,
              });
              if (socialResult && socialResult.interactions && socialResult.interactions.length > 0) {
                momentText = socialResult.interactions[0].content;
                console.log('[DirectorServiceV2] SocialExpert 生成朋友圈成功');
              }
            }
          } catch (e) {
            console.warn('[DirectorServiceV2] SocialExpert 生成朋友圈失败，使用 fallback:', e);
          }

          // Fallback: 使用硬编码模板
          if (!momentText) {
            momentText = this._generateNPCMoment(npcData, worldState);
          }

          content = {
            type: 'moment',
            data: {
              authorId: npcData.id,
              author: npcData.name,
              content: momentText,
              timestamp: Date.now()
            },
            notification: {
              title: '朋友圈',
              message: `${npcData.name}发布了新动态`,
              app: 'friends-circle'
            }
          };
          break;
        }

        case 'invitation':
          // [Task 5.1修复] 不再直接调用 _invitationData.create
          // 改为发射 director:invitation_trigger 事件，由 Module 层订阅后调用对应 Service
          this._emitEvent('director:invitation_trigger', {
            actionType: 'create_invitation',
            charId: charId,
            npcId: npcData.id,
            npcName: npcData.name,
            type: 'social',
            message: `${npcData.name} 邀请你一起喝咖啡`
          });

          content = {
            type: 'invitation',
            data: {
              npcId: npcData.id,
              npcName: npcData.name,
              type: 'social',
              message: `${npcData.name} 邀请你一起喝咖啡`,
            },
            notification: {
              title: '新邀约',
              message: `${npcData.name} 向你发出邀约`,
              app: 'message'
            }
          };
          break;
      }

      return content;
    }

    /**
     * 生成新闻内容
     * [断裂点修复] 尝试通过 SocialExpert.generate({interactionType:'weibo'}) 生成
     * 保留硬编码模板作为 fallback
     */
    async _generateNewsContent(intent, charId, worldState) {
      // 基于世界状态生成新闻
      const worldName = worldState?.name || '这个世界';

      // [断裂点修复] 尝试通过 SocialExpert 生成微博内容
      let newsContent = null;
      try {
        if (this._socialExpert && this._socialExpert.generate) {
          const socialResult = await this._socialExpert.generate({
            interactionType: 'weibo',
            triggerEvent: 'director_auto_news',
            charId: charId,
            interactionCount: 1,
            worldName: worldName,
          });
          if (socialResult && socialResult.interactions && socialResult.interactions.length > 0) {
            newsContent = socialResult.interactions[0].content;
            console.log('[DirectorServiceV2] SocialExpert 生成新闻成功');
          }
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] SocialExpert 生成新闻失败，使用 fallback:', e);
      }

      // Fallback: 使用外部化模板 (F-06)
      if (!newsContent) {
        const pool = window.DirectorTemplates?.newsTemplates
          || ['今日资讯：世界发生了新变化'];
        newsContent = window.DirectorTemplates?.fill({ worldName }, pool)
          || '今日资讯：世界发生了新变化';
      }

      const news = {
        id: 'news_' + Date.now(),
        title: '今日资讯',
        content: newsContent,
        timestamp: Date.now()
      };

      return {
        type: 'news',
        charId: charId,
        data: news,
        notification: {
          title: '微博',
          message: '有新的热门话题',
          app: 'weibo'
        }
      };
    }

    /**
     * 生成偏差揭示内容
     */
    async _generateDeviationContent(intent, charId, worldState) {
      if (intent.shouldRevealLayer) {
        // 揭示新的洋葱层级
        const currentStage = await this._worldData.getStage(charId);
        const newStage = Math.min(5, currentStage + 1);

        await this._worldData.updateStage(charId, newStage);

        return {
          type: 'stage_reveal',
          charId: charId,
          data: {
            oldStage: currentStage,
            newStage: newStage,
            message: `你察觉到了这个世界的某些真相...`
          },
          notification: {
            title: '世界推演',
            message: '新的真相被揭示',
            app: 'world'
          }
        };
      }

      return null;
    }

    /**
     * 分发内容到各模块
     * [V-05] 不再直接调用 window.PhoneShell.showNotification()
     * 改为发射 director:showNotification 事件，由 Module 层订阅后调用
     */
    async _dispatchContents(contents) {
      for (const content of contents) {
        try {
          // [接口适配] EventDispatcher handler 期望展平的数据格式，
          // 但 V2 的 content 是 { type, data, notification } 嵌套格式。
          // 展平 data 字段到顶层，保留 type 和 notification。
          const flatEvent = {
            ...content,
            ...(content.data || {}),
            // 保留顶层 type（不能被 data.type 覆盖）
            type: content.type,
          };

          // 使用EventDispatcher分发
          let dispatchResult;
          if (this._eventDispatcher) {
            dispatchResult = await this._eventDispatcher.dispatch(flatEvent);
            console.log('[DirectorServiceV2] 分发内容完成:', content.type, dispatchResult === null ? '(无返回值)' : '(有返回值)');
          } else {
            console.warn('[DirectorServiceV2] EventDispatcher 不可用，跳过 dispatch');
          }

          // [F-03] 修复载荷结构，确保 Module 层能正确访问数据
          // _emitEvent 包装为 {type:eventName, data:payload, ...}
          // Module 收到的 data 参数就是整个包装对象，所以 payload 本身需要包含 Module 期望的字段
          // quest-module._onDirectorContent(data) 检查 data.type === 'quest'
          // → payload 需要 {type:'quest', ...contentData}
          const contentReadyPayload = {
            ...(content.data || {}),
            type: content.type,  // 确保 type 不被覆盖
            charId: content.charId,
          };
          this._emitEvent('director:contentReady', contentReadyPayload);

          // [F-02] 发射 V1 风格事件，兼容现有 Module 订阅
          // _emitEvent 包装为 {type:eventName, data:payload, ...}
          // Module 的回调参数 data 就是这个包装对象
          // quest-module._onQuestCreated(data) 访问 data.quest?.name
          // → payload 需要 {quest: content.data, ...}
          // msg-module._onDirectorContent(data) 只做 UI 刷新，不需要特定字段
          // invitation-module._onDirectorContent(data) 检查 data.type === 'invitation' 后调用 _onInvitationCreated(data.data)
          // → payload 需要 {type:'invitation', ...contentData}
          const v1EventMap = {
            'message': 'director:message',
            'moment': 'director:moment',
            'news': 'director:weibo',      // weibo-module 订阅 director:weibo
            'quest': 'director:quest',
            'invitation': 'director:invitation',
          };
          const v1EventName = v1EventMap[content.type];
          if (v1EventName) {
            if (content.type === 'quest') {
              // [F-02/F-03] quest-module._onQuestCreated(data) 访问 data.quest?.name
              // _emitEvent 包装为 {type:eventName, data:payload, ...}，Module 的 data 就是这个包装对象
              // 所以需要直接用 eventBus.emit，将 quest 放在顶层
              try {
                const eventBus = this._platform?.eventBus;
                if (eventBus?.emit) {
                  eventBus.emit(v1EventName, {
                    id: 'dir_' + Date.now(),
                    type: v1EventName,
                    quest: content.data,  // quest-module 访问 data.quest
                    charId: content.charId,
                    timestamp: Date.now(),
                    source: 'director-service-v2'
                  });
                }
              } catch (e) {
                console.warn('[DirectorServiceV2] 发射 director:quest 事件失败:', e);
              }
            } else {
              // 其他类型：msg-module/weibo-module 只做 UI 刷新，不需要特定字段结构
              this._emitEvent(v1EventName, content.data || content);
            }
          }

          // [V-05] 发射通知事件，由 Module 层订阅后调用 showNotification
          if (content.notification) {
            this._emitEvent('director:showNotification', {
              app: content.notification.app,
              title: content.notification.title,
              message: content.notification.message,
            });
          }
        } catch (e) {
          console.warn('[DirectorServiceV2] 分发内容失败:', content.type, e?.message || e, e?.stack);
        }
      }
    }

    // ==================== 辅助方法 ====================

    async _assembleContext(charId) {
      const context = { charId };

      if (this._contextAssembler) {
        context.assembled = await this._contextAssembler.assemble({ charId, forceRefresh: true });
      }

      return context;
    }

    async _getCurrentCharId() {
      try {
        return await this._platform?.adapter?.getCurrentCharacterId?.() || 'default';
      } catch (e) {
        return 'default';
      }
    }

    /**
     * [V-01] 上下文变化检测
     * _lastContextHash 从 DirectorData 读写
     */
    async _checkContextDelta() {
      // [V-01] 从 DirectorData 读取 lastContextHash
      let lastContextHash = '';
      try {
        const status = await this._directorData.getStatus();
        lastContextHash = status.lastContextHash || '';
      } catch (e) {
        console.warn('[DirectorServiceV2] 读取 lastContextHash 失败:', e);
      }

      // 首次运行，没有上次哈希，允许触发
      if (!lastContextHash) {
        return true;
      }

      try {
        // 参考 V1：从 adapter 获取最近聊天消息计算哈希
        var recentMessages = '';
        if (this._platform?.adapter?.getRecentChatMessages) {
          var msgs = await this._platform.adapter.getRecentChatMessages(3);
          if (Array.isArray(msgs)) {
            recentMessages = msgs.map(function (m) {
              return (m.mes || '').substring(0, 200);
            }).join('|');
          }
        }

        // 无法获取消息时允许触发（降级策略）
        if (!recentMessages) {
          return true;
        }

        var currentHash = this._hashString(recentMessages);

        // 如果哈希完全相同，说明上下文没变化
        if (currentHash === lastContextHash) {
          return false;
        }

        // [V-01] 更新哈希到 DirectorData
        try {
          await this._directorData.updateStatus({ lastContextHash: currentHash });
        } catch (e) {
          console.warn('[DirectorServiceV2] 更新 lastContextHash 失败:', e);
        }

        return true;
      } catch (e) {
        // [铁则九] 检测失败时允许触发，不阻断
        console.warn('[DirectorServiceV2] 上下文变化检测失败，允许触发:', e);
        return true;
      }
    }

    _hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    }

    _shouldGenerateQuest(context, worldState) {
      return Math.random() < (window.DirectorConfig?.decision?.questStandaloneProbability || 0.3);
    }

    _calculateQuestPriority(context) {
      return Math.random() < (window.DirectorConfig?.npcBehavior?.questPriorityHighThreshold || 0.5) ? 'medium' : 'low';
    }

    async _selectQuestNPCs(worldState) {
      try {
        const charId = await this._getCurrentCharId();
        console.log('[DirectorServiceV2] _selectQuestNPCs - charId:', charId);

        // [v4.31.0-fix] NPC 存储在 FriendsData 中
        const friends = await this._friendsData.getList();
        console.log('[DirectorServiceV2] _selectQuestNPCs - 获取到好友数量:', friends?.length || 0);

        // 过滤出 NPC（source 为 auto-generated 或 role 存在）
        const npcs = (friends || []).filter(f =>
          f.source === 'auto-generated' ||
          f.role ||
          f.id?.startsWith('npc_')
        );
        console.log('[DirectorServiceV2] _selectQuestNPCs - 过滤后NPC数量:', npcs?.length || 0);

        if (!npcs || npcs.length === 0) {
          console.warn('[DirectorServiceV2] _selectQuestNPCs - NPC列表为空，使用所有好友作为备选');
          // Fallback: 使用所有好友
          const allFriends = friends || [];
          if (allFriends.length === 0) {
            console.warn('[DirectorServiceV2] _selectQuestNPCs - 无任何好友数据');
            return [];
          }
          // 随机选1-2个好友
          const shuffled = [...allFriends].sort(() => Math.random() - 0.5);
          return shuffled.slice(0, Math.min(2, shuffled.length)).map(f => f.id);
        }

        // 随机选1-2个NPC
        const shuffled = [...npcs].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(2, shuffled.length)).map(n => n.id);
        console.log('[DirectorServiceV2] _selectQuestNPCs - 选中的NPC IDs:', selected);

        return selected;
      } catch (e) {
        console.error('[DirectorServiceV2] _selectQuestNPCs 异常:', e);
        return [];
      }
    }

    _determineQuestType(context) {
      const types = ['side', 'daily', 'event'];
      return types[Math.floor(Math.random() * types.length)];
    }

    async _getActiveNPCs(worldState) {
      try {
        // [v4.31.0-fix] NPC 存储在 FriendsData 中，不是 NPCData
        const friends = await this._friendsData.getList();
        console.log('[DirectorServiceV2] _getActiveNPCs - 好友数量:', friends?.length || 0);

        if (!friends || friends.length === 0) return [];

        // 过滤出 NPC 或所有好友作为活跃角色
        const npcs = friends.filter(f =>
          f.source === 'auto-generated' ||
          f.role ||
          f.id?.startsWith('npc_') ||
          f.personality  // 有人设的就是 NPC
        );

        // 如果没有明确标记的 NPC，使用所有好友
        const activeNPCs = npcs.length > 0 ? npcs : friends;
        console.log('[DirectorServiceV2] _getActiveNPCs - 活跃NPC数量:', activeNPCs.length);

        return activeNPCs.slice(0, 5);
      } catch (e) {
        console.warn('[DirectorServiceV2] 获取活跃NPC失败:', e);
        return [];
      }
    }

    _deriveNPCBehavior(npc, context, worldState) {
      // 基于NPC性格和世界状态推导行为
      const personality = npc.personality || npc.trait || '';
      const relationship = npc.relationship || 50;
      const mood = npc.mood || 'normal';

      // 高关系值NPC更可能主动联系 (F-09: 外部化配置)
      const behaviors = [];

      if (relationship > (window.DirectorConfig?.npcBehavior?.highRelationshipThreshold || 70)) {
        behaviors.push(
          { type: 'message', priority: 'high', weight: 3, reason: '亲密关系，主动联系' },
          { type: 'invitation', priority: 'medium', weight: 2, reason: '想和你见面' }
        );
      }

      if (personality.includes('活泼') || personality.includes('外向') || personality.includes('开朗')) {
        behaviors.push(
          { type: 'moment', priority: 'medium', weight: 3, reason: '分享生活动态' },
          { type: 'message', priority: 'high', weight: 2, reason: '闲聊' }
        );
      }

      if (personality.includes('安静') || personality.includes('内向') || personality.includes('冷淡')) {
        behaviors.push(
          { type: 'moment', priority: 'low', weight: 2, reason: '偶尔发动态' }
        );
      }

      // 默认行为
      behaviors.push(
        { type: 'message', priority: 'medium', weight: 1, reason: '日常联系' },
        { type: 'moment', priority: 'low', weight: 1, reason: '分享日常' }
      );

      // 加权随机选择
      const totalWeight = behaviors.reduce((sum, b) => sum + (b.weight || 1), 0);
      let random = Math.random() * totalWeight;
      for (const b of behaviors) {
        random -= (b.weight || 1);
        if (random <= 0) return b;
      }
      return behaviors[behaviors.length - 1];
    }

    _shouldGenerateNews(context, worldState) {
      return Math.random() < (window.DirectorConfig?.decision?.newsGenerationProbability || 0.2);
    }

    _determineNewsType(worldState) {
      return 'normal';
    }

    _calculateNewsRelevance(context, worldState) {
      return 0.5;
    }

    async _calculateDeviation(context) {
      return Math.floor(Math.random() * 20);
    }

    _suggestStageReveal(worldState, score) {
      return Math.min(5, (worldState?.meta?.currentStage || 1) + 1);
    }

    /**
     * Fallback: 基于性格的消息模板库
     * 仅在 NPCExpert 调用失败时使用 (F-06: 外部化到 DirectorTemplates)
     */
    _generateNPCMessage(npc, worldState) {
      const personality = npc.personality || npc.trait || '';
      const pool = window.DirectorTemplates?.getPool(personality, 'message')
        || ['{name}：最近怎么样？']; // 极端降级
      return window.DirectorTemplates?.fill({ name: npc.name || '某人' }, pool)
        || `${npc.name || '某人'}：最近怎么样？`;
    }

    /**
     * Fallback: 基于性格的朋友圈模板库
     * 仅在 SocialExpert 调用失败时使用 (F-06: 外部化到 DirectorTemplates)
     */
    _generateNPCMoment(npc, worldState) {
      const personality = npc.personality || npc.trait || '';
      const pool = window.DirectorTemplates?.getPool(personality, 'moment')
        || ['{name} 发布了动态：今天天气真好'];
      return window.DirectorTemplates?.fill({ name: npc.name || '某人' }, pool)
        || `${npc.name || '某人'} 发布了动态：今天天气真好`;
    }

    // ==================== [F-05] 生命周期管理 ====================

    /**
     * 销毁服务，清理所有资源
     * [铁则九] 错误降级，不 throw
     */
    destroy() {
      console.log('[DirectorServiceV2] 销毁服务...');
      try {
        // 取消事件监听
        if (this._platform?.eventBus) {
          this._unsubscribers?.forEach(unsub => {
            try { unsub(); } catch (e) {}
          });
        }
        // 重置运行状态
        this._running = false;
        // 清空专家引用
        this._npcExpert = null;
        this._socialExpert = null;
        this._questExpert = null;
        this._contextAssembler = null;
        this._eventDispatcher = null;
        this._llmGateway = null;
        console.log('[DirectorServiceV2] 服务已销毁');
      } catch (e) {
        console.warn('[DirectorServiceV2] 销毁服务时出错:', e);
      }
    }

    /**
     * 重置服务状态（不销毁，仅重置运行时状态）
     */
    async reset() {
      console.log('[DirectorServiceV2] 重置服务状态...');
      this._running = false;
      try {
        await this._directorData.updateStatus({ lastContextHash: '', lastRun: 0 });
        console.log('[DirectorServiceV2] 状态已重置');
      } catch (e) {
        console.warn('[DirectorServiceV2] 重置状态失败:', e);
      }
    }

    /**
     * 角色卡切换处理
     * [F-04/F-05] 切换 charId，重置状态，重新初始化
     */
    async onCharacterSwitch(charId) {
      console.log('[DirectorServiceV2] 角色卡切换:', charId);
      try {
        // 停止当前运行
        this._running = false;
        
        // 更新 charId
        this._charId = charId || 'default';
        this._directorData.setCharId(this._charId);
        
        // 重置状态
        await this.reset();
        
        console.log('[DirectorServiceV2] 角色卡切换完成, charId:', this._charId);
      } catch (e) {
        console.warn('[DirectorServiceV2] 角色卡切换失败:', e);
      }
    }

    _emitEvent(eventName, data) {
      try {
        const eventBus = this._platform?.eventBus;
        if (eventBus?.emit) {
          eventBus.emit(eventName, {
            id: 'dir_' + Date.now(),
            type: eventName,
            data,
            timestamp: Date.now(),
            source: 'director-service-v2'
          });
        }
      } catch (e) {
        console.warn('[DirectorServiceV2] 发射事件失败:', e);
      }
    }

    _handleWorldEvolved(data) {
      console.log('[DirectorServiceV2] 世界已推演:', data);
    }
  }

  // 挂载到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.DirectorV2 = DirectorServiceV2;

  console.log('[Service] DirectorServiceV2 (两步生成模式) 已加载');
})();
