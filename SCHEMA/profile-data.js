/**
 * ProfileData - 个人资料数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Profile
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'profile';

  /**
   * ProfileData 个人资料数据操作类
   */
  class ProfileData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 档案操作 ====================

    /**
     * 获取档案列表
     * @returns {Promise<Array>}
     */
    async getProfiles() {
      return await this._get('profiles', []);
    }

    /**
     * 获取单个档案
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async getById(profileId) {
      const profiles = await this.getProfiles();
      return profiles.find(p => p.id === profileId) || null;
    }

    /**
     * 添加档案
     * @param {Object} profile - { name, avatar?, description?, tags? }
     * @returns {Promise<Object>}
     */
    async addProfile(profile) {
      const profiles = await this.getProfiles();

      // 检查是否已存在同名档案
      if (profiles.some(p => p.name === profile.name)) {
        console.warn('[ProfileData] 档案已存在:', profile.name);
        return null;
      }

      const newProfile = {
        id: this._generateId(),
        name: profile.name || '未知角色',
        avatar: profile.avatar || '',
        description: profile.description || '',
        tags: profile.tags || [],
        attributes: profile.attributes || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: profile.source || 'manual', // manual | worldbook | ai
      };

      profiles.push(newProfile);
      await this._set('profiles', profiles);

      this._emit('profile:added', { profile: newProfile });
      return newProfile;
    }

    /**
     * 更新档案
     * @param {string} profileId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateProfile(profileId, updates) {
      const profiles = await this.getProfiles();
      const profile = profiles.find(p => p.id === profileId);

      if (!profile) return false;

      Object.assign(profile, updates, { updatedAt: Date.now() });
      await this._set('profiles', profiles);

      this._emit('profile:updated', { profileId, updates });
      return true;
    }

    /**
     * 删除档案
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async deleteProfile(profileId) {
      const profiles = await this.getProfiles();
      const index = profiles.findIndex(p => p.id === profileId);

      if (index === -1) return false;

      const removed = profiles.splice(index, 1)[0];
      await this._set('profiles', profiles);

      this._emit('profile:deleted', { profileId, profile: removed });
      return true;
    }

    /**
     * 按名称搜索档案
     * @param {string} name
     * @returns {Promise<Array>}
     */
    async searchByName(name) {
      const profiles = await this.getProfiles();
      const lowerName = name.toLowerCase();
      return profiles.filter(p => p.name.toLowerCase().includes(lowerName));
    }

    // ==================== 缓存操作 ====================

    /**
     * 获取缓存
     * @returns {Promise<Object>}
     */
    async getCache() {
      return await this._get('cache', {
        lastSync: 0,
        worldbookLoaded: false,
      });
    }

    /**
     * 更新缓存
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateCache(updates) {
      const cache = await this.getCache();
      await this._set('cache', { ...cache, ...updates });
      return true;
    }

    /**
     * 清空缓存
     * @returns {Promise<boolean>}
     */
    async clearCache() {
      await this._set('cache', {
        lastSync: 0,
        worldbookLoaded: false,
      });
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅档案列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeProfiles(callback) {
      return this._subscribe('profiles', callback);
    }

    // ==================== 内部方法 ====================

        async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[Schema] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

        async _set(key, value) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }
      
      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, key, value, { persist: true });
      
      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      return this._platform.subscribeData(DOMAIN, key, callback);
    }

    /**
     * @deprecated 事件发射已迁移到 Service 层（铁则三）
     * 保留此方法以兼容旧代码调用，但不再实际发射事件
     */
    _emit(eventType, data) {
      // no-op: 事件发射由 ProfileService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'profile_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Profile = ProfileData;

  console.log('[Schema] ProfileData 已加载');
})();
