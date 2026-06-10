/**
 * BankModule - 银行模块
 * 职责：生命周期管理、事件绑定、调用 Service
 * 禁止：直接操作数据（必须通过 Service）、包含 UI 拼装逻辑
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Bank
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 bank- 前缀隔离（铁则十一）
 *   - DOM 操作委托给 Renderer（铁则三）
 */

;(function () {
  'use strict';

  class BankModule extends PhoneApp {
    constructor() {
      super({
        id: 'bank',
        name: '银行',
        icon: '\uD83C\uDFE6',
        iconBg: 'linear-gradient(135deg, #34c759 0%, #30d158 100%)',
      });
      this._service = null;
      this._renderer = null;
      this._unsubscribers = [];
      this._isLoading = false;
    }

    // ==================== 生命周期 ====================

    init(shell) {
      super.init(shell);
      this._service = window.Platform?.get?.('bankService')
        || (window.PhoneServices?.Bank && new window.PhoneServices.Bank(window.Platform));
      this._renderer = window.PhoneRenderers?.Bank
        ? new window.PhoneRenderers.Bank()
        : null;
    }

    async onInit(phone, params) {
      this._service = window.Platform?.get?.('bankService')
        || (window.PhoneServices?.Bank && new window.PhoneServices.Bank(window.Platform));
      this._renderer = window.PhoneRenderers?.Bank
        ? new window.PhoneRenderers.Bank()
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
        onDeposit: function (amount) { self._handleDeposit(amount); },
        onWithdraw: function (amount) { self._handleWithdraw(amount); }
      };

      if (this._renderer) {
        this._container = this._renderer.render({}, callbacks);
        setTimeout(() => this._refresh(), 0);
        return this._container;
      }

      // 降级：Renderer 不可用时回退到内联渲染
      return this._renderFallback();
    }

    // ==================== 数据刷新 ====================

    async _refresh() {
      if (!this._service || !this._container) return;

      try {
        const balance = await this._service.getBalance();
        const wallet = await this._service.getWalletGold();

        if (this._renderer) {
          this._renderer.renderBalance(this._container, { balance, wallet });
        }

        await this._refreshHistory();
      } catch (e) {
        console.warn('[BankModule] 刷新数据失败:', e);
      }
    }

    async _refreshHistory() {
      if (!this._service || !this._container) return;

      try {
        const history = await this._service.getHistory();
        if (this._renderer) {
          this._renderer.renderHistory(this._container, history);
        }
      } catch (e) {
        console.warn('[BankModule] 刷新交易记录失败:', e);
        if (this._renderer) {
          this._renderer.renderEmptyHistory(this._container);
        }
      }
    }

    // ==================== 存取操作 ====================

    async _handleDeposit(amount) {
      if (!amount || amount <= 0) {
        this.showToast('请输入有效金额', 'error');
        return;
      }
      await this._service?.depositFromWallet?.(amount);
      await this._refresh();
      this._shell?._showToast?.('操作完成');
    }

    async _handleWithdraw(amount) {
      if (!amount || amount <= 0) {
        this.showToast('请输入有效金额', 'error');
        return;
      }
      await this._service?.withdrawToWallet?.(amount);
      await this._refresh();
      this._shell?._showToast?.('操作完成');
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
        await this._refresh();
        this._showLoading(false);
        this.showToast('银行数据已更新', 'success');
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
        await this._refresh();
        this._showLoading(false);
        this.showToast('刷新成功', 'success');
      } catch (e) {
        this._showLoading(false);
        console.warn('[BankModule] 手动刷新失败:', e);
      }
    }

    // ==================== 降级渲染 ====================

    _renderFallback() {
      const div = document.createElement('div');
      div.className = 'bank-app';
      div.style.padding = '20px';
      div.style.textAlign = 'center';
      div.style.color = '#fff';
      div.textContent = '银行模块加载中...';
      this._container = div;
      return div;
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const i = new BankModule();
      return {
        id: i.id,
        name: i.name,
        icon: i.icon,
        iconBg: i.iconBg,
        init: (p, x) => i.init(p, x),
        render: () => i.render(),
      };
    }
  }

  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Bank = BankModule;

  console.log('[Module] BankModule 已加载');
})();
