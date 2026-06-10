/**
 * @layer Service
 * @file   social-expert.js
 * @description 社交专家 - 生成NPC社交互动内容
 *
 * 职责:
 *   - 根据NPC关系和世界上下文生成社交互动
 *   - 生成朋友圈、微博等社交内容
 *   - [Task 6.3] 集成论坛风格系统，按风格输出论坛内容
 *   - [Task 6.4] 扩展微博三页面生成（热搜页/榜单页/用户页）
 *   - 输出标准化的社交互动数据结构
 *
 * 输出JSON格式:
 *   {
 *     interactions: [{
 *       npcId: string,
 *       type: string,
 *       content: string
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
   * 社交专家类
   * 继承 BaseExpert
   */
  class SocialExpert extends window.BaseExpert {
    constructor(platform, config) {
      super(platform, {
        expertId: 'social-expert',
        channel: 'channel-director', // [F-07] 使用 director 专用通道 (30000ms timeout)
        role: 'social-interaction-generator',
        ...config,
      });

      // 互动类型定义
      this._interactionTypes = [
        'moment', // 朋友圈
        'weibo', // 微博
        'like', // 点赞
        'comment', // 评论
        'share', // 分享
        'mention', // 提及
        'forum', // [Task 6.3] 论坛
      ];

      // 社交情绪定义
      this._socialMoods = [
        'casual', // 随意
        'excited', // 兴奋
        'thoughtful', // 深思
        'humorous', // 幽默
        'melancholy', // 忧郁
        'celebratory', // 庆祝
        'mysterious', // 神秘
      ];

      // [Task 6.4] 微博博文 ID 命名空间
      this._weiboIdNamespaces = {
        hot: 'h',    // 热搜
        rank: 'r',   // 榜单
        user: 'u',   // 用户
      };
    }

    /**
     * 生成社交互动
     * @param {Object} context - 上下文信息
     * @param {string} context.npcId - NPC ID
     * @param {string} context.interactionType - 互动类型
     * @param {string} context.triggerEvent - 触发事件
     * @param {number} context.interactionCount - 生成数量（默认1-3）
     * @returns {Promise<Object|null>} 互动列表
     */
    async generate(context) {
      const result = await super.generate(context);
      if (!result) return null;

      // 添加元数据
      result.meta = {
        generatedAt: this._getTimestamp(),
        npcId: context.npcId || 'unknown',
        interactionType: context.interactionType || 'mixed',
        expertId: this._expertId,
      };

      return result;
    }

    // ========== [Task 6.3] 论坛风格集成 ==========

    /**
     * 获取论坛风格服务实例
     * @returns {Object|null} ForumStylesService 实例
     * @private
     */
    _getForumStylesService() {
      try {
        // 优先从 Platform 获取
        var svc = this._platform?.get?.('forumStylesService');
        if (svc) return svc;

        // 降级：通过 Platform 服务注册表获取
        var svc2 = this._platform?.get?.('forumStylesService');
        if (svc2) return svc2;
      } catch (e) {
        console.warn('[SocialExpert] 获取 ForumStylesService 失败:', e);
      }
      return null;
    }

    /**
     * 按指定风格生成论坛内容
     * @param {Object} context - 上下文
     * @param {string} context.styleId - 风格ID（可选，不指定则自动推荐）
     * @param {string} context.forumTopic - 论坛话题
     * @returns {Promise<Object>} 论坛互动内容
     */
    async generateForumContent(context) {
      var styleSvc = this._getForumStylesService();
      var style = null;

      // 确定使用哪种风格
      if (context.styleId) {
        style = styleSvc?.getStyle(context.styleId);
      } else {
        style = styleSvc?.recommendStyle(context.npcPersonality);
      }

      if (!style) {
        console.warn('[SocialExpert] 无法获取论坛风格，使用默认');
        style = {
          id: 'tieba',
          name: '贴吧老哥',
          systemPrompt: '你是一个贴吧用户，说话随性直白。',
          exampleOutputs: ['有一说一，这事儿确实离谱'],
          toneFeatures: ['随性', '直白'],
          vocabulary: [],
        };
      }

      // 构建带风格信息的上下文
      var styleContext = {
        ...context,
        interactionType: 'forum',
        forumStyle: {
          id: style.id,
          name: style.name,
          systemPrompt: style.systemPrompt,
          exampleOutputs: style.exampleOutputs,
          toneFeatures: style.toneFeatures,
          vocabulary: style.vocabulary || [],
        },
      };

      try {
        var result = await this.generate(styleContext);
        if (result && result.interactions) {
          // 为每个互动项添加风格标记
          result.interactions = result.interactions.map(function(item) {
            return {
              ...item,
              type: 'forum',
              styleId: style.id,
              styleName: style.name,
            };
          });
        }
        return result;
      } catch (e) {
        console.warn('[SocialExpert] 论坛内容生成失败:', e);
        return this.generateFallbackForumContent(context, style);
      }
    }

    /**
     * 生成论坛降级内容
     * @param {Object} context - 上下文
     * @param {Object} style - 风格信息
     * @returns {Object} 降级论坛内容
     * @private
     */
    generateFallbackForumContent(context, style) {
      var npcName = context?.npcName || '匿名用户';
      var examples = style?.exampleOutputs || ['说点什么...'];
      var content = examples[Math.floor(Math.random() * examples.length)];

      return {
        interactions: [{
          npcId: context?.npcId || 'unknown',
          type: 'forum',
          content: content,
          author: npcName,
          styleId: style?.id || 'tieba',
          styleName: style?.name || '贴吧老哥',
          timestamp: this._getTimestamp(),
        }],
        meta: {
          generatedAt: this._getTimestamp(),
          isFallback: true,
          expertId: this._expertId,
        },
      };
    }

    // ========== [Task 6.4] 微博三页面生成 ==========

    /**
     * 生成微博热搜页内容
     * 基于世界事件生成热搜榜
     * @param {Object} context - 上下文
     * @param {Array} context.worldEvents - 世界事件列表
     * @param {number} context.count - 生成数量（默认10）
     * @returns {Object} 热搜页数据
     */
    generateWeiboHotPage(context) {
      var worldEvents = context?.worldEvents || [];
      var count = context?.count || 10;
      var hotItems = [];

      // 基于世界事件生成热搜
      for (var i = 0; i < count; i++) {
        var event = worldEvents[i] || null;
        var title, heat, category;

        if (event) {
          title = event.title || event.name || '热门话题' + (i + 1);
          heat = event.heat || Math.floor(Math.random() * 9000000 + 1000000);
          category = event.category || this._getRandomHotCategory();
        } else {
          title = this._getRandomHotTopic(i);
          heat = Math.floor(Math.random() * 9000000 + 1000000);
          category = this._getRandomHotCategory();
        }

        hotItems.push({
          id: this._weiboIdNamespaces.hot + '_' + Date.now() + '_' + i,
          rank: i + 1,
          title: title,
          heat: heat,
          heatLabel: this._formatHeat(heat),
          category: category,
          isHot: i < 3,
          isNew: Math.random() > 0.7,
          isRecommend: i >= 3 && i < 6,
        });
      }

      return {
        page: 'hot',
        title: '微博热搜',
        items: hotItems,
        updatedAt: this._getTimestamp(),
        meta: {
          generatedAt: this._getTimestamp(),
          expertId: this._expertId,
        },
      };
    }

    /**
     * 生成微博榜单页内容
     * 话题榜和热议榜
     * @param {Object} context - 上下文
     * @param {string} context.rankType - 榜单类型（topic/discuss）
     * @param {number} context.count - 生成数量（默认10）
     * @returns {Object} 榜单页数据
     */
    generateWeiboRankPage(context) {
      var rankType = context?.rankType || 'topic';
      var count = context?.count || 10;
      var rankItems = [];

      for (var i = 0; i < count; i++) {
        var topicName, discussCount, readCount;

        if (rankType === 'topic') {
          // 话题榜
          topicName = this._getRandomTopicName(i);
          discussCount = Math.floor(Math.random() * 500000 + 10000);
          readCount = discussCount * Math.floor(Math.random() * 100 + 10);
        } else {
          // 热议榜
          topicName = this._getRandomDiscussTopic(i);
          discussCount = Math.floor(Math.random() * 200000 + 5000);
          readCount = discussCount * Math.floor(Math.random() * 50 + 5);
        }

        rankItems.push({
          id: this._weiboIdNamespaces.rank + '_' + Date.now() + '_' + i,
          rank: i + 1,
          topicName: topicName,
          discussCount: discussCount,
          readCount: readCount,
          trend: this._getRandomTrend(),
        });
      }

      return {
        page: 'rank',
        rankType: rankType,
        title: rankType === 'topic' ? '话题榜' : '热议榜',
        items: rankItems,
        updatedAt: this._getTimestamp(),
        meta: {
          generatedAt: this._getTimestamp(),
          expertId: this._expertId,
        },
      };
    }

    /**
     * 生成微博用户页内容
     * NPC 微博账号动态
     * @param {Object} context - 上下文
     * @param {string} context.npcId - NPC ID
     * @param {string} context.npcName - NPC 名称
     * @param {string} context.npcBio - NPC 简介
     * @param {number} context.postCount - 生成微博数量（默认5）
     * @returns {Object} 用户页数据
     */
    generateWeiboUserPage(context) {
      var npcName = context?.npcName || '未知用户';
      var npcBio = context?.npcBio || '这个人很懒，什么都没写';
      var postCount = context?.postCount || 5;
      var posts = [];

      for (var i = 0; i < postCount; i++) {
        var content = this._getRandomWeiboPost(context);
        posts.push({
          id: this._weiboIdNamespaces.user + '_' + (context?.npcId || 'unknown') + '_' + Date.now() + '_' + i,
          author: npcName,
          authorId: context?.npcId || 'unknown',
          content: content,
          images: Math.random() > 0.6 ? this._generateFakeImageUrls(Math.floor(Math.random() * 3 + 1)) : [],
          likes: Math.floor(Math.random() * 1000),
          comments: Math.floor(Math.random() * 200),
          reposts: Math.floor(Math.random() * 100),
          timestamp: this._getTimestamp() - i * 3600000 * Math.floor(Math.random() * 5 + 1),
          isOriginal: Math.random() > 0.3,
        });
      }

      return {
        page: 'user',
        title: npcName + '的微博',
        profile: {
          name: npcName,
          bio: npcBio,
          followers: Math.floor(Math.random() * 10000 + 100),
          following: Math.floor(Math.random() * 500 + 50),
          posts: Math.floor(Math.random() * 200 + 20),
        },
        posts: posts,
        meta: {
          generatedAt: this._getTimestamp(),
          expertId: this._expertId,
        },
      };
    }

    // ========== 微博辅助方法 ==========

    /**
     * 获取随机热搜分类
     * @returns {string} 分类名
     * @private
     */
    _getRandomHotCategory() {
      var categories = ['娱乐', '社会', '体育', '科技', '财经', '生活', '游戏', '影视', '音乐', '时尚'];
      return categories[Math.floor(Math.random() * categories.length)];
    }

    /**
     * 获取随机热搜话题（当没有世界事件时使用）
     * @param {number} index - 索引
     * @returns {string} 话题标题
     * @private
     */
    _getRandomHotTopic(index) {
      var topics = [
        '某明星新剧官宣', '今日A股走势', '全国天气预警',
        '新手机发布', '热门综艺开播', '国际赛事最新战况',
        '年度最佳电影评选', '网红美食探店', '旅游热门目的地',
        '科技新品发布', '健康生活新趋势', '职场热门话题',
      ];
      return topics[index % topics.length];
    }

    /**
     * 获取随机话题榜名称
     * @param {number} index - 索引
     * @returns {string} 话题名称
     * @private
     */
    _getRandomTopicName(index) {
      var topics = [
        '#今日最热话题#', '#年度盘点#', '#生活感悟#',
        '#工作日常#', '#美食推荐#', '#旅行日记#',
        '#读书笔记#', '#健身打卡#', '#数码评测#',
        '#电影推荐#', '#音乐分享#', '#宠物日常#',
      ];
      return topics[index % topics.length];
    }

    /**
     * 获取随机热议榜话题
     * @param {number} index - 索引
     * @returns {string} 话题名称
     * @private
     */
    _getRandomDiscussTopic(index) {
      var topics = [
        '你支持这个观点吗？', '大家怎么看这件事？',
        '这个政策对你有影响吗？', '你遇到过类似的情况吗？',
        '推荐一下你最近在看的东西', '分享一下你的经验',
        '你觉得哪个更好？', '有什么好的建议吗？',
        '最近有什么值得关注的？', '大家有什么看法？',
      ];
      return topics[index % topics.length];
    }

    /**
     * 获取随机趋势方向
     * @returns {string} 趋势（up/down/stable）
     * @private
     */
    _getRandomTrend() {
      var r = Math.random();
      if (r < 0.4) return 'up';
      if (r < 0.7) return 'down';
      return 'stable';
    }

    /**
     * 格式化热度数字
     * @param {number} heat - 热度值
     * @returns {string} 格式化后的热度
     * @private
     */
    _formatHeat(heat) {
      if (heat >= 10000000) return (heat / 10000000).toFixed(1) + '千万';
      if (heat >= 10000) return (heat / 10000).toFixed(1) + '万';
      return heat.toString();
    }

    /**
     * 获取随机微博内容
     * @param {Object} context - 上下文
     * @returns {string} 微博内容
     * @private
     */
    _getRandomWeiboPost(context) {
      var templates = [
        '刚刚看到一件有趣的事情 #日常#',
        '分享一个想法，欢迎大家讨论。',
        '今天学到了新东西，记录下来。',
        '转发一条重要的消息。',
        '有感而发，说几句心里话。',
        '推荐一个不错的地方/东西。',
        '问大家一个问题，求解答。',
        '今天心情不错，分享一下。',
        '这个世界真是越来越有意思了。',
        '生活就是这样，起起落落。',
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * 生成假的图片URL列表
     * @param {number} count - 数量
     * @returns {Array} 图片URL列表
     * @private
     */
    _generateFakeImageUrls(count) {
      var urls = [];
      for (var i = 0; i < count; i++) {
        urls.push('https://picsum.photos/400/300?random=' + Date.now() + '_' + i);
      }
      return urls;
    }

    // ========== 原有方法（保留） ==========

    /**
     * 构建 Prompt 上下文
     * @param {Object} context - 原始上下文
     * @returns {Promise<Object>} 构建后的上下文
     */
    async _buildPrompt(context) {
      const baseContext = await super._buildPrompt(context);

      // [修复] 处理 worldContext 可能是字符串的情况
      let worldContext = {};
      if (context.worldContext) {
        if (typeof context.worldContext === 'string') {
          try {
            worldContext = JSON.parse(context.worldContext);
            console.log('[SocialExpert] worldContext 从字符串解析成功');
          } catch (e) {
            console.warn('[SocialExpert] worldContext 字符串解析失败:', e);
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
          console.warn('[SocialExpert] 获取世界数据失败:', e);
        }
      }

      // [铁则一修复] 获取NPC数据 - 优先从 context.worldContext.npcs 查找
      let npcData = null;
      try {
        // 1. 优先从 worldContext.npcs 查找
        if (worldContext.npcs && context.npcId) {
          npcData = worldContext.npcs.find(function(n) { return n.id === context.npcId || n.name === context.npcId; });
          if (npcData) {
            console.log('[SocialExpert] 从 worldContext.npcs 找到NPC:', npcData.name);
          }
        }

        // 2. 从 Step2 数据中查找
        if (!npcData && step2Data && step2Data.npcs && context.npcId) {
          npcData = step2Data.npcs.find(function(n) { return n.id === context.npcId || n.name === context.npcId; });
          if (npcData) {
            console.log('[SocialExpert] 从 step2Data.npcs 找到NPC:', npcData.name);
          }
        }

        // 3. [铁则一修复] 通过 npcGeneratorService 获取 NPC 数据
        if (!npcData && context.npcId) {
          var npcGenSvc = this._platform?.get?.('npcGeneratorService');
          if (npcGenSvc?.getNPCById) {
            npcData = await npcGenSvc.getNPCById(context.npcId);
            if (npcData) {
              console.log('[SocialExpert] 从 npcGeneratorService 找到NPC:', npcData.name);
            }
          }
        }
      } catch (e) {
        console.warn('[SocialExpert] 获取NPC数据失败:', context.npcId, e);
      }

      // [修复] 兜底数据
      if (!npcData) {
        console.error('[SocialExpert] 无法找到NPC，使用兜底数据:', context.npcId);
        npcData = {
          id: context.npcId || 'unknown',
          name: context.npcName || '神秘人',
          personality: context.npcPersonality || '普通',
          role: '未知角色',
          emoji: '👤',
          relationship: context.relationship || '陌生人',
        };
      }

      // [铁则一修复] 获取最近社交内容 - 通过 friendsCircleService
      let recentSocial = [];
      try {
        var fcSvc = this._platform?.get?.('friendsCircleService');
        if (fcSvc?.getRecent) {
          recentSocial = await fcSvc.getRecent(10);
        }
      } catch (e) {
        console.warn('[SocialExpert] 获取最近社交内容失败:', e);
      }

      // [铁则一修复] 获取热点事件 - 通过 worldService
      let hotEvents = [];
      try {
        var worldSvc2 = this._platform?.get?.('worldService');
        if (worldSvc2?.getRecentEvents) {
          hotEvents = await worldSvc2.getRecentEvents(3);
        }
      } catch (e) {
        console.warn('[SocialExpert] 获取热点事件失败:', e);
      }

      // [Task 6.3] 注入论坛风格信息
      var forumStyle = null;
      if (context.interactionType === 'forum' || context.forumStyle) {
        forumStyle = context.forumStyle || null;
        // 如果没有传入风格，尝试推荐
        if (!forumStyle) {
          var styleSvc = this._getForumStylesService();
          if (styleSvc) {
            var recommended = styleSvc.recommendStyle(context.npcPersonality);
            if (recommended) {
              forumStyle = {
                id: recommended.id,
                name: recommended.name,
                systemPrompt: recommended.systemPrompt,
                exampleOutputs: recommended.exampleOutputs,
                toneFeatures: recommended.toneFeatures,
                vocabulary: recommended.vocabulary || [],
              };
            }
          }
        }
      }

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
        keyLocations: worldContext.keyLocations || (step2Data?.maps?.outdoor?.nodes?.map(function(n) { return n.name; }) || []),
        // 互动类型
        interactionType: context.interactionType || 'mixed',
        interactionTypes: this._interactionTypes.join(', '),
        socialMoods: this._socialMoods.join(', '),
        // 上下文
        recentSocial: recentSocial.map(function(s) { return (s.content || s.text || '').substring(0, 50); }),
        hotEvents: hotEvents.map(function(e) { return (e.title || e.description || '').substring(0, 50); }),
        triggerEvent: context.triggerEvent || null,
        // [Task 6.3] 论坛风格信息
        forumStyle: forumStyle,
        // 生成数量
        interactionCount: context.interactionCount || 2,
      };
    }

    /**
     * 验证结果
     * @param {Object} result - 解析后的结果
     * @returns {boolean} 是否有效
     */
    _validateResult(result) {
      if (!result || typeof result !== 'object') {
        console.warn('[SocialExpert] 验证失败: result 不是对象', result);
        return false;
      }

      if (!Array.isArray(result.interactions)) {
        console.warn('[SocialExpert] 验证失败: interactions 不是数组', {
          hasInteractions: 'interactions' in result,
          interactionsType: typeof result.interactions,
          resultKeys: Object.keys(result),
          fullResult: JSON.stringify(result).substring(0, 500)
        });
        return false;
      }

      // 验证每个互动项
      for (const interaction of result.interactions) {
        if (!interaction.content) {
          console.warn('[SocialExpert] 互动项缺少 content 字段:', interaction);
          return false;
        }

        if (!interaction.type) {
          console.warn('[SocialExpert] 互动项缺少 type 字段:', interaction);
          return false;
        }
      }

      console.log('[SocialExpert] 验证通过，互动数:', result.interactions.length);
      return true;
    }

    /**
     * 生成朋友圈内容
     * @param {Object} context - 上下文
     * @returns {Object} 朋友圈内容
     */
    generateMoment(context) {
      const npcName = context?.npcName || '神秘人';
      const personality = context?.npcPersonality || '普通';

      const templates = {
        casual: [
          '今天天气不错，出去走走。',
          '刚吃完一顿美味的晚餐。',
          '周末愉快！',
          '发现了一家不错的店。',
        ],
        excited: [
          '太激动了！刚刚发生了件大事！',
          '终于等到这一天了！',
          '好消息要和大家分享！',
          '简直不敢相信！',
        ],
        thoughtful: [
          '有些事情值得深思...',
          '人生的意义是什么？',
          '最近在读一本很有意思的书。',
          '有时候需要停下来思考。',
        ],
        humorous: [
          '今天发生了一件搞笑的事...',
          '笑死我了，一定要分享。',
          '生活就是要有幽默感。',
          '这个梗我能笑一年。',
        ],
        melancholy: [
          '有些日子总是让人感伤...',
          '想念过去的时光。',
          '雨天的思绪总是特别多。',
          '有些遗憾无法弥补。',
        ],
        celebratory: [
          '庆祝一下！',
          '值得纪念的日子！',
          '感谢大家的支持！',
          '今天是个特别的日子！',
        ],
        mysterious: [
          '有些事情不能明说...',
          '听到了一些有趣的传闻。',
          '这个世界比想象中复杂。',
          '有些秘密即将揭晓。',
        ],
      };

      const mood = context?.mood || 'casual';
      const moodTemplates = templates[mood] || templates.casual;
      const content = moodTemplates[Math.floor(Math.random() * moodTemplates.length)];

      return {
        interactions: [
          {
            npcId: context?.npcId || `npc_${Date.now()}`,
            type: 'moment',
            content: content,
            author: npcName,
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
     * 生成微博内容
     * @param {Object} context - 上下文
     * @returns {Object} 微博内容
     */
    generateWeibo(context) {
      const npcName = context?.npcName || '神秘用户';

      const templates = [
        '刚刚看到一件有趣的事情 #日常#',
        '分享一个想法，欢迎大家讨论。',
        '今天学到了新东西，记录下来。',
        '转发一条重要的消息。',
        '有感而发，说几句心里话。',
        '推荐一个不错的地方/东西。',
        '问大家一个问题，求解答。',
      ];

      const content = templates[Math.floor(Math.random() * templates.length)];

      return {
        interactions: [
          {
            npcId: context?.npcId || `npc_${Date.now()}`,
            type: 'weibo',
            content: content,
            author: npcName,
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
     * 生成默认互动（完全降级）
     * @param {Object} context - 上下文
     * @returns {Object} 互动列表
     */
    generateFallbackInteractions(context) {
      const interactionType = context?.interactionType || 'moment';

      switch (interactionType) {
        case 'moment':
          return this.generateMoment(context);
        case 'weibo':
          return this.generateWeibo(context);
        case 'forum':
          var styleSvc = this._getForumStylesService();
          var style = styleSvc?.getStyle(context?.styleId) || styleSvc?.recommendStyle(context?.npcPersonality);
          return this.generateFallbackForumContent(context, style);
        default:
          return this.generateMoment(context);
      }
    }

    /**
     * 批量生成多个NPC的互动
     * @param {Array} npcList - NPC列表
     * @param {Object} context - 上下文
     * @returns {Promise<Array>} 互动列表
     */
    async generateBatch(npcList, context) {
      if (!Array.isArray(npcList) || npcList.length === 0) {
        return [];
      }

      const allInteractions = [];

      for (const npc of npcList) {
        try {
          const npcContext = {
            ...context,
            npcId: npc.id,
            npcName: npc.name,
            npcPersonality: npc.personality,
            relationship: npc.relationship,
          };

          const result = await this.generate(npcContext);
          if (result && result.interactions) {
            allInteractions.push(...result.interactions);
          }
        } catch (e) {
          console.warn('[SocialExpert] 生成NPC互动失败:', npc.name, e);
          // 继续下一个NPC
        }
      }

      return allInteractions;
    }
  }

  // 导出到全局
  window.SocialExpert = SocialExpert;

})();
