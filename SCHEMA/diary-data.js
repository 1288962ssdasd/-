/**
 * DiaryData - 日记数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Diary
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'diary';

  /**
   * DiaryData 日记数据操作类
   */
  class DiaryData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有日记
     * @returns {Promise<Array>}
     */
    async getDiaries() {
      return await this._get('entries', []);
    }

    /**
     * 获取单篇日记
     * @param {string} diaryId
     * @returns {Promise<Object|null>}
     */
    async getById(diaryId) {
      const diaries = await this.getDiaries();
      return diaries.find(d => d.id === diaryId) || null;
    }

    /**
     * 按日期获取日记
     * @param {string} date - YYYY-MM-DD 格式
     * @returns {Promise<Array>}
     */
    async getByDate(date) {
      const diaries = await this.getDiaries();
      return diaries.filter(d => d.date === date);
    }

    /**
     * 按日期范围获取日记
     * @param {string} startDate
     * @param {string} endDate
     * @returns {Promise<Array>}
     */
    async getByDateRange(startDate, endDate) {
      const diaries = await this.getDiaries();
      return diaries.filter(d => d.date >= startDate && d.date <= endDate);
    }

    /**
     * 获取最新日记
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getLatest(limit = 10) {
      const diaries = await this.getDiaries();
      return diaries.slice(0, limit);
    }

    // ==================== 写入操作 ====================

    /**
     * 设置所有日记
     * @param {Array} diaries
     * @returns {Promise<boolean>}
     */
    async setDiaries(diaries) {
      await this._set('entries', diaries);
      this._emit('diary:updated', { diaries });
      return true;
    }

    /**
     * 添加日记
     * @param {Object} diary
     * @returns {Promise<Object>}
     */
    async addDiary(diary) {
      const diaries = await this.getDiaries();

      const newDiary = {
        id: diary.id || this._generateId(),
        title: diary.title || '无标题',
        content: diary.content || '',
        date: diary.date || new Date().toISOString().split('T')[0],
        mood: diary.mood || 'normal',
        tags: diary.tags || [],
        weather: diary.weather || '',
        location: diary.location || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 按日期倒序插入
      const insertIndex = diaries.findIndex(d => d.date < newDiary.date);
      if (insertIndex === -1) {
        diaries.push(newDiary);
      } else {
        diaries.splice(insertIndex, 0, newDiary);
      }

      await this._set('entries', diaries);

      this._emit('diary:added', { diary: newDiary });
      return newDiary;
    }

    /**
     * 更新日记
     * @param {string} diaryId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateDiary(diaryId, updates) {
      const diaries = await this.getDiaries();
      const diary = diaries.find(d => d.id === diaryId);

      if (!diary) return false;

      Object.assign(diary, updates, { updatedAt: Date.now() });
      await this._set('entries', diaries);

      this._emit('diary:updated', { diaryId, updates });
      return true;
    }

    /**
     * 删除日记
     * @param {string} diaryId
     * @returns {Promise<boolean>}
     */
    async deleteDiary(diaryId) {
      const diaries = await this.getDiaries();
      const index = diaries.findIndex(d => d.id === diaryId);

      if (index === -1) return false;

      const removed = diaries.splice(index, 1)[0];
      await this._set('entries', diaries);

      this._emit('diary:deleted', { diaryId, diary: removed });
      return true;
    }

    /**
     * 搜索日记
     * @param {string} keyword
     * @returns {Promise<Array>}
     */
    async searchDiaries(keyword) {
      const diaries = await this.getDiaries();
      const lowerKeyword = keyword.toLowerCase();

      return diaries.filter(d =>
        d.title?.toLowerCase().includes(lowerKeyword) ||
        d.content?.toLowerCase().includes(lowerKeyword) ||
        d.tags?.some(t => t.toLowerCase().includes(lowerKeyword))
      );
    }

    // ==================== 统计 ====================

    /**
     * 获取日记统计
     * @returns {Promise<Object>}
     */
    async getStats() {
      const diaries = await this.getDiaries();

      const moodCounts = {};
      const tagCounts = {};

      diaries.forEach(d => {
        // 统计心情
        if (d.mood) {
          moodCounts[d.mood] = (moodCounts[d.mood] || 0) + 1;
        }
        // 统计标签
        d.tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return {
        total: diaries.length,
        moodCounts,
        tagCounts,
        firstDate: diaries[diaries.length - 1]?.date || null,
        lastDate: diaries[0]?.date || null,
      };
    }

    // ==================== 订阅 ====================

    /**
     * 订阅日记变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeDiaries(callback) {
      return this._subscribe('entries', callback);
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
      // no-op: 事件发射由 DiaryService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'diary_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Diary = DiaryData;

  console.log('[Schema] DiaryData 已加载');
})();
