/**
 * adapters/context-monitor-adapter.js
 * B 类适配器 — 13 种 ST 事件桥接到新 EventBus
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var ContextMonitor = window.ContextMonitor;
  var monitor = window.contextMonitor;
  if (!monitor) { console.warn('[Adapter] contextMonitor: contextMonitor 不存在'); return; }

  core.container.register('contextMonitor', monitor);
  core.container.register('ContextMonitor', ContextMonitor);

  // 事件映射：ST 事件 → 新 EventBus 事件
  var EVENT_MAP = {
    message_sent: 'message:sent',
    message_received: 'message:received',
    message_edited: 'message:edited',
    message_deleted: 'message:deleted',
    message_swiped: 'message:swiped',
    chat_id_changed: 'chat:changed',
    character_selected: 'character:selected',
    generation_started: 'generation:started',
    generation_stopped: 'generation:stopped',
    generation_ended: 'generation:ended',
    settings_loaded: 'settings:loaded',
    extension_settings_loaded: 'extension_settings:loaded',
  };

  // 桥接 ST 事件到新 EventBus
  if (window.eventSource) {
    var eventTypes = window.event_types || {};
    Object.keys(EVENT_MAP).forEach(function (stEvent) {
      var stType = eventTypes[stEvent] || stEvent;
      window.eventSource.on(stType, function () {
        core.events.emit(EVENT_MAP[stEvent], { source: 'st', args: Array.prototype.slice.call(arguments) });
      });
    });
  }

  // B 类：标记已管理
  window.ContextMonitor.__managed = true;
  window.contextMonitor.__managed = true;
  core.events.emit('adapter:ready', { name: 'contextMonitor' });

  console.log('[Adapter] ✅ contextMonitor 已收编（B 类，12 种 ST 事件已桥接）');
})();
