/**
 * adapters/performance-tester-adapter.js
 * A 类适配器 — 性能测试工具，独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.mobilePerformanceTester || window.MobilePerformanceTester;
  if (!instance) return;

  core.container.register('performanceTester', instance);

  if (window.runMobilePerformanceTest) {
    core.container.register('runMobilePerformanceTest', window.runMobilePerformanceTest);
  }
  if (window.exportMobilePerformanceResults) {
    core.container.register('exportMobilePerformanceResults', window.exportMobilePerformanceResults);
  }

  core.events.emit('adapter:ready', { name: 'performanceTester' });

  try { delete window.mobilePerformanceTester; } catch (e) { /* ignore */ }
  try { delete window.MobilePerformanceTester; } catch (e) { /* ignore */ }
  try { delete window.runMobilePerformanceTest; } catch (e) { /* ignore */ }
  try { delete window.exportMobilePerformanceResults; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ performanceTester 已收编');
})();
