/**
 * status-bar-economy.js - 状态栏经济数据绑定
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 绑定状态栏经济数据显示
   * 监听经济相关事件，实时更新状态栏金币显示
   */
  function bind() {
    try {
      var update = async function () {
        var economy = window.Platform?.get?.('economyService');
        if (!economy) return;
        var gold = await economy.getBalance('gold');
        var el = document.querySelector('.phone-status-bar .status-gold');
        if (el) el.textContent = '\u{1FA99}' + gold;
        if (window.__phoneRenderer?.updateStatusGold) {
          window.__phoneRenderer.updateStatusGold(gold);
        }
      };
      update();
      var bus = window.Platform?.eventBus;
      if (bus) {
        bus.on('economy:spent', update);
        bus.on('economy:credited', update);
        bus.on('status:userUpdated', update);
        bus.on('quest:completed', update);
      }
    } catch (e) {
      console.warn('[Phone Init] 状态栏经济绑定失败:', e);
    }
  }

  window.PhoneStatusBarEconomy = {
    bind: bind,
  };

})();
