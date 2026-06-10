/**
 * @layer Renderer
 * @file   inventory-renderer.js
 *
 * 职责: 背包模块 UI 渲染
 * 禁止: 包含业务逻辑、调用 Service、直接操作 Schema
 *
 * 铁则合规：
 *   - 纯展示层，只接收数据对象返回 DOM（铁则三）
 *   - CSS 类名以 inv- 前缀隔离（铁则二十一）
 *   - 通过 callbacks 回调交互事件，不直接调用 Service
 */

;(function () {
  'use strict';

  // ==================== 工具函数 ====================

  /**
   * HTML 转义
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== 常量 ====================

  var CURRENCY_META = {
    'gold':    { icon: '\uD83E\uDE99', colorClass: 'inv-currency-gold' },
    'diamond': { icon: '\uD83D\uDC8E', colorClass: 'inv-currency-diamond' },
    'exp':     { icon: '\u2B50',       colorClass: 'inv-currency-exp' },
    'silver':  { icon: '\uD83E\uDE9A', colorClass: '' },
    'coin':    { icon: '\uD83E\uDE99', colorClass: '' },
    'gem':     { icon: '\uD83D\uDC8E', colorClass: 'inv-currency-diamond' },
    'crystal': { icon: '\uD83D\uDC8E', colorClass: 'inv-currency-diamond' },
    'star':    { icon: '\u2B50',       colorClass: 'inv-currency-exp' }
  };

  var TYPE_NAMES = {
    'consumable': '消耗品',
    'equipment': '装备',
    'material': '材料',
    'quest': '任务',
    'gift': '礼物',
    'misc': '杂项',
  };

  // ==================== Renderer 类 ====================

  class InventoryRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      const style = document.createElement('style');
      style.id = 'inv-module-styles';
      style.textContent = `
        /* ===== Inventory Module - Game Backpack Style ===== */
        .inv-app {
          width: 100%;
          height: 100%;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
          color: #1C1C1E;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* ===== Currency Bar ===== */
        .inv-currency-bar {
          display: flex;
          align-items: center;
          justify-content: space-around;
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          padding: 8px 12px;
          flex-shrink: 0;
          gap: 6px;
        }
        .inv-currency-tag {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 4px 10px;
        }
        .inv-currency-icon {
          font-size: 14px;
          line-height: 1;
        }
        .inv-currency-val {
          font-size: 13px;
          font-weight: 700;
          color: #FFD700;
          font-variant-numeric: tabular-nums;
        }
        .inv-currency-val.inv-currency-diamond {
          color: #00BFFF;
        }
        .inv-currency-val.inv-currency-exp {
          color: #7CFC00;
        }

        /* ===== Header ===== */
        .inv-header {
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
        }
        .inv-title {
          font-size: 17px;
          font-weight: 700;
          color: #FFFFFF;
          margin: 0;
          letter-spacing: 1px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        /* ===== Tabs ===== */
        .inv-tabs {
          display: flex;
          gap: 0;
          padding: 6px 12px;
          background: #FFFFFF;
          flex-shrink: 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .inv-btn-tab {
          flex: 1;
          padding: 8px 10px;
          border: none;
          background: transparent;
          color: #8E8E93;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px 8px 0 0;
          transition: all 0.2s ease;
          position: relative;
          text-align: center;
        }
        .inv-btn-tab.inv-btn-active {
          background: #f5f5f5;
          color: #2c3e50;
          font-weight: 700;
        }
        .inv-btn-tab.inv-btn-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 20%;
          width: 60%;
          height: 2px;
          background: #e67e22;
          border-radius: 1px;
        }

        /* ===== Type Filter ===== */
        .inv-type-filter {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          background: #f5f5f5;
          flex-shrink: 0;
          scrollbar-width: none;
        }
        .inv-type-filter::-webkit-scrollbar {
          display: none;
        }
        .inv-btn-type {
          flex-shrink: 0;
          padding: 5px 14px;
          border: 1px solid #ddd;
          background: #FFFFFF;
          color: #555;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 14px;
          transition: all 0.2s ease;
        }
        .inv-btn-type.inv-btn-active {
          background: #e67e22;
          color: #FFFFFF;
          border-color: #e67e22;
          box-shadow: 0 2px 6px rgba(230,126,34,0.3);
        }

        /* ===== Views Container ===== */
        .inv-views {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 8px 10px 16px;
        }

        /* ===== Item Grid (4-column) ===== */
        .inv-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .inv-grid-item {
          background: #FFFFFF;
          border-radius: 10px;
          padding: 8px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          border: 1px solid #eee;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
          position: relative;
        }
        .inv-grid-item:active {
          transform: scale(0.95);
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
        }
        .inv-grid-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #fff;
          flex-shrink: 0;
        }
        .inv-grid-name {
          font-size: 11px;
          font-weight: 600;
          color: #333;
          text-align: center;
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          width: 100%;
        }
        .inv-grid-qty {
          font-size: 10px;
          color: #e67e22;
          font-weight: 700;
          position: absolute;
          bottom: 4px;
          right: 6px;
        }
        .inv-grid-actions {
          display: flex;
          gap: 4px;
          margin-top: 2px;
        }

        /* ===== Item Usage Badge ===== */
        .inv-item-usage {
          font-size: 9px;
          padding: 2px 4px;
          border-radius: 3px;
          margin-top: 2px;
        }
        .inv-item-usage.gift { background: #ffe0e0; color: #c0392b; }
        .inv-item-usage.quest { background: #e0f0ff; color: #2980b9; }
        .inv-item-usage.consume { background: #e0ffe0; color: #27ae60; }

        /* ===== Action Buttons ===== */
        .inv-btn {
          border: none;
          cursor: pointer;
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .inv-btn-use {
          padding: 3px 8px;
          background: #3498db;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .inv-btn-use:active {
          background: #2980b9;
          transform: scale(0.95);
        }
        .inv-btn-gift {
          padding: 3px 8px;
          background: #e74c3c;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .inv-btn-gift:active {
          background: #c0392b;
          transform: scale(0.95);
        }
        .inv-btn-equip {
          padding: 3px 8px;
          background: #27ae60;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .inv-btn-equip:active {
          background: #219a52;
          transform: scale(0.95);
        }
        .inv-btn-drop {
          padding: 3px 8px;
          background: #95a5a6;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .inv-btn-drop:active {
          background: #7f8c8d;
          transform: scale(0.95);
        }

        /* ===== Equipment View: Paper Doll ===== */
        .inv-equip-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .inv-doll {
          position: relative;
          width: 160px;
          height: 200px;
          background: linear-gradient(180deg, #ecf0f1 0%, #bdc3c7 100%);
          border-radius: 16px;
          border: 2px solid #95a5a6;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 8px auto;
        }
        .inv-doll-character {
          font-size: 64px;
          opacity: 0.6;
        }
        .inv-equip-slot {
          position: absolute;
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.85);
          border: 2px dashed #bdc3c7;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .inv-equip-slot:active {
          background: #d5f5e3;
          border-color: #27ae60;
        }
        .inv-equip-slot.inv-slot-head { top: 4px; left: 50%; transform: translateX(-50%); }
        .inv-equip-slot.inv-slot-body { top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .inv-equip-slot.inv-slot-weapon { top: 50%; right: -48px; transform: translateY(-50%); }
        .inv-equip-slot.inv-slot-shield { top: 50%; left: -48px; transform: translateY(-50%); }
        .inv-equip-slot.inv-slot-boots { bottom: 4px; left: 50%; transform: translateX(-50%); }
        .inv-equip-slot.inv-slot-filled {
          border-style: solid;
          border-color: #27ae60;
          background: rgba(39,174,96,0.1);
        }

        /* ===== Equipment List ===== */
        .inv-equip-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        .inv-equip-item {
          background: #FFFFFF;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          border: 1px solid #eee;
          transition: transform 0.15s ease;
        }
        .inv-equip-item:active {
          transform: scale(0.98);
        }
        .inv-equip-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .inv-equip-slot-label {
          font-size: 10px;
          font-weight: 700;
          color: #e67e22;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(230,126,34,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .inv-equip-name {
          font-size: 14px;
          font-weight: 600;
          color: #1C1C1E;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .inv-btn-unequip {
          padding: 4px 10px;
          background: #e74c3c;
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 700;
          border-radius: 8px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .inv-btn-unequip:active {
          background: #c0392b;
          transform: scale(0.95);
        }

        /* ===== Currency List ===== */
        .inv-currency-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .inv-currency-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: #FFFFFF;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          border: 1px solid #eee;
        }
        .inv-currency-name {
          font-size: 15px;
          font-weight: 600;
          color: #1C1C1E;
        }
        .inv-currency-amount {
          font-size: 16px;
          font-weight: 700;
          color: #e67e22;
          font-variant-numeric: tabular-nums;
        }
        .inv-currency-actions {
          display: flex;
          justify-content: center;
          padding: 12px 0;
        }
        .inv-currency-actions .inv-btn {
          padding: 10px 24px;
          background: #e67e22;
          color: #FFFFFF;
          font-size: 15px;
          font-weight: 700;
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        .inv-currency-actions .inv-btn:active {
          background: #d35400;
          transform: scale(0.97);
        }

        /* ===== Empty & Error States ===== */
        .inv-empty,
        .inv-error {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          min-height: 200px;
          font-size: 15px;
          color: #8E8E93;
          font-weight: 400;
          text-align: center;
          padding: 32px;
        }
        .inv-error {
          color: #e74c3c;
        }

        /* ===== Inline Input Modal ===== */
        .inv-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .inv-modal-box {
          background: #fff;
          border-radius: 14px;
          padding: 20px;
          width: 280px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        .inv-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0 0 12px;
        }
        .inv-modal-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 14px;
        }
        .inv-modal-input:focus {
          border-color: #e67e22;
        }
        .inv-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .inv-modal-btn {
          padding: 8px 18px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .inv-modal-cancel {
          background: #eee;
          color: #555;
        }
        .inv-modal-confirm {
          background: #e67e22;
          color: #fff;
        }

        /* ===== NPC Select Modal ===== */
        .inv-npc-list {
          max-height: 200px;
          overflow-y: auto;
          margin: 10px 0;
        }
        .inv-npc-item {
          padding: 10px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .inv-npc-item:hover {
          background: #f5f5f5;
        }
        .inv-npc-item.selected {
          background: #e0f0ff;
        }

        /* ===== Item Detail Modal ===== */
        .inv-detail-modal {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          width: 300px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        .inv-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .inv-detail-icon {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: #fff;
        }
        .inv-detail-info h4 {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 700;
        }
        .inv-detail-source {
          font-size: 12px;
          color: #888;
        }
        .inv-detail-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .inv-detail-effects {
          background: #f8f8f8;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .inv-detail-effects h5 {
          margin: 0 0 8px;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
        }
        .inv-detail-effect-item {
          font-size: 13px;
          color: #333;
          padding: 4px 0;
          border-bottom: 1px solid #eee;
        }
        .inv-detail-effect-item:last-child {
          border-bottom: none;
        }
        .inv-detail-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .inv-detail-actions button {
          flex: 1;
          min-width: 70px;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .inv-detail-use { background: #3498db; color: #fff; }
        .inv-detail-gift { background: #e74c3c; color: #fff; }
        .inv-detail-drop { background: #95a5a6; color: #fff; }
        .inv-detail-close { background: #f0f0f0; color: #333; }
      `;
      document.head.appendChild(style);
      this._stylesInjected = true;
    }

    // ==================== 主渲染 ====================

    /**
     * 渲染背包主界面
     * @returns {string} HTML 字符串
     */
    renderApp() {
      this.injectStyles();
      return `
        <div class="inv-app">
          <div class="inv-header">
            <h3 class="inv-title">背包</h3>
          </div>
          <div class="inv-currency-bar" data-ref="inv-currency-bar">
            <!-- 由 renderCurrencyBar() 动态填充 -->
          </div>
          <div class="inv-tabs">
            <button class="inv-btn inv-btn-tab inv-btn-active" data-action="tab-items">物品</button>
            <button class="inv-btn inv-btn-tab" data-action="tab-equipment">装备</button>
            <button class="inv-btn inv-btn-tab" data-action="tab-currency">货币</button>
          </div>
          <div class="inv-type-filter" data-view="ITEMS">
            <button class="inv-btn inv-btn-type" data-action="filter-type" data-type="">全部</button>
          </div>
          <div class="inv-views">
            <div class="inv-view" data-view="ITEMS"></div>
            <div class="inv-view" data-view="EQUIPMENT" style="display:none;"></div>
            <div class="inv-view" data-view="CURRENCY" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    // ==================== 货币栏渲染 ====================

    /**
     * 渲染货币栏
     * @param {Object} currencies - 货币数据 { name: amount }
     * @returns {string} HTML 字符串
     */
    renderCurrencyBar(currencies) {
      if (!currencies || (typeof currencies === 'object' && Object.keys(currencies).length === 0)) {
        return '<span style="font-size:12px;color:rgba(255,255,255,0.5);">暂无货币</span>';
      }

      var html = '';
      for (var name in currencies) {
        if (!currencies.hasOwnProperty(name)) continue;
        var amount = currencies[name];
        var meta = CURRENCY_META[name.toLowerCase()] || {};
        var icon = meta.icon || '\uD83D\uDCB0';
        var colorClass = meta.colorClass || '';

        html += '<div class="inv-currency-tag">';
        html += '<span class="inv-currency-icon">' + icon + '</span>';
        html += '<span class="inv-currency-val ' + escapeHtml(colorClass) + '">' + amount + '</span>';
        html += '</div>';
      }
      return html;
    }

    // ==================== 物品视图 ====================

    /**
     * 渲染物品网格
     * @param {Object} items - 物品数据
     * @returns {HTMLElement} 网格容器
     */
    renderItems(items) {
      var gridEl = document.createElement('div');
      gridEl.className = 'inv-grid';

      if (!items || (typeof items === 'object' && Object.keys(items).length === 0) || (Array.isArray(items) && items.length === 0)) {
        gridEl.innerHTML = '';
        return gridEl;
      }

      if (Array.isArray(items)) {
        items.forEach(function (item) {
          gridEl.appendChild(this.renderGridItem(item, item.type || '', item.id || item.itemId));
        }.bind(this));
      } else {
        for (var type in items) {
          if (!items.hasOwnProperty(type)) continue;
          var typeItems = items[type];
          for (var id in typeItems) {
            if (!typeItems.hasOwnProperty(id)) continue;
            gridEl.appendChild(this.renderGridItem(typeItems[id], type, id));
          }
        }
      }

      return gridEl;
    }

    /**
     * 渲染单个网格物品
     * @param {Object} item - 物品数据
     * @param {string} type - 物品类型
     * @param {string} itemId - 物品 ID
     * @returns {HTMLElement}
     */
    renderGridItem(item, type, itemId) {
      var el = document.createElement('div');
      el.className = 'inv-grid-item';

      var usableIn = item.usableIn || [];
      var usageClass = usableIn.includes('gift') ? 'gift' :
                      usableIn.includes('quest') ? 'quest' :
                      usableIn.includes('consume') ? 'consume' : '';
      var usageText = usableIn.includes('gift') ? '可赠送' :
                     usableIn.includes('quest') ? '任务' :
                     usableIn.includes('consume') ? '可使用' : '';

      el.innerHTML = `
        <div class="inv-grid-icon" data-action="view-detail" data-type="${escapeHtml(type)}" data-item-id="${escapeHtml(itemId)}">${escapeHtml((item.name || '').charAt(0) || '?')}</div>
        <div class="inv-grid-name">${escapeHtml(item.name)}</div>
        ${usageText ? '<div class="inv-item-usage ' + usageClass + '">' + usageText + '</div>' : ''}
        <span class="inv-grid-qty">x${item.quantity || 1}</span>
        <div class="inv-grid-actions">
          ${usableIn.includes('consume') || usableIn.includes('any') ? '<button class="inv-btn inv-btn-use" data-action="use-item" data-type="' + escapeHtml(type) + '" data-item-id="' + escapeHtml(itemId) + '">使用</button>' : ''}
          ${usableIn.includes('gift') || usableIn.includes('any') ? '<button class="inv-btn inv-btn-gift" data-action="gift-item" data-type="' + escapeHtml(type) + '" data-item-id="' + escapeHtml(itemId) + '">赠送</button>' : ''}
          <button class="inv-btn inv-btn-drop" data-action="drop-item" data-type="${escapeHtml(type)}" data-item-id="${escapeHtml(itemId)}">丢弃</button>
        </div>
      `;
      return el;
    }

    /**
     * 渲染类型筛选栏
     * @param {Object} items - 物品数据
     * @returns {string} HTML 字符串
     */
    renderTypeFilter(items) {
      if (!items || typeof items !== 'object' || Array.isArray(items)) return '';

      var types = Object.keys(items);
      var html = '<button class="inv-btn inv-btn-type inv-btn-active" data-action="filter-type" data-type="">全部</button>';
      types.forEach(function (type) {
        var displayName = TYPE_NAMES[type] || type;
        html += '<button class="inv-btn inv-btn-type" data-action="filter-type" data-type="' + escapeHtml(type) + '">' + escapeHtml(displayName) + '</button>';
      });
      return html;
    }

    // ==================== 装备视图 ====================

    /**
     * 渲染装备视图
     * @param {Object} equipment - 装备数据
     * @returns {HTMLElement} 装备区域容器
     */
    renderEquipment(equipment) {
      var areaEl = document.createElement('div');
      areaEl.className = 'inv-equip-area';

      // Paper doll
      var dollEl = document.createElement('div');
      dollEl.className = 'inv-doll';
      dollEl.innerHTML = `
        <span class="inv-doll-character">&#x1F9CD;</span>
        <div class="inv-equip-slot inv-slot-head" title="头部">&#x1F9D1;</div>
        <div class="inv-equip-slot inv-slot-body" title="身体">&#x1F455;</div>
        <div class="inv-equip-slot inv-slot-weapon" title="武器">&#x2694;&#xFE0F;</div>
        <div class="inv-equip-slot inv-slot-shield" title="盾牌">&#x1F6E1;&#xFE0F;</div>
        <div class="inv-equip-slot inv-slot-boots" title="鞋子">&#x1F97E;</div>
      `;
      areaEl.appendChild(dollEl);

      if (!equipment || (typeof equipment === 'object' && Object.keys(equipment).length === 0)) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'inv-empty';
        emptyEl.textContent = '暂无装备';
        areaEl.appendChild(emptyEl);
        return areaEl;
      }

      var listEl = document.createElement('div');
      listEl.className = 'inv-equip-list';

      var slotMap = {};
      if (Array.isArray(equipment)) {
        equipment.forEach(function (eq) {
          var slot = eq.slot || 'unknown';
          slotMap[slot] = eq;
          listEl.appendChild(this.renderEquipItem(eq, slot));
        }.bind(this));
      } else {
        for (var slot in equipment) {
          if (!equipment.hasOwnProperty(slot)) continue;
          slotMap[slot] = equipment[slot];
          listEl.appendChild(this.renderEquipItem(equipment[slot], slot));
        }
      }

      // Mark filled slots on doll
      var slotPositionMap = { head: 'head', body: 'body', weapon: 'weapon', shield: 'shield', boots: 'boots', helmet: 'head', armor: 'body', sword: 'weapon' };
      for (var s in slotMap) {
        if (!slotMap.hasOwnProperty(s)) continue;
        var eq = slotMap[s];
        var posKey = slotPositionMap[s] || s;
        var slotEl = dollEl.querySelector('.inv-slot-' + posKey);
        if (slotEl) {
          slotEl.classList.add('inv-slot-filled');
          slotEl.textContent = (eq.name || eq.itemName || '').charAt(0);
          slotEl.title = eq.name || eq.itemName || s;
        }
      }

      areaEl.appendChild(listEl);
      return areaEl;
    }

    /**
     * 渲染单个装备项
     * @param {Object} eq - 装备数据
     * @param {string} slot - 槽位
     * @returns {HTMLElement}
     */
    renderEquipItem(eq, slot) {
      var el = document.createElement('div');
      el.className = 'inv-equip-item';
      el.innerHTML = `
        <div class="inv-equip-info">
          <span class="inv-equip-slot-label">${escapeHtml(slot)}</span>
          <span class="inv-equip-name">${escapeHtml(eq.name || eq.itemName || '空')}</span>
        </div>
        <button class="inv-btn inv-btn-unequip" data-action="unequip" data-slot="${escapeHtml(slot)}">卸下</button>
      `;
      return el;
    }

    // ==================== 货币视图 ====================

    /**
     * 渲染货币视图
     * @param {Object} currencies - 货币数据
     * @returns {Array<HTMLElement>} 货币视图子元素
     */
    renderCurrencyView(currencies) {
      var elements = [];

      if (!currencies || (typeof currencies === 'object' && Object.keys(currencies).length === 0)) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'inv-empty';
        emptyEl.textContent = '暂无货币';
        elements.push(emptyEl);
        return elements;
      }

      var listEl = document.createElement('div');
      listEl.className = 'inv-currency-list';

      for (var name in currencies) {
        if (!currencies.hasOwnProperty(name)) continue;
        var el = document.createElement('div');
        el.className = 'inv-currency-item';
        el.innerHTML = `
          <span class="inv-currency-name">${escapeHtml(name)}</span>
          <span class="inv-currency-amount">${currencies[name]}</span>
        `;
        listEl.appendChild(el);
      }

      elements.push(listEl);

      var actionsEl = document.createElement('div');
      actionsEl.className = 'inv-currency-actions';
      actionsEl.innerHTML = '<button class="inv-btn" data-action="update-currency">更新货币</button>';
      elements.push(actionsEl);

      return elements;
    }

    // ==================== 弹窗渲染 ====================

    /**
     * 渲染物品详情弹窗
     * @param {Object} item - 物品数据
     * @param {string} type - 物品类型
     * @returns {HTMLElement} overlay 元素
     */
    renderItemDetail(item, type) {
      var overlay = document.createElement('div');
      overlay.className = 'inv-modal-overlay';

      var effectsHtml = (item.effects || []).map(function (e) {
        return '<div class="inv-detail-effect-item">' + e.type + ': +' + e.value + '</div>';
      }).join('');

      var sourceText = item.source === 'shop' ? '商店购买' :
                      item.source === 'quest' ? '任务奖励' :
                      item.source || '未知来源';

      var usableIn = item.usableIn || [];
      var usageText = usableIn.includes('gift') ? '可赠送给NPC' :
                     usableIn.includes('quest') ? '任务道具' :
                     usableIn.includes('consume') ? '可消耗使用' : '普通物品';

      overlay.innerHTML = `
        <div class="inv-detail-modal">
          <div class="inv-detail-header">
            <div class="inv-detail-icon">${escapeHtml((item.name || '').charAt(0))}</div>
            <div class="inv-detail-info">
              <h4>${escapeHtml(item.name)}</h4>
              <div class="inv-detail-source">来源: ${sourceText} | 数量: ${item.quantity || 1}</div>
              <div style="font-size: 12px; color: #888;">${usageText}</div>
            </div>
          </div>
          <div class="inv-detail-desc">${escapeHtml(item.description || '暂无描述')}</div>
          ${effectsHtml ? '<div class="inv-detail-effects"><h5>效果</h5>' + effectsHtml + '</div>' : ''}
          <div class="inv-detail-actions">
            ${usableIn.includes('consume') || usableIn.includes('any') ? '<button class="inv-detail-use" data-action="modal-use">使用</button>' : ''}
            ${usableIn.includes('gift') || usableIn.includes('any') ? '<button class="inv-detail-gift" data-action="modal-gift">赠送</button>' : ''}
            <button class="inv-detail-drop" data-action="modal-drop">丢弃</button>
            <button class="inv-detail-close" data-action="modal-close">关闭</button>
          </div>
        </div>
      `;
      return overlay;
    }

    /**
     * 渲染输入弹窗
     * @param {string} title - 标题
     * @param {string} placeholder - 占位符
     * @param {string} defaultValue - 默认值
     * @returns {HTMLElement} overlay 元素
     */
    renderInputModal(title, placeholder, defaultValue) {
      var overlay = document.createElement('div');
      overlay.className = 'inv-modal-overlay';
      overlay.innerHTML = `
        <div class="inv-modal-box">
          <div class="inv-modal-title">${escapeHtml(title)}</div>
          <input class="inv-modal-input" type="text" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue || '')}" />
          <div class="inv-modal-actions">
            <button class="inv-modal-btn inv-modal-cancel">取消</button>
            <button class="inv-modal-btn inv-modal-confirm">确定</button>
          </div>
        </div>
      `;
      return overlay;
    }

    /**
     * 渲染确认弹窗
     * @param {string} message - 确认消息
     * @returns {HTMLElement} overlay 元素
     */
    renderConfirmModal(message) {
      var overlay = document.createElement('div');
      overlay.className = 'inv-modal-overlay';
      overlay.innerHTML = `
        <div class="inv-modal-box">
          <div class="inv-modal-title">${escapeHtml(message)}</div>
          <div class="inv-modal-actions">
            <button class="inv-modal-btn inv-modal-cancel">取消</button>
            <button class="inv-modal-btn inv-modal-confirm">确定</button>
          </div>
        </div>
      `;
      return overlay;
    }

    /**
     * 渲染 NPC 选择弹窗
     * @param {Array} npcList - NPC 列表
     * @returns {HTMLElement} overlay 元素
     */
    renderNPCSelectModal(npcList) {
      var overlay = document.createElement('div');
      overlay.className = 'inv-modal-overlay';

      var npcItems = npcList.map(function (npc) {
        return '<div class="inv-npc-item" data-npc-id="' + escapeHtml(npc.id) + '">' +
               '<span>' + escapeHtml(npc.name || npc.id) + '</span></div>';
      }).join('');

      overlay.innerHTML = `
        <div class="inv-modal-box" style="width: 300px;">
          <div class="inv-modal-title">选择NPC</div>
          <div class="inv-npc-list">
            ${npcItems}
          </div>
          <div class="inv-modal-actions">
            <button class="inv-modal-btn inv-modal-cancel">取消</button>
          </div>
        </div>
      `;
      return overlay;
    }

    /**
     * 渲染空状态
     * @returns {HTMLElement}
     */
    renderEmptyState() {
      var empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = '背包空空如也';
      return empty;
    }
  }

  // ==================== 导出 ====================

  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Inventory = InventoryRenderer;

  console.log('[Renderer] InventoryRenderer 已加载');
})();
