/**
 * @layer Service    — 业务逻辑层
 * @file   data-cleanup-service.js
 * @depends Platform, DataStore
 * @emits  data:cleared, domain:cleared, character:reset
 *
 * 职责: 数据清理与销毁
 * 禁止: 操作DOM、直接调用Adapter（通过Platform.dataStore.clearByPrefix）
 *
 * 数据分层:
 *   角色卡数据 → domain前缀清理 (friends., messages., quest., ...)
 *   全局数据   → domain前缀清理 (apiConfig., settings., sticker.)
 *   会话状态   → 仅清内存缓存
 */

;(function () {
  'use strict';

  // 角色卡相关领域（跟随角色卡）
  var CHARACTER_DOMAINS = [
    'friends', 'messages', 'quest', 'profile',
    'diary', 'status', 'live', 'weibo', 'forum',
    'shop', 'backpack', 'friendsCircle'
  ];

  // 全局领域（跨角色卡）
  var GLOBAL_DOMAINS = [
    'apiConfig', 'settings', 'sticker'
  ];

  // 领域名 → Schema 构造函数名 映射
  var DOMAIN_TO_SCHEMA = {
    friends: 'Friends',
    messages: 'Messages',
    quest: null,        // 尚未实现
    profile: null,      // 尚未实现
    diary: 'Diary',
    status: null,       // 尚未实现
    live: 'Live',
    weibo: null,        // 尚未实现
    forum: null,        // 尚未实现
    shop: 'Shop',
    backpack: 'Backpack',
    friendsCircle: null, // 尚未实现
    apiConfig: 'ApiConfig',
    settings: null,     // 尚未实现
    sticker: null        // 尚未实现
  };

  function DataCleanupService(platform) {
    this._platform = platform;
  }

  // ==================== 角色卡数据清理 ====================

  /**
   * 清空当前角色卡的所有数据
   * @returns {Promise<{success: boolean, clearedDomains: string[], errors: Array}>}
   */
  DataCleanupService.prototype.clearCurrentCharacterData = async function () {
    var characterId = this._getCurrentCharacterId();
    return await this.clearCharacterData(characterId);
  };

  /**
   * 清空指定角色卡的所有数据
   * @param {string} characterId
   * @returns {Promise<{success: boolean, clearedDomains: string[], errors: Array}>}
   */
  DataCleanupService.prototype.clearCharacterData = async function (characterId) {
    if (!characterId) {
      return { success: false, clearedDomains: [], errors: [{ domain: '_', error: '无法获取角色卡ID' }] };
    }

    var clearedDomains = [];
    var errors = [];

    for (var i = 0; i < CHARACTER_DOMAINS.length; i++) {
      var domain = CHARACTER_DOMAINS[i];
      try {
        var count = await this._clearDomainForCharacter(domain, characterId);
        clearedDomains.push(domain);
      } catch (e) {
        console.warn('[DataCleanupService] 清理领域 ' + domain + ' 失败:', e);
        errors.push({ domain: domain, error: e.message });
      }
    }

    // 清理会话缓存（内存）
    this._clearSessionCache();

    // [铁则十二] emit 只在 Service 层数据操作后
    this._platform.emit('data:cleared', {
      id: 'dc_' + Date.now(),
      type: 'data:cleared',
      data: { scope: 'character', characterId: characterId, clearedDomains: clearedDomains, errors: errors },
      timestamp: Date.now(),
      source: 'data-cleanup-service'
    });

    return { success: errors.length === 0, clearedDomains: clearedDomains, errors: errors };
  };

  /**
   * 清空所有角色卡的数据
   * @returns {Promise<{success: boolean, clearedCount: number}>}
   */
  DataCleanupService.prototype.clearAllCharacterData = async function () {
    try {
      // 通过适配器获取所有变量键，筛选出角色卡数据
      var dataStore = this._platform.dataStore;
      if (!dataStore || !dataStore._adapter || typeof dataStore._adapter.list !== 'function') {
        console.warn('[DataCleanupService] 适配器不支持 list 操作');
        return { success: false, clearedCount: 0, error: '适配器不支持 list 操作' };
      }

      // 获取所有键，找出所有角色卡前缀
      var allKeys = await dataStore._adapter.list('');
      var characterPrefixes = new Set();

      for (var i = 0; i < allKeys.length; i++) {
        var key = allKeys[i];
        // 匹配角色卡数据格式: charId:domain.key
        var match = key.match(/^([^:]+):/);
        if (match && !GLOBAL_DOMAINS.some(function (d) { return key.startsWith(d + '.'); })) {
          characterPrefixes.add(match[1] + ':');
        }
      }

      var clearedCount = 0;
      var prefixes = Array.from(characterPrefixes);
      for (var j = 0; j < prefixes.length; j++) {
        try {
          await dataStore.clearByPrefix(prefixes[j], { persist: true, notify: false });
          clearedCount++;
        } catch (e) {
          console.warn('[DataCleanupService] 清理前缀 ' + prefixes[j] + ' 失败:', e);
        }
      }

      this._clearSessionCache();

      this._platform.emit('data:cleared', {
        id: 'dc_' + Date.now(),
        type: 'data:cleared',
        data: { scope: 'all_characters', clearedCount: clearedCount },
        timestamp: Date.now(),
        source: 'data-cleanup-service'
      });

      return { success: true, clearedCount: clearedCount };
    } catch (e) {
      console.warn('[DataCleanupService] 清空所有角色卡数据失败:', e);
      return { success: false, clearedCount: 0, error: e.message };
    }
  };

  // ==================== 全局数据清理 ====================

  /**
   * 清空全局设置
   * @returns {Promise<{success: boolean, clearedDomains: string[]}>}
   */
  DataCleanupService.prototype.clearGlobalSettings = async function () {
    var clearedDomains = [];
    var errors = [];

    for (var i = 0; i < GLOBAL_DOMAINS.length; i++) {
      var domain = GLOBAL_DOMAINS[i];
      try {
        var count = await this._clearDomainGlobal(domain);
        if (count > 0) {
          clearedDomains.push(domain);
        }
      } catch (e) {
        console.warn('[DataCleanupService] 清理全局领域 ' + domain + ' 失败:', e);
        errors.push({ domain: domain, error: e.message });
      }
    }

    this._platform.emit('data:cleared', {
      id: 'dc_' + Date.now(),
      type: 'data:cleared',
      data: { scope: 'global', clearedDomains: clearedDomains, errors: errors },
      timestamp: Date.now(),
      source: 'data-cleanup-service'
    });

    return { success: errors.length === 0, clearedDomains: clearedDomains, errors: errors };
  };

  // ==================== 单领域清理 ====================

  /**
   * 清空单个领域
   * @param {string} domain - 领域名
   * @param {object} options - { scope: 'character' | 'global' }
   * @returns {Promise<{success: boolean, cleared: number}>}
   */
  DataCleanupService.prototype.clearDomain = async function (domain, options) {
    options = options || {};
    var scope = options.scope || 'character';

    try {
      var cleared;
      if (scope === 'character') {
        var characterId = this._getCurrentCharacterId();
        cleared = await this._clearDomainForCharacter(domain, characterId);
      } else {
        cleared = await this._clearDomainGlobal(domain);
      }

      this._platform.emit('domain:cleared', {
        id: 'dc_' + Date.now(),
        type: 'domain:cleared',
        data: { domain: domain, scope: scope, cleared: cleared },
        timestamp: Date.now(),
        source: 'data-cleanup-service'
      });

      return { success: true, cleared: cleared };
    } catch (e) {
      console.warn('[DataCleanupService] 清理领域 ' + domain + ' 失败:', e);
      return { success: false, cleared: 0, error: e.message };
    }
  };

  // ==================== 重置角色卡 ====================

  /**
   * 重置当前角色卡（清空 + 重新初始化默认数据）
   * @returns {Promise<{success: boolean}>}
   */
  DataCleanupService.prototype.resetCurrentCharacter = async function () {
    var characterId = this._getCurrentCharacterId();

    try {
      // 1. 清空数据
      var result = await this.clearCharacterData(characterId);

      // 2. 重新初始化默认数据（预留接口）
      await this._initializeDefaultData(characterId);

      this._platform.emit('character:reset', {
        id: 'dc_' + Date.now(),
        type: 'character:reset',
        data: { characterId: characterId },
        timestamp: Date.now(),
        source: 'data-cleanup-service'
      });

      return { success: true };
    } catch (e) {
      console.warn('[DataCleanupService] 重置角色卡失败:', e);
      return { success: false, error: e.message };
    }
  };

  // ==================== 内部方法 ====================

  /**
   * 清理角色卡下某个领域
   */
  DataCleanupService.prototype._clearDomainForCharacter = async function (domain, characterId) {
    var dataStore = this._platform.dataStore;
    if (!dataStore) return 0;

    // 使用 DataStore.clearByPrefix
    // 当前键名格式: domain.key (未来铁则十三实施后为 charId:domain:key)
    var prefix = domain + '.';
    var count = await dataStore.clearByPrefix(prefix, { persist: true, notify: true });
    return count;
  };

  /**
   * 清理全局领域
   */
  DataCleanupService.prototype._clearDomainGlobal = async function (domain) {
    var dataStore = this._platform.dataStore;
    if (!dataStore) return 0;

    var prefix = domain + '.';
    var count = await dataStore.clearByPrefix(prefix, { persist: true, notify: true });
    return count;
  };

  /**
   * 清理会话缓存（内存）
   */
  DataCleanupService.prototype._clearSessionCache = function () {
    var dataStore = this._platform.dataStore;
    if (dataStore && dataStore._cache) {
      dataStore._cache.clear();
    }
    if (dataStore && dataStore._accessOrder) {
      dataStore._accessOrder = [];
    }
  };

  /**
   * 获取当前角色卡ID
   * [铁则六] 通过适配器获取
   */
  DataCleanupService.prototype._getCurrentCharacterId = function () {
    try {
      var adapter = this._platform.adapter;
      if (adapter && typeof adapter.getCurrentCharacter === 'function') {
        var char = adapter.getCurrentCharacter();
        if (char && char.avatar) return char.avatar;
      }
      return 'default';
    } catch (e) {
      console.warn('[DataCleanupService] 获取角色卡ID失败:', e);
      return 'default';
    }
  };

  /**
   * 初始化默认数据（预留）
   */
  DataCleanupService.prototype._initializeDefaultData = async function (characterId) {
    // 预留：后续可根据业务需求初始化默认好友、初始任务等
    console.log('[DataCleanupService] 角色卡 ' + characterId + ' 已重置（默认数据初始化待实现）');
  };

  // ==================== 导出 ====================
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.DataCleanup = DataCleanupService;
})();
