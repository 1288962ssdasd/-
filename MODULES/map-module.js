/**
 * @layer Module
 * @file   map-module.js
 * @depends MapService, MapData, Platform
 * @subscribes map:location:changed, quest:progress:updated
 *
 * 职责: 地图模块 - 管理地图UI、用户交互、场景切换
 * 禁止: 直接操作数据、直接调用Schema
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  const MODULE_ID = 'map';

  class MapModule {
    constructor() {
      this.id = MODULE_ID;
      this.name = '地图';
      this.icon = '🗺️';
      this.iconBg = 'linear-gradient(135deg, #3385ff 0%, #4a9eff 100%)';

      this._platform = null;
      this._service = null;
      this._renderer = null;
      this._unsubscribers = [];
      this._isInitialized = false;
      this._currentView = 'map'; // 'map' | 'indoor'
      this._selectedLocationId = null;
      this._container = null;
    }

    /**
     * 初始化模块
     * [铁则四] 在MODULES_READY后初始化
     */
    async init(platform) {
      console.log(`[${MODULE_ID}] 初始化地图模块...`);
      this._platform = platform || window.Platform;

      // [v4.3-fix] 获取Service - 使用 window.Platform.get 而非 phone.get
      this._service = window.Platform?.get?.('mapService');
      if (!this._service) {
        console.warn(`[${MODULE_ID}] Platform.get('mapService') 失败，尝试降级`);
        // 降级：直接实例化
        if (window.PhoneServices?.Map) {
          try {
            this._service = new window.PhoneServices.Map(window.Platform);
            console.log(`[${MODULE_ID}] ✅ MapService 降级创建成功`);
          } catch (e) {
            console.error(`[${MODULE_ID}] ❌ MapService 降级创建失败:`, e);
          }
        } else {
          console.error(`[${MODULE_ID}] ❌ window.PhoneServices.Map 不存在`);
        }
      } else {
        console.log(`[${MODULE_ID}] ✅ MapService 从 Platform 获取成功`);
      }

      // [v4.3-fix] 初始化Renderer
      if (window.PhoneRenderers?.Map) {
        this._renderer = new window.PhoneRenderers.Map();
        console.log(`[${MODULE_ID}] ✅ MapRenderer 初始化成功`);
      } else {
        console.error(`[${MODULE_ID}] ❌ window.PhoneRenderers.Map 不存在`);
      }

      // [v4.3-fix] 订阅事件 - 使用 Platform.on 而非 platform.eventBus
      this._subscribeEvents();

      this._isInitialized = true;
      console.log(`[${MODULE_ID}] 初始化完成, service=${!!this._service}, renderer=${!!this._renderer}`);
    }

    /**
     * 订阅事件
     * [铁则三] Module只能订阅事件，不能发射
     */
    _subscribeEvents() {
      // [v4.3-fix] 使用 Platform.on() 代理方法，而非直接访问 eventBus
      var platform = this._platform || window.Platform;
      if (!platform) return;

      var self = this;
      var unsub = [];

      unsub.push(platform.on('map:location:changed', function(data) { self._onLocationChanged(data); }));
      unsub.push(platform.on('map:deviation:calculated', function(data) { self._onDeviationCalculated(data); }));
      unsub.push(platform.on('quest:progress:updated', function(data) { self._onQuestProgressUpdated(data); }));

      this._unsubscribers = this._unsubscribers || [];
      this._unsubscribers = this._unsubscribers.concat(unsub);
    }

    /**
     * 渲染模块UI
     * [铁则三] render()返回由Renderer生成的节点
     */
    async render() {
      if (!this._service || !this._renderer) {
        return this._renderErrorState('地图服务未就绪');
      }

      try {
        const charId = await this._getCurrentCharId();
        if (!charId) {
          return this._renderErrorState('无法获取角色ID');
        }

        // 获取完整地图数据
        const mapData = await this._service.getFullMapData(charId);
        const visitStats = await this._service.getVisitStats(charId);

        // [v4.3-fix] 防御性检查，确保 locations 存在
        const locations = mapData?.locations || [];
        const selectedLocation = locations.find(l => l.id === this._selectedLocationId) ||
                                 locations.find(l => l.isCurrent) ||
                                 locations[0];

        let indoorNodes = [];
        let questMarkers = [];

        if (selectedLocation) {
          indoorNodes = await this._service.getIndoorNodes(charId, selectedLocation.id);

          // 获取相关任务（简化实现，实际应从QuestService获取）
          const questService = this._platform.get?.('questService');
          if (questService) {
            const activeQuests = await questService.getActiveQuests(charId);
            questMarkers = activeQuests.filter(q => {
              // 检查任务是否与当前地点相关
              if (!q.steps) return false;
              return q.steps.some(s => {
                if (s.completed) return false;
                return (s.target === selectedLocation.id || s.location === selectedLocation.id);
              });
            }).map(q => ({
              id: q.id,
              name: q.name,
              description: q.description
            }));
          }
        }

        // 准备渲染数据
        const renderData = {
          ...mapData,
          selectedLocationId: this._selectedLocationId,
          // [v4.3-fix] 传递 playerLocation，让 renderer 正确高亮当前位置
          playerLocation: mapData.playerLocation || (selectedLocation ? selectedLocation.id : null),
          indoorNodes: indoorNodes,
          questMarkers: questMarkers,
          visitStats: visitStats
        };

        // 使用Renderer生成UI
        const panel = this._renderer.renderMapPanel(renderData, {
          onLocationClick: (locationId) => this.handleLocationClick(locationId),
          onTravelClick: (locationId) => this.handleTravelClick(locationId),
          onIndoorNodeClick: (nodeName) => this.handleIndoorNodeClick(nodeName),
          onClose: () => this._closePanel()
        });

        this._container = panel;
        return panel;

      } catch (e) {
        console.warn(`[${MODULE_ID}] 渲染地图失败:`, e);
        return this._renderErrorState('地图加载失败');
      }
    }

    /**
     * 处理地点点击
     * @param {string} locationId - 地点ID
     */
    async handleLocationClick(locationId) {
      console.log(`[${MODULE_ID}] 选择地点:`, locationId);
      this._selectedLocationId = locationId;

      // 刷新UI显示选中地点详情
      await this.refreshUI();
    }

    /**
     * 处理前往按钮点击
     * @param {string} locationId - 目标地点ID
     */
    async handleTravelClick(locationId) {
      console.log(`[${MODULE_ID}] 前往地点:`, locationId);

      if (!this._service) {
        this._showNotification('地图服务不可用', 'error');
        return;
      }

      try {
        const charId = await this._getCurrentCharId();
        const result = await this._service.travelTo(charId, locationId);

        if (result.success) {
          this._showNotification(`已到达: ${locationId}`, 'success');
          // 清除选中，显示新位置
          this._selectedLocationId = null;
          await this.refreshUI();
        } else {
          this._showNotification(result.error || '移动失败', 'error');
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] 前往地点失败:`, e);
        this._showNotification('移动失败', 'error');
      }
    }

    /**
     * 处理室内节点点击
     * @param {string} nodeName - 节点名称
     */
    async handleIndoorNodeClick(nodeName) {
      console.log(`[${MODULE_ID}] 交互节点:`, nodeName);

      // 检查任务进度
      if (this._service) {
        try {
          const charId = await this._getCurrentCharId();
          await this._service.checkQuestProgress(charId, 'interact', nodeName);
        } catch (e) {
          console.warn(`[${MODULE_ID}] 检查任务进度失败:`, e);
        }
      }

      this._showNotification(`与 ${nodeName} 交互`, 'info');
    }

    /**
     * 刷新UI
     */
    async refreshUI() {
      if (!this._container) return;

      const newContent = await this.render();
      if (newContent && this._container.parentNode) {
        this._container.parentNode.replaceChild(newContent, this._container);
        this._container = newContent;
      }
    }

    // ==================== 事件处理器 ====================

    _onLocationChanged(data) {
      console.log(`[${MODULE_ID}] 位置变更:`, data);

      // 显示位置变更通知
      if (data.isFirstVisit) {
        this._showNotification(`首次探索: ${data.newLocation}`, 'success');
      }

      // 刷新UI
      this.refreshUI();
    }

    _onDeviationCalculated(data) {
      console.log(`[${MODULE_ID}] 偏差值计算:`, data);

      // 偏差值显著变化时显示提示
      if (Math.abs(data.delta) >= 5) {
        const direction = data.delta > 0 ? '增加' : '减少';
        this._showNotification(`世界偏差${direction}: ${Math.abs(data.delta)}`, 'info');
      }
    }

    _onQuestProgressUpdated(data) {
      console.log(`[${MODULE_ID}] 任务进度更新:`, data);
      this._showNotification(`任务进度: ${data.questName}`, 'success');

      // 刷新UI以更新任务标记
      this.refreshUI();
    }

    // ==================== UI辅助方法 ====================

    _renderErrorState(message) {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 40px; text-align: center; color: #999;';
      div.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🗺️</div>
        <div style="font-size: 14px;">${message || '地图加载失败'}</div>
      `;
      return div;
    }

    _showNotification(message, type = 'info') {
      if (window.PhoneShell?.showNotification) {
        window.PhoneShell.showNotification(MODULE_ID, '地图系统', message);
      } else {
        console.log(`[${MODULE_ID}] ${message}`);
      }
    }

    _closePanel() {
      // 关闭面板逻辑（由PhoneShell处理）
      if (window.PhoneShell?.closeCurrentApp) {
        window.PhoneShell.closeCurrentApp();
      }
    }

    async _getCurrentCharId() {
      try {
        return await this._platform?.adapter?.getCurrentCharacterId?.() || 'default';
      } catch (e) {
        return 'default';
      }
    }

    // ==================== 生命周期方法 ====================

    resume(params) {
      console.log(`[${MODULE_ID}] 模块恢复`);
      // 恢复时刷新数据
      this.refreshUI();
    }

    pause() {
      console.log(`[${MODULE_ID}] 模块暂停`);
    }

    /**
     * 销毁模块
     */
    destroy() {
      // 取消事件订阅
      this._unsubscribers.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      this._unsubscribers = [];

      this._container = null;
      this._isInitialized = false;
      console.log(`[${MODULE_ID}] 模块已销毁`);
    }
  }

  // 创建模块实例
  const moduleInstance = new MapModule();

  // 提供toPlainObject方法供index.js使用
  MapModule.toPlainObject = function() {
    return {
      id: moduleInstance.id,
      name: moduleInstance.name,
      icon: moduleInstance.icon,
      iconBg: moduleInstance.iconBg,
      init: function(phone, params) { return moduleInstance.init(window.Platform, params); },
      resume: function(params) { return moduleInstance.resume(params); },
      pause: function() { return moduleInstance.pause(); },
      destroy: function() { return moduleInstance.destroy(); },
      render: function() { return moduleInstance.render(); },
    };
  };

  // 注册到全局
  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Map = MapModule;

  console.log(`[Module] MapModule 已注册`);
})();
