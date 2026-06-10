/**
 * ProfileService - 个人资料业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Profile
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - LLM 调用通过 AIService（铁则三）
 *   - 世界书操作通过 Platform（铁则六）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class ProfileService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._profileData = new (window.PhoneData?.Profile || function(){})(this._platform);
      this._aiService = new (window.PhoneServices?.AI || function(){})(this._platform);
    }

    // ==================== 读取操作 ====================

    /**
     * 获取档案列表
     * @returns {Promise<Array>}
     */
    async getProfiles() {
      return await this._profileData.getProfiles();
    }

    /**
     * 获取单个档案
     * @param {string} profileId
     * @returns {Promise<Object|null>}
     */
    async getProfile(profileId) {
      return await this._profileData.getById(profileId);
    }

    /**
     * 搜索档案
     * @param {string} name
     * @returns {Promise<Array>}
     */
    async searchProfiles(name) {
      return await this._profileData.searchByName(name);
    }

    /**
     * 获取缓存状态
     * @returns {Promise<Object>}
     */
    async getCacheStatus() {
      return await this._profileData.getCache();
    }

    // ==================== 档案管理 ====================

    /**
     * 添加档案
     * @param {Object} profile
     * @returns {Promise<Object>}
     */
    /** 导演 profile 事件（经济/档案补丁） */
    async updateFromDirector(data) {
      if (!data) return false;
      try {
        const economy = this._platform?.get?.('economyService');
        if (economy && data.gold != null) {
          const delta = Number(data.gold);
          if (delta >= 0) await economy.add(delta, 'gold', 'director_profile');
          else await economy.spend(-delta, 'gold', 'director_profile');
        }
        if (data.attributes) {
          const profiles = await this.getProfiles();
          const main = profiles[0];
          if (main) {
            await this._profileData.updateProfile(main.id, {
              attributes: { ...(main.attributes || {}), ...data.attributes },
            });
          }
        }
        return true;
      } catch (e) {
        console.warn('[ProfileService] updateFromDirector 失败:', e);
        return false;
      }
    }

    async addProfile(profile) {
      if (!profile?.name?.trim()) {
        console.warn('[ProfileService] addProfile: 档案名称不能为空');
        return null;
      }

      const result = await this._profileData.addProfile({
        name: profile.name.trim(),
        avatar: profile.avatar || '',
        description: profile.description || '',
        tags: profile.tags || [],
        attributes: profile.attributes || {},
        source: profile.source || 'manual',
      });
      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('profile:added', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'profile:added',
          data: { profileId: result?.id, name: profile.name.trim() },
          timestamp: Date.now(),
          source: 'profile-service'
        });
      }
      return result;
    }

    /**
     * 更新档案
     * @param {string} profileId
     * @param {Object} updates
     * @returns {Promise<boolean>}
     */
    async updateProfile(profileId, updates) {
      const result = await this._profileData.updateProfile(profileId, updates);
      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('profile:updated', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'profile:updated',
          data: { profileId },
          timestamp: Date.now(),
          source: 'profile-service'
        });
      }
      return result;
    }

    /**
     * 删除档案
     * @param {string} profileId
     * @returns {Promise<boolean>}
     */
    async deleteProfile(profileId) {
      const result = await this._profileData.deleteProfile(profileId);
      if (this._platform?.eventBus) {
        this._platform.eventBus.emit('profile:deleted', {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'profile:deleted',
          data: { profileId },
          timestamp: Date.now(),
          source: 'profile-service'
        });
      }
      return result;
    }

    // ==================== 世界书集成 ====================

    /**
     * 从世界书加载档案
     * @returns {Promise<number>} 加载的档案数量
     */
    async loadFromWorldbook() {
      try {
        // 通过 Platform 获取世界书内容（铁则六）
        const worldbook = await this._getWorldbook();

        if (!worldbook || !worldbook.entries) {
          console.log('[ProfileService] 世界书为空或不可用');
          return 0;
        }

        let loadedCount = 0;

        for (const entry of Object.values(worldbook.entries)) {
          if (!entry.key || !entry.content) continue;

          // 尝试解析档案信息
          const profile = this._parseWorldbookEntry(entry);
          if (profile) {
            const result = await this._profileData.addProfile({
              ...profile,
              source: 'worldbook',
            });
            if (result) loadedCount++;
          }
        }

        // 更新缓存
        await this._profileData.updateCache({
          lastSync: Date.now(),
          worldbookLoaded: true,
        });

        console.log(`[ProfileService] 从世界书加载了 ${loadedCount} 个档案`);
        return loadedCount;
      } catch (e) {
        console.warn('[ProfileService] 从世界书加载失败:', e);
        return 0;
      }
    }

    /**
     * 获取世界书
     * @returns {Promise<Object|null>}
     */
    async _getWorldbook() {
      // 通过 Platform 适配器获取世界书（铁则六：禁止直接引用 window.SillyTavern）
      if (this._platform?.getWorldInfo) {
        try {
          return await this._platform.getWorldInfo();
        } catch (e) {
          console.warn('[ProfileService] Platform.getWorldInfo 失败:', e);
        }
      }

      // 降级：通过 Platform 适配器获取聊天上下文中的世界书
      if (this._platform?.getChatContext) {
        try {
          const context = await this._platform.getChatContext();
          if (context?.worldInfo) {
            return context.worldInfo;
          }
        } catch (e) {
          console.warn('[ProfileService] Platform.getChatContext 失败:', e);
        }
      }

      return null;
    }

    /**
     * 解析世界书条目
     * @param {Object} entry
     * @returns {Object|null}
     */
    _parseWorldbookEntry(entry) {
      if (!entry.key || !entry.content) return null;

      // 提取名称（通常是第一个 key）
      const keys = Array.isArray(entry.key) ? entry.key : [entry.key];
      const name = keys[0]?.trim();

      if (!name) return null;

      // 解析内容
      const profile = {
        name: name,
        description: entry.content,
        tags: keys.slice(1).map(k => k.trim()).filter(Boolean),
        attributes: {},
      };

      // 尝试解析属性
      const attrMatch = entry.content.match(/【([^】]+)】[:：]?\s*([^\n]+)/g);
      if (attrMatch) {
        attrMatch.forEach(match => {
          const [, key, value] = match.match(/【([^】]+)】[:：]?\s*([^\n]+)/) || [];
          if (key && value) {
            profile.attributes[key.trim()] = value.trim();
          }
        });
      }

      return profile;
    }

    // ==================== AI 生成 ====================

    /**
     * AI 生成档案
     * @param {string} name
     * @returns {Promise<Object>}
     */
    async generateProfile(name) {
      if (!name?.trim()) {
        console.warn('[ProfileService] generateProfile: 角色名称不能为空');
        return null;
      }

      const prompt = `请为角色"${name}"生成一份人物档案，包含以下信息：
- 外貌描述
- 性格特点
- 背景故事
- 特殊能力或技能

请用简洁的段落形式输出，每项用【】标注。`;

      const response = await this._aiService.generate(prompt, { moduleId: 'main' });

      if (!response?.trim()) {
        console.warn('[ProfileService] generateProfile: AI 生成失败');
        return null;
      }

      // 解析 AI 响应
      const profile = {
        name: name.trim(),
        description: response.trim(),
        tags: [],
        attributes: {},
        source: 'ai',
      };

      // 解析属性
      const attrMatch = response.match(/【([^】]+)】[:：]?\s*([^\n【]+)/g);
      if (attrMatch) {
        attrMatch.forEach(match => {
          const [, key, value] = match.match(/【([^】]+)】[:：]?\s*([^\n【]+)/) || [];
          if (key && value) {
            profile.attributes[key.trim()] = value.trim();
          }
        });
      }

      return await this._profileData.addProfile(profile);
    }

    /**
     * 刷新档案列表
     * @param {boolean} forceReload - 是否强制从世界书重新加载
     * @returns {Promise<Array>}
     */
    async refreshProfiles(forceReload = false) {
      if (forceReload) {
        await this._profileData.clearCache();
      }

      const cache = await this._profileData.getCache();

      // 如果从未从世界书加载，尝试加载
      if (!cache.worldbookLoaded) {
        await this.loadFromWorldbook();
      }

      return await this._profileData.getProfiles();
    }

    // ==================== 订阅 ====================

    /**
     * 订阅档案列表变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeProfiles(callback) {
      return this._profileData.subscribeProfiles(callback);
    }

    // ==================== NPC 数据 ====================

    /**
     * 获取所有 NPC 列表
     * @param {string} charId - 角色ID，默认 'default'
     * @returns {Promise<Array>}
     */
    async getNPCs(charId) {
      try {
        var NPCData = window.PhoneData?.NPC;
        if (!NPCData) {
          console.warn('[ProfileService] NPC Schema 未加载');
          return [];
        }
        var data = new NPCData(this._platform);
        return await data.getAll(charId || 'default');
      } catch (e) {
        console.warn('[ProfileService] getNPCs 失败:', e);
        return [];
      }
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Profile = ProfileService;

  console.log('[Service] ProfileService 已加载');
})();
