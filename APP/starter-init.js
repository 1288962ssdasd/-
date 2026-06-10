/**
 * starter-init.js - 新手经济与任务初始化
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 初始化新手钱包和初始任务
   * 确保新用户拥有初始金币和引导任务
   */
  async function init() {
    try {
      var eco = window.Platform?.get?.('economyService');
      if (eco?.ensureStarterWallet) await eco.ensureStarterWallet();
      var quest = window.Platform?.get?.('questService');
      if (quest?.ensureStarterQuest) await quest.ensureStarterQuest();
    } catch (e) {
      console.warn('[Phone Init] 新手经济/任务初始化失败:', e);
    }
  }

  window.PhoneStarterInit = {
    init: init,
  };

})();
