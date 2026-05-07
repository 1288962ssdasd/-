/**
 * adapters/forum-manager-adapter.js
 * B 类适配器 — 论坛核心
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.forumManager;
  if (!instance) return;
  core.container.register('forumManager', instance);
  window.forumManager.__managed = true;
  core.events.emit('adapter:ready', { name: 'forumManager' });
  console.log('[Adapter] ✅ forumManager 已收编（B 类）');
})();
