/**
 * adapters/forum-control-app-adapter.js
 * B 类适配器 — 论坛控制应用
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.forumControlApp;
  if (!instance) return;
  core.container.register('forumControlApp', instance);
  window.forumControlApp.__managed = true;
  core.events.emit('adapter:ready', { name: 'forumControlApp' });
  console.log('[Adapter] ✅ forumControlApp 已收编（B 类）');
})();
