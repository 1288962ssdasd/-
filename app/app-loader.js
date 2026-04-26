/**
 * App Loader - 应用加载器
 * 确保所有移动端应用模块按正确顺序加载
 */

class AppLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingModules = new Set();
        this.moduleLoadQueue = [];

        console.log('[App Loader] 应用加载器已创建');
    }

    // 加载模块
    async loadModule(moduleName, moduleUrl, dependencies = []) {
        try {
            console.log(`[App Loader] 开始加载模块: ${moduleName}`);

            // 如果已经加载过，直接返回
            if (this.loadedModules.has(moduleName)) {
                console.log(`[App Loader] 模块 ${moduleName} 已加载`);
                return true;
            }

            // 如果正在加载，等待完成
            if (this.loadingModules.has(moduleName)) {
                console.log(`[App Loader] 模块 ${moduleName} 正在加载，等待完成...`);
                return await this.waitForModule(moduleName);
            }

            // 标记为正在加载
            this.loadingModules.add(moduleName);

            // 检查依赖
            for (const dep of dependencies) {
                if (!this.loadedModules.has(dep)) {
                    console.log(`[App Loader] 模块 ${moduleName} 依赖 ${dep}，先加载依赖`);
                    await this.loadModule(dep, this.getModuleUrl(dep));
                }
            }

            // 加载模块
            await this.loadScript(moduleUrl);

            // 标记为已加载
            this.loadedModules.add(moduleName);
            this.loadingModules.delete(moduleName);

            console.log(`[App Loader] ✅ 模块 ${moduleName} 加载完成`);
            return true;

        } catch (error) {
            console.error(`[App Loader] 模块 ${moduleName} 加载失败:`, error);
            this.loadingModules.delete(moduleName);
            return false;
        }
    }

    // 等待模块加载完成
    async waitForModule(moduleName, timeout = 10000) {
        const startTime = Date.now();

        while (this.loadingModules.has(moduleName)) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`等待模块 ${moduleName} 加载超时`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return this.loadedModules.has(moduleName);
    }

    // 加载脚本
    async loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 获取模块URL
    getModuleUrl(moduleName) {
        const baseUrl = '/scripts/extensions/third-party/mobile/app/';
        const moduleUrls = {
            'context-monitor': baseUrl + 'context-monitor.js',
            'friend-renderer': baseUrl + 'friend-renderer.js',
            'message-sender': baseUrl + 'message-sender.js',
            'message-app': baseUrl + 'message-app.js',
            'real-time-sync': baseUrl + 'real-time-sync.js'
        };

        return moduleUrls[moduleName] || `${baseUrl}${moduleName}.js`;
    }

    // 批量加载模块
    async loadModules(modules) {
        const results = [];

        for (const module of modules) {
            const result = await this.loadModule(
                module.name,
                module.url || this.getModuleUrl(module.name),
                module.dependencies || []
            );
            results.push({ name: module.name, success: result });
        }

        return results;
    }

    // 获取加载状态
    getLoadStatus() {
        return {
            loadedModules: Array.from(this.loadedModules),
            loadingModules: Array.from(this.loadingModules),
            totalLoaded: this.loadedModules.size,
            totalLoading: this.loadingModules.size
        };
    }
}

// 创建全局加载器实例
if (typeof window.appLoader === 'undefined') {
    window.appLoader = new AppLoader();
}

// 自动加载移动端应用模块
async function loadMobileAppModules() {
    try {
        console.log('[App Loader] 🚀 开始加载移动端应用模块');

        const modules = [
            {
                name: 'context-monitor',
                dependencies: []
            },
            {
                name: 'friend-renderer',
                dependencies: ['context-monitor']
            },
            {
                name: 'message-sender',
                dependencies: ['context-monitor']
            },
            {
                name: 'message-app',
                dependencies: ['context-monitor', 'friend-renderer', 'message-sender']
            },
            {
                name: 'real-time-sync',
                dependencies: ['context-monitor', 'friend-renderer', 'message-app']
            }
        ];

        const results = await window.appLoader.loadModules(modules);

        // 检查加载结果
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            console.error('[App Loader] 部分模块加载失败:', failed);
        }

        const succeeded = results.filter(r => r.success);
        console.log(`[App Loader] ✅ 成功加载 ${succeeded.length}/${results.length} 个模块`);

        // 启动实时同步器
        setTimeout(() => {
            if (window.realTimeSync && !window.realTimeSync.isRunning) {
                console.log('[App Loader] 🔄 启动实时同步器');
                window.realTimeSync.start();
            }
        }, 1000);

    } catch (error) {
        console.error('[App Loader] 加载移动端应用模块失败:', error);
    }
}

// 检查是否在移动端环境中
function isMobileEnvironment() {
    return window.location.pathname.includes('mobile') ||
           document.querySelector('[data-app]') !== null ||
           window.mobilePhone !== undefined;
}

// 延迟自动加载
setTimeout(() => {
    if (isMobileEnvironment()) {
        loadMobileAppModules();
    }
}, 1000);

console.log('[App Loader] 应用加载器模块加载完成');
