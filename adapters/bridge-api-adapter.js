/**
 * adapters/bridge-api-adapter.js
 * B 类适配器 — 核心枢纽，被几乎所有模块引用
 * 拆分子模块注册：ConfigManager, EventBus, UnifiedAI, PhoneEngine, WorkflowEngine
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var api = window.BridgeAPI;
  if (!api) { console.warn('[Adapter] bridgeAPI: BridgeAPI 不存在'); return; }

  // 注册主对象
  core.container.register('bridgeAPI', api);

  // 拆分子模块注册
  if (api.ConfigManager) {
    core.container.register('configManager', api.ConfigManager);
  }
  if (api.UnifiedAI) {
    core.container.register('unifiedAI', api.UnifiedAI);
  }
  if (api.WorkflowEngine) {
    core.container.register('workflowEngine', api.WorkflowEngine);
  }

  // 收编其他全局变量
  if (window.PhoneConfig) {
    core.container.register('phoneConfig', window.PhoneConfig);
    window.PhoneConfig.__managed = true;
  }
  if (window.PhoneEngine) {
    core.container.register('phoneEngine', window.PhoneEngine);
    window.PhoneEngine.__managed = true;
  }
  if (window.UnifiedAI) {
    window.UnifiedAI.__managed = true;
  }
  if (window.WorkflowEngine) {
    window.WorkflowEngine.__managed = true;
  }
  if (window.ConfigManager) {
    window.ConfigManager.__managed = true;
  }
  if (typeof window.syncToPhone === 'function') {
    core.container.register('syncToPhone', window.syncToPhone);
  }

  // B 类：标记已管理
  window.BridgeAPI.__managed = true;
  core.events.emit('adapter:ready', { name: 'bridgeAPI' });

  console.log('[Adapter] ✅ bridgeAPI 已收编（B 类，保留 window 挂载）');
})();
