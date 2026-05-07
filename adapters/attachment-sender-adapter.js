/**
 * adapters/attachment-sender-adapter.js
 * B 类适配器 — 附件发送器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.attachmentSender;
  if (!instance) return;
  core.container.register('attachmentSender', instance);
  window.attachmentSender.__managed = true;
  core.events.emit('adapter:ready', { name: 'attachmentSender' });
  console.log('[Adapter] ✅ attachmentSender 已收编（B 类）');
})();
