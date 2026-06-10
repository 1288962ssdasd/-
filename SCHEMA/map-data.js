/**
 * MapData - 地图数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:map:{key}
 *
 * 数据键名：{charId}:map:main
 * 默认结构：{
 *   outdoor: {...},        // 室外地图
 *   inside: {...},         // 室内地图
 *   playerLocation: '',    // 玩家当前位置
 *   visitedLocations: [],  // 已访问位置列表
 *   deviationScore: 0      // 偏差分数
 * }
 */

;(function () {
  'use strict';

  var DOMAIN = 'map';

  class MapData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    /**
     * 获取地图数据
     * 键名: {charId}:map:main
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 地图数据
     */
    async get(charId) {
      try {
        var data = await this._platform.data(DOMAIN, charId + ':main', null);
        if (!data) {
          return this._buildDefaultMap();
        }
        return data;
      } catch (e) {
        console.warn('[MapData] 读取失败:', e);
        return this._buildDefaultMap();
      }
    }

    /**
     * 保存地图数据
     * 键名: {charId}:map:main
     * @param {string} charId - 角色ID
     * @param {Object} data - 地图数据
     */
    async save(charId, data) {
      try {
        var mapData = Object.assign({}, this._buildDefaultMap(), data);
        mapData.updatedAt = Date.now();
        await this._platform.setData(DOMAIN, charId + ':main', mapData);
        console.log('[MapData] 地图已保存:', charId);
      } catch (e) {
        console.warn('[MapData] 保存失败:', e);
      }
    }

    /**
     * 删除地图数据
     * @param {string} charId - 角色ID
     */
    async delete(charId) {
      try {
        await this._platform.setData(DOMAIN, charId + ':main', null);
        console.log('[MapData] 地图已删除:', charId);
      } catch (e) {
        console.warn('[MapData] 删除失败:', e);
      }
    }

    /**
     * 检查地图是否存在
     * @param {string} charId - 角色ID
     * @returns {Promise<boolean>}
     */
    async exists(charId) {
      try {
        var data = await this.get(charId);
        return !!data && !!data.outdoor;
      } catch (e) {
        return false;
      }
    }

    /**
     * 更新玩家位置
     * @param {string} charId - 角色ID
     * @param {string} locationId - 新位置ID
     * @returns {Promise<boolean>} 是否成功
     */
    async updatePlayerLocation(charId, locationId) {
      try {
        var mapData = await this.get(charId);
        var oldLocation = mapData.playerLocation;

        // 更新位置
        mapData.playerLocation = locationId;

        // 添加到已访问列表
        if (mapData.visitedLocations.indexOf(locationId) === -1) {
          mapData.visitedLocations.push(locationId);
        }

        // 保存
        await this.save(charId, mapData);

        // [v4.3-fix] Schema 层不发射事件（铁则三），事件发射由调用方 Service 层完成
        console.log('[MapData] 玩家位置更新:', oldLocation, '->', locationId);
        return true;
      } catch (e) {
        console.warn('[MapData] 更新位置失败:', e);
        return false;
      }
    }

    /**
     * 添加已访问位置
     * @param {string} charId - 角色ID
     * @param {string} locationId - 位置ID
     * @returns {Promise<boolean>} 是否成功
     */
    async addVisitedLocation(charId, locationId) {
      try {
        var mapData = await this.get(charId);

        if (mapData.visitedLocations.indexOf(locationId) === -1) {
          mapData.visitedLocations.push(locationId);
          await this.save(charId, mapData);
          console.log('[MapData] 添加已访问位置:', locationId);
        }

        return true;
      } catch (e) {
        console.warn('[MapData] 添加已访问位置失败:', e);
        return false;
      }
    }

    /**
     * 计算位置偏差分数
     * @param {string} charId - 角色ID
     * @param {string} newLocation - 新位置ID
     * @returns {Promise<Object>} { score: number, delta: number, reason: string }
     */
    /** @deprecated 偏差计算逻辑已迁移到 MapService，请通过 Service 层调用 */
    async calculateDeviation(charId, newLocation) {
      try {
        var mapData = await this.get(charId);
        var currentScore = mapData.deviationScore || 0;

        // 计算偏差变化
        var delta = this._calculateDeviationDelta(mapData, newLocation);
        var newScore = Math.max(0, Math.min(100, currentScore + delta));

        // 更新分数
        mapData.deviationScore = newScore;
        await this.save(charId, mapData);

        var result = {
          score: newScore,
          delta: delta,
          reason: this._getDeviationReason(delta, newLocation)
        };

        console.log('[MapData] 偏差分数计算:', result);
        return result;
      } catch (e) {
        console.warn('[MapData] 计算偏差失败:', e);
        return { score: 0, delta: 0, reason: '计算失败' };
      }
    }

    /**
     * 获取偏差分数
     * @param {string} charId - 角色ID
     * @returns {Promise<number>} 偏差分数
     */
    async getDeviationScore(charId) {
      try {
        var mapData = await this.get(charId);
        return mapData.deviationScore || 0;
      } catch (e) {
        return 0;
      }
    }

    /**
     * 获取玩家当前位置
     * @param {string} charId - 角色ID
     * @returns {Promise<string>} 位置ID
     */
    async getPlayerLocation(charId) {
      try {
        var mapData = await this.get(charId);
        return mapData.playerLocation || '起始点';
      } catch (e) {
        return '起始点';
      }
    }

    /**
     * 获取已访问位置列表
     * @param {string} charId - 角色ID
     * @returns {Promise<Array>} 位置ID列表
     */
    async getVisitedLocations(charId) {
      try {
        var mapData = await this.get(charId);
        return mapData.visitedLocations || [];
      } catch (e) {
        return [];
      }
    }

    /**
     * 获取室外地图
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 室外地图数据
     */
    async getOutdoorMap(charId) {
      try {
        var mapData = await this.get(charId);
        return mapData.outdoor || {};
      } catch (e) {
        return {};
      }
    }

    /**
     * 获取室内地图
     * @param {string} charId - 角色ID
     * @returns {Promise<Object>} 室内地图数据
     */
    async getInsideMap(charId) {
      try {
        var mapData = await this.get(charId);
        return mapData.inside || {};
      } catch (e) {
        return {};
      }
    }

    /**
     * 更新室外地图
     * @param {string} charId - 角色ID
     * @param {Object} outdoorData - 室外地图数据
     */
    async updateOutdoorMap(charId, outdoorData) {
      try {
        var mapData = await this.get(charId);
        mapData.outdoor = Object.assign({}, mapData.outdoor, outdoorData);
        await this.save(charId, mapData);
        console.log('[MapData] 室外地图已更新:', charId);
      } catch (e) {
        console.warn('[MapData] 更新室外地图失败:', e);
      }
    }

    /**
     * 更新室内地图
     * @param {string} charId - 角色ID
     * @param {Object} insideData - 室内地图数据
     */
    async updateInsideMap(charId, insideData) {
      try {
        var mapData = await this.get(charId);
        mapData.inside = Object.assign({}, mapData.inside, insideData);
        await this.save(charId, mapData);
        console.log('[MapData] 室内地图已更新:', charId);
      } catch (e) {
        console.warn('[MapData] 更新室内地图失败:', e);
      }
    }

    // ===== V1 兼容方法 =====

    /**
     * [兼容] 保存世界地图（旧接口）
     * @param {string} charId - 角色ID
     * @param {Object} worldMap - 世界地图数据
     */
    async saveWorldMap(charId, worldMap) {
      try {
        if (!worldMap) {
          await this.delete(charId);
          return;
        }

        var mapData = await this.get(charId);
        mapData.outdoor = {
          name: '世界地图',
          description: '大世界地图',
          nodes: (worldMap.locations || []).map(function (loc) {
            return {
              name: loc.name,
              type: loc.type || 'urban',
              info: loc.description || '',
              distant: 0
            };
          }),
          currentLocation: worldMap.currentLocation || '起始点'
        };
        mapData.playerLocation = worldMap.currentLocation || mapData.playerLocation;

        await this.save(charId, mapData);
        console.log('[MapData] 世界地图已保存（兼容模式）:', charId);
      } catch (e) {
        console.warn('[MapData] 保存世界地图失败:', e);
      }
    }

    // ===== 私有方法 =====

    _buildDefaultMap() {
      return {
        outdoor: {
          name: '未知之地',
          description: '世界刚刚诞生，一切等待探索。',
          nodes: [
            { name: '起始点', position: 'center', type: 'home', info: '你的起点', distant: 0 }
          ]
        },
        inside: {
          name: '初始位置',
          description: '一个简陋的起点。',
          nodes: [
            { name: '门口', info: '出入口' },
            { name: '房间', info: '你的空间' }
          ]
        },
        playerLocation: '起始点',
        visitedLocations: ['起始点'],
        deviationScore: 0,
        createdAt: Date.now()
      };
    }

    _calculateDeviationDelta(mapData, newLocation) {
      var visited = mapData.visitedLocations || [];
      var current = mapData.playerLocation;

      // 已经访问过，偏差不变
      if (visited.indexOf(newLocation) !== -1) {
        return 0;
      }

      // 新位置，根据距离计算偏差
      var delta = 5; // 基础偏差

      // 如果是返回之前的位置，减少偏差
      if (newLocation === current) {
        delta = -2;
      }

      return delta;
    }

    _getDeviationReason(delta, location) {
      if (delta > 0) {
        return '探索新位置：' + location;
      } else if (delta < 0) {
        return '返回已知位置：' + location;
      }
      return '在已知区域移动';
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Map = MapData;

  console.log('[Schema] MapData 已加载');
})();
