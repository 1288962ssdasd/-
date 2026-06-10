/**
 * WorldData - 大世界数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:world:{key}
 *
 * [V2 结构扩展]
 * - 新增 meta.truth: 世界真相（起源→动机→手段→现状）
 * - 新增 meta.onion_layers: 洋葱层级（L1-L5）
 * - 新增 meta.atmosphere: 气氛基调
 * - 新增 meta.trajectory: 主线轨迹
 * - 新增 meta.user_guide: 用户指南
 */

;(function () {
  'use strict';

  var DOMAIN = 'world';

  class WorldData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ===== V1 基础方法 =====

    /**
     * @deprecated get() 中的数据合并逻辑已迁移到 WorldService
     * Schema 层应只做纯数据读取，复杂的数据转换/合并应由 Service 层完成
     */
    async get(charId) {
      // [v4.3-fix] 优先读取合并后的主数据，如果不存在则尝试合并 Step1 和 Step2
      var mainData = await this._platform.data(DOMAIN, charId + ':main', null);
      if (mainData && mainData.version === 2) {
        return mainData;
      }

      // 尝试从 Step1 和 Step2 合并数据
      try {
        var step1 = await this.getStep1(charId);
        var step2 = await this.getStep2(charId);

        if (step1 || step2) {
          var meta = step1?.meta || {};
          var truth = meta.truth || {};
          var atmosphere = meta.atmosphere?.current || {};
          var outdoorMap = step2?.maps?.outdoor || {};

          // 提取世界名称
          var worldName = step2?.world?.name || outdoorMap.name;
          if (!worldName || worldName === '未知之地') {
            var background = truth.background || '';
            if (background) {
              var firstSentence = background.split(/[。！？.!?]/)[0];
              worldName = firstSentence.length > 30 ? firstSentence.substring(0, 30) + '...' : firstSentence;
            } else {
              worldName = '未知世界';
            }
          }

          // 提取时代
          var era = step2?.world?.era || '';
          if (!era) {
            var bg = truth.background || '';
            if (/古代|王朝|帝国|江湖|武侠|仙侠/.test(bg)) era = '古代';
            else if (/未来|赛博|星际|科幻/.test(bg)) era = '未来';
            else if (/现代|都市|城市/.test(bg)) era = '现代都市';
            else era = atmosphere.mood || '现代';
          }

          // 提取关键地点
          var keyLocations = (outdoorMap.nodes || [])
            .map(function(n) { return n.name; })
            .filter(function(n) { return n && n !== '起始点'; });

          // 规范化 factions
          var factions = step2?.factions || [];
          if (factions.length === 0 || factions.every(function(f) { return f.name === '未知势力'; })) {
            factions = [{ name: '居民', description: '普通居民', alignment: 'neutral' }];
          }

          return {
            charId: charId,
            version: 2,
            // 顶层字段
            name: worldName,
            era: era,
            theme: atmosphere.mood || '神秘',
            description: truth.background || '',
            keyLocations: keyLocations,
            factions: factions,
            // 完整结构
            meta: meta,
            world: step2?.world || { news: [] },
            maps: step2?.maps || { outdoor: {}, inside: {} },
            npcs: step2?.npcs || [],
            rules: step2?.rules || [],
            playerLocation: step2?.playerLocation || '起始点'
          };
        }
      } catch (e) {
        console.warn('[WorldData] 合并 Step1/Step2 失败:', e);
      }

      return mainData;
    }

    async save(charId, worldData) {
      await this._platform.setData(DOMAIN, charId + ':main', worldData);
    }

    async exists(charId) {
      var data = await this.get(charId);
      return !!data && !!data.name;
    }

    async delete(charId) {
      await this._platform.setData(DOMAIN, charId + ':main', null);
    }

    // ===== V2 Step1 方法 =====

    /**
     * 保存 Step1 世界大纲
     * 键名: {charId}:world:step1
     * @param {string} charId - 角色ID
     * @param {Object} data - Step1 数据 { meta: { truth, onion_layers, atmosphere, trajectory, user_guide } }
     */
    async saveStep1(charId, data) {
      try {
        var step1Data = {
          version: 2,
          step: 1,
          savedAt: Date.now(),
          meta: data.meta || this._buildDefaultMeta()
        };
        await this._platform.setData(DOMAIN, charId + ':step1', step1Data);
        console.log('[WorldData] Step1 已保存:', charId);
      } catch (e) {
        console.warn('[WorldData] Step1 保存失败:', e);
      }
    }

    /**
     * 获取 Step1 世界大纲
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} Step1 数据
     */
    async getStep1(charId) {
      try {
        var data = await this._platform.data(DOMAIN, charId + ':step1', null);
        if (!data) {
          // 尝试从主数据迁移
          var mainData = await this.get(charId);
          if (mainData && mainData.meta) {
            return { meta: mainData.meta };
          }
        }
        return data;
      } catch (e) {
        console.warn('[WorldData] Step1 读取失败:', e);
        return null;
      }
    }

    // ===== V2 Step2 方法 =====

    /**
     * 保存 Step2 世界细节
     * 键名: {charId}:world:step2
     * @param {string} charId - 角色ID
     * @param {Object} data - Step2 数据 { world: { news }, maps: { outdoor, inside }, npcs: [...], rules: [...], factions: [...] }
     */
    async saveStep2(charId, data) {
      try {
        var step2Data = {
          version: 2,
          step: 2,
          savedAt: Date.now(),
          world: data.world || { news: [] },
          maps: data.maps || { outdoor: {}, inside: {} },
          npcs: data.npcs || [],
          rules: data.rules || [],
          factions: data.factions || [],
          playerLocation: data.playerLocation || '起始点'
        };
        await this._platform.setData(DOMAIN, charId + ':step2', step2Data);
        console.log('[WorldData] Step2 已保存:', charId);
      } catch (e) {
        console.warn('[WorldData] Step2 保存失败:', e);
      }
    }

    /**
     * 获取 Step2 世界细节
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} Step2 数据
     */
    async getStep2(charId) {
      try {
        var data = await this._platform.data(DOMAIN, charId + ':step2', null);
        if (!data) {
          // 尝试从主数据迁移
          var mainData = await this.get(charId);
          if (mainData) {
            return {
              world: { news: mainData.news || [] },
              maps: mainData.maps || { outdoor: {}, inside: {} },
              npcs: mainData.npcs || [],
              rules: mainData.rules || [],
              factions: mainData.factions || [],
              playerLocation: mainData.playerLocation || '起始点'
            };
          }
        }
        return data;
      } catch (e) {
        console.warn('[WorldData] Step2 读取失败:', e);
        return null;
      }
    }

    // ===== V2 Meta 方法 =====

    /**
     * 更新洋葱层级揭示状态
     * @param {string} charId - 角色ID
     * @param {number} newStage - 新的揭示层级(1-5)
     */
    async updateStage(charId, newStage) {
      try {
        var world = await this.get(charId);
        if (!world) return;
        if (!world.meta) world.meta = {};
        world.meta.currentStage = Math.min(5, Math.max(1, newStage));
        await this.save(charId, world);
        console.log('[WorldData] 洋葱层级更新为 Stage', world.meta.currentStage);
      } catch (e) {
        console.warn('[WorldData] 更新层级失败:', e);
      }
    }

    /**
     * 获取当前揭示层级
     * @param {string} charId - 角色ID
     * @returns {number} 当前层级(1-5)
     */
    async getStage(charId) {
      try {
        var world = await this.get(charId);
        if (world && world.meta && world.meta.currentStage) {
          return world.meta.currentStage;
        }
        return 1;
      } catch (e) {
        return 1;
      }
    }

    /**
     * 获取世界真相
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 真相数据 { background, driver: { source, target_end, tactic } }
     */
    async getTruth(charId) {
      try {
        var step1 = await this.getStep1(charId);
        if (step1 && step1.meta && step1.meta.truth) {
          return step1.meta.truth;
        }
        // 降级到主数据
        var world = await this.get(charId);
        if (world && world.meta && world.meta.truth) {
          return world.meta.truth;
        }
        return this._buildDefaultTruth();
      } catch (e) {
        return this._buildDefaultTruth();
      }
    }

    /**
     * 获取洋葱层级
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 洋葱层级 { L1_TheVeil, L2_TheDistortion, L3_TheLaw, L4_TheAgent, L5_TheAxiom }
     */
    async getOnionLayers(charId) {
      try {
        var step1 = await this.getStep1(charId);
        if (step1 && step1.meta && step1.meta.onion_layers) {
          return step1.meta.onion_layers;
        }
        // 降级到主数据
        var world = await this.get(charId);
        if (world && world.meta && world.meta.onion_layers) {
          return world.meta.onion_layers;
        }
        return this._buildDefaultOnionLayers();
      } catch (e) {
        return this._buildDefaultOnionLayers();
      }
    }

    /**
     * 获取气氛基调
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 气氛数据 { reasoning, current: { mood, tension_level, visual_style } }
     */
    async getAtmosphere(charId) {
      try {
        var step1 = await this.getStep1(charId);
        if (step1 && step1.meta && step1.meta.atmosphere) {
          return step1.meta.atmosphere;
        }
        // 降级到主数据
        var world = await this.get(charId);
        if (world && world.meta && world.meta.atmosphere) {
          return world.meta.atmosphere;
        }
        return this._buildDefaultAtmosphere();
      } catch (e) {
        return this._buildDefaultAtmosphere();
      }
    }

    /**
     * 获取主线轨迹
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 轨迹数据 { reasoning, ending }
     */
    async getTrajectory(charId) {
      try {
        var step1 = await this.getStep1(charId);
        if (step1 && step1.meta && step1.meta.trajectory) {
          return step1.meta.trajectory;
        }
        // 降级到主数据
        var world = await this.get(charId);
        if (world && world.meta && world.meta.trajectory) {
          return world.meta.trajectory;
        }
        return this._buildDefaultTrajectory();
      } catch (e) {
        return this._buildDefaultTrajectory();
      }
    }

    /**
     * 获取用户指南
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 用户指南 { how_to_play, key_mechanics, tips }
     */
    async getUserGuide(charId) {
      try {
        var step1 = await this.getStep1(charId);
        if (step1 && step1.meta && step1.meta.user_guide) {
          return step1.meta.user_guide;
        }
        // 降级到主数据
        var world = await this.get(charId);
        if (world && world.meta && world.meta.user_guide) {
          return world.meta.user_guide;
        }
        return this._buildDefaultUserGuide();
      } catch (e) {
        return this._buildDefaultUserGuide();
      }
    }

    // ===== 私有方法 =====

    _buildDefaultMeta() {
      return {
        truth: this._buildDefaultTruth(),
        onion_layers: this._buildDefaultOnionLayers(),
        atmosphere: this._buildDefaultAtmosphere(),
        trajectory: this._buildDefaultTrajectory(),
        user_guide: this._buildDefaultUserGuide()
      };
    }

    _buildDefaultTruth() {
      return {
        background: '这是一个等待探索的世界，真相隐藏在表面之下。',
        driver: {
          source: '未知力量',
          target_end: '待揭示',
          tactic: '暗中操控'
        }
      };
    }

    _buildDefaultOnionLayers() {
      return {
        L1_TheVeil: [{ name: '表层叙事', description: '世界看起来正常', logic: '维持日常假象' }],
        L2_TheDistortion: [{ name: '异常现象', description: '开始出现违和感', logic: '真相的裂缝' }],
        L3_TheLaw: [{ name: '隐藏规则', description: '世界运转的真实规则', logic: '违反会受到惩罚' }],
        L4_TheAgent: [{ name: '执行者', description: '维护世界秩序的实体', logic: '规则的守护者' }],
        L5_TheAxiom: [{ name: '终极真相', description: '世界的终极秘密', logic: '一切的核心' }]
      };
    }

    _buildDefaultAtmosphere() {
      return {
        reasoning: '默认神秘氛围',
        current: {
          mood: '神秘',
          tension_level: 3,
          visual_style: '写实'
        }
      };
    }

    _buildDefaultTrajectory() {
      return {
        reasoning: '开放式叙事',
        ending: '由玩家选择决定'
      };
    }

    _buildDefaultUserGuide() {
      return {
        how_to_play: '通过手机与世界互动，探索真相',
        key_mechanics: ['消息聊天', '世界探索', '任务完成'],
        tips: ['多与NPC交流', '注意世界细节', '完成日常任务']
      };
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.World = WorldData;

  console.log('[Schema] WorldData 已加载 (V2 扩展)');
})();
