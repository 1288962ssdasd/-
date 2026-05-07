/**
 * FeatureFlags - 功能旗标管理器
 * 
 * 功能：
 * - 三级激活策略：config-driven / config-and-state / normal
 * - 状态变更事件广播
 * - 注册到 ServiceContainer
 */

// ============================================
// 策略类
// ============================================

/**
 * 策略1: 配置驱动（新/旧版本切换）
 * 适用: forum, weibo 等有版本切换需求的模块
 */
class ConfigDrivenStrategy {
  constructor(config) {
    this.flagName = config.flagName;
  }

  shouldActivate(flags) {
    return flags[this.flagName] === true;
  }
}

/**
 * 策略2: 配置+状态混合（数据依赖应用）
 * 适用: task, friends-circle 等需要数据才展示的应用
 */
class ConfigAndStateStrategy {
  constructor(config) {
    this.flagName = config.flagName;
    this.dataDependency = config.dataDependency;
  }

  shouldActivate(flags) {
    // 先检查功能旗标
    if (flags[this.flagName] !== true) return false;

    // 再检查数据状态
    if (this.dataDependency) {
      return this._checkDataDependency();
    }

    return true;
  }

  _checkDataDependency() {
    // 从 PhoneDataStore 检查数据状态
    const data = window.PhoneDataStore?.get(this.dataDependency);
    if (Array.isArray(data)) {
      return data.length > 0;
    }
    return !!data;
  }
}

/**
 * 策略3: 常规模块（独立应用）
 * 适用: diary, backpack, shop 等独立应用
 */
class NormalStrategy {
  constructor(config) {
    this.alwaysActive = config.alwaysActive !== false;
  }

  shouldActivate() {
    return this.alwaysActive;
  }
}

// ============================================
// FeatureFlags 主类
// ============================================
class FeatureFlagsClass {
  constructor() {
    this._flags = {};
    this._strategies = {};
    this._activationStates = {};
    this._defaults = {};
  }

  /**
   * 初始化配置
   * @param {Object} flags - 初始旗标配置
   */
  init(flags) {
    this._flags = { ...flags };
    this._defaults = { ...flags };
    
    // 注册到 ServiceContainer
    const core = window.__PHONE_CORE__;
    if (core?.container) {
      core.container.register('featureFlags', this);
    }

    console.log('[FeatureFlags] 已初始化:', Object.keys(this._flags));
  }

  /**
   * 获取旗标值
   * @param {string} name - 旗标名称
   * @returns {boolean | undefined}
   */
  get(name) {
    return this._flags[name];
  }

  /**
   * 设置旗标值
   * @param {string} name - 旗标名称
   * @param {boolean} value - 旗标值
   */
  set(name, value) {
    const oldValue = this._flags[name];
    
    // 值未变化，不触发事件
    if (oldValue === value) return;

    this._flags[name] = value;

    // 广播变更
    const core = window.__PHONE_CORE__;
    if (core?.events) {
      core.events.emit('feature-flag:changed', {
        name,
        value,
        oldValue
      });
    }
  }

  /**
   * 注册模块激活策略
   * @param {string} moduleName - 模块名称
   * @param {string} strategyType - 策略类型: 'config-driven' | 'config-and-state' | 'normal'
   * @param {Object} config - 策略配置
   */
  registerStrategy(moduleName, strategyType, config = {}) {
    let strategy;

    switch (strategyType) {
      case 'config-driven':
        strategy = new ConfigDrivenStrategy(config);
        break;
      case 'config-and-state':
        strategy = new ConfigAndStateStrategy(config);
        break;
      case 'normal':
      default:
        strategy = new NormalStrategy(config);
        break;
    }

    this._strategies[moduleName] = {
      type: strategyType,
      strategy,
      config
    };

    console.log(`[FeatureFlags] 注册策略: ${moduleName} (${strategyType})`);
  }

  /**
   * 检查模块是否应该激活
   * @param {string} moduleName - 模块名称
   * @returns {boolean}
   */
  shouldActivate(moduleName) {
    const strategyInfo = this._strategies[moduleName];

    // 无策略默认激活
    if (!strategyInfo) {
      return true;
    }

    const shouldActivate = strategyInfo.strategy.shouldActivate(this._flags);
    this._activationStates[moduleName] = shouldActivate;

    return shouldActivate;
  }

  /**
   * 获取所有旗标
   * @returns {Object}
   */
  getAll() {
    return { ...this._flags };
  }

  /**
   * 获取所有策略
   * @returns {Object}
   */
  getStrategies() {
    const result = {};
    for (const [name, info] of Object.entries(this._strategies)) {
      result[name] = {
        type: info.type,
        ...info.config
      };
    }
    return result;
  }

  /**
   * 获取所有模块激活状态
   * @returns {Object}
   */
  getActivationStates() {
    // 更新所有已注册策略的激活状态
    for (const moduleName of Object.keys(this._strategies)) {
      this.shouldActivate(moduleName);
    }
    return { ...this._activationStates };
  }

  /**
   * 重置所有旗标为默认值
   */
  reset() {
    this._flags = { ...this._defaults };
    console.log('[FeatureFlags] 已重置所有旗标为默认值');
  }

  /**
   * 清除所有状态
   */
  clear() {
    this._flags = {};
    this._strategies = {};
    this._activationStates = {};
    this._defaults = {};
  }
}

// 创建全局实例
const FeatureFlags = new FeatureFlagsClass();

// 导出
export default FeatureFlags;
export { FeatureFlags, FeatureFlagsClass, ConfigDrivenStrategy, ConfigAndStateStrategy, NormalStrategy };

// 全局挂载（浏览器环境）
if (typeof window !== 'undefined') {
  window.FeatureFlags = FeatureFlags;
}
