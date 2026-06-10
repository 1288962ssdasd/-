/**
 * State Manager
 * 全局状态管理器
 *
 * 提供统一的状态存储、变更追踪和订阅机制。
 * 所有状态变更必须通过此管理器，确保可预测性。
 *
 * 公共工具引用：deepClone / deepEqual 来自 UTILS/clone.js（window.PhoneUtils）
 */

;(function () {
  'use strict';

  class StateManager {
    constructor() {
      // 状态存储: path -> value
      this._state = new Map();

      // 订阅者: path -> Set<callback>
      this._subscribers = new Map();

      // 通配符订阅者: pattern -> Set<callback>
      this._wildcardSubscribers = new Map();

      // 变更历史（用于调试和撤销）
      this._history = [];
      this._maxHistory = 100;

      // 批处理模式
      this._batchMode = false;
      this._pendingChanges = [];

      // 计算属性缓存
      this._computed = new Map();

      console.log('[StateManager] 初始化完成');
    }

    // ==================== 核心 API ====================

    /**
     * 获取状态值
     * @param {string} path - 状态路径，如 'ui.currentView'
     * @param {any} defaultValue - 默认值
     * @returns {any}
     */
    get(path, defaultValue = undefined) {
      if (!path || typeof path !== 'string') {
        console.warn('[StateManager] get() 需要字符串路径');
        return defaultValue;
      }

      const value = this._state.get(path);
      return value !== undefined ? value : defaultValue;
    }

    /**
     * 设置状态值
     * @param {string} path - 状态路径
     * @param {any} value - 新值
     * @param {Object} options - 选项 { silent: false, batch: false }
     * @returns {boolean} 是否实际发生变更
     */
    set(path, value, options = {}) {
      if (!path || typeof path !== 'string') {
        console.warn('[StateManager] set() 需要字符串路径');
        return false;
      }

      const oldValue = this._state.get(path);

      // 值相同，不触发变更
      if (this._deepEqual(oldValue, value)) {
        return false;
      }

      // 更新状态
      this._state.set(path, this._deepClone(value));

      // 记录历史
      this._recordHistory({
        type: oldValue === undefined ? 'create' : 'update',
        path,
        value,
        oldValue,
        timestamp: Date.now(),
      });

      // 批处理模式
      if (this._batchMode || options.batch) {
        this._pendingChanges.push({ path, value, oldValue });
        return true;
      }

      // 触发变更
      if (!options.silent) {
        this._notify(path, value, oldValue);
      }

      return true;
    }

    /**
     * 批量设置状态
     * @param {Object} updates - { path: value }
     * @param {Object} options
     */
    batch(updates, options = {}) {
      this._batchDepth = (this._batchDepth || 0) + 1;
      if (this._batchDepth === 1) {
        this._pendingChanges = [];
      }

      try {
        for (const [path, value] of Object.entries(updates)) {
          this.set(path, value, { silent: true, batch: true });
        }

        if (this._batchDepth === 1 && !options.silent && this._pendingChanges.length > 0) {
          this._notifyBatch(this._pendingChanges);
          for (const change of this._pendingChanges) {
            this._notify(change.path, change.value, change.oldValue);
          }
        }
      } finally {
        this._batchDepth--;
        if (this._batchDepth === 0) {
          this._pendingChanges = [];
        }
      }
    }

    /**
     * 删除状态
     * @param {string} path - 状态路径
     */
    delete(path) {
      const oldValue = this._state.get(path);
      if (oldValue === undefined) return false;

      this._state.delete(path);

      this._recordHistory({
        type: 'delete',
        path,
        oldValue,
        timestamp: Date.now(),
      });

      this._notify(path, undefined, oldValue);
      return true;
    }

    /**
     * 检查状态是否存在
     * @param {string} path
     */
    has(path) {
      return this._state.has(path);
    }

    /**
     * 获取所有状态路径
     */
    keys() {
      return Array.from(this._state.keys());
    }

    /**
     * 获取状态快照
     */
    snapshot() {
      const result = {};
      for (const [path, value] of this._state) {
        this._setPath(result, path, this._deepClone(value));
      }
      return result;
    }

    // ==================== 订阅 API ====================

    /**
     * 订阅状态变更
     * @param {string} path - 状态路径，支持通配符 * 和 **
     * @param {Function} callback - (value, oldValue, meta) => void
     * @returns {Function} 取消订阅函数
     */
    subscribe(path, callback) {
      if (!path || typeof path !== 'string') {
        console.warn('[StateManager] subscribe() 需要字符串路径');
        return () => {};
      }

      if (typeof callback !== 'function') {
        console.warn('[StateManager] subscribe() 需要回调函数');
        return () => {};
      }

      // 通配符订阅
      if (path.includes('*')) {
        if (!this._wildcardSubscribers.has(path)) {
          this._wildcardSubscribers.set(path, new Set());
        }
        this._wildcardSubscribers.get(path).add(callback);

        // 立即触发一次（如果匹配）
        this._notifyWildcardImmediate(path, callback);
      } else {
        // 精确订阅
        if (!this._subscribers.has(path)) {
          this._subscribers.set(path, new Set());
        }
        this._subscribers.get(path).add(callback);

        // 立即触发一次（当前值）
        const currentValue = this._state.get(path);
        if (currentValue !== undefined) {
          setTimeout(() => {
            try {
              callback(currentValue, undefined, { immediate: true });
            } catch (e) {
              console.error('[StateManager] 初始回调错误:', e);
            }
          }, 0);
        }
      }

      // 返回取消订阅函数
      return () => this.unsubscribe(path, callback);
    }

    /**
     * 取消订阅
     * @param {string} path
     * @param {Function} callback
     */
    unsubscribe(path, callback) {
      if (path.includes('*')) {
        this._wildcardSubscribers.get(path)?.delete(callback);
      } else {
        this._subscribers.get(path)?.delete(callback);
      }
    }

    /**
     * 创建计算属性
     * @param {string} path - 计算属性路径
     * @param {Function} computeFn - () => value
     * @param {string[]} deps - 依赖路径数组
     */
    computed(path, computeFn, deps = []) {
      // 存储计算函数和依赖
      this._computed.set(path, { computeFn, deps, value: undefined });

      // 订阅依赖变更
      const updateComputed = () => {
        const newValue = computeFn();
        this.set(path, newValue, { silent: true });
      };

      for (const dep of deps) {
        this.subscribe(dep, updateComputed);
      }

      // 初始计算
      updateComputed();

      // 返回订阅函数（用于读取计算属性）
      return () => this.get(path);
    }

    // ==================== 历史 API ====================

    /**
     * 获取变更历史
     * @param {number} limit - 限制条数
     */
    getHistory(limit = 50) {
      return this._history.slice(-limit);
    }

    /**
     * 清空历史
     */
    clearHistory() {
      this._history = [];
    }

    /**
     * 撤销最后一次变更（实验性功能）
     */
    undo() {
      const lastChange = this._history.pop();
      if (!lastChange) return false;

      if (lastChange.type === 'delete') {
        this._state.set(lastChange.path, lastChange.oldValue);
        this._notify(lastChange.path, lastChange.oldValue, undefined);
      } else if (lastChange.type === 'create') {
        this._state.delete(lastChange.path);
        this._notify(lastChange.path, undefined, lastChange.value);
      } else {
        this._state.set(lastChange.path, lastChange.oldValue);
        this._notify(lastChange.path, lastChange.oldValue, lastChange.value);
      }

      return true;
    }

    // ==================== 内部方法 ====================

    _notify(path, value, oldValue) {
      const meta = { timestamp: Date.now(), path };

      // 通知精确订阅者
      const subscribers = this._subscribers.get(path);
      if (subscribers) {
        for (const callback of subscribers) {
          try {
            callback(value, oldValue, meta);
          } catch (e) {
            console.error('[StateManager] 订阅回调错误:', e);
          }
        }
      }

      // 通知通配符订阅者
      this._notifyWildcard(path, value, oldValue, meta);

      // 通知父路径订阅者
      this._notifyParent(path, value, oldValue, meta);
    }

    _notifyWildcard(changedPath, value, oldValue, meta) {
      for (const [pattern, subscribers] of this._wildcardSubscribers) {
        if (this._matchWildcard(pattern, changedPath)) {
          for (const callback of subscribers) {
            try {
              callback(value, oldValue, { ...meta, pattern, changedPath });
            } catch (e) {
              console.error('[StateManager] 通配符订阅回调错误:', e);
            }
          }
        }
      }
    }

    _notifyWildcardImmediate(pattern, callback) {
      // 找到所有匹配的状态并触发
      for (const [path, value] of this._state) {
        if (this._matchWildcard(pattern, path)) {
          setTimeout(() => {
            try {
              callback(value, undefined, { immediate: true, pattern, path });
            } catch (e) {
              console.error('[StateManager] 通配符初始回调错误:', e);
            }
          }, 0);
        }
      }
    }

    _notifyParent(path, value, oldValue, meta) {
      // 通知父路径（如 'a.b.c' 变更时通知 'a.b' 和 'a'）
      const parts = path.split('.');
      for (let i = parts.length - 1; i > 0; i--) {
        const parentPath = parts.slice(0, i).join('.');
        const parentSubscribers = this._subscribers.get(parentPath);
        if (parentSubscribers) {
          for (const callback of parentSubscribers) {
            try {
              callback(this._getParentValue(parentPath), null, { ...meta, childPath: path });
            } catch (e) {
              console.error('[StateManager] 父路径订阅回调错误:', e);
            }
          }
        }
      }
    }

    _notifyBatch(changes) {
      // 批量变更事件
      if (window.Platform?.emit) {
        window.Platform.emit('state:batch', { changes });
      }
    }

    _matchWildcard(pattern, path) {
      // 简单通配符匹配：
      // 'a.*.c' 匹配 'a.b.c' 但不匹配 'a.b.d.c'
      // 'a.**' 匹配 'a.b', 'a.b.c' 等
      const patternParts = pattern.split('.');
      const pathParts = path.split('.');

      let pi = 0; // pattern index
      let ci = 0; // path index

      while (pi < patternParts.length && ci < pathParts.length) {
        if (patternParts[pi] === '**') {
          // ** 匹配任意剩余路径
          return true;
        }
        if (patternParts[pi] === '*') {
          // * 匹配单个路径段
          pi++;
          ci++;
        } else if (patternParts[pi] === pathParts[ci]) {
          pi++;
          ci++;
        } else {
          return false;
        }
      }

      return pi === patternParts.length && ci === pathParts.length;
    }

    _getParentValue(parentPath) {
      // 构建父路径的完整对象
      const result = {};
      const prefix = parentPath + '.';

      for (const [path, value] of this._state) {
        if (path.startsWith(prefix)) {
          const childPath = path.substring(prefix.length);
          this._setPath(result, childPath, this._deepClone(value));
        }
      }

      return result;
    }

    _recordHistory(entry) {
      this._history.push(entry);
      if (this._history.length > this._maxHistory) {
        this._history.shift();
      }
    }

    _deepClone(obj) {
      return window.PhoneUtils?.deepClone?.(obj) ?? obj;
    }

    _deepEqual(a, b) {
      return window.PhoneUtils?.deepEqual?.(a, b) ?? false;
    }

    _setPath(obj, path, value) {
      const keys = path.split('.');
      let current = obj;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
          current[key] = {};
        }
        current = current[key];
      }

      current[keys[keys.length - 1]] = value;
    }
  }

  // 暴露到全局
  window.StateManager = StateManager;

  console.log('[Platform] StateManager 已加载');
})();
