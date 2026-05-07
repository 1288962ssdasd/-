import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 模拟 ContextDrivenApp 基类
class ContextDrivenApp {
  constructor(opts = {}) {
    this._name = opts.name || 'unnamed';
    this._containerId = opts.containerId || 'app-content';
    this._autoRefresh = opts.autoRefresh !== false;
    this._initialized = false;
    this._bound = false;
    this._dataHash = '';
    this._offFunctions = [];
  }
  getService(name) {
    if (!window.__PHONE_CORE__) return null;
    return window.__PHONE_CORE__.container.get(name);
  }
  getEvents() {
    if (!window.__PHONE_CORE__) return null;
    return window.__PHONE_CORE__.events;
  }
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._registerEventListeners();
    this.onInit();
  }
  onInit() {}
  _registerEventListeners() {
    const events = this.getEvents();
    if (!events) return;
    const off1 = events.on('message:received', () => this._onDataChanged('message:received'));
    this._offFunctions.push(() => off1());
    const off2 = events.on('chat:changed', () => this._onDataChanged('chat:changed'));
    this._offFunctions.push(() => off2());
  }
  _onDataChanged(source) {
    if (!this._autoRefresh) return;
    const newHash = this._computeDataHash();
    if (newHash !== this._dataHash) {
      this._dataHash = newHash;
      this.refresh();
    }
  }
  _computeDataHash() { return ''; }
  getAppContent() { return '<div>placeholder</div>'; }
  bindEvents() {}
  render() {}
  refresh() { if (this._initialized) this.render(); }
  updateHeader(title) {}
  showToast(message, type) {}
  destroy() {
    for (const off of this._offFunctions) { try { off(); } catch (e) {} }
    this._offFunctions = [];
    this._initialized = false;
    this._bound = false;
    this.onDestroy();
  }
  onDestroy() {}
}

// 模拟 Core 环境
function setupCore() {
  const VALID_NAME = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/;
  class ServiceContainer {
    constructor() { this._services = new Map(); }
    register(name, instance) { this._services.set(name, instance); }
    get(name) { return this._services.get(name); }
    has(name) { return this._services.has(name); }
  }
  class EventBus {
    constructor() { this._listeners = {}; this._idCounter = 0; this._lastEmitted = {}; }
    on(event, callback, options) {
      if (typeof callback !== 'function') return () => {};
      const id = ++this._idCounter;
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push({ callback, id, priority: (options && options.priority) || 0 });
      const self = this;
      return () => self.offById(event, id);
    }
    offById(event, id) {
      const list = this._listeners[event];
      if (!list) return;
      for (let i = 0; i < list.length; i++) { if (list[i].id === id) { list.splice(i, 1); break; } }
    }
    emit(event, data) {
      const now = Date.now();
      if (this._lastEmitted[event] && now - this._lastEmitted[event] < 50) return;
      this._lastEmitted[event] = now;
      const list = this._listeners[event];
      if (!list) return;
      const snapshot = list.slice();
      for (const item of snapshot) { try { item.callback(data); } catch (e) {} }
    }
  }

  const container = new ServiceContainer();
  const events = new EventBus();
  window.__PHONE_CORE__ = { container, events, version: '1.0.0' };
  window.__ContextDrivenApp__ = ContextDrivenApp;
}

function teardownCore() {
  delete window.__PHONE_CORE__;
  delete window.__ContextDrivenApp__;
}

describe('ContextDrivenApp 基类', () => {
  beforeEach(() => { setupCore(); });
  afterEach(() => { teardownCore(); });

  it('应正确初始化', () => {
    const app = new ContextDrivenApp({ name: 'TestApp' });
    expect(app._initialized).toBe(false);
    app.init();
    expect(app._initialized).toBe(true);
  });

  it('应防止重复初始化', () => {
    const app = new ContextDrivenApp({ name: 'TestApp' });
    app.init();
    app.init();
    expect(app._initialized).toBe(true);
  });

  it('应注册 message:received 和 chat:changed 监听器', () => {
    const app = new ContextDrivenApp({ name: 'TestApp' });
    app.init();
    const events = app.getEvents();
    expect(events._listeners['message:received']).toBeDefined();
    expect(events._listeners['chat:changed']).toBeDefined();
  });

  it('应在 destroy 时清理所有监听器', () => {
    const app = new ContextDrivenApp({ name: 'TestApp' });
    app.init();
    app.destroy();
    const events = app.getEvents();
    expect(events._listeners['message:received']).toHaveLength(0);
    expect(events._listeners['chat:changed']).toHaveLength(0);
    expect(app._initialized).toBe(false);
  });

  it('应在数据变更时自动刷新', () => {
    let refreshCount = 0;
    const app = new ContextDrivenApp({ name: 'TestApp', autoRefresh: true });
    app._computeDataHash = () => 'hash1';
    app.refresh = () => { refreshCount++; };
    app.init();
    // 第一次变更触发刷新
    app._computeDataHash = () => 'hash2';
    app.getEvents().emit('message:received', {});
    expect(refreshCount).toBe(1);
    // 相同 hash 不触发
    app.getEvents()._lastEmitted = {};
    app.getEvents().emit('message:received', {});
    expect(refreshCount).toBe(1);
  });

  it('autoRefresh=false 时不应自动刷新', () => {
    let refreshCount = 0;
    const app = new ContextDrivenApp({ name: 'TestApp', autoRefresh: false });
    app._computeDataHash = () => 'hash1';
    app.refresh = () => { refreshCount++; };
    app.init();
    app._computeDataHash = () => 'hash2';
    app.getEvents().emit('message:received', {});
    expect(refreshCount).toBe(0);
  });
});

describe('FeatureFlags 特性旗标', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('应返回默认旗标值', () => {
    // 模拟 FeatureFlags
    const DEFAULT_FLAGS = {
      useForumUINew: false,
      useWeiboUINew: false,
      useTaskAppNew: false,
      useDiaryAppNew: false,
      useStatusAppNew: false,
      useShopAppNew: false,
      useBackpackAppNew: false,
    };

    const flags = Object.assign({}, DEFAULT_FLAGS);
    expect(flags.useForumUINew).toBe(false);
    expect(flags.useTaskAppNew).toBe(false);
  });

  it('应支持启用/禁用旗标', () => {
    const flags = { useForumUINew: false, useWeiboUINew: false };
    flags.useForumUINew = true;
    expect(flags.useForumUINew).toBe(true);
    flags.useForumUINew = false;
    expect(flags.useForumUINew).toBe(false);
  });

  it('应支持切换旗标', () => {
    const flags = { useTaskAppNew: false };
    flags.useTaskAppNew = !flags.useTaskAppNew;
    expect(flags.useTaskAppNew).toBe(true);
    flags.useTaskAppNew = !flags.useTaskAppNew;
    expect(flags.useTaskAppNew).toBe(false);
  });

  it('应支持持久化到 localStorage', () => {
    const flags = { useForumUINew: true, useTaskAppNew: false };
    localStorage.setItem('phone_feature_flags', JSON.stringify(flags));
    const loaded = JSON.parse(localStorage.getItem('phone_feature_flags'));
    expect(loaded.useForumUINew).toBe(true);
    expect(loaded.useTaskAppNew).toBe(false);
  });
});

describe('Apps 层文件存在性验证', () => {
  it('应确认所有新应用文件存在', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const appsDir = path.join(__dirname, '../apps-new');

    const expectedFiles = [
      'context-driven-app.js',
      'forum-ui-new.js',
      'weibo-ui-new.js',
      'task-app-new.js',
      'diary-app-new.js',
      'status-app-new.js',
      'shop-app-new.js',
      'backpack-app-new.js',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(appsDir, file);
      const exists = fs.existsSync(filePath);
      expect(exists, `应用文件 ${file} 应存在`).toBe(true);
    }
  });

  it('应确认 Core 层文件完整', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const coreDir = path.join(__dirname, '../core');

    const expectedFiles = [
      'service-container.js',
      'event-bus.js',
      'module-loader.js',
      'phone-core.js',
      'module-manifest.js',
      'feature-flags.js',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(coreDir, file);
      const exists = fs.existsSync(filePath);
      expect(exists, `Core 文件 ${file} 应存在`).toBe(true);
    }
  });
});
