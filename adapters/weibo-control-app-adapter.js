/**
 * adapters/weibo-control-app-adapter.js
 * B 类适配器 — 微博控制应用
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.weiboControlApp;
  if (!instance) return;
  core.container.register('weiboControlApp', instance);
  window.weiboControlApp.__managed = true;
  core.events.emit('adapter:ready', { name: 'weiboControlApp' });
  console.log('[Adapter] ✅ weiboControlApp 已收编（B 类）');
})();
