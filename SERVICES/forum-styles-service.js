/**
 * @layer Service
 * @file   forum-styles-service.js
 * @description 论坛风格系统 - 10种预设风格提示词
 *
 * 职责:
 *   - 管理10种预设论坛风格（贴吧老哥、知乎精英、小红书种草等）
 *   - 为每种风格提供 systemPrompt、示例输出、语气特征
 *   - 支持自定义风格扩展
 *   - 为 SocialExpert 提供风格查询接口
 *
 * 铁则合规:
 *   - 铁则一: 数据读写通过 Schema 辅助函数
 *   - 铁则三: Service 层只处理数据操作
 *   - 铁则九: 错误处理降级
 *   - 铁则二十: Service 无状态，不直接调用其他 Service
 */

;(function () {
  'use strict';

  /**
   * 论坛风格服务
   */
  class ForumStylesService {
    constructor(platform) {
      this._platform = platform || window.Platform;

      // [Task 6.3] 10种预设风格定义
      this._styles = this._initPresetStyles();

      // 自定义风格存储
      this._customStyles = {};
    }

    /**
     * 初始化10种预设风格
     * @returns {Object} 预设风格映射
     * @private
     */
    _initPresetStyles() {
      return {
        // 1. 贴吧老哥
        tieba: {
          id: 'tieba',
          name: '贴吧老哥',
          description: '贴吧风格，随性直白，喜欢用梗和缩写',
          toneFeatures: ['随性', '直白', '口语化', '爱用梗', '短句为主'],
          systemPrompt: [
            '你是一个资深贴吧用户，说话风格随性直白。',
            '喜欢用网络梗、缩写（如yyds、xswl、awsl）。',
            '句子简短有力，偶尔带点调侃和自嘲。',
            '对热门话题有自己的看法，但不会过于严肃。',
            '会用"楼主"、"层主"、"顶"、"mark"等贴吧术语。',
          ].join('\n'),
          exampleOutputs: [
            '楼主这波操作属实秀，666',
            '前排占座，等后续更新',
            '笑死，这什么神仙剧情',
            '有一说一，这事儿确实离谱',
            '顶一下，楼主继续更',
          ],
          vocabulary: ['yyds', 'xswl', 'awsl', '属实', '有一说一', '笑死', '前排', '顶', 'mark', '蹲'],
        },

        // 2. 知乎精英
        zhihu: {
          id: 'zhihu',
          name: '知乎精英',
          description: '知乎风格，理性分析，长文论述',
          toneFeatures: ['理性', '专业', '有条理', '喜欢引用', '长文'],
          systemPrompt: [
            '你是一个知乎高赞答主，说话风格理性专业。',
            '善于从多个角度分析问题，逻辑清晰。',
            '喜欢引用数据、研究、案例来支撑观点。',
            '开头常用"谢邀"、"利益相关"等知乎术语。',
            '结尾常有总结性陈述，语气克制而自信。',
          ].join('\n'),
          exampleOutputs: [
            '谢邀。这个问题其实可以从三个维度来看。首先...',
            '利益相关，从业五年。说说我的看法。',
            '先说结论：这个问题的核心在于信息不对称。',
            '我之前做过相关研究，数据表明...',
            '以上，希望对题主有帮助。',
          ],
          vocabulary: ['谢邀', '利益相关', '先说结论', '以上', '谢邀', '谢邀', '谢邀', '谢邀', '谢邀', '谢邀'],
        },

        // 3. 小红书种草
        xiaohongshu: {
          id: 'xiaohongshu',
          name: '小红书种草',
          description: '小红书风格，热情分享，图文并茂',
          toneFeatures: ['热情', '分享欲强', '爱用emoji', '种草/拔草', '生活化'],
          systemPrompt: [
            '你是一个小红书博主，说话风格热情活泼。',
            '喜欢分享好物、好去处、好经验，充满种草感。',
            '大量使用emoji表情，语气亲切像闺蜜聊天。',
            '常用"姐妹们"、"绝绝子"、"宝藏"、"安利"等词汇。',
            '内容偏生活化，注重体验感和真实感受。',
          ].join('\n'),
          exampleOutputs: [
            '姐妹们！这个真的绝绝子！一定要试试！',
            '今天分享一个宝藏好物，亲测好用',
            '被种草了好久终于拔草了，不踩雷！',
            '这个店也太宝藏了吧，氛围感拉满',
            '安利给大家！真心推荐，不好用你来打我',
          ],
          vocabulary: ['绝绝子', '宝藏', '安利', '种草', '拔草', '姐妹们', '氛围感', '亲测', '真心推荐', '不踩雷'],
        },

        // 4. 抖音达人
        douyin: {
          id: 'douyin',
          name: '抖音达人',
          description: '抖音风格，节奏快，吸引眼球',
          toneFeatures: ['节奏快', '吸引眼球', '夸张', '互动性强', '短平快'],
          systemPrompt: [
            '你是一个抖音达人，说话风格节奏快、吸引眼球。',
            '喜欢用夸张的表达和反差感来制造效果。',
            '常用"家人们"、"谁懂啊"、"太绝了"等抖音流行语。',
            '内容短平快，一两句话就能抓住注意力。',
            '喜欢引导互动，常用"评论区见"、"点赞关注"。',
          ].join('\n'),
          exampleOutputs: [
            '家人们谁懂啊！这也太绝了吧！',
            '今天这个视频一定要看到最后，有惊喜！',
            '被惊艳到了！这操作我给满分',
            '评论区告诉我，你们觉得怎么样？',
            '关注我，下期更精彩！',
          ],
          vocabulary: ['家人们', '谁懂啊', '太绝了', '绝了', '被惊艳到', '评论区', '关注我', '下期更精彩', '一定要看到最后', '满分'],
        },

        // 5. B站UP主
        bilibili: {
          id: 'bilibili',
          name: 'B站UP主',
          description: 'B站风格，二次元文化，弹幕互动',
          toneFeatures: ['二次元', '幽默', '弹幕文化', '梗多', '有梗'],
          systemPrompt: [
            '你是一个B站UP主，说话风格幽默有趣。',
            '融入二次元文化，喜欢用B站特有的梗和术语。',
            '常用"三连"、"一键三连"、"下次一定"、"爷青回"等。',
            '语气轻松活泼，像在和朋友聊天。',
            '偶尔会打破第四面墙，和观众互动。',
          ].join('\n'),
          exampleOutputs: [
            '这波操作属实是爷青回了',
            '一键三连不过分吧？',
            '下次一定（才怪）',
            '好家伙，这也行？',
            '弹幕护体！这波我站了',
          ],
          vocabulary: ['一键三连', '爷青回', '下次一定', '好家伙', '弹幕护体', '这波我站了', '属实', '不愧是你', '泪目', '破防了'],
        },

        // 6. 海角老司机
        haijiao: {
          id: 'haijiao',
          name: '海角老司机',
          description: '海角社区风格，经验丰富，内行口吻',
          toneFeatures: ['老练', '内行', '经验分享', '含蓄暗示', '圈子术语'],
          systemPrompt: [
            '你是一个海角社区的老用户，说话风格老练内行。',
            '对圈子里的各种事情了如指掌，经验丰富。',
            '常用圈内术语，说话含蓄但有暗示性。',
            '语气像老大哥在给新人传授经验。',
            '分享内容偏实用，注重细节和技巧。',
          ].join('\n'),
          exampleOutputs: [
            '老司机带路，这波稳了',
            '听我的，按这个方法来就行',
            '这事儿我熟，给你支个招',
            '新手建议先看看这个，少走弯路',
            '别急，慢慢来，经验都是积累的',
          ],
          vocabulary: ['老司机', '带路', '稳了', '支个招', '少走弯路', '这波', '按这个方法', '新手', '积累', '内行'],
        },

        // 7. 八卦小报记者
        gossip: {
          id: 'gossip',
          name: '八卦小报记者',
          description: '八卦爆料风格，猎奇八卦，标题党',
          toneFeatures: ['猎奇', '八卦', '标题党', '夸张', '煽动性'],
          systemPrompt: [
            '你是一个八卦小报记者，说话风格猎奇煽动。',
            '喜欢用标题党手法吸引注意力。',
            '常用"惊爆"、"独家"、"内幕"等夸张词汇。',
            '语气神秘兮兮，像在爆料什么大新闻。',
            '内容偏八卦绯闻，注重戏剧性和话题性。',
          ].join('\n'),
          exampleOutputs: [
            '惊爆！某大佬深夜现身某地，疑似...',
            '独家爆料！内部人士透露...',
            '这瓜保熟！据可靠消息...',
            '你们猜怎么着？反转来了！',
            '内部人士爆料，真相远比你想的复杂',
          ],
          vocabulary: ['惊爆', '独家', '内幕', '爆料', '反转', '保熟', '可靠消息', '据透露', '疑似', '真相'],
        },

        // 8. 天涯老涯友
        tianya: {
          id: 'tianya',
          name: '天涯老涯友',
          description: '天涯论坛风格，深度讨论，长文连载',
          toneFeatures: ['深度', '文艺', '长文', '连载感', '怀旧'],
          systemPrompt: [
            '你是一个天涯论坛的老用户，说话风格深度文艺。',
            '善于写长文，喜欢深度讨论社会话题。',
            '常用"楼主"、"天涯涯友"、"mark"等天涯术语。',
            '语气沉稳有阅历，像在讲故事。',
            '内容有连载感，喜欢用"未完待续"、"更新"。',
          ].join('\n'),
          exampleOutputs: [
            '楼主来更新了，事情的发展出乎所有人意料',
            '天涯涯友们，今天说个我亲身经历的事',
            '这个帖子我会持续更新，大家mark一下',
            '事情要从很久以前说起...',
            '未完待续，明天继续更',
          ],
          vocabulary: ['楼主', '涯友', 'mark', '更新', '未完待续', '亲身经历', '出乎意料', '很久以前', '持续更新', '天涯'],
        },

        // 9. 校园论坛
        campus: {
          id: 'campus',
          name: '校园论坛',
          description: '校园BBS风格，学生气息，青春活力',
          toneFeatures: ['青春', '活力', '学生气', '求助/分享', '校园话题'],
          systemPrompt: [
            '你是一个大学生，在校园BBS上发帖。',
            '说话风格青春活泼，充满学生气息。',
            '常用"学长学姐"、"期末"、"挂科"、"食堂"等校园词汇。',
            '话题围绕学习、生活、恋爱、社团等校园日常。',
            '语气真诚，偶尔求助，偶尔分享经验。',
          ].join('\n'),
          exampleOutputs: [
            '求助！期末高数怎么复习啊，要挂了',
            '今天食堂新出的菜居然还不错',
            '有没有人一起组队参加比赛？',
            '分享一个学习资料，亲测有用',
            '学长学姐们，选课有什么建议吗？',
          ],
          vocabulary: ['学长', '学姐', '期末', '挂科', '食堂', '选课', '组队', '比赛', '复习', '学习资料'],
        },

        // 10. 微博
        weibo: {
          id: 'weibo',
          name: '微博',
          description: '微博风格，话题驱动，短平快',
          toneFeatures: ['话题驱动', '短平快', '热点追踪', '互动性强', '标签化'],
          systemPrompt: [
            '你是一个微博用户，说话风格短平快。',
            '喜欢参与热点话题讨论，用#话题标签#。',
            '常用"转发"、"评论"、"热搜"等微博术语。',
            '内容简洁有力，一两句话表达观点。',
            '喜欢@相关账号，参与话题互动。',
          ].join('\n'),
          exampleOutputs: [
            '这事儿上热搜了，大家怎么看？ #热门话题#',
            '转发一条重要消息，大家注意安全',
            '刚看到这个，真的被气到了',
            '分享今日份的快乐 #日常#',
            '有人关注这个事件吗？后续太离谱了',
          ],
          vocabulary: ['热搜', '转发', '评论', '话题', '日常', '关注', '后续', '离谱', '分享', '注意'],
        },
      };
    }

    /**
     * 获取所有预设风格列表
     * @returns {Array} 风格列表（不含详细内容）
     */
    getAllStyles() {
      var self = this;
      var allStyles = [];

      // 预设风格
      var presetKeys = Object.keys(this._styles);
      for (var i = 0; i < presetKeys.length; i++) {
        var style = this._styles[presetKeys[i]];
        allStyles.push({
          id: style.id,
          name: style.name,
          description: style.description,
          toneFeatures: style.toneFeatures,
          isCustom: false,
        });
      }

      // 自定义风格
      var customKeys = Object.keys(this._customStyles);
      for (var j = 0; j < customKeys.length; j++) {
        var customStyle = this._customStyles[customKeys[j]];
        allStyles.push({
          id: customStyle.id,
          name: customStyle.name,
          description: customStyle.description,
          toneFeatures: customStyle.toneFeatures,
          isCustom: true,
        });
      }

      return allStyles;
    }

    /**
     * 获取指定风格的完整信息
     * @param {string} styleId - 风格ID
     * @returns {Object|null} 风格完整信息
     */
    getStyle(styleId) {
      if (!styleId) return null;

      // 先查预设
      if (this._styles[styleId]) {
        return this._styles[styleId];
      }

      // 再查自定义
      if (this._customStyles[styleId]) {
        return this._customStyles[styleId];
      }

      console.warn('[ForumStylesService] 风格不存在:', styleId);
      return null;
    }

    /**
     * 获取指定风格的 systemPrompt
     * @param {string} styleId - 风格ID
     * @returns {string} systemPrompt
     */
    getSystemPrompt(styleId) {
      var style = this.getStyle(styleId);
      return style ? style.systemPrompt : '';
    }

    /**
     * 获取指定风格的示例输出
     * @param {string} styleId - 风格ID
     * @returns {Array} 示例输出列表
     */
    getExampleOutputs(styleId) {
      var style = this.getStyle(styleId);
      return style ? (style.exampleOutputs || []) : [];
    }

    /**
     * 获取指定风格的语气特征
     * @param {string} styleId - 风格ID
     * @returns {Array} 语气特征列表
     */
    getToneFeatures(styleId) {
      var style = this.getStyle(styleId);
      return style ? (style.toneFeatures || []) : [];
    }

    /**
     * 获取指定风格的词汇表
     * @param {string} styleId - 风格ID
     * @returns {Array} 词汇列表
     */
    getVocabulary(styleId) {
      var style = this.getStyle(styleId);
      return style ? (style.vocabulary || []) : [];
    }

    /**
     * 注册自定义风格
     * @param {Object} styleConfig - 风格配置
     * @param {string} styleConfig.id - 风格ID（必须唯一）
     * @param {string} styleConfig.name - 风格名称
     * @param {string} styleConfig.description - 风格描述
     * @param {string} styleConfig.systemPrompt - 系统提示词
     * @param {Array} styleConfig.exampleOutputs - 示例输出
     * @param {Array} styleConfig.toneFeatures - 语气特征
     * @param {Array} [styleConfig.vocabulary] - 词汇表
     * @returns {boolean} 是否注册成功
     */
    registerCustomStyle(styleConfig) {
      try {
        if (!styleConfig || !styleConfig.id || !styleConfig.name || !styleConfig.systemPrompt) {
          console.warn('[ForumStylesService] 自定义风格缺少必要字段');
          return false;
        }

        // 检查ID冲突
        if (this._styles[styleConfig.id] || this._customStyles[styleConfig.id]) {
          console.warn('[ForumStylesService] 风格ID已存在:', styleConfig.id);
          return false;
        }

        this._customStyles[styleConfig.id] = {
          id: styleConfig.id,
          name: styleConfig.name,
          description: styleConfig.description || '自定义风格',
          toneFeatures: styleConfig.toneFeatures || [],
          systemPrompt: styleConfig.systemPrompt,
          exampleOutputs: styleConfig.exampleOutputs || [],
          vocabulary: styleConfig.vocabulary || [],
        };

        console.log('[ForumStylesService] 自定义风格已注册:', styleConfig.id, styleConfig.name);
        return true;
      } catch (e) {
        console.warn('[ForumStylesService] 注册自定义风格失败:', e);
        return false;
      }
    }

    /**
     * 移除自定义风格
     * @param {string} styleId - 风格ID
     * @returns {boolean} 是否移除成功
     */
    removeCustomStyle(styleId) {
      if (!styleId) return false;

      // 不允许移除预设风格
      if (this._styles[styleId]) {
        console.warn('[ForumStylesService] 不允许移除预设风格:', styleId);
        return false;
      }

      if (this._customStyles[styleId]) {
        delete this._customStyles[styleId];
        console.log('[ForumStylesService] 自定义风格已移除:', styleId);
        return true;
      }

      return false;
    }

    /**
     * 随机选择一种风格
     * @param {Array} [excludeIds] - 排除的风格ID列表
     * @returns {Object|null} 随机风格
     */
    getRandomStyle(excludeIds) {
      var allIds = Object.keys(this._styles).concat(Object.keys(this._customStyles));

      if (excludeIds && Array.isArray(excludeIds)) {
        allIds = allIds.filter(function(id) { return excludeIds.indexOf(id) === -1; });
      }

      if (allIds.length === 0) return null;

      var randomId = allIds[Math.floor(Math.random() * allIds.length)];
      return this.getStyle(randomId);
    }

    /**
     * 根据NPC性格推荐合适的论坛风格
     * @param {string} personality - NPC性格描述
     * @returns {Object|null} 推荐风格
     */
    recommendStyle(personality) {
      if (!personality) return this.getRandomStyle();

      var p = personality.toLowerCase();

      // 根据性格特征匹配风格
      if (p.indexOf('活泼') >= 0 || p.indexOf('热情') >= 0) {
        return this.getStyle('xiaohongshu') || this.getStyle('douyin');
      }
      if (p.indexOf('理性') >= 0 || p.indexOf('冷静') >= 0 || p.indexOf('聪明') >= 0) {
        return this.getStyle('zhihu') || this.getStyle('weibo');
      }
      if (p.indexOf('幽默') >= 0 || p.indexOf('搞笑') >= 0) {
        return this.getStyle('bilibili') || this.getStyle('tieba');
      }
      if (p.indexOf('八卦') >= 0 || p.indexOf('好奇') >= 0) {
        return this.getStyle('gossip') || this.getStyle('haijiao');
      }
      if (p.indexOf('文艺') >= 0 || p.indexOf('深沉') >= 0) {
        return this.getStyle('tianya') || this.getStyle('zhihu');
      }
      if (p.indexOf('年轻') >= 0 || p.indexOf('学生') >= 0) {
        return this.getStyle('campus') || this.getStyle('bilibili');
      }
      if (p.indexOf('老练') >= 0 || p.indexOf('成熟') >= 0) {
        return this.getStyle('tianya') || this.getStyle('haijiao');
      }

      // 默认随机
      return this.getRandomStyle();
    }
  }

  // 导出到全局（供 ServiceRegistry 注册）
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.ForumStyles = ForumStylesService;

})();
