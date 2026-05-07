/**
 * adapters/message-app-adapter.js
 * B 类适配器 — 消息核心链
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.MessageApp;
  if (!instance) return;
  core.container.register('messageApp', instance);
  window.MessageApp.__managed = true;
  core.events.emit('adapter:ready', { name: 'messageApp' });
  console.log('[Adapter] ✅ messageApp 已收编（B 类）');
})();
