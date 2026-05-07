/**
 * adapters/pending-msg-patch-adapter.js
 * A 类适配器 — 补丁模块，相对独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.PendingMsgPatch;
  if (!instance) return;

  core.container.register('pendingMsgPatch', instance, {
    destroy: function () {
      if (typeof instance.destroy === 'function') {
        instance.destroy();
      }
    },
  });
  core.events.emit('adapter:ready', { name: 'pendingMsgPatch' });

  try { delete window.PendingMsgPatch; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ pendingMsgPatch 已收编');
})();
