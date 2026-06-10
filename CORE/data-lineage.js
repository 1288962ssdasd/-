/**
 * data-lineage.js - 数据血缘追踪系统
 * 
 * 功能：
 * - 追踪数据变更来源、时间、操作者
 * - 支持数据回滚和审计
 * - 使用 _lineage 前缀避免与业务字段冲突
 * 
 * @version 4.31.0
 * @author AI数据修复工程师
 */

;(function () {
  'use strict';

  /**
   * 血缘记录结构
   * 使用 _lineage 前缀避免与业务字段冲突
   */
  var LINEAGE_KEY = '_lineage';

  /**
   * 生成唯一版本号
   * @returns {string} 格式: v_YYYYMMDD_HHMMSS_random
   */
  function generateVersion() {
    var now = new Date();
    var dateStr = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    var timeStr = now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    var random = Math.random().toString(36).substr(2, 6);
    return 'v_' + dateStr + '_' + timeStr + '_' + random;
  }

  /**
   * 生成唯一追踪ID
   * @returns {string}
   */
  function generateTraceId() {
    return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 数据血缘管理器
   */
  var DataLineage = {
    /**
     * 血缘历史存储
     * 格式: fullKey -> Array<LineageRecord>
     */
    _history: new Map(),

    /**
     * 最大历史记录数
     */
    _maxHistory: 50,

    /**
     * 是否启用血缘追踪
     */
    _enabled: true,

    /**
     * 启用/禁用血缘追踪
     * @param {boolean} enabled
     */
    setEnabled: function (enabled) {
      this._enabled = enabled;
      console.log('[DataLineage] 血缘追踪:', enabled ? '已启用' : '已禁用');
    },

    /**
     * 创建血缘记录
     * @param {string} domain - 领域名
     * @param {string} key - 键名
     * @param {*} value - 新值
     * @param {*} oldValue - 旧值
     * @param {Object} options - 选项
     *   - source: 来源模块/服务
     *   - operation: 操作类型 (set/add/delete/update)
     *   - triggeredBy: 触发者 (user/system/ai/event)
     *   - correlationId: 关联事件ID
     *   - metadata: 额外元数据
     * @returns {Object} 血缘记录
     */
    createLineage: function (domain, key, value, oldValue, options) {
      if (!this._enabled) return null;

      options = options || {};
      var fullKey = domain + '.' + key;
      var version = generateVersion();
      var timestamp = Date.now();

      var lineage = {
        _version: version,
        _timestamp: timestamp,
        _domain: domain,
        _key: key,
        _operation: options.operation || 'set',
        _source: options.source || 'unknown',
        _triggeredBy: options.triggeredBy || 'system',
        _correlationId: options.correlationId || null,
        _previousVersion: null,
        _changeType: this._detectChangeType(oldValue, value),
        _checksum: this._computeChecksum(value),
      };

      // 记录上一个版本
      var history = this._history.get(fullKey);
      if (history && history.length > 0) {
        lineage._previousVersion = history[history.length - 1]._version;
      }

      // 添加额外元数据
      if (options.metadata) {
        lineage._metadata = options.metadata;
      }

      // 存储历史
      this._addHistory(fullKey, lineage);

      return lineage;
    },

    /**
     * 将血缘信息附加到数据对象
     * @param {*} data - 原始数据
     * @param {Object} lineage - 血缘记录
     * @returns {*} 带血缘信息的数据
     */
    attachLineage: function (data, lineage) {
      if (!this._enabled || !lineage) return data;

      // 只对对象类型附加血缘信息
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // 使用 _lineage 前缀避免与业务字段冲突
        var dataWithLineage = Object.assign({}, data);
        dataWithLineage[LINEAGE_KEY] = {
          _version: lineage._version,
          _timestamp: lineage._timestamp,
          _source: lineage._source,
          _operation: lineage._operation,
          _triggeredBy: lineage._triggeredBy,
          _correlationId: lineage._correlationId,
          _previousVersion: lineage._previousVersion,
          _checksum: lineage._checksum,
        };
        return dataWithLineage;
      }

      // 数组或原始类型返回原数据，血缘单独存储
      return data;
    },

    /**
     * 从数据对象提取血缘信息
     * @param {*} data - 带血缘信息的数据
     * @returns {Object|null} 血缘信息
     */
    extractLineage: function (data) {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data[LINEAGE_KEY] || null;
      }
      return null;
    },

    /**
     * 从数据对象移除血缘信息（用于业务处理）
     * @param {*} data - 带血缘信息的数据
     * @returns {*} 不含血缘信息的数据
     */
    stripLineage: function (data) {
      if (data && typeof data === 'object' && !Array.isArray(data) && data[LINEAGE_KEY]) {
        var stripped = Object.assign({}, data);
        delete stripped[LINEAGE_KEY];
        return stripped;
      }
      return data;
    },

    /**
     * 获取数据变更历史
     * @param {string} domain
     * @param {string} key
     * @param {number} limit - 最大返回数量
     * @returns {Array<LineageRecord>}
     */
    getHistory: function (domain, key, limit) {
      var fullKey = domain + '.' + key;
      var history = this._history.get(fullKey) || [];
      
      if (limit && limit > 0) {
        return history.slice(-limit);
      }
      
      return history.slice();
    },

    /**
     * 获取指定版本的信息
     * @param {string} domain
     * @param {string} key
     * @param {string} version
     * @returns {Object|null}
     */
    getVersion: function (domain, key, version) {
      var history = this.getHistory(domain, key);
      for (var i = 0; i < history.length; i++) {
        if (history[i]._version === version) {
          return history[i];
        }
      }
      return null;
    },

    /**
     * 获取血缘链（从当前版本追溯到指定深度）
     * @param {string} domain
     * @param {string} key
     * @param {number} depth - 追溯深度
     * @returns {Array<LineageRecord>}
     */
    getLineageChain: function (domain, key, depth) {
      depth = depth || 10;
      var history = this.getHistory(domain, key);
      var chain = [];
      
      if (history.length === 0) return chain;
      
      var current = history[history.length - 1];
      chain.push(current);
      
      while (chain.length < depth && current._previousVersion) {
        var prev = this.getVersion(domain, key, current._previousVersion);
        if (prev) {
          chain.push(prev);
          current = prev;
        } else {
          break;
        }
      }
      
      return chain;
    },

    /**
     * 清除历史记录
     * @param {string} domain - 可选，不传则清除全部
     * @param {string} key - 可选
     */
    clearHistory: function (domain, key) {
      if (domain && key) {
        this._history.delete(domain + '.' + key);
      } else if (domain) {
        // 清除指定域的所有历史
        var keysToDelete = [];
        this._history.forEach(function (_, k) {
          if (k.startsWith(domain + '.')) {
            keysToDelete.push(k);
          }
        });
        for (var i = 0; i < keysToDelete.length; i++) {
          this._history.delete(keysToDelete[i]);
        }
      } else {
        this._history.clear();
      }
      console.log('[DataLineage] 历史记录已清除');
    },

    /**
     * 导出审计日志
     * @param {string} domain - 可选过滤
     * @param {number} startTime - 开始时间戳
     * @param {number} endTime - 结束时间戳
     * @returns {Array<Object>}
     */
    exportAuditLog: function (domain, startTime, endTime) {
      var logs = [];
      
      this._history.forEach(function (history, fullKey) {
        if (domain && !fullKey.startsWith(domain + '.')) return;
        
        for (var i = 0; i < history.length; i++) {
          var record = history[i];
          if (startTime && record._timestamp < startTime) continue;
          if (endTime && record._timestamp > endTime) continue;
          
          logs.push({
            fullKey: fullKey,
            version: record._version,
            timestamp: record._timestamp,
            operation: record._operation,
            source: record._source,
            triggeredBy: record._triggeredBy,
            changeType: record._changeType,
            correlationId: record._correlationId,
          });
        }
      });
      
      // 按时间排序
      logs.sort(function (a, b) {
        return a.timestamp - b.timestamp;
      });
      
      return logs;
    },

    /**
     * 检测变更类型
     * @private
     */
    _detectChangeType: function (oldValue, newValue) {
      if (oldValue === undefined || oldValue === null) return 'create';
      if (newValue === undefined || newValue === null) return 'delete';
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return 'none';
      return 'update';
    },

    /**
     * 计算数据校验和
     * @private
     */
    _computeChecksum: function (value) {
      try {
        var str = JSON.stringify(value);
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
          var char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return 'cksum_' + Math.abs(hash).toString(36);
      } catch (e) {
        return 'cksum_error';
      }
    },

    /**
     * 添加历史记录
     * @private
     */
    _addHistory: function (fullKey, lineage) {
      if (!this._history.has(fullKey)) {
        this._history.set(fullKey, []);
      }
      
      var history = this._history.get(fullKey);
      history.push(lineage);
      
      // 限制历史记录数量
      if (history.length > this._maxHistory) {
        history.shift();
      }
    },

    /**
     * 获取统计信息
     * @returns {Object}
     */
    getStats: function () {
      var totalRecords = 0;
      var keyCount = this._history.size;
      
      this._history.forEach(function (history) {
        totalRecords += history.length;
      });
      
      return {
        enabled: this._enabled,
        keyCount: keyCount,
        totalRecords: totalRecords,
        maxHistory: this._maxHistory,
      };
    },
  };

  // 暴露到全局
  window.PhoneDataLineage = DataLineage;

  console.log('[DataLineage] 数据血缘追踪系统已加载');

})();
