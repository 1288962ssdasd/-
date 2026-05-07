/**
 * adapters/quick-reply-bridge-adapter.js
 * B 类适配器 — 快捷回复桥接
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.QuickReplyBridge;
  if (!instance) return;
  core.container.register('quickReplyBridge', instance);
  window.QuickReplyBridge.__managed = true;
  core.events.emit('adapter:ready', { name: 'quickReplyBridge' });
  console.log('[Adapter] ✅ quickReplyBridge 已收编（B 类）');
})();
