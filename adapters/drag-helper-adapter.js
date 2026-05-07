/**
 * adapters/drag-helper-adapter.js
 * A 类适配器 — 通用工具，独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var DragHelper = window.DragHelper;
  if (!DragHelper) return;

  core.container.register('dragHelper', DragHelper);
  core.events.emit('adapter:ready', { name: 'dragHelper' });

  try { delete window.DragHelper; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ dragHelper 已收编');
})();
