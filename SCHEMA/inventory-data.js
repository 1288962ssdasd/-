/**
 * InventoryData - 背包/库存数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Backpack
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';

  const DOMAIN = 'backpack';

  // 物品类型常量
  const ITEM_TYPES = {
    WEAPON: 'weapon',       // 武器
    ARMOR: 'armor',         // 防具
    ACCESSORY: 'accessory', // 饰品
    CONSUMABLE: 'consumable', // 消耗品
    MATERIAL: 'material',   // 材料
    QUEST: 'quest',         // 任务物品
    MISC: 'misc',           // 杂项
  };

  // 装备槽位常量
  const EQUIP_SLOTS = {
    HEAD: 'head',           // 头部
    BODY: 'body',           // 身体
    HANDS: 'hands',         // 手部
    FEET: 'feet',           // 脚部
    ACCESSORY_1: 'accessory1', // 饰品1
    ACCESSORY_2: 'accessory2', // 饰品2
    WEAPON: 'weapon',       // 武器
  };

  /**
   * InventoryData 背包数据操作类
   */
  class InventoryData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有物品
     * @returns {Promise<Object>} 分类物品对象
     */
    async getItems() {
      return await this._get('items', {});
    }

    /**
     * 获取某类物品
     * @param {string} type
     * @returns {Promise<Object>}
     */
    async getItemsByType(type) {
      const items = await this.getItems();
      return items[type] || {};
    }

    /**
     * 获取单个物品
     * @param {string} type
     * @param {string} itemId
     * @returns {Promise<Object|null>}
     */
    async getItem(type, itemId) {
      const items = await this.getItems();
      return items[type]?.[itemId] || null;
    }

    /**
     * 获取装备栏
     * @returns {Promise<Object>}
     */
    async getEquipment() {
      return await this._get('equipment', {
        head: null,
        body: null,
        hands: null,
        feet: null,
        accessory1: null,
        accessory2: null,
        weapon: null,
      });
    }

    /**
     * 获取货币
     * @returns {Promise<Object>}
     */
    async getCurrency() {
      return await this._get('currency', {
        gold: 0,
        silver: 0,
        gems: 0,
      });
    }

    // ==================== 写入操作 ====================

    /**
     * 设置所有物品
     * @param {Object} items
     * @returns {Promise<boolean>}
     */
    async setItems(items) {
      await this._set('items', items);
      this._emit('inventory:updated', { items });
      return true;
    }

    /**
     * 添加物品
     * @param {string} type
     * @param {string} itemId
     * @param {Object} item
     * @returns {Promise<boolean>}
     */
    async addItem(type, itemId, item) {
      const items = await this.getItems();

      if (!items[type]) items[type] = {};

      // 如果物品已存在，累加数量而不是覆盖
      if (items[type][itemId]) {
        items[type][itemId].quantity = (items[type][itemId].quantity || 0) + (item.quantity || 1);
      } else {
        items[type][itemId] = {
          id: itemId,
          name: item.name || '未知物品',
          type: type,
          description: item.description || '',
          quantity: item.quantity || 1,
          rarity: item.rarity || 'common',
          attributes: item.attributes || {},
          icon: item.icon || '',
        };
      }

      await this._set('items', items);
      this._emit('inventory:itemAdded', { type, itemId, item: items[type][itemId] });
      return true;
    }

    /**
     * 更新物品数量
     * @param {string} type
     * @param {string} itemId
     * @param {number} quantity
     * @returns {Promise<boolean>}
     */
    async updateQuantity(type, itemId, quantity) {
      const items = await this.getItems();

      if (!items[type]?.[itemId]) return false;

      if (quantity <= 0) {
        delete items[type][itemId];
      } else {
        items[type][itemId].quantity = quantity;
      }

      await this._set('items', items);
      this._emit('inventory:quantityUpdated', { type, itemId, quantity });
      return true;
    }

    /**
     * 使用物品
     * @param {string} type
     * @param {string} itemId
     * @param {number} count
     * @returns {Promise<boolean>}
     */
    async useItem(type, itemId, count = 1) {
      const items = await this.getItems();

      if (!items[type]?.[itemId]) return false;

      const item = items[type][itemId];
      if (item.quantity < count) return false;

      item.quantity -= count;

      if (item.quantity <= 0) {
        delete items[type][itemId];
      }

      await this._set('items', items);
      this._emit('inventory:itemUsed', { type, itemId, count });
      return true;
    }

    /**
     * 装备物品
     * @param {string} type
     * @param {string} itemId
     * @param {string} slot
     * @returns {Promise<boolean>}
     */
    /** @deprecated 业务逻辑已迁移到 InventoryService，请通过 Service 层调用 */
    async equipItem(type, itemId, slot) {
      const items = await this.getItems();
      const equipment = await this.getEquipment();

      const item = items[type]?.[itemId];
      if (!item) return false;

      // 如果槽位已有装备，先卸下
      const currentEquipped = equipment[slot];
      if (currentEquipped) {
        // 将当前装备放回背包
        if (!items[currentEquipped.type]) items[currentEquipped.type] = {};
        items[currentEquipped.type][currentEquipped.id] = currentEquipped;
      }

      // 装备新物品
      equipment[slot] = { ...item, type, id: itemId };

      // 从背包移除
      delete items[type][itemId];

      await this._set('items', items);
      await this._set('equipment', equipment);

      this._emit('inventory:equipped', { type, itemId, slot });
      return true;
    }

    /**
     * 卸下装备
     * @param {string} slot
     * @returns {Promise<boolean>}
     */
    async unequipItem(slot) {
      const items = await this.getItems();
      const equipment = await this.getEquipment();

      const equipped = equipment[slot];
      if (!equipped) return false;

      // 放回背包
      if (!items[equipped.type]) items[equipped.type] = {};
      items[equipped.type][equipped.id] = equipped;

      // 清空槽位
      equipment[slot] = null;

      await this._set('items', items);
      await this._set('equipment', equipment);

      this._emit('inventory:unequipped', { slot });
      return true;
    }

    /**
     * 更新货币
     * @param {Object} currency
     * @returns {Promise<boolean>}
     */
    async updateCurrency(currency) {
      const current = await this.getCurrency();
      const updated = { ...current, ...currency };
      await this._set('currency', updated);
      this._emit('inventory:currencyUpdated', { currency: updated });
      return true;
    }

    // ==================== 订阅 ====================

    /**
     * 订阅物品变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeItems(callback) {
      return this._subscribe('items', callback);
    }

    /**
     * 订阅装备变更
     * @param {Function} callback
     * @returns {Function}
     */
    subscribeEquipment(callback) {
      return this._subscribe('equipment', callback);
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
      // no-op: 事件发射由 InventoryService 负责
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Backpack = InventoryData;
  window.PhoneData.Backpack.ITEM_TYPES = ITEM_TYPES;
  window.PhoneData.Backpack.EQUIP_SLOTS = EQUIP_SLOTS;

  console.log('[Schema] InventoryData (Backpack) 已加载');
})();
