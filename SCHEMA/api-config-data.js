/**
 * ApiConfigData - API 配置数据 Schema 辅助函数
 * 
 * 支持主API配置 + 各模块独立API配置
 * 
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数
 */

;(function () {
  'use strict';

  const DOMAIN = 'apiConfig';

  // 模块ID常量
  const MODULE_IDS = {
    MAIN: 'main',           // 主API（默认）
    WEIBO: 'weibo',         // 微博模块
    CHAT: 'chat',           // 聊天模块
    FRIENDS_CIRCLE: 'friendsCircle', // 朋友圈模块
    MESSAGE: 'message',     // 消息模块
  };

  /**
   * ApiConfigData API 配置数据操作类
   */
  class ApiConfigData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 主API配置 ====================

    /**
     * 获取主API配置
     * @returns {Promise<Object>}
     */
    async getMainConfig() {
      let config = await this._get('mainConfig', null);
      // [S-10] 一次性迁移：从旧 apiClient domain 读取并写入新 apiConfig domain
      if (!config && window.Platform) {
        try {
          const oldConfig = await window.Platform.data('apiClient', 'config', null);
          if (oldConfig) {
            await this._set('mainConfig', oldConfig);
            config = oldConfig;
            console.log('[ApiConfigData] 已从 apiClient domain 迁移旧配置');
          }
        } catch (e) { /* 忽略迁移错误 */ }
      }
      if (!config) config = this._getDefaultConfig();
      // [S-12] 解混淆 API 密钥
      if (config.apiKey) {
        config = { ...config, apiKey: this._deobfuscate(config.apiKey) };
      }
      return config;
    }

    /**
     * 更新主API配置
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async updateMainConfig(config) {
      const current = await this.getMainConfig();
      const safeConfig = { ...current, ...config };
      // [S-12] 混淆 API 密钥后存储
      if (safeConfig.apiKey) {
        safeConfig.apiKey = this._obfuscate(safeConfig.apiKey);
      }
      await this._set('mainConfig', safeConfig);
      this._emit('apiConfig:mainUpdated', { config });
      return true;
    }

    // ==================== 模块级API配置 ====================

    /**
     * 获取模块API配置
     * @param {string} moduleId - 模块ID (weibo/chat/friendsCircle/message)
     * @returns {Promise<Object>}
     */
    async getModuleConfig(moduleId) {
      const moduleConfigs = await this._get('moduleConfigs', {});
      
      // 如果模块有独立配置，返回它；否则返回主配置
      if (moduleConfigs[moduleId]) {
        return moduleConfigs[moduleId];
      }
      
      // 回退到主配置
      return await this.getMainConfig();
    }

    /**
     * 更新模块API配置
     * @param {string} moduleId
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async updateModuleConfig(moduleId, config) {
      const moduleConfigs = await this._get('moduleConfigs', {});
      
      const current = moduleConfigs[moduleId] || await this.getMainConfig();
      moduleConfigs[moduleId] = { ...current, ...config, _isCustom: true };
      
      await this._set('moduleConfigs', moduleConfigs);
      this._emit('apiConfig:moduleUpdated', { moduleId, config: moduleConfigs[moduleId] });
      return true;
    }

    /**
     * 重置模块API配置（使用主配置）
     * @param {string} moduleId
     * @returns {Promise<boolean>}
     */
    async resetModuleConfig(moduleId) {
      const moduleConfigs = await this._get('moduleConfigs', {});
      
      if (moduleConfigs[moduleId]) {
        delete moduleConfigs[moduleId];
        await this._set('moduleConfigs', moduleConfigs);
        this._emit('apiConfig:moduleReset', { moduleId });
      }
      return true;
    }

    /**
     * 检查模块是否有自定义配置
     * @param {string} moduleId
     * @returns {Promise<boolean>}
     */
    async hasCustomConfig(moduleId) {
      const moduleConfigs = await this._get('moduleConfigs', {});
      return !!(moduleConfigs[moduleId]?._isCustom);
    }

    /**
     * 获取所有模块配置
     * @returns {Promise<Object>}
     */
    async getAllModuleConfigs() {
      return await this._get('moduleConfigs', {});
    }

    // ==================== 模型列表（动态加载） ====================

    /**
     * 获取可用模型列表
     * @param {string} moduleId - 可选，指定模块获取其模型列表
     * @returns {Promise<Array>}
     */
    async getAvailableModels(moduleId) {
      // 先尝试从缓存获取
      const cache = await this._get('modelsCache', {});
      const cacheKey = moduleId || 'main';
      
      if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < 3600000) {
        return cache[cacheKey].models;
      }
      
      // 返回默认模型列表
      return this._getDefaultModels();
    }

    /**
     * 更新模型列表缓存
     * @param {string} moduleId
     * @param {Array} models
     * @returns {Promise<boolean>}
     */
    async updateModelsCache(moduleId, models) {
      const cache = await this._get('modelsCache', {});
      const cacheKey = moduleId || 'main';
      
      cache[cacheKey] = {
        models,
        timestamp: Date.now(),
      };
      
      await this._set('modelsCache', cache);
      return true;
    }

    // ==================== 提示词模板 ====================

    /**
     * 获取模块提示词
     * @param {string} moduleId
     * @returns {Promise<string>}
     */
    async getPrompt(moduleId) {
      const prompts = await this._get('prompts', this._getDefaultPrompts());
      console.log('[ApiConfigData] getPrompt 所有prompts keys:', Object.keys(prompts || {}), '请求:', moduleId);
      const result = prompts[moduleId] || prompts.default || '';
      console.log('[ApiConfigData] getPrompt', moduleId, '→', typeof result, '长度:', result?.length, '前100字:', result?.substring?.(0, 100));
      return result;
    }

    /**
     * 更新模块提示词
     * @param {string} moduleId
     * @param {string} prompt
     * @returns {Promise<boolean>}
     */
    async updatePrompt(moduleId, prompt) {
      const prompts = await this._get('prompts', this._getDefaultPrompts());
      console.log('[ApiConfigData] updatePrompt 更新前 keys:', Object.keys(prompts || {}), 'moduleId:', moduleId, 'prompt长度:', prompt?.length);
      prompts[moduleId] = prompt;
      await this._set('prompts', prompts);
      console.log('[ApiConfigData] updatePrompt 更新后 keys:', Object.keys(prompts || {}));
      this._emit('apiConfig:promptUpdated', { moduleId, prompt });
      return true;
    }

    /**
     * 获取所有提示词
     * @returns {Promise<Object>}
     */
    async getAllPrompts() {
      return await this._get('prompts', this._getDefaultPrompts());
    }

    // ==================== 请求历史 ====================

    /**
     * 添加请求历史
     * @param {Object} record - { moduleId, type, prompt, response?, error?, duration? }
     * @returns {Promise<Object>}
     */
    async addHistory(record) {
      const history = await this._get('history', []);
      
      const newRecord = {
        id: this._generateId(),
        moduleId: record.moduleId || 'main',
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
      return newRecord;
    }

    /**
     * 获取请求历史
     * @param {string} moduleId - 可选，筛选特定模块
     * @returns {Promise<Array>}
     */
    async getHistory(moduleId) {
      const history = await this._get('history', []);
      
      if (moduleId) {
        return history.filter(r => r.moduleId === moduleId);
      }
      
      return history;
    }

    /**
     * 清空历史记录
     * @returns {Promise<boolean>}
     */
    async clearHistory() {
      await this._set('history', []);
      this._emit('apiConfig:historyCleared');
      return true;
    }

    // ==================== 四通道配置 ====================

    /**
     * 获取通道配置
     * @returns {Promise<Object>}
     */
    async getChannelConfig() {
      const config = await this._get('channelConfigs', null);
      if (!config) {
        return this._getDefaultChannelConfig();
      }
      return config;
    }

    /**
     * 保存通道配置
     * @param {Object} configs - 通道配置对象
     * @returns {Promise<boolean>}
     */
    async saveChannelConfig(configs) {
      console.log('[ApiConfigData] saveChannelConfig:', Object.keys(configs || {}));
      await this._set('channelConfigs', configs);
      this._emit('apiConfig:channelUpdated', { configs });
      return true;
    }

    /**
     * 重置通道配置为默认值
     * @returns {Promise<boolean>}
     */
    async resetChannelConfig() {
      const defaultConfig = this._getDefaultChannelConfig();
      await this._set('channelConfigs', defaultConfig);
      this._emit('apiConfig:channelReset');
      return true;
    }

    _getDefaultChannelConfig() {
      return {
        'channel-world': {
          name: '🌍 大世界生成通道',
          description: '低频、高耗时、高质量的世界架构生成',
          model: '',
          temperature: 0.7,
          maxTokens: 3000,
          timeout: 120000,
          maxConcurrent: 1,
          fallback: 'channel-fallback'
        },
        'channel-director': {
          name: '🎬 管家规划通道',
          description: '高频、实时、推理密集的事件决策',
          model: '',
          temperature: 0.5,
          maxTokens: 800,
          timeout: 30000,
          maxConcurrent: 2,
          fallback: 'channel-fallback'
        },
        'channel-content': {
          name: '✍️ 内容生成通道',
          description: '高并发、快速响应的日常内容生成',
          model: '',
          temperature: 0.8,
          maxTokens: 500,
          timeout: 15000,
          maxConcurrent: 5,
          fallback: 'channel-fallback'
        },
        'channel-fallback': {
          name: '🔄 备用通道',
          description: '故障转移时的备用通道',
          model: '',
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 60000,
          maxConcurrent: 3,
          fallback: null
        }
      };
    }

    // ==================== 导演配置 ====================

    /**
     * 获取导演配置
     * @returns {Promise<Object>}
     */
    async getDirectorConfig() {
      var config = await this._get('directorConfig', null);
      if (!config) {
        return this._getDefaultDirectorConfig();
      }
      return config;
    }

    /**
     * 更新导演配置
     * @param {Object} config - 要更新的配置项（部分更新）
     * @returns {Promise<boolean>}
     */
    async updateDirectorConfig(config) {
      if (!config || typeof config !== 'object') {
        console.warn('[ApiConfigData] updateDirectorConfig: config 无效');
        return false;
      }
      var current = await this.getDirectorConfig();
      var merged = Object.assign({}, current, config);
      await this._set('directorConfig', merged);
      this._emit('apiConfig:directorConfigUpdated', { config: merged });
      return true;
    }

    /**
     * 重置导演配置为默认值
     * @returns {Promise<boolean>}
     */
    async resetDirectorConfig() {
      var defaultConfig = this._getDefaultDirectorConfig();
      await this._set('directorConfig', defaultConfig);
      this._emit('apiConfig:directorConfigReset');
      return true;
    }

    _getDefaultDirectorConfig() {
      return {
        narrativeBeatInterval: 10,
        npcCooldownMinutes: 15,
        npcActivationPerBeat: 0.4,
        worldEvolutionInterval: 2,
        infoUpdateHours: 6,
        offlineCatchUpThreshold: 24,
        messageArchiveDays: 7,
        messagePurgeDays: 90,
      };
    }

    // ==================== 订阅 ====================

    subscribeMainConfig(callback) {
      return this._subscribe('mainConfig', callback);
    }

    subscribeModuleConfigs(callback) {
      return this._subscribe('moduleConfigs', callback);
    }

    subscribeChannelConfig(callback) {
      return this._subscribe('channelConfigs', callback);
    }

    // ==================== 内部方法 ====================

    // [S-12] API 密钥混淆（防止明文裸存，非安全加密）
    _obfuscate(str) {
      if (!str) return str;
      try { return btoa(unescape(encodeURIComponent(str))).split('').reverse().join(''); }
      catch (e) { return str; }
    }

    _deobfuscate(str) {
      if (!str) return str;
      try { return decodeURIComponent(escape(atob(str.split('').reverse().join('')))); }
      catch (e) { return str; }
    }

    _getDefaultConfig() {
      return {
        provider: 'openai',
        baseUrl: '',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 120000,
        enabled: false,
      };
    }

    _getDefaultModels() {
      return [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
        { id: 'qwen-turbo', name: '通义千问 Turbo', provider: 'alibaba' },
        { id: 'qwen-plus', name: '通义千问 Plus', provider: 'alibaba' },
        { id: 'qwen-max', name: '通义千问 Max', provider: 'alibaba' },
        { id: 'glm-4', name: 'GLM-4', provider: 'zhipu' },
        { id: 'glm-4-flash', name: 'GLM-4 Flash', provider: 'zhipu' },
      ];
    }

    _getDefaultPrompts() {
      return {
        default: '你是一个友好的AI助手，请用自然、亲切的语气回复。',
        weibo: '请生成一条微博内容，风格轻松活泼，不超过140字，适合社交分享。',
        weiboReply: '请生成一条微博评论回复，友好且有互动性，不超过50字。',
        chat: '请生成一条聊天消息，自然亲切，像朋友之间的对话。',
        friendsCircle: '请生成一条朋友圈内容，生活化、真实感强，适合分享日常生活。',
        message: '请生成一条简短的消息回复，自然流畅。',
      };
    }

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
  window.PhoneData.ApiConfig = ApiConfigData;
  window.PhoneData.ApiConfig.MODULE_IDS = MODULE_IDS;

  console.log('[Schema] ApiConfigData 已加载');
})();
