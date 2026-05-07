;(function () {
    'use strict';

    /**
     * ModuleLoader - 模块加载器
     * 替代 phone-loader.js，支持状态机、依赖检测、拓扑排序、循环依赖检测。
     *
     * 状态机流转:
     *   registered -> loading -> initializing -> ready
     *                                        -> error
     */
    class ModuleLoader {
        /**
         * @param {Object} [options] - 配置选项
         * @param {string} [options.basePath=''] - 脚本基础路径
         * @param {number} [options.globalTimeout=10000] - 等待全局变量的超时时间 (ms)
         */
        constructor(options = {}) {
            /** @type {Object<string, {name: string, file: string, deps: string[], globalVar: string|null, featureFlag: string|null, state: string, error: Error|null}>} */
            this._modules = {};
            /** @type {string[]} 按加载顺序记录的模块名 */
            this._loadOrder = [];
            /** @type {string} 脚本基础路径 */
            this._basePath = options.basePath || '';
            /** @type {number} 等待全局变量超时 (ms) */
            this._globalTimeout = options.globalTimeout || 10000;
        }

        /**
         * 注册单个模块
         * @param {Object} module - 模块描述
         * @param {string} module.name - 模块名称
         * @param {string} [module.file] - 脚本文件路径
         * @param {string[]} [module.deps=[]] - 依赖列表
         * @param {string} [module.globalVar] - 脚本加载后应出现的全局变量名
         * @param {string} [module.featureFlag] - 功能开关标志
         */
        register(module) {
            const { name } = module;
            if (!name) {
                throw new Error('[ModuleLoader] Module must have a "name" property.');
            }

            if (this._modules[name] && this._modules[name].state !== 'registered') {
                throw new Error(
                    `[ModuleLoader] Module "${name}" is already in state "${this._modules[name].state}", cannot re-register.`
                );
            }

            this._modules[name] = {
                name: module.name,
                file: module.file || null,
                deps: Array.isArray(module.deps) ? module.deps : [],
                globalVar: module.globalVar || null,
                featureFlag: module.featureFlag || null,
                state: 'registered',
                error: null
            };
        }

        /**
         * 批量注册模块
         * @param {Object[]} modules - 模块描述数组
         */
        registerAll(modules) {
            if (!Array.isArray(modules)) {
                throw new TypeError('[ModuleLoader] registerAll expects an array of module descriptors.');
            }
            modules.forEach((mod) => this.register(mod));
        }

        /**
         * 检测循环依赖 (DFS)
         * @returns {string[][]} 返回检测到的循环路径数组，空数组表示无循环
         */
        detectCircularDeps() {
            const cycles = [];
            const visited = new Set();
            const recursionStack = new Set();
            const path = [];

            const dfs = (name) => {
                visited.add(name);
                recursionStack.add(name);
                path.push(name);

                const mod = this._modules[name];
                if (mod) {
                    for (const dep of mod.deps) {
                        if (!this._modules[dep]) {
                            // 依赖的模块未注册，跳过
                            continue;
                        }
                        if (!visited.has(dep)) {
                            const subCycles = dfs(dep);
                            if (subCycles.length > 0) return subCycles;
                        } else if (recursionStack.has(dep)) {
                            // 发现循环
                            const cycleStart = path.indexOf(dep);
                            const cyclePath = path.slice(cycleStart).concat(dep);
                            cycles.push(cyclePath);
                            return cycles;
                        }
                    }
                }

                path.pop();
                recursionStack.delete(name);
                return cycles;
            };

            for (const name of Object.keys(this._modules)) {
                if (!visited.has(name)) {
                    const result = dfs(name);
                    if (result.length > 0) return result;
                }
            }

            return cycles;
        }

        /**
         * 拓扑排序，返回层级分组
         * 每一层内的模块可以并行加载
         * @returns {string[][]} 层级分组数组
         */
        topologicalSort() {
            // 检查循环依赖
            const cycles = this.detectCircularDeps();
            if (cycles.length > 0) {
                throw new Error(
                    `[ModuleLoader] Circular dependency detected: ${cycles.map((c) => c.join(' -> ')).join('; ')}`
                );
            }

            const inDegree = {};
            const dependents = {};
            const allNames = Object.keys(this._modules);

            // 初始化
            allNames.forEach((name) => {
                inDegree[name] = 0;
                dependents[name] = [];
            });

            // 构建入度表和依赖关系图
            allNames.forEach((name) => {
                const mod = this._modules[name];
                mod.deps.forEach((dep) => {
                    if (this._modules[dep]) {
                        inDegree[name]++;
                        dependents[dep].push(name);
                    }
                });
            });

            const layers = [];
            let remaining = new Set(allNames);

            while (remaining.size > 0) {
                // 找出当前入度为 0 的模块
                const layer = [];
                for (const name of remaining) {
                    if (inDegree[name] === 0) {
                        layer.push(name);
                    }
                }

                if (layer.length === 0) {
                    // 理论上不会走到这里（循环依赖已提前检测）
                    throw new Error('[ModuleLoader] Unexpected state: no modules with in-degree 0 but remaining modules exist.');
                }

                layers.push(layer.sort());

                // 移除当前层，更新入度
                layer.forEach((name) => {
                    remaining.delete(name);
                    dependents[name].forEach((dep) => {
                        inDegree[dep]--;
                    });
                });
            }

            return layers;
        }

        /**
         * 加载所有已注册模块
         * 按拓扑排序顺序逐层、逐模块串行加载
         * @returns {Promise<void>}
         */
        async loadAll() {
            const layers = this.topologicalSort();

            for (const layer of layers) {
                // 同层模块可以并行加载
                await Promise.all(layer.map((name) => this._loadModule(name)));
            }
        }

        /**
         * 加载单个模块
         * @param {string} name - 模块名称
         * @returns {Promise<void>}
         */
        async _loadModule(name) {
            const mod = this._modules[name];
            if (!mod) {
                throw new Error(`[ModuleLoader] Module "${name}" is not registered.`);
            }

            // 跳过已就绪的模块
            if (mod.state === 'ready') return;

            // 检查功能开关
            if (mod.featureFlag && !this._isFeatureEnabled(mod.featureFlag)) {
                console.info(`[ModuleLoader] Module "${name}" skipped (feature flag "${mod.featureFlag}" is disabled).`);
                mod.state = 'ready';
                return;
            }

            // 状态: loading
            mod.state = 'loading';

            try {
                // 加载脚本文件
                if (mod.file) {
                    await this._loadScript(mod.file);
                }

                // 等待全局变量出现
                if (mod.globalVar) {
                    await this._waitForGlobal(mod.globalVar, this._globalTimeout);
                }

                // 状态: initializing
                mod.state = 'initializing';

                // 通知就绪
                this._notifyReady(name);

                // 状态: ready
                mod.state = 'ready';
                mod.error = null;

                // 记录加载顺序
                this._loadOrder.push(name);

                console.info(`[ModuleLoader] Module "${name}" loaded successfully.`);
            } catch (err) {
                mod.state = 'error';
                mod.error = err;
                console.error(`[ModuleLoader] Failed to load module "${name}":`, err);
                throw err;
            }
        }

        /**
         * 动态加载脚本文件
         * @param {string} file - 脚本文件路径（相对于 basePath）
         * @returns {Promise<void>}
         */
        _loadScript(file) {
            return new Promise((resolve, reject) => {
                const src = this._basePath + file;
                const script = document.createElement('script');
                script.src = src;
                script.async = false;

                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`[ModuleLoader] Failed to load script: ${src}`));

                document.head.appendChild(script);
            });
        }

        /**
         * 等待全局变量出现
         * @param {string} varName - 全局变量名
         * @param {number} [timeout=10000] - 超时时间 (ms)
         * @returns {Promise<void>}
         */
        _waitForGlobal(varName, timeout) {
            return new Promise((resolve, reject) => {
                if (window[varName] !== undefined) {
                    resolve();
                    return;
                }

                const startTime = Date.now();
                const interval = 50;
                const timer = setInterval(() => {
                    if (window[varName] !== undefined) {
                        clearInterval(timer);
                        resolve();
                        return;
                    }

                    if (Date.now() - startTime >= timeout) {
                        clearInterval(timer);
                        reject(
                            new Error(
                                `[ModuleLoader] Timeout waiting for global variable "${varName}" after ${timeout}ms.`
                            )
                        );
                    }
                }, interval);
            });
        }

        /**
         * 检查功能开关是否启用
         * @param {string} flag - 功能开关标志
         * @returns {boolean}
         */
        _isFeatureEnabled(flag) {
            // 默认实现: 检查 window 上是否存在对应标志且为 truthy
            // 可由外部覆写
            return !!window[flag];
        }

        /**
         * 通知模块就绪
         * @param {string} name - 模块名称
         */
        _notifyReady(name) {
            // 如果存在全局事件总线，发送模块就绪事件
            if (window.__PHONE_CORE__ && window.__PHONE_CORE__.events) {
                window.__PHONE_CORE__.events.emit('module:ready', { name });
            }
        }

        /**
         * 获取模块当前状态
         * @param {string} name - 模块名称
         * @returns {string} 状态值: registered | loading | initializing | ready | error
         */
        getState(name) {
            const mod = this._modules[name];
            return mod ? mod.state : undefined;
        }

        /**
         * 列出所有已注册的模块信息
         * @returns {Object[]}
         */
        listModules() {
            return Object.values(this._modules).map((mod) => ({
                name: mod.name,
                state: mod.state,
                deps: mod.deps,
                file: mod.file,
                error: mod.error ? mod.error.message : null
            }));
        }

        /**
         * 获取模块加载顺序
         * @returns {string[]}
         */
        getLoadOrder() {
            return [...this._loadOrder];
        }
    }

    window.__ModuleLoader__ = ModuleLoader;
})();
