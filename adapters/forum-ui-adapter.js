/**
 * adapters/forum-ui-adapter.js
 * B 类适配器 — 论坛 UI
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.forumUI;
  if (!instance) return;
  core.container.register('forumUI', instance);
  window.forumUI.__managed = true;
  core.events.emit('adapter:ready', { name: 'forumUI' });
  console.log('[Adapter] ✅ forumUI 已收编（B 类）');
})();
