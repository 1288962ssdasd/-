/**
 * @layer Renderer
 * @file   map-renderer.js
 *
 * 职责: 地图UI渲染 - 百度地图风格设计
 * 禁止: 包含业务逻辑、调用Service、修改数据
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class MapRenderer {
    constructor() {
      this._styles = null;
    }

    /**
     * 注入样式
     */
    injectStyles() {
      if (this._styles) return;

      const style = document.createElement('style');
      style.textContent = `
        /* 百度地图风格 - 地图系统 */
        .map-panel {
          background: #f8f9fa;
          border-radius: 12px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .map-header {
          background: linear-gradient(90deg, #3385ff 0%, #4a9eff 100%);
          color: white;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .map-title {
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .map-subtitle {
          font-size: 12px;
          opacity: 0.9;
          margin-top: 2px;
        }

        .map-close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .map-close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .map-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* 左侧地点列表 */
        .map-location-list {
          width: 140px;
          background: #fff;
          border-right: 1px solid #e8e8e8;
          overflow-y: auto;
          flex-shrink: 0;
        }

        .map-location-item {
          padding: 12px 10px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .map-location-item:hover {
          background: #f5f7fa;
        }

        .map-location-item.active {
          background: #e8f4ff;
          border-left: 3px solid #3385ff;
        }

        .map-location-item.visited::after {
          content: '✓';
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: #52c41a;
          font-size: 12px;
        }

        .map-location-icon {
          font-size: 20px;
          margin-bottom: 4px;
        }

        .map-location-name {
          font-size: 13px;
          font-weight: 500;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .map-location-distance {
          font-size: 11px;
          color: #999;
          margin-top: 2px;
        }

        .map-location-type {
          font-size: 10px;
          color: #3385ff;
          background: rgba(51,133,255,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          display: inline-block;
          margin-top: 4px;
        }

        /* 右侧详情区域 */
        .map-detail-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .map-detail-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .map-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e8e8e8;
        }

        .map-detail-icon {
          font-size: 32px;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #3385ff 0%, #4a9eff 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .map-detail-title {
          flex: 1;
        }

        .map-detail-name {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          margin: 0 0 4px 0;
        }

        .map-detail-type {
          font-size: 12px;
          color: #666;
        }

        .map-detail-description {
          background: #f5f7fa;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          line-height: 1.6;
          color: #555;
        }

        .map-detail-section {
          margin-bottom: 16px;
        }

        .map-section-title {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .map-section-title::before {
          content: '';
          width: 3px;
          height: 14px;
          background: #3385ff;
          border-radius: 2px;
        }

        /* 室内节点 */
        .map-indoor-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .map-indoor-node {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .map-indoor-node:hover {
          border-color: #3385ff;
          background: #f0f7ff;
          transform: translateY(-1px);
        }

        .map-indoor-icon {
          font-size: 20px;
          margin-bottom: 4px;
        }

        .map-indoor-name {
          font-size: 12px;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* 任务标记 */
        .map-quest-marker {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff7e6;
          border: 1px solid #ffd591;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 8px;
        }

        .map-quest-icon {
          font-size: 16px;
        }

        .map-quest-info {
          flex: 1;
        }

        .map-quest-name {
          font-size: 12px;
          font-weight: 500;
          color: #d46b08;
        }

        .map-quest-desc {
          font-size: 11px;
          color: #999;
          margin-top: 2px;
        }

        /* 底部状态栏 */
        .map-footer {
          background: #fff;
          border-top: 1px solid #e8e8e8;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .map-stats {
          display: flex;
          gap: 16px;
        }

        .map-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #666;
        }

        .map-stat-value {
          font-weight: 600;
          color: #333;
        }

        .map-deviation {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .map-deviation-label {
          color: #666;
        }

        .map-deviation-value {
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .map-deviation-value.low {
          background: #f6ffed;
          color: #52c41a;
        }

        .map-deviation-value.medium {
          background: #fff7e6;
          color: #fa8c16;
        }

        .map-deviation-value.high {
          background: #fff1f0;
          color: #f5222d;
        }

        /* 前往按钮 */
        .map-travel-btn {
          background: linear-gradient(90deg, #3385ff 0%, #4a9eff 100%);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .map-travel-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(51,133,255,0.3);
        }

        .map-travel-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* 空状态 */
        .map-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #999;
        }

        .map-empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .map-empty-text {
          font-size: 14px;
        }

        /* 当前位置标签 */
        .map-current-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #52c41a;
          color: white;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 8px;
        }

        /* 滚动条美化 */
        .map-location-list::-webkit-scrollbar,
        .map-detail-content::-webkit-scrollbar {
          width: 4px;
        }

        .map-location-list::-webkit-scrollbar-thumb,
        .map-detail-content::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 2px;
        }
      `;

      document.head.appendChild(style);
      this._styles = style;
    }

    /**
     * 渲染整个地图面板
     * @param {Object} data - 地图数据
     * @param {Object} callbacks - 回调函数
     * @returns {HTMLElement} 地图面板DOM
     */
    renderMapPanel(data, callbacks = {}) {
      this.injectStyles();

      const container = document.createElement('div');
      container.className = 'map-panel';

      // 头部
      const header = this._renderHeader(data.mapName, callbacks.onClose);
      container.appendChild(header);

      // 主体
      const body = document.createElement('div');
      body.className = 'map-body';

      // 左侧地点列表
      const locationList = this.renderLocationList(
        data.locations,
        data.playerLocation,
        callbacks.onLocationClick
      );
      body.appendChild(locationList);

      // 右侧详情
      const selectedLocation = data.locations.find(l => l.id === data.selectedLocationId) ||
                               data.locations.find(l => l.isCurrent) ||
                               data.locations[0];

      const detailPanel = this.renderLocationDetail(
        selectedLocation,
        data.indoorNodes || [],
        data.questMarkers || [],
        callbacks
      );
      body.appendChild(detailPanel);

      container.appendChild(body);

      // 底部状态栏
      const footer = this._renderFooter(data.deviationScore, data.visitStats);
      container.appendChild(footer);

      return container;
    }

    /**
     * 渲染左侧地点列表
     * @param {Array} locations - 地点列表
     * @param {string} playerLocation - 玩家当前位置
     * @param {Function} onClick - 点击回调
     * @returns {HTMLElement} 地点列表DOM
     */
    renderLocationList(locations, playerLocation, onClick) {
      const list = document.createElement('div');
      list.className = 'map-location-list';

      if (!locations || locations.length === 0) {
        list.appendChild(this._renderEmptyState('暂无地点'));
        return list;
      }

      locations.forEach(location => {
        const item = document.createElement('div');
        item.className = 'map-location-item';

        if (location.id === playerLocation) {
          item.classList.add('active');
        }
        if (location.isVisited) {
          item.classList.add('visited');
        }

        const typeLabels = {
          home: '住所',
          urban: '城区',
          shop: '商店',
          dungeon: '地下城',
          forest: '森林',
          mountain: '山地',
          water: '水域',
          cave: '洞穴',
          temple: '神殿',
          ruins: '遗迹',
          camp: '营地',
          port: '港口'
        };

        // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
        const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
        const safeIcon = escapeHtml(location.icon) || '📍';
        const safeName = escapeHtml(location.name);
        const safeType = escapeHtml(typeLabels[location.type] || location.type);
        const safeDistance = location.distance > 0 ? escapeHtml(String(location.distance)) : '';

        item.innerHTML = `
          <div class="map-location-icon">${safeIcon}</div>
          <div class="map-location-name">${safeName}</div>
          ${location.distance > 0 ? `<div class="map-location-distance">${safeDistance}km</div>` : ''}
          <div class="map-location-type">${safeType}</div>
        `;

        item.addEventListener('click', () => {
          onClick?.(location.id);
        });

        list.appendChild(item);
      });

      return list;
    }

    /**
     * 渲染右侧地点详情
     * @param {Object} locationData - 地点数据
     * @param {Array} indoorNodes - 室内节点列表
     * @param {Array} questMarkers - 任务标记列表
     * @param {Object} callbacks - 回调函数
     * @returns {HTMLElement} 详情面板DOM
     */
    renderLocationDetail(locationData, indoorNodes, questMarkers, callbacks = {}) {
      const panel = document.createElement('div');
      panel.className = 'map-detail-panel';

      if (!locationData) {
        panel.appendChild(this._renderEmptyState('选择地点查看详情'));
        return panel;
      }

      const content = document.createElement('div');
      content.className = 'map-detail-content';

      // 头部信息
      const header = document.createElement('div');
      header.className = 'map-detail-header';

      // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
      const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
      const safeIcon = escapeHtml(locationData.icon) || '📍';
      const safeName = escapeHtml(locationData.name);
      const safeType = escapeHtml(locationData.type || '未知类型');

      header.innerHTML = `
        <div class="map-detail-icon">${safeIcon}</div>
        <div class="map-detail-title">
          <h3 class="map-detail-name">
            ${safeName}
            ${locationData.isCurrent ? '<span class="map-current-badge">📍 当前</span>' : ''}
          </h3>
          <div class="map-detail-type">${safeType}</div>
        </div>
      `;
      content.appendChild(header);

      // 描述
      if (locationData.description) {
        const desc = document.createElement('div');
        desc.className = 'map-detail-description';
        desc.textContent = locationData.description;
        content.appendChild(desc);
      }

      // 任务标记
      if (questMarkers && questMarkers.length > 0) {
        const questSection = document.createElement('div');
        questSection.className = 'map-detail-section';
        questSection.innerHTML = '<div class="map-section-title">相关任务</div>';

        questMarkers.forEach(quest => {
          const marker = document.createElement('div');
          marker.className = 'map-quest-marker';

          // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
          const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
          const safeQuestName = escapeHtml(quest.name);
          const safeQuestDesc = escapeHtml(quest.description || '');

          marker.innerHTML = `
            <span class="map-quest-icon">📋</span>
            <div class="map-quest-info">
              <div class="map-quest-name">${safeQuestName}</div>
              <div class="map-quest-desc">${safeQuestDesc}</div>
            </div>
          `;
          questSection.appendChild(marker);
        });

        content.appendChild(questSection);
      }

      // 室内场景
      if (indoorNodes && indoorNodes.length > 0) {
        const indoorSection = document.createElement('div');
        indoorSection.className = 'map-detail-section';
        indoorSection.innerHTML = '<div class="map-section-title">室内场景</div>';

        const grid = this.renderIndoorScene({ nodes: indoorNodes });
        indoorSection.appendChild(grid);
        content.appendChild(indoorSection);
      }

      panel.appendChild(content);

      // 底部操作区
      const actionArea = document.createElement('div');
      actionArea.style.cssText = 'padding: 12px 16px; border-top: 1px solid #e8e8e8; background: #fff;';

      const travelBtn = document.createElement('button');
      travelBtn.className = 'map-travel-btn';
      travelBtn.innerHTML = locationData.isCurrent ? '📍 当前位置' : '🚀 前往此处';
      travelBtn.disabled = locationData.isCurrent;
      travelBtn.addEventListener('click', () => {
        callbacks.onTravelClick?.(locationData.id);
      });

      actionArea.appendChild(travelBtn);
      panel.appendChild(actionArea);

      return panel;
    }

    /**
     * 渲染室内场景节点
     * @param {Object} insideData - 室内数据
     * @param {Function} onNodeClick - 节点点击回调
     * @returns {HTMLElement} 室内场景DOM
     */
    renderIndoorScene(insideData, onNodeClick) {
      const grid = document.createElement('div');
      grid.className = 'map-indoor-grid';

      if (!insideData || !insideData.nodes || insideData.nodes.length === 0) {
        return grid;
      }

      insideData.nodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'map-indoor-node';

        // [v4.31.0-fix] XSS 防护：所有用户可控内容均经过 escapeHtml 转义
        const escapeHtml = window.PhoneUtils?.escapeHtml || ((t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
        const safeNodeIcon = escapeHtml(node.icon) || '•';
        const safeNodeName = escapeHtml(node.name);

        nodeEl.innerHTML = `
          <div class="map-indoor-icon">${safeNodeIcon}</div>
          <div class="map-indoor-name">${safeNodeName}</div>
        `;

        nodeEl.addEventListener('click', () => {
          onNodeClick?.(node.id || node.name);
        });

        grid.appendChild(nodeEl);
      });

      return grid;
    }

    /**
     * 渲染室内场景（独立面板版本）
     * @param {Object} data - 室内场景数据
     * @param {Object} callbacks - 回调函数
     * @returns {HTMLElement} 室内场景面板DOM
     */
    renderIndoorPanel(data, callbacks = {}) {
      this.injectStyles();

      const container = document.createElement('div');
      container.className = 'map-panel';

      // 头部
      const header = this._renderHeader(data.locationName || '室内场景', callbacks.onClose);
      container.appendChild(header);

      // 主体
      const body = document.createElement('div');
      body.className = 'map-detail-content';
      body.style.padding = '16px';

      if (data.description) {
        const desc = document.createElement('div');
        desc.className = 'map-detail-description';
        desc.textContent = data.description;
        body.appendChild(desc);
      }

      // 节点网格
      const grid = this.renderIndoorScene(data, callbacks.onNodeClick);
      body.appendChild(grid);

      container.appendChild(body);

      return container;
    }

    // ==================== 私有方法 ====================

    _renderHeader(title, onClose) {
      const header = document.createElement('div');
      header.className = 'map-header';
      header.innerHTML = `
        <div class="map-title">
          🗺️ ${title || '地图'}
        </div>
      `;

      if (onClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'map-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', onClose);
        header.appendChild(closeBtn);
      }

      return header;
    }

    _renderFooter(deviationScore, visitStats) {
      const footer = document.createElement('div');
      footer.className = 'map-footer';

      // 偏差值等级
      let deviationClass = 'low';
      if (deviationScore > 30) deviationClass = 'medium';
      if (deviationScore > 70) deviationClass = 'high';

      footer.innerHTML = `
        <div class="map-stats">
          <div class="map-stat">
            <span>📍</span>
            <span>已探索 <span class="map-stat-value">${visitStats?.visited || 0}/${visitStats?.total || 0}</span></span>
          </div>
        </div>
        <div class="map-deviation">
          <span class="map-deviation-label">偏差值:</span>
          <span class="map-deviation-value ${deviationClass}">${deviationScore || 0}</span>
        </div>
      `;

      return footer;
    }

    _renderEmptyState(text) {
      const empty = document.createElement('div');
      empty.className = 'map-empty-state';
      empty.innerHTML = `
        <div class="map-empty-icon">🗺️</div>
        <div class="map-empty-text">${text || '暂无数据'}</div>
      `;
      return empty;
    }
  }

  // 挂载到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Map = MapRenderer;

  console.log('[Renderer] MapRenderer (百度地图风格) 已加载');
})();
