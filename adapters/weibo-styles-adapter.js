/**
 * adapters/weibo-styles-adapter.js
 * A 类适配器 — 风格预设，仅被同族模块引用
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.weiboStyles || window.WeiboStyles;
  if (!instance) return;

  core.container.register('weiboStyles', instance);
  core.events.emit('adapter:ready', { name: 'weiboStyles' });

  try { delete window.weiboStyles; } catch (e) { /* ignore */ }
  try { delete window.WeiboStyles; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ weiboStyles 已收编');
})();
