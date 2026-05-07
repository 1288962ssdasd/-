/**
 * adapters/weibo-manager-adapter.js
 * B 类适配器 — 微博核心
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.weiboManager;
  if (!instance) return;
  core.container.register('weiboManager', instance);
  window.weiboManager.__managed = true;
  core.events.emit('adapter:ready', { name: 'weiboManager' });
  console.log('[Adapter] ✅ weiboManager 已收编（B 类）');
})();
