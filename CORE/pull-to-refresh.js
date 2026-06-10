/**
 * 下拉刷新组件
 * 
 * iOS风格下拉刷新，本质是重新调用Service的loadData方法
 * 铁则合规：纯UI交互，数据刷新通过Service层
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  class PullToRefresh {
    /**
     * @param {HTMLElement} container - 可滚动的容器元素
     * @param {Function} onRefresh - 刷新回调（必须返回Promise）
     * @param {Object} options - 配置
     */
    constructor(container, onRefresh, options = {}) {
      this._container = container;
      this._onRefresh = onRefresh;
      this._threshold = options.threshold || 60;
      this._resistance = options.resistance || 2.5;
      this._isPulling = false;
      this._isRefreshing = false;
      this._startY = 0;
      this._indicator = null;

      this._createIndicator();
      this._bindEvents();
    }

    _createIndicator() {
      this._indicator = document.createElement('div');
      this._indicator.className = 'pull-to-refresh-indicator';
      this._indicator.style.cssText = `
        position: absolute;
        top: -50px;
        left: 50%;
        transform: translateX(-50%);
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: top 0.3s var(--ease-spring), opacity 0.2s ease;
        opacity: 0;
        z-index: 10;
      `;
      this._indicator.innerHTML = `
        <svg class="ptr-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" style="transition: transform 0.2s ease;">
          <path d="M10 4 L10 16 M4 10 L16 10" stroke="var(--color-text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <div class="ptr-spinner" style="display:none; width:20px; height:20px; border: 2px solid var(--color-border-default); border-top-color: var(--color-brand-blue); border-radius: 50%; animation: anim-spin 0.8s linear infinite;"></div>
      `;
      this._container.style.position = 'relative';
      this._container.style.overflowY = 'auto';
      this._container.prepend(this._indicator);
    }

    _bindEvents() {
      this._container.addEventListener('touchstart', (e) => this._onStart(e), { passive: true });
      this._container.addEventListener('touchmove', (e) => this._onMove(e), { passive: false });
      this._container.addEventListener('touchend', () => this._onEnd());

      // 鼠标支持（桌面调试）
      this._container.addEventListener('mousedown', (e) => this._onStart(e));
      this._container.addEventListener('mousemove', (e) => this._onMove(e));
      this._container.addEventListener('mouseup', () => this._onEnd());
      this._container.addEventListener('mouseleave', () => this._onEnd());
    }

    _onStart(e) {
      if (this._isRefreshing) return;
      if (this._container.scrollTop > 5) return; // 不在顶部
      this._isPulling = true;
      this._startY = e.touches ? e.touches[0].clientY : e.clientY;
    }

    _onMove(e) {
      if (!this._isPulling || this._isRefreshing) return;

      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let diff = (clientY - this._startY) / this._resistance;

      if (diff < 0) diff = 0;

      // 更新指示器位置
      const top = Math.min(diff, this._threshold + 20) - 50;
      this._indicator.style.top = `${top}px`;
      this._indicator.style.opacity = diff > 0 ? '1' : '0';

      // 旋转箭头
      const arrow = this._indicator.querySelector('.ptr-arrow');
      if (diff >= this._threshold) {
        arrow.style.transform = 'rotate(180deg)';
      } else {
        arrow.style.transform = 'rotate(0deg)';
      }

      // 阻尼效果
      if (diff > 0 && e.cancelable) {
        e.preventDefault();
      }
    }

    _onEnd() {
      if (!this._isPulling) return;
      this._isPulling = false;

      const currentTop = parseFloat(this._indicator.style.top) + 50;

      if (currentTop >= this._threshold) {
        this._startRefresh();
      } else {
        this._reset();
      }
    }

    async _startRefresh() {
      this._isRefreshing = true;

      // 显示加载状态
      this._indicator.style.top = '8px';
      this._indicator.querySelector('.ptr-arrow').style.display = 'none';
      this._indicator.querySelector('.ptr-spinner').style.display = 'block';

      try {
        await this._onRefresh();
        this._showComplete();
      } catch (e) {
        console.warn('[PullToRefresh] 刷新失败:', e);
        this._showError();
      }

      setTimeout(() => {
        this._isRefreshing = false;
        this._reset();
      }, 800);
    }

    _showComplete() {
      this._indicator.querySelector('.ptr-spinner').style.display = 'none';
      this._indicator.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10 L8 14 L16 6" stroke="var(--color-brand-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    _showError() {
      this._indicator.querySelector('.ptr-spinner').style.display = 'none';
      this._indicator.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4 L16 16 M16 4 L4 16" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"/></svg>`;
    }

    _reset() {
      this._indicator.style.top = '-50px';
      this._indicator.style.opacity = '0';
      // 恢复默认内容
      setTimeout(() => {
        this._indicator.innerHTML = `
          <svg class="ptr-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" style="transition: transform 0.2s ease;">
            <path d="M10 4 L10 16 M4 10 L16 10" stroke="var(--color-text-tertiary)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <div class="ptr-spinner" style="display:none; width:20px; height:20px; border: 2px solid var(--color-border-default); border-top-color: var(--color-brand-blue); border-radius: 50%; animation: anim-spin 0.8s linear infinite;"></div>
        `;
      }, 300);
    }

    destroy() {
      if (this._indicator) {
        this._indicator.remove();
        this._indicator = null;
      }
    }
  }

  window.PullToRefresh = PullToRefresh;

})();
