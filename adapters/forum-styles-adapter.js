/**
 * adapters/forum-styles-adapter.js
 * A 类适配器 — 风格预设，仅被同族模块引用
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.forumStyles || window.ForumStyles;
  if (!instance) return;

  core.container.register('forumStyles', instance);
  core.events.emit('adapter:ready', { name: 'forumStyles' });

  try { delete window.forumStyles; } catch (e) { /* ignore */ }
  try { delete window.ForumStyles; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ forumStyles 已收编');
})();
