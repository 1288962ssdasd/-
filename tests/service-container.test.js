import { describe, it, expect, beforeEach, vi } from 'vitest';

const VALID_NAME = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/;

class ServiceContainer {
  constructor() {
    this._services = new Map();
    this._options = new Map();
    this._onRegisterCallbacks = [];
    this._onUnregisterCallbacks = [];
  }
  register(name, instance, opts = {}) {
    if (typeof name !== 'string' || !VALID_NAME.test(name)) {
      throw new Error(`[ServiceContainer] 注册名必须是小写驼峰字符串，收到: "${name}"`);
    }
    if (opts.singleton !== false && this._services.has(name)) {
      throw new Error(`[ServiceContainer] 单例服务 "${name}" 已注册，如需覆盖请使用 override()`);
    }
    this._services.set(name, instance);
    this._options.set(name, {
      singleton: opts.singleton !== false,
      destroy: typeof opts.destroy === 'function' ? opts.destroy : null,
    });
    for (const cb of this._onRegisterCallbacks) { try { cb(name, instance); } catch (e) {} }
  }
  get(name) {
    if (!this._services.has(name)) throw new Error(`[ServiceContainer] 服务 "${name}" 未注册。已注册: [${this.list().join(', ')}]`);
    return this._services.get(name);
  }
  has(name) { return this._services.has(name); }
  destroy(name) {
    if (!this._services.has(name)) return;
    const opts = this._options.get(name);
    if (opts && opts.destroy) { try { opts.destroy(this._services.get(name)); } catch (e) {} }
    this._services.delete(name);
    this._options.delete(name);
    for (const cb of this._onUnregisterCallbacks) { try { cb(name); } catch (e) {} }
  }
  override(name, instance, opts = {}) {
    if (!this._services.has(name)) throw new Error(`[ServiceContainer] 无法覆盖未注册的服务: "${name}"`);
    this._services.set(name, instance);
    this._options.set(name, { singleton: opts.singleton !== false, destroy: typeof opts.destroy === 'function' ? opts.destroy : null });
  }
  list() { return Array.from(this._services.keys()); }
  on(event, callback) {
    if (typeof callback !== 'function') throw new Error('[ServiceContainer] 回调必须是函数');
    if (event === 'register') this._onRegisterCallbacks.push(callback);
    else if (event === 'unregister') this._onUnregisterCallbacks.push(callback);
  }
  destroyAll() { for (const name of this.list()) this.destroy(name); }
}

describe('ServiceContainer', () => {
  let container;
  beforeEach(() => { container = new ServiceContainer(); });

  it('应注册并获取服务', () => {
    container.register('testService', { v: 1 });
    expect(container.has('testService')).toBe(true);
    expect(container.get('testService').v).toBe(1);
  });
  it('应在服务未注册时抛出明确错误', () => {
    expect(() => container.get('nonexistent')).toThrow('未注册');
  });
  it('应拒绝无效的服务名', () => {
    expect(() => container.register('InvalidName', {})).toThrow('小写驼峰');
  });
  it('应允许带点号的服务名', () => {
    container.register('bridge.client', {});
    expect(container.has('bridge.client')).toBe(true);
  });
  it('应阻止重复注册单例服务', () => {
    container.register('svc', {});
    expect(() => container.register('svc', {})).toThrow('已注册');
  });
  it('应覆盖已注册的服务', () => {
    container.register('svc', { v: 1 });
    container.override('svc', { v: 2 });
    expect(container.get('svc').v).toBe(2);
  });
  it('应调用服务的销毁回调', () => {
    const destroyFn = vi.fn();
    container.register('svc', {}, { destroy: destroyFn });
    container.destroy('svc');
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });
  it('应返回所有已注册服务名', () => {
    container.register('alpha', {});
    container.register('beta', {});
    expect(container.list()).toEqual(['alpha', 'beta']);
  });
  it('应在注册时触发 onRegister 回调', () => {
    const cb = vi.fn();
    container.on('register', cb);
    container.register('svc', {});
    expect(cb).toHaveBeenCalledWith('svc', {});
  });
});
