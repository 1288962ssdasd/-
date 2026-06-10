/**
 * domains-config.js - DataStore 域配置
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 所有 DataStore 域配置
   * 每个域定义: { name, schema, persist, debounceTime, retention? }
   */
  var ALL_DOMAINS = [
    { name: 'friends', schema: { list: { type: 'array' }, requests: { type: 'array' } }, persist: true, debounceTime: 200, retention: { max: 500 } },
    { name: 'messages', schema: { all: { type: 'object' }, pending: { type: 'array' }, lastSync: { type: 'number' } }, persist: true, debounceTime: 500, retention: { max: 200, maxAge: 7 * 24 * 3600 * 1000 } },
    { name: 'chatUi', schema: { currentView: { type: 'string' }, currentFriendId: { type: 'string' }, drafts: { type: 'object' } }, persist: true, debounceTime: 100 },
    { name: 'friendsCircle', schema: { circles: { type: 'array' }, myCircles: { type: 'array' }, myAvatar: { type: 'string' } }, persist: true, debounceTime: 300, retention: { max: 100 } },
    { name: 'weibo', schema: { posts: { type: 'array' }, myPosts: { type: 'array' }, account: { type: 'object' }, settings: { type: 'object' } }, persist: true, debounceTime: 300 },
    { name: 'forum', schema: { posts: { type: 'array' }, settings: { type: 'object' } }, persist: true, debounceTime: 300 },
    { name: 'shop', schema: { items: { type: 'array' }, purchases: { type: 'array' } }, persist: true, debounceTime: 300 },
    { name: 'backpack', schema: { items: { type: 'array' }, capacity: { type: 'number' } }, persist: true, debounceTime: 300 },
    { name: 'quest', schema: { quests: { type: 'array' }, completedIds: { type: 'array' } }, persist: true, debounceTime: 300 },
    { name: 'diary', schema: { entries: { type: 'array' } }, persist: true, debounceTime: 500 },
    { name: 'status', schema: { user: { type: 'object' }, achievements: { type: 'array' }, stats: { type: 'object' } }, persist: true, debounceTime: 200 },
    { name: 'live', schema: { streams: { type: 'array' }, history: { type: 'array' } }, persist: true, debounceTime: 1000 },
    { name: 'settings', schema: { notifications: { type: 'object' }, display: { type: 'object' }, privacy: { type: 'object' } }, persist: true, debounceTime: 100 },
    { name: 'profile', schema: { cache: { type: 'object' }, config: { type: 'object' } }, persist: true, debounceTime: 300 },
    { name: 'apiConfig', schema: { mainConfig: { type: 'object' }, moduleConfigs: { type: 'object' }, prompts: { type: 'object' }, history: { type: 'array' } }, persist: true, debounceTime: 300 },
    { name: 'sticker', schema: { recent: { type: 'array' }, favorites: { type: 'array' }, config: { type: 'object' } }, persist: true, debounceTime: 300 },
    { name: 'director', schema: { plan: { type: 'object' }, history: { type: 'array' } }, persist: true, debounceTime: 500 },
    { name: 'world', schema: { main: { type: 'object' }, step1: { type: 'object' }, step2: { type: 'object' } }, persist: true, debounceTime: 500 },
    { name: 'map', schema: { worldMap: { type: 'object' }, locals: { type: 'object' }, currentLocation: { type: 'string' } }, persist: true, debounceTime: 300 },
    { name: 'prompt', schema: { global: { type: 'object' } }, persist: true, debounceTime: 300 },
    { name: 'npc', schema: { list: { type: 'object' } }, persist: true, debounceTime: 300 },
    { name: 'storyEvolution', schema: { timeline: { type: 'array' } }, persist: true, debounceTime: 500 },
  ];

  window.PHONE_DOMAINS_CONFIG = ALL_DOMAINS;

})();
