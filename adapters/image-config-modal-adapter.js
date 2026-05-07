/**
 * adapters/image-config-modal-adapter.js
 * A 类适配器 — UI 组件，相对独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.ImageConfigModal || window.ImageConfigModalClass;
  if (!instance) return;

  core.container.register('imageConfigModal', instance);

  if (window.FriendImageConfigModal) {
    core.container.register('friendImageConfigModal', window.FriendImageConfigModal);
  }

  core.events.emit('adapter:ready', { name: 'imageConfigModal' });

  try { delete window.ImageConfigModal; } catch (e) { /* ignore */ }
  try { delete window.ImageConfigModalClass; } catch (e) { /* ignore */ }
  try { delete window.FriendImageConfigModal; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ imageConfigModal 已收编');
})();
