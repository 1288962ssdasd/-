/**
 * adapters/worldbook-contact-adapter.js
 * B 类适配器 — 世界书联系人
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.WorldbookContact;
  if (!instance) return;
  core.container.register('worldbookContact', instance);
  window.WorldbookContact.__managed = true;
  core.events.emit('adapter:ready', { name: 'worldbookContact' });
  console.log('[Adapter] ✅ worldbookContact 已收编（B 类）');
})();
