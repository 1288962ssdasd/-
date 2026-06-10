// ==SillyTavern Extension==
// @name         Mobile Phone 3.0 (外置手机3.0)
// @version      3.3.2-fix
// @description  实时监控 SillyTavern 上下文变化的移动端插件 (Platform 架构版)
// @author       沉淀/夜宵宵夜
// @license      MIT

/**
 * index.js - SillyTavern 插件入口（Platform 架构版 v3.3.2-fix）
 *
 * 职责：
 *   0. 加载 Platform 层（新架构核心）
 *   1. 加载 Schema + 手机核心 + 渲染器
 *   2. 加载功能模块（消息、微博、朋友圈等）
 *   3. 启动 PhoneShell
 *   4. 等待 SillyTavern 就绪后初始化插件设置
 *
 * 铁则合规：
 *   - 所有模块通过 registerModule() 注册
 *   - 数据读写通过 Schema 辅助函数
 *   - 业务代码不直接调用 fetch/localStorage/window.SillyTavern
 *
 * [修复记录]
 *   - v3.3.2-fix: 修复服务注册时序问题（铁则四）
 *   - v3.3.2-fix: 修复 AIService 未注册到 Platform 问题（铁则七）
 *   - v3.3.2-fix: 修复 DirectorService 初始化异步等待问题
 */

;(function () {
  'use strict';

  var BASE = './scripts/extensions/third-party/mobile/';
  var __PHONE_INIT_VERSION__ = '3.7.6-fix';

  // ========== 工具函数 ==========

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-phone-init="' + src + '"]');
      if (existing) { console.log('[Phone Init] 已加载: ' + src); resolve(); return; }

      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.setAttribute('data-phone-init', src);

      // 超时处理（10秒）
      var timeout = setTimeout(function() {
        console.warn('[Phone Init] 加载超时: ' + src);
        reject(new Error('[Phone Init] 加载超时: ' + src));
      }, 10000);

      s.onload = function () {
        clearTimeout(timeout);
        console.log('[Phone Init] ✅ 加载成功: ' + src);
        resolve();
      };
      s.onerror = function () {
        clearTimeout(timeout);
        console.error('[Phone Init] ❌ 加载失败: ' + src);
        reject(new Error('[Phone Init] 加载失败: ' + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadCSS(href) {
    return new Promise(function (resolve) {
      var existing = document.querySelector('link[data-phone-init="' + href + '"]');
      if (existing) { resolve(); return; }

      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      link.setAttribute('data-phone-init', href);
      link.onload = function () { resolve(); };
      link.onerror = function () { resolve(); };
      document.head.appendChild(link);
    });
  }

  // ========== 阶段 0：Platform 核心层 ==========

  function initPlatformLayer() {
    console.info('[Phone Init] 阶段0: 初始化 Platform 层...');

    var scripts = [
      'PLATFORM/adapter-interface.js',
      'PLATFORM/sillytavern-adapter.js',
      'PLATFORM/state-manager.js',
      'PLATFORM/data-store.js',
      'PLATFORM/event-bus.js',
      'PLATFORM/context-monitor.js',
      'PLATFORM/platform-vars.js',
      'PLATFORM/compat-bridge.js',
      'PLATFORM/mvu-proxy.js',
      'CONFIG/platform-config.js',
      'CONFIG/llm-channels.js',
      'CONFIG/domains-config.js',
      'CONFIG/data-constraints.js',  // [v4.31.0] 数据约束定义
      'PLATFORM/platform.js',
      'PLATFORM/tts-service.js',
      'PLATFORM/service-registry.js',  // [T2修复] Service注册中心
    ];

    return scripts.reduce(function (promise, script) {
      return promise.then(function () { return loadScript(BASE + script); });
    }, Promise.resolve())
    .then(async function () {
      console.info('[Phone Init] ✅ Platform 层加载完成');

      // 直接初始化 Platform（跳过 platform-init.js 的外部模块等待）
      if (window.Platform && !window.Platform.isReady && window.SillyTavernAdapter) {
        try {
          var cfg = window.__PHONE_CONFIG__ || {};
          var adapter = new SillyTavernAdapter(cfg.ADAPTER || {
            type: 'SillyTavern',
            apiBase: '/api/plugins/xb-bridge-test',
            varPrefix: 'xb',
            cacheEnabled: true,
            cacheTTL: 500,
          });
          var allDomains = window.PHONE_DOMAINS_CONFIG || [];
          await window.Platform.init({
            adapter: adapter,
            domains: cfg.DOMAINS || allDomains,
            modules: [],
          });
          console.info('[Phone Init] ✅ Platform 直接初始化完成');

          // [T2修复] 将 Platform 内部核心实例暴露到 window，确保全局可访问
          if (window.Platform.dataStore) {
            window.__dataStore = window.Platform.dataStore;
          }
          if (window.Platform.services) {
            window.__serviceContainer = window.Platform.services;
          }
        } catch (e) {
          console.error('[Phone Init] ❌ Platform 初始化失败:', e);
          console.error('[Phone Init] 初始化失败详情:', e.stack || e.message);
        }
      }

      // 等待 Platform 就绪（最多 10 秒）
      return new Promise(function (resolve) {
        var checks = 0;
        var maxChecks = 100;
        var check = function () {
          checks++;
          if (window.Platform && window.Platform.isReady) {
            console.info('[Phone Init] ✅ Platform 已就绪');
            resolve();
          } else if (checks >= maxChecks) {
            console.warn('[Phone Init] ⚠️ Platform 就绪超时，继续加载');
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    });
  }

  // ========== 阶段 1：工具 + Schema + 手机核心 ==========

  function initCoreLayer() {
    console.info('[Phone Init] 阶段1: 初始化 Schema + 手机核心...');

    var scripts = [
      'UTILS/escape.js',
      'SCHEMA/phone-schemas.js',
      'SCHEMA/friends-data.js',
      'SCHEMA/messages-data.js',
      'SCHEMA/weibo-data.js',
      'SCHEMA/api-config-data.js',
      'SCHEMA/friends-circle-data.js',
      'SCHEMA/sticker-data.js',
      'SCHEMA/forum-data.js',
      'SCHEMA/profile-data.js',
      'SCHEMA/task-data.js',
      'SCHEMA/inventory-data.js',
      'SCHEMA/shop-data.js',
      'SCHEMA/status-data.js',
      'SCHEMA/diary-data.js',
      'SCHEMA/live-data.js',
      'SCHEMA/director-data.js',
      'SCHEMA/world-facts-data.js',
      'SCHEMA/character-metadata.js',
      'SCHEMA/story-events-data.js',
      'SCHEMA/world-data.js',
      'SCHEMA/map-data.js',
      'SCHEMA/prompt-data.js',
      'SCHEMA/npc-data.js',
      'SCHEMA/story-evolution-data.js',
      'SCHEMA/media-data.js',
      'SCHEMA/bank-data.js',
      'SCHEMA/stock-data.js',
      'SCHEMA/quest-data.js',
      'SCHEMA/invitation-data.js',
      'SCHEMA/history-data.js',
      'SCHEMA/prediction-data.js',
      'SCHEMA/economy-data.js',
      'SCHEMA/localStorage-migrator.js',
      'CORE/json-repair.js',
      'CORE/data-lineage.js',          // [v4.31.0] 数据血缘追踪
      'CORE/workflow-engine.js',
      'CORE/builtin-workflows.js',
      'CORE/context-assembler.js',
      'CORE/event-dispatcher.js',
      'CORE/llm-gateway.js',
      'CORE/ui-feedback.js',
      'CORE/phone-core.js',
      'CORE/phone-renderer.js',
      'CORE/phone-dialog.js',
      'CORE/phone-app-base.js',
      'CORE/design-tokens.js',
      'CORE/animation-library.js',
      'RENDERERS/message-type-registry.js',
      'RENDERERS/message-styles.js',
      'RENDERERS/quest-renderer.js',
      'RENDERERS/msg-renderer.js',          // [T3修复] 消息渲染器（消息模块依赖）
      'RENDERERS/live-renderer.js',         // [T3修复] 直播渲染器（直播模块依赖）
      'RENDERERS/invitation-renderer.js',
      'RENDERERS/map-renderer.js',
      'RENDERERS/bank-renderer.js',
      'RENDERERS/stock-renderer.js',
      'RENDERERS/avatar-settings-renderer.js',
      'RENDERERS/forum-renderer.js',
      'RENDERERS/status-renderer.js',
      'RENDERERS/task-renderer.js',
      'RENDERERS/diary-renderer.js',
      'RENDERERS/friend-renderer.js',
      'RENDERERS/weibo-renderer.js',
      'RENDERERS/profile-renderer.js',
      'RENDERERS/settings-renderer.js',
      'RENDERERS/api-settings-renderer.js',
      'RENDERERS/shop-renderer.js',
      'RENDERERS/inventory-renderer.js',
      'CORE/notification-banner.js',
      'CORE/parallax-wallpaper.js',
      'CORE/feedback-engine.js',
      'CORE/pull-to-refresh.js',
      'CORE/mention-system.js',
      'CORE/read-receipt.js',
      'CORE/live-immersive.js',
      'CORE/diary-immersive.js',
      'CORE/phone-shell.js',
      'BRIDGE/st-phone-bridge.js',
    ];

    return scripts.reduce(function (promise, script) {
      return promise.then(function () {
        return loadScript(BASE + script).catch(function (err) {
          console.warn('[Phone Init] ⚠️ 加载失败但继续: ' + script, err.message);
          return Promise.resolve();
        });
      });
    }, Promise.resolve())
    .then(function () {
      console.info('[Phone Init] ✅ Schema + 手机核心加载完成');
      var criticalSchemas = ['WorldFacts', 'StoryEvents', 'CharacterMetadata'];
      var missing = criticalSchemas.filter(function (name) {
        return !window.PhoneData || !window.PhoneData[name];
      });
      if (missing.length > 0) {
        console.warn('[Phone Init] ⚠️ 以下 Schema 未加载: ' + missing.join(', '));
      }
    });
  }

  // ========== 阶段 1.5：业务服务层 ==========

  function initServicesLayer() {
    console.info('[Phone Init] 阶段1.5: 加载业务服务层...');

    var scripts = [
      // [Phase 2] 专家系统（必须在其他服务之前加载）
      'SERVICES/experts/base-expert.js',
      'SERVICES/experts/shop-expert.js',
      'SERVICES/experts/news-expert.js',
      'SERVICES/experts/npc-expert.js',
      'SERVICES/experts/social-expert.js',
      'SERVICES/experts/quest-expert.js',
      // 其他服务
      'SERVICES/ai-service.js',
      'SERVICES/api-config-service.js',
      'SERVICES/prompt-service.js',
      'SERVICES/friend-service.js',
      'SERVICES/message-service.js',
      'SERVICES/weibo-service.js',
      'SERVICES/friends-circle-service.js',
      'SERVICES/attachment-service.js',
      'SERVICES/forum-service.js',
      'SERVICES/profile-service.js',
      'SERVICES/task-service.js',
      'SERVICES/economy-service.js',
      'SERVICES/npc-social-service.js',
      'SERVICES/world-sync-service.js',
      'SERVICES/inventory-service.js',
      'SERVICES/shop-service.js',
      'SERVICES/status-service.js',
      'SERVICES/diary-service.js',
      'SERVICES/mvu-adapter.js',
      'SERVICES/live-service.js',
      'SERVICES/director-config.js',
      'SERVICES/director-constants.js',
      'SERVICES/director-templates.js',
      'SERVICES/director-service-v2.js',
      'SERVICES/quest-service.js',
      'SERVICES/npc-generator-service.js',
      'SERVICES/context-manager-service.js',
      'SERVICES/data-cleanup-service.js',
      'SERVICES/worldbook-sync-service.js',
      'SERVICES/experts/world-expert.js',
      'SERVICES/forum-styles-service.js',
      'SERVICES/world-service.js',
      'SERVICES/media-local-service.js',
      'SERVICES/bank-service.js',
      'SERVICES/stock-service.js',
      'SERVICES/invitation-service.js',
      'SERVICES/prediction-service.js',
      'SERVICES/memory-service.js',
      'SERVICES/map-service.js',
      'SERVICES/avatar-service.js',
    ];

    return scripts.reduce(function (promise, script) {
      return promise.then(function () { return loadScript(BASE + script); });
    }, Promise.resolve())
    .then(function () {
      console.info('[Phone Init] ✅ 业务服务层加载完成');
    });
  }

  // [T2修复] 阶段 1.6：注册所有服务到 Platform（铁则四、铁则七）
  // 使用 ServiceRegistry 集中管理，减少 index.js 行数
  function registerServicesToPlatform() {
    console.info('[Phone Init] 阶段1.6: 注册服务到 Platform...');

    if (!window.Platform) {
      console.error('[Phone Init] ❌ Platform 不可用，无法注册服务');
      return Promise.resolve();
    }

    if (!window.ServiceRegistry) {
      console.error('[Phone Init] ❌ ServiceRegistry 未加载');
      return Promise.resolve();
    }

    // 使用 ServiceRegistry 注册所有服务
    var registeredCount = window.ServiceRegistry.registerAll(window.Platform);
    
    if (registeredCount > 0) {
      console.info('[Phone Init] ✅ 已注册 ' + registeredCount + ' 个服务到 Platform');
    }
    
    return Promise.resolve();
  }

  // ========== 阶段 2：功能模块 ==========

  function initAppModules() {
    console.info('[Phone Init] 阶段2: 加载功能模块...');

    var scripts = [
      'MODULES/index.js',
      'MODULES/msg-module.js',
      'MODULES/weibo-module.js',
      'MODULES/api-settings-module.js',
      'MODULES/friend-module.js',
      'MODULES/forum-module.js',
      'MODULES/profile-module.js',
      'MODULES/task-module.js',
      'MODULES/quest-module.js',
      'MODULES/invitation-module.js',
      'MODULES/inventory-module.js',
      'MODULES/shop-module.js',
      'MODULES/status-module.js',
      'MODULES/diary-module.js',
      'MODULES/live-module.js',
      'MODULES/bank-module.js',
      'MODULES/stock-module.js',
      'MODULES/map-module.js',
      'MODULES/placeholders.js',
      'MODULES/module-registry.js',
      'MODULES/avatar-settings-module.js',
      'APP/debug-bridge-module.js',
      'CORE/status-bar-economy.js',
      'APP/starter-init.js',
    ];

    return Promise.all(scripts.map(function (name) {
      return loadScript(BASE + name).catch(function (err) {
        console.warn('[Phone Init] 模块加载失败（非致命）:', name, err.message);
      });
    }))
    .then(function () {
      console.info('[Phone Init] ✅ 功能模块加载完成');
    });
  }

  // ========== 阶段 3：启动 PhoneShell ==========

  function startPhoneShell() {
    console.info('[Phone Init] 阶段3: 启动 PhoneShell...');

    if (!window.PhoneShell) {
      console.error('[Phone Init] PhoneShell 未加载');
      return Promise.resolve();
    }

    var shell = new PhoneShell({
      injectDelay: 1500,
      phone: {
        defaultDevice: 'iphone-15-pro',
        panelScale: 0.82,
        floatOffsetLeft: 270,
      },
    });

    // 使用 PhoneModuleRegistry 注册所有模块（铁则五、铁则十八）
    if (window.PhoneModuleRegistry) {
      window.PhoneModuleRegistry.registerAll(shell);
    } else {
      console.error('[Phone Init] PhoneModuleRegistry 未加载，无法注册模块');
    }

    window.__phoneShell = shell;

    return shell.boot().then(function () {
      console.info('[Phone Init] ✅ PhoneShell 启动完成');

      var tts = window.Platform?.getService?.('tts');
      if (tts && tts.bindVoiceBubbleEvents) {
        tts.bindVoiceBubbleEvents();
        console.info('[Phone Init] ✅ TTS语音气泡事件已绑定');
      }
    }).catch(function (err) {
      console.warn('[Phone Init] PhoneShell 启动异常:', err);
    });
  }

  // _bindStatusBarEconomy 已提取到 CORE/status-bar-economy.js

  // [v4.31-fix] 只使用 V2 导演服务（两步生成模式）
  async function initDirectorSystem() {
    console.info('[Phone Init] 阶段3.5: 初始化导演系统...');

    try {
      // [v4.3-fix] 不再重建 EventBus，使用 Platform 内置的 _eventBus
      // Platform 构造函数已创建 EventBus，通过 on/emit/off 代理访问
      // 确保 Platform.eventBus 属性指向内置实例（供 ContextMonitor/DirectorService 使用）
      if (window.Platform && window.Platform._eventBus) {
        window.Platform.eventBus = window.Platform._eventBus;
        console.info('[Phone Init] ✅ EventBus 使用 Platform 内置实例');
      }

      // 初始化 ContextMonitor
      if (window.ContextMonitor && window.Platform) {
        var contextMonitor = new window.ContextMonitor(window.Platform);
        contextMonitor.init();
        contextMonitor.start();
        window.Platform.contextMonitor = contextMonitor;
        console.info('[Phone Init] ✅ ContextMonitor 已启动');
      }

      // 使用 WorkflowEngine 注册内置工作流（已提取到 CORE/builtin-workflows.js）
      if (window.WorkflowEngine && window.Platform) {
        var workflowEngine = new window.WorkflowEngine(window.Platform);
        window.Platform.workflowEngine = workflowEngine;
        if (window.PhoneBuiltinWorkflows) {
          window.PhoneBuiltinWorkflows.register(workflowEngine);
        }
        console.info('[Phone Init] WorkflowEngine 已初始化');
      }

      // [v4.31-fix] 直接使用 V2 导演服务
      var directorService = window.Platform?.get?.('directorV2Service');

      if (directorService) {
        await directorService.init();
        window.Platform._activeDirectorVersion = 'v2';
        window.Platform._activeDirectorService = directorService;
        console.info('[Phone Init] ✅ DirectorService V2 已初始化');
      } else {
        console.warn('[Phone Init] ⚠️ directorV2Service 未在 Platform 中注册');
      }

      var worldSync = window.Platform?.get?.('worldSyncService');
      if (worldSync?.init) {
        worldSync.init();
        console.info('[Phone Init] ✅ WorldSyncService 已启动（约每5楼同步）');
      }

      if (window.PhoneStatusBarEconomy) window.PhoneStatusBarEconomy.bind();
      if (window.PhoneStarterInit) await window.PhoneStarterInit.init();

    } catch (e) {
      console.error('[Phone Init] 导演系统初始化失败:', e);
    }
  }

  // _initStarterEconomyAndQuest 已提取到 APP/starter-init.js

  // registerBuiltinWorkflows 已提取到 CORE/builtin-workflows.js

  var isInitialized = false;
  var extension_settings = { mobile_context: {} };

  var defaultSettings = {
    enabled: true,
    monitorChat: true,
    monitorCharacter: true,
    tavernCompatibilityMode: true,
    hidePhone: false,
    disableBodyText: false,
  };

  function initPlugin() {
    console.info('[Phone Init] 阶段4: 等待 SillyTavern 就绪...');

    if (window.PhoneFontFix) window.PhoneFontFix.inject();

    jQuery(async function () {
      var isSTReady = function () {
        return !!(window.Platform && window.Platform.isReady);
      };

      if (!isSTReady()) {
        console.log('[Phone Init] 等待 Platform 就绪...');
        var waitForPlatform = setInterval(function () {
          if (isSTReady()) {
            clearInterval(waitForPlatform);
            runPluginInit();
          }
        }, 1000);
      } else {
        runPluginInit();
      }
    });
  }

  function runPluginInit() {
    if (isInitialized) {
      console.log('[Phone Init] 插件已初始化，跳过');
      return;
    }

    try {
      var context = null;
      if (window.Platform?.adapter?.getSTContext) {
        context = window.Platform.adapter.getSTContext();
      } else if (window.Platform?.adapter?.getContext) {
        context = window.Platform.adapter.getContext();
      } else {
        console.warn('[Phone Init] Platform.adapter 无 getSTContext/getChatContext 方法，尝试降级');
        context = window.Platform?.adapter?.getSTContext?.() || null;
      }
      if (!context) {
        console.error('[Phone Init] ❌ 无法获取 ST 上下文，插件初始化中止');
        return;
      }
      if (!context.extensionSettings.mobile_context) {
        context.extensionSettings.mobile_context = Object.assign({}, defaultSettings);
        context.saveSettingsDebounced();
      } else {
        for (var key in defaultSettings) {
          if (context.extensionSettings.mobile_context[key] === undefined) {
            context.extensionSettings.mobile_context[key] = defaultSettings[key];
          }
        }
        context.saveSettingsDebounced();
      }
      extension_settings = context.extensionSettings;

      if (window.PhoneSettingsUI) window.PhoneSettingsUI.create(extension_settings.mobile_context, __PHONE_INIT_VERSION__);
      if (window.PhoneSettingsUI) window.PhoneSettingsUI.bind(extension_settings.mobile_context);
      if (window.PhoneConsoleCommands) window.PhoneConsoleCommands.register(__PHONE_INIT_VERSION__);
      isInitialized = true;
      console.info('[Phone Init] v' + __PHONE_INIT_VERSION__ + ' 插件初始化完成');
    } catch (error) {
      console.error('[Phone Init] 插件初始化失败:', error);
    }
  }

  // injectFontFixStyles 已提取到 CORE/font-fix-styles.js
  // createSettingsUI / bindSettingsControls 已提取到 APP/settings-ui.js
  // registerConsoleCommands 已提取到 APP/debug-console-commands.js

  window.MobileContextPlugin = {
    version: __PHONE_INIT_VERSION__,
    description: 'Mobile Phone 3.0 - Platform 架构版',
    isInitialized: function () { return isInitialized; },
    getSettings: function () { return extension_settings.mobile_context; },
    getShell: function () { return window.__phoneShell; },
    getPlatform: function () { return window.Platform; },
  };

  function broadcastStageEvent(eventName) {
    console.info('[Phone Init] 📢 广播事件: ' + eventName);
    try {
      if (window.Platform && window.Platform.on) {
        window.Platform.emit(eventName, { timestamp: Date.now(), source: 'init' });
      }
      window.dispatchEvent(new CustomEvent(eventName, { detail: { timestamp: Date.now() } }));
    } catch (e) {
      console.warn('[Phone Init] 广播事件失败:', eventName, e);
    }
  }

  // [修复 v3.3.2-fix] 修正启动时序：SERVICES_READY 在注册服务后广播
  initPlatformLayer()
    .then(function () {
      broadcastStageEvent('BRIDGE_READY');
      broadcastStageEvent('PLATFORM_READY');
    })
    .then(initCoreLayer)
    .then(function () {
      broadcastStageEvent('SCHEMAS_READY');
    })
    .then(initServicesLayer)
    .then(registerServicesToPlatform)  // [修复] 新增：注册服务到 Platform
    .then(function () {
      broadcastStageEvent('SERVICES_READY');
    })
    .then(initAppModules)
    .then(startPhoneShell)
    .then(function () {
      broadcastStageEvent('MODULES_READY');
    })
    .then(initDirectorSystem)  // [铁则四修复] 在 MODULES_READY 后初始化导演系统
    // 阶段 3.8：加载阶段4所需的辅助模块
    .then(function () {
      return Promise.all([
        loadScript(BASE + 'CORE/font-fix-styles.js'),
        loadScript(BASE + 'APP/settings-ui.js'),
        loadScript(BASE + 'APP/debug-console-commands.js'),
      ]);
    })
    .then(function () {
      console.info('[Phone Init] 所有脚本加载完成，开始插件初始化');
      initPlugin();
      broadcastStageEvent('APP_READY');
    })
    .catch(function (err) {
      console.error('[Phone Init] 致命加载错误:', err);
    });

})();
