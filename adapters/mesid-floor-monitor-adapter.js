/**
 * adapters/mesid-floor-monitor-adapter.js
 * A 类适配器 — 监控工具，独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.mesidFloorMonitor || window.MesIDFloorMonitor;
  if (!instance) return;

  core.container.register('mesidFloorMonitor', instance);
  core.events.emit('adapter:ready', { name: 'mesidFloorMonitor' });

  try { delete window.mesidFloorMonitor; } catch (e) { /* ignore */ }
  try { delete window.MesIDFloorMonitor; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ mesidFloorMonitor 已收编');
})();
