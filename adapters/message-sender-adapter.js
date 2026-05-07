/**
 * adapters/message-sender-adapter.js
 * B 类适配器 — 消息发送器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.messageSender;
  if (!instance) return;
  core.container.register('messageSender', instance);
  window.messageSender.__managed = true;
  core.events.emit('adapter:ready', { name: 'messageSender' });
  console.log('[Adapter] ✅ messageSender 已收编（B 类）');
})();
