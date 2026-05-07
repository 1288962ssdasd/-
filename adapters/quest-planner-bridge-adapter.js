/**
 * adapters/quest-planner-bridge-adapter.js
 * B 类适配器 — 任务规划桥接
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.QuestPlannerBridge;
  if (!instance) return;
  core.container.register('questPlannerBridge', instance);
  window.QuestPlannerBridge.__managed = true;
  core.events.emit('adapter:ready', { name: 'questPlannerBridge' });
  console.log('[Adapter] ✅ questPlannerBridge 已收编（B 类）');
})();
