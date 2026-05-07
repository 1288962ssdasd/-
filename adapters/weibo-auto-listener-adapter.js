/**
 * adapters/weibo-auto-listener-adapter.js
 * B 类适配器 — 微博自动监听
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.weiboAutoListener;
  if (!instance) return;
  core.container.register('weiboAutoListener', instance);
  window.weiboAutoListener.__managed = true;
  core.events.emit('adapter:ready', { name: 'weiboAutoListener' });
  console.log('[Adapter] ✅ weiboAutoListener 已收编（B 类）');
})();
