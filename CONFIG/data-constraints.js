/**
 * data-constraints.js - 数据约束声明式定义
 * 
 * 铁则体系扩展：数据约束清单
 * - 定义各域数据的结构、类型、约束规则
 * - 支持运行时验证和开发时类型检查
 * - 违规时发射 data:constraintViolation 事件
 * 
 * @version 4.31.0
 * @author AI数据修复工程师
 */

;(function () {
  'use strict';

  /**
   * 约束类型枚举
   */
  var ConstraintType = {
    TYPE: 'type',           // 类型检查
    REQUIRED: 'required',   // 必填检查
    MIN: 'min',             // 最小值
    MAX: 'max',             // 最大值
    PATTERN: 'pattern',     // 正则模式
    ENUM: 'enum',           // 枚举值
    REF: 'ref',             // 引用完整性
    CUSTOM: 'custom',       // 自定义验证函数
  };

  /**
   * 数据约束定义
   * 格式: 'domain.key' -> 约束规则
   */
  var DATA_CONSTRAINTS = {
    // ==================== 消息域 ====================
    'messages.all': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true, pattern: /^msg_\w+$/ },
          senderId: { type: 'string', required: true },
          receiverId: { type: 'string' },
          content: { type: 'string', required: true, maxLength: 5000 },
          type: { 
            type: 'string', 
            enum: ['text', 'image', 'voice', 'redpacket', 'transfer', 'sticker', 'video', 'location', 'file', 'system']
          },
          timestamp: { type: 'number', required: true, min: 0 },
          read: { type: 'boolean' },
        }
      }
    },

    // ==================== 好友域 ====================
    'friends.list': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true, minLength: 1, maxLength: 50 },
          avatar: { type: 'string' },
          status: { type: 'string', enum: ['online', 'offline', 'busy', 'away'] },
          relationship: { type: 'number', min: -100, max: 100 },
        }
      }
    },

    'friends.requests': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          fromId: { type: 'string', required: true },
          toId: { type: 'string', required: true },
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
          timestamp: { type: 'number', required: true },
        }
      }
    },

    // ==================== 经济域 ====================
    'economy.wallet': {
      type: 'object',
      properties: {
        gold: { type: 'number', min: 0, max: 999999999, default: 0 },
        diamond: { type: 'number', min: 0, max: 999999, default: 0 },
        credit: { type: 'number', min: -10000, max: 100000, default: 0 },
      }
    },

    'economy.transactions': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          type: { 
            type: 'string', 
            enum: ['income', 'expense', 'transfer_in', 'transfer_out', 'quest_reward', 'shop_purchase', 'stock_buy', 'stock_sell', 'npc_gift', 'npc_red_packet']
          },
          amount: { type: 'number', required: true },
          currency: { type: 'string', enum: ['gold', 'diamond', 'credit'] },
          timestamp: { type: 'number', required: true },
          description: { type: 'string', maxLength: 200 },
        }
      }
    },

    // ==================== 任务域 ====================
    'quest.registry': {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true, maxLength: 100 },
          description: { type: 'string', maxLength: 1000 },
          status: { 
            type: 'string', 
            enum: ['locked', 'available', 'active', 'reward', 'completed', 'failed'],
            required: true
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', required: true },
                description: { type: 'string', required: true },
                completed: { type: 'boolean' },
              }
            }
          },
          rewards: {
            type: 'object',
            properties: {
              gold: { type: 'number', min: 0 },
              diamond: { type: 'number', min: 0 },
              items: { type: 'array' },
            }
          },
          deadline: { type: 'number' },
        }
      }
    },

    // ==================== 背包域 ====================
    'backpack.items': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          type: { 
            type: 'string', 
            enum: ['weapon', 'armor', 'accessory', 'consumable', 'material', 'quest', 'misc']
          },
          quantity: { type: 'number', min: 1, default: 1 },
          rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
          equipped: { type: 'boolean' },
        }
      }
    },

    'backpack.equipment': {
      type: 'object',
      properties: {
        head: { type: 'string' },
        body: { type: 'string' },
        hands: { type: 'string' },
        feet: { type: 'string' },
        accessory1: { type: 'string' },
        accessory2: { type: 'string' },
        weapon: { type: 'string' },
      }
    },

    // ==================== 商店域 ====================
    'shop.products': {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            price: { type: 'number', min: 0, required: true },
            currency: { type: 'string', enum: ['gold', 'diamond', 'credit'] },
            category: { type: 'string' },
            stock: { type: 'number', min: -1 },  // -1 表示无限
          }
        }
      }
    },

    'shop.cart': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', required: true },
          quantity: { type: 'number', min: 1, required: true },
        }
      }
    },

    // ==================== 日记域 ====================
    'diary.entries': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          title: { type: 'string', maxLength: 100 },
          content: { type: 'string', maxLength: 10000 },
          mood: { type: 'string', enum: ['normal', 'happy', 'sad', 'angry', 'excited'] },
          weather: { type: 'string', enum: ['sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'foggy'] },
          timestamp: { type: 'number', required: true },
        }
      }
    },

    // ==================== 直播域 ====================
    'live.streams': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          streamerId: { type: 'string' },           // 实际字段名
          streamerName: { type: 'string', required: true, maxLength: 100 },
          streamerAvatar: { type: 'string' },
          title: { type: 'string', maxLength: 100 },
          coverImage: { type: 'string' },
          viewers: { type: 'number', min: 0 },
          isLive: { type: 'boolean' },
          startedAt: { type: 'number' },
          endedAt: { type: 'number' },
          totalGifts: { type: 'number', min: 0 },
          totalGiftValue: { type: 'number', min: 0 },
          // 兼容旧字段名（hostId/hostName 是同义词）
          hostId: { type: 'string' },
          hostName: { type: 'string' },
          status: { type: 'string' },
          viewerCount: { type: 'number', min: 0 },
          startTime: { type: 'number' },
          endTime: { type: 'number' },
        }
      }
    },

    // ==================== 邀约域 ====================
    'invitation.list': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          type: { type: 'string', enum: ['social', 'quest', 'location', 'special'] },
          fromId: { type: 'string', required: true },
          toId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          status: { type: 'string', enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'] },
          expireTime: { type: 'number' },
        }
      }
    },

    // ==================== 股市域 ====================
    'stock.market': {
      type: 'object',
      properties: {
        index: { type: 'number', min: 0 },
        change: { type: 'number' },
        changePercent: { type: 'number' },
        lastUpdate: { type: 'number' },
      }
    },

    'stock.holdings': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string', required: true },
          shares: { type: 'number', min: 0, required: true },
          avgCost: { type: 'number', min: 0 },
        }
      }
    },

    // ==================== 状态域 ====================
    'status.user': {
      type: 'object',
      properties: {
        mood: { type: 'string', enum: ['happy', 'sad', 'angry', 'calm', 'excited', 'tired'] },
        location: { type: 'string' },
        activity: { type: 'string' },
        outfit: { type: 'object' },
      }
    },

    'status.npcs': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          mood: { type: 'string' },
          location: { type: 'string' },
          activity: { type: 'string' },
        }
      }
    },

    // ==================== API配置域 ====================
    'apiConfig.mainConfig': {
      type: 'object',
      properties: {
        apiEndpoint: { type: 'string', pattern: /^https?:\/\/.+/ },
        apiKey: { type: 'string' },
        model: { type: 'string' },
        maxTokens: { type: 'number', min: 1, max: 32000 },
        temperature: { type: 'number', min: 0, max: 2 },
      }
    },
  };

  /**
   * 数据约束验证器
   */
  var DataConstraintValidator = {
    /**
     * 验证单个值
     * @param {*} value - 要验证的值
     * @param {Object} constraints - 约束规则
     * @param {string} path - 数据路径（用于错误消息）
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateValue: function (value, constraints, path) {
      var errors = [];

      // 类型检查
      if (constraints.type && !this._checkType(value, constraints.type)) {
        errors.push(path + ': 期望类型 ' + constraints.type + '，实际为 ' + typeof value);
      }

      // 必填检查
      if (constraints.required && (value === undefined || value === null)) {
        errors.push(path + ': 必填字段缺失');
      }

      // 最小值
      if (constraints.min !== undefined && typeof value === 'number' && value < constraints.min) {
        errors.push(path + ': 值 ' + value + ' 小于最小值 ' + constraints.min);
      }

      // 最大值
      if (constraints.max !== undefined && typeof value === 'number' && value > constraints.max) {
        errors.push(path + ': 值 ' + value + ' 大于最大值 ' + constraints.max);
      }

      // 最小长度
      if (constraints.minLength !== undefined && typeof value === 'string' && value.length < constraints.minLength) {
        errors.push(path + ': 长度 ' + value.length + ' 小于最小长度 ' + constraints.minLength);
      }

      // 最大长度
      if (constraints.maxLength !== undefined && typeof value === 'string' && value.length > constraints.maxLength) {
        errors.push(path + ': 长度 ' + value.length + ' 大于最大长度 ' + constraints.maxLength);
      }

      // 正则模式
      if (constraints.pattern && typeof value === 'string' && !constraints.pattern.test(value)) {
        errors.push(path + ': 值 "' + value + '" 不匹配模式 ' + constraints.pattern);
      }

      // 枚举值
      if (constraints.enum && !constraints.enum.includes(value)) {
        errors.push(path + ': 值 "' + value + '" 不在枚举值中 [' + constraints.enum.join(', ') + ']');
      }

      return { valid: errors.length === 0, errors: errors };
    },

    /**
     * 验证对象
     * @param {Object} obj - 要验证的对象
     * @param {Object} schema - Schema 定义
     * @param {string} path - 数据路径
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateObject: function (obj, schema, path) {
      var errors = [];

      if (!obj || typeof obj !== 'object') {
        return { valid: false, errors: [path + ': 期望对象类型'] };
      }

      // 验证属性
      if (schema.properties) {
        for (var propName in schema.properties) {
          var propSchema = schema.properties[propName];
          var propValue = obj[propName];
          var propPath = path + '.' + propName;

          // 必填检查
          if (propSchema.required && (propValue === undefined || propValue === null)) {
            errors.push(propPath + ': 必填字段缺失');
            continue;
          }

          // 跳过未定义的可选字段
          if (propValue === undefined || propValue === null) continue;

          // 递归验证
          var result;
          if (propSchema.type === 'object' && propSchema.properties) {
            result = this.validateObject(propValue, propSchema, propPath);
          } else if (propSchema.type === 'array' && propSchema.items) {
            result = this.validateArray(propValue, propSchema, propPath);
          } else {
            result = this.validateValue(propValue, propSchema, propPath);
          }

          if (!result.valid) {
            errors = errors.concat(result.errors);
          }
        }
      }

      return { valid: errors.length === 0, errors: errors };
    },

    /**
     * 验证数组
     * @param {Array} arr - 要验证的数组
     * @param {Object} schema - Schema 定义
     * @param {string} path - 数据路径
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateArray: function (arr, schema, path) {
      var errors = [];

      if (!Array.isArray(arr)) {
        return { valid: false, errors: [path + ': 期望数组类型'] };
      }

      // 验证每个元素
      if (schema.items) {
        for (var i = 0; i < arr.length; i++) {
          var itemPath = path + '[' + i + ']';
          var result;

          if (schema.items.type === 'object' && schema.items.properties) {
            result = this.validateObject(arr[i], schema.items, itemPath);
          } else {
            result = this.validateValue(arr[i], schema.items, itemPath);
          }

          if (!result.valid) {
            errors = errors.concat(result.errors);
          }
        }
      }

      return { valid: errors.length === 0, errors: errors };
    },

    /**
     * 类型检查
     * @private
     */
    _checkType: function (value, type) {
      if (type === 'array') return Array.isArray(value);
      if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
      return typeof value === type;
    },
  };

  /**
   * 验证数据是否符合约束
   * @param {string} domain - 领域名
   * @param {string} key - 键名
   * @param {*} value - 要验证的值
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  function validateData(domain, key, value) {
    var fullKey = domain + '.' + key;
    var constraints = DATA_CONSTRAINTS[fullKey];

    if (!constraints) {
      // 没有定义约束，默认通过
      return { valid: true, errors: [] };
    }

    var path = fullKey;
    var result;

    if (constraints.type === 'array' && constraints.items) {
      result = DataConstraintValidator.validateArray(value, constraints, path);
    } else if (constraints.type === 'object') {
      result = DataConstraintValidator.validateObject(value, constraints, path);
    } else {
      result = DataConstraintValidator.validateValue(value, constraints, path);
    }

    return result;
  }

  /**
   * 获取所有约束定义
   * @returns {Object}
   */
  function getConstraints() {
    return DATA_CONSTRAINTS;
  }

  /**
   * 获取指定域/键的约束
   * @param {string} domain
   * @param {string} key
   * @returns {Object|null}
   */
  function getConstraint(domain, key) {
    return DATA_CONSTRAINTS[domain + '.' + key] || null;
  }

  /**
   * 添加自定义约束
   * @param {string} domain
   * @param {string} key
   * @param {Object} constraints
   */
  function addConstraint(domain, key, constraints) {
    DATA_CONSTRAINTS[domain + '.' + key] = constraints;
    console.log('[DataConstraints] 添加约束:', domain + '.' + key);
  }

  // 暴露到全局
  window.PhoneDataConstraints = {
    validate: validateData,
    getConstraints: getConstraints,
    getConstraint: getConstraint,
    addConstraint: addConstraint,
    types: ConstraintType,
  };

  console.log('[DataConstraints] 数据约束系统已加载，定义了 ' + Object.keys(DATA_CONSTRAINTS).length + ' 个约束');

})();
