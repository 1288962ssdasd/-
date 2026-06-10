/**
 * module-registry.js - 模块注册中心
 * 铁则五: 模块注册必须用 __phoneShell.registerModule
 * 铁则十八: 模块完整定义在独立文件，index.js 只做注册和入口引用
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 将模块类转换为普通对象（铁则五要求）
   */
  function createModuleObject(ModuleClass, defaultId) {
    if (typeof ModuleClass.toPlainObject === 'function') {
      return ModuleClass.toPlainObject();
    }
    console.warn('[Phone Init] ' + (defaultId || 'unknown') + ' 模块未提供 toPlainObject()，使用兼容模式');
    var instance = new ModuleClass();
    return {
      id: instance.id || defaultId,
      name: instance.name,
      icon: instance.icon,
      iconBg: instance.iconBg,
      instance: instance,
      init: function(phone, params) { return this.instance.init(phone, params); },
      resume: function(params) { return this.instance.resume(params); },
      pause: function() { return this.instance.pause(); },
      destroy: function() { return this.instance.destroy(); },
      render: function() { return this.instance.render(); },
    };
  }

  /**
   * 需要通过 createModuleObject 转换的模块列表
   * 格式: [windowPath, defaultId, displayName]
   */
  var moduleRegistrations = [
    ['PhoneModules.Message', 'message', '消息模块'],
    ['PhoneModules.Weibo', 'weibo', '微博模块'],
    ['PhoneModules.ApiSettings', 'api-settings', 'API设置模块'],
    ['PhoneModules.Forum', 'forum', '论坛模块'],
    ['PhoneModules.Profile', 'profile', '个人资料模块'],
    ['PhoneModules.Task', 'task', '任务模块'],
    ['PhoneModules.Inventory', 'inventory', '背包模块'],
    ['PhoneModules.Shop', 'shop', '商店模块'],
    ['PhoneModules.Status', 'status', '状态模块'],
    ['PhoneModules.Diary', 'diary', '日记模块'],
    ['PhoneModules.Live', 'live', '直播模块'],
    ['PhoneModules.Bank', 'bank', '银行模块'],
    ['PhoneModules.Stock', 'stock', '股票模块'],
    ['PhoneModules.Map', 'map', '地图模块'],
  ];

  /**
   * 直接注册的模块（已经是普通对象）
   * 格式: [windowPath, displayName]
   */
  var directRegistrations = [
    ['DebugBridgeModule', '调试桥接模块'],
    ['PlaceholderModules.Contacts', '通讯录占位模块'],
    ['PlaceholderModules.Photos', '相册占位模块'],
    ['BuiltinModules.AvatarSettings', '头像设置模块'],
  ];

  /**
   * 注册所有模块到 PhoneShell
   * @param {PhoneShell} shell - PhoneShell 实例
   */
  function registerAll(shell) {
    if (!shell) {
      console.error('[PhoneModuleRegistry] shell 为空，无法注册模块');
      return;
    }

    // 注册需要转换的模块
    moduleRegistrations.forEach(function (entry) {
      var pathParts = entry[0].split('.');
      var obj = window;
      for (var i = 0; i < pathParts.length; i++) {
        obj = obj[pathParts[i]];
        if (!obj) break;
      }
      if (obj) {
        shell.registerModule(createModuleObject(obj, entry[1]));
        console.info('[Phone Init] ' + entry[2] + '已注册');
      }
    });

    // 注册已经是普通对象的模块
    directRegistrations.forEach(function (entry) {
      var pathParts = entry[0].split('.');
      var obj = window;
      for (var i = 0; i < pathParts.length; i++) {
        obj = obj[pathParts[i]];
        if (!obj) break;
      }
      if (obj) {
        shell.registerModule(obj);
        console.info('[Phone Init] ' + entry[1] + '已注册');
      } else if (entry[0] === 'BuiltinModules.AvatarSettings') {
        console.warn('[Phone Init] BuiltinModules.AvatarSettings 未加载，跳过头像设置模块');
      }
    });
  }

  window.PhoneModuleRegistry = {
    registerAll: registerAll,
  };

})();
