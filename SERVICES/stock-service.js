;(function () {
  'use strict';

  class StockService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._stockData = new (window.PhoneData?.Stock || function () {})(this._platform);
    }

    _economy() {
      try {
        return this._platform?.get?.('economyService') || null;
      } catch (e) {
        console.warn('[StockService] 获取 EconomyService 失败:', e);
        return null;
      }
    }

    async getMarket() {
      const m = await this._stockData.getMarket();
      for (const s of m.symbols || []) {
        const drift = (Math.random() - 0.5) * 0.08;
        s.price = Math.max(1, +(s.price * (1 + drift)).toFixed(2));
        s.change = drift;
      }
      await this._stockData.saveMarket(m);
      return m;
    }

    async getPortfolio() {
      return await this._stockData.getPortfolio();
    }

    async buy(symbolId, shares) {
      const market = await this.getMarket();
      const sym = (market.symbols || []).find((s) => s.id === symbolId);
      if (!sym || shares < 1) return { ok: false };
      const cost = Math.ceil(sym.price * shares);
      const eco = this._economy();
      if (!eco || !(await eco.spend(cost, 'gold', '买入 ' + sym.name))) {
        return { ok: false, reason: 'insufficient' };
      }
      const p = await this._stockData.getPortfolio();
      p.holdings = p.holdings || [];
      let h = p.holdings.find((x) => x.symbolId === symbolId);
      if (!h) {
        h = { symbolId, shares: 0, avgPrice: sym.price };
        p.holdings.push(h);
      }
      h.avgPrice = ((h.avgPrice * h.shares) + sym.price * shares) / (h.shares + shares);
      h.shares += shares;
      await this._stockData.savePortfolio(p);
      return { ok: true, cost };
    }

    async sell(symbolId, shares) {
      const market = await this.getMarket();
      const sym = (market.symbols || []).find((s) => s.id === symbolId);
      const p = await this._stockData.getPortfolio();
      const h = (p.holdings || []).find((x) => x.symbolId === symbolId);
      if (!sym || !h || h.shares < shares) return { ok: false };
      const gain = Math.floor(sym.price * shares);
      h.shares -= shares;
      if (h.shares <= 0) p.holdings = p.holdings.filter((x) => x.symbolId !== symbolId);
      await this._stockData.savePortfolio(p);
      const eco = this._economy();
      if (eco) await eco.add(gain, 'gold', '卖出 ' + sym.name);
      return { ok: true, gain };
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Stock = StockService;
})();
