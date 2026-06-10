/**
 * ApiConfigService - API 配置业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.ApiConfig
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不操作 DOM（铁则三）
 *   - 错误处理降级不阻断（铁则九）
 */
;(function () {
  'use strict';

  class ApiConfigService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._apiConfigData = new (window.PhoneData?.ApiConfig || function () {})(this._platform);
    }

    // ==================== 主API配置 ====================

    /**
     * 获取主API配置
     * @returns {Promise<Object>}
     */
    async getMainConfig() {
      try {
        return await this._apiConfigData.getMainConfig();
      } catch (e) {
        console.warn('[ApiConfigService] getMainConfig 失败:', e);
        return this._apiConfigData._getDefaultConfig
          ? this._apiConfigData._getDefaultConfig()
          : { baseUrl: '', apiKey: '', model: '', maxTokens: 500, temperature: 0.7 };
      }
    }

    /**
     * 更新主API配置
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async updateMainConfig(config) {
      try {
        return await this._apiConfigData.updateMainConfig(config);
      } catch (e) {
        console.warn('[ApiConfigService] updateMainConfig 失败:', e);
        return false;
      }
    }

    /**
     * 保存主API配置（兼容旧方法名）
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async saveMainConfig(config) {
      return this.updateMainConfig(config);
    }

    // ==================== 通道配置 ====================

    /**
     * 获取四通道配置
     * @returns {Promise<Object>}
     */
    async getChannelConfig() {
      try {
        return await this._apiConfigData.getChannelConfig();
      } catch (e) {
        console.warn('[ApiConfigService] getChannelConfig 失败:', e);
        return null;
      }
    }

    /**
     * 保存通道配置
     * @param {Object} configs
     * @returns {Promise<boolean>}
     */
    async saveChannelConfig(configs) {
      try {
        return await this._apiConfigData.saveChannelConfig(configs);
      } catch (e) {
        console.warn('[ApiConfigService] saveChannelConfig 失败:', e);
        return false;
      }
    }

    /**
     * 重置通道配置
     * @returns {Promise<Object>}
     */
    async resetChannelConfig() {
      try {
        return await this._apiConfigData.resetChannelConfig();
      } catch (e) {
        console.warn('[ApiConfigService] resetChannelConfig 失败:', e);
        return null;
      }
    }

    // ==================== 模块级API配置 ====================

    /**
     * 获取模块API配置
     * @param {string} moduleId
     * @returns {Promise<Object>}
     */
    async getModuleConfig(moduleId) {
      try {
        return await this._apiConfigData.getModuleConfig(moduleId);
      } catch (e) {
        console.warn('[ApiConfigService] getModuleConfig 失败:', e);
        return {};
      }
    }

    /**
     * 更新模块API配置
     * @param {string} moduleId
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async updateModuleConfig(moduleId, config) {
      try {
        return await this._apiConfigData.updateModuleConfig(moduleId, config);
      } catch (e) {
        console.warn('[ApiConfigService] updateModuleConfig 失败:', e);
        return false;
      }
    }

    /**
     * 获取可用模型列表
     * @param {string} moduleId
     * @returns {Promise<Array>}
     */
    async getAvailableModels(moduleId) {
      try {
        return await this._apiConfigData.getAvailableModels(moduleId);
      } catch (e) {
        console.warn('[ApiConfigService] getAvailableModels 失败:', e);
        return [];
      }
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.ApiConfig = ApiConfigService;

  console.log('[Service] ApiConfigService 已加载');
})();
