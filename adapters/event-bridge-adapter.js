/**
 * adapters/event-bridge-adapter.js
 * 事件桥接适配器 — 统一 5 套旧事件系统到新 EventBus
 *
 * 桥接源：
 * 1. ST 原生事件（eventSource）→ 已在 context-monitor-adapter 中桥接
 * 2. xbEventCenter（小白X 插件事件）→ xb:*
 * 3. 旧 EventBus（bridge-api.js）→ phone:* / variable:*
 * 4. PhoneDataStore 变更订阅 → data:*
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  // === 1. xbEventCenter → 新 EventBus ===
  if (window.xbEventCenter && typeof window.xbEventCenter.on === 'function') {
    window.xbEventCenter.on('variableChanged', function (data) {
      core.events.emit('xb:variableChanged', data);
    });

    // 监听小白X的其他事件
    if (typeof window.xbEventCenter.getEventList === 'function') {
      try {
        var events = window.xbEventCenter.getEventList();
        if (Array.isArray(events)) {
          events.forEach(function (evt) {
            if (evt !== 'variableChanged') {
              window.xbEventCenter.on(evt, function (data) {
                core.events.emit('xb:' + evt, data);
              });
            }
          });
        }
      } catch (e) {
        // getEventList 可能不存在，忽略
      }
    }

    console.log('[Event Bridge] ✅ xbEventCenter 已桥接到新 EventBus');
  }

  // === 2. 旧 EventBus → 新 EventBus ===
  if (window.EventBus && typeof window.EventBus.on === 'function') {
    // 监听旧 EventBus 的所有事件并转发
    // 由于无法枚举已注册事件，我们桥接已知的关键事件
    var KNOWN_EVENTS = [
      'phone:notification',
      'phone:friend_added',
      'phone:friend_removed',
      'phone:friend_updated',
      'engine:ready',
      'engine:error',
      'variable:changed',
      'workflow:completed',
      'workflow:error',
      'workflow:trigger',
    ];

    KNOWN_EVENTS.forEach(function (event) {
      window.EventBus.on(event, function (data) {
        core.events.emit(event, data);
      });
    });

    // 全局通配符监听
    window.EventBus.on('*', function (data) {
      if (data && data.event) {
        core.events.emit('legacy:' + data.event, data.data);
      }
    });

    console.log('[Event Bridge] ✅ 旧 EventBus 已桥接到新 EventBus');
  }

  // === 3. PhoneDataStore 变更 → 新 EventBus ===
  // 已在 phone-data-store-adapter.js 中通过拦截 set() 方法实现
  // 此处补充 moduleReady 事件
  if (window.PhoneDataStore && typeof window.PhoneDataStore.moduleReady === 'function') {
    var originalModuleReady = window.PhoneDataStore.moduleReady.bind(window.PhoneDataStore);
    window.PhoneDataStore.moduleReady = function (moduleName) {
      originalModuleReady(moduleName);
      core.events.emit('module:ready', { name: moduleName });
    };
  }

  console.log('[Event Bridge] ✅ 事件桥接适配器加载完成');
})();
