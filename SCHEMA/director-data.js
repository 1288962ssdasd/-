/**
 * DirectorData - 导演系统数据 Schema 辅助函数
 *
 * [铁则合规] 说明：
 * - 遵守铁则一：所有数据读写通过 Schema 辅助函数
 * - 遵守铁则十三：数据隔离，键名格式 {charId}:director:{key}
 * - 用于存储 AI 导演系统的决策和状态
 *
 * @version 2.1.0
 */

;(function () {
  'use strict';

  const DOMAIN = 'director';

  /**
   * DirectorData 导演系统数据操作类
   * @param {Object} platform - Platform 实例
   * @param {string} [charId='default'] - 角色卡 ID，用于数据隔离
   */
  class DirectorData {
    constructor(platform, charId) {
      this._platform = platform || window.Platform;
      this._charId = charId || 'default';
    }

    // ==================== charId 管理 ====================

    /**
     * 获取当前 charId
     * @returns {string}
     */
    getCharId() {
      return this._charId;
    }

    /**
     * 切换角色卡
     * @param {string} charId
     */
    setCharId(charId) {
      this._charId = charId || 'default';
    }

    // ==================== 导演计划 ====================

    /**
     * 获取当前导演计划
     * @returns {Promise<Object|null>}
     */
    async getPlan() {
      const plan = await this._get('plan', null);
      if (!plan) return null;

      try {
        return typeof plan === 'string' ? JSON.parse(plan) : plan;
      } catch (e) {
        console.warn('[DirectorData] 解析计划失败:', e);
        return null;
      }
    }

    /**
     * 设置导演计划
     * @param {Object} plan - 计划对象 { events: [...] }
     * @returns {Promise<boolean>}
     */
    async setPlan(plan) {
      const planStr = typeof plan === 'string' ? plan : JSON.stringify(plan);
      await this._set('plan', planStr);
      this._emit('director:planUpdated', { plan, charId: this._charId });
      return true;
    }

    /**
     * 清空导演计划
     * @returns {Promise<boolean>}
     */
    async clearPlan() {
      await this._set('plan', null);
      return true;
    }

    // ==================== 导演状态 ====================

    /**
     * 获取导演状态
     * @returns {Promise<Object>}
     */
    async getStatus() {
      return await this._get('status', {
        enabled: true,
        lastRun: 0,
        runCount: 0,
        errorCount: 0,
        cooldown: 10000,
      });
    }

    /**
     * 更新导演状态
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateStatus(updates) {
      const current = await this.getStatus();
      const newStatus = { ...current, ...updates };
      await this._set('status', newStatus);
      return true;
    }

    /**
     * 检查导演是否启用
     * @returns {Promise<boolean>}
     */
    async isEnabled() {
      const status = await this.getStatus();
      return status.enabled !== false;
    }

    /**
     * 启用/禁用导演
     * @param {boolean} enabled
     * @returns {Promise<boolean>}
     */
    async setEnabled(enabled) {
      await this.updateStatus({ enabled });
      return true;
    }

    // ==================== 用户行为闭环 ====================

    /**
     * 记录用户手机操作
     * @param {string} action - 操作类型
     * @param {Object} data - 操作数据
     * @returns {Promise<boolean>}
     */
    async recordInteraction(action, data = {}) {
      const interaction = {
        action,
        data,
        timestamp: Date.now(),
      };
      await this._set('lastInteraction', interaction);
      this._emit('director:interaction', { ...interaction, charId: this._charId });
      return true;
    }

    /**
     * 获取最近的用户操作
     * @returns {Promise<Object|null>}
     */
    async getLastInteraction() {
      return await this._get('lastInteraction', null);
    }

    /**
     * 记录用户选择
     * @param {string} choiceId - 选择ID
     * @param {string} choiceText - 选择文本
     * @returns {Promise<boolean>}
     */
    async recordUserChoice(choiceId, choiceText) {
      const choice = {
        choiceId,
        choiceText,
        timestamp: Date.now(),
      };
      await this._set('lastUserChoice', choice);
      this._emit('director:userChoice', { ...choice, charId: this._charId });
      return true;
    }

    /**
     * 获取最近的用户选择
     * @returns {Promise<Object|null>}
     */
    async getLastUserChoice() {
      return await this._get('lastUserChoice', null);
    }

    /**
     * 记录任务结果
     * @param {string} questId - 任务ID
     * @param {string} result - 结果 (success/failed)
     * @returns {Promise<boolean>}
     */
    async recordTaskResult(questId, result) {
      const taskResult = {
        questId,
        result,
        timestamp: Date.now(),
      };
      await this._set('lastTaskResult', taskResult);
      this._emit('director:taskResult', { ...taskResult, charId: this._charId });
      return true;
    }

    /**
     * 获取最近的任务结果
     * @returns {Promise<Object|null>}
     */
    async getLastTaskResult() {
      return await this._get('lastTaskResult', null);
    }

    // ==================== 历史记录 ====================

    /**
     * 添加导演决策历史
     * @param {Object} decision - 决策记录
     * @returns {Promise<boolean>}
     */
    async addHistory(decision) {
      const history = await this.getHistory();

      const newRecord = {
        id: this._generateId(),
        events: decision.events || [],
        context: decision.context || null,
        success: decision.success !== false,
        error: decision.error || null,
        timestamp: Date.now(),
      };

      history.unshift(newRecord);

      // 限制历史记录数量
      if (history.length > 50) {
        history.length = 50;
      }

      await this._set('history', history);
      return true;
    }

    /**
     * 获取导演决策历史
     * @param {number} limit - 限制条数
     * @returns {Promise<Array>}
     */
    async getHistory(limit = 20) {
      const history = await this._get('history', []);
      return history.slice(0, limit);
    }

    /**
     * 清空历史记录
     * @returns {Promise<boolean>}
     */
    async clearHistory() {
      await this._set('history', []);
      return true;
    }

    // ==================== 订阅 ====================

    subscribePlan(callback) {
      return this._subscribe('plan', callback);
    }

    subscribeStatus(callback) {
      return this._subscribe('status', callback);
    }

    // ==================== 内部方法 ====================

    /**
     * 构建带 charId 隔离的完整键名
     * 格式：{charId}:director:{key}
     * @private
     * @param {string} key
     * @returns {string}
     */
    _buildKey(key) {
      return this._charId + ':director:' + key;
    }

    /**
     * 构建旧格式键名（向后兼容降级读取）
     * 格式：director:{key}
     * @private
     * @param {string} key
     * @returns {string}
     */
    _buildLegacyKey(key) {
      return 'director:' + key;
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

      // [铁则十三] 优先读取带 charId 前缀的键
      const isolatedKey = this._buildKey(key);
      var result = await this._platform.data(DOMAIN, isolatedKey, undefined);

      // [向后兼容] 如果新格式读不到数据，尝试旧格式 'director:{key}'
      if (result === undefined || result === null) {
        const legacyKey = this._buildLegacyKey(key);
        result = await this._platform.data(DOMAIN, legacyKey, undefined);
        if (result !== undefined && result !== null) {
          // 降级读取到旧数据，静默迁移到新格式
          try {
            await this._platform.setData(DOMAIN, isolatedKey, result, { persist: true });
          } catch (migrateErr) {
            // 迁移失败不影响读取
          }
        }
      }

      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

    async _set(key, value) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }

      // [铁则十三] 使用带 charId 前缀的键写入
      const isolatedKey = this._buildKey(key);

      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, isolatedKey, value, { persist: true });

      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      // [铁则十三] 订阅带 charId 前缀的键
      const isolatedKey = this._buildKey(key);
      return this._platform.subscribeData(DOMAIN, isolatedKey, callback);
    }

    _emit(event, data) {
      if (this._platform?.eventBus) {
        this._platform.eventBus.emit(event, data);
      }
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'dir_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Director = DirectorData;

  console.log('[Schema] DirectorData 已加载 (v2.1.0, 数据隔离)');
})();
