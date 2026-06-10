/**
 * InventoryModule - 背包模块
 * 职责：生命周期管理、事件绑定、调用 Service
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Inventory
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 inv- 前缀隔离
 */

;(function () {
  'use strict';

  class InventoryModule extends PhoneApp {
    constructor() {
      super({
        id: 'inventory',
        name: '背包',
        icon: '\uD83C\uDF92',
        iconBg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      });
      this._service = null;
      this._unsubscribers = [];
      this._currentView = 'ITEMS'; // ITEMS | EQUIPMENT | CURRENCY
      this._currentTypeFilter = '';
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Inventory(window.Platform);
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (document.getElementById('inv-module-styles')) return;
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
    }

    onRender() {
      this._injectStyles();
      return `
        <div class="inv-app">
          <div class="inv-header">
            <h3 class="inv-title">背包</h3>
          </div>
          <div class="inv-currency-bar" data-ref="inv-currency-bar">
            <!-- 由 _renderCurrencyBar() 动态填充 -->
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

    _bindEvents() {
      setTimeout(async () => {
        if (!this._container) return;

        // 确保 service 已初始化
        if (!this._service) {
          console.warn('[InventoryModule] service 未初始化，尝试创建');
          this._service = new window.PhoneServices.Inventory(window.Platform);
        }

        // 动态渲染货币栏
        await this._renderCurrencyBar();

        this._container.addEventListener('click', async (e) => {
          // Tab 切换
          const tabBtn = e.target.closest('[data-action^="tab-"]');
          if (tabBtn) {
            const tab = tabBtn.dataset.action.replace('tab-', '');
            await this._handleTabSwitch(tab);
            return;
          }

          // 类型筛选
          const typeBtn = e.target.closest('[data-action="filter-type"]');
          if (typeBtn) {
            this._currentTypeFilter = typeBtn.dataset.type || '';
            await this._renderItems();
            return;
          }

          // 返回
          if (e.target.closest('[data-action="back"]')) {
            await this._showView('ITEMS');
            return;
          }

          // 使用物品
          if (e.target.closest('[data-action="use-item"]')) {
            const type = e.target.closest('[data-action]').dataset.type;
            const itemId = e.target.closest('[data-action]').dataset.itemId;
            await this._handleUseItem(type, itemId);
            return;
          }

          // 赠送物品
          if (e.target.closest('[data-action="gift-item"]')) {
            const type = e.target.closest('[data-action]').dataset.type;
            const itemId = e.target.closest('[data-action]').dataset.itemId;
            await this._handleGiftItem(type, itemId);
            return;
          }

          // 丢弃物品
          if (e.target.closest('[data-action="drop-item"]')) {
            const type = e.target.closest('[data-action]').dataset.type;
            const itemId = e.target.closest('[data-action]').dataset.itemId;
            await this._handleDropItem(type, itemId);
            return;
          }

          // 查看物品详情
          if (e.target.closest('[data-action="view-detail"]')) {
            const type = e.target.closest('[data-action]').dataset.type;
            const itemId = e.target.closest('[data-action]').dataset.itemId;
            await this._handleViewDetail(type, itemId);
            return;
          }

          // 装备物品
          if (e.target.closest('[data-action="equip-item"]')) {
            const type = e.target.closest('[data-action]').dataset.type;
            const itemId = e.target.closest('[data-action]').dataset.itemId;
            await this._handleEquipItem(type, itemId);
            return;
          }

          // 卸下装备
          if (e.target.closest('[data-action="unequip"]')) {
            const slot = e.target.closest('[data-action]').dataset.slot;
            await this._handleUnequipItem(slot);
            return;
          }

          // 更新货币
          if (e.target.closest('[data-action="update-currency"]')) {
            await this._handleUpdateCurrency();
            return;
          }
        });

        this._subscribeData();
        await this._renderItems();
      }, 0);
    }

    // ==================== 货币栏渲染 ====================

    _currencyMeta = {
      'gold':    { icon: '\uD83E\uDE99', colorClass: 'inv-currency-gold' },
      'diamond': { icon: '\uD83D\uDC8E', colorClass: 'inv-currency-diamond' },
      'exp':     { icon: '\u2B50',       colorClass: 'inv-currency-exp' },
      'silver':  { icon: '\uD83E\uDE9A', colorClass: '' },
      'coin':    { icon: '\uD83E\uDE99', colorClass: '' },
      'gem':     { icon: '\uD83D\uDC8E', colorClass: 'inv-currency-diamond' },
      'crystal': { icon: '\uD83D\uDC8E', colorClass: 'inv-currency-diamond' },
      'star':    { icon: '\u2B50',       colorClass: 'inv-currency-exp' }
    };

    async _renderCurrencyBar() {
      var bar = this._container?.querySelector('[data-ref="inv-currency-bar"]');
      if (!bar) return;

      try {
        var currency = await this._service.getCurrency();

        if (!currency || (typeof currency === 'object' && Object.keys(currency).length === 0)) {
          bar.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.5);">暂无货币</span>';
          return;
        }

        var html = '';
        for (var name in currency) {
          if (!currency.hasOwnProperty(name)) continue;
          var amount = currency[name];
          var meta = this._currencyMeta[name.toLowerCase()] || {};
          var icon = meta.icon || '\uD83D\uDCB0';
          var colorClass = meta.colorClass || '';

          html += '<div class="inv-currency-tag">';
          html += '<span class="inv-currency-icon">' + icon + '</span>';
          html += '<span class="inv-currency-val ' + this._escapeHtml(colorClass) + '">' + amount + '</span>';
          html += '</div>';
        }

        bar.innerHTML = html;
      } catch (e) {
        console.warn('[InventoryModule] 渲染货币栏失败:', e);
        bar.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.5);">加载失败</span>';
      }
    }

    // ==================== 视图切换 ====================

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      // 类型筛选只在物品视图显示
      const typeFilter = this._container?.querySelector('.inv-type-filter');
      if (typeFilter) {
        typeFilter.style.display = viewName === 'ITEMS' ? 'block' : 'none';
      }
      this._currentView = viewName;
    }

    async _handleTabSwitch(tab) {
      // 更新 Tab 高亮
      this._container?.querySelectorAll('[data-action^="tab-"]').forEach(btn => {
        btn.classList.toggle('inv-btn-active', btn.dataset.action === 'tab-' + tab);
      });

      this._showView(tab.toUpperCase());

      if (tab === 'items') {
        await this._renderItems();
      } else if (tab === 'equipment') {
        await this._renderEquipment();
      } else if (tab === 'currency') {
        await this._renderCurrency();
      }
    }

    // ==================== 物品视图 ====================

    async _renderItems() {
      const container = this._container?.querySelector('[data-view="ITEMS"]');
      if (!container) return;

      try {
        let items;
        if (this._currentTypeFilter) {
          items = await this._service.getItemsByType(this._currentTypeFilter);
        } else {
          items = await this._service.getItems();
        }

        container.innerHTML = '';

        // 动态生成类型筛选按钮
        await this._renderTypeFilter(items);

        if (!items || (typeof items === 'object' && Object.keys(items).length === 0) || (Array.isArray(items) && items.length === 0)) {
          container.innerHTML += '<div class="inv-empty">背包空空如也</div>';
          return;
        }

        const gridEl = document.createElement('div');
        gridEl.className = 'inv-grid';

        if (Array.isArray(items)) {
          items.forEach(item => {
            gridEl.appendChild(this._createGridItemElement(item, item.type || '', item.id || item.itemId));
          });
        } else {
          for (const [type, typeItems] of Object.entries(items)) {
            for (const [id, item] of Object.entries(typeItems)) {
              gridEl.appendChild(this._createGridItemElement(item, type, id));
            }
          }
        }

        container.appendChild(gridEl);
      } catch (e) {
        console.warn('[InventoryModule] 渲染物品失败:', e);
        container.innerHTML = '<div class="inv-error">加载失败，请重试</div>';
      }
    }

    _createGridItemElement(item, type, itemId) {
      const el = document.createElement('div');
      el.className = 'inv-grid-item';
      
      // 生成用途标签
      const usableIn = item.usableIn || [];
      const usageClass = usableIn.includes('gift') ? 'gift' : 
                        usableIn.includes('quest') ? 'quest' : 
                        usableIn.includes('consume') ? 'consume' : '';
      const usageText = usableIn.includes('gift') ? '可赠送' : 
                       usableIn.includes('quest') ? '任务' : 
                       usableIn.includes('consume') ? '可使用' : '';
      
      el.innerHTML = `
        <div class="inv-grid-icon" data-action="view-detail" data-type="${this._escapeHtml(type)}" data-item-id="${this._escapeHtml(itemId)}">${this._escapeHtml(item.name?.charAt(0) || '?')}</div>
        <div class="inv-grid-name">${this._escapeHtml(item.name)}</div>
        ${usageText ? `<div class="inv-item-usage ${usageClass}">${usageText}</div>` : ''}
        <span class="inv-grid-qty">x${item.quantity || 1}</span>
        <div class="inv-grid-actions">
          ${usableIn.includes('consume') || usableIn.includes('any') ? `<button class="inv-btn inv-btn-use" data-action="use-item" data-type="${this._escapeHtml(type)}" data-item-id="${this._escapeHtml(itemId)}">使用</button>` : ''}
          ${usableIn.includes('gift') || usableIn.includes('any') ? `<button class="inv-btn inv-btn-gift" data-action="gift-item" data-type="${this._escapeHtml(type)}" data-item-id="${this._escapeHtml(itemId)}">赠送</button>` : ''}
          <button class="inv-btn inv-btn-drop" data-action="drop-item" data-type="${this._escapeHtml(type)}" data-item-id="${this._escapeHtml(itemId)}">丢弃</button>
        </div>
      `;
      return el;
    }

    async _renderTypeFilter(items) {
      const filterContainer = this._container?.querySelector('.inv-type-filter');
      if (!filterContainer) return;

      try {
        // 如果有全部物品数据，提取类型列表
        if (!this._currentTypeFilter && items && typeof items === 'object' && !Array.isArray(items)) {
          const types = Object.keys(items);
          const typeNames = {
            'consumable': '消耗品',
            'equipment': '装备',
            'material': '材料',
            'quest': '任务',
            'gift': '礼物',
            'misc': '杂项',
          };
          filterContainer.innerHTML = '<button class="inv-btn inv-btn-type inv-btn-active" data-action="filter-type" data-type="">全部</button>';
          types.forEach(type => {
            filterContainer.innerHTML += `<button class="inv-btn inv-btn-type" data-action="filter-type" data-type="${this._escapeHtml(type)}">${this._escapeHtml(typeNames[type] || type)}</button>`;
          });
        }
      } catch (e) {
        console.warn('[InventoryModule] 渲染类型筛选失败:', e);
      }
    }

    // ==================== 装备视图 ====================

    async _renderEquipment() {
      const container = this._container?.querySelector('[data-view="EQUIPMENT"]');
      if (!container) return;

      try {
        const equipment = await this._service.getEquipment();
        container.innerHTML = '';

        const areaEl = document.createElement('div');
        areaEl.className = 'inv-equip-area';

        // Paper doll
        const dollEl = document.createElement('div');
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
          const emptyEl = document.createElement('div');
          emptyEl.className = 'inv-empty';
          emptyEl.textContent = '暂无装备';
          areaEl.appendChild(emptyEl);
          container.appendChild(areaEl);
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'inv-equip-list';

        const slotMap = {};
        if (Array.isArray(equipment)) {
          equipment.forEach(eq => {
            const slot = eq.slot || 'unknown';
            slotMap[slot] = eq;
            listEl.appendChild(this._createEquipElement(eq, slot));
          });
        } else {
          for (const [slot, eq] of Object.entries(equipment)) {
            slotMap[slot] = eq;
            listEl.appendChild(this._createEquipElement(eq, slot));
          }
        }

        // Mark filled slots on doll
        const slotPositionMap = { head: 'head', body: 'body', weapon: 'weapon', shield: 'shield', boots: 'boots', helmet: 'head', armor: 'body', sword: 'weapon' };
        for (const [slot, eq] of Object.entries(slotMap)) {
          const posKey = slotPositionMap[slot] || slot;
          const slotEl = dollEl.querySelector('.inv-slot-' + posKey);
          if (slotEl) {
            slotEl.classList.add('inv-slot-filled');
            slotEl.textContent = (eq.name || eq.itemName || '').charAt(0);
            slotEl.title = eq.name || eq.itemName || slot;
          }
        }

        areaEl.appendChild(listEl);
        container.appendChild(areaEl);
      } catch (e) {
        console.warn('[InventoryModule] 渲染装备失败:', e);
        container.innerHTML = '<div class="inv-error">加载失败，请重试</div>';
      }
    }

    _createEquipElement(eq, slot) {
      const el = document.createElement('div');
      el.className = 'inv-equip-item';
      el.innerHTML = `
        <div class="inv-equip-info">
          <span class="inv-equip-slot-label">${this._escapeHtml(slot)}</span>
          <span class="inv-equip-name">${this._escapeHtml(eq.name || eq.itemName || '空')}</span>
        </div>
        <button class="inv-btn inv-btn-unequip" data-action="unequip" data-slot="${this._escapeHtml(slot)}">卸下</button>
      `;
      return el;
    }

    // ==================== 货币视图 ====================

    async _renderCurrency() {
      const container = this._container?.querySelector('[data-view="CURRENCY"]');
      if (!container) return;

      try {
        const currency = await this._service.getCurrency();
        container.innerHTML = '';

        if (!currency || (typeof currency === 'object' && Object.keys(currency).length === 0)) {
          container.innerHTML = '<div class="inv-empty">暂无货币</div>';
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'inv-currency-list';

        for (const [name, amount] of Object.entries(currency)) {
          const el = document.createElement('div');
          el.className = 'inv-currency-item';
          el.innerHTML = `
            <span class="inv-currency-name">${this._escapeHtml(name)}</span>
            <span class="inv-currency-amount">${amount}</span>
          `;
          listEl.appendChild(el);
        }

        container.appendChild(listEl);

        const actionsEl = document.createElement('div');
        actionsEl.className = 'inv-currency-actions';
        actionsEl.innerHTML = '<button class="inv-btn" data-action="update-currency">更新货币</button>';
        container.appendChild(actionsEl);
      } catch (e) {
        console.warn('[InventoryModule] 渲染货币失败:', e);
        container.innerHTML = '<div class="inv-error">加载失败，请重试</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handleUseItem(type, itemId) {
      const count = await this._showInputModal('使用数量', '请输入使用数量（默认1）', '1');
      if (count === null) return;
      const num = parseInt(count, 10);
      if (isNaN(num) || num <= 0) return;

      try {
        const result = await this._service.useItem(type, itemId, num);
        if (result) {
          this.showToast('使用成功', 'success');
          await this._renderItems();
        } else {
          this.showToast('使用失败', 'error');
        }
      } catch (err) {
        console.error('[InventoryModule] 使用物品失败:', err);
        this.showToast('使用失败: ' + err.message, 'error');
      }
    }

    async _handleGiftItem(type, itemId) {
      try {
        // [v4.31.0-fix] 铁则一/三：通过 Service 层获取数据
        const friendService = this._platform?.get?.('friendService') || 
          (window.PhoneServices?.Friend ? new window.PhoneServices.Friend(this._platform) : null);
        
        if (!friendService) {
          this.showToast('好友服务未加载', 'error');
          return;
        }

        const friends = await friendService.getList();
        const npcList = friends.filter(f => f.isNPC || (f.id && String(f.id).startsWith('npc')));

        if (npcList.length === 0) {
          this.showToast('暂无可用NPC', 'error');
          return;
        }

        // 显示NPC选择弹窗
        const npcId = await this._showNPCSelectModal(npcList);
        if (!npcId) return;

        // [v4.31.0-fix] 铁则一/三：通过 Service 层调用赠送功能
        const shopService = this._platform?.get?.('shopService') ||
          (window.PhoneServices?.Shop ? new window.PhoneServices.Shop(this._platform) : null);
        
        if (!shopService) {
          this.showToast('商店服务未加载', 'error');
          return;
        }

        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const result = await shopService.giftItem(charId, itemId, npcId);

        if (result.ok) {
          this.showToast(result.message, 'success');
          await this._renderItems();
        } else {
          this.showToast('赠送失败', 'error');
        }
      } catch (err) {
        console.error('[InventoryModule] 赠送物品失败:', err);
        this.showToast('赠送失败: ' + err.message, 'error');
      }
    }

    async _handleDropItem(type, itemId) {
      const confirmed = await this._showConfirmModal('确定丢弃该物品吗？');
      if (!confirmed) return;

      try {
        const result = await this._service.useItem(type, itemId, 9999); // 使用全部数量来丢弃
        if (result) {
          this.showToast('已丢弃', 'success');
          await this._renderItems();
        } else {
          this.showToast('丢弃失败', 'error');
        }
      } catch (err) {
        console.error('[InventoryModule] 丢弃物品失败:', err);
        this.showToast('丢弃失败: ' + err.message, 'error');
      }
    }

    async _handleViewDetail(type, itemId) {
      try {
        const items = await this._service.getItems();
        const item = items[type]?.[itemId];
        
        if (!item) {
          this.showToast('物品不存在', 'error');
          return;
        }

        // 显示详情弹窗
        const overlay = document.createElement('div');
        overlay.className = 'inv-modal-overlay';
        
        // 生成效果列表
        const effectsHtml = (item.effects || []).map(e => 
          `<div class="inv-detail-effect-item">${e.type}: +${e.value}</div>`
        ).join('');
        
        // 生成来源信息
        const sourceText = item.source === 'shop' ? '商店购买' : 
                          item.source === 'quest' ? '任务奖励' : 
                          item.source || '未知来源';
        
        // 生成用途标签
        const usableIn = item.usableIn || [];
        const usageText = usableIn.includes('gift') ? '可赠送给NPC' : 
                         usableIn.includes('quest') ? '任务道具' : 
                         usableIn.includes('consume') ? '可消耗使用' : '普通物品';

        overlay.innerHTML = `
          <div class="inv-detail-modal">
            <div class="inv-detail-header">
              <div class="inv-detail-icon">${this._escapeHtml((item.name || '').charAt(0))}</div>
              <div class="inv-detail-info">
                <h4>${this._escapeHtml(item.name)}</h4>
                <div class="inv-detail-source">来源: ${sourceText} | 数量: ${item.quantity || 1}</div>
                <div style="font-size: 12px; color: #888;">${usageText}</div>
              </div>
            </div>
            <div class="inv-detail-desc">${this._escapeHtml(item.description || '暂无描述')}</div>
            ${effectsHtml ? `<div class="inv-detail-effects"><h5>效果</h5>${effectsHtml}</div>` : ''}
            <div class="inv-detail-actions">
              ${usableIn.includes('consume') || usableIn.includes('any') ? `<button class="inv-detail-use" data-action="modal-use">使用</button>` : ''}
              ${usableIn.includes('gift') || usableIn.includes('any') ? `<button class="inv-detail-gift" data-action="modal-gift">赠送</button>` : ''}
              <button class="inv-detail-drop" data-action="modal-drop">丢弃</button>
              <button class="inv-detail-close" data-action="modal-close">关闭</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 绑定弹窗事件
        overlay.querySelector('[data-action="modal-close"]')?.addEventListener('click', () => {
          overlay.remove();
        });
        
        overlay.querySelector('[data-action="modal-use"]')?.addEventListener('click', async () => {
          overlay.remove();
          await this._handleUseItem(type, itemId);
        });
        
        overlay.querySelector('[data-action="modal-gift"]')?.addEventListener('click', async () => {
          overlay.remove();
          await this._handleGiftItem(type, itemId);
        });
        
        overlay.querySelector('[data-action="modal-drop"]')?.addEventListener('click', async () => {
          overlay.remove();
          await this._handleDropItem(type, itemId);
        });
        
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.remove();
        });
        
      } catch (err) {
        console.error('[InventoryModule] 查看详情失败:', err);
        this.showToast('加载详情失败', 'error');
      }
    }

    async _handleEquipItem(type, itemId) {
      const slot = await this._showInputModal('装备槽位', '请输入装备槽位', '');
      if (!slot?.trim()) return;

      try {
        const result = await this._service.equipItem(type, itemId, slot.trim());
        if (result) {
          this.showToast('装备成功', 'success');
          await this._renderItems();
          await this._renderEquipment();
        } else {
          this.showToast('装备失败', 'error');
        }
      } catch (err) {
        console.error('[InventoryModule] 装备物品失败:', err);
        this.showToast('装备失败: ' + err.message, 'error');
      }
    }

    async _handleUnequipItem(slot) {
      try {
        const result = await this._service.unequipItem(slot);
        if (result) {
          this.showToast('已卸下', 'success');
          await this._renderEquipment();
          await this._renderItems();
        } else {
          this.showToast('卸下失败', 'error');
        }
      } catch (err) {
        console.error('[InventoryModule] 卸下装备失败:', err);
        this.showToast('卸下失败: ' + err.message, 'error');
      }
    }

    async _handleUpdateCurrency() {
      const jsonStr = await this._showInputModal('更新货币', '货币数据 (JSON格式, 如 {"gold": 100})', '{"gold": 100}');
      if (!jsonStr?.trim()) return;

      try {
        const currency = JSON.parse(jsonStr.trim());
        const result = await this._service.updateCurrency(currency);
        if (result) {
          this.showToast('货币已更新', 'success');
          await this._renderCurrency();
        } else {
          this.showToast('更新失败', 'error');
        }
      } catch (err) {
        console.error('[InventoryModule] 更新货币失败:', err);
        this.showToast('更新失败: ' + err.message, 'error');
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsubItems = this._service.subscribeItems(() => {
          if (this._currentView === 'ITEMS') {
            this._renderItems();
          }
        });
        if (unsubItems) this._unsubscribers.push(unsubItems);
      } catch (e) {
        console.warn('[InventoryModule] 订阅物品数据失败:', e);
      }

      try {
        const unsubEquip = this._service.subscribeEquipment(() => {
          if (this._currentView === 'EQUIPMENT') {
            this._renderEquipment();
          }
        });
        if (unsubEquip) this._unsubscribers.push(unsubEquip);
      } catch (e) {
        console.warn('[InventoryModule] 订阅装备数据失败:', e);
      }

      try {
        const bus = window.Platform?.eventBus;
        if (bus) {
          const refreshGold = () => this._renderCurrencyBar();
          ['economy:spent', 'economy:credited', 'shop:checkoutCompleted', 'live:giftSent', 'quest:completed'].forEach((ev) => {
            const fn = () => refreshGold();
            bus.on(ev, fn);
            this._unsubscribers.push(() => { try { bus.off(ev, fn); } catch (_) {} });
          });
        }
      } catch (_) {}
    }

    // ==================== 辅助方法 ====================

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    _showInputModal(title, placeholder, defaultValue) {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'inv-modal-overlay';
        overlay.innerHTML = `
          <div class="inv-modal-box">
            <div class="inv-modal-title">${this._escapeHtml(title)}</div>
            <input class="inv-modal-input" type="text" placeholder="${this._escapeHtml(placeholder)}" value="${this._escapeHtml(defaultValue || '')}" />
            <div class="inv-modal-actions">
              <button class="inv-modal-btn inv-modal-cancel">取消</button>
              <button class="inv-modal-btn inv-modal-confirm">确定</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('.inv-modal-input');
        const cancelBtn = overlay.querySelector('.inv-modal-cancel');
        const confirmBtn = overlay.querySelector('.inv-modal-confirm');

        const cleanup = (val) => {
          overlay.remove();
          resolve(val);
        };

        cancelBtn.addEventListener('click', () => cleanup(null));
        confirmBtn.addEventListener('click', () => cleanup(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') cleanup(input.value);
          if (e.key === 'Escape') cleanup(null);
        });
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cleanup(null);
        });

        setTimeout(() => input.focus(), 50);
      });
    }

    _showConfirmModal(message) {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'inv-modal-overlay';
        overlay.innerHTML = `
          <div class="inv-modal-box">
            <div class="inv-modal-title">${this._escapeHtml(message)}</div>
            <div class="inv-modal-actions">
              <button class="inv-modal-btn inv-modal-cancel">取消</button>
              <button class="inv-modal-btn inv-modal-confirm">确定</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('.inv-modal-cancel');
        const confirmBtn = overlay.querySelector('.inv-modal-confirm');

        const cleanup = (val) => {
          overlay.remove();
          resolve(val);
        };

        cancelBtn.addEventListener('click', () => cleanup(false));
        confirmBtn.addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cleanup(false);
        });
      });
    }

    async _showNPCSelectModal(npcList) {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'inv-modal-overlay';
        
        const npcItems = npcList.map(npc => `
          <div class="inv-npc-item" data-npc-id="${this._escapeHtml(npc.id)}">
            <span>${this._escapeHtml(npc.name || npc.id)}</span>
          </div>
        `).join('');
        
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
        document.body.appendChild(overlay);

        // 绑定NPC选择事件
        overlay.querySelectorAll('.inv-npc-item').forEach(item => {
          item.addEventListener('click', () => {
            const npcId = item.dataset.npcId;
            overlay.remove();
            resolve(npcId);
          });
        });

        const cancelBtn = overlay.querySelector('.inv-modal-cancel');
        cancelBtn.addEventListener('click', () => {
          overlay.remove();
          resolve(null);
        });

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            overlay.remove();
            resolve(null);
          }
        });
      });
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new InventoryModule();
      return {
        id: instance.id,
        name: instance.name,
        icon: instance.icon,
        iconBg: instance.iconBg,
        init: (phone, params) => instance.init(phone, params),
        resume: (params) => instance.resume(params),
        pause: () => instance.pause(),
        destroy: () => instance.destroy(),
        render: () => instance.render(),
      };
    }
  }

  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Inventory = InventoryModule;

  console.log('[Module] InventoryModule 已加载 (Phase 5 增强版)');
})();
