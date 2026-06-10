/**
 * ShopService - 商店业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Shop
 *
 * 铁则合规：
 *   - 数据读写通过 Schema（铁则一）
 *   - 调用 AI / LLM（铁则三）
 *   - 发射业务事件（铁则三）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class ShopService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._shopData = new (window.PhoneData?.Shop || function(){})(this._platform);
      this._backpackData = new (window.PhoneData?.Backpack || function(){})(this._platform);
      this._aiService = new (window.PhoneServices?.AI || function(){})(this._platform);
      this._promptData = new (window.PhoneData?.Prompt || function(){})(this._platform);
    }

    async getProducts() {
      try {
        return await this._shopData.getProducts();
      } catch (e) {
        console.warn('[ShopService] getProducts 失败:', e);
        return null;
      }
    }

    async getProductsByCategory(category) {
      try {
        return await this._shopData.getProductsByCategory(category);
      } catch (e) {
        console.warn('[ShopService] getProductsByCategory 失败:', e);
        return null;
      }
    }

    async getProduct(category, productId) {
      try {
        return await this._shopData.getProduct(category, productId);
      } catch (e) {
        console.warn('[ShopService] getProduct 失败:', e);
        return null;
      }
    }

    async getCart() {
      try {
        return await this._shopData.getCart();
      } catch (e) {
        console.warn('[ShopService] getCart 失败:', e);
        return [];
      }
    }

    async addToCart(item) {
      try {
        const result = await this._shopData.addToCart(item);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:cartUpdated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'shop:cartUpdated',
            data: { productId: item?.productId || item?.id, cartCount: result?.cartCount },
            timestamp: Date.now(),
            source: 'shop-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[ShopService] addToCart 失败:', e);
        return false;
      }
    }

    async removeFromCart(cartItemId) {
      try {
        const result = await this._shopData.removeFromCart(cartItemId);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:cartUpdated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'shop:cartUpdated',
            data: { productId: cartItemId },
            timestamp: Date.now(),
            source: 'shop-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[ShopService] removeFromCart 失败:', e);
        return false;
      }
    }

    async updateCartQuantity(cartItemId, quantity) {
      try {
        return await this._shopData.updateCartQuantity(cartItemId, quantity);
      } catch (e) {
        console.warn('[ShopService] updateCartQuantity 失败:', e);
        return false;
      }
    }

    async clearCart() {
      try {
        const result = await this._shopData.clearCart();
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:cartCleared', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'shop:cartCleared',
            data: {},
            timestamp: Date.now(),
            source: 'shop-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[ShopService] clearCart 失败:', e);
        return false;
      }
    }

    async checkout() {
      try {
        const cart = await this._shopData.getCart();
        if (!cart?.length) {
          console.warn('[ShopService] 购物车为空');
          return null;
        }

        const totalGold = cart.reduce((sum, item) => {
          const cur = (item.currency || 'gold').toLowerCase();
          if (cur !== 'gold' && cur !== 'money' && cur !== '金币') return sum;
          return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }, 0);

        const economy = this._platform?.get?.('economyService');
        if (economy && totalGold > 0) {
          const paid = await economy.spend(totalGold, 'gold', 'shop_checkout', { items: cart.length });
          if (!paid?.ok) {
            console.warn('[ShopService] 余额不足:', paid);
            return { ok: false, error: 'insufficient_funds', required: totalGold, balance: paid?.balance };
          }
        }

        const order = await this._shopData.checkout();

        // 将购买的物品添加到背包
        for (const item of order.items) {
          try {
            await this._backpackData.addItem(item.category || 'consumable', item.productId, {
              name: item.name,
              quantity: item.quantity,
              description: item.description || '',
              effects: item.effects || [],
              usableIn: item.usableIn || [],
              source: 'shop',
              purchasedAt: Date.now(),
            });
          } catch (e) {
            console.warn('[ShopService] 添加物品到背包失败:', item.productId, e);
          }
        }

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:checkoutCompleted', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'shop:checkoutCompleted',
            data: { itemCount: order.items?.length, totalCost: order.totalCost },
            timestamp: Date.now(),
            source: 'shop-service'
          });
        }

        return order;
      } catch (e) {
        console.warn('[ShopService] checkout 失败:', e);
        return null;
      }
    }

    // ==================== Phase 5: 新增方法 ====================

    /**
     * 从 ShopExpert 刷新商品
     * @param {string} charId - 角色ID
     * @returns {Promise<boolean>}
     */
    async refreshFromExpert(charId) {
      try {
        if (!window.ShopExpert) {
          console.warn('[ShopService] ShopExpert 不可用');
          return false;
        }

        // 获取世界上下文
        let worldTheme = '';
        let currentNews = '';
        try {
          const worldService = this._platform?.get?.('worldService');
          if (worldService) {
            const world = await worldService.getWorld(charId);
            worldTheme = world?.theme || world?.name || '';
          }
          const newsService = this._platform?.get?.('newsService');
          if (newsService) {
            const news = await newsService.getLatestNews(charId);
            currentNews = news?.title || news?.content || '';
          }
        } catch (e) {
          console.warn('[ShopService] 获取世界上下文失败:', e);
        }

        // 调用 ShopExpert 生成商品
        const expert = new window.ShopExpert(this._platform);
        const result = await expert.generate({
          charId,
          worldTheme,
          currentNews,
          itemCount: 8,
        });

        if (!result || !result.items) {
          console.warn('[ShopService] ShopExpert 未返回有效商品');
          return false;
        }

        // 将生成的商品保存到商店
        const products = await this._shopData.getProducts();
        for (const item of result.items) {
          const category = item.category || 'consumable';
          if (!products[category]) products[category] = {};
          
          products[category][item.id] = {
            id: item.id,
            name: item.name,
            category: category,
            description: item.description || '',
            price: item.price || 50,
            currency: item.currency || 'gold',
            stock: item.stock || -1,
            icon: item.icon || '',
            worldTag: item.worldTag || worldTheme,
            effects: item.effects || [],
            usableIn: item.usableIn || [],
            refreshedAt: Date.now(),
          };
        }

        await this._shopData.setProducts(products);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:refreshedFromExpert', {
            id: 'evt_' + Date.now(),
            type: 'shop:refreshedFromExpert',
            data: { itemCount: result.items.length },
            timestamp: Date.now(),
            source: 'shop-service',
          });
        }

        return true;
      } catch (e) {
        console.warn('[ShopService] refreshFromExpert 失败:', e);
        return false;
      }
    }

    /**
     * 购买单个商品（直接购买，不经过购物车）
     * @param {string} charId - 角色ID
     * @param {string} itemId - 商品ID
     * @returns {Promise<Object>}
     */
    async buyItem(charId, itemId) {
      try {
        // 查找商品
        const products = await this._shopData.getProducts();
        let product = null;
        let category = '';
        
        for (const [cat, items] of Object.entries(products)) {
          if (items[itemId]) {
            product = items[itemId];
            category = cat;
            break;
          }
        }

        if (!product) {
          return { ok: false, error: 'item_not_found' };
        }

        // 检查库存
        if (product.stock === 0) {
          return { ok: false, error: 'out_of_stock' };
        }

        // 扣款
        const price = product.price || 0;
        const currency = product.currency || 'gold';
        
        const economy = this._platform?.get?.('economyService');
        if (economy && price > 0) {
          const paid = await economy.spend(price, currency, 'shop_buy', { itemId });
          if (!paid?.ok) {
            return { ok: false, error: 'insufficient_funds', required: price, balance: paid?.balance };
          }
        }

        // 添加到背包
        await this._backpackData.addItem(category, itemId, {
          name: product.name,
          quantity: 1,
          description: product.description || '',
          effects: product.effects || [],
          usableIn: product.usableIn || [],
          source: 'shop',
          purchasedAt: Date.now(),
        });

        // 更新库存
        if (product.stock > 0) {
          await this._shopData.updateStock(category, itemId, product.stock - 1);
        }

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:itemPurchased', {
            id: 'evt_' + Date.now(),
            type: 'shop:itemPurchased',
            data: { itemId, name: product.name, price },
            timestamp: Date.now(),
            source: 'shop-service',
          });
        }

        return { ok: true, item: product };
      } catch (e) {
        console.warn('[ShopService] buyItem 失败:', e);
        return { ok: false, error: 'purchase_failed' };
      }
    }

    /**
     * 使用道具
     * @param {string} charId - 角色ID
     * @param {string} itemId - 道具ID
     * @returns {Promise<Object>}
     */
    async useItem(charId, itemId) {
      try {
        // 查找背包中的物品
        const items = await this._backpackData.getItems();
        let item = null;
        let type = '';
        
        for (const [t, typeItems] of Object.entries(items)) {
          if (typeItems[itemId]) {
            item = typeItems[itemId];
            type = t;
            break;
          }
        }

        if (!item) {
          return { ok: false, error: 'item_not_found' };
        }

        // 检查是否可使用
        const usableIn = item.usableIn || [];
        if (usableIn.length > 0 && !usableIn.includes('any') && !usableIn.includes('consume')) {
          return { ok: false, error: 'not_usable', usableIn };
        }

        // 使用效果
        const effects = item.effects || [];
        const effectResults = [];
        
        for (const effect of effects) {
          try {
            const result = await this._applyEffect(charId, effect);
            effectResults.push(result);
          } catch (e) {
            console.warn('[ShopService] 应用效果失败:', effect, e);
          }
        }

        // 减少数量
        await this._backpackData.useItem(type, itemId, 1);

        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:itemUsed', {
            id: 'evt_' + Date.now(),
            type: 'shop:itemUsed',
            data: { itemId, name: item.name, effects: effectResults },
            timestamp: Date.now(),
            source: 'shop-service',
          });
        }

        return { ok: true, effects: effectResults };
      } catch (e) {
        console.warn('[ShopService] useItem 失败:', e);
        return { ok: false, error: 'use_failed' };
      }
    }

    /**
     * 赠送道具给NPC
     * @param {string} charId - 角色ID
     * @param {string} itemId - 道具ID
     * @param {string} npcId - NPC ID
     * @returns {Promise<Object>}
     */
    async giftItem(charId, itemId, npcId) {
      try {
        // 查找背包中的物品
        const items = await this._backpackData.getItems();
        let item = null;
        let type = '';
        
        for (const [t, typeItems] of Object.entries(items)) {
          if (typeItems[itemId]) {
            item = typeItems[itemId];
            type = t;
            break;
          }
        }

        if (!item) {
          return { ok: false, error: 'item_not_found' };
        }

        // 检查是否可赠送
        const usableIn = item.usableIn || [];
        if (usableIn.length > 0 && !usableIn.includes('any') && !usableIn.includes('gift')) {
          return { ok: false, error: 'not_giftable', usableIn };
        }

        // 减少数量
        await this._backpackData.useItem(type, itemId, 1);

        // 触发赠送事件
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('shop:itemGifted', {
            id: 'evt_' + Date.now(),
            type: 'shop:itemGifted',
            data: { itemId, name: item.name, npcId },
            timestamp: Date.now(),
            source: 'shop-service',
          });
        }

        return { ok: true, message: `已将 ${item.name} 赠送给 NPC` };
      } catch (e) {
        console.warn('[ShopService] giftItem 失败:', e);
        return { ok: false, error: 'gift_failed' };
      }
    }

    /**
     * 应用道具效果
     * @private
     */
    async _applyEffect(charId, effect) {
      const { type, value } = effect;
      
      switch (type) {
        case 'heal':
          // 恢复生命值
          return { type: 'heal', value, message: `恢复了 ${value} 点生命` };
        case 'buff':
          // 增益效果
          return { type: 'buff', value, message: `获得增益效果: +${value}` };
        case 'restore':
          // 恢复体力/能量
          return { type: 'restore', value, message: `恢复了 ${value} 点体力` };
        case 'unlock':
          // 解锁内容
          return { type: 'unlock', value, message: '解锁了新内容' };
        case 'cosmetic':
          // 外观变化
          return { type: 'cosmetic', value, message: '外观已改变' };
        default:
          return { type: 'unknown', value, message: '未知效果' };
      }
    }

    // ==================== AI 接口 ====================

    /**
     * AI 生成商品描述
     * @param {string} productName - 商品名称
     * @param {string} category - 商品类别
     * @returns {Promise<string>}
     */
    async generateProductDescription(productName, category) {
      try {
        const prompt = `请为以下商品生成一段简短的描述（50字以内），风格轻松有趣：
商品名称：${productName}
类别：${category || '通用'}`;
        
        const description = await this._aiService.generate(prompt, { 
          moduleId: 'shop',
          maxTokens: 100 
        });
        return description || '暂无描述';
      } catch (e) {
        console.warn('[ShopService] AI 生成商品描述失败:', e);
        return '暂无描述';
      }
    }

    /**
     * AI 生成商品推荐
     * @param {Object} context - 用户上下文（背包物品、偏好等）
     * @returns {Promise<Array>}
     */
    async generateRecommendations(context = {}) {
      try {
        const prompt = `作为一个游戏商店助手，请根据以下信息推荐3个商品（返回JSON数组格式）：
用户背包：${JSON.stringify(context.backpack || [])}
用户偏好：${context.preference || '未知'}

返回格式示例：
[{"name": "商品名", "reason": "推荐理由", "category": "类别"}]`;

        const result = await this._aiService.generate(prompt, { 
          moduleId: 'shop',
          maxTokens: 300 
        });
        
        // 尝试解析 JSON
        try {
          const match = result.match(/\[[\s\S]*\]/);
          return match ? JSON.parse(match[0]) : [];
        } catch {
          return [];
        }
      } catch (e) {
        console.warn('[ShopService] AI 生成推荐失败:', e);
        return [];
      }
    }

    /**
     * AI 生成商店活动文案
     * @returns {Promise<string>}
     */
    async generateEventNotice() {
      try {
        const prompt = '请生成一条商店促销活动公告（30字以内），风格活泼有趣，吸引玩家购买。';
        const notice = await this._aiService.generate(prompt, { 
          moduleId: 'shop',
          maxTokens: 50 
        });
        return notice || '今日特惠，欢迎选购！';
      } catch (e) {
        console.warn('[ShopService] AI 生成活动文案失败:', e);
        return '今日特惠，欢迎选购！';
      }
    }

    /**
     * 根据大世界刷新商店货架（周期性调用）
     */
    async refreshCatalogFromWorld(world) {
      try {
        if (!world) return false;
        const products = await this._shopData.getProducts();
        const consumable = products.consumable || {};
        const gifts = products.gift || products.gifts || {};

        const themes = world.keyLocations || world.factions || [world.theme, world.name].filter(Boolean);
        const seed = (themes[0] || '特惠').toString().substring(0, 8);
        const id = 'world_' + Date.now().toString(36).slice(-6);

        consumable[id] = {
          id,
          name: seed + '限定礼包',
          price: 50 + Math.floor(Math.random() * 150),
          currency: 'gold',
          description: (world.atmosphere || world.description || '').substring(0, 60),
          category: 'consumable',
        };

        products.consumable = consumable;
        await this._shopData.setProducts(products);

        if (this._platform?.eventBus) {
          // [铁则十一修复] 添加缺失的 id 字段
          this._platform.eventBus.emit('shop:catalogRefreshed', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'shop:catalogRefreshed',
            data: { productId: id },
            timestamp: Date.now(),
            source: 'shop-service',
          });
        }
        return true;
      } catch (e) {
        console.warn('[ShopService] refreshCatalogFromWorld 失败:', e);
        return false;
      }
    }

    subscribeProducts(callback) {
      return this._shopData.subscribeProducts(callback);
    }

    subscribeCart(callback) {
      return this._shopData.subscribeCart(callback);
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Shop = ShopService;

  console.log('[Service] ShopService 已加载 (Phase 5 增强版)');
})();
