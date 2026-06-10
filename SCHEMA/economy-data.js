/**
 * EconomyData - 经济数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:economy:{key}
 *
 * 用于存储玩家和NPC的经济数据、交易记录、股市等
 */

;(function () {
  'use strict';

  const DOMAIN = 'economy';

  // 货币类型
  const CURRENCY_TYPE = {
    GOLD: 'gold',       // 金币
    DIAMOND: 'diamond', // 钻石
    CREDIT: 'credit',   // 信用点
  };

  // 交易类型
  const TRANSACTION_TYPE = {
    INCOME: 'income',           // 收入
    EXPENSE: 'expense',         // 支出
    TRANSFER_IN: 'transfer_in', // 转入
    TRANSFER_OUT: 'transfer_out', // 转出
    QUEST_REWARD: 'quest_reward', // 任务奖励
    SHOP_PURCHASE: 'shop_purchase', // 商店购买
    STOCK_BUY: 'stock_buy',     // 股票买入
    STOCK_SELL: 'stock_sell',   // 股票卖出
    NPC_GIFT: 'npc_gift',       // NPC赠送
    NPC_RED_PACKET: 'npc_red_packet', // NPC红包
  };

  class EconomyData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 玩家经济 ====================

    async getPlayerWallet(charId) {
      return await this._platform.data(DOMAIN, charId + ':wallet', {
        gold: 5000,      // 初始金币
        diamond: 0,
        credit: 0,
        lastUpdated: Date.now()
      });
    }

    async savePlayerWallet(charId, wallet) {
      wallet.lastUpdated = Date.now();
      await this._platform.setData(DOMAIN, charId + ':wallet', wallet);
      return wallet;
    }

    async getBalance(charId, currency = CURRENCY_TYPE.GOLD) {
      const wallet = await this.getPlayerWallet(charId);
      return wallet[currency] || 0;
    }

    async setBalance(charId, currency, amount) {
      const wallet = await this.getPlayerWallet(charId);
      const oldAmount = wallet[currency] || 0;
      wallet[currency] = Math.max(0, amount);
      await this.savePlayerWallet(charId, wallet);
      return {
        currency,
        oldAmount,
        newAmount: wallet[currency],
        delta: wallet[currency] - oldAmount
      };
    }

    async addBalance(charId, currency, amount, reason = '') {
      const wallet = await this.getPlayerWallet(charId);
      const oldAmount = wallet[currency] || 0;
      wallet[currency] = Math.max(0, oldAmount + amount);
      await this.savePlayerWallet(charId, wallet);

      // 记录交易
      if (amount !== 0) {
        await this.recordTransaction(charId, {
          type: amount > 0 ? TRANSACTION_TYPE.INCOME : TRANSACTION_TYPE.EXPENSE,
          currency,
          amount: Math.abs(amount),
          balanceAfter: wallet[currency],
          reason,
          counterparty: null
        });
      }

      return {
        currency,
        oldAmount,
        newAmount: wallet[currency],
        delta: amount
      };
    }

    // ==================== NPC经济 ====================

    async getNPCWallet(charId, npcId) {
      return await this._platform.data(DOMAIN, charId + ':npc:' + npcId + ':wallet', {
        gold: Math.floor(Math.random() * 10000) + 1000, // 随机初始资金
        lastUpdated: Date.now()
      });
    }

    async saveNPCWallet(charId, npcId, wallet) {
      wallet.lastUpdated = Date.now();
      await this._platform.setData(DOMAIN, charId + ':npc:' + npcId + ':wallet', wallet);
      return wallet;
    }

    /** @deprecated 业务逻辑已迁移到 EconomyService，请通过 Service 层调用 */
    async transfer(charId, fromNpcId, toNpcId, amount, reason = '') {
      // 扣减转出方
      const fromWallet = await this.getNPCWallet(charId, fromNpcId);
      if (fromWallet.gold < amount) {
        return { success: false, error: '余额不足' };
      }
      fromWallet.gold -= amount;
      await this.saveNPCWallet(charId, fromNpcId, fromWallet);

      // 增加转入方
      const toWallet = await this.getNPCWallet(charId, toNpcId);
      toWallet.gold += amount;
      await this.saveNPCWallet(charId, toNpcId, toWallet);

      // 记录交易
      await this.recordTransaction(charId, {
        type: TRANSACTION_TYPE.TRANSFER_IN,
        currency: CURRENCY_TYPE.GOLD,
        amount,
        balanceAfter: toWallet.gold,
        reason,
        counterparty: fromNpcId,
        direction: 'in'
      });

      return {
        success: true,
        from: fromNpcId,
        to: toNpcId,
        amount
      };
    }

    // ==================== 交易记录 ====================

    async getTransactions(charId, options = {}) {
      const {
        limit = 50,
        offset = 0,
        type = null,
        currency = null
      } = options;

      let transactions = await this._platform.data(DOMAIN, charId + ':transactions', []);

      // 过滤
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      if (currency) {
        transactions = transactions.filter(t => t.currency === currency);
      }

      // 分页
      return transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(offset, offset + limit);
    }

    async recordTransaction(charId, {
      type,
      currency,
      amount,
      balanceAfter,
      reason = '',
      counterparty = null,
      metadata = {}
    }) {
      const transaction = {
        id: this._generateId(),
        type,
        currency,
        amount,
        balanceAfter,
        reason,
        counterparty,
        metadata,
        timestamp: Date.now()
      };

      const transactions = await this._platform.data(DOMAIN, charId + ':transactions', []);
      transactions.push(transaction);

      // 限制记录数量（保留最近200条）
      if (transactions.length > 200) {
        transactions.splice(0, transactions.length - 200);
      }

      await this._platform.setData(DOMAIN, charId + ':transactions', transactions);
      return transaction;
    }

    // ==================== 股市数据 ====================

    async getStockMarket(charId) {
      return await this._platform.data(DOMAIN, charId + ':stock_market', {
        trend: 'stable', // stable, boom, recession
        index: 1000,     // 股市指数
        volatility: 0.02, // 波动率
        lastUpdate: Date.now()
      });
    }

    async saveStockMarket(charId, market) {
      market.lastUpdate = Date.now();
      await this._platform.setData(DOMAIN, charId + ':stock_market', market);
      return market;
    }

    async updateStockMarket(charId, changes) {
      const market = await this.getStockMarket(charId);
      Object.assign(market, changes);
      return await this.saveStockMarket(charId, market);
    }

    // ==================== 玩家持仓 ====================

    async getStockHoldings(charId) {
      return await this._platform.data(DOMAIN, charId + ':stock_holdings', {});
    }

    async saveStockHoldings(charId, holdings) {
      await this._platform.setData(DOMAIN, charId + ':stock_holdings', holdings);
      return holdings;
    }

    /** @deprecated 业务逻辑已迁移到 StockService，请通过 Service 层调用 */
    async buyStock(charId, stockCode, quantity, price, totalCost) {
      // 纯数据存取：保存持仓数据和扣款记录
      // 余额验证、价格计算等业务逻辑由 Service 层（economy-service/stock-service）负责

      // 扣减金币
      const wallet = await this.getPlayerWallet(charId);
      wallet.gold -= totalCost;
      await this.savePlayerWallet(charId, wallet);

      // 增加持仓
      const holdings = await this.getStockHoldings(charId);
      if (!holdings[stockCode]) {
        holdings[stockCode] = { quantity: 0, avgPrice: 0 };
      }

      const oldQuantity = holdings[stockCode].quantity;
      const oldValue = oldQuantity * holdings[stockCode].avgPrice;
      const newValue = oldValue + totalCost;
      const newQuantity = oldQuantity + quantity;

      holdings[stockCode].quantity = newQuantity;
      holdings[stockCode].avgPrice = newValue / newQuantity;
      holdings[stockCode].lastBuy = { price, quantity, timestamp: Date.now() };

      await this.saveStockHoldings(charId, holdings);

      // 记录交易
      await this.recordTransaction(charId, {
        type: TRANSACTION_TYPE.STOCK_BUY,
        currency: CURRENCY_TYPE.GOLD,
        amount: totalCost,
        balanceAfter: wallet.gold,
        reason: `买入 ${stockCode} x${quantity} @${price}`,
        counterparty: 'stock_market'
      });

      return {
        success: true,
        stockCode,
        quantity,
        price,
        totalCost,
        holdings: holdings[stockCode]
      };
    }

    /** @deprecated 业务逻辑已迁移到 StockService，请通过 Service 层调用 */
    async sellStock(charId, stockCode, quantity, price, totalRevenue) {
      // 纯数据存取：保存持仓数据和入账记录
      // 持仓验证、收益计算等业务逻辑由 Service 层（economy-service/stock-service）负责

      // 减少持仓
      const holdings = await this.getStockHoldings(charId);
      holdings[stockCode].quantity -= quantity;
      holdings[stockCode].lastSell = { price, quantity, timestamp: Date.now() };

      if (holdings[stockCode].quantity === 0) {
        delete holdings[stockCode];
      }

      await this.saveStockHoldings(charId, holdings);

      // 增加金币
      const wallet = await this.getPlayerWallet(charId);
      wallet.gold += totalRevenue;
      await this.savePlayerWallet(charId, wallet);

      // 记录交易
      await this.recordTransaction(charId, {
        type: TRANSACTION_TYPE.STOCK_SELL,
        currency: CURRENCY_TYPE.GOLD,
        amount: totalRevenue,
        balanceAfter: wallet.gold,
        reason: `卖出 ${stockCode} x${quantity} @${price}`,
        counterparty: 'stock_market'
      });

      return {
        success: true,
        stockCode,
        quantity,
        price,
        totalRevenue,
        holdings: holdings[stockCode] || null
      };
    }

    // ==================== 清理 ====================

    async clearAll(charId) {
      await this._platform.setData(DOMAIN, charId + ':wallet', null);
      await this._platform.setData(DOMAIN, charId + ':transactions', null);
      await this._platform.setData(DOMAIN, charId + ':stock_holdings', null);
      await this._platform.setData(DOMAIN, charId + ':stock_market', null);
    }

    // ==================== 工具方法 ====================

    _generateId() {
      return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 格式化经济数据为AI上下文
    /** @deprecated 数据格式化逻辑已迁移到 EconomyService，请通过 Service 层调用 */
    async formatForAI(charId, options = {}) {
      const {
        includeTransactions = false,
        transactionCount = 5
      } = options;

      const wallet = await this.getPlayerWallet(charId);
      const market = await this.getStockMarket(charId);
      const holdings = await this.getStockHoldings(charId);

      const lines = [];
      lines.push(`玩家经济状况:`);
      lines.push(`- 金币: ${wallet.gold}`);
      lines.push(`- 钻石: ${wallet.diamond}`);
      lines.push(`- 股市指数: ${market.index} (${market.trend})`);

      const holdingList = Object.entries(holdings);
      if (holdingList.length > 0) {
        lines.push(`- 股票持仓:`);
        for (const [code, holding] of holdingList) {
          lines.push(`  - ${code}: ${holding.quantity}股 (均价: ${holding.avgPrice.toFixed(2)})`);
        }
      }

      if (includeTransactions) {
        const transactions = await this.getTransactions(charId, { limit: transactionCount });
        if (transactions.length > 0) {
          lines.push(`- 最近交易:`);
          for (const t of transactions) {
            lines.push(`  - ${new Date(t.timestamp).toLocaleDateString()}: ${t.reason || t.type} ${t.amount}${t.currency}`);
          }
        }
      }

      return lines.join('\n');
    }
  }

  // 挂载到全局
  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Economy = EconomyData;
  window.CURRENCY_TYPE = CURRENCY_TYPE;
  window.TRANSACTION_TYPE = TRANSACTION_TYPE;

  console.log('[Schema] EconomyData 已加载');
})();
