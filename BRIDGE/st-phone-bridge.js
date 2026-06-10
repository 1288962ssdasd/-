/**
 * ST Phone Bridge - SillyTavern WebView 集成桥接器
 *
 * 负责在 ST 的 WebView 环境中检测页面状态、注入手机模拟器、处理路由切换。
 * 这是一个独立模块，不依赖 Platform，直接与 ST DOM 交互。
 */

;(function () {
  'use strict';

  /**
   * STPhoneBridge - ST WebView 桥接器
   */
  class STPhoneBridge {
    constructor(options = {}) {
      this._config = {
        // 自动注入时机
        autoInject: options.autoInject !== false,
        // 注入延迟（等待 ST 渲染完成）
        injectDelay: options.injectDelay || 2000,
        // 调试模式
        debug: options.debug || false,
        // 手机模拟器配置
        phoneConfig: options.phoneConfig || {
          defaultDevice: 'iphone-15-pro',
          panelScale: 0.82,
          floatOffsetLeft: 270,
        },
        // 注入目标容器选择器
        containerSelector: options.containerSelector || '#sheld',
      };

      this._injected = false;
      this._routeListeners = [];
      this._lastRoute = '';
      this._observer = null;

      if (this._config.debug) {
        console.log('[STPhoneBridge] 配置:', this._config);
      }
    }

    // ==================== 初始化 ====================

    /**
     * 启动桥接器
     */
    async start() {
      this._log('启动桥接器...');

      // 等待 ST 页面基础 DOM 就绪
      await this._waitForDOM();

      // 检测 ST 环境
      if (!this._detectSTEnvironment()) {
        this._log('未检测到 SillyTavern 环境，进入独立模式');
      }

      // 监听路由变化
      this._setupRouteDetection();

      // 自动注入
      if (this._config.autoInject) {
        await this._delay(this._config.injectDelay);
        this.inject();
      }

      this._log('桥接器就绪');
    }

    // ==================== ST 环境检测 ====================

    /**
     * 等待 DOM 就绪
     */
    _waitForDOM() {
      return new Promise((resolve) => {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          resolve();
        } else {
          document.addEventListener('DOMContentLoaded', resolve);
        }
      });
    }

    /**
     * 检测 SillyTavern 环境
     * @returns {boolean} 是否在 ST 环境中
     */
    _detectSTEnvironment() {
      // 检查 ST 特征元素
      const stIndicators = [
        '#sheld',           // ST 主容器
        '#send_form',       // ST 发送表单
        '#chat_form',       // ST 聊天表单
        '.drawer-content',  // ST 抽屉
      ];

      for (const selector of stIndicators) {
        if (document.querySelector(selector)) {
          this._log('检测到 ST 环境（选择器:', selector, '）');
          return true;
        }
      }

      // 检查全局变量
      if (window.SillyTavern) {
        this._log('检测到 ST 环境（全局变量 SillyTavern）');
        return true;
      }

      return false;
    }

    // ==================== 路由检测 ====================

    /**
     * 设置路由变化监听
     */
    _setupRouteDetection() {
      // 方式1: hashchange 事件
      window.addEventListener('hashchange', () => {
        this._onRouteChange(location.hash);
      });

      // 方式2: pushState/replaceState 拦截
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this._onRouteChange(location.href);
      };

      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this._onRouteChange(location.href);
      };

      // 方式3: MutationObserver 监听 DOM 变化（SPA 路由）
      this._observer = new MutationObserver((mutations) => {
        // 检查是否有实质性 DOM 变化（如页面切换）
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const currentRoute = this._getCurrentRoute();
            if (currentRoute !== this._lastRoute) {
              this._onRouteChange(currentRoute);
            }
            break;
          }
        }
      });

      this._observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // 记录初始路由
      this._lastRoute = this._getCurrentRoute();
    }

    /**
     * 获取当前路由标识
     * @returns {string}
     */
    _getCurrentRoute() {
      // 优先使用 hash
      if (location.hash) return location.hash;

      // 检查 ST 特征页面
      const chatPage = document.querySelector('#chat');
      const characterPage = document.querySelector('#character-group-block');
      const settingsPage = document.querySelector('#settings-container');

      if (chatPage && chatPage.offsetParent !== null) return 'chat';
      if (characterPage) return 'characters';
      if (settingsPage) return 'settings';

      return location.pathname;
    }

    /**
     * 路由变化回调
     * @param {string} newRoute
     */
    _onRouteChange(newRoute) {
      if (newRoute === this._lastRoute) return;

      const oldRoute = this._lastRoute;
      this._lastRoute = newRoute;

      this._log('路由变化:', oldRoute, '->', newRoute);

      // 通知所有监听器
      for (const listener of this._routeListeners) {
        try {
          listener(newRoute, oldRoute);
        } catch (e) {
          console.error('[STPhoneBridge] 路由监听器错误:', e);
        }
      }
    }

    /**
     * 注册路由变化监听器
     * @param {Function} callback - (newRoute, oldRoute) => void
     * @returns {Function} 取消监听函数
     */
    onRouteChange(callback) {
      if (typeof callback !== 'function') return () => {};

      this._routeListeners.push(callback);
      return () => {
        this._routeListeners = this._routeListeners.filter(l => l !== callback);
      };
    }

    // ==================== 注入控制 ====================

    /**
     * 注入手机模拟器到页面
     */
    inject() {
      if (this._injected) {
        this._log('已经注入，跳过');
        return;
      }

      // 检查目标容器
      const container = document.querySelector(this._config.containerSelector);
      if (!container) {
        this._log('未找到注入容器:', this._config.containerSelector);
        // 尝试注入到 body
        this._injectToBody();
        return;
      }

      this._injectToContainer(container);
    }

    /**
     * 注入到指定容器
     * @param {HTMLElement} container
     */
    _injectToContainer(container) {
      // 创建手机模拟器挂载点
      const mountPoint = document.createElement('div');
      mountPoint.id = 'phone-simulator-mount';
      mountPoint.style.cssText = 'position: relative; z-index: 9999;';
      container.appendChild(mountPoint);

      this._injected = true;
      this._log('已注入到容器:', this._config.containerSelector);

      // 触发注入事件
      window.dispatchEvent(new CustomEvent('phone-bridge:injected', {
        detail: { container: this._config.containerSelector },
      }));
    }

    /**
     * 注入到 body（降级方案）
     */
    _injectToBody() {
      const mountPoint = document.createElement('div');
      mountPoint.id = 'phone-simulator-mount';
      mountPoint.style.cssText = 'position: fixed; top: 0; right: 0; z-index: 9999;';
      document.body.appendChild(mountPoint);

      this._injected = true;
      this._log('已注入到 body（降级模式）');

      window.dispatchEvent(new CustomEvent('phone-bridge:injected', {
        detail: { container: 'body' },
      }));
    }

    /**
     * 移除注入的手机模拟器
     */
    remove() {
      const mountPoint = document.querySelector('#phone-simulator-mount');
      if (mountPoint) {
        mountPoint.remove();
        this._injected = false;
        this._log('已移除手机模拟器');
      }
    }

    // ==================== 页面状态查询 ====================

    /**
     * 获取当前页面状态
     * @returns {Object}
     */
    getPageState() {
      return {
        route: this._getCurrentRoute(),
        isST: !!window.SillyTavern,
        injected: this._injected,
        url: location.href,
        hash: location.hash,
        timestamp: Date.now(),
      };
    }

    /**
     * 检查是否在聊天页面
     * @returns {boolean}
     */
    isChatPage() {
      return this._getCurrentRoute() === 'chat' || !!document.querySelector('#chat');
    }

    /**
     * 检查页面是否稳定（无活跃动画/加载）
     * @returns {Promise<boolean>}
     */
    async isPageStable() {
      // 等待一小段时间检查是否有持续 DOM 变化
      let changeCount = 0;
      const observer = new MutationObserver(() => { changeCount++; });

      observer.observe(document.body, { childList: true, subtree: true });
      await this._delay(500);
      observer.disconnect();

      return changeCount < 10; // 阈值：500ms 内变化少于 10 次视为稳定
    }

    // ==================== 工具方法 ====================

    _delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    _log(...args) {
      if (this._config.debug) {
        console.log('[STPhoneBridge]', ...args);
      }
    }

    // ==================== 销毁 ====================

    /**
     * 销毁桥接器，清理所有资源
     */
    dispose() {
      // 移除路由监听
      this._routeListeners = [];

      // 停止 MutationObserver
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }

      // 移除注入的元素
      this.remove();

      this._log('桥接器已销毁');
    }
  }

  // 暴露到全局
  window.STPhoneBridge = STPhoneBridge;

  console.log('[STPhoneBridge] 模块已加载');
})();
