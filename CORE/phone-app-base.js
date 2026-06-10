/**
 * Phone App Base - 手机应用基类
 *
 * 所有手机应用必须继承此类。
 * 提供应用生命周期管理、导航、状态管理等基础能力。
 */

;(function () {
  'use strict';

  /**
   * PhoneApp - 应用基类
   */
  class PhoneApp {
    constructor(options = {}) {
      // 应用配置
      this.id = options.id || this.constructor.name.toLowerCase();
      this.name = options.name || '应用';
      this.icon = options.icon || '📱';
      this.iconBg = options.iconBg || null;

      // 状态
      this._initialized = false;
      this._active = false;
      this._paused = false;

      // PhoneCore 引用
      this._phone = null;

      // 应用状态
      this._state = {};

      // 路由栈
      this._navigationStack = [];

      // 事件监听
      this._listeners = new Map();

      // DOM 元素
      this._container = null;
      this._elements = {};
    }

    // ==================== 生命周期 ====================

    /**
     * 初始化应用
     * @param {PhoneCore} phone - PhoneCore 实例
     * @param {Object} params - 启动参数
     */
    async init(phone, params = {}) {
      if (this._initialized) return;

      console.log(`[PhoneApp:${this.id}] 初始化...`);

      this._phone = phone;

      // 子类可以重写此方法
      await this.onInit(params);

      this._initialized = true;
    }

    /**
     * 恢复应用（从后台或首次启动）
     * @param {Object} params - 启动参数
     */
    async resume(params = {}) {
      this._active = true;
      this._paused = false;

      console.log(`[PhoneApp:${this.id}] 恢复`);

      // 显示容器
      if (this._container) {
        this._container.style.display = 'block';
      }

      await this.onResume(params);
    }

    /**
     * 暂停应用（进入后台）
     */
    async pause() {
      this._active = false;
      this._paused = true;

      console.log(`[PhoneApp:${this.id}] 暂停`);

      // 隐藏容器
      if (this._container) {
        this._container.style.display = 'none';
      }

      await this.onPause();
    }

    /**
     * 销毁应用
     */
    async dispose() {
      console.log(`[PhoneApp:${this.id}] 销毁`);

      await this.onDispose();

      // 清理事件监听
      this._listeners.clear();

      // 清理DOM
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }

      this._phone = null;
      this._initialized = false;
    }

    // ==================== 渲染 ====================

    /**
     * 渲染应用
     * @returns {HTMLElement} 应用根元素
     */
    render() {
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.className = `phone-app phone-app-${this.id}`;
        this._container.style.cssText = `
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #fff;
          overflow: hidden;
        `;

        // 渲染应用内容
        const content = this.onRender();
        if (content) {
          if (typeof content === 'string') {
            // [安全提示] 子类 onRender() 返回字符串时，必须确保已对动态数据做 HTML 转义。
            // 推荐子类返回 HTMLElement 而非字符串，以彻底避免 XSS 风险。
            this._container.innerHTML = content;
          } else if (content instanceof HTMLElement) {
            this._container.appendChild(content);
          }
        }

        // 绑定事件
        this._bindEvents();
      }

      return this._container;
    }

    /**
     * 获取渲染容器
     */
    getContainer() {
      return this._container;
    }

    // ==================== 导航 ====================

    /**
     * 导航到新页面
     * @param {string} pageId - 页面ID
     * @param {Object} params - 页面参数
     */
    navigateTo(pageId, params = {}) {
      const page = this._createPage(pageId, params);

      // 压入栈
      this._navigationStack.push({ pageId, params, page });

      // 渲染页面
      this._renderPage(page);

      this.emit('navigate', { pageId, params });
    }

    /**
     * 返回上一页
     */
    navigateBack() {
      if (this._navigationStack.length <= 1) {
        // 返回桌面
        this._phone.goHome();
        return;
      }

      // 弹出当前页
      this._navigationStack.pop();

      // 渲染上一页
      const prev = this._navigationStack[this._navigationStack.length - 1];
      this._renderPage(prev.page);

      this.emit('navigateBack', { pageId: prev.pageId });
    }

    /**
     * 返回首页
     */
    navigateHome() {
      while (this._navigationStack.length > 1) {
        this._navigationStack.pop();
      }

      if (this._navigationStack.length > 0) {
        const home = this._navigationStack[0];
        this._renderPage(home.page);
      }

      this.emit('navigateHome');
    }

    /**
     * 获取当前页面
     */
    getCurrentPage() {
      const current = this._navigationStack[this._navigationStack.length - 1];
      return current?.page;
    }

    // ==================== 状态管理 ====================

    /**
     * 设置应用状态
     * @param {string} key - 键名
     * @param {any} value - 值
     */
    setState(key, value) {
      const oldValue = this._state[key];
      this._state[key] = value;

      this.emit('stateChange', { key, value, oldValue });
    }

    /**
     * 获取应用状态
     * @param {string} key - 键名
     * @param {any} defaultValue - 默认值
     */
    getState(key, defaultValue) {
      return this._state[key] !== undefined ? this._state[key] : defaultValue;
    }

    /**
     * 批量设置状态
     * @param {Object} states - 状态对象
     */
    setStates(states) {
      const changed = [];
      for (const [key, value] of Object.entries(states)) {
        const oldValue = this._state[key];
        this._state[key] = value;
        if (oldValue !== value) {
          changed.push({ key, value, oldValue });
        }
      }
      if (changed.length > 0) {
        this.emit('stateChange', changed);
      }
    }

    // ==================== 事件系统 ====================

    /**
     * 订阅事件
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    on(event, handler) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(handler);

      return () => this.off(event, handler);
    }

    /**
     * 取消订阅
     */
    off(event, handler) {
      this._listeners.get(event)?.delete(handler);
    }

    /**
     * 触发事件
     */
    emit(event, data) {
      const handlers = this._listeners.get(event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (e) {
            console.error(`[PhoneApp:${this.id}] 事件处理错误:`, event, e);
          }
        }
      }
    }

    // ==================== 工具方法 ====================

    /**
     * 显示加载状态
     */
    showLoading(message = '加载中...') {
      // 子类可以实现
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
      // 子类可以实现
    }

    /**
     * 显示提示
     * @param {string} message - 消息
     * @param {string} type - 类型: success | error | warning | info
     */
    showToast(message, type = 'info') {
      if (window.PhoneDialog) {
        window.PhoneDialog.showToast(message, type);
      } else {
        // 降级：通过 PhoneCore 发送通知
        this._phone.sendNotification({
          title: this.name,
          body: message,
          icon: this.icon,
          appId: this.id,
          persistent: false,
        });
      }
    }

    /**
     * 显示确认对话框
     * @param {string} message - 消息
     * @returns {Promise<boolean>}
     */
    async confirm(message) {
      if (window.PhoneDialog) {
        return window.PhoneDialog.showConfirm({ message });
      }
      // 降级：使用原生 confirm
      return window.confirm(message);
    }

    /**
     * 显示提示对话框
     * @param {string} message - 消息
     */
    async alert(message) {
      if (window.PhoneDialog) {
        return window.PhoneDialog.showAlert({ message });
      }
      // 降级：使用原生 alert
      window.alert(message);
    }

    /**
     * 显示输入对话框
     * @param {Object} options - { message, placeholder, title, inputType }
     * @returns {Promise<string|null>} 用户输入的内容，取消返回 null
     */
    async showPrompt(options) {
      if (window.PhoneDialog) {
        return window.PhoneDialog.showPrompt(options);
      }
      // 降级：使用原生 prompt
      var msg = '';
      if (typeof options === 'string') {
        msg = options;
      } else if (options && options.message) {
        msg = options.message;
      }
      return window.prompt(msg, (options && options.placeholder) || '');
    }

    /**
     * 更新角标
     * @param {number} count - 角标数量
     */
    setBadge(count) {
      this.badge = count;
      this._phone.emit('phone:badgeUpdated', { appId: this.id, badge: count });
    }

    // ==================== 动画工具方法 ====================

    /**
     * 为元素添加入场动画类，动画结束后自动移除
     * @param {HTMLElement} element - 目标元素
     * @param {string} animClass - 动画类名（如 'anim-fade-in'）
     * @param {number} duration - 动画时长(ms)，默认300
     * @returns {Promise<void>}
     */
    animateIn(element, animClass = 'anim-fade-in', duration = 300) {
      if (!element) return Promise.resolve();
      return new Promise(resolve => {
        element.classList.add(animClass);
        element.addEventListener('animationend', () => {
          element.classList.remove(animClass);
          resolve();
        }, { once: true });
        // 安全超时，防止 animationend 不触发
        setTimeout(resolve, duration + 100);
      });
    }

    /**
     * 为元素添加退场动画类，动画结束后自动移除
     * @param {HTMLElement} element - 目标元素
     * @param {string} animClass - 动画类名（如 'anim-fade-out'）
     * @param {number} duration - 动画时长(ms)，默认200
     * @returns {Promise<void>}
     */
    animateOut(element, animClass = 'anim-fade-out', duration = 200) {
      if (!element) return Promise.resolve();
      return new Promise(resolve => {
        element.classList.add(animClass);
        element.addEventListener('animationend', () => {
          element.classList.remove(animClass);
          resolve();
        }, { once: true });
        setTimeout(resolve, duration + 100);
      });
    }

    /**
     * 创建骨架屏占位元素
     * @param {Object} options - { lines, avatar, width, height }
     * @returns {HTMLElement}
     */
    createSkeleton(options = {}) {
      const { lines = 3, avatar = false, width = '100%', height = '12px' } = options;
      const wrapper = document.createElement('div');
      wrapper.className = 'anim-skeleton';
      wrapper.style.cssText = 'border-radius: var(--radius-sm); padding: var(--space-3);';

      if (avatar) {
        const av = document.createElement('div');
        av.style.cssText = 'width: 40px; height: 40px; border-radius: var(--radius-full); margin-bottom: var(--space-3);';
        wrapper.appendChild(av);
      }

      for (let i = 0; i < lines; i++) {
        const line = document.createElement('div');
        const w = i === lines - 1 ? '60%' : width;
        line.style.cssText = `height: ${height}; border-radius: var(--radius-xs); margin-bottom: var(--space-2); width: ${w};`;
        wrapper.appendChild(line);
      }

      return wrapper;
    }

    /**
     * 创建"正在输入"指示器
     * @returns {HTMLElement}
     */
    createTypingIndicator() {
      const wrapper = document.createElement('div');
      wrapper.className = 'anim-dots';
      wrapper.innerHTML = '<span></span><span></span><span></span>';
      return wrapper;
    }

    // ==================== 内部方法 ====================

    _createPage(pageId, params) {
      // 子类应该重写此方法创建页面
      return { pageId, params };
    }

    _renderPage(page) {
      // 子类应该重写此方法渲染页面
    }

    _bindEvents() {
      // 子类可以重写此方法绑定事件
    }

    // ==================== 子类可重写的方法 ====================

    /**
     * 初始化时调用
     */
    async onInit(params) {
      // 子类重写
    }

    /**
     * 恢复时调用
     */
    async onResume(params) {
      // 子类重写
    }

    /**
     * 暂停时调用
     */
    async onPause() {
      // 子类重写
    }

    /**
     * 销毁时调用
     */
    async onDispose() {
      // 子类重写
    }

    /**
     * 渲染应用内容
     * @returns {string|HTMLElement}
     */
    onRender() {
      // 子类必须重写
      const safeName = (this.name || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `<div style="padding: 20px; text-align: center;">
        <h2>${safeName}</h2>
        <p>应用内容</p>
      </div>`;
    }
  }

  // 暴露到全局
  window.PhoneApp = PhoneApp;

  console.log('[PhoneApp] 应用基类已加载');
})();
