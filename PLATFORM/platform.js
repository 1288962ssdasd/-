/**
 * Platform
 * 平台核心单例
 *
 * 统一入口，整合所有平台能力：
 * - 状态管理 (StateManager)
 * - 数据存储 (DataStore)
 * - 服务容器 (ServiceContainer)
 * - 模块加载 (ModuleLoader)
 * - 事件总线 (EventBus)
 */

;(function () {
  'use strict';

  class Platform {
    constructor() {
      // 平台状态: IDLE | INITIALIZING | READY | ERROR | DISPOSED
      this._state = 'IDLE';

      // 核心组件
      this._stateManager = null;
      this._dataStore = null;
      this._serviceContainer = new ServiceContainer();
      // [T6修复] 使用全局增强版 EventBus（如果已加载），否则使用内置简易版
      this._eventBus = (typeof window !== 'undefined' && window.EventBus) 
        ? new window.EventBus() 
        : new EventBus();
      this._moduleLoader = new ModuleLoader(this);

      // 适配器
      this._adapter = null;

      // 初始化配置
      this._config = null;

      // 错误处理
      this._error = null;

      console.log('[Platform] 实例已创建');
    }

    // ==================== 属性访问器 ====================

    get state() { return this._state; }
    get isReady() { return this._state === 'READY'; }
    get isInitializing() { return this._state === 'INITIALIZING'; }
    get error() { return this._error; }

    // 快捷访问
    get stateManager() { return this._stateManager; }
    get dataStore() { return this._dataStore; }
    get services() { return this._serviceContainer; }
    get modules() { return this._moduleLoader; }
    get adapter() { return this._adapter; }

    // ==================== 核心初始化 ====================

    /**
     * 初始化平台
     * @param {Object} config - 配置
     *   - adapter: IPlatformAdapter 实例
     *   - domains: 领域配置数组
     *   - modules: 模块定义数组
     * @returns {Promise<void>}
     */
    async init(config) {
      if (this._state !== 'IDLE') {
        console.warn('[Platform] 已经初始化，跳过');
        return;
      }

      this._state = 'INITIALIZING';
      this._config = config;

      console.log('[Platform] 开始初始化...');

      try {
        // 1. 初始化适配器
        await this._initAdapter(config.adapter);

        // 2. 初始化状态管理器
        await this._initStateManager();

        // 3. 初始化数据存储
        await this._initDataStore(config.domains);

        // 4. 注册核心服务
        this._registerCoreServices();

        // 5. 加载模块
        await this._loadModules(config.modules);

        // 6. 标记就绪
        this._state = 'READY';
        this._stateManager.set('platform.state', 'READY', { silent: true });
        this._error = null;

        console.log('[Platform] ✅ 初始化完成');

        // 触发就绪事件
        this.emit('platform:ready', { timestamp: Date.now() });

      } catch (error) {
        this._state = 'ERROR';
        this._stateManager.set('platform.state', 'ERROR', { silent: true });
        this._error = error;

        console.error('[Platform] ❌ 初始化失败:', error);

        this.emit('platform:error', { error });
        throw error;
      }
    }

    /**
     * 销毁平台
     */
    async dispose() {
      if (this._state === 'DISPOSED') return;

      console.log('[Platform] 开始销毁...');

      this.emit('platform:disposing');

      // 1. 销毁模块（逆序）
      await this._moduleLoader.disposeAll();

      // 2. 刷新数据
      if (this._dataStore) {
        await this._dataStore.forceFlush();
      }

      // 3. 同步最终状态
      this._state = 'DISPOSED';
      if (this._stateManager) {
        this._stateManager.set('platform.state', 'DISPOSED', { silent: true });
      }

      // 4. 清理资源
      this._stateManager = null;
      this._dataStore = null;
      this._adapter = null;
      this._serviceContainer.clear();
      this._eventBus.clear();

      console.log('[Platform] 已销毁');

      this.emit('platform:disposed');
    }

    // ==================== 服务管理 ====================

    /**
     * 注册服务
     * @param {string} name - 服务名
     * @param {any} service - 服务实例
     */
    register(name, service) {
      this._serviceContainer.register(name, service);
      return this;
    }

    /**
     * 获取服务
     * @param {string} name - 服务名
     * @returns {any}
     */
    get(name) {
      return this._serviceContainer.get(name);
    }

    /**
     * 检查服务是否存在
     * @param {string} name
     */
    has(name) {
      return this._serviceContainer.has(name);
    }

    // ==================== 事件 API ====================

    /**
     * 订阅事件
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     * @returns {Function} 取消订阅函数
     */
    on(event, handler) {
      return this._eventBus.on(event, handler);
    }

    /**
     * 取消订阅
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
      this._eventBus.off(event, handler);
    }

    /**
     * 触发事件
     * @param {string} event
     * @param {any} data
     */
    emit(event, data) {
      this._eventBus.emit(event, data);
    }

    /**
     * 一次性订阅
     * @param {string} event
     * @returns {Promise<any>}
     */
    once(event) {
      return this._eventBus.once(event);
    }

    // ==================== 状态 API ====================

    /**
     * 获取状态
     * @param {string} path - 状态路径
     * @param {any} defaultValue
     */
    getState(path, defaultValue) {
      return this._stateManager?.get(path, defaultValue);
    }

    /**
     * 设置状态
     * @param {string} path
     * @param {any} value
     * @param {Object} options
     */
    setState(path, value, options) {
      return this._stateManager?.set(path, value, options);
    }

    /**
     * 批量设置状态
     * @param {Object} updates
     */
    batchState(updates) {
      return this._stateManager?.batch(updates);
    }

    /**
     * 订阅状态变更
     * @param {string} path
     * @param {Function} callback
     */
    subscribeState(path, callback) {
      return this._stateManager?.subscribe(path, callback);
    }

    // ==================== 数据 API ====================

    /**
     * 读取数据
     * @param {string} domain
     * @param {string} key
     * @param {any} defaultValue
     */
    async data(domain, key, defaultValue) {
      return this._dataStore?.get(domain, key, defaultValue);
    }

    /**
     * 同步读取数据（仅从缓存）
     * @param {string} domain
     * @param {string} key
     * @param {any} defaultValue
     */
    dataSync(domain, key, defaultValue) {
      return this._dataStore?.getSync(domain, key, defaultValue);
    }

    /**
     * 写入数据
     * @param {string} domain
     * @param {string} key
     * @param {any} value
     * @param {Object} options
     */
    setData(domain, key, value, options) {
      return this._dataStore?.set(domain, key, value, options);
    }

    /**
     * 订阅数据变更
     * @param {string} domain
     * @param {string} key
     * @param {Function} callback
     */
    subscribeData(domain, key, callback) {
      return this._dataStore?.subscribe(domain, key, callback);
    }

    // ==================== 等待 API ====================

    /**
     * 等待平台就绪
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<void>}
     */
    async waitForReady(timeout = 30000) {
      if (this.isReady) return;
      if (this._state === 'ERROR') throw this._error;

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          unsubscribe();
          reject(new Error('Platform ready timeout'));
        }, timeout);

        const unsubscribe = this.on('platform:ready', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    /**
     * 等待模块就绪
     * @param {string} moduleName
     * @param {number} timeout
     */
    async waitForModule(moduleName, timeout = 10000) {
      return this._moduleLoader.waitFor(moduleName, timeout);
    }

    // ==================== AI API ====================

    /**
     * 统一 AI 调用接口
     * 委托给已注册的 AIService，其他 Service 无需直接实例化 AIService
     * @param {string} prompt - 提示词
     * @param {Object} options - 选项（maxRetries, timeout, skipCache 等）
     * @returns {Promise<string>} 生成的文本
     */
    async generate(prompt, options = {}) {
      const aiService = this.get('AI');
      if (!aiService) {
        console.warn('[Platform] AIService 未注册，无法调用 generate');
        return '';
      }
      return aiService.generate(prompt, options);
    }

    /**
     * AI 接口快捷访问对象
     * 用法: Platform.ai.generate(prompt, options)
     */
    get ai() {
      return {
        generate: (prompt, options) => this.generate(prompt, options),
      };
    }

    // ==================== 网络 API ====================

    /**
     * 统一网络请求方法（安全最佳实践：集中管控所有出站请求）
     * 所有模块应通过此方法发起网络请求，而非直接调用 fetch()
     * @param {string} url - 请求 URL
     * @param {RequestInit} options - fetch 选项（可含 timeout 字段，单位 ms）
     * @returns {Promise<Response>}
     */
    async request(url, options = {}) {
      const timeout = options.timeout || 30000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const { timeout: _, ...fetchOptions } = options;
        return await fetch(url, { ...fetchOptions, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }

    // ==================== 内部方法 ====================

    async _initAdapter(adapter) {
      if (!adapter) {
        throw new Error('Adapter is required');
      }

      console.log('[Platform] 初始化适配器...');

      this._adapter = adapter;

      // 等待适配器就绪
      if (adapter.waitForReady) {
        await adapter.waitForReady();
      }

      console.log('[Platform] 适配器就绪');
    }

    async _initStateManager() {
      console.log('[Platform] 初始化状态管理器...');

      this._stateManager = new StateManager();

      // 设置一些初始状态
      this._stateManager.set('platform.state', this._state);
      this._stateManager.set('platform.initTime', Date.now());

      // 监听状态变更，同步到平台状态
      this._stateManager.subscribe('platform.state', (value) => {
        // 防止循环
        if (value !== this._state) {
          this._state = value;
        }
      });

      console.log('[Platform] 状态管理器就绪');
    }

    async _initDataStore(domains = []) {
      console.log('[Platform] 初始化数据存储...');

      this._dataStore = new DataStore(this._adapter, {
        defaultPersist: true,
        defaultDebounceTime: 100,
      });

      // 注册领域（异步，等待数据恢复）
      for (const domain of domains) {
        await this._dataStore.registerDomain(domain.name, {
          schema: domain.schema,
          persist: domain.persist,
          debounceTime: domain.debounceTime,
          retention: domain.retention,
        });
      }

      // 注册路径映射
      const pathMappings = [
        { path: 'xb.friendsCircle.circles', domain: 'friendsCircle', key: 'circles' },
        { path: 'xb.forum.posts', domain: 'forum', key: 'posts' },
        { path: 'xb.weibo.posts', domain: 'weibo', key: 'posts' },
        { path: 'xb.phone.messages', domain: 'chat', key: 'messages' },
        { path: 'xb.phone.friends', domain: 'chat', key: 'friends' },
      ];

      for (const mapping of pathMappings) {
        this._dataStore.registerPathMapping(mapping.path, mapping.domain, mapping.key);
      }

      // [修复] 确保所有领域数据已恢复
      await this._dataStore.restoreAllDomains();

      console.log('[Platform] 数据存储就绪');
    }

    _registerCoreServices() {
      // 将核心组件注册为服务
      this._serviceContainer.register('stateManager', this._stateManager);
      this._serviceContainer.register('dataStore', this._dataStore);
      this._serviceContainer.register('eventBus', this._eventBus);
      this._serviceContainer.register('moduleLoader', this._moduleLoader);
      this._serviceContainer.register('adapter', this._adapter);
    }

    async _loadModules(modules = []) {
      console.log('[Platform] 加载模块...');

      // 注册模块定义
      for (const module of modules) {
        this._moduleLoader.register(module.name, module);
      }

      // 加载所有模块
      await this._moduleLoader.loadAll();

      console.log('[Platform] 模块加载完成');
    }
  }

  // ==================== 内部类 ====================

  class ServiceContainer {
    constructor() {
      this._services = new Map();
    }

    register(name, service) {
      this._services.set(name, service);
    }

    get(name) {
      return this._services.get(name);
    }

    has(name) {
      return this._services.has(name);
    }

    clear() {
      this._services.clear();
    }
  }

  // [T6修复] 内置简易 EventBus 仅作降级备用
  // 唯一 EventBus 实现在 PLATFORM/event-bus.js（增强版）
  // @deprecated 请使用 window.EventBus（增强版 v2.0）
  class _FallbackEventBus {
    constructor() {
      this._handlers = new Map();
    }

    on(event, handler) {
      if (!this._handlers.has(event)) {
        this._handlers.set(event, new Set());
      }
      this._handlers.get(event).add(handler);
      return () => this.off(event, handler);
    }

    off(event, handler) {
      this._handlers.get(event)?.delete(handler);
    }

    emit(event, data) {
      const handlers = this._handlers.get(event);
      if (!handlers) return;
      for (const handler of handlers) {
        try { handler(data); } catch (e) { console.error('[EventBus] 处理错误:', event, e); }
      }
    }

    once(event) {
      return new Promise((resolve) => {
        const unsubscribe = this.on(event, (data) => { unsubscribe(); resolve(data); });
      });
    }

    clear() { this._handlers.clear(); }
  }

  // 兼容别名
  var EventBus = _FallbackEventBus;

  class ModuleLoader {
    constructor(platform) {
      this._platform = platform;
      this._definitions = new Map();
      this._instances = new Map();
      this._loadOrder = [];
    }

    register(name, definition) {
      this._definitions.set(name, {
        ...definition,
        dependencies: definition.dependencies || [],
        priority: definition.priority || 0,
      });
    }

    async loadAll() {
      // 拓扑排序
      this._loadOrder = this._topologicalSort();

      // 按顺序加载
      for (const name of this._loadOrder) {
        await this._load(name);
      }
    }

    async _load(name) {
      const def = this._definitions.get(name);

      // 等待依赖
      for (const dep of def.dependencies) {
        await this.waitFor(dep);
      }

      console.log('[ModuleLoader] 加载模块:', name);

      // 实例化
      let instance;
      if (typeof def.factory === 'function') {
        const result = def.factory(this._platform);
        // [Bug修复] 如果 factory 返回 Promise，需要 await
        instance = result instanceof Promise ? await result : result;
      } else {
        instance = def.factory;
      }

      // 初始化
      if (instance?.init) {
        await instance.init();
      }

      this._instances.set(name, instance);
      this._platform.emit('module:loaded', { name, instance });
    }

    async waitFor(name, timeout = 10000) {
      if (this._instances.has(name)) {
        return this._instances.get(name);
      }

      return Promise.race([
        new Promise((resolve) => {
          const unsubscribe = this._platform.on('module:loaded', ({ name: loadedName, instance }) => {
            if (loadedName === name) {
              unsubscribe();
              resolve(instance);
            }
          });
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Module ${name} load timeout`)), timeout);
        }),
      ]);
    }

    async disposeAll() {
      // 逆序销毁
      for (const name of [...this._loadOrder].reverse()) {
        const instance = this._instances.get(name);
        if (instance?.dispose) {
          try {
            await instance.dispose();
          } catch (e) {
            console.error('[ModuleLoader] 销毁失败:', name, e);
          }
        }
      }
    }

    _topologicalSort() {
      const visited = new Set();
      const visiting = new Set();
      const result = [];

      const visit = (name) => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
          throw new Error(`Circular dependency detected: ${name}`);
        }

        visiting.add(name);

        const def = this._definitions.get(name);
        if (def) {
          for (const dep of def.dependencies) {
            visit(dep);
          }
        }

        visiting.delete(name);
        visited.add(name);
        result.push(name);
      };

      // 按优先级排序
      const sorted = Array.from(this._definitions.entries())
        .sort((a, b) => a[1].priority - b[1].priority)
        .map(([name]) => name);

      for (const name of sorted) {
        visit(name);
      }

      return result;
    }
  }

  // 创建全局单例
  if (!window.Platform) {
    window.Platform = new Platform();
  }

  console.log('[Platform] 核心已加载');
})();
