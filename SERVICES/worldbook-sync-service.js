/**
 * @layer Service
 * @file   worldbook-sync-service.js
 * @depends Platform (adapter), EventBus
 * @emits  worldbook:synced, worldbook:cleared
 *
 * 职责: 选择性世界书同步 - 将小手机重要事件摘要注入ST世界书
 * 禁止: 操作DOM、直接操作ST世界书对象、调用LLM
 * 🚨 铁则六: 世界书操作必须且只能通过 Platform.adapter.appendWorldInfo()
 */

;(function () {
  'use strict';

  // ==================== 事件优先级配置 ====================

  /**
   * 事件优先级映射（数值越大优先级越高）
   * 优先级排序: 任务完成 > 好友关系变化 > 重要消息 > 其他
   */
  const EVENT_PRIORITY = {
    'quest:completed': 100,
    'friend:added': 80,
    'friend:removed': 80,
    'director:quest': 70,
    'status:changed': 50,
  };

  /** 需要监听的事件列表 */
  const LISTENED_EVENTS = Object.keys(EVENT_PRIORITY);

  /** 默认配置 */
  const DEFAULTS = {
    entryName: 'phone_events',
    maxEntries: 50,
    enabled: true,
  };

  // ==================== 摘要模板 ====================

  /**
   * 摘要模板 - 简单模板化生成，不调 LLM
   * 每个模板是一个函数，接收 payload，返回摘要字符串
   */
  const SUMMARY_TEMPLATES = {
    'quest:completed': function (payload) {
      var questName = (payload && payload.data && payload.data.name) || '未知任务';
      var reward = (payload && payload.data && payload.data.reward) || '';
      var rewardText = reward ? '，获得奖励' + reward : '';
      return '玩家完成了任务"' + questName + '"' + rewardText;
    },

    'friend:added': function (payload) {
      var friendName = (payload && payload.data && payload.data.name)
        || (payload && payload.data && payload.data.friendName)
        || '未知好友';
      return '玩家添加了新好友"' + friendName + '"';
    },

    'friend:removed': function (payload) {
      var friendName = (payload && payload.data && payload.data.name)
        || (payload && payload.data && payload.data.friendName)
        || '未知好友';
      return '玩家与"' + friendName + '"解除了好友关系';
    },

    'director:quest': function (payload) {
      var questName = (payload && payload.data && payload.data.name)
        || (payload && payload.data && payload.data.title)
        || '新任务';
      var director = (payload && payload.data && payload.data.director) || '管家';
      return director + '发布了新任务"' + questName + '"';
    },

    'status:changed': function (payload) {
      var field = (payload && payload.data && payload.data.field) || '状态';
      var value = (payload && payload.data && payload.data.value) || '未知';
      var oldValue = (payload && payload.data && payload.data.oldValue);
      var text = '玩家' + field + '变更为"' + value + '"';
      if (oldValue !== undefined && oldValue !== null) {
        text += '（原值: ' + oldValue + '）';
      }
      return text;
    },
  };

  // ==================== WorldBookSyncService ====================

  class WorldBookSyncService {
    /**
     * @param {Object} platform - Platform 实例
     */
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._entryName = DEFAULTS.entryName;
      this._maxEntries = DEFAULTS.maxEntries;
      this._enabled = DEFAULTS.enabled;
      this._initialized = false;
      this._handlers = {};
    }

    // ==================== 初始化 ====================

    /**
     * 初始化服务，绑定事件监听
     * @returns {Promise<boolean>}
     */
    async init() {
      if (this._initialized) {
        console.warn('[WorldBookSync] 已经初始化，跳过');
        return true;
      }

      try {
        // 从持久化存储恢复配置
        var savedConfig = await this._platform.data('worldbook', 'syncConfig', null);
        if (savedConfig) {
          try {
            var config = typeof savedConfig === 'string' ? JSON.parse(savedConfig) : savedConfig;
            if (config.entryName) this._entryName = config.entryName;
            if (typeof config.maxEntries === 'number' && config.maxEntries > 0) {
              this._maxEntries = config.maxEntries;
            }
            if (typeof config.enabled === 'boolean') {
              this._enabled = config.enabled;
            }
          } catch (parseErr) {
            console.warn('[WorldBookSync] 解析保存的配置失败:', parseErr);
          }
        }

        // 绑定事件监听
        this._bindEvents();

        this._initialized = true;
        console.log('[WorldBookSync] 初始化完成, entryName=' + this._entryName
          + ', maxEntries=' + this._maxEntries
          + ', enabled=' + this._enabled);
        return true;
      } catch (err) {
        console.error('[WorldBookSync] 初始化失败:', err);
        return false;
      }
    }

    // ==================== 事件绑定 ====================

    /**
     * 绑定 EventBus 事件监听
     * @private
     */
    _bindEvents() {
      var self = this;

      LISTENED_EVENTS.forEach(function (eventType) {
        var handler = function (payload) {
          self._onEvent(eventType, payload);
        };
        self._handlers[eventType] = handler;
        self._platform.eventBus.on(eventType, handler);
      });

      console.log('[WorldBookSync] 已监听事件:', LISTENED_EVENTS.join(', '));
    }

    /**
     * 事件处理回调
     * @private
     * @param {string} eventType
     * @param {Object} payload - 铁则十二: { id, type, data, timestamp, source }
     */
    _onEvent(eventType, payload) {
      if (!this._enabled) return;

      try {
        this.syncFromEvent(eventType, payload);
      } catch (err) {
        console.error('[WorldBookSync] 事件处理失败 [' + eventType + ']:', err);
      }
    }

    // ==================== 摘要生成 ====================

    /**
     * 根据事件类型和载荷生成摘要文本
     * @private
     * @param {string} eventType
     * @param {Object} payload
     * @returns {string|null} 摘要文本，无法生成时返回 null
     */
    _generateSummary(eventType, payload) {
      var template = SUMMARY_TEMPLATES[eventType];
      if (!template) {
        console.warn('[WorldBookSync] 无摘要模板 for event:', eventType);
        return null;
      }

      try {
        var summary = template(payload);
        if (!summary || typeof summary !== 'string') {
          console.warn('[WorldBookSync] 摘要生成为空 for event:', eventType);
          return null;
        }
        return summary;
      } catch (err) {
        console.error('[WorldBookSync] 摘要生成失败 [' + eventType + ']:', err);
        return null;
      }
    }

    /**
     * 格式化时间戳前缀
     * @private
     * @param {number} [timestamp] - 毫秒时间戳，默认当前时间
     * @returns {string} 格式如 [2025-05-16 14:30]
     */
    _formatTimestamp(timestamp) {
      var ts = timestamp || Date.now();
      var d = new Date(ts);
      var year = d.getFullYear();
      var month = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var hour = String(d.getHours()).padStart(2, '0');
      var minute = String(d.getMinutes()).padStart(2, '0');
      return '[' + year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ']';
    }

    // ==================== 去重检查 ====================

    /**
     * 检查摘要是否已存在于世界书条目中
     * 通过检查摘要文本（不含时间戳）来判断是否重复
     * @private
     * @param {string} summaryText - 不含时间戳的摘要文本
     * @param {string} existingContent - 世界书条目现有内容
     * @returns {boolean} true 表示已存在（重复）
     */
    _isDuplicate(summaryText, existingContent) {
      if (!existingContent || !summaryText) return false;
      // 检查现有内容中是否包含该摘要文本（跳过时间戳前缀匹配）
      return existingContent.indexOf(summaryText) !== -1;
    }

    // ==================== 核心同步 ====================

    /**
     * 手动同步一条摘要到世界书
     * @param {string} entry - 摘要文本（不含时间戳前缀，方法内部自动添加）
     * @param {Object} [options] - 可选参数
     * @param {number} [options.timestamp] - 自定义时间戳
     * @param {boolean} [options.skipDuplicateCheck] - 跳过去重检查，默认 false
     * @returns {Promise<boolean>} 是否同步成功
     */
    async sync(entry, options) {
      if (!this._enabled) {
        console.log('[WorldBookSync] 服务已禁用，跳过同步');
        return false;
      }

      if (!entry || typeof entry !== 'string') {
        console.warn('[WorldBookSync] sync: entry 无效');
        return false;
      }

      options = options || {};

      try {
        // 读取现有世界书条目内容
        var existingContent = null;
        try {
          existingContent = this._platform.adapter.getWorldInfoEntry(this._entryName);
        } catch (readErr) {
          console.warn('[WorldBookSync] 读取世界书条目失败，将创建新条目:', readErr);
          existingContent = null;
        }

        // 去重检查
        if (!options.skipDuplicateCheck && this._isDuplicate(entry, existingContent)) {
          console.log('[WorldBookSync] 摘要已存在，跳过:', entry);
          return false;
        }

        // 构建带时间戳的完整行
        var timestamp = options.timestamp || Date.now();
        var timestampedLine = this._formatTimestamp(timestamp) + ' ' + entry;

        // 解析现有条目为行数组
        var lines = [];
        if (existingContent && typeof existingContent === 'string' && existingContent.trim()) {
          lines = existingContent.split('\n').filter(function (line) {
            return line.trim().length > 0;
          });
        }

        // 追加新行
        lines.push(timestampedLine);

        // 容量限制：保留最近 N 条
        if (lines.length > this._maxEntries) {
          lines = lines.slice(lines.length - this._maxEntries);
        }

        // 组装最终内容
        var newContent = lines.join('\n');

        // 🚨 铁则六: 世界书操作必须且只能通过 Platform.adapter
        try {
          var success = await this._platform.adapter.setWorldInfoEntry(this._entryName, newContent);
          if (!success) {
            // 降级：尝试 appendWorldInfo
            console.warn('[WorldBookSync] setWorldInfoEntry 返回 false，尝试 appendWorldInfo');
            this._platform.adapter.appendWorldInfo({
              name: this._entryName,
              content: newContent,
            });
          }
        } catch (writeErr) {
          console.error('[WorldBookSync] 写入世界书失败:', writeErr);
          return false;
        }

        // 持久化摘要历史
        try {
          await this._platform.setData('worldbook', 'syncHistory', JSON.stringify(lines));
        } catch (saveErr) {
          console.warn('[WorldBookSync] 持久化摘要历史失败:', saveErr);
          // 不阻断主流程
        }

        // 发射同步完成事件
        try {
          this._platform.eventBus.emit('worldbook:synced', {
            id: 'wbsync_' + Date.now(),
            type: 'worldbook:synced',
            data: {
              entryName: this._entryName,
              summary: entry,
              timestamp: timestamp,
              totalEntries: lines.length,
            },
            timestamp: timestamp,
            source: 'WorldBookSyncService',
          });
        } catch (emitErr) {
          console.warn('[WorldBookSync] 发射 worldbook:synced 事件失败:', emitErr);
        }

        console.log('[WorldBookSync] 同步成功:', timestampedLine);
        return true;
      } catch (err) {
        console.error('[WorldBookSync] sync 异常:', err);
        return false;
      }
    }

    /**
     * 从事件生成摘要并同步
     * @param {string} eventType - 事件类型
     * @param {Object} payload - 事件载荷 { id, type, data, timestamp, source }
     * @returns {Promise<boolean>} 是否同步成功
     */
    async syncFromEvent(eventType, payload) {
      if (!eventType || !EVENT_PRIORITY.hasOwnProperty(eventType)) {
        console.warn('[WorldBookSync] syncFromEvent: 不支持的事件类型:', eventType);
        return false;
      }

      // 生成摘要
      var summary = this._generateSummary(eventType, payload);
      if (!summary) return false;

      // 提取事件中的时间戳
      var timestamp = (payload && payload.timestamp) || Date.now();

      return this.sync(summary, { timestamp: timestamp });
    }

    // ==================== 历史管理 ====================

    /**
     * 获取已同步的摘要历史
     * 优先从持久化存储读取，降级从世界书条目读取
     * @returns {Promise<string[]>} 摘要行数组
     */
    async getHistory() {
      try {
        // 优先从持久化存储读取
        var savedHistory = await this._platform.data('worldbook', 'syncHistory', null);
        if (savedHistory) {
          try {
            var parsed = typeof savedHistory === 'string' ? JSON.parse(savedHistory) : savedHistory;
            if (Array.isArray(parsed)) return parsed;
          } catch (parseErr) {
            console.warn('[WorldBookSync] 解析历史记录失败:', parseErr);
          }
        }

        // 降级：从世界书条目读取
        try {
          var content = this._platform.adapter.getWorldInfoEntry(this._entryName);
          if (content && typeof content === 'string' && content.trim()) {
            return content.split('\n').filter(function (line) {
              return line.trim().length > 0;
            });
          }
        } catch (readErr) {
          console.warn('[WorldBookSync] 从世界书读取历史失败:', readErr);
        }

        return [];
      } catch (err) {
        console.error('[WorldBookSync] getHistory 失败:', err);
        return [];
      }
    }

    /**
     * 清空摘要历史
     * 同时清空世界书条目和持久化存储
     * @returns {Promise<boolean>}
     */
    async clearHistory() {
      try {
        // 清空世界书条目（写入空内容）
        try {
          var success = await this._platform.adapter.setWorldInfoEntry(this._entryName, '');
          if (!success) {
            console.warn('[WorldBookSync] clearHistory: setWorldInfoEntry 返回 false');
          }
        } catch (writeErr) {
          console.warn('[WorldBookSync] clearHistory: 清空世界书条目失败:', writeErr);
        }

        // 清空持久化存储
        try {
          await this._platform.setData('worldbook', 'syncHistory', JSON.stringify([]));
        } catch (saveErr) {
          console.warn('[WorldBookSync] clearHistory: 清空持久化存储失败:', saveErr);
        }

        // 发射清空事件
        try {
          this._platform.eventBus.emit('worldbook:cleared', {
            id: 'wbclear_' + Date.now(),
            type: 'worldbook:cleared',
            data: {
              entryName: this._entryName,
            },
            timestamp: Date.now(),
            source: 'WorldBookSyncService',
          });
        } catch (emitErr) {
          console.warn('[WorldBookSync] 发射 worldbook:cleared 事件失败:', emitErr);
        }

        console.log('[WorldBookSync] 摘要历史已清空');
        return true;
      } catch (err) {
        console.error('[WorldBookSync] clearHistory 失败:', err);
        return false;
      }
    }

    // ==================== 配置管理 ====================

    /**
     * 启用/禁用同步服务
     * @param {boolean} enabled
     * @returns {Promise<void>}
     */
    async setEnabled(enabled) {
      this._enabled = !!enabled;
      await this._saveConfig();
      console.log('[WorldBookSync] 服务' + (this._enabled ? '已启用' : '已禁用'));
    }

    /**
     * 设置最大保留条数
     * @param {number} count - 最大条数，必须 > 0
     * @returns {Promise<void>}
     */
    async setMaxEntries(count) {
      if (typeof count !== 'number' || count <= 0) {
        console.warn('[WorldBookSync] setMaxEntries: count 必须为正数，收到:', count);
        return;
      }
      this._maxEntries = Math.floor(count);
      await this._saveConfig();
      console.log('[WorldBookSync] 最大保留条数设置为:', this._maxEntries);
    }

    /**
     * 获取当前配置
     * @returns {Object}
     */
    getConfig() {
      return {
        entryName: this._entryName,
        maxEntries: this._maxEntries,
        enabled: this._enabled,
        initialized: this._initialized,
        listenedEvents: LISTENED_EVENTS.slice(),
      };
    }

    /**
     * 持久化当前配置
     * @private
     * @returns {Promise<void>}
     */
    async _saveConfig() {
      try {
        var config = {
          entryName: this._entryName,
          maxEntries: this._maxEntries,
          enabled: this._enabled,
        };
        await this._platform.setData('worldbook', 'syncConfig', JSON.stringify(config));
      } catch (err) {
        console.warn('[WorldBookSync] 保存配置失败:', err);
      }
    }

    // ==================== 销毁 ====================

    /**
     * 销毁服务，解绑所有事件监听
     */
    destroy() {
      var self = this;
      LISTENED_EVENTS.forEach(function (eventType) {
        if (self._handlers[eventType]) {
          try {
            self._platform.eventBus.off(eventType, self._handlers[eventType]);
          } catch (err) {
            console.warn('[WorldBookSync] 解绑事件失败 [' + eventType + ']:', err);
          }
        }
      });
      this._handlers = {};
      this._initialized = false;
      console.log('[WorldBookSync] 服务已销毁');
    }
  }

  // ==================== 全局挂载 ====================

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.WorldBookSync = WorldBookSyncService;

  console.log('[Service] WorldBookSyncService 已加载');
})();
