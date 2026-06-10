/**
 * CharacterMetadata - 角色元数据 Schema 辅助函数
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过 Schema 辅助函数
 * - 铁则十三：数据隔离 {charId}:{domain}:{key}
 *
 * 用途：缓存角色卡信息，避免每次从 ST 上下文抓取
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  const DOMAIN = 'character';

  /**
   * CharacterMetadata 角色元数据操作类
   */
  class CharacterMetadata {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 元数据操作 ====================

    /**
     * 获取角色元数据
     * @param {string} charId
     * @returns {Promise<Object|null>}
     */
    async get(charId) {
      return await this._get(`meta:${charId}`, null);
    }

    /**
     * 设置角色元数据
     * @param {string} charId
     * @param {Object} data
     * @returns {Promise<boolean>}
     */
    async set(charId, data) {
      const meta = {
        id: charId,
        name: data.name || '',
        description: data.description || '',
        personality: data.personality || '',
        scenario: data.scenario || '',
        firstMes: data.firstMes || '',
        avatar: data.avatar || null,
        tags: data.tags || [],
        createdAt: data.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await this._set(`meta:${charId}`, meta);
      this._emit('character:metaUpdated', { charId, meta });
      return true;
    }

    /**
     * 部分更新角色元数据
     * @param {string} charId
     * @param {Object} partial
     * @returns {Promise<boolean>}
     */
    async update(charId, partial) {
      const current = await this.get(charId);
      if (!current) {
        console.warn('[CharacterMetadata] 角色不存在，无法更新:', charId);
        return false;
      }

      const updated = {
        ...current,
        ...partial,
        updatedAt: Date.now(),
      };

      await this._set(`meta:${charId}`, updated);
      this._emit('character:metaUpdated', { charId, meta: updated });
      return true;
    }

    /**
     * 删除角色元数据
     * @param {string} charId
     * @returns {Promise<boolean>}
     */
    async delete(charId) {
      await this._set(`meta:${charId}`, null);
      this._emit('character:metaDeleted', { charId });
      return true;
    }

    // ==================== 标签操作 ====================

    /**
     * 获取角色标签
     * @param {string} charId
     * @returns {Promise<Array>}
     */
    async getTags(charId) {
      const meta = await this.get(charId);
      return meta?.tags || [];
    }

    /**
     * 添加标签
     * @param {string} charId
     * @param {string} tag
     * @returns {Promise<boolean>}
     */
    async addTag(charId, tag) {
      const meta = await this.get(charId);
      if (!meta) {
        console.warn('[CharacterMetadata] 角色不存在，无法添加标签:', charId);
        return false;
      }

      if (!meta.tags) meta.tags = [];
      if (meta.tags.includes(tag)) return false;

      meta.tags.push(tag);
      meta.updatedAt = Date.now();

      await this._set(`meta:${charId}`, meta);
      this._emit('character:tagAdded', { charId, tag });
      return true;
    }

    /**
     * 移除标签
     * @param {string} charId
     * @param {string} tag
     * @returns {Promise<boolean>}
     */
    async removeTag(charId, tag) {
      const meta = await this.get(charId);
      if (!meta || !meta.tags) return false;

      const index = meta.tags.indexOf(tag);
      if (index === -1) return false;

      meta.tags.splice(index, 1);
      meta.updatedAt = Date.now();

      await this._set(`meta:${charId}`, meta);
      this._emit('character:tagRemoved', { charId, tag });
      return true;
    }

    // ==================== 批量操作 ====================

    /**
     * 获取所有角色元数据
     * @returns {Promise<Array>}
     */
    async getAll() {
      // [铁则七] 注意：这不是标准方法，需要验证
      // 实际使用时应该通过特定 key 存储列表
      const list = await this._get('metaList', []);
      const result = [];
      for (const charId of list) {
        const meta = await this.get(charId);
        if (meta) result.push(meta);
      }
      return result;
    }

    /**
     * 按标签筛选角色
     * @param {string} tag
     * @returns {Promise<Array>}
     */
    async findByTag(tag) {
      const all = await this.getAll();
      return all.filter(meta => meta.tags && meta.tags.includes(tag));
    }

    // ==================== 订阅 ====================

    subscribeMeta(charId, callback) {
      return this._subscribe(`meta:${charId}`, callback);
    }

    // ==================== 内部方法 ====================

    async _get(key, defaultValue) {
      if (!this._platform) {
        console.warn('[CharacterMetadata] Platform 未初始化');
        return defaultValue;
      }

      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[CharacterMetadata] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }

      const result = await this._platform.data(DOMAIN, key, defaultValue);
      return result !== undefined && result !== null ? result : defaultValue;
    }

    async _set(key, value) {
      if (!this._platform) {
        console.warn('[CharacterMetadata] Platform 未初始化，无法写入数据');
        return false;
      }

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
      // no-op: 事件发射由 CharacterMetadataService 负责
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.CharacterMetadata = CharacterMetadata;

  console.log('[Schema] CharacterMetadata 已加载');
})();
