/**
 * adapters/phone-tts-adapter.js
 * B 类适配器 — TTS 语音合成
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.phoneTTS;
  if (!instance) return;
  core.container.register('phoneTTS', instance);
  window.phoneTTS.__managed = true;
  core.events.emit('adapter:ready', { name: 'phoneTTS' });
  console.log('[Adapter] ✅ phoneTTS 已收编（B 类）');
})();
