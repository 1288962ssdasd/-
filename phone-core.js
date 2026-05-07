/**
 * phone-core.js - 外置手机核心层
 *
 * 职责：
 * 1. 建立 window.__PHONE_CORE__ 命名空间（ServiceContainer + EventBus）
 * 2. 初始化 FeatureFlags（功能旗标管理器）
 * 3. 初始化 DomainDataStore（领域数据存储）
 * 4. 注册默认领域和路径映射
 * 5. 桥接 PhoneDataStore <-> ConfigManager/BridgeAPI
 *
 * 必须在 phone-data-store.js 之后、其他适配器之前加载
 */
;(function () {
  'use strict';

  // 防重入
  if (window.__PHONE_CORE__) {
    console.log('[Phone Core] 核心层已加载，跳过');
    return;
  }

  console.log('[Phone Core] 正在初始化核心层...');

  // ============================================================
  // 第一部分：EventBus（轻量事件总线）
  // ============================================================
  var EventBus = {
    _handlers: {},

    on: function (event, handler) {
      if (!this._handlers[event]) this._handlers[event] = [];
      this._handlers[event].push(handler);
    },

    off: function (event, handler) {
      if (!this._handlers[event]) return;
      this._handlers[event] = this._handlers[event].filter(function (h) { return h !== handler; });
    },

    emit: function (event, data) {
      var handlers = this._handlers[event];
      if (!handlers || handlers.length === 0) return;
      handlers.forEach(function (h) {
        try { h(data); } catch (e) { console.error('[EventBus] 事件处理错误:', event, e); }
      });
    }
  };

  // ============================================================
  // 第二部分：ServiceContainer（轻量服务容器）
  // ============================================================
  var ServiceContainer = {
    _services: {},

    register: function (name, instance) {
      this._services[name] = instance;
    },

    get: function (name) {
      return this._services[name] || null;
    },

    has: function (name) {
      return name in this._services;
    }
  };

  // ============================================================
  // 第三部分：建立 __PHONE_CORE__ 命名空间
  // ============================================================
  window.__PHONE_CORE__ = {
    container: ServiceContainer,
    events: EventBus,
    version: '1.0.0',
    ready: true
  };

  // 同时暴露到全局，方便适配器使用
  window.EventBus = EventBus;

  console.log('[Phone Core] __PHONE_CORE__ 命名空间已建立');

  // ============================================================
  // 第四部分：FeatureFlags（功能旗标管理器）
  // ============================================================
  var FeatureFlags = {
    _flags: {},
    _strategies: {},
    _defaults: {},

    init: function (flags) {
      this._flags = Object.assign({}, flags);
      this._defaults = Object.assign({}, flags);
      ServiceContainer.register('featureFlags', this);
      console.log('[FeatureFlags] 已初始化:', Object.keys(this._flags));
    },

    get: function (name) {
      return this._flags[name];
    },

    set: function (name, value) {
      var oldValue = this._flags[name];
      if (oldValue === value) return;
      this._flags[name] = value;
      EventBus.emit('feature-flag:changed', { name: name, value: value, oldValue: oldValue });
    },

    registerStrategy: function (moduleName, strategyType, config) {
      config = config || {};
      this._strategies[moduleName] = { type: strategyType, config: config };
    },

    shouldActivate: function (moduleName) {
      var info = this._strategies[moduleName];
      if (!info) return true;

      switch (info.type) {
        case 'config-driven':
          return this._flags[info.config.flagName] === true;
        case 'config-and-state':
          if (this._flags[info.config.flagName] !== true) return false;
          if (info.config.dataDependency && window.PhoneDataStore) {
            var data = window.PhoneDataStore.get(info.config.dataDependency);
            return Array.isArray(data) ? data.length > 0 : !!data;
          }
          return true;
        case 'normal':
        default:
          return info.config.alwaysActive !== false;
      }
    },

    getAll: function () { return Object.assign({}, this._flags); },
    reset: function () { this._flags = Object.assign({}, this._defaults); }
  };

  window.FeatureFlags = FeatureFlags;

  // 默认 flag 配置
  FeatureFlags.init({
    'new-forum-ui': false,
    'new-weibo-ui': false,
    'quest-app': true,
    'friends-circle': true,
    'shop-app': true,
    'diary-app': true
  });

  // 注册模块策略
  FeatureFlags.registerStrategy('forum-ui', 'config-driven', { flagName: 'new-forum-ui' });
  FeatureFlags.registerStrategy('weibo-ui', 'config-driven', { flagName: 'new-weibo-ui' });
  FeatureFlags.registerStrategy('quest-app', 'normal', { alwaysActive: true });
  FeatureFlags.registerStrategy('friends-circle', 'normal', { alwaysActive: true });
  FeatureFlags.registerStrategy('shop-app', 'normal', { alwaysActive: true });
  FeatureFlags.registerStrategy('diary-app', 'normal', { alwaysActive: true });

  console.log('[Phone Core] FeatureFlags 已初始化');

  // ============================================================
  // 第五部分：DomainDataStore（领域数据存储）
  // ============================================================
  var DomainDataStore = {
    _domains: {},
    _pathMappings: {},

    register: function (domain, config) {
      config = config || {};
      this._domains[domain] = {
        schema: config.schema || {},
        version: config.version || 1,
        retention: config.retention || null
      };
      console.log('[DomainDataStore] 注册领域:', domain, 'v' + config.version);
    },

    registerPathMapping: function (storagePath, domain, key) {
      this._pathMappings[storagePath] = { domain: domain, key: key };
    },

    resolvePath: function (storagePath) {
      return this._pathMappings[storagePath] || null;
    },

    toStoragePath: function (domain, key) {
      for (var path in this._pathMappings) {
        var m = this._pathMappings[path];
        if (m.domain === domain && m.key === key) return path;
      }
      return domain + '.' + key;
    },

    get: function (domainKey) {
      if (window.PhoneDataStore) {
        return window.PhoneDataStore.get(domainKey);
      }
      return undefined;
    },

    set: function (domainKey, value, options) {
      if (window.PhoneDataStore) {
        window.PhoneDataStore.set(domainKey, value, options);
        return true;
      }
      return false;
    },

    hasDomain: function (domain) {
      return domain in this._domains;
    },

    getDomains: function () {
      return Object.keys(this._domains);
    }
  };

  window.DomainDataStore = DomainDataStore;
  ServiceContainer.register('domainDataStore', DomainDataStore);

  // ============================================================
  // 第六部分：注册默认领域和路径映射
  // ============================================================
  var DEFAULT_DOMAINS = [
    { name: 'forum',         version: 1, retention: { display: 50, maxAge: 7*24*3600000 } },
    { name: 'weibo',         version: 1, retention: { display: 50, maxAge: 7*24*3600000 } },
    { name: 'chat',          version: 1, retention: { display: 100, maxAge: 30*24*3600000 } },
    { name: 'quest',         version: 1, retention: null },
    { name: 'friendsCircle', version: 1, retention: { display: 30, maxAge: 30*24*3600000 } },
    { name: 'shop',          version: 1, retention: null },
    { name: 'backpack',      version: 1, retention: null },
    { name: 'live',          version: 1, retention: { display: 20, maxAge: 24*3600000 } },
    { name: 'system',        version: 1, retention: null },
    { name: 'ui',            version: 1, retention: null }
  ];

  DEFAULT_DOMAINS.forEach(function (d) {
    DomainDataStore.register(d.name, {
      version: d.version,
      retention: d.retention
    });
  });

  // 路径映射：旧变量路径 -> 领域键
  var PATH_MAPPINGS = [
    { path: 'xb.friendsCircle.circles', domain: 'friendsCircle', key: 'circles' },
    { path: 'xb.friendsCircle.userSignature', domain: 'friendsCircle', key: 'userSignature' },
    { path: 'xb.forum.posts', domain: 'forum', key: 'posts' },
    { path: 'xb.forum.topics', domain: 'forum', key: 'topics' },
    { path: 'xb.weibo.posts', domain: 'weibo', key: 'posts' },
    { path: 'xb.phone.messages', domain: 'chat', key: 'messages' },
    { path: 'xb.phone.friends', domain: 'chat', key: 'friends' },
    { path: 'xb.shop.items', domain: 'shop', key: 'items' },
    { path: 'xb.backpack.items', domain: 'backpack', key: 'items' }
  ];

  PATH_MAPPINGS.forEach(function (m) {
    DomainDataStore.registerPathMapping(m.path, m.domain, m.key);
  });

  console.log('[Phone Core] DomainDataStore 已初始化，注册了',
    DEFAULT_DOMAINS.length, '个领域，', PATH_MAPPINGS.length, '条路径映射');

  // ============================================================
  // 第七部分：桥接 PhoneDataStore <-> ConfigManager
  // 当 ConfigManager 的变量变更时，同步到 PhoneDataStore 内存缓存
  // 桥接建立后，主动拉取已有变量进行初始同步
  // ============================================================
  var _bridgeBound = false;

  function syncExistingVarsToPhoneDataStore() {
    // 桥接建立后，主动拉取所有已注册路径映射的变量，同步到 PhoneDataStore
    if (!window.ConfigManager || !window.PhoneDataStore) return;

    var paths = Object.keys(DomainDataStore._pathMappings);
    var synced = 0;

    // 使用 getSync（纯缓存，不发 HTTP）批量拉取
    paths.forEach(function (storagePath) {
      try {
        var value = null;
        // 优先从 ConfigManager 缓存读取
        if (typeof window.ConfigManager.getSync === 'function') {
          value = window.ConfigManager.getSync(storagePath);
        }
        if (value !== null && value !== undefined) {
          var mapping = DomainDataStore._pathMappings[storagePath];
          if (mapping) {
            var parsed = value;
            if (typeof value === 'string') {
              try { parsed = JSON.parse(value); } catch (e) { /* keep string */ }
            }
            window.PhoneDataStore.set(mapping.domain + '.' + mapping.key, parsed, { persist: false });
            synced++;
          }
        }
      } catch (e) { /* skip */ }
    });

    if (synced > 0) {
      console.log('[Phone Core] 初始同步完成，同步了', synced, '个变量到 PhoneDataStore');
    }
  }

  function bridgeConfigManagerToPhoneDataStore() {
    if (!window.ConfigManager || !window.PhoneDataStore) {
      setTimeout(bridgeConfigManagerToPhoneDataStore, 1000);
      return;
    }

    if (window.BridgeAPI && window.BridgeAPI.EventBus) {
      window.BridgeAPI.EventBus.on('variable:changed', function (eventData) {
        if (!eventData || !eventData.key) return;

        var mapping = DomainDataStore.resolvePath(eventData.key);
        if (mapping) {
          var value = eventData.value;
          if (value && typeof value === 'string') {
            try { value = JSON.parse(value); } catch (e) { /* keep string */ }
          }
          window.PhoneDataStore.set(mapping.domain + '.' + mapping.key, value, { persist: false });
          console.log('[Phone Core] 变量同步:', eventData.key, '->', mapping.domain + '.' + mapping.key);
        }
      });

      _bridgeBound = true;
      console.log('[Phone Core] ConfigManager -> PhoneDataStore 桥接已建立');

      // 桥接建立后立即同步已有变量
      syncExistingVarsToPhoneDataStore();

      // 5秒后再同步一次（等 ConfigManager 缓存填充完毕）
      setTimeout(syncExistingVarsToPhoneDataStore, 5000);
    } else {
      setTimeout(bridgeConfigManagerToPhoneDataStore, 1000);
    }
  }

  setTimeout(bridgeConfigManagerToPhoneDataStore, 2000);

  // ============================================================
  // 第八部分：模块加载增强 + 快捷引用挂载
  // ============================================================
  window.__PHONE_CORE__.shouldLoadModule = function (moduleName) {
    return FeatureFlags.shouldActivate(moduleName);
  };

  // 快捷引用：让 __PHONE_CORE__.featureFlags / .domainDataStore 可直接访问
  window.__PHONE_CORE__.featureFlags = FeatureFlags;
  window.__PHONE_CORE__.domainDataStore = DomainDataStore;

  // loader 引用：延迟绑定（phone-loader.js 执行时 Phone 对象才存在）
  Object.defineProperty(window.__PHONE_CORE__, 'loader', {
    get: function () { return window.Phone || null; },
    configurable: true
  });

  // 桥接状态查询
  window.__PHONE_CORE__.isBridgeBound = function () { return _bridgeBound; };

  console.log('[Phone Core] 核心层初始化完成');
  console.log('[Phone Core] 可用服务:', Object.keys(ServiceContainer._services));
})();
