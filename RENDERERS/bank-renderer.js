/**
 * @layer Renderer
 * @file   bank-renderer.js
 *
 * 职责: 银行模块 UI 渲染
 * 禁止: 包含业务逻辑、调用 Service、直接操作 Schema
 *
 * 铁则合规：
 *   - 纯展示层，只接收数据对象返回 DOM（铁则三）
 *   - CSS 类名以 bank- 前缀隔离（铁则二十一）
 *   - 通过 callbacks 回调交互事件，不直接调用 Service
 */

;(function () {
  'use strict';

  // ==================== 工具函数 ====================

  /**
   * HTML 转义
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Renderer 类 ====================

  class BankRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;
      const style = document.createElement('style');
      style.id = 'bank-module-styles';
      style.textContent = `
        /* ===== bank-app: 深色主题容器 ===== */
        .bank-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          color: #ffffff;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* ===== bank-header: 顶部导航栏 ===== */
        .bank-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #1e3a2f 0%, #16213E 100%);
          padding: 14px 16px;
          flex-shrink: 0;
        }
        .bank-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bank-title-icon {
          font-size: 22px;
        }

        /* ===== bank-btn-refresh: 刷新按钮 ===== */
        .bank-btn-refresh {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.1);
          color: #fff;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
        }
        .bank-btn-refresh:active {
          transform: scale(0.9);
        }
        .bank-btn-refresh.loading {
          animation: bank-spin 1s linear infinite;
        }
        @keyframes bank-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ===== bank-body: 主内容区域 ===== */
        .bank-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ===== bank-balance-card: 余额卡片 ===== */
        .bank-balance-card {
          background: linear-gradient(135deg, #16213E 0%, #0f3460 100%);
          border-radius: 12px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }
        .bank-balance-card::before {
          content: '';
          position: absolute;
          top: -30px;
          right: -30px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: rgba(52, 199, 89, 0.15);
        }
        .bank-balance-label {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          margin-bottom: 8px;
        }
        .bank-balance-value {
          font-size: 36px;
          font-weight: 700;
          color: #34c759;
          line-height: 1.2;
        }
        .bank-balance-unit {
          font-size: 16px;
          font-weight: 400;
          color: rgba(255,255,255,0.5);
          margin-left: 4px;
        }

        /* ===== bank-wallet-card: 钱包余额卡片 ===== */
        .bank-wallet-card {
          background: #16213E;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .bank-wallet-label {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
        }
        .bank-wallet-value {
          font-size: 20px;
          font-weight: 700;
          color: #FFD700;
        }

        /* ===== bank-transfer-section: 转账区域 ===== */
        .bank-transfer-section {
          background: #16213E;
          border-radius: 12px;
          padding: 16px;
        }
        .bank-transfer-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          margin-bottom: 12px;
        }
        .bank-input {
          width: 100%;
          height: 40px;
          border: none;
          border-radius: 20px;
          background: rgba(255,255,255,0.08);
          padding: 0 16px;
          font-size: 16px;
          color: #fff;
          outline: none;
          box-sizing: border-box;
          margin-bottom: 12px;
        }
        .bank-input::placeholder {
          color: rgba(255,255,255,0.3);
        }
        .bank-input:focus {
          background: rgba(255,255,255,0.12);
        }
        .bank-actions {
          display: flex;
          gap: 12px;
        }
        .bank-btn-deposit,
        .bank-btn-withdraw {
          flex: 1;
          padding: 12px 0;
          border: none;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bank-btn-deposit {
          background: linear-gradient(135deg, #34c759 0%, #30d158 100%);
          color: #fff;
        }
        .bank-btn-withdraw {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .bank-btn-deposit:active,
        .bank-btn-withdraw:active {
          transform: scale(0.95);
        }

        /* ===== bank-hint: 提示文字 ===== */
        .bank-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          text-align: center;
          margin-top: 4px;
        }

        /* ===== bank-history-section: 交易记录 ===== */
        .bank-history-section {
          background: #16213E;
          border-radius: 12px;
          padding: 16px;
        }
        .bank-history-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          margin-bottom: 12px;
        }
        .bank-history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .bank-history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
        }
        .bank-history-item-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .bank-history-type {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
        }
        .bank-history-time {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
        }
        .bank-history-amount {
          font-size: 15px;
          font-weight: 700;
        }
        .bank-history-amount.deposit {
          color: #34c759;
        }
        .bank-history-amount.withdraw {
          color: #ff3b30;
        }
        .bank-history-empty {
          text-align: center;
          color: rgba(255,255,255,0.3);
          font-size: 13px;
          padding: 16px 0;
        }

        /* ===== bank-loading: 加载遮罩 ===== */
        .bank-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(26, 26, 26, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          border-radius: 12px;
        }
        .bank-loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #34c759;
          border-radius: 50%;
          animation: bank-spin 0.8s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 主渲染 ====================

    /**
     * 渲染银行主界面
     * @param {Object} data - 数据对象 { balance, wallet, history }
     * @param {Object} callbacks - 回调 { onRefresh, onDeposit, onWithdraw }
     * @returns {HTMLElement}
     */
    render(data, callbacks) {
      this.injectStyles();
      const div = document.createElement('div');
      div.className = 'bank-app';
      div.innerHTML =
        '<div class="bank-header">' +
          '<h3 class="bank-title"><span class="bank-title-icon">\uD83C\uDFE6</span>银行</h3>' +
          '<button class="bank-btn-refresh" data-action="refresh" title="刷新">\u21BB</button>' +
        '</div>' +
        '<div class="bank-body" data-ref="body">' +
          '<div class="bank-balance-card">' +
            '<div class="bank-balance-label">银行存款</div>' +
            '<div class="bank-balance-value" data-ref="balance">--<span class="bank-balance-unit">G</span></div>' +
          '</div>' +
          '<div class="bank-wallet-card">' +
            '<span class="bank-wallet-label">钱包金币</span>' +
            '<span class="bank-wallet-value" data-ref="wallet">--</span>' +
          '</div>' +
          '<div class="bank-transfer-section">' +
            '<div class="bank-transfer-title">转账操作</div>' +
            '<input class="bank-input" data-ref="amount" type="number" min="1" value="100" placeholder="输入金额" />' +
            '<div class="bank-actions">' +
              '<button class="bank-btn-deposit" data-action="deposit">存入</button>' +
              '<button class="bank-btn-withdraw" data-action="withdraw">取出</button>' +
            '</div>' +
            '<p class="bank-hint">存款从状态栏金币扣除；取款回到钱包</p>' +
          '</div>' +
          '<div class="bank-history-section">' +
            '<div class="bank-history-title">最近交易</div>' +
            '<div class="bank-history-list" data-ref="history"></div>' +
          '</div>' +
        '</div>';

      // 绑定交互回调
      this._bindEvents(div, callbacks);
      return div;
    }

    // ==================== 数据更新渲染 ====================

    /**
     * 更新余额显示
     * @param {HTMLElement} container - 根容器
     * @param {Object} data - { balance, wallet }
     */
    renderBalance(container, data) {
      const bEl = container.querySelector('[data-ref="balance"]');
      const wEl = container.querySelector('[data-ref="wallet"]');
      if (bEl) bEl.innerHTML = (data.balance || 0) + '<span class="bank-balance-unit">G</span>';
      if (wEl) wEl.textContent = data.wallet || 0;
    }

    /**
     * 渲染交易记录列表
     * @param {HTMLElement} container - 根容器
     * @param {Array} history - 交易记录数组
     */
    renderHistory(container, history) {
      const historyEl = container.querySelector('[data-ref="history"]');
      if (!historyEl) return;

      if (!history || history.length === 0) {
        historyEl.innerHTML = '<div class="bank-history-empty">暂无交易记录</div>';
        return;
      }

      // 只显示最近5条
      const recentHistory = history.slice(0, 5);
      historyEl.innerHTML = recentHistory.map(function (item) {
        const isDeposit = item.type === 'deposit';
        return '<div class="bank-history-item">' +
          '<div class="bank-history-item-left">' +
            '<span class="bank-history-type">' + escapeHtml(isDeposit ? '存入' : '取出') + '</span>' +
            '<span class="bank-history-time">' + escapeHtml(item.time || '') + '</span>' +
          '</div>' +
          '<span class="bank-history-amount ' + (isDeposit ? 'deposit' : 'withdraw') + '">' +
            (isDeposit ? '+' : '-') + (item.amount || 0) +
          '</span>' +
        '</div>';
      }).join('');
    }

    /**
     * 渲染空交易记录状态
     * @param {HTMLElement} container - 根容器
     */
    renderEmptyHistory(container) {
      this.renderHistory(container, []);
    }

    // ==================== 加载状态 ====================

    /**
     * 显示/隐藏加载遮罩
     * @param {HTMLElement} container - 根容器
     * @param {boolean} show - 是否显示
     */
    renderLoading(container, show) {
      const body = container?.querySelector('[data-ref="body"]');
      const refreshBtn = container?.querySelector('.bank-btn-refresh');

      if (refreshBtn) {
        refreshBtn.classList.toggle('loading', show);
      }

      // 移除已有加载遮罩
      const existingLoading = container?.querySelector('.bank-loading');
      if (existingLoading) existingLoading.remove();

      if (show && body) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'bank-loading';
        loadingEl.innerHTML = '<div class="bank-loading-spinner"></div>';
        body.style.position = 'relative';
        body.appendChild(loadingEl);
      }
    }

    // ==================== 内部方法 ====================

    /**
     * 绑定交互事件
     * @param {HTMLElement} div - 根容器
     * @param {Object} callbacks - { onRefresh, onDeposit, onWithdraw }
     */
    _bindEvents(div, callbacks) {
      if (!callbacks) return;

      div.addEventListener('click', function (e) {
        // 刷新按钮
        const refreshBtn = e.target.closest('[data-action="refresh"]');
        if (refreshBtn && callbacks.onRefresh) {
          callbacks.onRefresh();
          return;
        }

        // 存入/取出按钮
        const btn = e.target.closest('[data-action="deposit"], [data-action="withdraw"]');
        if (!btn) return;
        const amount = parseInt(div.querySelector('[data-ref="amount"]')?.value, 10) || 0;

        if (btn.dataset.action === 'deposit' && callbacks.onDeposit) {
          callbacks.onDeposit(amount);
        }
        if (btn.dataset.action === 'withdraw' && callbacks.onWithdraw) {
          callbacks.onWithdraw(amount);
        }
      });
    }
  }

  // 全局挂载
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Bank = BankRenderer;

  console.log('[Renderer] BankRenderer 已加载');
})();
