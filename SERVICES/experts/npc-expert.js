/**
 * @layer Service
 * @file   npc-expert.js
 * @description NPC专家 - 生成NPC消息内容
 *
 * 职责:
 *   - 根据NPC性格和世界上下文生成消息
 *   - 生成符合角色设定的对话内容
 *   - 输出标准化的消息数据结构
 *   - 多层上下文注入（6层）
 *
 * 输出JSON格式:
 *   {
 *     messages: [{
 *       fromId: string,
 *       from: string,
 *       content: string,
 *       emotion: string
 *     }],
 *     meta: {...}
 *   }
 *
 * 铁则合规:
 *   - 铁则一: 数据读写通过 Schema 辅助函数（通过 platform.get() 获取 Service）
 *   - 铁则三: Service 层只处理数据操作和 AI 调用
 *   - 铁则七: 通过 LLMGateway 调用 AI
 *   - 铁则九: 错误处理降级
 */

;(function () {
  'use strict';

  /**
   * NPC专家类
   * 继承 BaseExpert
   */
  class NPCExpert extends window.BaseExpert {
    constructor(platform, config) {
      super(platform, {
        expertId: 'npc-expert',
        channel: 'channel-director', // [F-07] 使用 director 专用通道 (30000ms timeout)
        role: 'npc-message-generator',
        ...config,
      });

      // 情绪类型定义
      this._emotions = [
        'happy', // 开心
        'sad', // 悲伤
        'angry', // 愤怒
        'worried', // 担忧
        'excited', // 兴奋
        'neutral', // 平静
        'surprised', // 惊讶
        'affectionate', // 深情
      ];

      // 消息类型定义
      this._messageTypes = [
        'greeting', // 问候
        'chat', // 闲聊
        'quest', // 任务相关
        'event', // 事件通知
        'emotion', // 情感表达
        'request', // 请求
      ];

      // [Task 6.1] 手机聊天模式约束（Layer 5：15条否定规则）
      this._chatConstraints = [
        '不得替玩家做决定或替玩家说话',
        '不得透露自己是AI或游戏角色',
        '不得使用超出角色认知的现代网络用语（除非世界观允许）',
        '不得在一条消息中同时表达矛盾的情绪',
        '不得发送过于冗长的消息（单条不超过200字）',
        '不得主动推进主线剧情（除非是任务触发）',
        '不得在玩家未回应时连续发送超过3条消息',
        '不得使用emoji表情符号代替文字表达情感',
        '不得在对话中引用游戏机制或系统术语',
        '不得忽略玩家消息中的关键信息',
        '不得重复已说过的内容',
        '不得在未建立足够关系时表达过于亲密的情感',
        '不得在悲伤场景中突然切换到欢乐语气',
        '不得发送与当前场景完全无关的内容',
        '不得使用括号标注动作（如*微笑*）',
      ];

      // [Task 6.1] 图片发送协议（Layer 6）
      this._imageProtocol = {
        cdnBaseUrl: 'https://cdn.phone-game.com/images/npc/',
        supportedFormats: ['jpg', 'png', 'gif'],
        maxSize: '2MB',
        namingRule: '{npcId}_{scene}_{index}.{format}',
        description: 'NPC发送图片时使用CDN URL，编号从001开始递增',
      };
    }

    /**
     * 生成NPC消息
     * @param {Object} context - 上下文信息
     * @param {string} context.npcId - NPC ID
     * @param {string} context.npcName - NPC 名称
     * @param {string} context.npcPersonality - NPC 性格
     * @param {string} context.relationship - 与主角关系
     * @param {string} context.messageType - 消息类型
     * @param {Object} context.triggerEvent - 触发事件
     * @returns {Promise<Object|null>} 消息列表
     */
    async generate(context) {
      const result = await super.generate(context);

      // [v4.3-fix] 如果验证失败导致 fallback，使用完整的降级消息
      if (!result || result.fallback) {
        console.warn('[NPCExpert] LLM 结果无效，使用降级消息');
        return this.generateFallbackMessages(context);
      }

      // 添加元数据
      result.meta = {
        generatedAt: this._getTimestamp(),
        npcId: context.npcId || 'unknown',
        npcName: context.npcName || 'unknown',
        expertId: this._expertId,
      };

      // 确保每条消息都有 emotion 字段
      if (result.messages && Array.isArray(result.messages)) {
        result.messages = result.messages.map((msg) => ({
          ...msg,
          emotion: msg.emotion || this._emotions[Math.floor(Math.random() * this._emotions.length)],
        }));
      }

      return result;
    }

    // ========== [Task 6.1] 多层上下文注入辅助方法 ==========

    /**
     * Layer 1: 获取角色卡数据（description/personality/system_prompt）
     * 通过 worldService 获取，避免直接实例化 Schema（铁则一）
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 角色卡数据
     */
    async _getLayer1_CharacterCard(charId) {
      try {
        var worldSvc = this._platform?.get?.('worldService');
        if (worldSvc?.getWorldData) {
          var worldData = await worldSvc.getWorldData(charId);
          if (worldData) {
            return {
              description: worldData.description || '',
              personality: worldData.personality || '',
              systemPrompt: worldData.systemPrompt || worldData.scenario || '',
              firstMessage: worldData.firstMessage || '',
            };
          }
        }
      } catch (e) {
        console.warn('[NPCExpert] Layer1 获取角色卡数据失败:', e);
      }

      // 降级：从 context 中提取
      return { description: '', personality: '', systemPrompt: '', firstMessage: '' };
    }

    /**
     * Layer 2: 获取世界书匹配条目
     * 通过 worldbookSyncService 获取
     * @param {string} charId - 角色ID
     * @param {string} npcName - NPC名称（用于匹配）
     * @returns {Promise<Array>} 世界书条目
     */
    async _getLayer2_WorldBook(charId, npcName) {
      try {
        var wbSvc = this._platform?.get?.('worldbookSyncService');
        if (wbSvc?.getMatchingEntries) {
          var entries = await wbSvc.getMatchingEntries(npcName || '', 5);
          if (entries && entries.length > 0) {
            return entries.slice(0, 5).map(function(e) {
              return {
                key: e.key || e.name || '',
                content: e.content || e.comment || '',
              };
            });
          }
        }
      } catch (e) {
        console.warn('[NPCExpert] Layer2 获取世界书条目失败:', e);
      }

      // 降级：从 worldContext 中提取
      return [];
    }

    /**
     * Layer 3: 获取最近 ST 聊天记录（3条，每条100字）
     * 通过 messageService 获取
     * @param {string} npcId - NPC ID
     * @returns {Promise<Array>} 最近聊天记录
     */
    async _getLayer3_RecentChat(npcId) {
      try {
        var msgSvc = this._platform?.get?.('messageService');
        if (msgSvc?.getRecentByFriend) {
          var messages = await msgSvc.getRecentByFriend(npcId, 3);
          if (messages && messages.length > 0) {
            return messages.map(function(m) {
              return {
                role: m.senderId === 'me' ? '玩家' : 'NPC',
                content: (m.text || m.content || '').substring(0, 100),
              };
            });
          }
        }
      } catch (e) {
        console.warn('[NPCExpert] Layer3 获取最近聊天失败:', e);
      }

      return [];
    }

    /**
     * Layer 4: 获取全局上下文（场景、阶段、金钱）
     * 通过 economyService 和 statusService 获取
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 全局上下文
     */
    async _getLayer4_GlobalContext(charId) {
      var globalCtx = { scene: '', stage: '', money: 0, reputation: 0 };

      try {
        // 获取金钱信息
        var econSvc = this._platform?.get?.('economyService');
        if (econSvc?.getBalance) {
          var balance = await econSvc.getBalance(charId);
          globalCtx.money = balance || 0;
        }
      } catch (e) {
        console.warn('[NPCExpert] Layer4 获取金钱失败:', e);
      }

      try {
        // 获取状态信息
        var statusSvc = this._platform?.get?.('statusService');
        if (statusSvc?.getCurrentStatus) {
          var status = await statusSvc.getCurrentStatus();
          if (status) {
            globalCtx.scene = status.scene || status.location || '';
            globalCtx.stage = status.stage || status.phase || '';
            globalCtx.reputation = status.reputation || 0;
          }
        }
      } catch (e) {
        console.warn('[NPCExpert] Layer4 获取状态失败:', e);
      }

      return globalCtx;
    }

    /**
     * 构建 Prompt 上下文（多层上下文注入）
     * @param {Object} context - 原始上下文
     * @returns {Promise<Object>} 构建后的上下文
     */
    async _buildPrompt(context) {
      const baseContext = await super._buildPrompt(context);

      // [修复] 处理 worldContext 可能是字符串的情况（director-service 旧版本返回 JSON 字符串）
      let worldContext = {};
      if (context.worldContext) {
        if (typeof context.worldContext === 'string') {
          try {
            worldContext = JSON.parse(context.worldContext);
            console.log('[NPCExpert] worldContext 从字符串解析成功');
          } catch (e) {
            console.warn('[NPCExpert] worldContext 字符串解析失败:', e);
            worldContext = {};
          }
        } else {
          worldContext = context.worldContext;
        }
      }

      // [铁则一修复] 通过 worldService 获取世界数据，不再直接 new window.PhoneData.World()
      let step2Data = null;
      if (!worldContext.name) {
        try {
          var worldSvc = this._platform?.get?.('worldService');
          if (worldSvc?.getStep2Data) {
            var charId = context.charId || baseContext.charId || 'default';
            step2Data = await worldSvc.getStep2Data(charId);
            if (step2Data) {
              worldContext = step2Data.world || {};
            }
          }
        } catch (e) {
          console.warn('[NPCExpert] 获取世界数据失败:', e);
        }
      }

      // [铁则一修复] 获取NPC数据 - 优先从 context.worldContext.npcs 查找
      let npcData = null;
      try {
        // 1. 优先从 worldContext.npcs 查找（director-service 新版本直接提供）
        if (worldContext.npcs && context.npcId) {
          npcData = worldContext.npcs.find(function(n) { return n.id === context.npcId || n.name === context.npcId; });
          if (npcData) {
            console.log('[NPCExpert] 从 worldContext.npcs 找到NPC:', npcData.name);
          }
        }

        // 2. 从 Step2 数据中查找（备用）
        if (!npcData && step2Data && step2Data.npcs && context.npcId) {
          npcData = step2Data.npcs.find(function(n) { return n.id === context.npcId || n.name === context.npcId; });
          if (npcData) {
            console.log('[NPCExpert] 从 step2Data.npcs 找到NPC:', npcData.name);
          }
        }

        // 3. [铁则一修复] 通过 npcGeneratorService 获取 NPC 数据
        if (!npcData && context.npcId) {
          var npcGenSvc = this._platform?.get?.('npcGeneratorService');
          if (npcGenSvc?.getNPCById) {
            npcData = await npcGenSvc.getNPCById(context.npcId);
            if (npcData) {
              console.log('[NPCExpert] 从 npcGeneratorService 找到NPC:', npcData.name);
            }
          }
        }
      } catch (e) {
        console.warn('[NPCExpert] 获取NPC数据失败:', context.npcId, e);
      }

      // [修复] 如果还是找不到NPC，使用兜底数据但记录错误
      if (!npcData) {
        console.error('[NPCExpert] 无法找到NPC，使用兜底数据:', context.npcId);
        npcData = {
          id: context.npcId || 'unknown',
          name: context.npcName || '神秘人',
          personality: context.npcPersonality || '普通',
          role: '未知角色',
          backstory: '',
          emoji: '👤',
          relationship: context.relationship || '陌生人',
          affinity: 50,
        };
      }

      // ========== [Task 6.1] 多层上下文注入 ==========

      var charId = context.charId || baseContext.charId || 'default';

      // Layer 1: 角色卡 description/personality/system_prompt
      var layer1 = await this._getLayer1_CharacterCard(charId);

      // Layer 2: 世界书匹配条目
      var layer2 = await this._getLayer2_WorldBook(charId, context.npcName);

      // Layer 3: 最近 ST 聊天记录（3条，每条100字）
      var layer3 = await this._getLayer3_RecentChat(context.npcId);

      // Layer 4: 全局上下文（场景、阶段、金钱）
      var layer4 = await this._getLayer4_GlobalContext(charId);

      // Layer 5: 手机聊天模式约束（15条否定规则）
      var layer5 = this._chatConstraints;

      // Layer 6: 图片发送协议
      var layer6 = this._imageProtocol;

      // [v4.3-fix] 正确提取 V2 数据结构中的字段
      return {
        ...baseContext,
        // NPC信息
        npcId: context.npcId || npcData?.id || 'npc_unknown',
        npcName: context.npcName || npcData?.name || '神秘人',
        npcPersonality: context.npcPersonality || npcData?.personality || '普通',
        npcDescription: npcData?.description || '',
        npcEmoji: npcData?.emoji || '👤',
        relationship: context.relationship || npcData?.relationship || '陌生人',
        // 世界信息
        worldName: worldContext.name || '未知世界',
        worldTheme: worldContext.theme || '通用',
        atmosphere: worldContext.atmosphere || '普通',
        // 消息类型和触发
        messageType: context.messageType || 'chat',
        messageTypes: this._messageTypes.join(', '),
        emotions: this._emotions.join(', '),
        triggerEvent: context.triggerEvent || null,
        // [Task 6.1] 多层上下文
        // Layer 1: 角色卡数据
        characterCard: layer1,
        // Layer 2: 世界书条目
        worldBookEntries: layer2,
        // Layer 3: 最近聊天记录
        recentChat: layer3,
        // Layer 4: 全局上下文
        globalContext: layer4,
        // Layer 5: 聊天模式约束
        chatConstraints: layer5,
        // Layer 6: 图片发送协议
        imageProtocol: layer6,
        // 生成数量
        messageCount: context.messageCount || 1,
      };
    }

    /**
     * 验证结果
     * @param {Object} result - 解析后的结果
     * @returns {boolean} 是否有效
     */
    _validateResult(result) {
      if (!result || typeof result !== 'object') {
        console.warn('[NPCExpert] 验证失败: result 不是对象', result);
        return false;
      }

      if (!Array.isArray(result.messages)) {
        console.warn('[NPCExpert] 验证失败: messages 不是数组', {
          hasMessages: 'messages' in result,
          messagesType: typeof result.messages,
          resultKeys: Object.keys(result),
          fullResult: JSON.stringify(result).substring(0, 500)
        });
        return false;
      }

      // 验证每条消息
      for (const msg of result.messages) {
        if (!msg.content) {
          console.warn('[NPCExpert] 消息缺少 content 字段:', msg);
          return false;
        }

        // fromId 或 from 至少有一个
        if (!msg.fromId && !msg.from) {
          console.warn('[NPCExpert] 消息缺少 fromId/from 字段:', msg);
          return false;
        }
      }

      console.log('[NPCExpert] 验证通过，消息数:', result.messages.length);
      return true;
    }

    /**
     * 生成默认消息（完全降级）
     * @param {Object} context - 上下文
     * @returns {Object} 消息列表
     */
    generateFallbackMessages(context) {
      const npcName = context?.npcName || '神秘人';
      const relationship = context?.relationship || '陌生人';

      const templates = {
        greeting: [
          { content: '你好，最近怎么样？', emotion: 'neutral' },
          { content: '好久不见！', emotion: 'happy' },
          { content: '很高兴收到你的消息。', emotion: 'happy' },
        ],
        chat: [
          { content: '今天天气真不错。', emotion: 'neutral' },
          { content: '我在想你呢。', emotion: 'affectionate' },
          { content: '最近发生了一些有趣的事情。', emotion: 'excited' },
        ],
        quest: [
          { content: '有个任务想请你帮忙。', emotion: 'worried' },
          { content: '关于上次说的那件事...', emotion: 'neutral' },
          { content: '我需要你的帮助。', emotion: 'worried' },
        ],
        event: [
          { content: '你听说了吗？最近发生了大事。', emotion: 'surprised' },
          { content: '有紧急情况！', emotion: 'worried' },
          { content: '那个消息是真的吗？', emotion: 'surprised' },
        ],
        emotion: [
          { content: '我今天心情不太好...', emotion: 'sad' },
          { content: '太开心了！', emotion: 'excited' },
          { content: '有点担心你。', emotion: 'worried' },
        ],
        request: [
          { content: '能帮我个忙吗？', emotion: 'neutral' },
          { content: '有空的话见个面吧。', emotion: 'affectionate' },
          { content: '有件事想和你商量。', emotion: 'worried' },
        ],
      };

      const messageType = context?.messageType || 'chat';
      const typeTemplates = templates[messageType] || templates.chat;
      const selected = typeTemplates[Math.floor(Math.random() * typeTemplates.length)];

      return {
        messages: [
          {
            fromId: context?.npcId || `npc_${Date.now()}`,
            from: npcName,
            content: selected.content,
            emotion: selected.emotion,
            timestamp: this._getTimestamp(),
          },
        ],
        meta: {
          generatedAt: this._getTimestamp(),
          isFallback: true,
          expertId: this._expertId,
        },
      };
    }

    /**
     * 快速生成单条消息（用于简单场景）
     * @param {string} npcName - NPC名称
     * @param {string} content - 消息内容（可选）
     * @param {string} emotion - 情绪（可选）
     * @returns {Object} 消息对象
     */
    quickGenerate(npcName, content, emotion) {
      const emotions = this._emotions;
      return {
        messages: [
          {
            fromId: `npc_${Date.now()}`,
            from: npcName || '神秘人',
            content: content || '...',
            emotion: emotion || emotions[Math.floor(Math.random() * emotions.length)],
            timestamp: this._getTimestamp(),
          },
        ],
        meta: {
          generatedAt: this._getTimestamp(),
          isQuick: true,
          expertId: this._expertId,
        },
      };
    }
  }

  // 导出到全局
  window.NPCExpert = NPCExpert;

})();
