/**
 * EventBus - 增强版事件总线
 * 
 * [铁则合规] 说明：
 * - 从旧版 core/event-bus.js 移植并适配新架构
 * - 支持优先级排序、通配符匹配、去重保护
 * - 放置在 PLATFORM 层作为基础设施
 * 
 * @version 2.0.0
 */

;(function () {
  'use strict';

  class EventBus {
    constructor() {
      /** @type {Object<string, Array<{id: number, callback: Function, once: boolean, priority: number}>>} */
      this._listeners = {};
      /** @type {Array<{event: string, data: *, timestamp: number}>} */
      this._history = [];
      /** @type {number} 最大历史记录条数 */
      this._maxHistory = 100;
      /** @type {number} 监听器 ID 自增计数器 */
      this._idCounter = 0;
      /** @type {Object<string, {count: number, description: string}>} 事件注册表 */
      this._registry = {};
      /** @type {Object<string, number>} 上次触发时间戳，用于去重保护 */
      this._lastEmitted = {};
      /** @type {number} 去重保护时间窗口 (ms) */
      this._dedupeWindow = 50;
    }

    /**
     * 注册事件到注册表
     * @param {string} event - 事件名称
     */
    _registerEvent(event) {
      if (!this._registry[event]) {
        this._registry[event] = { count: 0, description: '' };
      }
    }

    /**
     * 监听事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @param {Object} [options] - 选项
     * @param {number} [options.priority=0] - 优先级，数值越大越先执行
     * @returns {Function} 取消监听函数
     */
    on(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        console.warn('[EventBus] on(): callback must be a function, got', typeof callback);
        return this;
      }

      this._registerEvent(event);

      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }

      const id = ++this._idCounter;
      const listener = {
        id,
        callback,
        once: false,
        priority: typeof options.priority === 'number' ? options.priority : 0
      };

      this._listeners[event].push(listener);

      // 按 priority 降序排序（数值越大越先执行）
      this._listeners[event].sort((a, b) => b.priority - a.priority);

      // 返回取消函数
      return () => this.offById(event, id);
    }

    /**
     * 监听事件（仅触发一次）
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @param {Object} [options] - 选项
     * @returns {Function} 取消监听函数
     */
    once(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        throw new TypeError(`[EventBus] Callback must be a function.`);
      }

      this._registerEvent(event);

      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }

      const id = ++this._idCounter;
      const listener = {
        id,
        callback,
        once: true,
        priority: typeof options.priority === 'number' ? options.priority : 0
      };

      this._listeners[event].push(listener);
      this._listeners[event].sort((a, b) => b.priority - a.priority);

      return () => this.offById(event, id);
    }

    /**
     * 通过 ID 取消监听
     * @param {string} event - 事件名称
     * @param {number} id - 监听器 ID
     */
    offById(event, id) {
      const listeners = this._listeners[event];
      if (!listeners) return;

      const index = listeners.findIndex((l) => l.id === id);
      if (index !== -1) {
        listeners.splice(index, 1);
      }

      // 清理空数组
      if (listeners.length === 0) {
        delete this._listeners[event];
      }
    }

    /**
     * 取消监听（通过回调引用）
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
      const listeners = this._listeners[event];
      if (!listeners) return;

      const index = listeners.findIndex((l) => l.callback === callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }

      if (listeners.length === 0) {
        delete this._listeners[event];
      }
    }

    /**
     * 触发事件
     * 支持前缀通配符 (domain:*) 和全局通配符 (*)
     * 包含 50ms 去重保护
     * @param {string} event - 事件名称
     * @param {*} [data] - 事件数据
     */
    emit(event, data) {
      // 去重保护: 50ms 内同一事件不重复触发
      const now = Date.now();
      const lastTime = this._lastEmitted[event];
      if (lastTime && (now - lastTime) < this._dedupeWindow) {
        return;
      }
      this._lastEmitted[event] = now;

      this._registerEvent(event);

      // 更新注册表计数
      if (this._registry[event]) {
        this._registry[event].count++;
      }

      // 记录历史
      this._history.push({ event, data, timestamp: now });
      if (this._history.length > this._maxHistory) {
        this._history.shift();
      }

      // 精确匹配
      this._emitToListeners(event, data);

      // 前缀通配符匹配 (domain:*)
      const colonIndex = event.indexOf(':');
      if (colonIndex !== -1) {
        const prefix = event.substring(0, colonIndex + 1) + '*';
        this._emitToListeners(prefix, data);
      }

      // 全局通配符匹配 (*)
      this._emitToListeners('*', data);
    }

    /**
     * 向指定事件的监听器列表分发数据
     * 使用 slice() 复制 + try-catch 隔离
     * @param {string} eventKey - 事件键名
     * @param {*} data - 事件数据
     */
    _emitToListeners(eventKey, data) {
      const listeners = this._listeners[eventKey];
      if (!listeners || listeners.length === 0) return;

      // slice() 复制数组，防止遍历过程中回调修改列表
      const snapshot = listeners.slice();

      for (let i = 0; i < snapshot.length; i++) {
        const listener = snapshot[i];

        try {
          listener.callback(data);
        } catch (err) {
          console.error(
            `[EventBus] Error in listener for "${eventKey}" (id=${listener.id}):`,
            err
          );
        }

        // once 监听器触发后移除
        if (listener.once) {
          this.offById(eventKey, listener.id);
        }
      }
    }

    /**
     * 获取事件历史记录
     * @param {string|Function} [eventFilter] - 事件名过滤或自定义过滤函数
     * @param {number} [limit] - 返回条数限制
     * @returns {Array<{event: string, data: *, timestamp: number}>}
     */
    getHistory(eventFilter, limit) {
      let result = this._history;

      if (typeof eventFilter === 'string') {
        result = result.filter((entry) => entry.event === eventFilter);
      } else if (typeof eventFilter === 'function') {
        result = result.filter(eventFilter);
      }

      if (typeof limit === 'number' && limit > 0) {
        result = result.slice(-limit);
      }

      return result;
    }

    /**
     * 获取事件注册表
     * @returns {Object<string, {count: number, description: string}>}
     */
    getRegistry() {
      return { ...this._registry };
    }

    /**
     * 清空所有监听器、历史记录和注册表
     */
    clear() {
      this._listeners = {};
      this._history = [];
      this._registry = {};
      this._lastEmitted = {};
    }

    /**
     * 销毁事件总线，释放所有资源
     */
    destroy() {
      this.clear();
      this._idCounter = 0;
    }
  }

  // 暴露到全局
  window.EventBus = EventBus;

  console.log('[Platform] EventBus 已加载 (增强版 v2.0)');
})();
