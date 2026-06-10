/**
 * PromptData - Prompt 模板数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 global:prompt:{expertName}
 *
 * 数据键名：global:prompt:{expertName}
 * 默认结构：{
 *   systemTemplate: '',    // 系统提示词模板
 *   userTemplate: '',      // 用户提示词模板
 *   useUserTemplate: false // 是否使用用户自定义模板
 * }
 */

;(function () {
  'use strict';

  var DOMAIN = 'prompt';
  var KEY_PREFIX = 'global';

  class PromptData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    /**
     * 获取系统模板
     * 键名: global:prompt:{expertName}
     * @param {string} expertName - 专家名称
     * @returns {Promise<string>} 系统模板
     */
    async getSystemTemplate(expertName) {
      try {
        var data = await this._getPromptData(expertName);
        return data.systemTemplate || '';
      } catch (e) {
        console.warn('[PromptData] 获取系统模板失败:', e);
        return '';
      }
    }

    /**
     * 获取用户模板
     * 键名: global:prompt:{expertName}
     * @param {string} expertName - 专家名称
     * @returns {Promise<string>} 用户模板
     */
    async getUserTemplate(expertName) {
      try {
        var data = await this._getPromptData(expertName);
        return data.userTemplate || '';
      } catch (e) {
        console.warn('[PromptData] 获取用户模板失败:', e);
        return '';
      }
    }

    /**
     * 保存用户模板
     * 键名: global:prompt:{expertName}
     * @param {string} expertName - 专家名称
     * @param {string} template - 用户模板内容
     */
    async saveUserTemplate(expertName, template) {
      try {
        var data = await this._getPromptData(expertName);
        data.userTemplate = template;
        data.updatedAt = Date.now();
        await this._setPromptData(expertName, data);
        console.log('[PromptData] 用户模板已保存:', expertName);
      } catch (e) {
        console.warn('[PromptData] 保存用户模板失败:', e);
      }
    }

    /**
     * 设置是否使用用户模板
     * 键名: global:prompt:{expertName}
     * @param {string} expertName - 专家名称
     * @param {boolean} useUser - 是否使用用户模板
     */
    async setUseUserTemplate(expertName, useUser) {
      try {
        var data = await this._getPromptData(expertName);
        data.useUserTemplate = !!useUser;
        data.updatedAt = Date.now();
        await this._setPromptData(expertName, data);
        console.log('[PromptData] 模板使用设置已更新:', expertName, useUser);
      } catch (e) {
        console.warn('[PromptData] 设置模板使用失败:', e);
      }
    }

    /**
     * 检查是否使用用户模板
     * 键名: global:prompt:{expertName}
     * @param {string} expertName - 专家名称
     * @returns {Promise<boolean>}
     */
    async isUseUserTemplate(expertName) {
      try {
        var data = await this._getPromptData(expertName);
        return !!data.useUserTemplate;
      } catch (e) {
        return false;
      }
    }

    /**
     * 获取完整 Prompt 配置
     * @param {string} expertName - 专家名称
     * @returns {Promise<Object>} { systemTemplate, userTemplate, useUserTemplate }
     */
    async getPromptConfig(expertName) {
      try {
        return await this._getPromptData(expertName);
      } catch (e) {
        return this._buildDefaultPromptData();
      }
    }

    /**
     * 保存完整 Prompt 配置
     * @param {string} expertName - 专家名称
     * @param {Object} config - 配置对象 { systemTemplate, userTemplate, useUserTemplate }
     */
    async savePromptConfig(expertName, config) {
      try {
        var data = Object.assign({}, this._buildDefaultPromptData(), config);
        data.updatedAt = Date.now();
        await this._setPromptData(expertName, data);
        console.log('[PromptData] Prompt 配置已保存:', expertName);
      } catch (e) {
        console.warn('[PromptData] 保存 Prompt 配置失败:', e);
      }
    }

    /**
     * 删除 Prompt 配置
     * @param {string} expertName - 专家名称
     */
    async deletePromptConfig(expertName) {
      try {
        await this._platform.setData(DOMAIN, KEY_PREFIX + ':' + expertName, null);
        console.log('[PromptData] Prompt 配置已删除:', expertName);
      } catch (e) {
        console.warn('[PromptData] 删除 Prompt 配置失败:', e);
      }
    }

    /**
     * 重置为默认配置
     * @param {string} expertName - 专家名称
     * @param {string} defaultSystemTemplate - 默认系统模板
     */
    async resetToDefault(expertName, defaultSystemTemplate) {
      try {
        var defaultData = this._buildDefaultPromptData();
        if (defaultSystemTemplate) {
          defaultData.systemTemplate = defaultSystemTemplate;
        }
        await this._setPromptData(expertName, defaultData);
        console.log('[PromptData] Prompt 配置已重置:', expertName);
      } catch (e) {
        console.warn('[PromptData] 重置 Prompt 配置失败:', e);
      }
    }

    /**
     * 获取所有 Prompt 配置列表
     * @returns {Promise<Array>} 专家名称列表
     */
    async getAllPromptNames() {
      try {
        // 从 Platform 获取所有 prompt 域的数据键
        var allKeys = await this._platform.data(DOMAIN, 'keys', []);
        return allKeys.map(function(key) {
          // 提取 expertName 部分
          var parts = key.split(':');
          return parts.length > 1 ? parts[1] : key;
        });
      } catch (e) {
        console.warn('[PromptData] 获取所有 Prompt 名称失败:', e);
        return [];
      }
    }

    /**
     * 获取最终使用的模板（根据 useUserTemplate 决定）
     * @param {string} expertName - 专家名称
     * @param {string} defaultTemplate - 默认模板（当无配置时使用）
     * @returns {Promise<string>} 最终模板
     */
    async getEffectiveTemplate(expertName, defaultTemplate) {
      try {
        var data = await this._getPromptData(expertName);

        // 如果配置为空，使用默认模板
        if (!data.systemTemplate && !data.userTemplate) {
          return defaultTemplate || '';
        }

        // 根据设置决定使用哪个模板
        if (data.useUserTemplate && data.userTemplate) {
          return data.userTemplate;
        }

        return data.systemTemplate || defaultTemplate || '';
      } catch (e) {
        return defaultTemplate || '';
      }
    }

    // ===== 私有方法 =====

    /**
     * 获取 Prompt 数据
     * 键名: global:prompt:{expertName}
     */
    async _getPromptData(expertName) {
      try {
        var data = await this._platform.data(DOMAIN, KEY_PREFIX + ':' + expertName, null);
        if (!data) {
          return this._buildDefaultPromptData();
        }
        return data;
      } catch (e) {
        return this._buildDefaultPromptData();
      }
    }

    /**
     * 设置 Prompt 数据
     * 键名: global:prompt:{expertName}
     */
    async _setPromptData(expertName, data) {
      await this._platform.setData(DOMAIN, KEY_PREFIX + ':' + expertName, data);
    }

    _buildDefaultPromptData() {
      return {
        systemTemplate: '',
        userTemplate: '',
        useUserTemplate: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Prompt = PromptData;

  console.log('[Schema] PromptData 已加载');
})();
