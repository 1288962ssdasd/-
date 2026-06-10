/**
 * MvuAdapter - Mvu 变量适配器 Service
 * 桥接 Mvu 变量框架与 Schema，支持双向转换
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.MvuAdapter
 *
 * 铁则合规：
 *   - MvuAdapter 是 Service，不是 Platform 适配器（铁则四）
 *   - 数据读写通过 Schema 辅助函数（铁则一）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class MvuAdapter {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._backpackData = new (window.PhoneData?.Backpack || function(){})(this._platform);
      this._shopData = new (window.PhoneData?.Shop || function(){})(this._platform);
      this._statusData = new (window.PhoneData?.Status || function(){})(this._platform);
      this._taskData = new (window.PhoneData?.Task || function(){})(this._platform);
      this._diaryData = new (window.PhoneData?.Diary || function(){})(this._platform);
    }

    // ==================== Mvu 格式转换核心 ====================

    /**
     * 解包 Mvu 值：[值, ""] → 纯值
     * @param {*} val
     * @returns {*}
     */
    _unwrapMvuValue(val) {
      if (Array.isArray(val) && val.length >= 1) {
        return val[0];
      }
      return val;
    }

    /**
     * 打包 Mvu 值：纯值 → [值, ""]
     * @param {*} val
     * @returns {Array}
     */
    _wrapMvuValue(val) {
      if (Array.isArray(val) && val.length === 2 && typeof val[1] === 'string') {
        return val; // 已经是 Mvu 格式
      }
      return [val, ''];
    }

    // ==================== 背包同步 ====================

    /**
     * 从 Mvu 同步背包数据到 Schema
     * @param {Object} mvuData
     * @returns {Promise<boolean>}
     */
    async syncBackpackFromMvu(mvuData) {
      try {
        const raw = mvuData?.stat_data?.['道具'] || {};
        const items = this._parseMvuItems(raw);
        await this._backpackData.setItems(items);
        console.log('[MvuAdapter] 背包数据已同步');
        return true;
      } catch (e) {
        console.warn('[MvuAdapter] 同步背包失败:', e);
        return false;
      }
    }

    /**
     * 从 Schema 同步背包数据到 Mvu
     * @param {Object} mvuData
     * @param {string} targetMessageId
     * @returns {Promise<boolean>}
     */
    async syncBackpackToMvu(mvuData, targetMessageId) {
      try {
        const items = await this._backpackData.getItems();
        const mvuFormat = this._wrapItemsToMvu(items);

        if (window.Mvu?.setMvuVariable && window.Mvu?.replaceMvuData) {
          await window.Mvu.setMvuVariable(mvuData, '道具', mvuFormat, { reason: '手机插件同步' });
          await window.Mvu.replaceMvuData(mvuData, { type: 'message', message_id: targetMessageId });
          console.log('[MvuAdapter] 背包数据已写回 Mvu');
          return true;
        }
        return false;
      } catch (e) {
        console.warn('[MvuAdapter] 写回背包失败:', e);
        return false;
      }
    }

    // ==================== 商店同步 ====================

    /**
     * 从 Mvu 同步商店数据到 Schema
     * @param {Object} mvuData
     * @returns {Promise<boolean>}
     */
    async syncShopFromMvu(mvuData) {
      try {
        const raw = mvuData?.stat_data?.['商品'] || {};
        const products = this._parseMvuItems(raw);
        await this._shopData.setProducts(products);
        console.log('[MvuAdapter] 商店数据已同步');
        return true;
      } catch (e) {
        console.warn('[MvuAdapter] 同步商店失败:', e);
        return false;
      }
    }

    // ==================== 状态同步 ====================

    /**
     * 从 Mvu 同步用户状态到 Schema
     * @param {Object} mvuData
     * @returns {Promise<boolean>}
     */
    async syncStatusFromMvu(mvuData) {
      try {
        // 用户状态
        const userRaw = mvuData?.stat_data?.['用户'] || {};
        const userStatus = this._parseMvuUserStatus(userRaw);
        await this._statusData.updateUserStatus(userStatus);

        // NPC 状态
        const npcRaw = mvuData?.stat_data?.['NPC'] || {};
        const npcs = this._parseMvuNPCs(npcRaw);
        await this._statusData.setNPCList(npcs);

        console.log('[MvuAdapter] 状态数据已同步');
        return true;
      } catch (e) {
        console.warn('[MvuAdapter] 同步状态失败:', e);
        return false;
      }
    }

    // ==================== 任务同步 ====================

    /**
     * 从 Mvu 同步任务数据到 Schema
     * @param {Object} mvuData
     * @returns {Promise<boolean>}
     */
    async syncTasksFromMvu(mvuData) {
      try {
        const raw = mvuData?.stat_data?.['任务'] || {};
        const tasks = this._parseMvuTasks(raw);
        await this._taskData.setTasks(tasks);

        // 家族信息
        const familyRaw = mvuData?.stat_data?.['家族信息'] || {};
        const familyInfo = this._parseMvuFamilyInfo(familyRaw);
        await this._taskData.setFamilyInfo(familyInfo);

        console.log('[MvuAdapter] 任务数据已同步');
        return true;
      } catch (e) {
        console.warn('[MvuAdapter] 同步任务失败:', e);
        return false;
      }
    }

    // ==================== 日记同步 ====================

    /**
     * 从 Mvu 同步日记数据到 Schema
     * @param {Object} mvuData
     * @returns {Promise<boolean>}
     */
    async syncDiaryFromMvu(mvuData) {
      try {
        const raw = mvuData?.stat_data?.['摘要'] || {};
        const diaries = this._parseMvuDiaries(raw);
        await this._diaryData.setDiaries(diaries);
        console.log('[MvuAdapter] 日记数据已同步');
        return true;
      } catch (e) {
        console.warn('[MvuAdapter] 同步日记失败:', e);
        return false;
      }
    }

    // ==================== 全量同步 ====================

    /**
     * 从 Mvu 全量同步所有数据
     * @param {Object} mvuData
     * @returns {Promise<Object>}
     */
    async syncAllFromMvu(mvuData) {
      const results = {
        backpack: false,
        shop: false,
        status: false,
        tasks: false,
        diary: false,
      };

      results.backpack = await this.syncBackpackFromMvu(mvuData);
      results.shop = await this.syncShopFromMvu(mvuData);
      results.status = await this.syncStatusFromMvu(mvuData);
      results.tasks = await this.syncTasksFromMvu(mvuData);
      results.diary = await this.syncDiaryFromMvu(mvuData);

      return results;
    }

    // ==================== 解析方法 ====================

    /**
     * 解析 Mvu 物品格式
     * @param {Object} raw
     * @returns {Object}
     */
    _parseMvuItems(raw) {
      const items = {};
      for (const [category, categoryItems] of Object.entries(raw)) {
        if (category === '$meta') continue; // 跳过元数据
        items[category] = {};
        for (const [id, fields] of Object.entries(categoryItems)) {
          items[category][id] = {};
          for (const [key, val] of Object.entries(fields)) {
            items[category][id][key] = this._unwrapMvuValue(val);
          }
        }
      }
      return items;
    }

    /**
     * 将物品打包为 Mvu 格式
     * @param {Object} items
     * @returns {Object}
     */
    _wrapItemsToMvu(items) {
      const mvuFormat = {};
      for (const [category, categoryItems] of Object.entries(items)) {
        mvuFormat[category] = {};
        for (const [id, fields] of Object.entries(categoryItems)) {
          mvuFormat[category][id] = {};
          for (const [key, val] of Object.entries(fields)) {
            mvuFormat[category][id][key] = this._wrapMvuValue(val);
          }
        }
      }
      return mvuFormat;
    }

    /**
     * 解析 Mvu 用户状态
     * @param {Object} raw
     * @returns {Object}
     */
    _parseMvuUserStatus(raw) {
      const status = {};
      for (const [key, val] of Object.entries(raw)) {
        if (key === '$meta') continue;
        if (key === '当前着装') {
          // 嵌套对象
          status.outfit = {};
          for (const [slot, item] of Object.entries(val)) {
            status.outfit[slot] = this._unwrapMvuValue(item);
          }
        } else {
          status[key] = this._unwrapMvuValue(val);
        }
      }
      return status;
    }

    /**
     * 解析 Mvu NPC 列表
     * @param {Object} raw
     * @returns {Array}
     */
    _parseMvuNPCs(raw) {
      const npcs = [];
      for (const [npcId, npcData] of Object.entries(raw)) {
        if (npcId === '$meta') continue;
        const npc = { id: npcId };
        for (const [key, val] of Object.entries(npcData)) {
          if (key === '人物记忆') {
            // 嵌套数组
            npc.memories = [];
            if (Array.isArray(val)) {
              val.forEach(m => {
                npc.memories.push(this._unwrapMvuValue(m));
              });
            }
          } else {
            npc[key] = this._unwrapMvuValue(val);
          }
        }
        npcs.push(npc);
      }
      return npcs;
    }

    /**
     * 解析 Mvu 任务
     * @param {Object} raw
     * @returns {Array}
     */
    _parseMvuTasks(raw) {
      const tasks = [];
      for (const [taskId, taskData] of Object.entries(raw)) {
        if (taskId === '$meta') continue;
        const task = { id: taskId };
        for (const [key, val] of Object.entries(taskData)) {
          if (key === '任务状态') {
            task.status = this._unwrapMvuValue(val);
          } else {
            task[key] = this._unwrapMvuValue(val);
          }
        }
        tasks.push(task);
      }
      return tasks;
    }

    /**
     * 解析 Mvu 家族信息
     * @param {Object} raw
     * @returns {Object}
     */
    _parseMvuFamilyInfo(raw) {
      const info = {};
      for (const [key, val] of Object.entries(raw)) {
        if (key === '$meta') continue;
        info[key] = this._unwrapMvuValue(val);
      }
      return info;
    }

    /**
     * 解析 Mvu 日记
     * @param {Object} raw
     * @returns {Array}
     */
    _parseMvuDiaries(raw) {
      const diaries = [];
      // 支持两种格式：Mvu标准格式和简化格式
      if (Array.isArray(raw)) {
        // 简化格式：直接是数组
        raw.forEach((item, index) => {
          const content = this._unwrapMvuValue(item);
          if (content) {
            diaries.push({
              id: 'diary_' + index,
              content: content,
              date: new Date().toISOString().split('T')[0],
            });
          }
        });
      } else {
        // Mvu标准格式
        for (const [diaryId, diaryData] of Object.entries(raw)) {
          if (diaryId === '$meta') continue;
          const diary = { id: diaryId };
          for (const [key, val] of Object.entries(diaryData)) {
            diary[key] = this._unwrapMvuValue(val);
          }
          diaries.push(diary);
        }
      }
      return diaries;
    }

    // ==================== Mvu 框架访问 ====================

    /**
     * 检查 Mvu 是否可用
     * @returns {boolean}
     */
    isMvuAvailable() {
      return !!(window.Mvu?.getMvuData);
    }

    /**
     * 获取 Mvu 数据
     * @returns {Promise<Object|null>}
     */
    async getMvuData() {
      if (!this.isMvuAvailable()) {
        console.warn('[MvuAdapter] Mvu 不可用');
        return null;
      }

      try {
        return await window.Mvu.getMvuData();
      } catch (e) {
        console.warn('[MvuAdapter] 获取 Mvu 数据失败:', e);
        return null;
      }
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.MvuAdapter = MvuAdapter;

  console.log('[Service] MvuAdapter 已加载');
})();
