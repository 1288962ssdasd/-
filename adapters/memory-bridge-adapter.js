/**
 * adapters/memory-bridge-adapter.js
 * B 类适配器 — 记忆桥接
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.MemoryBridge;
  if (!instance) return;
  core.container.register('memoryBridge', instance);
  window.MemoryBridge.__managed = true;
  core.events.emit('adapter:ready', { name: 'memoryBridge' });
  console.log('[Adapter] ✅ memoryBridge 已收编（B 类）');
})();
