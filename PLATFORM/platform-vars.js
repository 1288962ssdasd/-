/**
 * Platform Vars - 统一变量访问层
 * 
 * 提供统一的变量读写接口，优先使用 Platform API，降级到旧 API
 * 用于业务模块迁移到 Platform 架构
 */
;(function () {
  'use strict';

  /**
   * PlatformVars - 变量访问统一入口
   */
  var PlatformVars = {
    /**
     * 读取变量
     * @param {string} key - 变量名（如 'xb.game.money'）
     * @returns {Promise<string|null>} 变量值
     */
    get: function (key) {
      // 优先 Platform
      if (window.Platform?.isReady) {
        return window.Platform.adapter.read(key);
      }
      // 降级 BridgeAPI
      if (window.BridgeAPI?._readVar) {
        return window.BridgeAPI._readVar(key);
      }
      // 降级 ConfigManager
      if (window.ConfigManager?.get) {
        return window.ConfigManager.get(key);
      }
      return Promise.resolve(null);
    },

    /**
     * 同步读取变量（仅从缓存）
     * @param {string} key - 变量名
     * @returns {string|null} 变量值
     */
    getSync: function (key) {
      // 优先 Platform
      if (window.Platform?.isReady) {
        var parts = key.split('.');
        var domain = parts[0];
        var subKey = parts.slice(1).join('.');
        return window.Platform.dataSync(domain, subKey);
      }
      // 降级 PhoneDataStore
      if (window.PhoneDataStore?.get) {
        return window.PhoneDataStore.get(key);
      }
      // 降级 ConfigManager
      if (window.ConfigManager?.getSync) {
        return window.ConfigManager.getSync(key);
      }
      return null;
    },

    /**
     * 写入变量
     * @param {string} key - 变量名
     * @param {string|object} value - 变量值
     * @returns {Promise<boolean>} 是否成功
     */
    set: function (key, value) {
      // 序列化对象
      var strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      // 优先 Platform
      if (window.Platform?.isReady) {
        var parts = key.split('.');
        var domain = parts[0];
        var subKey = parts.slice(1).join('.');
        window.Platform.setData(domain, subKey, value);
        return Promise.resolve(true);
      }
      // 降级 BridgeAPI
      if (window.BridgeAPI?._writeVar) {
        return window.BridgeAPI._writeVar(key, strValue);
      }
      // 降级 ConfigManager
      if (window.ConfigManager?.set) {
        return window.ConfigManager.set(key, strValue);
      }
      // 降级 PhoneDataStore
      if (window.PhoneDataStore?.set) {
        window.PhoneDataStore.set(key, value);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    /**
     * 订阅变量变更
     * @param {string} key - 变量名
     * @param {Function} callback - 回调函数 (value, oldValue) => void
     * @returns {Function} 取消订阅函数
     */
    subscribe: function (key, callback) {
      // 优先 Platform
      if (window.Platform?.isReady) {
        var parts = key.split('.');
        var domain = parts[0];
        var subKey = parts.slice(1).join('.');
        return window.Platform.subscribeData(domain, subKey, callback);
      }
      // 降级 PhoneDataStore
      if (window.PhoneDataStore?.subscribe) {
        return window.PhoneDataStore.subscribe(key, callback);
      }
      return function () {};
    },

    /**
     * 批量读取变量
     * @param {string[]} keys - 变量名数组
     * @returns {Promise<Object>} { key: value } 对象
     */
    getBatch: function (keys) {
      var self = this;
      var result = {};
      return Promise.all(keys.map(function (key) {
        return self.get(key).then(function (value) {
          result[key] = value;
        });
      })).then(function () {
        return result;
      });
    },

    /**
     * 批量写入变量
     * @param {Object} items - { key: value } 对象
     * @returns {Promise<boolean>} 是否全部成功
     */
    setBatch: function (items) {
      var self = this;
      var keys = Object.keys(items);
      return Promise.all(keys.map(function (key) {
        return self.set(key, items[key]);
      })).then(function (results) {
        return results.every(Boolean);
      });
    },

    /**
     * 解析 JSON 变量
     * @param {string} value - 变量值
     * @param {*} defaultValue - 默认值
     * @returns {*} 解析后的值
     */
    parseJSON: function (value, defaultValue) {
      if (!value) return defaultValue;
      try {
        return JSON.parse(value);
      } catch (e) {
        return defaultValue;
      }
    }
  };

  // 导出全局
  window.PlatformVars = PlatformVars;

  // 挂载到 Platform
  if (window.Platform) {
    window.Platform.vars = PlatformVars;
  }

  console.log('[PlatformVars] 统一变量访问层已加载');
})();
