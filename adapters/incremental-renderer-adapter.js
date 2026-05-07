/**
 * adapters/incremental-renderer-adapter.js
 * B 类适配器 — 增量渲染器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  if (window.IncrementalRenderer) {
    core.container.register('incrementalRenderer', window.IncrementalRenderer);
    window.IncrementalRenderer.__managed = true;
    core.events.emit('adapter:ready', { name: 'incrementalRenderer' });
    console.log('[Adapter] ✅ incrementalRenderer 已收编（B 类）');
  }
})();
