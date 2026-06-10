/**
 * @layer Renderer
 * @file   stock-renderer.js
 *
 * 职责: 股票模块 UI 渲染
 * 禁止: 包含业务逻辑、调用 Service、直接操作 Schema
 *
 * 铁则合规：
 *   - 纯展示层，只接收数据对象返回 DOM（铁则三）
 *   - CSS 类名以 stock- 前缀隔离（铁则二十一）
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

  class StockRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;
      const style = document.createElement('style');
      style.id = 'stock-module-styles';
      style.textContent = `
        /* ===== stock-app: 深色主题容器 ===== */
        .stock-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          color: #ffffff;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* ===== stock-header: 顶部导航栏 ===== */
        .stock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #2d1b1b 0%, #16213E 100%);
          padding: 14px 16px;
          flex-shrink: 0;
        }
        .stock-title {
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .stock-title-icon {
          font-size: 22px;
        }

        /* ===== stock-btn-refresh: 刷新按钮 ===== */
        .stock-btn-refresh {
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
        .stock-btn-refresh:active {
          transform: scale(0.9);
        }
        .stock-btn-refresh.loading {
          animation: stock-spin 1s linear infinite;
        }
        @keyframes stock-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ===== stock-body: 主内容区域 ===== */
        .stock-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ===== stock-index-card: 大盘指数卡片 ===== */
        .stock-index-card {
          background: linear-gradient(135deg, #16213E 0%, #0f3460 100%);
          border-radius: 12px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }
        .stock-index-card::before {
          content: '';
          position: absolute;
          top: -30px;
          right: -30px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: rgba(255, 59, 48, 0.12);
        }
        .stock-index-label {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          margin-bottom: 8px;
        }
        .stock-index-value {
          font-size: 36px;
          font-weight: 700;
          line-height: 1.2;
        }
        .stock-index-change {
          font-size: 14px;
          font-weight: 600;
          margin-top: 4px;
        }
        .stock-up {
          color: #ff3b30;
        }
        .stock-down {
          color: #34c759;
        }
        .stock-flat {
          color: rgba(255,255,255,0.5);
        }

        /* ===== stock-asset-card: 总资产卡片 ===== */
        .stock-asset-card {
          background: #16213E;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stock-asset-label {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
        }
        .stock-asset-value {
          font-size: 20px;
          font-weight: 700;
          color: #FFD700;
        }

        /* ===== stock-list-section: 自选股列表 ===== */
        .stock-list-section {
          background: #16213E;
          border-radius: 12px;
          padding: 16px;
        }
        .stock-list-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          margin-bottom: 12px;
        }
        .stock-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ===== stock-row: 单只股票行 ===== */
        .stock-row {
          background: rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stock-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stock-row-name {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }
        .stock-row-price {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }
        .stock-row-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stock-row-change {
          font-size: 13px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .stock-row-change.up {
          color: #ff3b30;
          background: rgba(255, 59, 48, 0.12);
        }
        .stock-row-change.down {
          color: #34c759;
          background: rgba(52, 199, 89, 0.12);
        }
        .stock-row-change.flat {
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.06);
        }
        .stock-row-holding {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }
        .stock-row-holding strong {
          color: #fff;
          font-weight: 600;
        }

        /* ===== stock-btns: 买卖按钮 ===== */
        .stock-btns {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .stock-btn-buy,
        .stock-btn-sell {
          flex: 1;
          padding: 8px 0;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .stock-btn-buy {
          background: linear-gradient(135deg, #ff3b30 0%, #ff6344 100%);
          color: #fff;
        }
        .stock-btn-sell {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .stock-btn-buy:active,
        .stock-btn-sell:active {
          transform: scale(0.95);
        }

        /* ===== stock-empty / stock-error ===== */
        .stock-empty,
        .stock-error {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
          color: rgba(255,255,255,0.3);
          font-size: 14px;
        }

        /* ===== stock-loading: 加载遮罩 ===== */
        .stock-loading {
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
        .stock-loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #ff3b30;
          border-radius: 50%;
          animation: stock-spin 0.8s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 主渲染 ====================

    /**
     * 渲染股票主界面
     * @param {Object} data - 数据对象 { market, portfolio }
     * @param {Object} callbacks - 回调 { onRefresh, onBuy, onSell }
     * @returns {HTMLElement}
     */
    render(data, callbacks) {
      this.injectStyles();
      const div = document.createElement('div');
      div.className = 'stock-app';
      div.innerHTML =
        '<div class="stock-header">' +
          '<h3 class="stock-title"><span class="stock-title-icon">\uD83D\uDCC8</span>股市</h3>' +
          '<button class="stock-btn-refresh" data-action="refresh" title="刷新">\u21BB</button>' +
        '</div>' +
        '<div class="stock-body" data-ref="body">' +
          '<div class="stock-index-card" data-ref="index-card">' +
            '<div class="stock-index-label">综合指数</div>' +
            '<div class="stock-index-value" data-ref="index-value">--</div>' +
            '<div class="stock-index-change" data-ref="index-change">--</div>' +
          '</div>' +
          '<div class="stock-asset-card">' +
            '<span class="stock-asset-label">持仓总市值</span>' +
            '<span class="stock-asset-value" data-ref="total-asset">--</span>' +
          '</div>' +
          '<div class="stock-list-section">' +
            '<div class="stock-list-title">自选股</div>' +
            '<div class="stock-list" data-ref="list"></div>' +
          '</div>' +
        '</div>';

      // 绑定交互回调
      this._bindEvents(div, callbacks);
      return div;
    }

    // ==================== 数据更新渲染 ====================

    /**
     * 渲染市场数据和股票列表
     * @param {HTMLElement} container - 根容器
     * @param {Object} data - { market, portfolio }
     */
    renderMarket(container, data) {
      const list = container.querySelector('[data-ref="list"]');
      const indexValue = container.querySelector('[data-ref="index-value"]');
      const indexChange = container.querySelector('[data-ref="index-change"]');
      const totalAsset = container.querySelector('[data-ref="total-asset"]');

      if (!list) return;

      const market = data.market || {};
      const p = data.portfolio || {};

      // 渲染大盘指数
      const indexVal = market.index || 0;
      const indexChg = market.indexChange || 0;
      const indexChgPct = ((indexChg / Math.max(indexVal, 1)) * 100).toFixed(2);
      const isUp = indexChg >= 0;

      if (indexValue) {
        indexValue.textContent = indexVal.toFixed(2);
        indexValue.className = 'stock-index-value ' + (isUp ? 'stock-up' : 'stock-down');
      }
      if (indexChange) {
        indexChange.textContent = (isUp ? '+' : '') + indexChg.toFixed(2) + ' (' + (isUp ? '+' : '') + indexChgPct + '%)';
        indexChange.className = 'stock-index-change ' + (isUp ? 'stock-up' : 'stock-down');
      }

      // 渲染总资产
      const totalVal = p.totalValue || 0;
      if (totalAsset) {
        totalAsset.textContent = totalVal.toFixed(2) + 'G';
      }

      // 渲染自选股列表
      const symbols = market.symbols || [];
      if (symbols.length === 0) {
        list.innerHTML = '<div class="stock-empty">暂无股票数据</div>';
        return;
      }

      list.innerHTML = symbols.map(function (s) {
        const h = (p.holdings || []).find(function (x) { return x.symbolId === s.id; });
        const ch = (s.change || 0) * 100;
        const sUp = ch > 0;
        const sDown = ch < 0;
        const changeClass = sUp ? 'up' : (sDown ? 'down' : 'flat');
        const chStr = (sUp ? '+' : '') + ch.toFixed(1) + '%';

        return '<div class="stock-row" data-id="' + escapeHtml(s.id) + '">' +
          '<div class="stock-row-top">' +
            '<span class="stock-row-name">' + escapeHtml(s.name) + '</span>' +
            '<span class="stock-row-price">\u00A5' + escapeHtml(String(s.price)) + '</span>' +
          '</div>' +
          '<div class="stock-row-info">' +
            '<span class="stock-row-change ' + changeClass + '">' + chStr + '</span>' +
            '<span class="stock-row-holding">持仓: <strong>' + (h?.shares || 0) + '</strong> 股</span>' +
          '</div>' +
          '<div class="stock-btns">' +
            '<button class="stock-btn-buy" data-action="buy" data-id="' + escapeHtml(s.id) + '">买入1股</button>' +
            '<button class="stock-btn-sell" data-action="sell" data-id="' + escapeHtml(s.id) + '">卖出1股</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    /**
     * 渲染空状态
     * @param {HTMLElement} container - 根容器
     */
    renderEmptyState(container) {
      const list = container.querySelector('[data-ref="list"]');
      if (list) {
        list.innerHTML = '<div class="stock-empty">暂无股票数据</div>';
      }
    }

    /**
     * 渲染错误状态
     * @param {HTMLElement} container - 根容器
     */
    renderError(container) {
      const list = container.querySelector('[data-ref="list"]');
      if (list) {
        list.innerHTML = '<div class="stock-error">加载失败，请重试</div>';
      }
    }

    // ==================== 加载状态 ====================

    /**
     * 显示/隐藏加载遮罩
     * @param {HTMLElement} container - 根容器
     * @param {boolean} show - 是否显示
     */
    renderLoading(container, show) {
      const body = container?.querySelector('[data-ref="body"]');
      const refreshBtn = container?.querySelector('.stock-btn-refresh');

      if (refreshBtn) {
        refreshBtn.classList.toggle('loading', show);
      }

      // 移除已有加载遮罩
      const existingLoading = container?.querySelector('.stock-loading');
      if (existingLoading) existingLoading.remove();

      if (show && body) {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'stock-loading';
        loadingEl.innerHTML = '<div class="stock-loading-spinner"></div>';
        body.style.position = 'relative';
        body.appendChild(loadingEl);
      }
    }

    // ==================== 内部方法 ====================

    /**
     * 绑定交互事件
     * @param {HTMLElement} div - 根容器
     * @param {Object} callbacks - { onRefresh, onBuy, onSell }
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

        // 买卖按钮
        const btn = e.target.closest('button[data-action="buy"], button[data-action="sell"]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;

        if (btn.dataset.action === 'buy' && callbacks.onBuy) {
          callbacks.onBuy(id);
        } else if (btn.dataset.action === 'sell' && callbacks.onSell) {
          callbacks.onSell(id);
        }
      });
    }
  }

  // 全局挂载
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Stock = StockRenderer;

  console.log('[Renderer] StockRenderer 已加载');
})();
