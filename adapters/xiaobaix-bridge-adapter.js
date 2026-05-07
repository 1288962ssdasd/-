/**
 * adapters/xiaobaix-bridge-adapter.js
 * B 类适配器 — 外部桥接模块
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.XBBridge;
  if (!instance) return;
  core.container.register('xbBridge', instance);
  window.XBBridge.__managed = true;
  core.events.emit('adapter:ready', { name: 'xbBridge' });
  console.log('[Adapter] ✅ xbBridge 已收编（B 类）');
})();
