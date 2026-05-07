/**
 * adapters/quest-engine-adapter.js
 * B 类适配器 — 任务引擎
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.QuestEngine;
  if (!instance) return;
  core.container.register('questEngine', instance);
  window.QuestEngine.__managed = true;
  core.events.emit('adapter:ready', { name: 'questEngine' });
  console.log('[Adapter] ✅ questEngine 已收编（B 类）');
})();
