/**
 * adapters/bridge-client-adapter.js
 * B 类适配器 — WebSocket 客户端（FIX-3 已修复紧耦合）
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var client = window.BridgeClient;
  if (!client) { console.warn('[Adapter] bridgeClient: BridgeClient 不存在'); return; }

  core.container.register('bridgeClient', client, {
    destroy: function () {
      if (typeof client.destroy === 'function') {
        client.destroy();
      }
    },
  });

  // 桥接连接状态事件到新 EventBus
  if (typeof client.on === 'function') {
    client.on('connected', function () {
      core.events.emit('bridge:connected', {});
    });
    client.on('disconnected', function () {
      core.events.emit('bridge:disconnected', {});
    });
    client.on('error', function (data) {
      core.events.emit('bridge:error', { error: data });
    });
  }

  // B 类：标记已管理
  window.BridgeClient.__managed = true;
  core.events.emit('adapter:ready', { name: 'bridgeClient' });

  console.log('[Adapter] ✅ bridgeClient 已收编（B 类，保留 window 挂载）');
})();
