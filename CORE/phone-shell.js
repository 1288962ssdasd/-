/**
 * Phone Shell - 手机模拟器 Platform 适配壳子
 *
 * 职责：
 * 1. 管理 ST WebView 环境下的加载时序
 * 2. 将手机模拟器 UI 注入到 ST 页面
 * 3. 提供 Module Registry，让功能模块可以按需注册
 * 4. 统一管理手机面板的生命周期（展开/收起/锁屏/解锁）
 * 5. 桥接 Platform 数据层与 UI 渲染层
 *
 * 设计原则：
 * - 壳子只管"骨架"（加载、注入、生命周期、模块注册）
 * - 功能模块只管"血肉"（具体 UI 和业务逻辑）
 * - 模块通过 registerModule() 注册，壳子负责初始化和挂载
 */

;(function () {
  'use strict';

  // ==================== 配置 ====================

  const DEFAULT_CONFIG = {
    // 注入延迟（等待 ST DOM 就绪）
    injectDelay: 1500,

    // ST DOM 选择器
    selectors: {
      // 注入目标（手机根容器挂载点）
      mountTarget: 'body',

      // ST 聊天区域（用于判断 ST 是否就绪）
      stChat: '#chat',

      // ST 侧边栏
      stSidebar: '#left-nav-panel',

      // ST 主内容区
      stMain: '#sheld',
    },

    // 手机面板配置
    phone: {
      defaultDevice: 'iphone-15-pro',
      panelScale: 0.82,
      floatPosition: 'bottom-left',
      floatOffsetLeft: 270, // ST 侧边栏宽度偏移
    },

    // 调试模式
    debug: false,
  };

  // ==================== 日志 ====================

  function log(tag, ...args) {
    console.log(`[PhoneShell:${tag}]`, ...args);
  }

  function warn(tag, ...args) {
    console.warn(`[PhoneShell:${tag}]`, ...args);
  }

  // ==================== ST 页面检测 ====================

  /**
   * 检测当前是否在 ST WebView 中运行
   * [铁则六] 通过 Platform.adapter 检测环境，不直接引用 window.SillyTavern
   */
  function detectSTEnvironment() {
    // [铁则六] 优先通过 Platform.adapter 检测
    const adapter = window.Platform?.adapter;
    if (adapter) {
      const isST = adapter.isReady?.() || false;
      return {
        isST,
        score: isST ? 3 : 0,
        total: 3,
        source: 'adapter',
      };
    }

    // 降级：通过 DOM 特征检测（不直接引用 window.SillyTavern）
    const indicators = [
      () => !!document.getElementById('sheld'),
      () => !!document.getElementById('chat'),
      () => !!document.getElementById('left-nav-panel'),
      () => !!window.event_source,  // ST 旧版
      () => !!window.chat_metadata,  // ST 全局变量
    ];

    let stScore = 0;
    for (const check of indicators) {
      try {
        if (check()) stScore++;
      } catch (e) { /* ignore */ }
    }

    return {
      isST: stScore >= 2,
      score: stScore,
      total: indicators.length,
      source: 'dom',
    };
  }

  /**
   * 等待 ST DOM 就绪
   * @param {number} timeout - 超时毫秒
   * @param {Function} checkFn - 自定义检测函数
   */
  function waitForST(timeout = 30000, checkFn) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = checkFn || (() => {
        return document.getElementById('sheld') || document.getElementById('chat');
      });

      const poll = () => {
        if (check()) {
          log('Env', 'ST DOM 就绪');
          resolve(true);
        } else if (Date.now() - start > timeout) {
          warn('Env', `等待 ST DOM 超时 (${timeout}ms)，继续执行`);
          resolve(false);
        } else {
          setTimeout(poll, 200);
        }
      };

      poll();
    });
  }

  /**
   * 监听 ST 路由切换（SPA 页面切换不刷新）
   * ST 切换角色/聊天时，会修改 URL hash 或替换 DOM 内容
   */
  function watchSTRouteChanges(callback) {
    // 方案1: 监听 hashchange
    const onHashChange = () => {
      log('Route', 'hash 变化:', location.hash);
      callback('hashchange', location.hash);
    };
    window.addEventListener('hashchange', onHashChange);

    // 方案2: 拦截 pushState/replaceState（始终注册）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(this, arguments);
      callback('pushstate', location.href);
    };

    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      callback('replacestate', location.href);
    };

    // 方案3: MutationObserver 监听 #sheld 内容变化
    const sheld = document.getElementById('sheld');
    let observer = null;
    if (sheld) {
      observer = new MutationObserver((mutations) => {
        const significant = mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0);
        if (significant) {
          log('Route', '检测到 DOM 内容变化');
          callback('domchange', null);
        }
      });
      observer.observe(sheld, { childList: true, subtree: false });
    }

    // 统一清理函数
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      if (observer) observer.disconnect();
    };
  }

  // ==================== 模块注册表 ====================

  class ModuleRegistry {
    constructor() {
      this._modules = new Map();
      this._hooks = new Map(); // lifecycle hooks
    }

    /**
     * 注册模块
     * @param {Object} module
     *   - id: 模块ID（唯一）
     *   - name: 显示名称
     *   - icon: 应用图标
     *   - iconBg: 图标背景
     *   - deps: 依赖的其他模块ID列表
     *   - init(shell): 初始化函数，接收 shell 实例
     *   - render(): 返回 HTMLElement 或 HTML string
     *   - onActivate(): 模块被激活时调用
     *   - onDeactivate(): 模块被停用时调用
     *   - onDestroy(): 模块销毁时调用
     */
    register(module) {
      if (!module.id) {
        throw new Error('模块必须提供 id');
      }

      if (this._modules.has(module.id)) {
        warn('Registry', `模块 "${module.id}" 已存在，将被覆盖`);
      }

      // 默认值
      module.deps = module.deps || [];
      module._initialized = false;
      module._instance = null;

      this._modules.set(module.id, module);
      log('Registry', `注册模块: ${module.id} (${module.name || module.id})`);
    }

    /**
     * 获取模块
     */
    get(id) {
      return this._modules.get(id);
    }

    /**
     * 获取所有模块（按依赖排序）
     */
    getAll() {
      return this._topologicalSort();
    }

    /**
     * 获取模块列表（用于渲染应用图标）
     */
    getAppList() {
      return Array.from(this._modules.values()).map(m => ({
        id: m.id,
        name: m.name || m.id,
        icon: m.icon || '📱',
        iconBg: m.iconBg || null,
        badge: m.badge || 0,
      }));
    }

    /**
     * 拓扑排序（依赖优先）
     */
    _topologicalSort() {
      const visited = new Set();
      const result = [];

      const visit = (id) => {
        if (visited.has(id)) return;
        visited.add(id);

        const mod = this._modules.get(id);
        if (mod && mod.deps) {
          for (const dep of mod.deps) {
            visit(dep);
          }
        }

        if (mod) result.push(mod);
      };

      for (const id of this._modules.keys()) {
        visit(id);
      }

      return result;
    }
  }

  // ==================== Phone Shell 核心 ====================

  class PhoneShell {
    constructor(config = {}) {
      this._config = { ...DEFAULT_CONFIG, ...config };
      this._env = null;         // ST 环境检测结果
      this._state = 'idle';     // idle | loading | ready | active | disposed
      this._modules = new ModuleRegistry();
      this._phone = null;       // PhoneCore 实例
      this._renderer = null;    // PhoneRenderer 实例
      this._hooks = {};         // 生命周期钩子
      this._routeCleanup = null;

      log('Core', '壳子实例已创建');
    }

    // ==================== 生命周期钩子 ====================

    /**
     * 注册生命周期钩子
     * @param {string} event - beforeInit | afterInit | beforeMount | afterMount | beforeDestroy | afterDestroy
     * @param {Function} handler
     */
    on(event, handler) {
      if (!this._hooks[event]) this._hooks[event] = [];
      this._hooks[event].push(handler);
      return () => {
        this._hooks[event] = this._hooks[event].filter(h => h !== handler);
      };
    }

    _emitHook(event, ...args) {
      const handlers = this._hooks[event] || [];
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (e) {
          warn('Hook', `${event} 钩子执行错误:`, e);
        }
      }
    }

    // ==================== 模块注册 ====================

    /**
     * 注册功能模块
     * @param {Object} module - 模块定义
     */
    registerModule(module) {
      this._modules.register(module);
    }

    /**
     * 批量注册模块
     * @param {Object[]} modules
     */
    registerModules(modules) {
      for (const mod of modules) {
        this._modules.register(mod);
      }
    }

    /**
     * 获取已注册模块列表
     * @returns {Array<{id, name, icon}>}
     */
    getRegisteredModules() {
      return this._modules.getAll();
    }

    // ==================== 初始化 ====================

    /**
     * 启动壳子
     * 自动检测环境、等待 ST 就绪、注入 UI、初始化模块
     */
    async boot() {
      if (this._state !== 'idle') {
        warn('Core', `当前状态 ${this._state}，无法启动`);
        return;
      }

      this._state = 'loading';
      log('Core', '🚀 启动 PhoneShell...');

      // 0. 注入全局设计令牌和动画类库（最早阶段，确保所有模块可用）
      this._injectGlobalStyles();

      try {
        // 1. 检测环境
        this._env = detectSTEnvironment();
        log('Core', `环境检测: ST=${this._env.isST} (${this._env.score}/${this._env.total})`);

        // 2. 触发 beforeInit 钩子
        this._emitHook('beforeInit', this._env);

        // 3. 等待 ST DOM 就绪
        if (this._env.isST) {
          await waitForST(30000);
        } else {
          // 非 ST 环境，等待 DOMContentLoaded
          await new Promise(resolve => {
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', resolve);
            } else {
              resolve();
            }
          });
        }

        // 4. 等待 Platform（可选）
        await this._waitForPlatform();

        // 5. 初始化 PhoneCore
        this._initPhoneCore();

        // 6. 初始化模块
        await this._initModules();

        // 7. 注入 UI
        this._emitHook('beforeMount');

        // 始终挂载到 body，避免 #sheld 的 transform/overflow 影响 fixed 定位
        this._renderer = new PhoneRenderer({
          container: document.body,
          panelScale: this._config.phone.panelScale,
        });
        this._renderer.attach(this._phone);
        await this._phone.init({
          device: this._config.phone.defaultDevice,
          renderer: this._renderer,
        });

        // 8. 开机
        await this._phone.powerOn();

        // 9. 监听 ST 路由变化
        if (this._env.isST) {
          this._routeCleanup = watchSTRouteChanges((type, data) => {
            this._onRouteChange(type, data);
          });
        }

        this._state = 'ready';
        this._emitHook('afterMount', this);

        log('Core', '✅ PhoneShell 启动完成');
        window.dispatchEvent(new CustomEvent('phone-shell:ready', { detail: { shell: this } }));

      } catch (error) {
        this._state = 'idle';
        log('Core', '❌ 启动失败:', error);
        window.dispatchEvent(new CustomEvent('phone-shell:error', { detail: { error } }));
      }
    }

    /**
     * 销毁壳子
     */
    async dispose() {
      this._emitHook('beforeDestroy');

      // 清理路由监听
      if (this._routeCleanup) {
        this._routeCleanup();
        this._routeCleanup = null;
      }

      // 销毁模块
      for (const mod of this._modules.getAll()) {
        if (mod.onDestroy) mod.onDestroy();
      }

      // 销毁 PhoneCore
      if (this._phone) {
        await this._phone.dispose();
      }

      this._state = 'disposed';
      this._emitHook('afterDestroy');

      log('Core', '壳子已销毁');
    }

    // ==================== 内部方法 ====================

    async _waitForPlatform() {
      if (window.Platform) {
        if (window.Platform.isReady) {
          log('Core', 'Platform 已就绪');
          this._registerSchemas();
          return;
        }
        log('Core', '等待 Platform 就绪...');
        try {
          await Promise.race([
            window.Platform.waitForReady?.(15000) || Promise.resolve(),
            new Promise(r => setTimeout(r, 15000)),
          ]);
        } catch (e) {
          warn('Core', 'Platform 等待超时或失败，继续启动:', e.message || e);
        }
        if (window.Platform.isReady) {
          log('Core', 'Platform 已就绪');
          this._registerSchemas();
        } else {
          warn('Core', 'Platform 未就绪，以降级模式运行');
        }
      } else {
        log('Core', '未检测到 Platform，以独立模式运行');
      }
    }

    /**
     * 注册 Schema 到 DataStore
     */
    _registerSchemas() {
      const dataStore = window.Platform?.dataStore;
      if (!dataStore) {
        warn('Core', 'DataStore 不可用，跳过 Schema 注册');
        return;
      }

      if (!window.PhoneSchemas) {
        warn('Core', 'PhoneSchemas 未加载，跳过 Schema 注册');
        return;
      }

      const configs = PhoneSchemas.getAllDomainConfigs();
      let registered = 0;

      for (const config of configs) {
        try {
          // [v4.31.0-fix] 使用公开的 hasDomain 方法，不再直接访问 _domains 私有属性
          if (!dataStore.hasDomain(config.name)) {
            // 执行注册
            dataStore.registerDomain(config.name, {
              schema: config.schema,
              persist: config.persist,
              debounceTime: config.debounceTime,
              retention: config.retention,
            });
            registered++;
            log('Core', `注册领域: ${config.name}`);
          } else {
            log('Core', `领域已存在: ${config.name}`);
          }
        } catch (e) {
          warn('Core', `注册领域失败: ${config.name}`, e);
        }
      }

      log('Core', `Schema 注册完成: ${registered}/${configs.length}`);
    }

    /**
     * 注入全局设计令牌和动画类库
     * 在 boot() 最早期执行，确保所有模块可用 CSS 变量
     * 铁则合规：纯渲染层，不影响数据流
     */
    _injectGlobalStyles() {
      if (document.getElementById('phone-design-tokens')) return; // 防止重复注入

      try {
        // 注入设计令牌
        const tokenStyle = document.createElement('style');
        tokenStyle.id = 'phone-design-tokens';
        tokenStyle.textContent = DESIGN_TOKENS;
        document.documentElement.appendChild(tokenStyle);

        // 注入动画类库
        const animStyle = document.createElement('style');
        animStyle.id = 'phone-animation-library';
        animStyle.textContent = ANIMATION_CLASSES;
        document.documentElement.appendChild(animStyle);

        // 注入消息专用样式（如果存在）
        if (typeof MESSAGE_STYLES !== 'undefined') {
          const msgStyle = document.createElement('style');
          msgStyle.id = 'phone-message-styles';
          msgStyle.textContent = MESSAGE_STYLES;
          document.documentElement.appendChild(msgStyle);
        }

        // 注入直播沉浸模式样式（如果存在）
        if (typeof LiveImmersive !== 'undefined' && LiveImmersive.injectStyles) {
          LiveImmersive.injectStyles();
        }

        // 注入日记沉浸写作样式（如果存在）
        if (typeof DiaryImmersive !== 'undefined' && DiaryImmersive.injectStyles) {
          DiaryImmersive.injectStyles();
        }

        log('Core', '✅ 全局设计令牌和动画类库已注入');
      } catch (e) {
        warn('Core', '全局样式注入失败:', e.message);
      }
    }

    _initPhoneCore() {
      // PhoneCore 可能已加载，也可能未加载
      if (!window.PhoneCore) {
        warn('Core', 'PhoneCore 未加载，手机核心功能不可用');
        return;
      }

      this._phone = new PhoneCore();
      log('Core', 'PhoneCore 已创建');
    }

    async _initModules() {
      const sorted = this._modules.getAll();
      log('Core', `初始化 ${sorted.length} 个模块...`);

      for (const mod of sorted) {
        try {
          // 检查依赖 [铁则九] 防御性编程：deps 可能未定义
          const deps = mod.deps || [];
          for (const depId of deps) {
            const dep = this._modules.get(depId);
            if (!dep || !dep._initialized) {
              warn('Core', `模块 "${mod.id}" 的依赖 "${depId}" 未就绪，跳过`);
              continue;
            }
          }

          // 调用模块 init
          if (mod.init) {
            await mod.init(this);
            mod._initialized = true;
            log('Core', `模块已初始化: ${mod.id}`);
          }

          // 注册为手机应用
          if (this._phone && mod.render) {
            this._phone.registerApp(mod.id, mod);
          }

        } catch (error) {
          warn('Core', `模块 "${mod.id}" 初始化失败:`, error);
        }
      }
    }

    _onRouteChange(type, data) {
      log('Route', `路由变化 (${type}):`, data);

      // 通知所有模块
      for (const mod of this._modules.getAll()) {
        if (mod.onRouteChange) {
          try {
            mod.onRouteChange(type, data);
          } catch (e) {
            warn('Core', `模块 "${mod.id}" 路由处理错误:`, e);
          }
        }
      }
    }

    // ==================== 公共 API ====================

    /** 获取 PhoneCore 实例 */
    get phone() { return this._phone; }

    /** 获取渲染器实例 */
    get renderer() { return this._renderer; }

    /** 获取模块注册表 */
    get modules() { return this._modules; }

    /** 获取环境信息 */
    get env() { return this._env; }

    /** 获取配置 */
    get config() { return this._config; }

    /** 当前状态 */
    get state() { return this._state; }

    /** 是否在 ST 环境中 */
    get isST() { return this._env?.isST || false; }

    /** 展开/收起面板 */
    expand() { this._renderer?.expand(); }
    collapse() { this._renderer?.collapse(); }
    toggle() { this._renderer?.toggle(); }

    /**
     * 获取 Platform 数据（便捷方法）
     * @deprecated [v4.31.0-fix] 违反铁则一：数据读写必须通过 Schema 辅助函数
     * 此方法将在未来版本移除，请使用对应的 Schema 方法
     */
    async getData(domain, key, defaultValue) {
      console.warn('[PhoneShell] getData() 已废弃，请使用 Schema 辅助函数访问数据');
      if (window.Platform) {
        return window.Platform.data(domain, key, defaultValue);
      }
      return defaultValue;
    }

    /**
     * @deprecated [v4.31.0-fix] 违反铁则一：数据读写必须通过 Schema 辅助函数
     */
    async setData(domain, key, value) {
      console.warn('[PhoneShell] setData() 已废弃，请使用 Schema 辅助函数写入数据');
      if (window.Platform) {
        return window.Platform.setData(domain, key, value);
      }
    }

    /**
     * @deprecated [v4.31.0-fix] 违反铁则一：数据订阅必须通过 Schema 辅助函数
     */
    subscribeData(domain, key, callback) {
      console.warn('[PhoneShell] subscribeData() 已废弃，请使用 Schema 辅助函数订阅数据');
      if (window.Platform) {
        return window.Platform.subscribeData(domain, key, callback);
      }
      return () => {};
    }

    /**
     * 获取 ST 变量（便捷方法）
     * @deprecated [v4.31.0-fix] 请通过 Platform.adapter 或 PlatformVars 访问
     */
    async getVar(key) {
      console.warn('[PhoneShell] getVar() 已废弃，请使用 PlatformVars.get()');
      if (window.PlatformVars) {
        return window.PlatformVars.get(key);
      }
      if (window.BridgeAPI) {
        return window.BridgeAPI.getVar(key);
      }
      return null;
    }

    /**
     * @deprecated [v4.31.0-fix] 请通过 Platform.adapter 或 PlatformVars 访问
     */
    async setVar(key, value) {
      console.warn('[PhoneShell] setVar() 已废弃，请使用 PlatformVars.set()');
      if (window.PlatformVars) {
        return window.PlatformVars.set(key, value);
      }
      if (window.BridgeAPI) {
        return window.BridgeAPI.setVar(key, value);
      }
    }
  }

  // ==================== 全局暴露 ====================

  window.PhoneShell = PhoneShell;
  window.PhoneModuleRegistry = ModuleRegistry;

  log('Core', '壳子模块已加载');
})();
