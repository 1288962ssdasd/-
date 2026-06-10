/**
 * @layer Service
 * @file   memory-service.js
 * @depends LLMGateway, Platform
 * @emits  memory:extracted, memory:cleared
 *
 * 职责: 记忆提取与降级机制
 *   - LLM 提取：分析聊天记录提取 {subject, predicate, object} 原子事实
 *   - 规则降级：15 组关键词-动作映射，LLM 失败时用规则提取
 *   - 记忆存储：通过 Schema 读写，键名格式 {charId}:memory:facts
 *
 * 禁止: 操作DOM、直接调用SillyTavern API
 *
 * 铁则合规：
 *   - 铁则一：数据读写通过 Schema（Platform.data / Platform.setData）
 *   - 铁则九：所有异步操作有 try/catch 降级
 *   - 铁则十二：数据变更在 Service 层完成转换
 *   - 铁则二十：Service 无状态，不直接引用其他 Service
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  class MemoryService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._llmGateway = null;

      // 规则降级关键词映射（15组）
      this._ruleMappings = [
        { keywords: ['喜欢', '爱好', '最爱'], action: 'preference', template: '{speaker} 喜欢 {object}' },
        { keywords: ['讨厌', '不喜欢', '反感'], action: 'aversion', template: '{sender} 讨厌 {object}' },
        { keywords: ['住在', '住在', '家住'], action: 'location', template: '{sender} 住在 {object}' },
        { keywords: ['生日', '出生'], action: 'birthday', template: '{sender} 的生日是 {object}' },
        { keywords: ['工作', '职业', '上班'], action: 'occupation', template: '{sender} 的工作是 {object}' },
        { keywords: ['名字', '叫', '称呼'], action: 'name', template: '{sender} 的名字是 {object}' },
        { keywords: ['是', '属于', '算是'], action: 'identity', template: '{sender} 是 {object}' },
        { keywords: ['有', '拥有', '养了'], action: 'possession', template: '{sender} 有 {object}' },
        { keywords: ['去了', '去过', '旅行'], action: 'visit', template: '{sender} 去过 {object}' },
        { keywords: ['认识', '朋友', '关系'], action: 'relationship', template: '{sender} 认识 {object}' },
        { keywords: ['昨天', '上次', '之前'], action: 'event_past', template: '{sender} {predicate} {object}' },
        { keywords: ['明天', '计划', '打算'], action: 'event_future', template: '{sender} 计划 {predicate} {object}' },
        { keywords: ['害怕', '恐惧', '担心'], action: 'fear', template: '{sender} 害怕 {object}' },
        { keywords: ['擅长', '会', '精通'], action: 'skill', template: '{sender} 擅长 {object}' },
        { keywords: ['想吃', '想吃', '想吃'], action: 'food_preference', template: '{sender} 想吃 {object}' },
      ];
    }

    /**
     * 初始化服务
     */
    async init() {
      try {
        if (window.LLMGateway) {
          this._llmGateway = new window.LLMGateway(this._platform);
        }
        console.log('[MemoryService] 初始化完成');
      } catch (e) {
        console.warn('[MemoryService] 初始化失败:', e);
      }
    }

    /**
     * 从聊天记录中提取原子事实
     * @param {Array} messages - 聊天消息列表 [{sender, content, timestamp}]
     * @param {Object} options - 选项 { charId, useLLM, maxFacts }
     * @returns {Promise<Array<Fact>>} 提取的事实列表
     *
     * Fact 结构: { id, subject, predicate, object, source, confidence, timestamp }
     */
    async extractFacts(messages, options) {
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return [];
      }

      options = options || {};
      var charId = options.charId || 'default';
      var useLLM = options.useLLM !== false; // 默认尝试 LLM
      var maxFacts = options.maxFacts || 20;

      var facts = [];

      // 优先尝试 LLM 提取
      if (useLLM && this._llmGateway) {
        try {
          var llmFacts = await this._extractByLLM(messages, charId);
          if (llmFacts && llmFacts.length > 0) {
            facts = facts.concat(llmFacts);
            console.log('[MemoryService] LLM 提取了 ' + llmFacts.length + ' 条事实');
          }
        } catch (e) {
          console.warn('[MemoryService] LLM 提取失败，降级到规则提取:', e);
        }
      }

      // 规则降级提取
      if (facts.length < maxFacts) {
        try {
          var ruleFacts = this._extractByRules(messages);
          if (ruleFacts && ruleFacts.length > 0) {
            // 去重：与已有事实比较
            var existingKeys = new Set(facts.map(function (f) {
              return f.subject + ':' + f.predicate + ':' + f.object;
            }));
            var uniqueRuleFacts = ruleFacts.filter(function (f) {
              return !existingKeys.has(f.subject + ':' + f.predicate + ':' + f.object);
            });
            facts = facts.concat(uniqueRuleFacts);
            console.log('[MemoryService] 规则提取了 ' + uniqueRuleFacts.length + ' 条事实');
          }
        } catch (e) {
          console.warn('[MemoryService] 规则提取失败:', e);
        }
      }

      // 限制数量
      facts = facts.slice(0, maxFacts);

      // 存储事实
      if (facts.length > 0) {
        await this._saveFacts(charId, facts);
      }

      // 发射事件
      this._emitEvent('memory:extracted', {
        charId: charId,
        factCount: facts.length,
        facts: facts
      });

      return facts;
    }

    /**
     * 获取角色的事实记忆
     * @param {string} charId - 角色ID
     * @returns {Promise<Array<Fact>>}
     */
    async getFacts(charId) {
      try {
        var data = await this._platform.data('memory', 'facts', {});
        var key = charId + ':facts';
        return data[key] || [];
      } catch (e) {
        console.warn('[MemoryService] 获取事实失败:', e);
        return [];
      }
    }

    /**
     * 清除角色的事实记忆
     * @param {string} charId - 角色ID
     * @returns {Promise<void>}
     */
    async clearFacts(charId) {
      try {
        var data = await this._platform.data('memory', 'facts', {});
        var key = charId + ':facts';
        data[key] = [];
        await this._platform.setData('memory', 'facts', data, { persist: true });

        this._emitEvent('memory:cleared', {
          charId: charId
        });

        console.log('[MemoryService] 已清除角色 ' + charId + ' 的事实记忆');
      } catch (e) {
        console.warn('[MemoryService] 清除事实失败:', e);
      }
    }

    // ==================== LLM 提取 ====================

    /**
     * 通过 LLM 提取原子事实
     * @private
     */
    async _extractByLLM(messages, charId) {
      // 构建提示词
      var chatSummary = this._summarizeMessages(messages);
      var prompt = this._buildExtractionPrompt(chatSummary);

      // 调用 LLM
      var aiService = this._platform?.getService?.('AI');
      if (!aiService) {
        throw new Error('AIService 不可用');
      }

      var rawResult = await aiService.generate(prompt, {
        moduleId: 'memory',
        maxTokens: 2000,
        temperature: 0.3,
        systemPrompt: '你是一个信息提取助手。从对话中提取原子事实，以JSON数组格式输出。每个事实包含 subject(主语), predicate(谓语), object(宾语)。只输出JSON，不要其他内容。'
      });

      // 解析结果
      return this._parseLLMResult(rawResult, charId);
    }

    /**
     * 总结消息内容（截取最近的消息）
     * @private
     */
    _summarizeMessages(messages) {
      // 取最近 20 条消息
      var recent = messages.slice(-20);
      return recent.map(function (m) {
        var sender = m.sender || m.name || m.from || '未知';
        var content = m.content || m.text || m.message || '';
        return sender + ': ' + content;
      }).join('\n');
    }

    /**
     * 构建 LLM 提取提示词
     * @private
     */
    _buildExtractionPrompt(chatSummary) {
      return '请从以下对话中提取原子事实（关于人物、关系、偏好、事件等关键信息）。\n' +
        '每个事实必须是 {subject, predicate, object} 三元组格式。\n' +
        '例如：{"subject": "小明", "predicate": "喜欢", "object": "吃火锅"}\n\n' +
        '对话内容：\n' + chatSummary + '\n\n' +
        '请以JSON数组格式输出所有提取到的事实：';
    }

    /**
     * 解析 LLM 返回结果
     * @private
     */
    _parseLLMResult(rawResult, charId) {
      if (!rawResult) return [];

      var facts = [];

      // 使用 JsonRepair 容错解析
      try {
        var parsed = window.JsonRepair ? window.JsonRepair.parse(rawResult) : JSON.parse(rawResult);

        if (Array.isArray(parsed)) {
          facts = parsed.filter(function (item) {
            return item && item.subject && item.predicate && item.object;
          }).map(function (item, index) {
            return {
              id: 'fact_' + Date.now() + '_' + index,
              subject: String(item.subject).trim(),
              predicate: String(item.predicate).trim(),
              object: String(item.object).trim(),
              source: 'llm',
              confidence: item.confidence || 0.8,
              timestamp: Date.now()
            };
          });
        }
      } catch (e) {
        console.warn('[MemoryService] LLM 结果解析失败:', e);
      }

      return facts;
    }

    // ==================== 规则降级提取 ====================

    /**
     * 通过关键词规则提取事实
     * @private
     */
    _extractByRules(messages) {
      var facts = [];
      var recent = messages.slice(-10); // 规则只处理最近10条

      for (var i = 0; i < recent.length; i++) {
        var msg = recent[i];
        var content = (msg.content || msg.text || msg.message || '').trim();
        var sender = msg.sender || msg.name || msg.from || '未知';

        if (!content) continue;

        // 遍历关键词映射
        for (var j = 0; j < this._ruleMappings.length; j++) {
          var rule = this._ruleMappings[j];
          var matched = false;

          for (var k = 0; k < rule.keywords.length; k++) {
            if (content.indexOf(rule.keywords[k]) !== -1) {
              matched = true;
              break;
            }
          }

          if (matched) {
            var extracted = this._extractFromSentence(content, sender, rule);
            if (extracted) {
              facts.push(extracted);
            }
            break; // 每条消息只匹配一个规则
          }
        }
      }

      return facts;
    }

    /**
     * 从句子中提取三元组
     * @private
     */
    _extractFromSentence(sentence, sender, rule) {
      // 简单的基于模板提取
      var object = '';

      // 尝试提取关键词后面的内容
      for (var i = 0; i < rule.keywords.length; i++) {
        var idx = sentence.indexOf(rule.keywords[i]);
        if (idx !== -1) {
          // 提取关键词后面的内容（到句号或结尾）
          var afterKeyword = sentence.substring(idx + rule.keywords[i].length).trim();
          // 去除前导的标点
          afterKeyword = afterKeyword.replace(/^[，。、！？\s]+/, '');
          // 截取到句号
          var endIdx = afterKeyword.search(/[，。！？\n]/);
          if (endIdx !== -1) {
            object = afterKeyword.substring(0, endIdx).trim();
          } else {
            object = afterKeyword.trim();
          }
          break;
        }
      }

      if (!object || object.length === 0 || object.length > 50) {
        return null;
      }

      return {
        id: 'fact_rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        subject: sender,
        predicate: rule.action,
        object: object,
        source: 'rule',
        confidence: 0.5,
        timestamp: Date.now()
      };
    }

    // ==================== 存储辅助 ====================

    /**
     * 保存事实到 DataStore
     * @private
     */
    async _saveFacts(charId, newFacts) {
      try {
        var data = await this._platform.data('memory', 'facts', {});
        var key = charId + ':facts';
        var existing = data[key] || [];

        // 合并去重
        var existingMap = new Map();
        for (var i = 0; i < existing.length; i++) {
          var f = existing[i];
          var mapKey = f.subject + ':' + f.predicate + ':' + f.object;
          existingMap.set(mapKey, f);
        }

        for (var j = 0; j < newFacts.length; j++) {
          var nf = newFacts[j];
          var nk = nf.subject + ':' + nf.predicate + ':' + nf.object;
          // 如果已存在，更新置信度（取较高值）
          if (existingMap.has(nk)) {
            var old = existingMap.get(nk);
            if (nf.confidence > old.confidence) {
              old.confidence = nf.confidence;
              old.timestamp = nf.timestamp;
              old.source = nf.source;
            }
          } else {
            existingMap.set(nk, nf);
          }
        }

        data[key] = Array.from(existingMap.values());

        // 限制总数（最多保留 100 条）
        if (data[key].length > 100) {
          data[key] = data[key].sort(function (a, b) {
            return b.timestamp - a.timestamp;
          }).slice(0, 100);
        }

        await this._platform.setData('memory', 'facts', data, { persist: true });
      } catch (e) {
        console.warn('[MemoryService] 保存事实失败:', e);
      }
    }

    // ==================== 事件发射 ====================

    /**
     * 发射事件（铁则十一：事件载荷包含 id/type/data/timestamp/source）
     * @private
     */
    _emitEvent(eventName, data) {
      try {
        var eventBus = this._platform?.eventBus;
        if (eventBus?.emit) {
          eventBus.emit(eventName, {
            id: 'mem_' + Date.now(),
            type: eventName,
            data: data,
            timestamp: Date.now(),
            source: 'memory-service'
          });
        }
      } catch (e) {
        console.warn('[MemoryService] 发射事件失败:', e);
      }
    }
  }

  // 挂载到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Memory = MemoryService;

  console.log('[Service] MemoryService (记忆提取与降级机制) 已加载');
})();
