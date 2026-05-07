/**
 * adapters/performance-monitor-adapter.js
 * A 类适配器 — 性能监控，独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.mobilePerformanceMonitor || window.PerformanceMonitor;
  if (!instance) return;

  core.container.register('performanceMonitor', instance);

  if (window.MOBILE_PERFORMANCE_CONFIG) {
    core.container.register('performanceConfig', window.MOBILE_PERFORMANCE_CONFIG);
  }

  core.events.emit('adapter:ready', { name: 'performanceMonitor' });

  try { delete window.mobilePerformanceMonitor; } catch (e) { /* ignore */ }
  try { delete window.PerformanceMonitor; } catch (e) { /* ignore */ }
  try { delete window.MOBILE_PERFORMANCE_CONFIG; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ performanceMonitor 已收编');
})();
