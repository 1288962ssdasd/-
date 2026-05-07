/**
 * ShopAppNew - 商店应用重写模块
 * 继承 ContextDrivenApp 基类，使用 ES6+ 语法
 * 功能：浏览商品、加入购物车、移除商品、查看购物车、结算
 * CSS 前缀: shop-new-
 */
;(function () {
  'use strict';

  /** 商品分类配置 */
  const CATEGORY_CONFIG = {
    '武器':   { icon: '&#9876;', color: '#e74c3c' },
    '防具':   { icon: '&#128737;', color: '#3498db' },
    '药水':   { icon: '&#127861;', color: '#2ecc71' },
    '食物':   { icon: '&#127860;', color: '#f39c12' },
    '材料':   { icon: '&#128300;', color: '#9b59b6' },
    '饰品':   { icon: '&#128142;', color: '#e91e63' },
    '工具':   { icon: '&#128295;', color: '#607d8b' },
    '书籍':   { icon: '&#128214;', color: '#795548' },
    '其他':   { icon: '&#128230;', color: '#95a5a6' },
  };

  class ShopAppNew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'ShopAppNew' });

      /** @type {Array<{id:string, name:string, price:number, desc:string, stock:number, category:string}>} 商品列表 */
      this._products = [];

      /** @type {Array<{productId:string, name:string, price:number, quantity:number}>} 购物车 */
      this._cart = [];

      /** @type {'shop'|'cart'} 当前视图 */
      this._currentView = 'shop';

      /** @type {string} 当前分类筛选 */
      this._currentCategory = '全部';

      /** @type {string} 搜索关键词 */
      this._searchKeyword = '';

      /** @type {Object|null} 数据层引用 */
      this._phoneDataStore = null;

      /** @type {Object|null} 配置管理器引用 */
      this._configManager = null;
    }

    /* ------------------------------------------------------------------ */
    /*  生命周期                                                           */
    /* ------------------------------------------------------------------ */

    onInit() {
      this._phoneDataStore = this.getService('phoneDataStore');
      this._configManager = this.getService('configManager');
      this._parseProductsFromContext();
      this.updateHeader('商店');
      console.log('[ShopAppNew] 初始化完成');
    }

    onDestroy() {
      this._products = [];
      this._cart = [];
    }

    /* ------------------------------------------------------------------ */
    /*  数据层                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * 获取目标消息 ID
     * @returns {string|number}
     */
    _resolveTargetMessageId() {
      if (typeof window.getLastMessageId !== 'function' || typeof window.getChatMessages !== 'function') {
        return 'latest';
      }
      let currentId = window.getLastMessageId();
      while (currentId >= 0) {
        const message = window.getChatMessages(currentId).at(-1);
        if (message && message.role !== 'user') {
          return currentId;
        }
        currentId--;
      }
      return 'latest';
    }

    /**
     * 从 Mvu / SillyTavern context 读取原始商品数据
     * @returns {Object|null}
     */
    _getRawProductData() {
      // 路径 1: Mvu
      if (window.Mvu && typeof window.Mvu.getMvuData === 'function') {
        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (mvuData?.stat_data?.['商店']) {
          return mvuData.stat_data['商店'];
        }
        if (mvuData?.['商店']) {
          return mvuData['商店'];
        }
      }

      // 路径 2: SillyTavern context
      if (window.SillyTavern) {
        const ctx = typeof window.SillyTavern.getContext === 'function'
          ? window.SillyTavern.getContext()
          : window.SillyTavern;
        const statData = ctx?.chatMetadata?.variables?.['stat_data'];
        if (statData?.['商店']) {
          return statData['商店'];
        }
        const direct = ctx?.chatMetadata?.variables?.['商店'];
        if (direct && typeof direct === 'object') {
          return direct;
        }
      }

      // 路径 3: ConfigManager
      if (this._configManager) {
        try {
          const raw = this._configManager.get('xb.shop.products');
          if (raw) {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (e) {
          console.warn('[ShopAppNew] ConfigManager 读取失败:', e);
        }
      }

      return null;
    }

    /**
     * 解析商品数据
     * @param {Object} rawData
     * @returns {Array}
     */
    _parseProductData(rawData) {
      if (!rawData || typeof rawData !== 'object') return [];

      const products = [];
      for (const key of Object.keys(rawData)) {
        if (key === '$meta') continue;

        const entry = rawData[key];
        if (!entry || typeof entry !== 'object') continue;

        const val = (field) =>
          Array.isArray(entry[field]) ? entry[field][0] : (entry[field] || '');

        const price = parseFloat(val('价格') || val('price') || '0') || 0;
        const stock = parseInt(val('库存') || val('stock') || '0', 10) || 0;

        products.push({
          id: key,
          name: val('名称') || val('name') || key,
          price,
          desc: val('描述') || val('desc') || '',
          stock,
          category: val('分类') || val('category') || '其他',
        });
      }

      return products;
    }

    /**
     * 从上下文解析商品列表
     */
    _parseProductsFromContext() {
      const raw = this._getRawProductData();
      if (raw) {
        this._products = this._parseProductData(raw);
        console.log(`[ShopAppNew] 解析到 ${this._products.length} 件商品`);
      } else {
        this._products = [];
        console.log('[ShopAppNew] 未找到商品数据');
      }
    }

    /**
     * 计算数据哈希
     * @returns {string}
     */
    _computeDataHash() {
      try {
        return JSON.stringify({ products: this._products, cart: this._cart });
      } catch (_) {
        return '';
      }
    }

    /* ------------------------------------------------------------------ */
    /*  购物车操作                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * 加入购物车
     * @param {string} productId
     */
    _addToCart(productId) {
      const product = this._products.find((p) => p.id === productId);
      if (!product) {
        this.showToast('商品不存在', 'warning');
        return;
      }

      const cartItem = this._cart.find((c) => c.productId === productId);
      if (cartItem) {
        if (cartItem.quantity >= product.stock) {
          this.showToast('库存不足', 'warning');
          return;
        }
        cartItem.quantity++;
      } else {
        if (product.stock <= 0) {
          this.showToast('商品已售罄', 'warning');
          return;
        }
        this._cart.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        });
      }

      this.showToast(`已加入购物车: ${product.name}`, 'success');
      this._updateCartBadge();
    }

    /**
     * 从购物车移除
     * @param {string} productId
     */
    _removeFromCart(productId) {
      const idx = this._cart.findIndex((c) => c.productId === productId);
      if (idx === -1) return;

      const item = this._cart[idx];
      if (item.quantity > 1) {
        item.quantity--;
      } else {
        this._cart.splice(idx, 1);
      }

      if (this._currentView === 'cart') {
        this.render();
      }
      this._updateCartBadge();
    }

    /**
     * 完全移除购物车中的商品
     * @param {string} productId
     */
    _removeItemFromCart(productId) {
      this._cart = this._cart.filter((c) => c.productId !== productId);
      if (this._currentView === 'cart') {
        this.render();
      }
      this._updateCartBadge();
    }

    /**
     * 计算购物车总价
     * @returns {number}
     */
    _getCartTotal() {
      return this._cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    /**
     * 计算购物车商品总数
     * @returns {number}
     */
    _getCartCount() {
      return this._cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    /**
     * 更新购物车角标
     */
    _updateCartBadge() {
      const badge = document.querySelector('.shop-new-cart-badge');
      if (badge) {
        const count = this._getCartCount();
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
    }

    /**
     * 结算
     */
    _checkout() {
      if (this._cart.length === 0) {
        this.showToast('购物车为空', 'warning');
        return;
      }

      const total = this._getCartTotal();
      const count = this._getCartCount();

      if (!confirm(`确认购买 ${count} 件商品，总计 ${total} 金币？`)) return;

      this.showToast(`购买成功！共消费 ${total} 金币`, 'success');
      this._cart = [];
      this._currentView = 'shop';
      this.updateHeader('商店');
      this.render();
    }

    /* ------------------------------------------------------------------ */
    /*  筛选与搜索                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * 获取所有分类
     * @returns {Array<string>}
     */
    _getCategories() {
      const cats = new Set(this._products.map((p) => p.category));
      return ['全部', ...Array.from(cats)];
    }

    /**
     * 筛选商品
     * @returns {Array}
     */
    _getFilteredProducts() {
      let filtered = this._products;

      // 分类筛选
      if (this._currentCategory !== '全部') {
        filtered = filtered.filter((p) => p.category === this._currentCategory);
      }

      // 搜索关键词
      if (this._searchKeyword) {
        const kw = this._searchKeyword.toLowerCase();
        filtered = filtered.filter((p) =>
          p.name.toLowerCase().includes(kw) ||
          p.desc.toLowerCase().includes(kw) ||
          p.category.toLowerCase().includes(kw),
        );
      }

      return filtered;
    }

    /* ------------------------------------------------------------------ */
    /*  渲染                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * 渲染分类筛选栏
     * @returns {string}
     */
    _renderCategoryBar() {
      const categories = this._getCategories();
      return `
        <div class="shop-new-categories">
          ${categories.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['其他'];
            return `
              <button class="shop-new-cat-btn ${this._currentCategory === cat ? 'active' : ''}" data-category="${this._esc(cat)}">
                ${cfg.icon} ${this._esc(cat)}
              </button>`;
          }).join('')}
        </div>`;
    }

    /**
     * 渲染搜索栏
     * @returns {string}
     */
    _renderSearchBar() {
      return `
        <div class="shop-new-search">
          <input type="text" class="shop-new-search-input" id="shop-new-search" placeholder="搜索商品..." value="${this._esc(this._searchKeyword)}">
        </div>`;
    }

    /**
     * 渲染单个商品卡片
     * @param {Object} product
     * @returns {string}
     */
    _renderProductCard(product) {
      const cfg = CATEGORY_CONFIG[product.category] || CATEGORY_CONFIG['其他'];
      const inCart = this._cart.find((c) => c.productId === product.id);
      const stockClass = product.stock <= 0 ? ' out-of-stock' : '';

      return `
        <div class="shop-new-product-card${stockClass}" data-product-id="${this._esc(product.id)}">
          <div class="shop-new-product-icon" style="color: ${cfg.color}">${cfg.icon}</div>
          <div class="shop-new-product-info">
            <div class="shop-new-product-name">${this._esc(product.name)}</div>
            <div class="shop-new-product-category">${cfg.icon} ${this._esc(product.category)}</div>
            ${product.desc ? `<div class="shop-new-product-desc">${this._esc(product.desc)}</div>` : ''}
            <div class="shop-new-product-footer">
              <span class="shop-new-product-price">${product.price} <small>金币</small></span>
              <span class="shop-new-product-stock">库存: ${product.stock}</span>
            </div>
          </div>
          <div class="shop-new-product-actions">
            ${product.stock > 0
              ? `<button class="shop-new-btn shop-new-btn-add" data-product-id="${this._esc(product.id)}">
                  ${inCart ? `(${inCart.quantity}) ` : ''}加入购物车
                </button>`
              : `<span class="shop-new-sold-out">已售罄</span>`
            }
          </div>
        </div>`;
    }

    /**
     * 渲染商品网格
     * @returns {string}
     */
    _renderProductGrid() {
      const filtered = this._getFilteredProducts();

      if (filtered.length === 0) {
        return `
          <div class="shop-new-empty">
            <div class="shop-new-empty-icon">&#128722;</div>
            <div class="shop-new-empty-title">没有找到商品</div>
            <div class="shop-new-empty-hint">试试其他分类或关键词</div>
          </div>`;
      }

      return `
        <div class="shop-new-product-grid">
          ${filtered.map((p) => this._renderProductCard(p)).join('')}
        </div>`;
    }

    /**
     * 渲染购物车视图
     * @returns {string}
     */
    _renderCartView() {
      if (this._cart.length === 0) {
        return `
          <div class="shop-new-cart-empty">
            <div class="shop-new-empty-icon">&#128722;</div>
            <div class="shop-new-empty-title">购物车是空的</div>
            <div class="shop-new-empty-hint">去商店逛逛吧</div>
            <button class="shop-new-btn shop-new-btn-browse" id="shop-new-browse">去逛逛</button>
          </div>`;
      }

      const total = this._getCartTotal();

      return `
        <div class="shop-new-cart-list">
          ${this._cart.map((item) => `
            <div class="shop-new-cart-item" data-product-id="${this._esc(item.productId)}">
              <div class="shop-new-cart-item-info">
                <div class="shop-new-cart-item-name">${this._esc(item.name)}</div>
                <div class="shop-new-cart-item-price">${item.price} 金币</div>
              </div>
              <div class="shop-new-cart-item-qty">
                <button class="shop-new-btn shop-new-btn-qty shop-new-btn-minus" data-product-id="${this._esc(item.productId)}">-</button>
                <span class="shop-new-qty-num">${item.quantity}</span>
                <button class="shop-new-btn shop-new-btn-qty shop-new-btn-plus" data-product-id="${this._esc(item.productId)}">+</button>
              </div>
              <div class="shop-new-cart-item-subtotal">${item.price * item.quantity} 金币</div>
              <button class="shop-new-btn shop-new-btn-remove-item" data-product-id="${this._esc(item.productId)}">删除</button>
            </div>`).join('')}
        </div>
        <div class="shop-new-cart-footer">
          <div class="shop-new-cart-total">总计: ${total} 金币</div>
          <button class="shop-new-btn shop-new-btn-checkout" id="shop-new-checkout">结算</button>
        </div>`;
    }

    /**
     * 渲染底部导航栏
     * @returns {string}
     */
    _renderNavBar() {
      const cartCount = this._getCartCount();
      return `
        <div class="shop-new-navbar">
          <button class="shop-new-nav-btn ${this._currentView === 'shop' ? 'active' : ''}" data-view="shop">
            &#128722; 商店
          </button>
          <button class="shop-new-nav-btn ${this._currentView === 'cart' ? 'active' : ''}" data-view="cart">
            &#128722; 购物车
            <span class="shop-new-cart-badge" style="display: ${cartCount > 0 ? 'flex' : 'none'}">${cartCount}</span>
          </button>
        </div>`;
    }

    /**
     * 返回应用完整 HTML
     * @returns {string}
     */
    getAppContent() {
      this._parseProductsFromContext();

      const content = this._currentView === 'cart'
        ? this._renderCartView()
        : `
          ${this._renderSearchBar()}
          ${this._renderCategoryBar()}
          ${this._renderProductGrid()}`;

      return `
        <div class="shop-new-app">
          <div class="shop-new-content" id="shop-new-content">${content}</div>
          ${this._renderNavBar()}
        </div>`;
    }

    /* ------------------------------------------------------------------ */
    /*  事件绑定                                                           */
    /* ------------------------------------------------------------------ */

    bindEvents() {
      const container = document.getElementById(this._containerId);
      if (!container) return;

      // 底部导航切换
      container.querySelectorAll('.shop-new-nav-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._switchView(e.currentTarget.dataset.view);
        });
      });

      // 分类筛选
      container.querySelectorAll('.shop-new-cat-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentCategory = e.currentTarget.dataset.category;
          this.render();
        });
      });

      // 搜索输入
      const searchInput = container.querySelector('#shop-new-search');
      if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this._searchKeyword = e.target.value.trim();
            this.render();
            // 重新聚焦搜索框
            const newInput = document.getElementById('shop-new-search');
            if (newInput) {
              newInput.focus();
              newInput.setSelectionRange(newInput.value.length, newInput.value.length);
            }
          }, 300);
        });
      }

      // 加入购物车
      container.querySelectorAll('.shop-new-btn-add').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._addToCart(e.currentTarget.dataset.productId);
          this.render();
        });
      });

      // 购物车数量减少
      container.querySelectorAll('.shop-new-btn-minus').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._removeFromCart(e.currentTarget.dataset.productId);
        });
      });

      // 购物车数量增加
      container.querySelectorAll('.shop-new-btn-plus').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._addToCart(e.currentTarget.dataset.productId);
        });
      });

      // 购物车删除商品
      container.querySelectorAll('.shop-new-btn-remove-item').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._removeItemFromCart(e.currentTarget.dataset.productId);
        });
      });

      // 结算
      const checkoutBtn = container.querySelector('#shop-new-checkout');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._checkout();
        });
      }

      // 去逛逛
      const browseBtn = container.querySelector('#shop-new-browse');
      if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._switchView('shop');
        });
      }
    }

    /**
     * 切换视图
     * @param {string} view
     */
    _switchView(view) {
      this._currentView = view;
      const titles = { shop: '商店', cart: '购物车' };
      this.updateHeader(titles[view] || '商店');
      this.render();
    }

    /* ------------------------------------------------------------------ */
    /*  工具方法                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * HTML 转义
     * @param {string} str
     * @returns {string}
     */
    _esc(str) {
      if (!str) return '';
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(str).replace(/[&<>"']/g, (c) => map[c]);
    }
  }

  window.ShopAppNew = new ShopAppNew();
  console.log('[ShopAppNew] 模块加载完成');
})();
