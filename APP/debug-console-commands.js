/**
 * debug-console-commands.js - 控制台调试命令
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 注册控制台调试命令
   * @param {string} version - 插件版本号
   */
  function register(version) {
    if (!window.MobileContext) window.MobileContext = {};

    window.MobileContext.debugModuleStatus = function () {
      var shell = window.__phoneShell;
      var modules = shell?.getRegisteredModules?.() || [];
      console.group('=== Mobile Context 模块状态 v' + version + ' ===');
      console.log('Platform:', !!window.Platform, window.Platform ? (window.Platform.isReady ? 'READY' : 'NOT READY') : '');
      console.log('PhoneCore:', !!window.PhoneCore);
      console.log('PhoneShell:', !!shell);
      console.log('已注册模块数:', modules.length);
      console.log('已注册模块:', modules.map(function(m) { return m.id + '(' + m.name + ')'; }));
      console.log('MessageModule:', !!window.PhoneModules?.Message);
      console.log('WeiboModule:', !!window.PhoneModules?.Weibo);
      console.log('ApiSettingsModule:', !!window.PhoneModules?.ApiSettings);
      console.log('TTS服务:', !!window.Platform?.getService?.('tts'));
      console.log('插件已初始化:', window.MobileContextPlugin?.isInitialized?.());
      console.log('版本:', version);
      console.groupEnd();
    };

    window.MobileContext.debugSchemaStatus = function () {
      console.group('=== Schema 模块状态 ===');
      console.log('PhoneData.Messages:', !!window.PhoneData?.Messages);
      console.log('PhoneData.Weibo:', !!window.PhoneData?.Weibo);
      console.log('PhoneData.ApiConfig:', !!window.PhoneData?.ApiConfig);
      console.log('PhoneData.FriendsCircle:', !!window.PhoneData?.FriendsCircle);
      console.log('PhoneData.Sticker:', !!window.PhoneData?.Sticker);
      console.log('PhoneData.Friends:', !!window.PhoneData?.Friends);
      console.groupEnd();
    };

    window.MobileContext.debugServiceStatus = function () {
      console.group('=== Platform 服务状态 ===');
      if (window.Platform) {
        console.log('AI:', !!window.Platform.get('AI'));
        console.log('statusService:', !!window.Platform.get('statusService'));
        console.log('directorService:', !!window.Platform.get('directorService'));
        console.log('messageService:', !!window.Platform.get('messageService'));
        console.log('LLMGateway:', !!window.LLMGateway);
      } else {
        console.log('Platform 未就绪');
      }
      console.groupEnd();
    };

    console.log('[Phone Init] 控制台命令已注册: MobileContext.debugModuleStatus(), MobileContext.debugSchemaStatus(), MobileContext.debugServiceStatus()');
  }

  window.PhoneConsoleCommands = {
    register: register,
  };

})();
