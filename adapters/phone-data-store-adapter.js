/**
 * adapters/phone-data-store-adapter.js
 * B 类适配器 — 核心数据层，被多个模块内部引用
 * 不能 delete window.PhoneDataStore，标记 __managed
 */
;(function () {
  'use strict';
  var core = window.__PHONE_CORE__;
  if (!core) return;

  var store = window.PhoneDataStore;
  if (!store) { console.warn('[Adapter] phoneDataStore: PhoneDataStore 不存在'); return; }

  core.container.register('phoneDataStore', store);

  // 桥接 PhoneDataStore 的 subscribe → 新 EventBus
  // 将 data:{key}:changed 事件桥接到新 EventBus
  var originalSubscribe = store.subscribe.bind(store);
  store._coreBridge = {
    subscribe: function (key, callback) {
      // 在新 EventBus 上监听数据变更
      core.events.on('data:' + key + ':changed', function (data) {
        callback(data.value, data.oldValue);
      });
      // 同时保留旧订阅
      return originalSubscribe(key, callback);
    },
  };

  // 拦截 set 方法，广播到新 EventBus
  var originalSet = store.set.bind(store);
  store.set = function (key, value, options) {
    var oldValue = store.get(key);
    var result = originalSet(key, value, options);
    core.events.emit('data:' + key + ':changed', { key: key, value: value, oldValue: oldValue });
    return result;
  };

  // B 类：标记已管理，不删除 window
  window.PhoneDataStore.__managed = true;
  core.events.emit('adapter:ready', { name: 'phoneDataStore' });

  console.log('[Adapter] ✅ phoneDataStore 已收编（B 类，保留 window 挂载）');
})();
