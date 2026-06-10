/**
 * ContextAssembler - 上下文装配器
 *
 * [铁则合规]
 * - 铁则一：数据读写通过 Schema
 * - 铁则八：只读缓存，不维护内存副本（缓存是只读优化，非业务状态）
 * - 铁则九：错误降级
 *
 * 用途：替代 DirectorService._collectContext()，按预算装配上下文
 * 预算：2000 tokens（约 4000 中文字符）
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  /**
   * ContextAssembler 上下文装配器
   */
  class ContextAssembler {
    constructor(platform) {
      this._platform = platform || window.Platform;

      // 预算分配（tokens）
      this._budget = {
        worldFacts: 500,
        characterMeta: 300,
        storyEvents: 800,
        currentScene: 400,
      };

      // 只读缓存（用于优化，非业务状态）
      this._cache = {
        facts: null,
        factsCharId: null,
        meta: null,
        metaCharId: null,
      };
    }

    /**
     * 装配上下文
     * @param {Object} options - { charId, forceRefresh }
     * @returns {Promise<string>} 格式化后的上下文文本
     */
    async assemble(options = {}) {
      const { charId = 'default', forceRefresh = false } = options;
      const parts = [];

      try {
        // 1. 世界约束（最高优先，缓存）
        const facts = await this._getWorldFacts(charId, forceRefresh);
        if (facts && Object.keys(facts).length > 0) {
          const factsText = Object.entries(facts)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n');
          parts.push(this._formatSection('定了的事', factsText));
        }
      } catch (e) {
        console.warn('[ContextAssembler] 获取世界约束失败:', e);
      }

      try {
        // 2. 角色元数据（缓存）
        const meta = await this._getCharacterMeta(charId, forceRefresh);
        if (meta) {
          const metaParts = [];
          if (meta.name) metaParts.push(`- 名称: ${meta.name}`);
          if (meta.personality) metaParts.push(`- 性格: ${meta.personality}`);
          if (meta.scenario) metaParts.push(`- 场景: ${meta.scenario}`);

          if (metaParts.length > 0) {
            parts.push(this._formatSection('角色信息', metaParts.join('\n')));
          }
        }
      } catch (e) {
        console.warn('[ContextAssembler] 获取角色元数据失败:', e);
      }

      try {
        // 3. 事件时间线（最近事件）- [铁则一] 通过 Platform.data() 读取
        var recentEvents = null;
        try {
          recentEvents = await this._platform?.data?.('storyEvents', 'recent', 5);
        } catch (e) {
          console.warn('[ContextAssembler] 获取事件时间线失败:', e);
        }
        if (recentEvents && recentEvents.length > 0) {
          const eventsText = recentEvents
            .map(function(ev) { return '- ' + ev.summary + ' (' + this._formatTime(ev.time) + ')'; }.bind(this))
            .join('\n');
          parts.push(this._formatSection('印象深的事', eventsText));
        }
      } catch (e) {
        console.warn('[ContextAssembler] 获取事件时间线失败:', e);
      }

      try {
        // 4. 当前场景 - [铁则一] 通过 Platform.data() 读取
        var currentLoc = null;
        try {
          currentLoc = await this._platform?.data?.('worldFacts', 'currentLocation');
        } catch (e) {
          console.warn('[ContextAssembler] 获取当前场景失败:', e);
        }
        if (currentLoc) {
          var locDetail = null;
          var npcs = null;
          try {
            locDetail = await this._platform?.data?.('worldFacts', 'location', currentLoc);
            if (locDetail) {
              npcs = await this._platform?.data?.('worldFacts', 'npcsAtLocation', currentLoc);
            }
          } catch (e) {
            console.warn('[ContextAssembler] 获取场景详情失败:', e);
          }
          if (locDetail) {
            const sceneParts = [
              '- 地点: ' + locDetail.name,
            ];
            if (locDetail.description) {
              sceneParts.push('- 描述: ' + locDetail.description);
            }
            if (npcs && npcs.length > 0) {
              sceneParts.push('- 在场人物: ' + npcs.join('、'));
            }
            parts.push(this._formatSection('当前场景', sceneParts.join('\n')));
          }
        }
      } catch (e) {
        console.warn('[ContextAssembler] 获取当前场景失败:', e);
      }

      return parts.join('\n\n');
    }

    /**
     * 获取世界约束（带缓存）
     * @private
     */
    async _getWorldFacts(charId, forceRefresh) {
      if (!forceRefresh && this._cache.factsCharId === charId && this._cache.facts) {
        return this._cache.facts;
      }

      // [铁则一] 通过 Platform.data() 读取，禁止直接实例化 Schema
      var facts = null;
      try {
        facts = await this._platform?.data?.('worldFacts', 'allFacts');
      } catch (e) {
        console.warn('[ContextAssembler] 获取世界约束失败:', e);
      }
      if (!facts) return null;

      this._cache.facts = facts;
      this._cache.factsCharId = charId;
      return facts;
    }

    /**
     * 获取角色元数据（带缓存）
     * @private
     */
    async _getCharacterMeta(charId, forceRefresh) {
      if (!forceRefresh && this._cache.metaCharId === charId && this._cache.meta) {
        return this._cache.meta;
      }

      // [铁则一] 通过 Platform.data() 读取，禁止直接实例化 Schema
      var meta = null;
      try {
        meta = await this._platform?.data?.('characterMetadata', 'get', charId);
      } catch (e) {
        console.warn('[ContextAssembler] 获取角色元数据失败:', e);
      }
      if (!meta) return null;

      this._cache.meta = meta;
      this._cache.metaCharId = charId;
      return meta;
    }

    /**
     * 格式化区块
     * @private
     */
    _formatSection(title, content) {
      return `[${title}]\n${content}`;
    }

    /**
     * 格式化时间
     * @private
     */
    _formatTime(timestamp) {
      try {
        return new Date(timestamp).toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        return '';
      }
    }

    /**
     * 清除缓存
     */
    clearCache() {
      this._cache = {
        facts: null,
        factsCharId: null,
        meta: null,
        metaCharId: null,
      };
    }

    /**
     * 估算 token 数（粗略估计）
     * @param {string} text
     * @returns {number}
     */
    estimateTokens(text) {
      // 粗略估计：1 token ≈ 0.5 中文字符 或 0.75 英文单词
      const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
      return Math.ceil(chineseChars * 0.5 + englishWords * 0.75);
    }

    /**
     * 为世界生成装配上下文（静态层专用）
     * @param {Object} inputs - { charId, xbxData, worldBookEntries, charInfo }
     * @returns {Object} { context, tokenCount, sources }
     */
    assembleForWorldGen(inputs) {
      var parts = [];
      var used = 0;
      var maxBudget = 3000; // 世界生成允许更大的预算

      if (inputs.charInfo) {
        var charBlock = this._formatCharInfo(inputs.charInfo);
        if (this._pushWithBudget(parts, charBlock, used, maxBudget)) {
          used += this.estimateTokens(charBlock);
        }
      }

      if (inputs.xbxData) {
        var xbxBlock = this._formatXBXData(inputs.xbxData);
        if (xbxBlock && this._pushWithBudget(parts, xbxBlock, used, maxBudget)) {
          used += this.estimateTokens(xbxBlock);
        }
      }

      if (inputs.worldBookEntries && inputs.worldBookEntries.length > 0) {
        var wbBlock = this._formatWorldBook(inputs.worldBookEntries);
        if (this._pushWithBudget(parts, wbBlock, used, maxBudget)) {
          used += this.estimateTokens(wbBlock);
        }
      }

      return {
        context: parts.join('\n\n'),
        tokenCount: used,
        sources: {
          xbx: !!inputs.xbxData,
          worldBook: !!(inputs.worldBookEntries && inputs.worldBookEntries.length),
          charCard: !!inputs.charInfo
        }
      };
    }

    /**
     * 带预算限制的追加
     * @private
     */
    _pushWithBudget(parts, text, used, max) {
      var t = this.estimateTokens(text);
      if (used + t > max) {
        console.warn('[ContextAssembler] 预算超限，跳过:', text.slice(0, 50) + '...');
        return false;
      }
      parts.push(text);
      return true;
    }

    /**
     * 格式化角色卡信息
     * @private
     */
    _formatCharInfo(charInfo) {
      if (!charInfo) return '';
      var parts = ['【角色卡信息】'];
      if (charInfo.name) parts.push('名称: ' + charInfo.name);
      if (charInfo.description) parts.push('描述: ' + String(charInfo.description).slice(0, 500));
      if (charInfo.personality) parts.push('性格: ' + charInfo.personality);
      if (charInfo.scenario) parts.push('场景: ' + charInfo.scenario);
      return parts.join('\n');
    }

    /**
     * 格式化小白X数据
     * @private
     */
    _formatXBXData(xbxData) {
      if (!xbxData) return null;
      var parts = ['【小白X积累数据】'];

      if (xbxData.facts && xbxData.facts.length > 0) {
        parts.push('已知世界规则:');
        xbxData.facts.slice(0, 15).forEach(function (f) {
          parts.push('- ' + (f.s || '') + ' ' + (f.p || '') + ' ' + (f.o || ''));
        });
      }

      if (xbxData.events && xbxData.events.length > 0) {
        parts.push('已知剧情事件:');
        xbxData.events.slice(0, 10).forEach(function (e) {
          parts.push('- [' + (e.weight || '') + '] ' + (e.title || '') + ': ' + (e.summary || ''));
        });
      }

      if (xbxData.stateAtoms && xbxData.stateAtoms.length > 0) {
        parts.push('已知场景:');
        xbxData.stateAtoms.slice(0, 8).forEach(function (a) {
          parts.push('- ' + (a.semantic || '') + (a.where ? ' (地点: ' + a.where + ')' : ''));
        });
      }

      return parts.join('\n');
    }

    /**
     * 格式化世界书条目
     * @private
     */
    _formatWorldBook(entries) {
      var parts = ['【世界书条目】'];
      entries.slice(0, 20).forEach(function (e) {
        var name = e.key || e.comment || e.name || '未知';
        var content = e.content || '';
        parts.push('- ' + name + ': ' + String(content).slice(0, 100));
      });
      return parts.join('\n');
    }

    /**
     * [v3.0] 为世界大纲生成装配上下文（Step1专用）
     * 数据来源：ST世界书 + 角色卡设定（不依赖小白X）
     */
    async assembleForWorldOutline(inputs) {
      var charInfo = (inputs || {}).charInfo;
      var worldBookEntries = (inputs || {}).worldBookEntries;
      var parts = [];

      if (charInfo) {
        parts.push(this._formatCharInfo(charInfo));
      }

      if (worldBookEntries && worldBookEntries.length > 0) {
        parts.push(this._formatWorldBook(worldBookEntries));
      }

      return {
        worldContext: parts.join('\n\n'),
        sources: {
          charCard: !!charInfo,
          worldBook: !!(worldBookEntries && worldBookEntries.length)
        }
      };
    }

    /**
     * [v3.0] 为世界推演装配上下文
     */
    async assembleForSimulation(inputs) {
      var parts = [];
      var inp = inputs || {};

      if (inp.worldTruth) {
        parts.push('## 世界真相\n' + inp.worldTruth);
      }
      if (inp.recentEvents) {
        parts.push('## 最近事件\n' + inp.recentEvents);
      }
      if (inp.recentPlayerActions) {
        parts.push('## 玩家最近行为\n' + inp.recentPlayerActions);
      }

      return {
        worldName: inp.worldName || '未知',
        currentStage: inp.currentStage || 1,
        deviationScore: inp.deviationScore || 0,
        revealedLayers: inp.revealedLayers || 'Stage 1',
        worldTruth: parts[0] || '',
        recentEvents: parts[1] || '',
        recentPlayerActions: parts[2] || ''
      };
    }

    /**
     * [v3.0] 为偏差分析装配上下文
     */
    async assembleForDeviation(inputs) {
      return {
        currentWorldRules: (inputs || {}).currentWorldRules || '暂无规则',
        playerAction: (inputs || {}).playerAction || '暂无行为'
      };
    }

    /**
     * [v3.0] 为场景切换装配上下文
     */
    async assembleForSceneSwitch(inputs) {
      return {
        worldContext: (inputs || {}).worldContext || '',
        prevLocation: (inputs || {}).prevLocation || '未知',
        targetLocation: (inputs || {}).targetLocation || '未知',
        deviationScore: String((inputs || {}).deviationScore || 0),
        currentStage: String((inputs || {}).currentStage || 1),
        recentSummary: (inputs || {}).recentSummary || ''
      };
    }
  }

  // 暴露到全局
  window.ContextAssembler = ContextAssembler;

  console.log('[Core] ContextAssembler 已加载');
})();
