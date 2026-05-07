/**
 * adapters/character-data-isolation-adapter.js
 * A 类适配器 — 数据隔离，相对独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.characterDataIsolation || window.CharacterDataIsolation;
  if (!instance) return;

  core.container.register('characterDataIsolation', instance);
  core.events.emit('adapter:ready', { name: 'characterDataIsolation' });

  try { delete window.characterDataIsolation; } catch (e) { /* ignore */ }
  try { delete window.CharacterDataIsolation; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ characterDataIsolation 已收编');
})();
