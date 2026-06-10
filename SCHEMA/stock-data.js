/**
 * StockData — 股票数据 Schema（独立于 EconomyData）
 *
 * 注意：EconomyData 中也有股市相关方法（getStockMarket, buyStock, sellStock）。
 * 当前两者并存，StockData 专注于持仓数据，EconomyData 专注于行情和交易逻辑。
 * 后续应统一到一个 Schema 中。
 */

;(function () {
  'use strict';
  const DOMAIN = 'stock';

  class StockData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    async getMarket() {
      return await this._get('market', {
        symbols: [
          { id: 'ST001', name: '猫盒科技', price: 12.5, change: 0.02 },
          { id: 'ST002', name: '小白传媒', price: 8.3, change: -0.01 },
          { id: 'ST003', name: '梦境能源', price: 25.0, change: 0.05 },
        ],
      });
    }

    async getPortfolio() {
      return await this._get('portfolio', { holdings: [], cash: 0 });
    }

    async savePortfolio(p) {
      await this._set('portfolio', p);
      return true;
    }

    async saveMarket(m) {
      await this._set('market', m);
      return true;
    }

    async _get(key, def) {
      const v = await this._platform?.data?.(DOMAIN, key, def);
      return v == null ? def : v;
    }

    async _set(key, val) {
      await this._platform?.setData?.(DOMAIN, key, val);
      return true;
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Stock = StockData;
})();
