/**
 * @deprecated 模块注册已统一使用 module-registry.js
 *
 * 本文件保留仅为向后兼容。新的模块注册请直接在 module-registry.js 中添加。
 * MODULE_REGISTRY 数组和 loadAll() 方法不再被 index.js 调用。
 */

/**
 * PhoneModules Index - 模块注册入口
 */

;(function () {
  'use strict';

  // 模块注册表（完整版）
  const MODULE_REGISTRY = [
    { name: 'message',        class: 'Message',        file: 'MODULES/message-module.js' },
    { name: 'weibo',          class: 'Weibo',          file: 'MODULES/weibo-module.js' },
    { name: 'apiSettings',    class: 'ApiSettings',    file: 'MODULES/api-settings-module.js' },
    { name: 'friendsCircle',  class: 'FriendsCircle',  file: 'MODULES/friends-circle-module.js' },
    { name: 'forum',          class: 'Forum',          file: 'MODULES/forum-module.js' },
    { name: 'profile',        class: 'Profile',        file: 'MODULES/profile-module.js' },
    { name: 'task',           class: 'Task',           file: 'MODULES/task-module.js' },
    { name: 'inventory',      class: 'Inventory',      file: 'MODULES/inventory-module.js' },
    { name: 'shop',           class: 'Shop',           file: 'MODULES/shop-module.js' },
    { name: 'status',         class: 'Status',         file: 'MODULES/status-module.js' },
    { name: 'diary',          class: 'Diary',          file: 'MODULES/diary-module.js' },
    { name: 'live',           class: 'Live',           file: 'MODULES/live-module.js' },
  ];

  // 模块加载器
  window.PhoneModuleLoader = {
    /**
     * 加载所有模块
     * @returns {Promise<Array>}
     */
    async loadAll() {
      const results = [];
      
      for (const module of MODULE_REGISTRY) {
        try {
          if (!window.PhoneModules?.[module.class]) {
            console.warn(`[ModuleLoader] ${module.name} 模块类未找到`);
            continue;
          }
          
          results.push({
            name: module.name,
            class: module.class,
            loaded: true,
          });
          
          console.log(`[ModuleLoader] ${module.name} 模块已注册`);
        } catch (err) {
          console.error(`[ModuleLoader] ${module.name} 模块加载失败:`, err);
          results.push({
            name: module.name,
            error: err.message,
            loaded: false,
          });
        }
      }
      
      return results;
    },

    /**
     * 获取模块类
     * @param {string} name
     * @returns {Function|undefined}
     */
    getClass(name) {
      const module = MODULE_REGISTRY.find(m => m.name === name);
      return module ? window.PhoneModules?.[module.class] : undefined;
    },

    /**
     * 获取所有可用模块
     * @returns {Array}
     */
    getAvailable() {
      return MODULE_REGISTRY
        .filter(m => window.PhoneModules?.[m.class])
        .map(m => ({
          name: m.name,
          className: m.class,
          instance: window.PhoneModules[m.class],
        }));
    },
  };

  console.log('[ModuleLoader] 模块加载器已初始化 (' + MODULE_REGISTRY.length + ' 个模块)');
})();
