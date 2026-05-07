/**
 * adapters/friend-renderer-adapter.js
 * B 类适配器 — 好友渲染器
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.friendRenderer;
  if (!instance) return;
  core.container.register('friendRenderer', instance);
  window.friendRenderer.__managed = true;
  core.events.emit('adapter:ready', { name: 'friendRenderer' });
  console.log('[Adapter] ✅ friendRenderer 已收编（B 类）');
})();
