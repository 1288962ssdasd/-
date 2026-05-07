/**
 * adapters/style-config-manager-adapter.js
 * A 类适配器 — 纯 UI 配置，无内部依赖者
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) { console.warn('[Adapter] styleConfigManager: __PHONE_CORE__ 未就绪'); return; }

  var instance = window.styleConfigManager || window.StyleConfigManager;
  if (!instance) { console.warn('[Adapter] styleConfigManager: 实例不存在'); return; }

  core.container.register('styleConfigManager', instance);
  core.events.emit('adapter:ready', { name: 'styleConfigManager' });

  // A 类：可安全删除 window 挂载
  try { delete window.styleConfigManager; } catch (e) { /* ignore */ }
  try { delete window.StyleConfigManager; } catch (e) { /* ignore */ }
  try { delete window.getStyleConfigAppContent; } catch (e) { /* ignore */ }
  try { delete window.bindStyleConfigEvents; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ styleConfigManager 已收编');
})();
