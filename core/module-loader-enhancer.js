/**
 * ModuleLoader Enhancer - 模块加载器增强器
 * 
 * 为现有的 Phone Loader 添加条件加载能力
 * 支持 FeatureFlags 驱动的模块激活策略
 */

/**
 * 增强模块加载器
 * @param {Object} phoneLoader - 原始 Phone Loader 对象
 * @returns {Object} 增强后的 Loader
 */
export function enhanceModuleLoader(phoneLoader) {
  if (!phoneLoader) {
    console.warn('[ModuleLoaderEnhancer] Phone Loader 不存在');
    return null;
  }

  // 保存原始方法
  const originalLoad = phoneLoader.load;
  const originalGetStatus = phoneLoader.getStatus;

  // 跳过日志
  const _skipLog = [];

  /**
   * 检查模块是否应该加载
   * @param {string} moduleName - 模块名称
   * @returns {boolean}
   */
  function shouldLoadModule(moduleName) {
    // 使用 FeatureFlags 检查（FeatureFlags 已经注册了策略）
    const featureFlags = window.FeatureFlags;
    if (!featureFlags) {
      console.warn('[ModuleLoaderEnhancer] FeatureFlags 未初始化，默认加载模块');
      return true;
    }

    return featureFlags.shouldActivate(moduleName);
  }

  /**
   * 记录跳过原因
   * @param {string} moduleName
   * @param {string} reason
   */
  function logSkip(moduleName, reason) {
    _skipLog.push({
      name: moduleName,
      reason,
      timestamp: Date.now()
    });
    console.log(`[ModuleLoaderEnhancer] 跳过模块: ${moduleName}, 原因: ${reason}`);
  }

  /**
   * 获取跳过日志
   * @returns {Array}
   */
  function getSkipLog() {
    return [..._skipLog];
  }

  /**
   * 增强的加载方法
   * @param {Function} callback
   */
  function enhancedLoad(callback) {
    const moduleMap = phoneLoader._moduleMap || {};

    // 预处理：标记需要跳过的模块
    for (const name of Object.keys(moduleMap)) {
      if (!shouldLoadModule(name)) {
        const mod = moduleMap[name];
        mod._skip = true;
        logSkip(name, `FeatureFlag 策略返回 false`);
      }
    }

    // 调用原始加载方法
    if (originalLoad) {
      originalLoad.call(phoneLoader, callback);
    }
  }

  /**
   * 增强的状态获取方法
   */
  function enhancedGetStatus() {
    const status = originalGetStatus ? originalGetStatus.call(phoneLoader) : {};
    
    // 添加跳过信息
    for (const skip of _skipLog) {
      if (status[skip.name]) {
        status[skip.name].skipped = true;
        status[skip.name].skipReason = skip.reason;
      }
    }

    return status;
  }

  // 挂载增强方法
  phoneLoader.shouldLoadModule = shouldLoadModule;
  phoneLoader.getSkipLog = getSkipLog;
  phoneLoader.load = enhancedLoad;
  phoneLoader.getStatus = enhancedGetStatus;

  console.log('[ModuleLoaderEnhancer] Phone Loader 已增强');

  return phoneLoader;
}

/**
 * 创建模块激活配置
 * @param {string} type - 策略类型
 * @param {Object} config - 配置
 * @returns {Object}
 */
export function createActivationConfig(type, config = {}) {
  return {
    type,
    ...config
  };
}

// 默认导出
export default {
  enhanceModuleLoader,
  createActivationConfig
};

// 全局挂载
if (typeof window !== 'undefined') {
  window.ModuleLoaderEnhancer = {
    enhanceModuleLoader,
    createActivationConfig
  };
}
