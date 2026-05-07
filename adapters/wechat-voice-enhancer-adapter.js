/**
 * adapters/wechat-voice-enhancer-adapter.js
 * A 类适配器 — 当前被跳过，独立
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var instance = window.WechatVoiceEnhancer;
  if (!instance) return;

  core.container.register('wechatVoiceEnhancer', instance);
  core.events.emit('adapter:ready', { name: 'wechatVoiceEnhancer' });

  try { delete window.WechatVoiceEnhancer; } catch (e) { /* ignore */ }

  console.log('[Adapter] ✅ wechatVoiceEnhancer 已收编');
})();
