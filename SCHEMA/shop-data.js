/**
 * ShopData - 商店数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Shop
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'shop';

  /**
   * ShopData 商店数据操作类
   */
  class ShopData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有商品
     * @returns {Promise<Object>}
     */
    async getProducts() {
      return await this._get('products', {});
    }

    /**
     * 获取某类商品
     * @param {string} category
     * @returns {Promise<Object>}
     */
    async getProductsByCategory(category) {
      const products = await this.getProducts();
      return products[category] || {};
    }

    /**
     * 获取单个商品
     * @param {string} category
     * @param {string} productId
     * @returns {Promise<Object|null>}
     */
    async getProduct(category, productId) {
      const products = await this.getProducts();
      return products[category]?.[productId] || null;
    }

    /**
     * 获取购物车
     * @returns {Promise<Array>}
     */
    async getCart() {
      return await this._get('cart', []);
    }

    /**
     * 获取购买历史
     * @returns {Promise<Array>}
     */
    async getHistory() {
      return await this._get('history', []);
    }

    // ==================== 写入操作 ====================

    /**
     * 设置所有商品
     * @param {Object} products
     * @returns {Promise<boolean>}
     */
    async setProducts(products) {
      await this._set('products', products);
      this._emit('shop:productsUpdated', { products });
      return true;
    }

    /**
     * 添加商品
     * @param {string} category
     * @param {string} productId
     * @param {Object} product
     * @returns {Promise<boolean>}
     */
    async addProduct(category, productId, product) {
      const products = await this.getProducts();

      if (!products[category]) products[category] = {};

      products[category][productId] = {
        id: productId,
        name: product.name || '未知商品',
        category: category,
        description: product.description || '',
        price: product.price || 0,
        currency: product.currency || 'gold',
        stock: product.stock || -1, // -1 表示无限
        icon: product.icon || '',
        attributes: product.attributes || {},
      };

      await this._set('products', products);
      this._emit('shop:productAdded', { category, productId, product: products[category][productId] });
      return true;
    }

    /**
     * 更新商品库存
     * @param {string} category
     * @param {string} productId
     * @param {number} stock
     * @returns {Promise<boolean>}
     */
    async updateStock(category, productId, stock) {
      const products = await this.getProducts();

      if (!products[category]?.[productId]) return false;

      products[category][productId].stock = stock;
      await this._set('products', products);

      this._emit('shop:stockUpdated', { category, productId, stock });
      return true;
    }

    /**
     * 加入购物车
     * @param {Object} item
     * @returns {Promise<Object>}
     */
    async addToCart(item) {
      const cart = await this.getCart();

      const cartItem = {
        id: this._generateId(),
        productId: item.productId,
        category: item.category,
        name: item.name,
        price: item.price,
        currency: item.currency,
        quantity: item.quantity || 1,
      };

      // 检查是否已在购物车
      const existing = cart.find(c => c.productId === item.productId && c.category === item.category);
      if (existing) {
        existing.quantity += item.quantity || 1;
      } else {
        cart.push(cartItem);
      }

      await this._set('cart', cart);
      this._emit('shop:cartUpdated', { cart });
      return cartItem;
    }

    /**
     * 从购物车移除
     * @param {string} cartItemId
     * @returns {Promise<boolean>}
     */
    async removeFromCart(cartItemId) {
      const cart = await this.getCart();
      const index = cart.findIndex(c => c.id === cartItemId);

      if (index === -1) return false;

      cart.splice(index, 1);
      await this._set('cart', cart);

      this._emit('shop:cartUpdated', { cart });
      return true;
    }

    /**
     * 更新购物车数量
     * @param {string} cartItemId
     * @param {number} quantity
     * @returns {Promise<boolean>}
     */
    async updateCartQuantity(cartItemId, quantity) {
      const cart = await this.getCart();
      const item = cart.find(c => c.id === cartItemId);

      if (!item) return false;

      if (quantity <= 0) {
        return await this.removeFromCart(cartItemId);
      }

      item.quantity = quantity;
      await this._set('cart', cart);

      this._emit('shop:cartUpdated', { cart });
      return true;
    }

    /**
     * 清空购物车
     * @returns {Promise<boolean>}
     */
    async clearCart() {
      await this._set('cart', []);
      this._emit('shop:cartCleared');
      return true;
    }

    /**
     * 结算购物车
     * @returns {Promise<Object>}
     */
    /** @deprecated 业务逻辑已迁移到 ShopService，请通过 Service 层调用 */
    async checkout() {
      const cart = await this.getCart();

      if (cart.length === 0) {
        console.warn('[ShopData] checkout: 购物车为空，取消结算');
        return null;
      }

      // 计算总价
      const total = {};
      cart.forEach(item => {
        const currency = item.currency || 'gold';
        total[currency] = (total[currency] || 0) + item.price * item.quantity;
      });

      // 添加到购买历史
      const history = await this.getHistory();
      const order = {
        id: this._generateId(),
        items: [...cart],
        total: total,
        createdAt: Date.now(),
        status: 'completed',
      };
      history.unshift(order);
      await this._set('history', history);

      // 清空购物车
      await this.clearCart();

      this._emit('shop:checkout', { order });
      return order;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅商品变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeProducts(callback) {
      return this._subscribe('products', callback);
    }

    /**
     * 订阅购物车变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeCart(callback) {
      return this._subscribe('cart', callback);
    }

    // ==================== 内部方法 ====================

        async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[Schema] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

        async _set(key, value) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }
      
      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, key, value, { persist: true });
      
      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      return this._platform.subscribeData(DOMAIN, key, callback);
    }

    /**
     * @deprecated 事件发射已迁移到 Service 层（铁则三）
     * 保留此方法以兼容旧代码调用，但不再实际发射事件
     */
    _emit(eventType, data) {
      // no-op: 事件发射由 ShopService 负责
    }

    _generateId() {
      const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      return 'shop_' + uuid.substr(0, 12);
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Shop = ShopData;

  console.log('[Schema] ShopData 已加载');
})();
