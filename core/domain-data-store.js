/**
 * DomainDataStore - 增强版领域数据层
 * 
 * 功能：
 * - 领域划分（domain prefix）
 * - PathMapper 路径映射
 * - 批量操作去抖
 * - 简单事务支持
 * - 数据版本迁移
 * - 数据验证
 */

// ============================================
// PathMapper - 路径映射器
// ============================================
class PathMapper {
  constructor() {
    /** @type {Map<string, {domain: string, key: string}>} */
    this._mappings = new Map();
  }

  /**
   * 注册路径映射
   * @param {string} storagePath - 存储路径，如 'xb.friendsCircle.circles'
   * @param {string} domain - 领域名
   * @param {string} key - 键名
   */
  register(storagePath, domain, key) {
    this._mappings.set(storagePath, { domain, key });
    console.log(`[PathMapper] 注册映射: ${storagePath} → ${domain}.${key}`);
  }

  /**
   * 解析存储路径到领域键
   * @param {string} storagePath
   * @returns {{domain: string, key: string} | null}
   */
  resolve(storagePath) {
    return this._mappings.get(storagePath) || null;
  }

  /**
   * 从领域键生成存储路径
   * @param {string} domain
   * @param {string} key
   * @returns {string}
   */
  toStoragePath(domain, key) {
    // 反向查找
    for (const [path, mapping] of this._mappings) {
      if (mapping.domain === domain && mapping.key === key) {
        return path;
      }
    }
    // 默认格式: domain.key (不带 xb. 前缀，与测试期望一致)
    return `${domain}.${key}`;
  }

  /**
   * 清除所有映射
   */
  clear() {
    this._mappings.clear();
  }
}

// ============================================
// DebounceManager - 去抖管理器
// ============================================
class DebounceManager {
  constructor() {
    /** @type {Map<string, {operations: Array, timer: number | null}>} */
    this._pending = new Map();
  }

  /**
   * 添加去抖操作
   * @param {string} key - 操作键
   * @param {Function} execute - 执行函数
   * @param {number} debounceTime - 去抖时间(ms)
   */
  add(key, execute, debounceTime = 50) {
    let pending = this._pending.get(key);
    
    if (!pending) {
      pending = { operations: [], timer: null };
      this._pending.set(key, pending);
    }

    // 清除之前的定时器
    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    // 添加操作
    pending.operations.push(execute);

    // 设置新的定时器
    pending.timer = setTimeout(() => {
      const ops = this._pending.get(key);
      if (ops && ops.operations.length > 0) {
        // 执行最后一个操作
        const lastOp = ops.operations[ops.operations.length - 1];
        lastOp();
        console.log(`[Debounce] 合并执行 ${ops.operations.length} 个操作: ${key}`);
      }
      this._pending.delete(key);
    }, debounceTime);
  }

  /**
   * 立即刷新所有待处理操作
   */
  flush() {
    for (const [key, pending] of this._pending) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      if (pending.operations.length > 0) {
        const lastOp = pending.operations[pending.operations.length - 1];
        lastOp();
      }
    }
    this._pending.clear();
  }

  /**
   * 清除所有待处理操作
   */
  clear() {
    for (const pending of this._pending.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
    }
    this._pending.clear();
  }
}

// ============================================
// TransactionManager - 事务管理器
// ============================================
class TransactionManager {
  constructor() {
    /** @type {{active: boolean, rollbackData: Map<string, any>} | null} */
    this._current = null;
  }

  /**
   * 开始事务
   */
  begin() {
    if (this._current && this._current.active) {
      throw new Error('[Transaction] 事务已存在，不支持嵌套事务');
    }
    this._current = {
      active: true,
      rollbackData: new Map()
    };
    console.log('[Transaction] 事务开始');
  }

  /**
   * 记录操作（内部使用）
   * @param {string} fullKey - 完整键名 (domain.key)
   * @param {any} oldValue - 旧值
   */
  record(fullKey, oldValue) {
    if (!this._current || !this._current.active) return;
    
    // 只记录第一次的旧值（用于回滚）
    if (!this._current.rollbackData.has(fullKey)) {
      this._current.rollbackData.set(fullKey, oldValue);
    }
  }

  /**
   * 提交事务
   */
  commit() {
    if (!this._current || !this._current.active) {
      throw new Error('[Transaction] 没有活动事务');
    }
    console.log('[Transaction] 提交事务');
    this._current = null;
  }

  /**
   * 回滚事务
   * @param {Function} restoreFn - 恢复函数 (fullKey, value) => void
   */
  rollback(restoreFn) {
    if (!this._current || !this._current.active) {
      throw new Error('[Transaction] 没有活动事务');
    }
    
    console.log('[Transaction] 回滚事务');
    
    // 恢复所有数据
    for (const [fullKey, oldValue] of this._current.rollbackData) {
      restoreFn(fullKey, oldValue);
    }
    
    this._current = null;
  }

  /**
   * 执行事务包装函数
   * @param {Function} fn - 事务函数
   * @param {Function} [restoreFn] - 恢复函数（可选）
   */
  run(fn, restoreFn) {
    this.begin();
    try {
      fn();
      this.commit();
    } catch (e) {
      if (restoreFn) {
        this.rollback(restoreFn);
      } else {
        // 没有 restoreFn 时，只清除事务状态
        console.log('[Transaction] 回滚事务（无恢复函数）');
        this._current = null;
      }
      throw e;
    }
  }

  /**
   * 检查是否在事务中
   */
  isActive() {
    return this._current && this._current.active;
  }
}

// ============================================
// MigrationManager - 迁移管理器
// ============================================
class MigrationManager {
  constructor() {
    /** @type {Map<string, Array<{fromVersion: number, toVersion: number, migrate: Function}>>} */
    this._migrations = new Map();
  }

  /**
   * 注册迁移
   * @param {string} domain
   * @param {{fromVersion: number, toVersion: number, migrate: Function}} migration
   */
  register(domain, migration) {
    if (!this._migrations.has(domain)) {
      this._migrations.set(domain, []);
    }
    this._migrations.get(domain).push(migration);
    console.log(`[Migration] 注册迁移: ${domain} v${migration.fromVersion} → v${migration.toVersion}`);
  }

  /**
   * 获取领域的迁移列表（内部使用）
   * @param {string} domain
   * @returns {Array}
   */
  _getMigrations(domain) {
    return this._migrations.get(domain) || [];
  }

  /**
   * 执行迁移
   * @param {string} domain
   * @param {any} data
   * @param {number} currentVersion
   * @returns {{data: any, version: number}}
   */
  migrate(domain, data, currentVersion = 1) {
    const migrations = this._migrations.get(domain) || [];
    let result = data;
    let version = currentVersion;

    for (const m of migrations) {
      if (m.fromVersion === version) {
        try {
          result = m.migrate(result);
          version = m.toVersion;
          console.log(`[Migration] 执行迁移: ${domain} v${m.fromVersion} → v${m.toVersion}`);
        } catch (e) {
          console.error(`[Migration] 迁移失败: ${domain}`, e);
          break;
        }
      }
    }

    return { data: result, version };
  }

  /**
   * 清除所有迁移
   */
  clear() {
    this._migrations.clear();
  }
}

// ============================================
// DomainManager - 领域管理器
// ============================================
class DomainManager {
  /**
   * @param {string} name - 领域名
   * @param {Object} config - 配置
   * @param {Object} config.schema - 数据 schema
   * @param {number} config.version - 数据版本
   * @param {Array} config.migrations - 迁移列表
   * @param {Object} config.persist - 持久化配置
   * @param {PathMapper} pathMapper - 路径映射器实例
   * @param {DebounceManager} debounceManager - 去抖管理器实例
   * @param {TransactionManager} transactionManager - 事务管理器实例
   */
  constructor(name, config, pathMapper, debounceManager, transactionManager) {
    this.name = name;
    this.schema = config.schema || {};
    this.version = config.version || 1;
    this.migrations = config.migrations || [];
    this.persistConfig = config.persist || { strategy: 'immediate' };
    this.retention = config.retention || null;

    this._pathMapper = pathMapper;
    this._debounceManager = debounceManager;
    this._transactionManager = transactionManager;
    this._localCache = new Map();
  }

  /**
   * 获取存储键
   * @param {string} key
   * @returns {string}
   */
  _getStorageKey(key) {
    return this._pathMapper.toStoragePath(this.name, key);
  }

  /**
   * 获取数据
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    // 先查本地缓存
    if (this._localCache.has(key)) {
      return this._localCache.get(key);
    }

    // 查 PhoneDataStore
    const storageKey = this._getStorageKey(key);
    const value = window.PhoneDataStore?.get(storageKey);
    
    if (value !== undefined) {
      this._localCache.set(key, value);
    }
    
    return value;
  }

  /**
   * 设置数据
   * @param {string} key
   * @param {any} value
   * @param {Object} options
   * @returns {boolean}
   */
  set(key, value, options = {}) {
    // 数据验证
    if (this.schema[key] && !this._validate(value, this.schema[key])) {
      console.warn(`[Domain:${this.name}] 数据校验失败: ${key}`);
      return false;
    }

    const storageKey = this._getStorageKey(key);
    const oldValue = this.get(key);

    // 事务记录
    if (this._transactionManager.isActive()) {
      this._transactionManager.record(`${this.name}.${key}`, oldValue);
    }

    // 根据策略处理
    const strategy = options.strategy || this.persistConfig.strategy;

    if (options.debounce || strategy === 'debounce') {
      // 去抖模式
      this._debounceManager.add(`${this.name}.${key}`, () => {
        this._setDirect(key, value, options);
      }, options.debounceTime || this.persistConfig.debounceTime || 50);
    } else {
      // 立即执行
      this._setDirect(key, value, options);
    }

    return true;
  }

  /**
   * 直接设置（内部使用）
   */
  _setDirect(key, value, options = {}) {
    const storageKey = this._getStorageKey(key);

    // 更新本地缓存
    this._localCache.set(key, value);

    // 自动注入元数据
    if (this.retention && this.retention.autoMeta && Array.isArray(value)) {
      // 不修改原始引用，只在需要时处理
    }

    // 更新 PhoneDataStore
    window.PhoneDataStore?.set(storageKey, value, {
      persist: options.persist !== false,
      broadcast: options.broadcast !== false
    });

    // 触发自动清理（异步，不阻塞写入）
    if (this.retention && options.persist !== false) {
      this._scheduleRetentionCheck(key);
    }
  }

  /**
   * 删除数据
   * @param {string} key
   */
  delete(key) {
    this._localCache.delete(key);
    const storageKey = this._getStorageKey(key);
    window.PhoneDataStore?.delete(storageKey);
  }

  /**
   * 批量设置
   * @param {Object} data
   * @param {Object} options
   */
  setAll(data, options = {}) {
    for (const key in data) {
      this.set(key, data[key], options);
    }
  }

  /**
   * 批量获取
   * @param {string[]} keys
   * @returns {Object}
   */
  getAll(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * 订阅数据变更
   * @param {string} key
   * @param {Function} callback
   * @returns {Function} 取消订阅函数
   */
  subscribe(key, callback) {
    const storageKey = this._getStorageKey(key);
    return window.PhoneDataStore?.subscribe(storageKey, callback) || (() => {});
  }

  /**
   * 数据验证
   * @param {any} value
   * @param {Object} schema
   * @returns {boolean}
   */
  _validate(value, schema) {
    if (!schema) return true;

    // 类型校验
    if (schema.type) {
      if (schema.type === 'array') {
        if (!Array.isArray(value)) return false;
      } else if (typeof value !== schema.type) {
        return false;
      }
    }

    // 数组项校验
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      for (const item of value) {
        if (!this._validateObject(item, schema.items)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 对象字段验证
   */
  _validateObject(obj, schema) {
    for (const field in schema) {
      const fieldSchema = schema[field];
      if (fieldSchema.required && !(field in obj)) {
        return false;
      }
      if (obj[field] !== undefined && fieldSchema.type) {
        if (typeof obj[field] !== fieldSchema.type) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 执行数据迁移
   */
  migrate() {
    for (const key of Object.keys(this.schema)) {
      const value = this.get(key);
      if (value !== undefined) {
        const result = this._migrateData(key, value);
        if (result.migrated) {
          this._setDirect(key, result.data, { persist: true });
        }
      }
    }
  }

  /**
   * 迁移单个数据
   */
  _migrateData(key, data) {
    // 简化版：假设版本存储在数据中或使用领域版本
    let currentVersion = 1;
    let result = data;

    for (const m of this.migrations) {
      if (m.fromVersion === currentVersion) {
        try {
          result = m.migrate(result);
          currentVersion = m.toVersion;
        } catch (e) {
          console.error(`[Domain:${this.name}] 迁移失败: ${key}`, e);
          break;
        }
      }
    }

    return { data: result, migrated: currentVersion !== 1 };
  }

  /**
   * 调度 retention 检查（去抖，避免频繁触发）
   */
  _scheduleRetentionCheck(key) {
    if (this._retentionTimer) return;
    this._retentionTimer = setTimeout(() => {
      this._retentionTimer = null;
      this._applyRetention(key);
    }, 1000);
  }

  /**
   * 应用 retention 策略
   * @param {string} key - 数据键
   */
  _applyRetention(key) {
    if (!this.retention) return;

    const value = this.get(key);
    if (value === undefined || value === null) return;

    const rule = this.retention;

    // 按数量淘汰（仅数组类型）
    if (rule.max && Array.isArray(value) && value.length > rule.max) {
      const trimmed = value.slice(-rule.max);
      this._localCache.set(key, trimmed);
      const storageKey = this._getStorageKey(key);
      window.PhoneDataStore?.set(storageKey, trimmed, { persist: true, broadcast: false });
      console.log(`[Domain:${this.name}] Retention: ${key} 淘汰 ${value.length - rule.max} 条，保留 ${rule.max} 条`);
    }

    // 按时间淘汰（数组中每项需要有 _t 或 timestamp 字段）
    if (rule.maxAge && Array.isArray(value)) {
      const cutoff = Date.now() - rule.maxAge;
      const filtered = value.filter(item => {
        const ts = item._t || item.timestamp || item.time || 0;
        return ts >= cutoff || ts === 0;
      });
      if (filtered.length < value.length) {
        this._localCache.set(key, filtered);
        const storageKey = this._getStorageKey(key);
        window.PhoneDataStore?.set(storageKey, filtered, { persist: true, broadcast: false });
        console.log(`[Domain:${this.name}] Retention: ${key} 按时间淘汰 ${value.length - filtered.length} 条`);
      }
    }

    // 按最大条数淘汰历史记录（非数组，用于通知历史等）
    if (rule.maxHistory && Array.isArray(value) && value.length > rule.maxHistory) {
      const trimmed = value.slice(-rule.maxHistory);
      this._localCache.set(key, trimmed);
      const storageKey = this._getStorageKey(key);
      window.PhoneDataStore?.set(storageKey, trimmed, { persist: true, broadcast: false });
      console.log(`[Domain:${this.name}] Retention: ${key} 历史限制 ${value.length} → ${rule.maxHistory}`);
    }
  }

  /**
   * 获取显示窗口数据（UI 用）
   * 如果配置了 display 限制，返回最后 N 条；否则返回全量
   */
  getForDisplay(key) {
    const value = this.get(key);
    if (!Array.isArray(value)) return value;

    if (this.retention && this.retention.display) {
      return value.slice(-this.retention.display);
    }
    return value;
  }

  /**
   * 获取全量数据（RAG/索引 用）
   */
  getFull(key) {
    return this.get(key);
  }
}

// ============================================
// DomainDataStore - 主入口
// ============================================
class DomainDataStoreClass {
  constructor() {
    this._domains = new Map();
    this._pathMapper = new PathMapper();
    this._debounceManager = new DebounceManager();
    this._transactionManager = new TransactionManager();
    this._migrationManager = new MigrationManager();
  }

  // 暴露子模块
  get PathMapper() {
    return this._pathMapper;
  }

  // Transaction 包装器，提供自动恢复能力
  get Transaction() {
    const self = this;
    return {
      /**
       * 执行事务
       * @param {Function} fn - 事务函数
       */
      run: (fn) => {
        this._transactionManager.begin();
        try {
          fn();
          this._transactionManager.commit();
        } catch (e) {
          // 自动恢复数据
          this._transactionManager.rollback((fullKey, oldValue) => {
            const [domain, key] = fullKey.split('.');
            const manager = self._domains.get(domain);
            if (manager) {
              manager._setDirect(key, oldValue, { persist: true, broadcast: false });
            }
          });
          throw e;
        }
      },

      /**
       * 开始事务
       */
      begin: () => this._transactionManager.begin(),

      /**
       * 提交事务
       */
      commit: () => this._transactionManager.commit(),

      /**
       * 检查是否在事务中
       */
      isActive: () => this._transactionManager.isActive()
    };
  }

  get Migration() {
    return this._migrationManager;
  }

  /**
   * 注册领域
   * @param {string} name
   * @param {Object} config
   * @returns {DomainManager}
   */
  register(name, config = {}) {
    if (this._domains.has(name)) {
      console.warn(`[DomainDataStore] 领域已存在: ${name}`);
      return this._domains.get(name);
    }

    const manager = new DomainManager(
      name,
      config,
      this._pathMapper,
      this._debounceManager,
      this._transactionManager
    );

    this._domains.set(name, manager);

    // 注册到 ServiceContainer
    const core = window.__PHONE_CORE__;
    if (core?.container) {
      core.container.register(`domain:${name}`, manager);
    }

    // 注册迁移
    if (config.migrations) {
      for (const m of config.migrations) {
        this._migrationManager.register(name, m);
      }
    }

    // 执行数据迁移
    manager.migrate();

    console.log(`[DomainDataStore] 领域已注册: ${name}`);
    return manager;
  }

  /**
   * 获取领域
   * @param {string} name
   * @returns {DomainManager | undefined}
   */
  get(name) {
    return this._domains.get(name);
  }

  /**
   * 获取所有领域名
   * @returns {string[]}
   */
  getAllDomains() {
    return Array.from(this._domains.keys());
  }

  /**
   * 刷新所有去抖操作
   */
  flush() {
    this._debounceManager.flush();
  }

  /**
   * 清除所有领域
   */
  clear() {
    this._domains.clear();
    this._pathMapper.clear();
    this._debounceManager.clear();
    this._migrationManager.clear();
  }
}

// 创建全局实例
const DomainDataStore = new DomainDataStoreClass();

// 导出（支持 ES Module 和全局变量）
export default DomainDataStore;
export { DomainDataStore, DomainManager, PathMapper, DebounceManager, TransactionManager, MigrationManager };

// 全局挂载（浏览器环境）
if (typeof window !== 'undefined') {
  window.DomainDataStore = DomainDataStore;
}
