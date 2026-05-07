/**
 * DomainDataStore Adapter - 领域数据存储适配器
 * 
 * 职责：
 * - 初始化 DomainDataStore
 * - 注册默认领域
 * - 配置 PathMapper 映射
 */

import DomainDataStoreModule from '../core/domain-data-store.js';

// 获取 DomainDataStore 实例
const DomainDataStore = DomainDataStoreModule.default || DomainDataStoreModule;

/**
 * 初始化 DomainDataStore
 */
export function initDomainDataStore() {
  // 确保 PhoneDataStore 存在
  if (!window.PhoneDataStore) {
    console.warn('[DomainDataStoreAdapter] PhoneDataStore 未就绪');
  }

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
  window.DomainDataStore = DomainDataStore;

  console.log('[DomainDataStoreAdapter] 初始化 DomainDataStore');

  // 注册 PathMapper 映射（解决旧数据路径问题）
  _registerPathMappings();

  // 注册默认领域
  _registerDefaultDomains();

  console.log('[DomainDataStoreAdapter] 初始化完成');
}

/**
 * 注册 PathMapper 映射
 */
function _registerPathMappings() {
  const pathMapper = DomainDataStore.PathMapper;

  // 朋友圈数据映射
  pathMapper.register('xb.friendsCircle.circles', 'friendsCircle', 'circles');
  pathMapper.register('xb.friendsCircle.settings', 'friendsCircle', 'settings');

  // 消息数据映射
  pathMapper.register('xb.messages', 'chat', 'messages');
  pathMapper.register('xb.friends', 'chat', 'friends');

  // 任务数据映射
  pathMapper.register('xb.quest.activeQuests', 'quest', 'activeQuests');
  pathMapper.register('xb.quest.completedQuests', 'quest', 'completedQuests');

  // 商店数据映射
  pathMapper.register('xb.shop.balance', 'shop', 'balance');
  pathMapper.register('xb.shop.items', 'shop', 'items');

  // 背包数据映射
  pathMapper.register('xb.backpack.items', 'backpack', 'items');

  console.log('[DomainDataStoreAdapter] PathMapper 映射已注册');
}

/**
 * 注册默认领域
 */
function _registerDefaultDomains() {
  // 论坛领域 - 持久化，全量保留（RAG 索引用）
  DomainDataStore.register('forum', {
    schema: {
      posts: { type: 'array' },
      categories: { type: 'array' },
      settings: { type: 'object' }
    },
    version: 1,
    retention: {
      display: 50,        // UI 只显示最近50条
      index: 'all'         // RAG 索引全量（不淘汰）
    }
  });

  // 微博领域 - 持久化，全量保留
  DomainDataStore.register('weibo', {
    schema: {
      posts: { type: 'array' },
      hotTopics: { type: 'array' },
      settings: { type: 'object' }
    },
    version: 1,
    retention: {
      display: 50
    }
  });

  // 聊天领域 - 持久化，按人数保留最近消息
  DomainDataStore.register('chat', {
    schema: {
      messages: { type: 'array' },
      friends: { type: 'array' },
      conversations: { type: 'object' }
    },
    version: 1,
    retention: {
      display: 50,        // 每个好友显示最近50条
      index: 'all'         // RAG 索引全量
    }
  });

  // 任务领域 - 持久化，活跃任务自动归档
  DomainDataStore.register('quest', {
    schema: {
      activeQuests: { type: 'array' },
      completedQuests: { type: 'array' },
      settings: { type: 'object' }
    },
    version: 1,
    retention: {
      display: 20,        // UI 显示最近20个活跃任务
      maxHistory: 200      // 完成记录最多保留200条
    }
  });

  // 朋友圈领域 - 持久化，30天过期
  DomainDataStore.register('friendsCircle', {
    schema: {
      circles: { type: 'array' },
      moments: { type: 'array' },
      settings: { type: 'object' }
    },
    version: 1,
    retention: {
      display: 30,                 // UI 显示最近30条
      maxAge: 30 * 24 * 3600000,   // 30天过期（2592000000ms）
      index: 'all'                 // RAG 索引全量
    }
  });

  // 商店领域 - 持久化
  DomainDataStore.register('shop', {
    schema: {
      balance: { type: 'number' },
      items: { type: 'array' },
      transactions: { type: 'array' }
    },
    version: 1,
    retention: {
      maxHistory: 100     // 交易记录最多100条
    }
  });

  // 背包领域 - 持久化
  DomainDataStore.register('backpack', {
    schema: {
      items: { type: 'array' },
      capacity: { type: 'number' }
    },
    version: 1
  });

  // 直播领域 - 仅内存，会话级
  DomainDataStore.register('live', {
    schema: {
      danmaku: { type: 'array' },
      currentStream: { type: 'object' }
    },
    version: 1,
    persist: { strategy: 'immediate' },
    retention: {
      max: 200            // 弹幕最多保留200条
    }
  });

  // 系统通知领域 - 仅内存，短期
  DomainDataStore.register('system', {
    schema: {
      notifications: { type: 'array' }
    },
    version: 1,
    retention: {
      max: 50,            // 当前通知最多50条
      maxAge: 30000        // 30秒过期
    }
  });

  // UI 临时状态领域 - 仅内存，会话级
  DomainDataStore.register('ui', {
    schema: {
      state: { type: 'object' }
    },
    version: 1
  });

  console.log('[DomainDataStoreAdapter] 默认领域已注册:', DomainDataStore.getAllDomains());
}

// 默认导出
export default {
  initDomainDataStore
};

// 全局挂载
if (typeof window !== 'undefined') {
  window.DomainDataStoreAdapter = {
    initDomainDataStore
  };
}
