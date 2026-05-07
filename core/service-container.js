;(function () {
    'use strict';

    /**
     * ServiceContainer - 依赖注入容器
     * 替代 44 个 window.* 全局变量，统一管理服务实例的生命周期。
     */
    class ServiceContainer {
        constructor() {
            this._services = new Map();
            this._options = new Map();
            this._listeners = new Map();
        }

        /**
         * 校验服务名是否符合规范
         * 规则: 小写字母开头，允许大小写字母、数字、点号分隔
         * 示例: 'bridgeClient', 'bridge.api', 'quest.engine'
         */
        _validateName(name) {
            const pattern = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/;
            if (!pattern.test(name)) {
                throw new Error(
                    `[ServiceContainer] Invalid service name: "${name}". ` +
                    `Must match pattern: /^[a-z][a-zA-Z0-9]*(?:\\.[a-z][a-zA-Z0-9]*)*$/`
                );
            }
        }

        /**
         * 注册服务实例
         * @param {string} name - 服务名称
         * @param {*} instance - 服务实例
         * @param {Object} [opts] - 配置选项
         * @param {boolean} [opts.singleton=true] - 是否单例
         * @param {Function} [opts.destroy] - 销毁回调
         */
        register(name, instance, opts = {}) {
            this._validateName(name);

            if (this._services.has(name)) {
                throw new Error(
                    `[ServiceContainer] Service "${name}" is already registered. Use override() to replace it.`
                );
            }

            const options = {
                singleton: opts.singleton !== false,
                destroy: typeof opts.destroy === 'function' ? opts.destroy : null
            };

            this._services.set(name, instance);
            this._options.set(name, options);

            this._emit('register', { name, instance, options });
        }

        /**
         * 获取服务实例
         * @param {string} name - 服务名称
         * @returns {*} 服务实例
         */
        get(name) {
            if (!this._services.has(name)) {
                throw new Error(`[ServiceContainer] Service "${name}" is not registered.`);
            }
            return this._services.get(name);
        }

        /**
         * 检查服务是否已注册
         * @param {string} name - 服务名称
         * @returns {boolean}
         */
        has(name) {
            return this._services.has(name);
        }

        /**
         * 销毁指定服务
         * @param {string} name - 服务名称
         */
        destroy(name) {
            if (!this._services.has(name)) {
                console.warn(`[ServiceContainer] Cannot destroy "${name}": service not found.`);
                return;
            }

            const options = this._options.get(name);
            const instance = this._services.get(name);

            if (options && options.destroy) {
                try {
                    options.destroy(instance);
                } catch (err) {
                    console.error(`[ServiceContainer] Error destroying "${name}":`, err);
                }
            }

            this._services.delete(name);
            this._options.delete(name);

            this._emit('destroy', { name });
        }

        /**
         * 覆盖已注册的服务实例
         * @param {string} name - 服务名称
         * @param {*} instance - 新的服务实例
         * @param {Object} [opts] - 配置选项
         */
        override(name, instance, opts = {}) {
            if (!this._services.has(name)) {
                throw new Error(
                    `[ServiceContainer] Cannot override "${name}": service not registered. Use register() first.`
                );
            }

            // 先销毁旧实例
            const oldOptions = this._options.get(name);
            const oldInstance = this._services.get(name);

            if (oldOptions && oldOptions.destroy) {
                try {
                    oldOptions.destroy(oldInstance);
                } catch (err) {
                    console.error(`[ServiceContainer] Error destroying old instance of "${name}":`, err);
                }
            }

            const options = {
                singleton: opts.singleton !== false,
                destroy: typeof opts.destroy === 'function' ? opts.destroy : null
            };

            this._services.set(name, instance);
            this._options.set(name, options);

            this._emit('override', { name, instance, options, oldInstance });
        }

        /**
         * 列出所有已注册的服务名称
         * @returns {string[]}
         */
        list() {
            return Array.from(this._services.keys());
        }

        /**
         * 事件监听
         * @param {string} event - 事件名称 (register | destroy | override)
         * @param {Function} callback - 回调函数
         */
        on(event, callback) {
            if (typeof callback !== 'function') {
                throw new TypeError(`[ServiceContainer] Callback must be a function.`);
            }
            if (!this._listeners.has(event)) {
                this._listeners.set(event, new Set());
            }
            this._listeners.get(event).add(callback);
        }

        /**
         * 内部事件触发
         * @param {string} event - 事件名称
         * @param {*} data - 事件数据
         */
        _emit(event, data) {
            const listeners = this._listeners.get(event);
            if (!listeners) return;

            listeners.forEach((callback) => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[ServiceContainer] Error in "${event}" listener:`, err);
                }
            });
        }

        /**
         * 销毁所有服务
         */
        destroyAll() {
            const names = this.list();
            names.forEach((name) => this.destroy(name));
            this._listeners.clear();
        }
    }

    window.__ServiceContainer__ = ServiceContainer;
})();
