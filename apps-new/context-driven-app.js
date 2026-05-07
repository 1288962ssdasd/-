/**
 * ContextDrivenApp - 上下文驱动应用基类
 * 所有新 Apps 层模块的公共基类，提供：
 * - 统一的生命周期管理（init / render / bind / destroy）
 * - 通过 __PHONE_CORE__ 获取服务
 * - 自动事件监听（message:received / chat:changed）
 * - 数据变更检测 + 自动刷新
 */
;(function () {
  'use strict';

  class ContextDrivenApp {
    /**
     * @param {Object} opts
     * @param {string} opts.name - 应用名称
     * @param {string} opts.containerId - 容器元素 ID（默认 'app-content'）
     * @param {boolean} opts.autoRefresh - 数据变更时自动刷新 UI（默认 true）
     */
    constructor(opts = {}) {
      this._name = opts.name || 'unnamed';
      this._containerId = opts.containerId || 'app-content';
      this._autoRefresh = opts.autoRefresh !== false;
      this._initialized = false;
      this._bound = false;
      this._dataHash = '';
      this._offFunctions = [];
    }

    /**
     * 获取 Core 服务
     * @param {string} name - 服务名
     * @returns {*}
     */
    getService(name) {
      if (!window.__PHONE_CORE__) {
        console.warn(`[${this._name}] __PHONE_CORE__ 未就绪`);
        return null;
      }
      return window.__PHONE_CORE__.container.get(name);
    }

    /**
     * 获取 EventBus
     * @returns {*}
     */
    getEvents() {
      if (!window.__PHONE_CORE__) return null;
      return window.__PHONE_CORE__.events;
    }

    /**
     * 初始化应用
     */
    init() {
      if (this._initialized) return;
      this._initialized = true;
      this._registerEventListeners();
      this.onInit();
    }

    /**
     * 子类覆写：初始化逻辑
     */
    onInit() {}

    /**
     * 注册事件监听器
     */
    _registerEventListeners() {
      const events = this.getEvents();
      if (!events) return;

      const offMsg = events.on('message:received', () => {
        this._onDataChanged('message:received');
      });
      this._offFunctions.push(() => offMsg());

      const offChat = events.on('chat:changed', () => {
        this._onDataChanged('chat:changed');
      });
      this._offFunctions.push(() => offChat());
    }

    /**
     * 数据变更回调
     * @param {string} source - 变更来源
     */
    _onDataChanged(source) {
      if (!this._autoRefresh) return;
      const newData = this._computeDataHash();
      if (newData !== this._dataHash) {
        this._dataHash = newData;
        this.refresh();
      }
    }

    /**
     * 计算数据哈希（用于变更检测）
     * @returns {string}
     */
    _computeDataHash() {
      return '';
    }

    /**
     * 渲染应用内容（返回 HTML 字符串）
     * @returns {string}
     */
    getAppContent() {
      return '<div class="app-placeholder">加载中...</div>';
    }

    /**
     * 绑定事件
     */
    bindEvents() {}

    /**
     * 渲染到 DOM
     */
    render() {
      const container = document.getElementById(this._containerId);
      if (!container) return;

      container.innerHTML = this.getAppContent();
      this._bound = false;
      this.bindEvents();
      this._bound = true;
    }

    /**
     * 刷新（数据变更后自动调用）
     */
    refresh() {
      if (!this._initialized) return;
      this.render();
    }

    /**
     * 更新应用头部标题
     * @param {string} title
     */
    updateHeader(title) {
      if (window.mobilePhone && typeof window.mobilePhone.updateAppHeader === 'function') {
        window.mobilePhone.updateAppHeader({ title: title });
      }
    }

    /**
     * 显示 Toast 提示
     * @param {string} message
     * @param {string} [type='info']
     */
    showToast(message, type) {
      if (window.showMobileToast) {
        window.showMobileToast(message, type || 'info');
      } else {
        console.log(`[${this._name}] Toast: ${message}`);
      }
    }

    /**
     * 销毁应用
     */
    destroy() {
      // 移除所有事件监听
      for (const off of this._offFunctions) {
        try { off(); } catch (e) { /* ignore */ }
      }
      this._offFunctions = [];

      this._initialized = false;
      this._bound = false;
      this.onDestroy();
    }

    /**
     * 子类覆写：销毁逻辑
     */
    onDestroy() {}
  }

  window.__ContextDrivenApp__ = ContextDrivenApp;
})();
