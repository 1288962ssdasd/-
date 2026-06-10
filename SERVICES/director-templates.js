/**
 * @layer Service
 * @file   director-templates.js
 * @description 导演系统模板库 - F-06 配置外部化
 *
 * 铁则合规：
 * - 铁则六：配置在入口处加载，业务代码无感知
 * - 纯数据文件，无业务逻辑
 */

;(function () {
  'use strict';

  window.DirectorTemplates = {
    // NPC 消息模板（按性格分类）
    npcMessages: {
      '活泼': [
        '{name}：哈哈哈你猜我今天遇到什么事了！',
        '{name}：在吗在吗！有好东西给你看',
        '{name}：快出来玩啊，今天天气超好！',
        '{name}：我刚吃到一家超好吃的店，下次带你去',
        '{name}：无聊死了，陪我聊会儿嘛',
      ],
      '安静': [
        '{name}：...在吗',
        '{name}：最近还好吗',
        '{name}：有件事想跟你说',
        '{name}：方便的话，回个消息',
      ],
      '冷淡': [
        '{name}：有事找你',
        '{name}：那个事情怎么样了',
        '{name}：嗯',
      ],
      'default': [
        '{name}：最近怎么样？',
        '{name}：有空聊聊吗？',
        '{name}：我发现了一件有趣的事',
        '{name}：好久不见，最近忙什么',
        '{name}：你在干嘛呢',
        '{name}：跟你说个事',
      ]
    },

    // NPC 朋友圈模板（按性格分类）
    npcMoments: {
      '活泼': [
        '{name} 发布了动态：今天和朋友去了新开的奶茶店，推荐他们家的杨枝甘露！超好喝！',
        '{name} 发布了动态：周末去爬山了，累成狗但是风景绝了！附上自拍',
        '{name} 发布了动态：终于把那本书看完了，强烈推荐！',
        '{name} 发布了动态：今天的晚霞好美，随手拍了一张',
        '{name} 发布了动态：新买的耳机到了，音质绝绝子',
      ],
      '安静': [
        '{name} 发布了动态：[图片]',
        '{name} 发布了动态：今天的天空',
        '{name} 发布了一张照片',
      ],
      'default': [
        '{name} 发布了动态：今天天气真好',
        '{name} 发布了动态：工作累了，休息一下',
        '{name} 发布了动态：发现了一家不错的店',
        '{name} 发布了动态：心情不错~',
        '{name} 发布了动态：又是平凡的一天',
        '{name} 发布了动态：晚安',
      ]
    },

    // 新闻模板
    newsTemplates: [
      '{worldName}今日天气晴朗，适合外出',
      '市中心新开了一家网红咖啡馆',
      '最近股市波动较大，投资者需谨慎',
      '{worldName}的夜景被评为最佳约会地点',
    ],

    // 性格关键词映射
    personalityMap: {
      '活泼': ['活泼', '外向', '开朗'],
      '安静': ['安静', '内向'],
      '冷淡': ['冷淡', '傲娇'],
    },

    /**
     * 根据性格获取匹配的模板池
     * @param {string} personality - NPC 性格描述
     * @param {string} type - 'message' 或 'moment'
     * @returns {Array}
     */
    getPool(personality, type) {
      const templates = type === 'moment' ? this.npcMoments : this.npcMessages;
      for (const [key, keywords] of Object.entries(this.personalityMap)) {
        if (keywords.some(kw => personality.includes(kw))) {
          return templates[key] || templates['default'];
        }
      }
      return templates['default'];
    },

    /**
     * 从模板池随机选择一条并替换占位符
     * @param {Object} vars - { name, worldName }
     * @param {Array} pool - 模板池
     * @returns {string}
     */
    fill(vars, pool) {
      const template = pool[Math.floor(Math.random() * pool.length)];
      return template
        .replace(/\{name\}/g, vars.name || '某人')
        .replace(/\{worldName\}/g, vars.worldName || '这个世界');
    }
  };

  console.log('[Service] DirectorTemplates 已加载');
})();
