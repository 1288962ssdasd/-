/**
 * PromptService - Prompt 模板业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Prompt
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不操作 DOM（铁则三）
 *   - 错误处理降级不阻断（铁则九）
 */
;(function () {
  'use strict';

  class PromptService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._promptData = new (window.PhoneData?.Prompt || function () {})(this._platform);
    }

    /**
     * 获取专家的 Prompt 配置
     * @param {string} expertName
     * @returns {Promise<Object>} { systemTemplate, userTemplate, useUserTemplate }
     */
    async getPromptConfig(expertName) {
      try {
        return await this._promptData.getPromptConfig(expertName);
      } catch (e) {
        console.warn('[PromptService] getPromptConfig 失败:', e);
        return { systemTemplate: '', userTemplate: '', useUserTemplate: false };
      }
    }

    /**
     * 获取指定专家和模板类型的模板文本
     * @param {string} expertId - 专家ID
     * @param {string} templateType - 模板类型 (system/user)
     * @returns {Promise<Object>} { template: string }
     */
    async getPrompt(expertId, templateType) {
      try {
        var config = await this._promptData.getPromptConfig(expertId);
        if (templateType === 'user') {
          return { template: config.userTemplate || '' };
        }
        return { template: config.systemTemplate || '' };
      } catch (e) {
        console.warn('[PromptService] getPrompt 失败:', e);
        return { template: '' };
      }
    }

    /**
     * 获取专家的可用变量列表
     * @param {string} expertName
     * @returns {Promise<Array>}
     */
    async getVariables(expertName) {
      try {
        // 从专家配置中提取变量（如果 Schema 支持）
        if (typeof this._promptData.getVariables === 'function') {
          return await this._promptData.getVariables(expertName);
        }
        // 默认返回空数组
        return [];
      } catch (e) {
        console.warn('[PromptService] getVariables 失败:', e);
        return [];
      }
    }

    /**
     * 保存专家的 Prompt 模板
     * @param {string} expertId - 专家ID
     * @param {string} templateType - 模板类型 (system/user)
     * @param {string} template - 模板内容
     * @returns {Promise<boolean>}
     */
    async savePrompt(expertId, templateType, template) {
      try {
        var config = await this._promptData.getPromptConfig(expertId);
        if (templateType === 'user') {
          config.userTemplate = template;
          config.useUserTemplate = true;
        } else {
          config.systemTemplate = template;
        }
        await this._promptData.savePromptConfig(expertId, config);
        return true;
      } catch (e) {
        console.warn('[PromptService] savePrompt 失败:', e);
        return false;
      }
    }

    /**
     * 获取默认 Prompt 模板
     * @param {string} expertId
     * @param {string} templateType
     * @returns {Promise<string>}
     */
    async getDefaultPrompt(expertId, templateType) {
      try {
        if (typeof this._promptData.resetToDefault === 'function') {
          // 获取当前配置作为"默认"参考
          var config = await this._promptData.getPromptConfig(expertId);
          if (templateType === 'user') {
            return config.userTemplate || '';
          }
          return config.systemTemplate || '';
        }
        return '';
      } catch (e) {
        console.warn('[PromptService] getDefaultPrompt 失败:', e);
        return '';
      }
    }

    /**
     * 保存完整 Prompt 配置
     * @param {string} expertName
     * @param {Object} config
     * @returns {Promise<boolean>}
     */
    async savePromptConfig(expertName, config) {
      try {
        await this._promptData.savePromptConfig(expertName, config);
        return true;
      } catch (e) {
        console.warn('[PromptService] savePromptConfig 失败:', e);
        return false;
      }
    }

    /**
     * 重置为默认配置
     * @param {string} expertName
     * @param {string} defaultSystemTemplate
     * @returns {Promise<boolean>}
     */
    async resetToDefault(expertName, defaultSystemTemplate) {
      try {
        await this._promptData.resetToDefault(expertName, defaultSystemTemplate);
        return true;
      } catch (e) {
        console.warn('[PromptService] resetToDefault 失败:', e);
        return false;
      }
    }

    /**
     * 获取所有 Prompt 名称列表
     * @returns {Promise<Array>}
     */
    async getAllPromptNames() {
      try {
        return await this._promptData.getAllPromptNames();
      } catch (e) {
        console.warn('[PromptService] getAllPromptNames 失败:', e);
        return [];
      }
    }

    /**
     * 获取最终使用的模板
     * @param {string} expertName
     * @param {string} defaultTemplate
     * @returns {Promise<string>}
     */
    async getEffectiveTemplate(expertName, defaultTemplate) {
      try {
        return await this._promptData.getEffectiveTemplate(expertName, defaultTemplate);
      } catch (e) {
        console.warn('[PromptService] getEffectiveTemplate 失败:', e);
        return defaultTemplate || '';
      }
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Prompt = PromptService;

  console.log('[Service] PromptService 已加载');
})();
