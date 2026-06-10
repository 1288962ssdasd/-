/**
 * @deprecated 已废弃，请使用 ApiConfigData（domain: 'apiConfig'）。
 * 此文件保留仅为兼容旧数据迁移，将在下一版本删除。
 *
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数
 */

;(function () {
  'use strict';

  const DOMAIN = 'apiClient';

  /**
   * ApiClientData API 客户端配置数据操作类
   */
  class ApiClientData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取 API 配置
     * @returns {Promise<Object>}
     */
    async getConfig() {
      return await this._get('config', {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 30000,
        enabled: false,
      });
    }

    /**
     * 获取请求历史
     * @returns {Promise<Array>}
     */
    async getHistory() {
      return await this._get('history', []);
    }

    /**
     * 获取缓存数据
     * @returns {Promise<Object>}
     */
    async getCache() {
      return await this._get('cache', {});
    }

    /**
     * 获取预设提示词
     * @returns {Promise<Object>}
     */
    async getPrompts() {
      return await this._get('prompts', {
        weiboGenerate: '请生成一条微博内容，风格轻松活泼，不超过140字。',
        replyGenerate: '请生成一条回复评论，友好且有互动性。',
        chatGenerate: '请生成一条聊天消息，自然亲切。',
      });
    }

    // ==================== 写入操作 ====================

    /**
     * 更新 API 配置
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async updateConfig(config) {
      const current = await this.getConfig();
      await this._set('config', { ...current, ...config });
      this._emit('apiClient:configUpdated', { config });
      return true;
    }

    /**
     * 设置 API 密钥
     * @param {string} apiKey
     * @returns {Promise<boolean>}
     */
    async setApiKey(apiKey) {
      return await this.updateConfig({ apiKey });
    }

    /**
     * 设置基础 URL
     * @param {string} baseUrl
     * @returns {Promise<boolean>}
     */
    async setBaseUrl(baseUrl) {
      return await this.updateConfig({ baseUrl });
    }

    /**
     * 启用/禁用 API
     * @param {boolean} enabled
     * @returns {Promise<boolean>}
     */
    async setEnabled(enabled) {
      return await this.updateConfig({ enabled });
    }

    /**
     * 添加请求历史记录
     * @param {Object} record - { type, prompt, response?, error?, duration? }
     * @returns {Promise<Object>}
     */
    async addHistory(record) {
      const history = await this.getHistory();
      
      const newRecord = {
        id: this._generateId(),
        type: record.type || 'unknown',
        prompt: record.prompt,
        response: record.response || null,
        error: record.error || null,
        duration: record.duration || 0,
        timestamp: Date.now(),
        time: new Date().toLocaleString('zh-CN'),
      };

      history.unshift(newRecord);
      
      // 限制历史记录数量
      if (history.length > 100) {
        history.length = 100;
      }

      await this._set('history', history);
      this._emit('apiClient:historyAdded', { record: newRecord });
      return newRecord;
    }

    /**
     * 清空历史记录
     * @returns {Promise<boolean>}
     */
    async clearHistory() {
      await this._set('history', []);
      this._emit('apiClient:historyCleared');
      return true;
    }

    /**
     * 设置缓存
     * @param {string} key
     * @param {any} value
     * @param {number} ttl - 过期时间（毫秒）
     * @returns {Promise<boolean>}
     */
    async setCache(key, value, ttl = 3600000) {
      const cache = await this.getCache();
      cache[key] = {
        value,
        timestamp: Date.now(),
        ttl,
      };
      await this._set('cache', cache);
      return true;
    }

    /**
     * 获取缓存
     * @param {string} key
     * @returns {Promise<any>}
     */
    async getCacheValue(key) {
      const cache = await this.getCache();
      const item = cache[key];
      
      if (!item) return null;
      
      // 检查是否过期
      if (Date.now() - item.timestamp > item.ttl) {
        delete cache[key];
        await this._set('cache', cache);
        return null;
      }
      
      return item.value;
    }

    /**
     * 清除过期缓存
     * @returns {Promise<number>} 清除的数量
     */
    async clearExpiredCache() {
      const cache = await this.getCache();
      let cleared = 0;
      
      for (const key in cache) {
        const item = cache[key];
        if (Date.now() - item.timestamp > item.ttl) {
          delete cache[key];
          cleared++;
        }
      }
      
      if (cleared > 0) {
        await this._set('cache', cache);
      }
      
      return cleared;
    }

    /**
     * 更新预设提示词
     * @param {string} key
     * @param {string} prompt
     * @returns {Promise<boolean>}
     */
    async updatePrompt(key, prompt) {
      const prompts = await this.getPrompts();
      prompts[key] = prompt;
      await this._set('prompts', prompts);
      this._emit('apiClient:promptUpdated', { key, prompt });
      return true;
    }

    // ==================== 订阅 ====================

    subscribeConfig(callback) {
      return this._subscribe('config', callback);
    }

    subscribeHistory(callback) {
      return this._subscribe('history', callback);
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

    _emit(event, data) {
      if (this._platform?.emit) {
        this._platform.emit(event, data);
      }
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'api_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.ApiClient = ApiClientData;

  console.log('[Schema] ApiClientData 已加载');
})();
