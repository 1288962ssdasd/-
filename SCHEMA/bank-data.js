/**
 * BankData - 银行数据 Schema 辅助函数
 *
 * 启动阶段：阶段 3（Schema 注册）
 * 全局挂载：window.PhoneData.Bank
 *
 * 铁则合规：
 *   - 所有数据读写通过 Schema 辅助函数（铁则一）
 *   - 不直接调用 Platform.setData() 或 localStorage
 */

;(function () {
  'use strict';
  const DOMAIN = 'bank';

  class BankData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    async getAccount() {
      await this._waitForReady();
      return await this._get('account', { balance: 0, transactions: [] });
    }

    async saveAccount(account) {
      await this._waitForReady();
      await this._set('account', account);
      return true;
    }

    async _waitForReady() {
      if (this._ready) return;
      var self = this;
      return new Promise(function (resolve) {
        var check = function () {
          if (self._platform?.isReady) {
            self._ready = true;
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    async _get(key, def) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化');
        return def;
      }

      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[Schema] Platform 就绪超时，使用默认值');
          return def;
        }
      }

      const v = await this._platform.data(DOMAIN, key, def);
      return v == null ? def : v;
    }

    async _set(key, val) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }

      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      await this._platform.setData(DOMAIN, key, val, { persist: true });
      return true;
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Bank = BankData;
})();
