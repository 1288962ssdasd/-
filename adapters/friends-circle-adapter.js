/**
 * adapters/friends-circle-adapter.js
 * B 类适配器 — 朋友圈
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.FriendsCircle;
  if (!instance) return;
  core.container.register('friendsCircle', instance);
  window.FriendsCircle.__managed = true;
  core.events.emit('adapter:ready', { name: 'friendsCircle' });
  console.log('[Adapter] ✅ friendsCircle 已收编（B 类）');
})();
