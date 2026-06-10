/**
 * @layer CORE
 * @file   payload-builder.js
 * @depends (无外部依赖)
 * @emits  (无)
 *
 * 职责: 事件载荷构造器，统一构造符合铁则十二标准的事件载荷
 *       { id, type, data, timestamp, source }
 * 禁止: 包含业务逻辑、调用Service、操作DOM、直接读写DataStore
 *
 * [铁则合规]
 * - 铁则三: 纯工具层，不包含业务逻辑
 * - 铁则九: 所有方法有防御性处理，不抛出异常
 * - 铁则十二: 载荷结构 { id, type, data, timestamp, source }
 */

;(function () {
  'use strict';

  /**
   * PayloadBuilder - 事件载荷构造器
   */
  var PayloadBuilder = {
    /**
     * 构造标准事件载荷
     * @param {string} type - 事件类型 (格式: domain:action，动词用过去式)
     * @param {*} data - 事件数据
     * @param {string} source - 事件来源标识
     * @returns {Object} 标准载荷 { id, type, data, timestamp, source }
     */
    build: function (type, data, source) {
      return {
        id: this._generateId(),
        type: type || 'unknown:unknown',
        data: data !== undefined ? data : null,
        timestamp: Date.now(),
        source: source || 'unknown',
      };
    },

    /**
     * 批量构造标准载荷
     * @param {string} baseType - 基础事件类型
     * @param {Array} items - 数据项数组
     * @param {string} source - 事件来源标识
     * @returns {Array} 标准载荷数组
     */
    buildBatch: function (baseType, items, source) {
      if (!Array.isArray(items)) return [];

      var results = [];
      for (var i = 0; i < items.length; i++) {
        results.push(this.build(baseType, items[i], source));
      }
      return results;
    },

    /**
     * 构造错误载荷
     * @param {string} type - 事件类型
     * @param {Error|string} error - 错误对象或消息
     * @param {Object} context - 错误上下文
     * @param {string} source - 事件来源标识
     * @returns {Object} 错误载荷
     */
    buildError: function (type, error, context, source) {
      var errorMessage = '';
      var errorCode = 'UNKNOWN_ERROR';

      if (error instanceof Error) {
        errorMessage = error.message || String(error);
        errorCode = error.code || errorCode;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = String(error);
      }

      return {
        id: this._generateId(),
        type: type || 'error:occurred',
        data: {
          error: true,
          message: errorMessage,
          code: errorCode,
          context: context || null,
        },
        timestamp: Date.now(),
        source: source || 'unknown',
      };
    },

    /**
     * 验证载荷是否符合标准格式
     * @param {Object} payload - 待验证载荷
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate: function (payload) {
      var errors = [];

      if (!payload || typeof payload !== 'object') {
        return { valid: false, errors: ['载荷为空或非对象'] };
      }

      if (!payload.id || typeof payload.id !== 'string') {
        errors.push('缺少有效的 id 字段');
      }
      if (!payload.type || typeof payload.type !== 'string') {
        errors.push('缺少有效的 type 字段');
      }
      if (payload.data === undefined) {
        errors.push('缺少 data 字段（可为 null）');
      }
      if (typeof payload.timestamp !== 'number' || payload.timestamp <= 0) {
        errors.push('缺少有效的 timestamp 字段');
      }
      if (!payload.source || typeof payload.source !== 'string') {
        errors.push('缺少有效的 source 字段');
      }

      return {
        valid: errors.length === 0,
        errors: errors,
      };
    },

    /**
     * 修复非标准载荷，补充缺失字段
     * @param {Object} payload - 待修复载荷
     * @param {string} defaultType - 默认事件类型
     * @param {string} defaultSource - 默认来源标识
     * @returns {Object} 修复后的标准载荷
     */
    repair: function (payload, defaultType, defaultSource) {
      if (!payload || typeof payload !== 'object') {
        return this.build(defaultType, null, defaultSource);
      }

      return {
        id: payload.id || this._generateId(),
        type: payload.type || defaultType || 'unknown:unknown',
        data: payload.data !== undefined ? payload.data : null,
        timestamp: (typeof payload.timestamp === 'number' && payload.timestamp > 0)
          ? payload.timestamp
          : Date.now(),
        source: payload.source || defaultSource || 'unknown',
      };
    },

    // ==================== 快捷方法 ====================

    /**
     * 任务相关载荷
     */
    quest: {
      accepted: function (questId, quest, source) {
        return PayloadBuilder.build('quest:accepted', { questId: questId, quest: quest }, source || 'quest-service');
      },
      completed: function (questId, quest, source) {
        return PayloadBuilder.build('quest:completed', { questId: questId, quest: quest }, source || 'quest-service');
      },
      failed: function (questId, quest, source) {
        return PayloadBuilder.build('quest:failed', { questId: questId, quest: quest }, source || 'quest-service');
      },
      created: function (quest, source) {
        return PayloadBuilder.build('quest:created', { quest: quest }, source || 'quest-service');
      },
      unlocked: function (questId, quest, source) {
        return PayloadBuilder.build('quest:unlocked', { questId: questId, quest: quest }, source || 'quest-service');
      },
      registryUpdated: function (registry, source) {
        return PayloadBuilder.build('quest:registryUpdated', registry, source || 'quest-service');
      },
    },

    /**
     * 消息相关载荷
     */
    message: {
      sent: function (message, source) {
        return PayloadBuilder.build('message:sent', message, source || 'message-service');
      },
      received: function (message, source) {
        return PayloadBuilder.build('message:received', message, source || 'message-service');
      },
      read: function (messageId, source) {
        return PayloadBuilder.build('message:read', { messageId: messageId }, source || 'message-service');
      },
    },

    /**
     * 社交相关载荷
     */
    social: {
      posted: function (sourceType, item, source) {
        return PayloadBuilder.build('social:posted', { sourceType: sourceType, item: item }, source || 'social-aggregator');
      },
      liked: function (sourceType, itemId, source) {
        return PayloadBuilder.build('social:liked', { sourceType: sourceType, itemId: itemId }, source || 'social-aggregator');
      },
      commented: function (sourceType, itemId, comment, source) {
        return PayloadBuilder.build('social:commented', { sourceType: sourceType, itemId: itemId, comment: comment }, source || 'social-aggregator');
      },
    },

    /**
     * NPC相关载荷
     */
    npc: {
      action: function (npcId, actionType, actionData, source) {
        return PayloadBuilder.build('npc:action', { npcId: npcId, actionType: actionType, actionData: actionData }, source || 'director-service');
      },
      relationshipChanged: function (npcId, change, source) {
        return PayloadBuilder.build('npc:relationshipChanged', { npcId: npcId, change: change }, source || 'director-service');
      },
    },

    /**
     * 导演相关载荷
     */
    director: {
      plan: function (plan, source) {
        return PayloadBuilder.build('director:plan', plan, source || 'director-service');
      },
      event: function (eventType, eventData, source) {
        return PayloadBuilder.build('director:' + eventType, eventData, source || 'director-service');
      },
      worldEvolved: function (changes, source) {
        return PayloadBuilder.build('director:worldEvolved', changes, source || 'director-service');
      },
    },

    // ==================== 内部方法 ====================

    /**
     * 生成唯一ID
     * @returns {string}
     * @private
     */
    _generateId: function () {
      var uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'evt_' + uuid.substr(0, 12);
    },
  };

  // 暴露到全局
  window.PayloadBuilder = PayloadBuilder;

  console.log('[CORE] PayloadBuilder 已加载');
})();
