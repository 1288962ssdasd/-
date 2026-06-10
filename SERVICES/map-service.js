/**
 * @layer Service
 * @file   map-service.js
 * @depends MapData, WorldData, QuestData, Platform
 * @emits  map:location:changed, map:deviation:calculated, quest:progress:updated
 *
 * 职责: 地图业务逻辑 - 场景切换、偏差计算、任务进度检查
 * 禁止: 操作DOM、直接调用SillyTavern API
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class MapService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._mapData = new (window.PhoneData?.Map || function () {})(this._platform);
      this._worldData = new (window.PhoneData?.World || function () {})(this._platform);
      this._questData = new (window.PhoneData?.Quest || function () {})(this._platform);
    }

    /**
     * 初始化服务
     */
    async init() {
      console.log('[MapService] 初始化...');
      console.log('[MapService] 初始化完成');
    }

    /**
     * 场景切换 - 前往指定地点
     * [铁则十二] Service是唯一数据加工厂
     * @param {string} charId - 角色ID
     * @param {string} locationId - 目标地点ID
     * @returns {Promise<Object>} 切换结果
     */
    async travelTo(charId, locationId) {
      try {
        // 获取当前地图数据
        const mapData = await this._mapData.get(charId);
        const oldLocation = mapData.playerLocation;

        // 检查目标地点是否存在
        const outdoorMap = mapData.outdoor || {};
        const nodes = outdoorMap.nodes || [];
        const targetNode = nodes.find(n => n.name === locationId);

        if (!targetNode && locationId !== oldLocation) {
          console.warn('[MapService] 目标地点不存在:', locationId);
          return { success: false, error: '目标地点不存在' };
        }

        // 更新玩家位置
        await this._mapData.updatePlayerLocation(charId, locationId);

        // 计算偏差值
        const deviationResult = await this._mapData.calculateDeviation(charId, locationId);

        // 检查任务进度
        const questUpdates = await this._checkQuestProgressOnTravel(charId, locationId);

        // 发射事件
        this._emitEvent('map:location:changed', {
          charId,
          oldLocation,
          newLocation: locationId,
          isFirstVisit: !mapData.visitedLocations.includes(locationId),
          deviation: deviationResult,
          questUpdates
        });

        this._emitEvent('map:deviation:calculated', {
          charId,
          location: locationId,
          score: deviationResult.score,
          delta: deviationResult.delta,
          reason: deviationResult.reason
        });

        console.log('[MapService] 场景切换完成:', oldLocation, '->', locationId);

        return {
          success: true,
          oldLocation,
          newLocation: locationId,
          deviation: deviationResult,
          questUpdates
        };
      } catch (e) {
        console.warn('[MapService] 场景切换失败:', e);
        return { success: false, error: e.message };
      }
    }

    /**
     * 获取地点信息
     * @param {string} charId - 角色ID
     * @param {string} locationId - 地点ID
     * @returns {Promise<Object>} 地点信息
     */
    async getLocationInfo(charId, locationId) {
      try {
        const mapData = await this._mapData.get(charId);
        const outdoorMap = mapData.outdoor || {};
        const nodes = outdoorMap.nodes || [];

        const node = nodes.find(n => n.name === locationId);
        if (!node) {
          return null;
        }

        // 获取室内节点信息（如果是建筑物）
        const insideMap = mapData.inside || {};
        const indoorNodes = insideMap[locationId] || [];

        // 获取世界数据补充信息
        const worldData = await this._worldData.getStep2(charId);
        const worldMaps = worldData?.maps || {};
        const worldOutdoor = worldMaps.outdoor || {};
        const worldNodes = worldOutdoor.nodes || [];
        const worldNode = worldNodes.find(n => n.name === locationId);

        return {
          id: locationId,
          name: node.name,
          type: node.type || 'unknown',
          description: node.info || worldNode?.description || '暂无描述',
          position: node.position || 'unknown',
          distance: node.distant || 0,
          isCurrent: mapData.playerLocation === locationId,
          isVisited: mapData.visitedLocations.includes(locationId),
          hasIndoor: indoorNodes.length > 0,
          indoorNodes: indoorNodes,
          tags: worldNode?.tags || []
        };
      } catch (e) {
        console.warn('[MapService] 获取地点信息失败:', e);
        return null;
      }
    }

    /**
     * 获取室内可交互节点
     * @param {string} charId - 角色ID
     * @param {string} locationId - 地点ID
     * @returns {Promise<Array>} 室内节点列表
     */
    async getIndoorNodes(charId, locationId) {
      try {
        const mapData = await this._mapData.get(charId);
        const insideMap = mapData.inside || {};

        // 获取该地点的室内节点
        const nodes = insideMap[locationId] || [];

        // 格式化节点数据
        return nodes.map(node => ({
          id: node.name || node.id,
          name: node.name,
          type: node.type || 'interactable',
          description: node.info || node.description || '',
          interactable: node.interactable !== false,
          actions: node.actions || [],
          icon: this._getNodeIcon(node.type)
        }));
      } catch (e) {
        console.warn('[MapService] 获取室内节点失败:', e);
        return [];
      }
    }

    /**
     * 检查任务进度
     * @param {string} charId - 角色ID
     * @param {string} action - 动作类型 (travel, interact, investigate等)
     * @param {string} target - 目标对象
     * @returns {Promise<Array>} 更新的任务列表
     */
    async checkQuestProgress(charId, action, target) {
      try {
        const activeQuests = await this._questData.getActive(charId);
        const updates = [];

        for (const quest of activeQuests) {
          if (!quest.steps) continue;

          // 查找匹配的步骤
          const stepIndex = quest.steps.findIndex(step => {
            if (step.completed) return false;

            // 检查步骤类型匹配
            if (step.type === 'go' && action === 'travel') {
              return step.target === target || step.location === target;
            }
            if (step.type === 'investigate' && action === 'investigate') {
              return step.target === target;
            }
            if (step.type === 'interact' && action === 'interact') {
              return step.target === target;
            }
            return false;
          });

          if (stepIndex >= 0) {
            // 完成该步骤
            await this._questData.completeStep(charId, quest.id, stepIndex);

            updates.push({
              questId: quest.id,
              questName: quest.name,
              stepIndex: stepIndex,
              step: quest.steps[stepIndex]
            });

            // 发射任务进度更新事件
            this._emitEvent('quest:progress:updated', {
              charId,
              questId: quest.id,
              questName: quest.name,
              action,
              target,
              stepIndex,
              completedStep: quest.steps[stepIndex]
            });
          }
        }

        if (updates.length > 0) {
          console.log('[MapService] 任务进度更新:', updates);
        }

        return updates;
      } catch (e) {
        console.warn('[MapService] 检查任务进度失败:', e);
        return [];
      }
    }

    /**
     * 获取完整地图数据（用于渲染）
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 完整地图数据
     */
    async getFullMapData(charId) {
      try {
        const mapData = await this._mapData.get(charId);
        const worldData = await this._worldData.getStep2(charId);

        // 合并地图数据
        const outdoorMap = mapData.outdoor || {};
        const worldMaps = worldData?.maps || {};
        const worldOutdoor = worldMaps.outdoor || {};

        // 构建地点列表
        const locations = (outdoorMap.nodes || []).map(node => ({
          id: node.name,
          name: node.name,
          type: node.type || 'unknown',
          description: node.info || '',
          position: node.position || 'unknown',
          distance: node.distant || 0,
          isCurrent: mapData.playerLocation === node.name,
          isVisited: mapData.visitedLocations.includes(node.name),
          icon: this._getLocationIcon(node.type)
        }));

        return {
          playerLocation: mapData.playerLocation,
          visitedLocations: mapData.visitedLocations || [],
          deviationScore: mapData.deviationScore || 0,
          locations: locations,
          mapName: outdoorMap.name || worldOutdoor.name || '未知地图',
          mapDescription: outdoorMap.description || worldOutdoor.description || ''
        };
      } catch (e) {
        console.warn('[MapService] 获取完整地图数据失败:', e);
        return this._buildDefaultMapData();
      }
    }

    /**
     * 获取当前位置信息
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 当前位置信息
     */
    async getCurrentLocation(charId) {
      try {
        const locationId = await this._mapData.getPlayerLocation(charId);
        return await this.getLocationInfo(charId, locationId);
      } catch (e) {
        console.warn('[MapService] 获取当前位置失败:', e);
        return null;
      }
    }

    /**
     * 获取偏差分数
     * @param {string} charId - 角色ID
     * @returns {Promise<number>} 偏差分数
     */
    async getDeviationScore(charId) {
      try {
        return await this._mapData.getDeviationScore(charId);
      } catch (e) {
        console.warn('[MapService] 获取偏差分数失败:', e);
        return 0;
      }
    }

    /**
     * 获取已访问统计
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 访问统计
     */
    async getVisitStats(charId) {
      try {
        const mapData = await this._mapData.get(charId);
        const outdoorMap = mapData.outdoor || {};
        const totalNodes = (outdoorMap.nodes || []).length;
        const visitedCount = (mapData.visitedLocations || []).length;

        return {
          visited: visitedCount,
          total: totalNodes,
          percentage: totalNodes > 0 ? Math.round((visitedCount / totalNodes) * 100) : 0
        };
      } catch (e) {
        console.warn('[MapService] 获取访问统计失败:', e);
        return { visited: 0, total: 0, percentage: 0 };
      }
    }

    // ==================== 私有方法 ====================

    /**
     * 检查旅行时的任务进度
     */
    async _checkQuestProgressOnTravel(charId, locationId) {
      return await this.checkQuestProgress(charId, 'travel', locationId);
    }

    /**
     * 获取地点图标
     */
    _getLocationIcon(type) {
      const icons = {
        home: '🏠',
        urban: '🏙️',
        shop: '🏪',
        dungeon: '🏰',
        forest: '🌲',
        mountain: '⛰️',
        water: '🌊',
        cave: '🕳️',
        temple: '⛩️',
        ruins: '🏛️',
        camp: '⛺',
        port: '⚓',
        default: '📍'
      };
      return icons[type] || icons.default;
    }

    /**
     * 获取节点图标
     */
    _getNodeIcon(type) {
      const icons = {
        door: '🚪',
        chest: '📦',
        npc: '👤',
        item: '📿',
        bed: '🛏️',
        table: '🪑',
        bookshelf: '📚',
        fireplace: '🔥',
        window: '🪟',
        stairs: '🪜',
        interactable: '👆',
        default: '•'
      };
      return icons[type] || icons.default;
    }

    /**
     * 构建默认地图数据
     */
    _buildDefaultMapData() {
      return {
        playerLocation: '起始点',
        visitedLocations: ['起始点'],
        deviationScore: 0,
        locations: [{
          id: '起始点',
          name: '起始点',
          type: 'home',
          description: '你的起点',
          position: 'center',
          distance: 0,
          isCurrent: true,
          isVisited: true,
          icon: '🏠'
        }],
        mapName: '未知之地',
        mapDescription: '世界刚刚诞生，一切等待探索。'
      };
    }

    /**
     * 发射事件
     */
    _emitEvent(eventName, data) {
      try {
        const eventBus = this._platform?.eventBus;
        if (eventBus?.emit) {
          eventBus.emit(eventName, {
            id: 'map_' + Date.now(),
            type: eventName,
            data,
            timestamp: Date.now(),
            source: 'map-service'
          });
        }
      } catch (e) {
        console.warn('[MapService] 发射事件失败:', e);
      }
    }

    // ==================== 兼容方法 ====================

    /**
     * 获取当前角色卡ID（内部辅助）
     */
    async _getCharId() {
      try {
        return await this._platform?.adapter?.getCurrentCharacterId?.() || 'default';
      } catch (e) {
        return 'default';
      }
    }

    /**
     * 兼容: travelTo(locationId) 无参版本
     */
    async travelToCompat(locationId) {
      const charId = await this._getCharId();
      return await this.travelTo(charId, locationId);
    }

    /**
     * 兼容: getLocationInfo(locationId) 无参版本
     */
    async getLocationInfoCompat(locationId) {
      const charId = await this._getCharId();
      return await this.getLocationInfo(charId, locationId);
    }

    /**
     * 兼容: getIndoorNodes(locationId) 无参版本
     */
    async getIndoorNodesCompat(locationId) {
      const charId = await this._getCharId();
      return await this.getIndoorNodes(charId, locationId);
    }

    /**
     * 兼容: getFullMapData() 无参版本
     */
    async getFullMapDataCompat() {
      const charId = await this._getCharId();
      return await this.getFullMapData(charId);
    }
  }

  // 挂载到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Map = MapService;

  console.log('[Service] MapService 已加载');
})();
