/**
 * StockModule - 股票模块
 * 职责：生命周期管理、事件绑定、调用 Service
 * 禁止：直接操作数据（必须通过 Service）、包含 UI 拼装逻辑
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Stock
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 stock- 前缀隔离（铁则十一）
 *   - DOM 操作委托给 Renderer（铁则三）
 */

;(function () {
  'use strict';

  class StockModule extends PhoneApp {
    constructor() {
      super({
        id: 'stock',
        name: '股票',
        icon: '\uD83D\uDCC8',
        iconBg: 'linear-gradient(135deg, #ff3b30 0%, #ff9500 100%)',
      });
      this._service = null;
      this._renderer = null;
      this._unsubscribers = [];
      this._isLoading = false;
    }

    // ==================== 生命周期 ====================

    init(shell) {
      super.init(shell);
      this._service = window.Platform?.get?.('stockService')
        || (window.PhoneServices?.Stock && new window.PhoneServices.Stock(window.Platform));
      this._renderer = window.PhoneRenderers?.Stock
        ? new window.PhoneRenderers.Stock()
        : null;
    }

    async onInit(phone, params) {
      this._service = window.Platform?.get?.('stockService')
        || (window.PhoneServices?.Stock && new window.PhoneServices.Stock(window.Platform));
      this._renderer = window.PhoneRenderers?.Stock
        ? new window.PhoneRenderers.Stock()
        : null;

      // ST5层联动：监听大世界层级更新
      if (this._platform?.eventBus) {
        this._platform.eventBus.on('world:stageUpdated', async (payload) => {
          console.log(`[${this.id}] 收到世界层级更新事件:`, payload);
          await this._handleWorldUpdate(payload);
        });
      }
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 渲染 ====================

    render() {
      const self = this;
      const callbacks = {
        onRefresh: function () { self._handleManualRefresh(); },
        onBuy: function (id) { self._handleTrade(id, 'buy'); },
        onSell: function (id) { self._handleTrade(id, 'sell'); }
      };

      if (this._renderer) {
        this._container = this._renderer.render({}, callbacks);
        setTimeout(() => this._loadData(), 0);
        return this._container;
      }

      // 降级：Renderer 不可用时回退到内联渲染
      return this._renderFallback();
    }

    // ==================== 数据加载 ====================

    async _loadData() {
      if (!this._service || !this._container) return;

      try {
        const market = await this._service.getMarket();
        const portfolio = await this._service.getPortfolio();

        if (this._renderer) {
          this._renderer.renderMarket(this._container, { market, portfolio });
        }
      } catch (e) {
        console.warn('[StockModule] 加载数据失败:', e);
        if (this._renderer) {
          this._renderer.renderError(this._container);
        }
      }
    }

    // ==================== 交易处理 ====================

    async _handleTrade(id, action) {
      try {
        if (action === 'buy') {
          await this._service.buy(id, 1);
        } else {
          await this._service.sell(id, 1);
        }
        await this._loadData();
        this._shell?._showToast?.('成交');
      } catch (err) {
        console.warn('[StockModule] 交易失败:', err);
        this.showToast('交易失败', 'error');
      }
    }

    // ==================== 加载状态 ====================

    _showLoading(show) {
      this._isLoading = show;
      if (this._renderer && this._container) {
        this._renderer.renderLoading(this._container, show);
      }
    }

    // ==================== ST5层联动 ====================

    async _handleWorldUpdate(payload) {
      try {
        this._showLoading(true);
        if (this._service?.regenerateData) {
          await this._service.regenerateData(payload);
        }
        await this._loadData();
        this._showLoading(false);
        this.showToast('股市数据已更新', 'success');
      } catch (e) {
        this._showLoading(false);
        console.warn(`[${this.id}] 世界更新处理失败:`, e);
      }
    }

    // ==================== 手动刷新 ====================

    async _handleManualRefresh() {
      try {
        this._showLoading(true);
        if (this._service?.regenerateData) {
          await this._service.regenerateData({ source: 'manual' });
        }
        await this._loadData();
        this._showLoading(false);
        this.showToast('刷新成功', 'success');
      } catch (e) {
        this._showLoading(false);
        console.warn('[StockModule] 手动刷新失败:', e);
      }
    }

    // ==================== 降级渲染 ====================

    _renderFallback() {
      const div = document.createElement('div');
      div.className = 'stock-app';
      div.style.padding = '20px';
      div.style.textAlign = 'center';
      div.style.color = '#fff';
      div.textContent = '股票模块加载中...';
      this._container = div;
      return div;
    }

    // [v4.31.0-fix] 铁则五：补充完整的生命周期映射
    static toPlainObject() {
      const i = new StockModule();
      return {
        id: i.id,
        name: i.name,
        icon: i.icon,
        iconBg: i.iconBg,
        init: (p, x) => i.init(p, x),
        render: () => i.render(),
        resume: () => i.onResume?.(),
        pause: () => i.onPause?.(),
        destroy: () => i.onDestroy?.()
      };
    }
  }

  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Stock = StockModule;

  console.log('[Module] StockModule 已加载');
})();
