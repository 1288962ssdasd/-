/**
 * ShopModule - 商店模块
 * 职责：生命周期管理、事件绑定、调用 Service
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Shop
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 shop- 前缀隔离
 */

;(function () {
  'use strict';

  class ShopModule extends PhoneApp {
    constructor() {
      super({
        id: 'shop',
        name: '商店',
        icon: '\uD83C\uDFEA',
        iconBg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      });
      this._service = null;
      this._unsubscribers = [];
      this._currentView = 'PRODUCTS'; // PRODUCTS | CART
      this._currentCategory = '';
      this._isLoading = false;
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Shop(window.Platform);

      // ST5层联动：监听大世界层级更新
      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      if (this._platform?.eventBus) {
        const unsub = this._platform.eventBus.on('world:stageUpdated', async (payload) => {
          console.log(`[${this.id}] 收到世界层级更新事件:`, payload);
          await this._handleWorldUpdate(payload);
        });
        if (unsub) this._unsubscribers.push(unsub);
      }
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (document.getElementById('shop-module-styles')) return;
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
    }

    onRender() {
      this._injectStyles();
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

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 刷新按钮
          if (e.target.closest('[data-action="refresh"]')) {
            await this._handleManualRefresh();
            return;
          }

          // 分类切换
          const catBtn = e.target.closest('[data-action^="cat-"]');
          if (catBtn) {
            const category = catBtn.dataset.action.replace('cat-', '');
            await this._handleCategorySwitch(category);
            return;
          }

          // 购物车
          if (e.target.closest('[data-action="show-cart"]')) {
            await this._showCartView();
            return;
          }

          // 返回商品列表
          if (e.target.closest('[data-action="back"]')) {
            await this._showProductsView();
            return;
          }

          // 加入购物车
          if (e.target.closest('[data-action="add-to-cart"]')) {
            const target = e.target.closest('[data-action]');
            const category = target.dataset.category;
            const productId = target.dataset.productId;
            await this._handleAddToCart(category, productId);
            return;
          }

          // 直接购买
          if (e.target.closest('[data-action="buy-now"]')) {
            const target = e.target.closest('[data-action]');
            const productId = target.dataset.productId;
            await this._handleBuyNow(productId);
            return;
          }

          // 查看商品详情
          if (e.target.closest('[data-action="view-detail"]')) {
            const target = e.target.closest('[data-action]');
            const category = target.dataset.category;
            const productId = target.dataset.productId;
            await this._handleViewDetail(category, productId);
            return;
          }

          // 从购物车移除
          if (e.target.closest('[data-action="remove-from-cart"]')) {
            const cartItemId = e.target.closest('[data-action]').dataset.cartItemId;
            await this._handleRemoveFromCart(cartItemId);
            return;
          }

          // 更新购物车数量
          if (e.target.closest('[data-action="update-qty"]')) {
            const target = e.target.closest('[data-action]');
            const cartItemId = target.dataset.cartItemId;
            await this._handleUpdateCartQuantity(cartItemId);
            return;
          }

          // 清空购物车
          if (e.target.closest('[data-action="clear-cart"]')) {
            await this._handleClearCart();
            return;
          }

          // 结算
          if (e.target.closest('[data-action="checkout"]')) {
            await this._handleCheckout();
            return;
          }

          // AI 推荐
          if (e.target.closest('[data-action="ai-recommend"]')) {
            await this._handleAIRecommend();
            return;
          }

          // AI 活动横幅点击刷新
          if (e.target.closest('[data-action="ai-notice"]')) {
            await this._loadAINotice();
            return;
          }
        });

        this._subscribeData();
        this._renderProducts();
        this._loadAINotice();
      }, 0);
    }

    // ==================== 视图切换 ====================

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      // 分类栏只在商品视图显示
      const catBar = this._container?.querySelector('.shop-category-bar');
      if (catBar) {
        catBar.style.display = viewName === 'PRODUCTS' ? 'block' : 'none';
      }
      this._currentView = viewName;
    }

    async _showProductsView() {
      this._showView('PRODUCTS');
      await this._renderProducts();
    }

    async _showCartView() {
      this._showView('CART');
      await this._renderCart();
    }

    // ==================== 商品视图 ====================

    async _renderProducts() {
      const container = this._container?.querySelector('[data-view="PRODUCTS"]');
      if (!container) return;

      try {
        let products;
        if (this._currentCategory) {
          products = await this._service.getProductsByCategory(this._currentCategory);
        } else {
          products = await this._service.getProducts();
        }

        container.innerHTML = '';

        // 动态生成分类按钮
        await this._renderCategoryBar(products);

        if (!products || Object.keys(products).length === 0) {
          container.innerHTML += '<div class="shop-empty">暂无商品</div>';
          return;
        }

        const gridEl = document.createElement('div');
        gridEl.className = 'shop-grid';

        for (const [category, categoryProducts] of Object.entries(products)) {
          for (const [id, product] of Object.entries(categoryProducts)) {
            const el = this._createProductElement(category, id, product);
            gridEl.appendChild(el);
          }
        }

        container.appendChild(gridEl);
      } catch (e) {
        console.warn('[ShopModule] 渲染商品失败:', e);
        container.innerHTML = '<div class="shop-error">加载失败，请重试</div>';
      }
    }

    _createProductElement(category, id, product) {
      const el = document.createElement('div');
      el.className = 'shop-grid-item';
      
      // 生成用途标签
      const usableIn = product.usableIn || [];
      const tagsHtml = this._generateUsageTags(usableIn);
      
      // 生成用途提示
      const usageHint = this._generateUsageHint(usableIn, product);
      
      el.innerHTML = `
        <div class="shop-grid-cover" data-action="view-detail" data-category="${this._escapeHtml(category)}" data-product-id="${this._escapeHtml(id)}">${this._escapeHtml((product.name || '').charAt(0))}</div>
        <div class="shop-grid-info">
          <div class="shop-grid-name">${this._escapeHtml(product.name)}</div>
          ${tagsHtml}
          ${usageHint ? `<div class="shop-item-usage">${usageHint}</div>` : ''}
          <div class="shop-grid-bottom">
            <div>
              <span class="shop-grid-price">${product.price}</span>
              <span class="shop-grid-currency"> ${this._escapeHtml(product.currency || 'gold')}</span>
            </div>
            <button class="shop-btn shop-btn-add" data-action="add-to-cart" data-category="${this._escapeHtml(category)}" data-product-id="${this._escapeHtml(id)}">+</button>
          </div>
        </div>
      `;
      return el;
    }

    _generateUsageTags(usableIn) {
      if (!usableIn || usableIn.length === 0) return '';
      
      const tagMap = {
        'gift': { label: '可赠送', class: 'gift' },
        'quest': { label: '任务', class: 'quest' },
        'consume': { label: '可使用', class: 'consume' },
      };
      
      const tags = usableIn
        .filter(u => u !== 'any' && tagMap[u])
        .map(u => `<span class="shop-item-tag ${tagMap[u].class}">${tagMap[u].label}</span>`)
        .join('');
      
      return tags ? `<div class="shop-item-tags">${tags}</div>` : '';
    }

    _generateUsageHint(usableIn, product) {
      if (!usableIn || usableIn.length === 0) return '';
      
      if (usableIn.includes('gift')) {
        return '可赠送给NPC';
      }
      if (usableIn.includes('quest')) {
        return product.questName ? `任务"${product.questName}"所需` : '任务所需道具';
      }
      if (usableIn.includes('consume')) {
        return '点击使用';
      }
      return '';
    }

    async _renderCategoryBar(products) {
      const catBar = this._container?.querySelector('.shop-category-bar');
      if (!catBar) return;

      try {
        if (!this._currentCategory && products && typeof products === 'object') {
          const categories = Object.keys(products);
          // 分类映射
          const catNames = {
            'gift': '礼物',
            'consumable': '道具',
            'equipment': '装备',
            'material': '材料',
            'collectible': '收藏',
          };
          
          catBar.innerHTML = '<button class="shop-btn shop-btn-cat shop-btn-active" data-action="cat-all">全部</button>';
          categories.forEach(cat => {
            const displayName = catNames[cat] || cat;
            catBar.innerHTML += `<button class="shop-btn shop-btn-cat" data-action="cat-${this._escapeHtml(cat)}">${this._escapeHtml(displayName)}</button>`;
          });
        }
      } catch (e) {
        console.warn('[ShopModule] 渲染分类栏失败:', e);
      }
    }

    // ==================== 购物车视图 ====================

    async _renderCart() {
      const container = this._container?.querySelector('[data-view="CART"]');
      if (!container) return;

      try {
        const cart = await this._service.getCart();
        container.innerHTML = '';

        const headerEl = document.createElement('div');
        headerEl.className = 'shop-cart-header';
        headerEl.innerHTML = `
          <button class="shop-btn" data-action="back">&larr; 返回商店</button>
          <h4 class="shop-cart-title">购物车</h4>
          <button class="shop-btn shop-btn-clear" data-action="clear-cart">清空</button>
        `;
        container.appendChild(headerEl);

        if (!cart || cart.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'shop-empty';
          emptyEl.textContent = '购物车为空';
          container.appendChild(emptyEl);
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'shop-cart-list';

        cart.forEach(item => {
          const el = document.createElement('div');
          el.className = 'shop-cart-item';
          el.innerHTML = `
            <div class="shop-cart-item-info">
              <div class="shop-cart-item-name">${this._escapeHtml(item.name)}</div>
              <div class="shop-cart-item-qty">x${item.quantity || 1}</div>
              <div class="shop-cart-item-price">${item.price || 0} ${this._escapeHtml(item.currency || 'gold')}</div>
            </div>
            <div class="shop-cart-item-actions">
              <button class="shop-btn shop-btn-qty" data-action="update-qty" data-cart-item-id="${this._escapeHtml(item.id || item.cartItemId)}">修改数量</button>
              <button class="shop-btn shop-btn-remove" data-action="remove-from-cart" data-cart-item-id="${this._escapeHtml(item.id || item.cartItemId)}">移除</button>
            </div>
          `;
          listEl.appendChild(el);
        });

        container.appendChild(listEl);

        const footerEl = document.createElement('div');
        footerEl.className = 'shop-cart-footer';
        footerEl.innerHTML = '<button class="shop-btn shop-btn-checkout" data-action="checkout">结算</button>';
        container.appendChild(footerEl);
      } catch (e) {
        console.warn('[ShopModule] 渲染购物车失败:', e);
        container.innerHTML = '<div class="shop-error">加载失败，请重试</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handleCategorySwitch(category) {
      if (category === 'all') {
        this._currentCategory = '';
      } else {
        this._currentCategory = category;
      }

      // 更新分类按钮高亮
      this._container?.querySelectorAll('[data-action^="cat-"]').forEach(btn => {
        btn.classList.toggle('shop-btn-active', btn.dataset.action === 'cat-' + category);
      });

      await this._renderProducts();
    }

    async _handleAddToCart(category, productId) {
      try {
        const product = await this._service.getProduct(category, productId);
        if (!product) {
          this.showToast('商品不存在', 'error');
          return;
        }

        // TODO: 数据组装应迁移到 ShopService（铁则十二）
        // 当前临时保留，后续由 Service 层提供 addToCart(productId, quantity) 方法
        const result = await this._service.addToCart({
          category: category,
          productId: productId,
          name: product.name,
          price: product.price,
          currency: product.currency || 'gold',
          quantity: 1,
        });

        if (result) {
          this.showToast('已加入购物车', 'success');
        } else {
          this.showToast('加入购物车失败', 'error');
        }
      } catch (err) {
        console.error('[ShopModule] 加入购物车失败:', err);
        this.showToast('加入购物车失败: ' + err.message, 'error');
      }
    }

    async _handleBuyNow(productId) {
      try {
        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const result = await this._service.buyItem(charId, productId);
        
        if (result.ok) {
          this.showToast(`购买成功: ${result.item.name}`, 'success');
          await this._renderProducts();
        } else if (result.error === 'insufficient_funds') {
          this.showToast(`金币不足，需要 ${result.required}（当前 ${result.balance}）`, 'error');
        } else {
          this.showToast('购买失败', 'error');
        }
      } catch (err) {
        console.error('[ShopModule] 购买失败:', err);
        this.showToast('购买失败: ' + err.message, 'error');
      }
    }

    async _handleViewDetail(category, productId) {
      try {
        const product = await this._service.getProduct(category, productId);
        if (!product) {
          this.showToast('商品不存在', 'error');
          return;
        }

        // 显示详情弹窗
        const overlay = document.createElement('div');
        overlay.className = 'shop-modal-overlay';
        
        // 生成效果列表
        const effectsHtml = (product.effects || []).map(e => 
          `<div class="shop-detail-effect-item">${e.type}: +${e.value}</div>`
        ).join('');
        
        // 生成用途标签
        const usableIn = product.usableIn || [];
        const usageText = usableIn.includes('gift') ? '可赠送' : 
                         usableIn.includes('quest') ? '任务道具' : 
                         usableIn.includes('consume') ? '可消耗' : '普通物品';

        overlay.innerHTML = `
          <div class="shop-detail-modal">
            <div class="shop-detail-header">
              <div class="shop-detail-icon">${this._escapeHtml((product.name || '').charAt(0))}</div>
              <div class="shop-detail-info">
                <h4>${this._escapeHtml(product.name)}</h4>
                <div class="shop-detail-price">${product.price} ${this._escapeHtml(product.currency || 'gold')}</div>
                <div style="font-size: 12px; color: #888;">${usageText}</div>
              </div>
            </div>
            <div class="shop-detail-desc">${this._escapeHtml(product.description || '暂无描述')}</div>
            ${effectsHtml ? `<div class="shop-detail-effects"><h5>效果</h5>${effectsHtml}</div>` : ''}
            <div class="shop-detail-actions">
              <button class="shop-detail-buy" data-action="modal-buy">立即购买</button>
              <button class="shop-detail-gift" data-action="modal-close">关闭</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 绑定弹窗事件
        overlay.querySelector('[data-action="modal-close"]').addEventListener('click', () => {
          overlay.remove();
        });
        
        overlay.querySelector('[data-action="modal-buy"]').addEventListener('click', async () => {
          overlay.remove();
          await this._handleBuyNow(productId);
        });
        
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.remove();
        });
        
      } catch (err) {
        console.error('[ShopModule] 查看详情失败:', err);
        this.showToast('加载详情失败', 'error');
      }
    }

    async _handleRemoveFromCart(cartItemId) {
      try {
        const result = await this._service.removeFromCart(cartItemId);
        if (result) {
          this.showToast('已移除', 'success');
          await this._renderCart();
        } else {
          this.showToast('移除失败', 'error');
        }
      } catch (err) {
        console.error('[ShopModule] 移除商品失败:', err);
        this.showToast('移除失败: ' + err.message, 'error');
      }
    }

    async _handleUpdateCartQuantity(cartItemId) {
      const qtyStr = await this._showInputModal('修改数量', '请输入新数量', '1');
      if (qtyStr === null) return;
      const quantity = parseInt(qtyStr, 10);
      if (isNaN(quantity) || quantity <= 0) return;

      try {
        const result = await this._service.updateCartQuantity(cartItemId, quantity);
        if (result) {
          this.showToast('数量已更新', 'success');
          await this._renderCart();
        } else {
          this.showToast('更新数量失败', 'error');
        }
      } catch (err) {
        console.error('[ShopModule] 更新数量失败:', err);
        this.showToast('更新数量失败: ' + err.message, 'error');
      }
    }

    async _handleClearCart() {
      const confirmed = await this._showConfirmModal('确定清空购物车吗？');
      if (!confirmed) return;

      try {
        const result = await this._service.clearCart();
        if (result) {
          this.showToast('购物车已清空', 'success');
          await this._renderCart();
        } else {
          this.showToast('清空失败', 'error');
        }
      } catch (err) {
        console.error('[ShopModule] 清空购物车失败:', err);
        this.showToast('清空失败: ' + err.message, 'error');
      }
    }

    async _handleCheckout() {
      const confirmed = await this._showConfirmModal('确定结算吗？');
      if (!confirmed) return;

      try {
        const order = await this._service.checkout();
        if (order?.error === 'insufficient_funds') {
          this.showToast('金币不足，需要 ' + (order.required || 0) + '（当前 ' + (order.balance || 0) + '）', 'error');
        } else if (order && order.ok !== false) {
          this.showToast('结算成功！物品已添加到背包', 'success');
          await this._renderCart();
        } else {
          this.showToast('结算失败', 'error');
        }
      } catch (err) {
        console.error('[ShopModule] 结算失败:', err);
        this.showToast('结算失败: ' + err.message, 'error');
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsubProducts = this._service.subscribeProducts(() => {
          if (this._currentView === 'PRODUCTS') {
            this._renderProducts();
          }
        });
        if (unsubProducts) this._unsubscribers.push(unsubProducts);
      } catch (e) {
        console.warn('[ShopModule] 订阅商品数据失败:', e);
      }

      try {
        const unsubCart = this._service.subscribeCart(() => {
          if (this._currentView === 'CART') {
            this._renderCart();
          }
        });
        if (unsubCart) this._unsubscribers.push(unsubCart);
      } catch (e) {
        console.warn('[ShopModule] 订阅购物车数据失败:', e);
      }
    }

    // ==================== ST5层联动 ====================

    async _handleWorldUpdate(payload) {
      try {
        this._showLoading(true);
        // 调用 Service 方法重新生成商品数据（新商品、打折活动等）
        if (this._service?.regenerateData) {
          await this._service.regenerateData(payload);
        }
        await this._renderProducts();
        await this._loadAINotice();
        this._showLoading(false);
        this.showToast('商品数据已更新', 'success');
      } catch (e) {
        this._showLoading(false);
        console.warn(`[${this.id}] 世界更新处理失败:`, e);
        // 错误降级：保留现有数据不变
      }
    }

    // ==================== 手动刷新 ====================

    async _handleManualRefresh() {
      try {
        this._showLoading(true);
        
        // 调用 Service 从 Expert 刷新商品
        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const refreshed = await this._service.refreshFromExpert(charId);
        
        if (refreshed) {
          await this._renderProducts();
          await this._loadAINotice();
          this.showToast('商品已刷新', 'success');
        } else {
          this.showToast('刷新失败', 'error');
        }
        
        this._showLoading(false);
      } catch (e) {
        this._showLoading(false);
        console.warn('[ShopModule] 手动刷新失败:', e);
        this.showToast('刷新失败', 'error');
      }
    }

    // ==================== 加载状态 ====================

    _showLoading(show) {
      this._isLoading = show;
      const views = this._container?.querySelector('.shop-views');
      const refreshBtn = this._container?.querySelector('.shop-btn-refresh');

      if (refreshBtn) {
        refreshBtn.classList.toggle('loading', show);
      }

      // 移除已有加载遮罩
      const existingLoading = this._container?.querySelector('.shop-loading');
      if (existingLoading) existingLoading.remove();

      if (show && views) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'shop-loading';
        loadingEl.innerHTML = '<div class="shop-loading-spinner"></div>';
        views.style.position = 'relative';
        views.appendChild(loadingEl);
      }
    }

    // ==================== AI 功能 ====================

    async _loadAINotice() {
      try {
        const notice = await this._service.generateEventNotice();
        const bar = this._container?.querySelector('[data-ref="shopNoticeBar"]');
        if (bar && notice) {
          bar.textContent = '\uD83D\uDCE2 ' + notice;
          bar.style.display = 'block';
        }
      } catch (e) {
        console.warn('[ShopModule] 加载AI活动横幅失败:', e);
      }
    }

    async _handleAIRecommend() {
      try {
        this.showToast('\uD83E\uDD16 AI 正在分析推荐...', 'info');

        // [v4.31.0-fix] 铁则三：通过平台获取Service，不在方法内直接实例化
        let backpackInfo = [];
        try {
          const backpackService = this._platform?.get?.('inventoryService') || 
            (window.PhoneServices?.Inventory ? new window.PhoneServices.Inventory(window.Platform) : null);
          if (backpackService) {
            const items = await backpackService.getItems();
            if (items && typeof items === 'object') {
              backpackInfo = Object.values(items).flatMap(typeItems =>
                Object.values(typeItems || {}).map(i => i.name || i.id)
              ).slice(0, 10);
            }
          }
        } catch (e) {
          // 背包获取失败不影响推荐
          console.warn('[ShopModule] 获取背包信息失败:', e);
        }

        const recommendations = await this._service.generateRecommendations({
          backpack: backpackInfo,
        });

        if (!recommendations || recommendations.length === 0) {
          this.showToast('暂无推荐', 'info');
          return;
        }

        // 在商品列表顶部显示推荐
        const container = this._container?.querySelector('[data-view="PRODUCTS"]');
        if (!container) return;

        const existRec = container.querySelector('.shop-ai-recommend');
        if (existRec) existRec.remove();

        const recEl = document.createElement('div');
        recEl.className = 'shop-ai-recommend';
        recEl.style.cssText = 'background:linear-gradient(135deg,#667eea22,#764ba222);border-radius:12px;padding:12px;margin:8px 12px;border:1px solid #667eea33;';
        
        let recHtml = '<div style="font-size:13px;font-weight:bold;color:#667eea;margin-bottom:8px;">\uD83E\uDD16 AI 为你推荐</div>';
        recommendations.forEach(r => {
          recHtml += `<div style="font-size:12px;color:#333;margin-bottom:4px;">
            <span style="font-weight:bold;">${this._escapeHtml(r.name || '未知商品')}</span>
            <span style="color:#888;margin-left:4px;">- ${this._escapeHtml(r.reason || '')}</span>
          </div>`;
        });
        recEl.innerHTML = recHtml;

        container.insertBefore(recEl, container.firstChild);
        this.showToast('推荐已生成', 'success');
      } catch (err) {
        console.error('[ShopModule] AI推荐失败:', err);
        this.showToast('AI推荐失败: ' + err.message, 'error');
      }
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
        overlay.className = 'shop-modal-overlay';
        overlay.innerHTML = `
          <div class="shop-modal-box">
            <div class="shop-modal-title">${this._escapeHtml(title)}</div>
            <input class="shop-modal-input" type="text" placeholder="${this._escapeHtml(placeholder)}" value="${this._escapeHtml(defaultValue || '')}" />
            <div class="shop-modal-actions">
              <button class="shop-modal-btn shop-modal-cancel">取消</button>
              <button class="shop-modal-btn shop-modal-confirm">确定</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('.shop-modal-input');
        const cancelBtn = overlay.querySelector('.shop-modal-cancel');
        const confirmBtn = overlay.querySelector('.shop-modal-confirm');

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
        overlay.className = 'shop-modal-overlay';
        overlay.innerHTML = `
          <div class="shop-modal-box">
            <div class="shop-modal-title">${this._escapeHtml(message)}</div>
            <div class="shop-modal-actions">
              <button class="shop-modal-btn shop-modal-cancel">取消</button>
              <button class="shop-modal-btn shop-modal-confirm">确定</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('.shop-modal-cancel');
        const confirmBtn = overlay.querySelector('.shop-modal-confirm');

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

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new ShopModule();
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
  window.PhoneModules.Shop = ShopModule;

  console.log('[Module] ShopModule 已加载 (Phase 5 增强版)');
})();
