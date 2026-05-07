/**
 * adapters/role-api-adapter.js
 * B 类适配器 — 外部桥接模块
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;
  var instance = window.RoleAPI;
  if (!instance) return;
  core.container.register('roleAPI', instance);
  window.RoleAPI.__managed = true;
  core.events.emit('adapter:ready', { name: 'roleAPI' });
  console.log('[Adapter] ✅ roleAPI 已收编（B 类）');
})();
