/**
 * EconomyService - 统一货币/数值经济层
 * [铁则一] 通过 StatusData 读写 gold 等
 * [铁则三] 不操作 DOM
 */

;(function () {
  'use strict';

  const CURRENCY_FIELD = {
    gold: 'gold',
    money: 'gold',
    金币: 'gold',
  };

  class EconomyService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._statusData = new (window.PhoneData?.Status || function () {})(this._platform);
    }

    _resolveField(currency) {
      const key = (currency || 'gold').toString().toLowerCase();
      return CURRENCY_FIELD[key] || key;
    }

    async getBalance(currency) {
      try {
        const field = this._resolveField(currency);
        const status = await this._statusData.getUserStatus();
        return Number(status?.[field]) || 0;
      } catch (e) {
        console.warn('[EconomyService] getBalance 失败:', e);
        return 0;
      }
    }

    async canAfford(amount, currency) {
      const cost = Math.max(0, Number(amount) || 0);
      if (cost === 0) return true;
      const balance = await this.getBalance(currency);
      return balance >= cost;
    }

    async add(amount, currency, reason, meta) {
      const delta = Number(amount) || 0;
      if (delta === 0) return { ok: true, balance: await this.getBalance(currency) };

      try {
        const field = this._resolveField(currency);
        const status = await this._statusData.getUserStatus();
        const next = (Number(status?.[field]) || 0) + delta;
        await this._statusData.updateUserStatus({ [field]: next });

        this._emit('economy:credited', { amount: delta, currency: field, reason, meta, balance: next });

        this._emit('economy:transactionCompleted', {
          action: 'earn_gold',
          amount: delta,
          currency: field,
          reason,
          meta
        });

        return { ok: true, balance: next };
      } catch (e) {
        console.warn('[EconomyService] add 失败:', e);
        return { ok: false, error: e.message };
      }
    }

    async spend(amount, currency, reason, meta) {
      const cost = Math.max(0, Number(amount) || 0);
      if (cost === 0) return { ok: true, balance: await this.getBalance(currency) };

      try {
        const field = this._resolveField(currency);
        const balance = await this.getBalance(currency);
        if (balance < cost) {
          return { ok: false, error: 'insufficient_funds', balance, required: cost };
        }

        const next = balance - cost;
        await this._statusData.updateUserStatus({ [field]: next });

        this._emit('economy:spent', { amount: cost, currency: field, reason, meta, balance: next });

        this._emit('economy:transactionCompleted', {
          action: 'spend_gold',
          amount: cost,
          currency: field,
          reason,
          meta
        });

        this._emit('economy:transactionCompleted', {
          action: 'shop_checkout',
          amount: cost,
          currency: field,
          reason,
          meta
        });

        return { ok: true, balance: next };
      } catch (e) {
        console.warn('[EconomyService] spend 失败:', e);
        return { ok: false, error: e.message };
      }
    }

    async applyReward(rewards) {
      if (!rewards || typeof rewards !== 'object') return;

      if (rewards.gold) await this.add(rewards.gold, 'gold', 'quest_reward');
      if (rewards.money) await this.add(rewards.money, 'gold', 'quest_reward');

      if (rewards.exp) {
        const status = await this._statusData.getUserStatus();
        await this._statusData.updateUserStatus({ exp: (Number(status?.exp) || 0) + Number(rewards.exp) });
      }

      if (rewards.hp) {
        const status = await this._statusData.getUserStatus();
        const maxHp = Number(status?.maxHp) || 100;
        const hp = Math.min(maxHp, (Number(status?.hp) || 0) + Number(rewards.hp));
        await this._statusData.updateUserStatus({ hp });
      }
    }

    async addGold(amount, reason, meta) {
      return this.add(amount, 'gold', reason, meta);
    }

    async spendGold(amount, reason, meta) {
      return this.spend(amount, 'gold', reason, meta);
    }

    async ensureStarterWallet() {
      try {
        const bal = await this.getBalance('gold');
        if (bal >= 50) return { ok: true, balance: bal, skipped: true };
        return await this.add(500, 'gold', 'starter_wallet');
      } catch (e) {
        console.warn('[EconomyService] ensureStarterWallet 失败:', e);
        return { ok: false };
      }
    }

    _emit(type, data) {
      if (!this._platform?.eventBus) return;
      this._platform.eventBus.emit(type, {
        id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        type,
        data,
        timestamp: Date.now(),
        source: 'economy-service',
      });
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Economy = EconomyService;

  console.log('[Service] EconomyService 已加载');
})();
