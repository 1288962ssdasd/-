/**
 * adapters/message-renderer-adapter.js
 * B 类适配器 — 消息渲染器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.messageRenderer;
  if (!instance) return;
  core.container.register('messageRenderer', instance);
  window.messageRenderer.__managed = true;
  core.events.emit('adapter:ready', { name: 'messageRenderer' });
  console.log('[Adapter] ✅ messageRenderer 已收编（B 类）');
})();
