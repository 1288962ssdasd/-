/**
 * adapters/diagnostic-tool-adapter.js
 * A 类适配器 — 诊断工具，独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.mobileDiagnosticTool;
  if (!instance) return;

  core.container.register('diagnosticTool', instance);

  // 收编全局函数
  if (window.diagnoseMobilePlugin) {
    core.container.register('diagnoseMobilePlugin', window.diagnoseMobilePlugin);
  }
  if (window.checkMobileOptimization) {
    core.container.register('checkMobileOptimization', window.checkMobileOptimization);
  }
  if (window.fixMobilePlugin) {
    core.container.register('fixMobilePlugin', window.fixMobilePlugin);
  }
  if (window.reloadMobileModules) {
    core.container.register('reloadMobileModules', window.reloadMobileModules);
  }

  core.events.emit('adapter:ready', { name: 'diagnosticTool' });

  try { delete window.mobileDiagnosticTool; } catch (e) { /* ignore */ }
  try { delete window.diagnoseMobilePlugin; } catch (e) { /* ignore */ }
  try { delete window.checkMobileOptimization; } catch (e) { /* ignore */ }
  try { delete window.fixMobilePlugin; } catch (e) { /* ignore */ }
  try { delete window.reloadMobileModules; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ diagnosticTool 已收编');
})();
