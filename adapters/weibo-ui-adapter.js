/**
 * adapters/weibo-ui-adapter.js
 * B 类适配器 — 微博 UI
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.weiboUI;
  if (!instance) return;
  core.container.register('weiboUI', instance);
  window.weiboUI.__managed = true;
  core.events.emit('adapter:ready', { name: 'weiboUI' });
  console.log('[Adapter] ✅ weiboUI 已收编（B 类）');
})();
