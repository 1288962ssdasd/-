/**
 * adapters/forum-auto-listener-adapter.js
 * B 类适配器 — 论坛自动监听
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.forumAutoListener;
  if (!instance) return;
  core.container.register('forumAutoListener', instance);
  window.forumAutoListener.__managed = true;
  core.events.emit('adapter:ready', { name: 'forumAutoListener' });
  console.log('[Adapter] ✅ forumAutoListener 已收编（B 类）');
})();
