/**
 * Mvu Adapter - Mvu 框架适配器
 * 
 * 将 SillyTavern 的 Mvu 框架封装为 Platform 模块
 * 用于操作消息中的角色卡/世界书变量
 */
;(function () {
  'use strict';

  /**
   * MvuAdapter - Mvu 框架适配器
   */
  var MvuAdapter = {
    /**
     * 检查 Mvu 框架是否可用
     * @returns {boolean}
     */
    isAvailable: function () {
      return !!(window.Mvu && typeof window.Mvu.getMvuData === 'function');
    },

    /**
     * 获取消息的 Mvu 数据
     * @param {string} messageId - 消息 ID
     * @returns {Object|null} Mvu 数据对象
     */
    getMessageData: function (messageId) {
      if (!this.isAvailable()) return null;
      try {
        return window.Mvu.getMvuData({ type: 'message', message_id: messageId });
      } catch (e) {
        console.error('[MvuAdapter] getMvuData 失败:', e);
        return null;
      }
    },

    /**
     * 设置变量
     * @param {Object} mvuData - Mvu 数据对象
     * @param {string} path - 变量路径（如 '用户.货币[0]'）
     * @param {*} value - 变量值
     * @param {Object} options - 选项
     * @returns {Promise<boolean>}
     */
    setVariable: function (mvuData, path, value, options) {
      if (!this.isAvailable()) return Promise.resolve(false);
      try {
        return window.Mvu.setMvuVariable(mvuData, path, value, options || {})
          .then(function () { return true; })
          .catch(function (e) {
            console.error('[MvuAdapter] setMvuVariable 失败:', e);
            return false;
          });
      } catch (e) {
        console.error('[MvuAdapter] setMvuVariable 失败:', e);
        return Promise.resolve(false);
      }
    },

    /**
     * 替换消息的 Mvu 数据
     * @param {Object} mvuData - Mvu 数据对象
     * @param {string} messageId - 消息 ID
     * @returns {Promise<boolean>}
     */
    replaceData: function (mvuData, messageId) {
      if (!this.isAvailable()) return Promise.resolve(false);
      try {
        return window.Mvu.replaceMvuData(mvuData, { type: 'message', message_id: messageId })
          .then(function () { return true; })
          .catch(function (e) {
            console.error('[MvuAdapter] replaceMvuData 失败:', e);
            return false;
          });
      } catch (e) {
        console.error('[MvuAdapter] replaceMvuData 失败:', e);
        return Promise.resolve(false);
      }
    },

    /**
     * 批量设置变量
     * @param {string} messageId - 消息 ID
     * @param {Object} variables - { path: value } 对象
     * @param {Object} options - 选项
     * @returns {Promise<boolean>}
     */
    setVariables: function (messageId, variables, options) {
      var self = this;
      var mvuData = this.getMessageData(messageId);
      if (!mvuData) return Promise.resolve(false);

      var paths = Object.keys(variables);
      return paths.reduce(function (promise, path) {
        return promise.then(function () {
          return self.setVariable(mvuData, path, variables[path], options);
        });
      }, Promise.resolve(true))
      .then(function () {
        return self.replaceData(mvuData, messageId);
      });
    },

    /**
     * 获取变量值
     * @param {string} messageId - 消息 ID
     * @param {string} path - 变量路径
     * @returns {*}
     */
    getVariable: function (messageId, path) {
      var mvuData = this.getMessageData(messageId);
      if (!mvuData) return null;
      
      // 解析路径获取值
      var parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
      var current = mvuData;
      
      for (var i = 0; i < parts.length; i++) {
        if (current == null) return null;
        current = current[parts[i]];
      }
      
      return current;
    },

    /**
     * 等待 Mvu 框架就绪
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<boolean>}
     */
    waitForReady: function (timeout) {
      var self = this;
      timeout = timeout || 10000;
      
      return new Promise(function (resolve) {
        if (self.isAvailable()) {
          resolve(true);
          return;
        }
        
        var startTime = Date.now();
        var check = function () {
          if (self.isAvailable()) {
            resolve(true);
          } else if (Date.now() - startTime > timeout) {
            console.warn('[MvuAdapter] 等待 Mvu 框架超时');
            resolve(false);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }
  };

  // 导出全局
  window.MvuAdapter = MvuAdapter;

  // 挂载到 Platform
  if (window.Platform) {
    window.Platform.mvu = MvuAdapter;
  }

  console.log('[MvuAdapter] Mvu 框架适配器已加载');
})();
