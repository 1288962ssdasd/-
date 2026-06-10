/**
 * @layer Service
 * @file   news-expert.js
 * @description 新闻专家 - 生成世界新闻和头条
 *
 * 职责:
 *   - 根据世界上下文生成新闻内容
 *   - 生成与剧情相关的新闻头条
 *   - 输出标准化的新闻数据结构
 *
 * 输出JSON格式:
 *   {
 *     news: [{
 *       title: string,
 *       content: string,
 *       category: string,
 *       relatedNPC: string
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
   * 新闻专家类
   * 继承 BaseExpert
   */
  class NewsExpert extends window.BaseExpert {
    constructor(platform, config) {
      super(platform, {
        expertId: 'news-expert',
        channel: 'channel-content', // [v4.3-fix] 使用已有通道
        role: 'news-generator',
        ...config,
      });

      // 新闻类别定义
      this._categories = [
        'world', // 世界大事
        'local', // 本地新闻
        'gossip', // 八卦传闻
        'business', // 商业财经
        'emergency', // 紧急事件
        'entertainment', // 娱乐
      ];
    }

    /**
     * 生成新闻
     * @param {Object} context - 上下文信息
     * @param {string} context.worldName - 世界名称
     * @param {string} context.worldTheme - 世界主题
     * @param {Array} context.recentEvents - 最近事件
     * @param {number} context.newsCount - 生成新闻数量（默认3-5）
     * @returns {Promise<Object|null>} 新闻列表
     */
    async generate(context) {
      const result = await super.generate(context);
      if (!result) return null;

      // 添加元数据
      result.meta = {
        generatedAt: this._getTimestamp(),
        worldName: context.worldName || 'unknown',
        newsCount: result.news ? result.news.length : 0,
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
      try {
        if (window.PhoneData?.World) {
          const worldDataSchema = new window.PhoneData.World(this._platform);
          const charId = context.charId || baseContext.charId || 'default';

          // 尝试获取 Step2 数据（包含 world, maps, npcs, rules, factions）
          step2Data = await worldDataSchema.getStep2(charId);
          if (step2Data) {
            worldContext = step2Data.world || {};
          }

          // 如果 Step2 没有数据，尝试从主数据获取
          if (!worldContext.name) {
            const mainData = await worldDataSchema.get(charId);
            if (mainData) {
              worldContext = { ...mainData, ...worldContext };
            }
          }
        }
      } catch (e) {
        console.warn('[NewsExpert] 获取世界数据失败:', e);
      }

      // 获取最近剧情事件
      let recentEvents = [];
      try {
        if (window.PhoneData?.StoryEvents) {
          const storyEvents = new window.PhoneData.StoryEvents(this._platform);
          recentEvents = await storyEvents.getRecent(5) || [];
        }
      } catch (e) {
        // 忽略
      }

      // 获取 NPC 列表 - 优先使用 Step2 中的 npcs
      let npcList = [];
      try {
        if (step2Data?.npcs && step2Data.npcs.length > 0) {
          npcList = step2Data.npcs;
        } else if (window.PhoneData?.NPC) {
          const npcData = new window.PhoneData.NPC(this._platform);
          npcList = await npcData.getList() || [];
        }
      } catch (e) {
        // 忽略
      }

      // [v4.3-fix] 正确提取 V2 数据结构中的字段
      return {
        ...baseContext,
        worldName: context.worldName || worldContext.name || '未知世界',
        worldTheme: context.worldTheme || worldContext.theme || '通用',
        era: context.era || worldContext.era || '现代',
        atmosphere: worldContext.atmosphere || '普通',
        keyLocations: worldContext.keyLocations || (step2Data?.maps?.outdoor?.nodes?.map(n => n.name) || []),
        factions: worldContext.factions || step2Data?.factions || [],
        recentEvents: context.recentEvents || recentEvents,
        npcList: npcList.slice(0, 10).map((npc) => npc.name || npc),
        newsCount: context.newsCount || 4,
        categories: this._categories.join(', '),
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

      if (!Array.isArray(result.news)) {
        return false;
      }

      // 验证每个新闻项
      for (const news of result.news) {
        if (!news.title || !news.content) {
          console.warn('[NewsExpert] 新闻项缺少必要字段:', news);
          return false;
        }
      }

      return true;
    }

    /**
     * 生成默认新闻（完全降级）
     * @param {number} count - 新闻数量
     * @returns {Object} 新闻列表
     */
    generateFallbackNews(count = 3) {
      const news = [];
      const templates = [
        {
          title: '今日天气晴朗',
          content: '据气象部门报道，今日天气晴朗，适合外出活动。',
          category: 'local',
          relatedNPC: '',
        },
        {
          title: '市场物价稳定',
          content: '近期市场物价保持稳定，各类商品供应充足。',
          category: 'business',
          relatedNPC: '',
        },
        {
          title: '神秘事件传闻',
          content: '有市民称在城郊目击不明现象，相关部门正在调查中。',
          category: 'gossip',
          relatedNPC: '',
        },
        {
          title: '节日庆典筹备中',
          content: '一年一度的节日庆典正在紧张筹备中，预计将吸引大量游客。',
          category: 'entertainment',
          relatedNPC: '',
        },
        {
          title: '安全提醒',
          content: '警方提醒市民注意人身和财产安全，避免夜间单独外出。',
          category: 'emergency',
          relatedNPC: '',
        },
      ];

      for (let i = 0; i < count && i < templates.length; i++) {
        news.push({
          ...templates[i],
          id: `fallback_news_${Date.now()}_${i}`,
        });
      }

      return {
        news,
        meta: {
          generatedAt: this._getTimestamp(),
          isFallback: true,
          expertId: this._expertId,
        },
      };
    }

    /**
     * 生成热搜列表
     * @param {number} count - 热搜数量
     * @returns {Object} 热搜列表
     */
    generateHotSearch(count = 5) {
      const hotSearchItems = [
        { title: '神秘事件', heat: 999999, tag: '沸' },
        { title: '新角色登场', heat: 888888, tag: '热' },
        { title: '剧情更新', heat: 777777, tag: '热' },
        { title: '玩家选择', heat: 666666, tag: '新' },
        { title: '隐藏剧情', heat: 555555, tag: '新' },
        { title: '世界设定', heat: 444444, tag: '' },
        { title: '角色关系', heat: 333333, tag: '' },
        { title: '任务攻略', heat: 222222, tag: '' },
      ];

      const selected = hotSearchItems.slice(0, count).map((item, index) => ({
        ...item,
        rank: index + 1,
        heatDisplay: this._formatHeat(item.heat),
      }));

      return {
        hotSearch: selected,
        meta: {
          generatedAt: this._getTimestamp(),
          expertId: this._expertId,
        },
      };
    }

    /**
     * 格式化热度数字
     * @param {number} heat - 热度值
     * @returns {string} 格式化后的字符串
     */
    _formatHeat(heat) {
      if (heat >= 10000) {
        return (heat / 10000).toFixed(1) + '万';
      }
      return heat.toString();
    }
  }

  // 导出到全局
  window.NewsExpert = NewsExpert;

})();
