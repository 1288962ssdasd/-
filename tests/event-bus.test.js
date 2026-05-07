import { describe, it, expect, beforeEach, vi } from 'vitest';

class EventBus {
  constructor(opts = {}) {
    this._listeners = {};
    this._history = [];
    this._maxHistory = typeof opts.maxHistory === 'number' ? opts.maxHistory : 100;
    this._idCounter = 0;
    this._registry = {};
    this._lastEmitted = {};
  }
  on(event, callback, options) {
    if (typeof callback !== 'function') return function () {};
    if (typeof event !== 'string' || !event) return function () {};
    const priority = (options && options.priority) || 0;
    const id = ++this._idCounter;
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ callback, id, priority });
    this._listeners[event].sort(function (a, b) { return b.priority - a.priority; });
    this._registerEvent(event);
    const self = this;
    return function () { self.offById(event, id); };
  }
  once(event, callback) {
    const self = this;
    const off = this.on(event, function () { off(); callback.apply(this, arguments); });
    return off;
  }
  offById(event, id) {
    const list = this._listeners[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) { if (list[i].id === id) { list.splice(i, 1); break; } }
    if (list.length === 0) delete this._listeners[event];
  }
  off(event, callback) {
    const list = this._listeners[event];
    if (!list) return;
    for (let i = 0; i < list.length; i++) { if (list[i].callback === callback) { list.splice(i, 1); break; } }
    if (list.length === 0) delete this._listeners[event];
  }
  emit(event, data) {
    const now = Date.now();
    if (this._lastEmitted[event] && now - this._lastEmitted[event] < 50) return;
    this._lastEmitted[event] = now;
    this._history.push({ event, data, timestamp: now });
    if (this._history.length > this._maxHistory) this._history.shift();
    this._emitToListeners(event, data);
    const colonIdx = event.indexOf(':');
    if (colonIdx > 0) this._emitToListeners(event.substring(0, colonIdx + 1) + '*', data);
    this._emitToListeners('*', { event, data });
  }
  _emitToListeners(eventKey, data) {
    const list = this._listeners[eventKey];
    if (!list || list.length === 0) return;
    const snapshot = list.slice();
    for (let i = 0; i < snapshot.length; i++) { try { snapshot[i].callback(data); } catch (e) {} }
  }
  _registerEvent(event) {
    if (!this._registry[event]) this._registry[event] = { listeners: 0, firstRegistered: Date.now() };
    this._registry[event].listeners++;
  }
  getHistory(eventFilter, limit) {
    let result = this._history;
    if (typeof eventFilter === 'string') result = result.filter(function (item) { return item.event === eventFilter; });
    return result.slice(-(limit || 20));
  }
  getRegistry() { return Object.assign({}, this._registry); }
  clear() { this._listeners = {}; this._history = []; this._lastEmitted = {}; }
  destroy() { this.clear(); this._registry = {}; }
}

describe('EventBus', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  it('应注册并触发事件', () => {
    const cb = vi.fn();
    bus.on('message:received', cb);
    bus.emit('message:received', { text: 'hello' });
    expect(cb).toHaveBeenCalledWith({ text: 'hello' });
  });
  it('应支持取消监听', () => {
    const cb = vi.fn();
    const off = bus.on('test:event', cb);
    off();
    bus.emit('test:event', {});
    expect(cb).not.toHaveBeenCalled();
  });
  it('应只触发一次 (once)', () => {
    const cb = vi.fn();
    bus.once('test:once', cb);
    bus.emit('test:once', {});
    bus.emit('test:once', {});
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('应按优先级降序执行', () => {
    const order = [];
    bus.on('test:p', () => order.push('low'), { priority: 0 });
    bus.on('test:p', () => order.push('high'), { priority: 100 });
    bus.emit('test:p', {});
    expect(order).toEqual(['high', 'low']);
  });
  it('应支持前缀通配符', () => {
    const cb = vi.fn();
    bus.on('message:*', cb);
    bus.emit('message:received', {});
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('应支持全局通配符', () => {
    const cb = vi.fn();
    bus.on('*', cb);
    bus.emit('any:event', {});
    expect(cb).toHaveBeenCalledWith({ event: 'any:event', data: {} });
  });
  it('应隔离监听器异常', () => {
    const cb1 = vi.fn(() => { throw new Error('boom'); });
    const cb2 = vi.fn();
    bus.on('test', cb1);
    bus.on('test', cb2);
    expect(() => bus.emit('test', {})).not.toThrow();
    expect(cb2).toHaveBeenCalled();
  });
  it('应记录事件注册表', () => {
    bus.on('a:event', vi.fn());
    bus.on('a:event', vi.fn());
    const registry = bus.getRegistry();
    expect(registry['a:event'].listeners).toBe(2);
  });
});
