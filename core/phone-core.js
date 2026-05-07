;(function () {
    'use strict';

    /**
     * phone-core.js - Core 层入口
     * 串行加载 service-container.js -> event-bus.js -> module-loader.js
     * 初始化并暴露唯一全局变量 window.__PHONE_CORE__
     */
    const PHONE_CORE_VERSION = '1.0.0';
    const SCRIPT_PREFIX = './scripts/extensions/third-party/mobile/';

    /**
     * 防重复加载检查
     */
    if (window.__PHONE_CORE__) {
        console.warn(
            `[PhoneCore] Already initialized (v${window.__PHONE_CORE__.version}). Skipping duplicate load.`
        );
        return;
    }

    /**
     * 动态加载脚本
     * @param {string} src - 脚本路径
     * @returns {Promise<void>}
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已加载（通过 data 属性标记）
            const existing = document.querySelector(`script[data-phone-core="${src}"]`);
            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.setAttribute('data-phone-core', src);

            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`[PhoneCore] Failed to load script: ${src}`));

            document.head.appendChild(script);
        });
    }

    /**
     * 初始化 Core 层
     * @returns {Promise<Object>} __PHONE_CORE__ 对象
     */
    async function initPhoneCore() {
        console.info(`[PhoneCore] Initializing v${PHONE_CORE_VERSION}...`);

        // 串行加载三个核心组件
        await loadScript(SCRIPT_PREFIX + 'core/service-container.js');
        console.info('[PhoneCore] ServiceContainer loaded.');

        await loadScript(SCRIPT_PREFIX + 'core/event-bus.js');
        console.info('[PhoneCore] EventBus loaded.');

        await loadScript(SCRIPT_PREFIX + 'core/module-loader.js');
        console.info('[PhoneCore] ModuleLoader loaded.');

        // 初始化 ServiceContainer
        const container = new window.__ServiceContainer__();

        // 初始化 EventBus
        const events = new window.__EventBus__();

        // 初始化 ModuleLoader
        const loader = new window.__ModuleLoader__({
            basePath: SCRIPT_PREFIX
        });

        // 将 events 和 loader 注册到 container
        container.register('events', events, {
            singleton: true,
            destroy: (instance) => instance.destroy()
        });

        container.register('loader', loader, {
            singleton: true
        });

        // 构建核心对象
        const core = Object.freeze({
            container,
            events,
            loader,
            version: PHONE_CORE_VERSION
        });

        // 暴露唯一全局变量
        window.__PHONE_CORE__ = core;

        console.info(`[PhoneCore] v${PHONE_CORE_VERSION} initialized successfully.`);
        console.info(`[PhoneCore] Global variable: window.__PHONE_CORE__`);

        // 加载模块声明清单
        try {
            await loadScript(SCRIPT_PREFIX + 'core/module-manifest.js');
            console.info('[PhoneCore] Module manifest loaded.');
        } catch (err) {
            console.error('[PhoneCore] Failed to load module manifest:', err);
        }

        return core;
    }

    // 自动初始化
    initPhoneCore().catch((err) => {
        console.error('[PhoneCore] Fatal initialization error:', err);
    });
})();
