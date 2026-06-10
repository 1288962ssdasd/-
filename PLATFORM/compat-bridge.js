/**
 * Compatibility Bridge
 * 兼容性桥接层
 *
 * 将旧 API (PhoneDataStore, BridgeAPI, ConfigManager 等) 桥接到新 Platform。
 * 允许旧代码无缝运行，同时逐步迁移到新架构。
 */

;(function () {
  'use strict';

  console.log('[CompatBridge] 加载兼容性桥接层...');

  // ==================== PhoneDataStore 兼容层 ====================

  function createPhoneDataStoreBridge() {
    const bridge = {
      _cache: {},
      _subscribers: {},
      _idCounter: 0,

      get(key) {
        // 优先从 Platform DataStore 读取
        if (window.Platform?.isReady) {
          const parts = key.split('.');
          const domain = parts[0];
          const subKey = parts.slice(1).join('.');
          return window.Platform.dataSync(domain, subKey, this._cache[key]);
        }
        return this._cache[key];
      },

      set(key, value, options = {}) {
        // [Bug修复] 先保存旧值，再更新缓存
        const oldValue = this._cache[key];
        this._cache[key] = value;

        // 同步到 Platform DataStore
        if (window.Platform?.isReady && options.persist !== false) {
          const parts = key.split('.');
          const domain = parts[0];
          const subKey = parts.slice(1).join('.');
          window.Platform.setData(domain, subKey, value, options);
        }

        // 触发订阅（传入旧值）
        this._emit(key, value, oldValue);

        return true;
      },

      batch(items) {
        for (const item of items) {
          this.set(item.key, item.value, { persist: false });
        }
        return true;
      },

      delete(key) {
        delete this._cache[key];

        if (window.Platform?.isReady) {
          const parts = key.split('.');
          const domain = parts[0];
          const subKey = parts.slice(1).join('.');
          // Platform DataStore 的 delete 需要异步
          if (window.Platform.dataStore?.delete) {
            window.Platform.dataStore.delete(domain, subKey).catch((e) => {
              console.warn('[CompatBridge] delete 异步删除失败:', e);
            });
          } else if (window.Platform.setData) {
            // 降级：通过写入 null 标记删除
            window.Platform.setData(domain, subKey, null);
          }
        }

        // 触发订阅通知
        this._emit(key, undefined, undefined);

        return true;
      },

      subscribe(key, callback) {
        if (typeof callback !== 'function') return () => {};

        const id = 'sub_' + (++this._idCounter);
        if (!this._subscribers[key]) {
          this._subscribers[key] = [];
        }
        this._subscribers[key].push({ id, callback });

        // 立即触发一次
        const currentValue = this.get(key);
        if (currentValue !== undefined) {
          setTimeout(() => {
            try {
              callback(currentValue, undefined, { immediate: true });
            } catch (e) { console.warn('[CompatBridge] subscribe callback error:', e); }
          }, 0);
        }

        // 同时订阅 Platform DataStore
        if (window.Platform?.isReady) {
          const parts = key.split('.');
          const domain = parts[0];
          const subKey = parts.slice(1).join('.');
          const unsubscribe = window.Platform.subscribeData(domain, subKey, (value) => {
            const oldValue = this._cache[key];  // [Bug修复] 先保存旧值
            this._cache[key] = value;
            callback(value, oldValue, { source: 'Platform' });
          });

          return () => {
            this._unsubscribe(key, id);
            unsubscribe();
          };
        }

        return () => this._unsubscribe(key, id);
      },

      _unsubscribe(key, id) {
        const list = this._subscribers[key];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id === id) {
            list.splice(i, 1);
            break;
          }
        }
      },

      _emit(key, value, oldValue) {
        const list = this._subscribers[key];
        if (!list) return;
        for (const sub of list) {
          try {
            sub.callback(value, oldValue, { source: 'PhoneDataStore' });
          } catch (e) { console.warn('[CompatBridge] subscriber notify error:', e); }
        }
      },

      // 异步方法
      async loadFromVar(key, varPath) {
        if (!window.Platform?.isReady) return null;

        try {
          const value = await window.Platform.adapter.read(varPath);
          if (value !== null) {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            this.set(key, parsed, { persist: false });
            return parsed;
          }
        } catch (e) { /* JSON 解析失败，返回 null（预期行为） */ }

        return null;
      },

      forcePersist() {
        if (window.Platform?.dataStore) {
          window.Platform.dataStore.forceFlush();
        }
      },

      exportAll() {
        return { ...this._cache };
      },

      clear() {
        this._cache = {};
        this._subscribers = {};
      },

      debug() {
        console.log('[PhoneDataStore] 缓存:', Object.keys(this._cache));
        console.log('[PhoneDataStore] 订阅:', Object.keys(this._subscribers));
      },
    };

    return bridge;
  }

  // ==================== ConfigManager 兼容层 ====================

  function createConfigManagerBridge() {
    const bridge = {
      _cache: null,
      _cacheTime: 0,
      CACHE_TTL: 30000,
      _varCache: {},
      _varCacheTTL: 500,

      defaults: {
        'xb.phone.api.enabled': 'true',
        'xb.phone.api.url': '',
        'xb.phone.api.key': '',
        'xb.phone.api.model': '',
        'xb.phone.api.temperature': '0.8',
        'xb.phone.api.maxTokens': '500',
      },

      init() {
        console.log('[ConfigManager] 桥接模式');
      },

      async _readVar(key) {
        if (!window.Platform?.isReady) {
          return this.defaults[key] || null;
        }

        // 检查缓存
        const now = Date.now();
        const cached = this._varCache[key];
        if (cached && (now - cached.time) < this._varCacheTTL) {
          return cached.value;
        }

        try {
          const value = await window.Platform.adapter.read(key);
          const result = value !== null ? value : (this.defaults[key] || null);

          // 更新缓存
          this._varCache[key] = { value: result, time: now };

          return result;
        } catch (e) {
          return this.defaults[key] || null;
        }
      },

      async _writeVar(key, value) {
        if (!window.Platform?.isReady) return false;

        try {
          const success = await window.Platform.adapter.write(key, value);
          if (success) {
            delete this._varCache[key];
          }
          return success;
        } catch (e) {
          return false;
        }
      },

      async get(key) {
        return this._readVar(key);
      },

      getSync(key) {
        // 仅从缓存读取
        const cached = this._varCache[key];
        return cached ? cached.value : (this.defaults[key] || null);
      },

      async set(key, value) {
        return this._writeVar(key, value);
      },

      async getAll() {
        // 批量读取默认值
        const result = {};
        for (const key of Object.keys(this.defaults)) {
          result[key] = await this.get(key);
        }
        return result;
      },

      onChange(callback) {
        // 订阅变量变更
        if (window.Platform?.adapter) {
          return window.Platform.adapter.onVariableChange((key, value) => {
            callback(key, value);
          });
        }
        return () => {};
      },
    };

    return bridge;
  }

  // ==================== BridgeAPI 兼容层 ====================

  function createBridgeAPIBridge() {
    const bridge = {
      EventBus: {
        _handlers: {},

        on(event, handler) {
          if (!this._handlers[event]) {
            this._handlers[event] = [];
          }
          this._handlers[event].push(handler);

          // 同时订阅 Platform 事件
          if (window.Platform?.isReady) {
            const unsubscribe = window.Platform.on(event, handler);
            return () => {
              this.off(event, handler);
              unsubscribe();
            };
          }

          return () => this.off(event, handler);
        },

        off(event, handler) {
          if (!this._handlers[event]) return;
          this._handlers[event] = this._handlers[event].filter(h => h !== handler);
        },

        emit(event, data) {
          // 触发本地处理器
          const handlers = this._handlers[event];
          if (handlers) {
            for (const h of handlers) {
              try { h(data); } catch (e) { console.warn('[CompatBridge] event handler error:', e); }
            }
          }
        },
      },

      async getVar(key) {
        if (!window.Platform?.isReady) return null;
        return window.Platform.adapter.read(key);
      },

      async setVar(key, value) {
        if (!window.Platform?.isReady) return false;
        return window.Platform.adapter.write(key, value);
      },

      // [修复] 添加 _readVar 和 _writeVar 方法，兼容旧代码
      async _readVar(key) {
        if (!window.Platform?.isReady) {
          // 降级到 BridgeAPI.ConfigManager
          if (window.BridgeAPI?.ConfigManager?._readVar) {
            return window.BridgeAPI.ConfigManager._readVar(key);
          }
          return null;
        }
        return window.Platform.adapter.read(key);
      },

      async _writeVar(key, value) {
        if (!window.Platform?.isReady) {
          // 降级到 BridgeAPI.ConfigManager
          if (window.BridgeAPI?.ConfigManager?._writeVar) {
            return window.BridgeAPI.ConfigManager._writeVar(key, value);
          }
          return false;
        }
        return window.Platform.adapter.write(key, value);
      },

      init() {
        console.log('[BridgeAPI] 桥接模式');
      },
    };

    return bridge;
  }

  // ==================== 安装桥接 ====================

  function installCompatBridge() {
    // 保存原始引用（如果存在）
    const originalPhoneDataStore = window.PhoneDataStore;
    const originalConfigManager = window.ConfigManager;
    const originalBridgeAPI = window.BridgeAPI;

    // 创建桥接
    const phoneDataStoreBridge = createPhoneDataStoreBridge();
    const configManagerBridge = createConfigManagerBridge();
    const bridgeAPIBridge = createBridgeAPIBridge();

    // 安装桥接（延迟到 Platform 就绪后）
    const install = () => {
      // PhoneDataStore
      if (!window.PhoneDataStore || window.PhoneDataStore === originalPhoneDataStore) {
        window.PhoneDataStore = phoneDataStoreBridge;
        console.log('[CompatBridge] PhoneDataStore 已桥接');
      }

      // ConfigManager
      if (!window.ConfigManager || window.ConfigManager === originalConfigManager) {
        window.ConfigManager = configManagerBridge;
        console.log('[CompatBridge] ConfigManager 已桥接');
      }

      // BridgeAPI
      if (!window.BridgeAPI || window.BridgeAPI === originalBridgeAPI) {
        window.BridgeAPI = bridgeAPIBridge;
        console.log('[CompatBridge] BridgeAPI 已桥接');
      }
    };

    // 立即安装
    install();

    // Platform 就绪后重新安装（确保覆盖）
    if (window.Platform) {
      window.Platform.on('platform:ready', () => {
        console.log('[CompatBridge] Platform 就绪，重新安装桥接');
        install();
      });
    }

    console.log('[CompatBridge] 兼容性桥接层已安装');
  }

  // 执行安装
  installCompatBridge();

  // 暴露安装函数（允许手动重新安装）
  window.installCompatBridge = installCompatBridge;
})();
