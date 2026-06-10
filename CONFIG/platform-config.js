/**
 * Platform 配置（从 index.js 提取的硬编码配置）
 * 所有 Platform 初始化参数必须在此文件集中管理
 */

;(function () {
  'use strict';

  // 适配器配置
  var ADAPTER_CONFIG = {
    type: 'SillyTavern',
    apiBase: '/api/plugins/xb-bridge-test',
    varPrefix: 'xb',
    cacheEnabled: true,
    cacheTTL: 500,
  };

  // Domain 领域配置
  var DOMAINS_CONFIG = [
    { name: 'friends', schema: { list: { type: 'array' } }, persist: true, debounceTime: 200, retention: { max: 500 } },
    { name: 'messages', schema: {}, persist: true, debounceTime: 500, retention: { max: 200, maxAge: 7 * 24 * 3600 * 1000 } },
    { name: 'chat', schema: {}, persist: true, debounceTime: 300 },
    { name: 'friendsCircle', schema: { circles: { type: 'array' } }, persist: true, debounceTime: 300, retention: { max: 100 } },
    { name: 'weibo', schema: { posts: { type: 'array' } }, persist: true, debounceTime: 500, retention: { max: 100 } },
    { name: 'apiConfig', schema: {}, persist: true, debounceTime: 300 },
    { name: 'sticker', schema: {}, persist: true, debounceTime: 300 },
    { name: 'shop', schema: { items: { type: 'array' } }, persist: true, debounceTime: 300 },
    { name: 'backpack', schema: { items: { type: 'array' } }, persist: true, debounceTime: 300 },
    { name: 'quest', schema: { registry: { type: 'array' } }, persist: true, debounceTime: 500 },
    { name: 'diary', schema: { entries: { type: 'array' } }, persist: true, debounceTime: 500, retention: { max: 100 } },
    { name: 'status', schema: { characters: { type: 'array' } }, persist: true, debounceTime: 300 },
    { name: 'live', schema: {}, persist: true, debounceTime: 300, retention: { max: 20, maxAge: 24 * 3600 * 1000 } },
  ];

  // 导出
  window.__PHONE_CONFIG__ = {
    ADAPTER: ADAPTER_CONFIG,
    DOMAINS: DOMAINS_CONFIG,
  };
})();
