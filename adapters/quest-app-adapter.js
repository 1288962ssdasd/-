/**
 * adapters/quest-app-adapter.js
 * B 类适配器 — 任务应用
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.QuestApp;
  if (!instance) return;
  core.container.register('questApp', instance);
  window.QuestApp.__managed = true;
  core.events.emit('adapter:ready', { name: 'questApp' });
  console.log('[Adapter] ✅ questApp 已收编（B 类）');
})();
