/**
 * @layer Renderer
 * @file   shop-renderer.js
 *
 * 职责: 商店模块 UI 渲染
 * 禁止: 包含业务逻辑、调用 Service、直接操作 Schema
 *
 * 铁则合规：
 *   - 纯展示层，只接收数据对象返回 DOM（铁则三）
 *   - CSS 类名以 shop- 前缀隔离（铁则二十一）
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

  // ==================== Renderer 类 ====================

  class ShopRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      const style = document.createElement('style');
      style.id = 'shop-module-styles';
      style.textContent = `
        /* ===== shop-app: Game Store Style ===== */
        .shop-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
          color: #333;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* ===== shop-header ===== */
        .shop-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          padding: 12px 16px;
          flex-shrink: 0;
        }
        .shop-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .shop-btn-ai {
          background: rgba(255,255,255,0.2);
          color: #fff;
          border: none;
          border-radius: 14px;
          padding: 4px 10px;
          font-size: 12px;
          cursor: pointer;
          backdrop-filter: blur(4px);
        }
        .shop-btn-ai:active { opacity: 0.8; }
        .shop-notice-bar {
          background: linear-gradient(90deg, #fff3e0, #ffe0b2);
          padding: 8px 16px;
          font-size: 12px;
          color: #e65100;
          cursor: pointer;
          text-align: center;
        }
        .shop-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .shop-btn-cart {
          position: relative;
          padding: 5px 12px;
          border: 1px solid rgba(255,255,255,0.5);
          border-radius: 14px;
          background: rgba(255,255,255,0.15);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          backdrop-filter: blur(4px);
        }
        .shop-btn-cart:active {
          background: rgba(255,255,255,0.3);
        }
        .shop-cart-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #FFD700;
          color: #333;
          font-size: 10px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        /* ===== shop-search-bar ===== */
        .shop-search-bar {
          display: flex;
          align-items: center;
          background: #fff;
          padding: 8px 12px;
          flex-shrink: 0;
          gap: 8px;
        }
        .shop-search-input {
          flex: 1;
          height: 34px;
          border: none;
          border-radius: 17px;
          background: #f0f0f0;
          padding: 0 14px;
          font-size: 14px;
          color: #333;
          outline: none;
        }
        .shop-search-input::placeholder {
          color: #aaa;
        }
        .shop-search-input:focus {
          background: #e8e8e8;
        }

        /* ===== shop-category-bar ===== */
        .shop-category-bar {
          display: flex;
          gap: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          background: #FFFFFF;
          padding: 0 8px;
          flex-shrink: 0;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
        }
        .shop-category-bar::-webkit-scrollbar {
          display: none;
        }

        /* ===== shop-btn-cat ===== */
        .shop-btn-cat {
          flex-shrink: 0;
          padding: 10px 14px;
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 400;
          color: #666;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
          white-space: nowrap;
        }
        .shop-btn-cat:active {
          opacity: 0.7;
        }
        .shop-btn-active {
          color: #e74c3c !important;
          font-weight: 700 !important;
        }
        .shop-btn-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 3px;
          border-radius: 2px;
          background: #e74c3c;
        }

        /* ===== shop-views ===== */
        .shop-views {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .shop-view {
          padding: 0;
        }

        /* ===== shop-grid: 2-column product grid ===== */
        .shop-grid {
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        /* ===== shop-grid-item ===== */
        .shop-grid-item {
          background: #FFFFFF;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          transition: transform 0.12s;
          display: flex;
          flex-direction: column;
        }
        .shop-grid-item:active {
          transform: scale(0.97);
        }

        /* ===== shop-grid-cover ===== */
        .shop-grid-cover {
          width: 100%;
          aspect-ratio: 1;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          color: rgba(255,255,255,0.8);
        }

        /* ===== shop-grid-info ===== */
        .shop-grid-info {
          padding: 8px 10px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        /* ===== shop-grid-name ===== */
        .shop-grid-name {
          font-size: 13px;
          font-weight: 600;
          color: #1A1A1A;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ===== shop-grid-bottom ===== */
        .shop-grid-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
        }

        /* ===== shop-grid-price ===== */
        .shop-grid-price {
          font-size: 16px;
          font-weight: 700;
          color: #e74c3c;
          line-height: 1;
        }
        .shop-grid-currency {
          font-size: 11px;
          font-weight: 400;
          color: #999;
        }

        /* ===== shop-item-tags ===== */
        .shop-item-tags {
          display: flex;
          gap: 4px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .shop-item-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #f0f0f0;
          color: #666;
        }
        .shop-item-tag.gift { background: #ffe0e0; color: #c0392b; }
        .shop-item-tag.quest { background: #e0f0ff; color: #2980b9; }
        .shop-item-tag.consume { background: #e0ffe0; color: #27ae60; }

        /* ===== shop-item-usage ===== */
        .shop-item-usage {
          font-size: 11px;
          color: #888;
          margin-top: 4px;
          font-style: italic;
        }

        /* ===== shop-btn-add ===== */
        .shop-btn-add {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #e74c3c;
          color: #fff;
          font-size: 18px;
          font-weight: 300;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(231,76,60,0.35);
          transition: transform 0.12s;
          padding: 0;
          line-height: 1;
        }
        .shop-btn-add:active {
          transform: scale(0.9);
        }

        /* ===== shop-btn-buy ===== */
        .shop-btn-buy {
          flex-shrink: 0;
          padding: 4px 10px;
          border: none;
          border-radius: 12px;
          background: #27ae60;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.12s;
        }
        .shop-btn-buy:active {
          transform: scale(0.9);
        }

        /* ===== shop-empty / shop-error ===== */
        .shop-empty,
        .shop-error {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          text-align: center;
          color: #999;
          font-size: 15px;
        }

        /* ===== shop-cart-header ===== */
        .shop-cart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #FFFFFF;
          border-bottom: 0.5px solid rgba(0,0,0,0.06);
          flex-shrink: 0;
        }
        .shop-cart-title {
          font-size: 17px;
          font-weight: 700;
          color: #000;
          margin: 0;
        }
        .shop-cart-header .shop-btn {
          background: none;
          border: none;
          font-size: 14px;
          color: #007AFF;
          cursor: pointer;
          padding: 6px 4px;
        }
        .shop-btn-clear {
          color: #e74c3c !important;
          font-weight: 500;
        }

        /* ===== shop-cart-list ===== */
        .shop-cart-list {
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* ===== shop-cart-item ===== */
        .shop-cart-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #FFFFFF;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }

        /* ===== shop-cart-item-info ===== */
        .shop-cart-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .shop-cart-item-name {
          font-size: 15px;
          font-weight: 600;
          color: #1A1A1A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .shop-cart-item-qty {
          font-size: 13px;
          color: #666;
        }
        .shop-cart-item-price {
          font-size: 15px;
          font-weight: 700;
          color: #e74c3c;
        }

        /* ===== shop-cart-item-actions ===== */
        .shop-cart-item-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          margin-left: 12px;
        }

        /* ===== shop-btn-qty ===== */
        .shop-btn-qty {
          padding: 6px 10px;
          border: 1px solid #DDD;
          border-radius: 8px;
          background: #fff;
          color: #333;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
        }
        .shop-btn-qty:active {
          background: #f5f5f5;
          border-color: #CCC;
        }

        /* ===== shop-btn-remove ===== */
        .shop-btn-remove {
          padding: 6px 10px;
          border: 1px solid #e74c3c;
          border-radius: 8px;
          background: #fff;
          color: #e74c3c;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
        }
        .shop-btn-remove:active {
          background: #FFF0F0;
        }

        /* ===== shop-cart-footer ===== */
        .shop-cart-footer {
          padding: 12px 16px;
          background: #FFFFFF;
          border-top: 0.5px solid rgba(0,0,0,0.06);
          flex-shrink: 0;
        }

        /* ===== shop-btn-checkout ===== */
        .shop-btn-checkout {
          display: block;
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: 24px;
          background: #e74c3c;
          color: #FFFFFF;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
          letter-spacing: 1px;
        }
        .shop-btn-checkout:active {
          opacity: 0.8;
        }

        /* ===== 通用 shop-btn 重置 ===== */
        .shop-btn {
          font-family: inherit;
        }

        /* ===== shop-ai-recommend ===== */
        .shop-ai-recommend {
          background: linear-gradient(135deg, #667eea22, #764ba222);
          border-radius: 12px;
          padding: 12px;
          margin: 8px 12px;
          border: 1px solid #667eea33;
        }

        /* ===== Inline Modal ===== */
        .shop-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        /* ===== shop-btn-refresh: 刷新按钮 ===== */
        .shop-btn-refresh {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.2);
          color: #fff;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          flex-shrink: 0;
        }
        .shop-btn-refresh:active {
          transform: scale(0.9);
        }
        .shop-btn-refresh.loading {
          animation: shop-spin 1s linear infinite;
        }
        @keyframes shop-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ===== shop-loading: 加载遮罩 ===== */
        .shop-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(245, 245, 245, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .shop-loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(231,76,60,0.15);
          border-top-color: #e74c3c;
          border-radius: 50%;
          animation: shop-spin 0.8s linear infinite;
        }
        .shop-modal-box {
          background: #fff;
          border-radius: 14px;
          padding: 20px;
          width: 280px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        .shop-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #1C1C1E;
          margin: 0 0 12px;
        }
        .shop-modal-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 14px;
        }
        .shop-modal-input:focus {
          border-color: #e74c3c;
        }
        .shop-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .shop-modal-btn {
          padding: 8px 18px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .shop-modal-cancel {
          background: #eee;
          color: #555;
        }
        .shop-modal-confirm {
          background: #e74c3c;
          color: #fff;
        }

        /* ===== shop-item-detail-modal ===== */
        .shop-detail-modal {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          width: 300px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }
        .shop-detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .shop-detail-icon {
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
        .shop-detail-info h4 {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 700;
        }
        .shop-detail-price {
          font-size: 18px;
          font-weight: 700;
          color: #e74c3c;
        }
        .shop-detail-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .shop-detail-effects {
          background: #f8f8f8;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .shop-detail-effects h5 {
          margin: 0 0 8px;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
        }
        .shop-detail-effect-item {
          font-size: 13px;
          color: #333;
          padding: 4px 0;
          border-bottom: 1px solid #eee;
        }
        .shop-detail-effect-item:last-child {
          border-bottom: none;
        }
        .shop-detail-actions {
          display: flex;
          gap: 8px;
        }
        .shop-detail-actions button {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .shop-detail-buy {
          background: #e74c3c;
          color: #fff;
        }
        .shop-detail-gift {
          background: #f0f0f0;
          color: #333;
        }
      `;
      document.head.appendChild(style);
      this._stylesInjected = true;
    }

    // ==================== 主渲染 ====================

    /**
     * 渲染商店主界面
     * @returns {string} HTML 字符串
     */
    renderApp() {
      this.injectStyles();
      return `
        <div class="shop-app">
          <div class="shop-header">
            <h3 class="shop-title">商店</h3>
            <div class="shop-header-actions">
              <button class="shop-btn shop-btn-refresh" data-action="refresh" title="刷新">\u21BB</button>
              <button class="shop-btn shop-btn-ai" data-action="ai-recommend" title="AI 推荐">AI 推荐</button>
              <button class="shop-btn shop-btn-cart" data-action="show-cart">
                购物车
                <span class="shop-cart-badge" data-ref="shop-cart-badge" style="display:none;">0</span>
              </button>
            </div>
          </div>
          <div class="shop-search-bar">
            <input class="shop-search-input" type="text" placeholder="搜索商品..." data-action="search" />
          </div>
          <div class="shop-notice-bar" data-action="ai-notice" data-ref="shopNoticeBar" style="display:none;"></div>
          <div class="shop-category-bar">
            <button class="shop-btn shop-btn-cat shop-btn-active" data-action="cat-all">全部</button>
          </div>
          <div class="shop-views">
            <div class="shop-view" data-view="PRODUCTS"></div>
            <div class="shop-view" data-view="CART" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    // ==================== 商品视图 ====================

    /**
     * 渲染商品列表
     * @param {Object} products - 商品数据 { category: { id: product } }
     * @returns {HTMLElement} 商品网格容器
     */
    renderProducts(products) {
      var gridEl = document.createElement('div');
      gridEl.className = 'shop-grid';

      if (!products || (typeof products === 'object' && Object.keys(products).length === 0)) {
        gridEl.innerHTML = '<div class="shop-empty">暂无商品</div>';
        return gridEl;
      }

      for (var category in products) {
        if (!products.hasOwnProperty(category)) continue;
        var categoryProducts = products[category];
        for (var id in categoryProducts) {
          if (!categoryProducts.hasOwnProperty(id)) continue;
          var el = this.renderProductCard(category, id, categoryProducts[id]);
          gridEl.appendChild(el);
        }
      }

      return gridEl;
    }

    /**
     * 渲染单个商品卡片
     * @param {string} category - 分类
     * @param {string} id - 商品 ID
     * @param {Object} product - 商品数据
     * @returns {HTMLElement}
     */
    renderProductCard(category, id, product) {
      var el = document.createElement('div');
      el.className = 'shop-grid-item';

      var usableIn = product.usableIn || [];
      var tagsHtml = this.renderUsageTags(usableIn);
      var usageHint = this._generateUsageHint(usableIn, product);

      el.innerHTML = `
        <div class="shop-grid-cover" data-action="view-detail" data-category="${escapeHtml(category)}" data-product-id="${escapeHtml(id)}">${escapeHtml((product.name || '').charAt(0))}</div>
        <div class="shop-grid-info">
          <div class="shop-grid-name">${escapeHtml(product.name)}</div>
          ${tagsHtml}
          ${usageHint ? '<div class="shop-item-usage">' + escapeHtml(usageHint) + '</div>' : ''}
          <div class="shop-grid-bottom">
            <div>
              <span class="shop-grid-price">${product.price}</span>
              <span class="shop-grid-currency"> ${escapeHtml(product.currency || 'gold')}</span>
            </div>
            <button class="shop-btn shop-btn-add" data-action="add-to-cart" data-category="${escapeHtml(category)}" data-product-id="${escapeHtml(id)}">+</button>
          </div>
        </div>
      `;
      return el;
    }

    /**
     * 渲染用途标签
     * @param {Array} usableIn - 用途数组
     * @returns {string} HTML 字符串
     */
    renderUsageTags(usableIn) {
      if (!usableIn || usableIn.length === 0) return '';

      var tagMap = {
        'gift': { label: '可赠送', cls: 'gift' },
        'quest': { label: '任务', cls: 'quest' },
        'consume': { label: '可使用', cls: 'consume' },
      };

      var tags = usableIn
        .filter(function (u) { return u !== 'any' && tagMap[u]; })
        .map(function (u) { return '<span class="shop-item-tag ' + tagMap[u].cls + '">' + tagMap[u].label + '</span>'; })
        .join('');

      return tags ? '<div class="shop-item-tags">' + tags + '</div>' : '';
    }

    /**
     * 渲染分类栏
     * @param {Object} products - 商品数据
     * @returns {string} HTML 字符串
     */
    renderCategoryBar(products) {
      if (!products || typeof products !== 'object') return '';

      var categories = Object.keys(products);
      var catNames = {
        'gift': '礼物',
        'consumable': '道具',
        'equipment': '装备',
        'material': '材料',
        'collectible': '收藏',
      };

      var html = '<button class="shop-btn shop-btn-cat shop-btn-active" data-action="cat-all">全部</button>';
      categories.forEach(function (cat) {
        var displayName = catNames[cat] || cat;
        html += '<button class="shop-btn shop-btn-cat" data-action="cat-' + escapeHtml(cat) + '">' + escapeHtml(displayName) + '</button>';
      });
      return html;
    }

    // ==================== 购物车视图 ====================

    /**
     * 渲染购物车
     * @param {Array} cartItems - 购物车商品列表
     * @returns {Array<HTMLElement>} 购物车子元素数组
     */
    renderCart(cartItems) {
      var elements = [];

      // 头部
      var headerEl = document.createElement('div');
      headerEl.className = 'shop-cart-header';
      headerEl.innerHTML = `
        <button class="shop-btn" data-action="back">&larr; 返回商店</button>
        <h4 class="shop-cart-title">购物车</h4>
        <button class="shop-btn shop-btn-clear" data-action="clear-cart">清空</button>
      `;
      elements.push(headerEl);

      if (!cartItems || cartItems.length === 0) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'shop-empty';
        emptyEl.textContent = '购物车为空';
        elements.push(emptyEl);
        return elements;
      }

      // 列表
      var listEl = document.createElement('div');
      listEl.className = 'shop-cart-list';

      cartItems.forEach(function (item) {
        var el = document.createElement('div');
        el.className = 'shop-cart-item';
        el.innerHTML = `
          <div class="shop-cart-item-info">
            <div class="shop-cart-item-name">${escapeHtml(item.name)}</div>
            <div class="shop-cart-item-qty">x${item.quantity || 1}</div>
            <div class="shop-cart-item-price">${item.price || 0} ${escapeHtml(item.currency || 'gold')}</div>
          </div>
          <div class="shop-cart-item-actions">
            <button class="shop-btn shop-btn-qty" data-action="update-qty" data-cart-item-id="${escapeHtml(item.id || item.cartItemId)}">修改数量</button>
            <button class="shop-btn shop-btn-remove" data-action="remove-from-cart" data-cart-item-id="${escapeHtml(item.id || item.cartItemId)}">移除</button>
          </div>
        `;
        listEl.appendChild(el);
      });

      elements.push(listEl);

      // 底部结算按钮
      var footerEl = document.createElement('div');
      footerEl.className = 'shop-cart-footer';
      footerEl.innerHTML = '<button class="shop-btn shop-btn-checkout" data-action="checkout">结算</button>';
      elements.push(footerEl);

      return elements;
    }

    // ==================== 弹窗渲染 ====================

    /**
     * 渲染输入弹窗
     * @param {string} title - 标题
     * @param {string} placeholder - 输入框占位符
     * @param {string} defaultValue - 默认值
     * @returns {HTMLElement} overlay 元素
     */
    renderInputModal(title, placeholder, defaultValue) {
      var overlay = document.createElement('div');
      overlay.className = 'shop-modal-overlay';
      overlay.innerHTML = `
        <div class="shop-modal-box">
          <div class="shop-modal-title">${escapeHtml(title)}</div>
          <input class="shop-modal-input" type="text" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue || '')}" />
          <div class="shop-modal-actions">
            <button class="shop-modal-btn shop-modal-cancel">取消</button>
            <button class="shop-modal-btn shop-modal-confirm">确定</button>
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
      overlay.className = 'shop-modal-overlay';
      overlay.innerHTML = `
        <div class="shop-modal-box">
          <div class="shop-modal-title">${escapeHtml(message)}</div>
          <div class="shop-modal-actions">
            <button class="shop-modal-btn shop-modal-cancel">取消</button>
            <button class="shop-modal-btn shop-modal-confirm">确定</button>
          </div>
        </div>
      `;
      return overlay;
    }

    /**
     * 渲染商品详情弹窗
     * @param {Object} product - 商品数据
     * @returns {HTMLElement} overlay 元素
     */
    renderItemDetail(product) {
      var overlay = document.createElement('div');
      overlay.className = 'shop-modal-overlay';

      var effectsHtml = (product.effects || []).map(function (e) {
        return '<div class="shop-detail-effect-item">' + e.type + ': +' + e.value + '</div>';
      }).join('');

      var usableIn = product.usableIn || [];
      var usageText = usableIn.includes('gift') ? '可赠送' :
                     usableIn.includes('quest') ? '任务道具' :
                     usableIn.includes('consume') ? '可消耗' : '普通物品';

      overlay.innerHTML = `
        <div class="shop-detail-modal">
          <div class="shop-detail-header">
            <div class="shop-detail-icon">${escapeHtml((product.name || '').charAt(0))}</div>
            <div class="shop-detail-info">
              <h4>${escapeHtml(product.name)}</h4>
              <div class="shop-detail-price">${product.price} ${escapeHtml(product.currency || 'gold')}</div>
              <div style="font-size: 12px; color: #888;">${usageText}</div>
            </div>
          </div>
          <div class="shop-detail-desc">${escapeHtml(product.description || '暂无描述')}</div>
          ${effectsHtml ? '<div class="shop-detail-effects"><h5>效果</h5>' + effectsHtml + '</div>' : ''}
          <div class="shop-detail-actions">
            <button class="shop-detail-buy" data-action="modal-buy">立即购买</button>
            <button class="shop-detail-gift" data-action="modal-close">关闭</button>
          </div>
        </div>
      `;
      return overlay;
    }

    // ==================== 内部工具方法 ====================

    /**
     * 生成用途提示文本（纯展示逻辑）
     */
    _generateUsageHint(usableIn, product) {
      if (!usableIn || usableIn.length === 0) return '';

      if (usableIn.includes('gift')) {
        return '可赠送给NPC';
      }
      if (usableIn.includes('quest')) {
        return product.questName ? '任务"' + product.questName + '"所需' : '任务所需道具';
      }
      if (usableIn.includes('consume')) {
        return '点击使用';
      }
      return '';
    }
  }

  // ==================== 导出 ====================

  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Shop = ShopRenderer;

  console.log('[Renderer] ShopRenderer 已加载');
})();
