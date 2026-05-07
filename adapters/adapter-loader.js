/**
 * adapters/adapter-loader.js
 * 适配器加载器 — 在旧模块全部加载后执行
 * 按依赖顺序加载所有适配器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) {
    console.error('[Adapter Loader] __PHONE_CORE__ 未就绪');
    return;
  }

  var BASE = './scripts/extensions/third-party/mobile/adapters/';

  // 适配器加载顺序（按依赖关系排列）
  var ADAPTERS = [
    // A 类：独立模块（无依赖）
    'style-config-manager-adapter.js',
    'forum-styles-adapter.js',
    'weibo-styles-adapter.js',
    'drag-helper-adapter.js',
    'diagnostic-tool-adapter.js',
    'performance-tester-adapter.js',
    'image-config-modal-adapter.js',
    'mesid-floor-monitor-adapter.js',
    'pending-msg-patch-adapter.js',
    'character-data-isolation-adapter.js',
    'wechat-voice-enhancer-adapter.js',
    'performance-monitor-adapter.js',

    // B 类：核心模块（被其他模块依赖）
    'phone-data-store-adapter.js',

    // 数据层标准化适配器（必须在功能适配器之前加载）
    'domain-data-store-adapter.js',
    'feature-flags-adapter.js',

    'bridge-client-adapter.js',
    'bridge-api-adapter.js',
    'context-monitor-adapter.js',

    // B 类：桥接模块
    'xiaobaix-bridge-adapter.js',
    'role-api-adapter.js',
    'social-api-adapter.js',
    'memory-bridge-adapter.js',
    'worldbook-contact-adapter.js',
    'quick-reply-bridge-adapter.js',

    // B 类：消息核心链
    'friend-renderer-adapter.js',
    'message-renderer-adapter.js',
    'message-sender-adapter.js',
    'message-app-adapter.js',
    'attachment-sender-adapter.js',
    'friends-circle-adapter.js',
    'voice-message-handler-adapter.js',
    'phone-tts-adapter.js',
    'incremental-renderer-adapter.js',

    // B 类：任务系统
    'quest-engine-adapter.js',
    'quest-planner-bridge-adapter.js',
    'quest-app-adapter.js',

    // B 类：论坛/微博
    'forum-manager-adapter.js',
    'forum-auto-listener-adapter.js',
    'forum-ui-adapter.js',
    'forum-control-app-adapter.js',
    'weibo-manager-adapter.js',
    'weibo-auto-listener-adapter.js',
    'weibo-ui-adapter.js',
    'weibo-control-app-adapter.js',

    // 事件桥接（最后加载）
    'event-bridge-adapter.js',
  ];

  var loadedCount = 0;
  var failedCount = 0;

  function loadNext(index) {
    if (index >= ADAPTERS.length) {
      console.log(
        '[Adapter Loader] 完成: ' + loadedCount + ' 成功, ' + failedCount + ' 失败',
      );
      core.events.emit('adapters:all_ready', {
        loaded: loadedCount,
        failed: failedCount,
      });
      return;
    }

    var script = document.createElement('script');
    script.src = BASE + ADAPTERS[index];
    script.onload = function () {
      loadedCount++;
      loadNext(index + 1);
    };
    script.onerror = function () {
      failedCount++;
      console.warn('[Adapter Loader] 适配器加载失败: ' + ADAPTERS[index]);
      loadNext(index + 1);
    };
    document.head.appendChild(script);
  }

  console.log('[Adapter Loader] 开始加载 ' + ADAPTERS.length + ' 个适配器...');
  loadNext(0);
})();
