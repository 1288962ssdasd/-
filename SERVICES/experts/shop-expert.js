/**
 * @layer Service
 * @file   shop-expert.js
 * @description 商店专家 - 生成商店商品列表
 *
 * 职责:
 *   - 根据世界上下文生成商店商品
 *   - 确保商品符合世界观和主题
 *   - 输出标准化的商品数据结构
 *
 * 输出JSON格式:
 *   {
 *     items: [{
 *       id: string,
 *       name: string,
 *       category: string,
 *       price: number,
 *       description: string,
 *       worldTag: string,
 *       effects: [{type: string, value: number}],
 *       usableIn: string[],
 *       icon: string
 *     }],
 *     meta: {...}
 *   }
 *
 * 铁则合规:
 *   - 铁则一: 数据读写通过 Schema 辅助函数
 *   - 铁则三: Service 层只处理数据操作和 AI 调用
 *   - 铁则七: 通过 LLMGateway 调用 AI
 *   - 铁则九: 错误处理降级
 */

;(function () {
  'use strict';

  /**
   * 商店专家类
   * 继承 BaseExpert
   */
  class ShopExpert extends window.BaseExpert {
    constructor(platform, config) {
      super(platform, {
        expertId: 'shop-expert',
        channel: 'channel-content', // [v4.3-fix] 使用已有通道
        role: 'shop-generator',
        ...config,
      });

      // 商品类别定义
      this._categories = [
        'consumable', // 消耗品
        'equipment', // 装备
        'material', // 材料
        'collectible', // 收藏品
        'gift', // 礼物
      ];

      // 效果类型定义
      this._effectTypes = [
        'heal', // 治疗
        'buff', // 增益
        'restore', // 恢复
        'unlock', // 解锁
        'cosmetic', // 外观
      ];
    }

    /**
     * 生成商店商品
     * @param {Object} context - 上下文信息
     * @param {string} context.worldName - 世界名称
     * @param {string} context.worldTheme - 世界主题
     * @param {string} context.era - 时代背景
     * @param {number} context.itemCount - 生成商品数量（默认6-10）
     * @returns {Promise<Object|null>} 商品列表
     */
    async generate(context) {
      // [v4.31.0-fix] 保存上下文供 fallback 使用
      this._lastContext = context;
      const result = await super.generate(context);
      if (!result) return null;

      // 添加元数据
      result.meta = {
        generatedAt: this._getTimestamp(),
        worldName: context.worldName || 'unknown',
        itemCount: result.items ? result.items.length : 0,
        expertId: this._expertId,
      };

      return result;
    }

    /**
     * 构建 Prompt 上下文
     * @param {Object} context - 原始上下文
     * @returns {Promise<Object>} 构建后的上下文
     */
    async _buildPrompt(context) {
      const baseContext = await super._buildPrompt(context);

      // [v4.3-fix] 获取 V2 世界数据 - 优先使用 Schema 方法
      let worldContext = {};
      let step2Data = null;
      let charId = context.charId || baseContext.charId || 'default';

      try {
        if (window.PhoneData?.World) {
          const worldDataSchema = new window.PhoneData.World(this._platform);

          // 优先尝试获取完整世界数据
          const worldData = await worldDataSchema.get(charId);
          if (worldData) {
            worldContext = worldData;
            step2Data = {
              world: worldData.world || { news: [] },
              maps: worldData.maps || { outdoor: {}, inside: {} },
              npcs: worldData.npcs || [],
              rules: worldData.rules || [],
              factions: worldData.factions || []
            };
          } else {
            // 降级：尝试获取 Step2 数据
            step2Data = await worldDataSchema.getStep2(charId);
            if (step2Data) {
              worldContext = step2Data.world || {};
            }
          }
        }
      } catch (e) {
        console.warn('[ShopExpert] 获取世界数据失败:', e);
      }

      // 获取当前商店数据（用于避免重复）
      let existingItems = [];
      try {
        if (window.PhoneData?.Shop) {
          const shopData = new window.PhoneData.Shop(this._platform);
          existingItems = await shopData.getItems() || [];
        }
      } catch (e) {
        // 忽略
      }

      // [修复] 获取游戏状态（金钱、阶段），参考 quest-expert 模式
      let gameState = {
        money: 0,
        stage: '',
        phase: '',
      };
      try {
        var econSvc = this._platform?.get?.('economyService');
        if (econSvc?.getBalance) {
          gameState.money = await econSvc.getBalance(charId) || 0;
        }
      } catch (e) {
        console.warn('[ShopExpert] 获取金钱失败:', e);
      }
      try {
        var statusSvc = this._platform?.get?.('statusService');
        if (statusSvc?.getCurrentStatus) {
          var status = await statusSvc.getCurrentStatus();
          if (status) {
            gameState.stage = status.stage || status.phase || '';
            gameState.phase = status.phase || '';
          }
        }
      } catch (e) {
        console.warn('[ShopExpert] 获取阶段状态失败:', e);
      }

      // [v4.3-fix] 正确提取 V2 数据结构中的字段
      return {
        ...baseContext,
        worldName: context.worldName || worldContext.name || '未知世界',
        worldTheme: context.worldTheme || worldContext.theme || '通用',
        era: context.era || worldContext.era || '现代',
        atmosphere: worldContext.atmosphere || '普通',
        keyLocations: worldContext.keyLocations || (step2Data?.maps?.outdoor?.nodes?.map(function(n) { return n.name; }) || []),
        factions: worldContext.factions || step2Data?.factions || [],
        gameState: gameState,
        triggerEvent: context.triggerEvent || null,
        itemCount: context.itemCount || 8,
        existingItemNames: existingItems.map((item) => item.name).join(', '),
        categories: this._categories.join(', '),
        effectTypes: this._effectTypes.join(', '),
      };
    }

    /**
     * 验证结果
     * @param {Object} result - 解析后的结果
     * @returns {boolean} 是否有效
     */
    _validateResult(result) {
      if (!result || typeof result !== 'object') {
        return false;
      }

      if (!Array.isArray(result.items)) {
        return false;
      }

      // 验证每个商品项
      for (const item of result.items) {
        if (!item.id || !item.name || !item.category) {
          console.warn('[ShopExpert] 商品项缺少必要字段:', item);
          return false;
        }

        if (typeof item.price !== 'number' || item.price < 0) {
          console.warn('[ShopExpert] 商品价格无效:', item);
          return false;
        }
      }

      return true;
    }

    /**
     * 生成单个商品（降级模式）
     * @param {Object} template - 商品模板
     * @returns {Object} 商品对象
     */
    generateFallbackItem(template) {
      const templates = [
        {
          id: `item_health_potion_${Date.now()}`,
          name: '治疗药水',
          category: 'consumable',
          price: 50,
          description: '恢复少量生命值',
          worldTag: '通用',
          effects: [{ type: 'heal', value: 20 }],
          usableIn: ['battle', 'field'],
          icon: '🧪',
        },
        {
          id: `item_energy_drink_${Date.now()}`,
          name: '能量饮料',
          category: 'consumable',
          price: 30,
          description: '恢复体力',
          worldTag: '通用',
          effects: [{ type: 'restore', value: 15 }],
          usableIn: ['field'],
          icon: '🥤',
        },
        {
          id: `item_lucky_charm_${Date.now()}`,
          name: '幸运符',
          category: 'collectible',
          price: 100,
          description: '带来好运的护身符',
          worldTag: '通用',
          effects: [{ type: 'buff', value: 5 }],
          usableIn: ['any'],
          icon: '🍀',
        },
      ];

      const base = templates[Math.floor(Math.random() * templates.length)];
      return {
        ...base,
        ...template,
        id: template?.id || `${this._expertId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    }

    /**
     * [v4.31.0-fix] 根据世界主题生成上下文相关的 fallback 商品
     * @param {Object} context - 上下文（含 worldTheme, era, atmosphere 等）
     * @param {number} count - 商品数量
     * @returns {Object} 商品列表
     */
    generateFallbackItems(count = 6) {
      const theme = (this._lastContext?.worldTheme || this._lastContext?.era || '现代').toLowerCase();
      const isModern = /现代|都市|校园|职场|赛博|末世|科幻/i.test(theme);
      const isFantasy = /奇幻|仙侠|武侠|魔法|中世纪|古代/i.test(theme);

      // 根据世界主题选择商品模板
      const templates = isModern ? [
        { name: '冰美式', category: 'consumable', price: 28, description: '提神醒脑，恢复精力', icon: '☕', effects: [{ type: 'restore', value: 15 }], usableIn: ['any'] },
        { name: '降噪耳机', category: 'equipment', price: 299, description: '隔绝喧嚣，专注当下', icon: '🎧', effects: [{ type: 'buff', value: 10 }], usableIn: ['any'] },
        { name: '电影票', category: 'gift', price: 68, description: '双人观影券，适合约会', icon: '🎬', effects: [{ type: 'buff', value: 8 }], usableIn: ['gift'] },
        { name: '幸运御守', category: 'collectible', price: 88, description: '神社求来的，据说很灵', icon: '🏮', effects: [{ type: 'luck', value: 5 }], usableIn: ['any'] },
        { name: '能量棒', category: 'consumable', price: 15, description: '运动后补充能量', icon: '🍫', effects: [{ type: 'heal', value: 10 }], usableIn: ['any'] },
        { name: '定制钥匙扣', category: 'gift', price: 35, description: '刻字款，心意满满', icon: '🔑', effects: [{ type: 'buff', value: 3 }], usableIn: ['gift'] },
        { name: '蓝牙音箱', category: 'equipment', price: 199, description: '随身携带的好音质', icon: '🔊', effects: [{ type: 'buff', value: 12 }], usableIn: ['any'] },
        { name: '星空投影灯', category: 'collectible', price: 158, description: '把银河搬进房间', icon: '🌌', effects: [{ type: 'cosmetic', value: 0 }], usableIn: ['any'] },
        { name: '鲜花束', category: 'gift', price: 99, description: '混搭鲜花，附赠贺卡', icon: '💐', effects: [{ type: 'buff', value: 15 }], usableIn: ['gift'] },
        { name: '笔记本套装', category: 'material', price: 45, description: '手账必备，记录灵感', icon: '📓', effects: [{ type: 'unlock', value: 5 }], usableIn: ['any'] },
      ] : isFantasy ? [
        { name: '回血丹', category: 'consumable', price: 50, description: '恢复少量生命值', icon: '💊', effects: [{ type: 'heal', value: 20 }], usableIn: ['battle', 'field'] },
        { name: '灵力符', category: 'material', price: 80, description: '蕴含灵力的符纸', icon: '📜', effects: [{ type: 'buff', value: 10 }], usableIn: ['any'] },
        { name: '护身玉佩', category: 'equipment', price: 200, description: '温润如玉，可挡一次攻击', icon: '🪙', effects: [{ type: 'buff', value: 15 }], usableIn: ['any'] },
        { name: '千里传音符', category: 'consumable', price: 30, description: '可向远方之人传话', icon: '🕊️', effects: [{ type: 'unlock', value: 5 }], usableIn: ['any'] },
        { name: '聚宝袋', category: 'collectible', price: 150, description: '据说能招财进宝', icon: '💰', effects: [{ type: 'luck', value: 8 }], usableIn: ['any'] },
        { name: '疗伤药膏', category: 'consumable', price: 40, description: '外敷内服皆可', icon: '🧴', effects: [{ type: 'heal', value: 15 }], usableIn: ['any'] },
      ] : [
        { name: '万能工具包', category: 'material', price: 60, description: '修理各种物品', icon: '🧰', effects: [{ type: 'restore', value: 10 }], usableIn: ['any'] },
        { name: '急救包', category: 'consumable', price: 45, description: '处理轻伤', icon: '🩹', effects: [{ type: 'heal', value: 20 }], usableIn: ['any'] },
        { name: '幸运币', category: 'collectible', price: 100, description: '带来好运', icon: '🍀', effects: [{ type: 'luck', value: 5 }], usableIn: ['any'] },
        { name: '能量补给', category: 'consumable', price: 30, description: '恢复体力', icon: '🔋', effects: [{ type: 'restore', value: 15 }], usableIn: ['any'] },
        { name: '护身符', category: 'equipment', price: 120, description: '提供防护', icon: '🛡️', effects: [{ type: 'buff', value: 10 }], usableIn: ['any'] },
        { name: '神秘碎片', category: 'material', price: 80, description: '用途不明的碎片', icon: '✨', effects: [{ type: 'unlock', value: 5 }], usableIn: ['any'] },
      ];

      const worldTag = this._lastContext?.worldTheme || '通用';
      const items = [];
      const pool = templates.slice(0, Math.max(count, templates.length));

      for (let i = 0; i < count; i++) {
        const tpl = pool[i % pool.length];
        items.push({
          id: `fallback_${this._expertId}_${Date.now()}_${i}`,
          name: tpl.name,
          category: tpl.category,
          price: tpl.price + Math.floor(Math.random() * 20) - 10,
          description: tpl.description,
          worldTag: worldTag,
          effects: tpl.effects.map(e => ({ ...e })),
          usableIn: tpl.usableIn,
          icon: tpl.icon,
        });
      }

      return {
        items,
        meta: {
          generatedAt: this._getTimestamp(),
          isFallback: true,
          expertId: this._expertId,
          worldTheme: worldTag,
        },
      };
    }

    /**
     * [v4.31.0-fix] 重写 fallback 生成方法，确保返回正确的 items 格式
     * @param {Object} context - 上下文
     * @returns {Object} fallback 数据
     */
    _generateFallback(context) {
      console.log(`[${this._expertId}] 使用 fallback 商品数据`);
      return this.generateFallbackItems(context?.itemCount || 6);
    }
  }

  // 导出到全局
  window.ShopExpert = ShopExpert;

})();
