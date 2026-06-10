/**
 * InventoryService - 背包业务逻辑
 * 纯数据操作，无 DOM，无渲染
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Inventory
 */

;(function () {
  'use strict';

  class InventoryService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._backpackData = new (window.PhoneData?.Backpack || function(){})(this._platform);
    }

    async getItems() {
      try {
        return await this._backpackData.getItems();
      } catch (e) {
        console.warn('[InventoryService] getItems 失败:', e);
        return null;
      }
    }

    async getItemsByType(type) {
      try {
        return await this._backpackData.getItemsByType(type);
      } catch (e) {
        console.warn('[InventoryService] getItemsByType 失败:', e);
        return null;
      }
    }

    async getItem(type, itemId) {
      try {
        return await this._backpackData.getItem(type, itemId);
      } catch (e) {
        console.warn('[InventoryService] getItem 失败:', e);
        return null;
      }
    }

    async getEquipment() {
      try {
        return await this._backpackData.getEquipment();
      } catch (e) {
        console.warn('[InventoryService] getEquipment 失败:', e);
        return null;
      }
    }

    async getCurrency() {
      try {
        const base = (await this._backpackData.getCurrency()) || {};
        const economy = this._platform?.get?.('economyService');
        if (economy?.getBalance) {
          const gold = await economy.getBalance('gold');
          base.gold = gold;
        }
        return base;
      } catch (e) {
        console.warn('[InventoryService] getCurrency 失败:', e);
        return null;
      }
    }

    async useItem(type, itemId, count = 1) {
      try {
        const result = await this._backpackData.useItem(type, itemId, count);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('inventory:itemUsed', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'inventory:itemUsed',
            data: { itemId, name: result?.name },
            timestamp: Date.now(),
            source: 'inventory-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[InventoryService] useItem 失败:', e);
        return false;
      }
    }

    async equipItem(type, itemId, slot) {
      try {
        const result = await this._backpackData.equipItem(type, itemId, slot);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('inventory:itemEquipped', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'inventory:itemEquipped',
            data: { itemId, slot },
            timestamp: Date.now(),
            source: 'inventory-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[InventoryService] equipItem 失败:', e);
        return false;
      }
    }

    async unequipItem(slot) {
      try {
        const result = await this._backpackData.unequipItem(slot);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('inventory:itemUnequipped', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'inventory:itemUnequipped',
            data: { itemId: result?.itemId, slot },
            timestamp: Date.now(),
            source: 'inventory-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[InventoryService] unequipItem 失败:', e);
        return false;
      }
    }

    async updateCurrency(currency) {
      try {
        const result = await this._backpackData.updateCurrency(currency);
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('inventory:currencyUpdated', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'inventory:currencyUpdated',
            data: { currency, amount: result?.amount },
            timestamp: Date.now(),
            source: 'inventory-service'
          });
        }
        return result;
      } catch (e) {
        console.warn('[InventoryService] updateCurrency 失败:', e);
        return false;
      }
    }

    subscribeItems(callback) {
      return this._backpackData.subscribeItems(callback);
    }

    subscribeEquipment(callback) {
      return this._backpackData.subscribeEquipment(callback);
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Inventory = InventoryService;

  console.log('[Service] InventoryService 已加载');
})();
