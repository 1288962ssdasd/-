/**
 * adapters/voice-message-handler-adapter.js
 * B 类适配器 — 语音消息处理器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.voiceMessageHandler;
  if (!instance) return;
  core.container.register('voiceMessageHandler', instance);
  window.voiceMessageHandler.__managed = true;
  core.events.emit('adapter:ready', { name: 'voiceMessageHandler' });
  console.log('[Adapter] ✅ voiceMessageHandler 已收编（B 类）');
})();
