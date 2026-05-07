/**
 * adapters/social-api-adapter.js
 * B 类适配器 — 社交 API
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.SocialAPI;
  if (!instance) return;
  core.container.register('socialAPI', instance);
  window.SocialAPI.__managed = true;
  core.events.emit('adapter:ready', { name: 'socialAPI' });
  console.log('[Adapter] ✅ socialAPI 已收编（B 类）');
})();
