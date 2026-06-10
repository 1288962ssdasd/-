/**
 * Phone Schemas - 手机模拟器数据 Schema 定义
 *
 * 定义每个领域的完整数据结构，包括：
 * - 字段类型
 * - 默认值
 * - 验证规则
 * - 索引配置
 */

;(function () {
  'use strict';

  // ==================== Schema 工具 ====================

  const Types = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
  };

  /**
   * 创建字段定义
   */
  function field(type, options = {}) {
    return {
      type,
      required: options.required || false,
      default: options.default,
      validate: options.validate,
      index: options.index || false,
      min: options.min,
      max: options.max,
      items: options.items, // for array
      properties: options.properties, // for object
    };
  }

  // ==================== 好友领域 ====================

  const FRIEND_SCHEMA = {
    // 好友列表
    list: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          name: field(Types.STRING, { required: true }),
          avatar: field(Types.STRING, { default: '' }),
          isGroup: field(Types.BOOLEAN, { default: false }),
          members: field(Types.ARRAY, { default: [] }), // 群成员ID列表
          lastMessage: field(Types.STRING, { default: '' }),
          lastTime: field(Types.STRING, { default: '' }),
          unread: field(Types.NUMBER, { default: 0, min: 0 }),
          createdAt: field(Types.NUMBER, { default: () => Date.now() }),
          updatedAt: field(Types.NUMBER, { default: () => Date.now() }),
        },
      },
      default: [],
    },

    // 好友请求列表
    requests: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true }),
          name: field(Types.STRING, { required: true }),
          status: field(Types.STRING, { default: 'pending' }), // pending | accepted | rejected
          createdAt: field(Types.NUMBER, { default: () => Date.now() }),
        },
      },
      default: [],
    },
  };

  // ==================== 消息领域 ====================

  const MESSAGE_SCHEMA = {
    // 所有消息 { [friendId]: Message[] }
    all: {
      type: Types.OBJECT,
      properties: {},
      default: {},
    },

    // 消息列表（按好友ID索引）
    list: {
      type: Types.ARRAY,
      default: [],
    },

    // 待发送队列（用于ST循环任务读取）
    pending: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true }),
          friendId: field(Types.STRING, { required: true }),
          friendName: field(Types.STRING, { required: true }),
          text: field(Types.STRING, { required: true }),
          timestamp: field(Types.NUMBER, { required: true }),
          status: field(Types.STRING, { default: 'pending' }), // pending | sent | failed
        },
      },
      default: [],
    },

    // 最后同步时间
    lastSync: {
      type: Types.NUMBER,
      default: 0,
    },
  };

  // ==================== 聊天UI状态领域 ====================

  const CHAT_UI_SCHEMA = {
    // 当前视图
    currentView: {
      type: Types.STRING,
      default: 'list', // list | addFriend | messageDetail
    },

    // 当前主标签
    currentMainTab: {
      type: Types.STRING,
      default: 'friends', // friends | circle
    },

    // 当前子标签
    currentSubTab: {
      type: Types.STRING,
      default: 'add', // add | delete | createGroup | deleteGroup
    },

    // 当前聊天对象
    currentFriendId: {
      type: Types.STRING,
      default: null,
    },

    currentFriendName: {
      type: Types.STRING,
      default: null,
    },

    // 输入框草稿 { [friendId]: text }
    drafts: {
      type: Types.OBJECT,
      default: {},
    },
  };

  // ==================== 朋友圈领域 ====================

  const FRIENDS_CIRCLE_SCHEMA = {
    // 朋友圈动态
    circles: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          authorId: field(Types.STRING, { required: true }),
          authorName: field(Types.STRING, { required: true }),
          authorAvatar: field(Types.STRING, { default: '' }),
          content: field(Types.STRING, { required: true }),
          images: field(Types.ARRAY, { default: [] }),
          likes: field(Types.ARRAY, { default: [] }),
          comments: field(Types.ARRAY, { default: [] }),
          createdAt: field(Types.NUMBER, { required: true }),
        },
      },
      default: [],
    },

    // 我的发布
    myCircles: {
      type: Types.ARRAY,
      default: [],
    },
  };

  // ==================== 商店领域 ====================

  const SHOP_SCHEMA = {
    // 商品列表
    items: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          name: field(Types.STRING, { required: true }),
          description: field(Types.STRING, { default: '' }),
          price: field(Types.NUMBER, { required: true, min: 0 }),
          image: field(Types.STRING, { default: '' }),
          category: field(Types.STRING, { default: 'other' }),
          stock: field(Types.NUMBER, { default: -1 }), // -1 表示无限
          owned: field(Types.BOOLEAN, { default: false }),
        },
      },
      default: [],
    },

    // 购买记录
    purchases: {
      type: Types.ARRAY,
      default: [],
    },
  };

  // ==================== 背包领域 ====================

  const BACKPACK_SCHEMA = {
    // 物品列表
    items: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          name: field(Types.STRING, { required: true }),
          description: field(Types.STRING, { default: '' }),
          type: field(Types.STRING, { default: 'item' }), // item | equipment | consumable
          quantity: field(Types.NUMBER, { default: 1, min: 0 }),
          icon: field(Types.STRING, { default: '' }),
          rarity: field(Types.STRING, { default: 'common' }), // common | rare | epic | legendary
          effects: field(Types.OBJECT, { default: {} }),
        },
      },
      default: [],
    },

    // 容量上限
    capacity: {
      type: Types.NUMBER,
      default: 100,
    },
  };

  // ==================== 任务领域 ====================

  const QUEST_SCHEMA = {
    // 任务列表
    quests: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          title: field(Types.STRING, { required: true }),
          description: field(Types.STRING, { default: '' }),
          type: field(Types.STRING, { default: 'main' }), // main | side | daily
          status: field(Types.STRING, { default: 'available' }), // available | active | completed | failed
          objectives: field(Types.ARRAY, { default: [] }),
          rewards: field(Types.OBJECT, { default: {} }),
          progress: field(Types.NUMBER, { default: 0 }),
          maxProgress: field(Types.NUMBER, { default: 1 }),
        },
      },
      default: [],
    },

    // 已完成任务ID
    completedIds: {
      type: Types.ARRAY,
      default: [],
    },
  };

  // ==================== 日记领域 ====================

  const DIARY_SCHEMA = {
    // 日记条目
    entries: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          date: field(Types.STRING, { required: true }), // YYYY-MM-DD
          title: field(Types.STRING, { default: '' }),
          content: field(Types.STRING, { required: true }),
          mood: field(Types.STRING, { default: 'normal' }),
          tags: field(Types.ARRAY, { default: [] }),
          createdAt: field(Types.NUMBER, { required: true }),
          updatedAt: field(Types.NUMBER, { required: true }),
        },
      },
      default: [],
    },
  };

  // ==================== 状态领域 ====================

  const STATUS_SCHEMA = {
    // 用户状态
    user: {
      type: Types.OBJECT,
      properties: {
        name: field(Types.STRING, { default: '用户' }),
        level: field(Types.NUMBER, { default: 1, min: 1 }),
        exp: field(Types.NUMBER, { default: 0, min: 0 }),
        hp: field(Types.NUMBER, { default: 100, min: 0 }),
        maxHp: field(Types.NUMBER, { default: 100 }),
        mp: field(Types.NUMBER, { default: 50, min: 0 }),
        maxMp: field(Types.NUMBER, { default: 50 }),
        gold: field(Types.NUMBER, { default: 0, min: 0 }),
        gems: field(Types.NUMBER, { default: 0, min: 0 }),
      },
      default: {},
    },

    // 成就
    achievements: {
      type: Types.ARRAY,
      default: [],
    },

    // 统计
    stats: {
      type: Types.OBJECT,
      properties: {
        messagesSent: field(Types.NUMBER, { default: 0 }),
        friendsAdded: field(Types.NUMBER, { default: 0 }),
        questsCompleted: field(Types.NUMBER, { default: 0 }),
        itemsCollected: field(Types.NUMBER, { default: 0 }),
      },
      default: {},
    },
  };

  // ==================== 直播领域 ====================

  const LIVE_SCHEMA = {
    // 直播列表
    streams: {
      type: Types.ARRAY,
      items: {
        type: Types.OBJECT,
        properties: {
          id: field(Types.STRING, { required: true, index: true }),
          streamerId: field(Types.STRING, { required: true }),
          streamerName: field(Types.STRING, { required: true }),
          streamerAvatar: field(Types.STRING, { default: '' }),
          title: field(Types.STRING, { default: '' }),
          viewers: field(Types.NUMBER, { default: 0 }),
          isLive: field(Types.BOOLEAN, { default: true }),
          startedAt: field(Types.NUMBER, { required: true }),
        },
      },
      default: [],
    },

    // 观看历史
    history: {
      type: Types.ARRAY,
      default: [],
    },
  };

  // ==================== 设置领域 ====================

  const SETTINGS_SCHEMA = {
    // 通知设置
    notifications: {
      type: Types.OBJECT,
      properties: {
        enabled: field(Types.BOOLEAN, { default: true }),
        sound: field(Types.BOOLEAN, { default: true }),
        vibration: field(Types.BOOLEAN, { default: true }),
      },
      default: {},
    },

    // 显示设置
    display: {
      type: Types.OBJECT,
      properties: {
        theme: field(Types.STRING, { default: 'auto' }), // light | dark | auto
        fontSize: field(Types.STRING, { default: 'medium' }), // small | medium | large
        language: field(Types.STRING, { default: 'zh-CN' }),
      },
      default: {},
    },

    // 隐私设置
    privacy: {
      type: Types.OBJECT,
      properties: {
        showOnline: field(Types.BOOLEAN, { default: true }),
        showLastSeen: field(Types.BOOLEAN, { default: true }),
      },
      default: {},
    },
  };

  // ==================== 导出 ====================

  window.PhoneSchemas = {
    Types,
    field,

    friends: FRIEND_SCHEMA,
    messages: MESSAGE_SCHEMA,
    chatUi: CHAT_UI_SCHEMA,
    friendsCircle: FRIENDS_CIRCLE_SCHEMA,
    shop: SHOP_SCHEMA,
    backpack: BACKPACK_SCHEMA,
    quest: QUEST_SCHEMA,
    diary: DIARY_SCHEMA,
    status: STATUS_SCHEMA,
    live: LIVE_SCHEMA,
    settings: SETTINGS_SCHEMA,

    // 获取所有领域配置（用于 Platform 初始化）
    getAllDomainConfigs() {
      return [
        { name: 'friends', schema: FRIEND_SCHEMA, persist: true, debounceTime: 200, retention: { max: 500 } },
        { name: 'messages', schema: MESSAGE_SCHEMA, persist: true, debounceTime: 500, retention: { max: 200, maxAge: 7 * 24 * 3600 * 1000 } },
        { name: 'chatUi', schema: CHAT_UI_SCHEMA, persist: true, debounceTime: 100 },
        { name: 'friendsCircle', schema: FRIENDS_CIRCLE_SCHEMA, persist: true, debounceTime: 300, retention: { max: 100 } },
        { name: 'shop', schema: SHOP_SCHEMA, persist: true, debounceTime: 300 },
        { name: 'backpack', schema: BACKPACK_SCHEMA, persist: true, debounceTime: 300 },
        { name: 'quest', schema: QUEST_SCHEMA, persist: true, debounceTime: 300 },
        { name: 'diary', schema: DIARY_SCHEMA, persist: true, debounceTime: 500 },
        { name: 'status', schema: STATUS_SCHEMA, persist: true, debounceTime: 200 },
        { name: 'live', schema: LIVE_SCHEMA, persist: true, debounceTime: 1000 },
        { name: 'settings', schema: SETTINGS_SCHEMA, persist: true, debounceTime: 100 },
      ];
    },

    // 验证数据
    validate(domain, key, value) {
      const schema = this[domain]?.[key];
      if (!schema) return { valid: true };

      // 简单类型检查
      if (schema.type && typeof value !== schema.type) {
        return { valid: false, error: `Expected ${schema.type}, got ${typeof value}` };
      }

      // 数组长度检查
      if (schema.type === Types.ARRAY && schema.min !== undefined && value.length < schema.min) {
        return { valid: false, error: `Array length must be >= ${schema.min}` };
      }
      if (schema.type === Types.ARRAY && schema.max !== undefined && value.length > schema.max) {
        return { valid: false, error: `Array length must be <= ${schema.max}` };
      }

      // 数字范围检查
      if (schema.type === Types.NUMBER) {
        if (schema.min !== undefined && value < schema.min) {
          return { valid: false, error: `Value must be >= ${schema.min}` };
        }
        if (schema.max !== undefined && value > schema.max) {
          return { valid: false, error: `Value must be <= ${schema.max}` };
        }
      }

      // 自定义验证
      if (schema.validate && typeof schema.validate === 'function') {
        const result = schema.validate(value);
        if (result !== true) {
          return { valid: false, error: result };
        }
      }

      return { valid: true };
    },

    // 获取默认值
    getDefaultValue(domain, key) {
      const schema = this[domain]?.[key];
      if (!schema) return undefined;

      if (schema.default === undefined) return undefined;
      if (typeof schema.default === 'function') return schema.default();
      return JSON.parse(JSON.stringify(schema.default)); // 深拷贝
    },
  };

  console.log('[PhoneSchemas] Schema 定义已加载');
})();
