/**
 * FeatureFlags Adapter - 功能旗标适配器
 * 
 * 职责：
 * - 初始化 FeatureFlags
 * - 注册模块激活策略
 * - 设置默认 flag 值
 */

import FeatureFlagsModule from '../core/feature-flags.js';

// 获取 FeatureFlags 实例
const FeatureFlags = FeatureFlagsModule.default || FeatureFlagsModule;

// 默认 flag 配置
const DEFAULT_FLAGS = {
  'new-forum-ui': false,      // 论坛新版 UI（默认关闭）
  'new-weibo-ui': false,      // 微博新版 UI（默认关闭）
  'quest-app': true,          // 任务应用（默认开启）
  'friends-circle': true,     // 朋友圈（默认开启）
  'shop-app': true,           // 商店（默认开启）
  'diary-app': true           // 日记（默认开启）
};

// 模块激活策略配置
const MODULE_STRATEGIES = [
  // 论坛 - 配置驱动（版本切换）
  {
    name: 'forum-ui',
    type: 'config-driven',
    config: { flagName: 'new-forum-ui' }
  },
  {
    name: 'forum-control-app',
    type: 'config-driven',
    config: { flagName: 'new-forum-ui' }
  },

  // 微博 - 配置驱动（版本切换）
  {
    name: 'weibo-ui',
    type: 'config-driven',
    config: { flagName: 'new-weibo-ui' }
  },
  {
    name: 'weibo-control-app',
    type: 'config-driven',
    config: { flagName: 'new-weibo-ui' }
  },

  // 任务 - 配置+状态混合
  {
    name: 'quest-app',
    type: 'config-and-state',
    config: {
      flagName: 'quest-app',
      dataDependency: 'quest.activeQuests'
    }
  },

  // 朋友圈 - 配置+状态混合
  {
    name: 'friends-circle',
    type: 'config-and-state',
    config: {
      flagName: 'friends-circle',
      dataDependency: 'friendsCircle.circles'
    }
  },

  // 商店 - 常规模块
  {
    name: 'shop-app',
    type: 'normal',
    config: { alwaysActive: true }
  },

  // 日记 - 常规模块
  {
    name: 'diary-app',
    type: 'normal',
    config: { alwaysActive: true }
  },

  // 消息应用 - 常规模块
  {
    name: 'message-app',
    type: 'normal',
    config: { alwaysActive: true }
  }
];

/**
 * 初始化 FeatureFlags
 */
export function initFeatureFlags() {
  // 确保 __PHONE_CORE__ 存在
  if (!window.__PHONE_CORE__) {
    window.__PHONE_CORE__ = {
      container: {
        register: () => {},
        get: () => null,
        has: () => false
      },
      events: {
        on: () => {},
        emit: () => {}
      }
    };
  }

  // 挂载到 window
  window.FeatureFlags = FeatureFlags;

  console.log('[FeatureFlagsAdapter] 初始化 FeatureFlags');

  // 初始化 flags
  FeatureFlags.init(DEFAULT_FLAGS);

  // 注册策略
  _registerStrategies();

  console.log('[FeatureFlagsAdapter] 初始化完成');
}

/**
 * 注册激活策略
 */
function _registerStrategies() {
  for (const strategy of MODULE_STRATEGIES) {
    FeatureFlags.registerStrategy(strategy.name, strategy.type, strategy.config);
  }

  console.log('[FeatureFlagsAdapter] 激活策略已注册:', MODULE_STRATEGIES.length, '个');
}

/**
 * 获取当前 flag 配置
 */
export function getFlagConfig() {
  return FeatureFlags.getAll();
}

/**
 * 更新 flag 配置
 */
export function updateFlag(name, value) {
  FeatureFlags.set(name, value);
}

// 默认导出
export default {
  initFeatureFlags,
  getFlagConfig,
  updateFlag
};

// 全局挂载
if (typeof window !== 'undefined') {
  window.FeatureFlagsAdapter = {
    initFeatureFlags,
    getFlagConfig,
    updateFlag
  };
}
