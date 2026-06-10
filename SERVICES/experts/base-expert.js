/**
 * @layer Service
 * @file   base-expert.js
 * @description 专家系统基类 - 提供通用方法和接口
 *
 * 职责:
 *   - 定义专家系统的标准接口
 *   - 提供通用的 Prompt 构建和响应解析方法
 *   - 提供 JSON 修复工具
 *
 * 铁则合规:
 *   - 铁则一: 数据读写通过 Schema 辅助函数
 *   - 铁则三: Service 层只处理数据操作和 AI 调用
 *   - 铁则七: 通过 LLMGateway 调用 AI，不直接实例化 AIService
 *   - 铁则九: 错误处理降级，不阻断应用
 */

;(function () {
  'use strict';

  /**
   * 专家基类
   * 所有具体专家类必须继承此类
   */
  class BaseExpert {
    /**
     * @param {Object} platform - Platform 实例
     * @param {Object} config - 专家配置
     * @param {string} config.channel - LLM 通道名称
     * @param {string} config.role - LLM 角色配置名称
     * @param {string} config.expertId - 专家唯一标识
     */
    constructor(platform, config) {
      this._platform = platform || window.Platform;
      this._config = config || {};
      this._expertId = this._config.expertId || 'base-expert';
      this._channel = this._config.channel || 'channel-content';
      this._role = this._config.role || 'content-creator';

      // 验证必要依赖
      if (!this._platform) {
        console.warn('[BaseExpert] Platform 实例未提供');
      }
    }

    /**
     * 生成内容的主入口
     * @param {Object} context - 上下文信息
     * @returns {Promise<Object|null>} 生成的内容对象
     */
    async generate(context) {
      try {
        // 1. 构建 Prompt
        const promptContext = await this._buildPrompt(context);

        // 2. 调用 LLM
        const response = await this._callLLM(promptContext);

        // 3. 解析响应
        let result = this._parseResponse(response);

        // [修复] 智能格式修复：将单个对象包装成数组格式
        result = this._smartRepairFormat(result);

        // 4. 验证结果
        if (!this._validateResult(result)) {
          console.warn(`[${this._expertId}] 结果验证失败，使用 fallback`);
          // [修复] 验证失败时使用 fallback 数据
          return this._generateFallback(context);
        }

        return result;
      } catch (error) {
        // [铁则九] 错误降级处理
        console.warn(`[${this._expertId}] 生成失败:`, error);
        // [修复] 错误时也返回 fallback 数据
        return this._generateFallback(context);
      }
    }

    /**
     * 智能格式修复：将单个对象包装成数组格式
     * 解决 LLM 返回单个对象而不是数组的问题
     * @param {Object} result - 解析后的结果
     * @returns {Object} 修复后的结果
     */
    _smartRepairFormat(result) {
      if (!result || typeof result !== 'object') {
        return result;
      }

      // NPCExpert: 如果返回的是单个消息对象，包装成 messages 数组
      if (this._expertId === 'npc-expert' && !result.messages) {
        // 检查是否是单个消息对象（有 content 和 fromId/from）
        if (result.content && (result.fromId || result.from)) {
          console.log(`[${this._expertId}] 智能修复: 单个消息对象 → messages 数组`);
          return {
            messages: [{
              fromId: result.fromId || result.from,
              from: result.from || result.fromId,
              content: result.content,
              emotion: result.emotion || 'neutral'
            }]
          };
        }
      }

      // SocialExpert: 如果返回的是单个互动对象，包装成 interactions 数组
      if (this._expertId === 'social-expert' && !result.interactions) {
        // 检查是否是单个互动对象（有 content 和 type）
        if (result.content && result.type) {
          console.log(`[${this._expertId}] 智能修复: 单个互动对象 → interactions 数组`);
          return {
            interactions: [{
              npcId: result.npcId || result.authorId || 'unknown',
              npcName: result.npcName || result.author || '神秘人',
              type: result.type,
              content: result.content,
              emotion: result.emotion || 'neutral',
              images: result.images || []
            }]
          };
        }
      }

      return result;
    }

    /**
     * 生成 fallback 数据（子类可重写）
     * @param {Object} context - 上下文
     * @returns {Object} fallback 数据
     */
    _generateFallback(context) {
      return { fallback: true, expertId: this._expertId };
    }

    /**
     * 构建 Prompt 上下文
     * 子类应重写此方法
     * @param {Object} context - 原始上下文
     * @returns {Promise<Object>} 构建后的上下文
     */
    async _buildPrompt(context) {
      // 基础上下文构建
      const baseContext = {
        expertId: this._expertId,
        timestamp: Date.now(),
        ...context,
      };

      // 尝试获取世界上下文
      try {
        if (this._platform?.context?.getCurrentCharId) {
          const charId = this._platform.context.getCurrentCharId() || 'default';
          baseContext.charId = charId;
        }
      } catch (e) {
        // 忽略
      }

      return baseContext;
    }

    /**
     * 调用 LLM
     * @param {Object} context - Prompt 上下文
     * @returns {Promise<Object|string>} LLM 响应
     */
    async _callLLM(context) {
      if (typeof window.LLMGateway === 'undefined') {
        throw new Error('LLMGateway 不可用');
      }

      const llmGateway = new window.LLMGateway(this._platform);

      // 使用专家配置的 role 和 channel
      const options = {
        channel: this._channel,
      };

      return await llmGateway.generate(this._role, context, options);
    }

    /**
     * 解析 LLM 响应
     * @param {Object|string} response - LLM 原始响应
     * @returns {Object|null} 解析后的对象
     */
    _parseResponse(response) {
      // [铁则七] 处理 LLMGateway 返回的已解析对象
      if (response === null || response === undefined) {
        console.warn(`[${this._expertId}] LLM返回 null/undefined`);
        return null;
      }

      // 情况1: 已经是对象
      if (typeof response === 'object') {
        console.log(`[${this._expertId}] LLM返回对象，keys:`, Object.keys(response));
        return response;
      }

      // 情况2: 字符串需要解析
      if (typeof response !== 'string') {
        console.warn(`[${this._expertId}] 响应类型异常:`, typeof response);
        return null;
      }

      // 尝试修复和解析 JSON
      console.log(`[${this._expertId}] LLM返回字符串，长度:`, response.length, '前200字:', response.substring(0, 200));
      return this._tryRepairJSON(response);
    }

    /**
     * 尝试修复并解析 JSON
     * @param {string} text - 可能包含 JSON 的文本
     * @returns {Object|null} 解析后的对象
     */
    _tryRepairJSON(text) {
      if (!text || typeof text !== 'string') {
        return null;
      }

      // 清理文本
      let cleaned = text.trim();

      // 移除 markdown 代码块标记
      cleaned = cleaned.replace(/```json\n?/gi, '');
      cleaned = cleaned.replace(/```\n?/gi, '');
      cleaned = cleaned.trim();

      // 尝试使用 JsonRepair
      if (window.JsonRepair) {
        try {
          const repaired = window.JsonRepair.parse(cleaned, {});
          if (repaired && typeof repaired === 'object') {
            return repaired;
          }
        } catch (e) {
          // 继续尝试其他方法
        }
      }

      // 尝试直接解析
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (e) {
        // 尝试提取 JSON 部分
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[0]);
            if (extracted && typeof extracted === 'object') {
              return extracted;
            }
          } catch (e2) {
            // 忽略
          }
        }
      }

      console.warn(`[${this._expertId}] JSON 解析失败`);
      return null;
    }

    /**
     * 验证结果是否有效
     * 子类应重写此方法进行特定验证
     * @param {Object} result - 解析后的结果
     * @returns {boolean} 是否有效
     */
    _validateResult(result) {
      if (!result || typeof result !== 'object') {
        return false;
      }
      return true;
    }

    /**
     * 生成唯一 ID
     * @returns {string} 唯一标识符
     */
    _generateId() {
      return `${this._expertId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取当前时间戳
     * @returns {number} 时间戳
     */
    _getTimestamp() {
      return Date.now();
    }

    /**
     * 格式化日期
     * @param {number} timestamp - 时间戳
     * @returns {string} 格式化后的日期字符串
     */
    _formatDate(timestamp) {
      const date = new Date(timestamp || Date.now());
      return date.toISOString().split('T')[0];
    }

    /**
     * 安全获取嵌套对象属性
     * @param {Object} obj - 对象
     * @param {string} path - 属性路径，如 'a.b.c'
     * @param {*} defaultValue - 默认值
     * @returns {*} 属性值或默认值
     */
    _getSafe(obj, path, defaultValue) {
      if (!obj || typeof obj !== 'object') {
        return defaultValue;
      }

      const keys = path.split('.');
      let current = obj;

      for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
          return defaultValue;
        }
        current = current[key];
      }

      return current !== undefined ? current : defaultValue;
    }

    /**
     * 截断文本到指定长度
     * @param {string} text - 原文本
     * @param {number} maxLength - 最大长度
     * @returns {string} 截断后的文本
     */
    _truncate(text, maxLength) {
      if (!text || typeof text !== 'string') {
        return '';
      }
      if (text.length <= maxLength) {
        return text;
      }
      return text.substring(0, maxLength) + '...';
    }
  }

  // 导出到全局
  window.BaseExpert = BaseExpert;

})();
