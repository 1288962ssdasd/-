;(function () {
  'use strict';

  class BankService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._bankData = new (window.PhoneData?.Bank || function () {})(this._platform);
    }

    _economy() {
      try {
        return this._platform?.get?.('economyService') || null;
      } catch (e) {
        console.warn('[BankService] 获取 EconomyService 失败:', e);
        return null;
      }
    }

    async getBalance() {
      const acc = await this._bankData.getAccount();
      return acc.balance || 0;
    }

    async getWalletGold() {
      const eco = this._economy();
      if (!eco) return 0;
      return await eco.getBalance('gold');
    }

    async getHistory() {
      const acc = await this._bankData.getAccount();
      const transactions = (acc.transactions || []).slice(0, 5);
      return transactions.map(function (t) {
        return {
          type: t.type,
          amount: t.amount,
          time: t.at ? new Date(t.at).toLocaleString() : ''
        };
      });
    }

    async depositFromWallet(amount) {
      const eco = this._economy();
      if (!eco || amount <= 0) return { ok: false, reason: 'invalid' };
      const spent = await eco.spend(amount, 'gold', '银行存款');
      if (!spent) return { ok: false, reason: 'insufficient' };
      const acc = await this._bankData.getAccount();
      acc.balance = (acc.balance || 0) + amount;
      acc.transactions = acc.transactions || [];
      acc.transactions.unshift({ type: 'deposit', amount, at: Date.now() });
      await this._bankData.saveAccount(acc);
      return { ok: true, balance: acc.balance };
    }

    async withdrawToWallet(amount) {
      if (amount <= 0) return { ok: false };
      const acc = await this._bankData.getAccount();
      if ((acc.balance || 0) < amount) return { ok: false, reason: 'insufficient' };
      acc.balance -= amount;
      acc.transactions.unshift({ type: 'withdraw', amount, at: Date.now() });
      await this._bankData.saveAccount(acc);
      const eco = this._economy();
      if (eco) await eco.add(amount, 'gold', '银行取款');
      return { ok: true, balance: acc.balance };
    }

    async transferInterest(rate) {
      const acc = await this._bankData.getAccount();
      const interest = Math.floor((acc.balance || 0) * (rate || 0.01));
      if (interest > 0) {
        acc.balance += interest;
        acc.transactions.unshift({ type: 'interest', amount: interest, at: Date.now() });
        await this._bankData.saveAccount(acc);
      }
      return interest;
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Bank = BankService;
})();
