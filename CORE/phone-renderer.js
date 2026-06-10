/**
 * Phone Renderer - 手机UI渲染器 v2
 *
 * 悬浮小窗 + 放大独立面板模式。
 * - 默认显示为悬浮小窗（圆形按钮）
 * - 点击后展开为完整手机面板
 * - 面板可拖拽、可最小化
 * - 背景半透明遮罩
 */

;(function () {
  'use strict';

  /**
   * PhoneRenderer - 手机渲染器
   */
  class PhoneRenderer {
    constructor(options = {}) {
      this._config = {
        container: options.container || document.body,
        theme: options.theme || 'ios',
        // 悬浮窗配置
        floatPosition: options.floatPosition || 'bottom-left', // bottom-left | bottom-right
        floatSize: options.floatSize || 52,
        // 面板配置
        panelWidth: options.panelWidth || 375,
        panelHeight: options.panelHeight || 812,
        panelScale: options.panelScale || 0.85,
        draggable: options.draggable !== false,
        ...options,
      };

      this._phone = null;
      this._elements = {};
      this._mounted = false;

      // 面板状态: 'collapsed' | 'expanded'
      this._panelState = 'collapsed';

      // 拖拽状态
      this._drag = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };

      // 悬浮按钮拖拽状态
      this._floatDrag = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false };

      // 面板弹性物理
      this._panelPhysics = {
        x: 0, y: 0,           // 当前位置
        vx: 0, vy: 0,         // 速度
        anchorX: 0, anchorY: 0, // 拖拽锚点
        isDragging: false,
        animFrame: null,
      };

      // 视口位置追踪（ST 的 html 有 transform，fixed 定位失效，需用 absolute + JS 定位）
      this._scrollEl = null;
      this._viewportW = 0;
      this._viewportH = 0;

      console.log('[PhoneRenderer] 实例已创建');
    }

    // ==================== 生命周期 ====================

    attach(phone) {
      // [v4.3-fix] 防止重复 attach 导致事件监听器重复注册
      if (this._phone === phone) {
        console.warn('[PhoneRenderer] 已经 attach 到同一个 phone，跳过重复订阅');
        return;
      }

      // 清理旧的订阅（如果存在）
      if (this._unsubscribers) {
        for (const unsub of this._unsubscribers) unsub();
      }

      this._phone = phone;

      this._unsubscribers = [
        phone.on('phone:initialized', () => this._onInitialized()),
        phone.on('phone:deviceChanged', (data) => this._onDeviceChanged(data)),
        phone.on('phone:orientationChanged', (data) => this._onOrientationChanged(data)),
        phone.on('phone:poweredOn', () => this._onPoweredOn()),
        phone.on('phone:poweredOff', () => this._onPoweredOff()),
        phone.on('phone:appLaunched', (data) => this._onAppLaunched(data)),
        phone.on('phone:home', () => this._onHome()),
        phone.on('phone:tick', (data) => this._onTick(data)),
        phone.on('phone:batteryChanged', (data) => this._updateBattery(data)),
        phone.on('phone:wifiChanged', (data) => this._updateWifi(data)),
        phone.on('phone:signalChanged', (data) => this._updateSignal(data)),
        phone.on('phone:notification', (data) => this._onNotification(data)),
      ];
    }

    detach() {
      if (this._unsubscribers) {
        for (const unsub of this._unsubscribers) unsub();
      }
      this.unmount();
      this._phone = null;
    }

    // ==================== 渲染控制 ====================

    mount() {
      if (this._mounted) return;

      const container = typeof this._config.container === 'string'
        ? document.querySelector(this._config.container)
        : this._config.container;

      if (!container) {
        console.error('[PhoneRenderer] 容器不存在');
        return;
      }

      this._injectStyles();
      this._createFloatingUI(container);
      this._mounted = true;
      console.log('[PhoneRenderer] 已挂载');
    }

    unmount() {
      if (!this._mounted) return;
      this._destroyViewportTracking();
      if (this._onDocMouseMove) document.removeEventListener('mousemove', this._onDocMouseMove);
      if (this._onDocMouseUp) document.removeEventListener('mouseup', this._onDocMouseUp);
      if (this._onDocTouchMove) document.removeEventListener('touchmove', this._onDocTouchMove);
      if (this._onDocTouchEnd) document.removeEventListener('touchend', this._onDocTouchEnd);
      this._onDocMouseMove = null;
      this._onDocMouseUp = null;
      this._onDocTouchMove = null;
      this._onDocTouchEnd = null;
      if (this._elements.root) this._elements.root.remove();
      this._elements = {};
      this._mounted = false;
    }

    // ==================== 悬浮窗 ↔ 面板切换 ====================

    expand() {
      if (this._panelState === 'expanded') return;
      this._panelState = 'expanded';

      const { overlay, panel, floatBtn } = this._elements;

      // 显示遮罩
      overlay.classList.add('phone-overlay-visible');

      // 展开面板 — 用 inline style 而非 CSS class 控制位置，避免覆盖拖拽位置
      if (!panel.style.left || panel._dragged) {
        // 首次展开或已被拖拽过，保持当前位置
      } else {
        // 默认居中
        panel.style.left = '50%';
        panel.style.top = '50%';
      }
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      panel.style.transform = 'translate(-50%, -50%)';
      panel.classList.remove('phone-panel-hidden');

      // 隐藏悬浮按钮
      floatBtn.style.opacity = '0';
      floatBtn.style.pointerEvents = 'none';

      // 更新尺寸
      const screen = this._phone?.getScreen();
      if (screen) this._updateScreenSize(screen);

      // 渲染应用图标
      this._renderApps();

      console.log('[PhoneRenderer] 面板已展开');
    }

    collapse() {
      if (this._panelState === 'collapsed') return;
      this._panelState = 'collapsed';

      const { overlay, panel, floatBtn } = this._elements;

      // 隐藏遮罩
      overlay.classList.remove('phone-overlay-visible');

      // 收起面板 — 用 inline style 控制，不依赖 CSS class
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
      panel.style.transform = 'translate(-50%, -50%) scale(0.8)';
      panel.classList.add('phone-panel-hidden');

      // 显示悬浮按钮
      floatBtn.style.opacity = '1';
      floatBtn.style.pointerEvents = 'auto';

      console.log('[PhoneRenderer] 面板已收起');
    }

    toggle() {
      if (this._panelState === 'expanded') {
        this.collapse();
      } else {
        this.expand();
      }
    }

    // ==================== DOM 创建 ====================

    _createFloatingUI(container) {
      const root = document.createElement('div');
      root.className = 'phone-root';

      // 1. 半透明遮罩
      const overlay = document.createElement('div');
      overlay.className = 'phone-overlay';

      // 2. 手机面板
      const panel = document.createElement('div');
      panel.className = 'phone-panel phone-panel-hidden';
      panel.innerHTML = this._buildPanelHTML();

      // 3. 悬浮按钮
      const floatBtn = document.createElement('div');
      floatBtn.className = 'phone-float-btn';
      floatBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="5" y="2" width="14" height="20" rx="3"/>
        <line x1="12" y1="18" x2="12" y2="18.01"/>
      </svg>`;

      root.appendChild(overlay);
      root.appendChild(panel);
      root.appendChild(floatBtn);
      container.appendChild(root);

      // 保存引用
      this._elements = {
        root,
        overlay,
        panel,
        floatBtn,
        // 面板内部
        screen: panel.querySelector('.phone-screen'),
        statusBar: panel.querySelector('.phone-status-bar'),
        statusTime: panel.querySelector('.status-time'),
        statusBattery: panel.querySelector('.status-battery'),
        dynamicIsland: panel.querySelector('.phone-dynamic-island'),
        content: panel.querySelector('.phone-content'),
        lockScreen: panel.querySelector('.phone-lock-screen'),
        homeScreen: panel.querySelector('.phone-home-screen'),
        appsGrid: panel.querySelector('.phone-apps-grid'),
        appContainer: panel.querySelector('.phone-app-container'),
        homeIndicator: panel.querySelector('.phone-home-indicator'),
        // 面板头部
        panelHeader: panel.querySelector('.phone-panel-header'),
        btnMinimize: panel.querySelector('.btn-minimize'),
      };

      // 初始化视口位置追踪
      this._initViewportTracking();

      // 设置弹窗挂载点
      if (window.PhoneDialog && this._elements.screen) {
        window.PhoneDialog.setMountPoint(this._elements.screen);
      }

      // 绑定事件
      this._bindEvents();
    }

    _buildPanelHTML() {
      return `
        <!-- 面板头部（拖拽区域 + 最小化按钮） -->
        <div class="phone-panel-header">
          <div class="phone-panel-drag-handle">
            <div class="drag-bar"></div>
          </div>
          <button class="btn-minimize" title="最小化">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="6" y1="12" x2="18" y2="12"/>
            </svg>
          </button>
        </div>

        <!-- 手机设备 -->
        <div class="phone-device">
          <div class="phone-bezel">
            <!-- Dynamic Island -->
            <div class="phone-dynamic-island">
              <div class="island-camera">
                <div class="island-camera-lens"></div>
              </div>
            </div>

            <div class="phone-screen">
              <!-- 状态栏 -->
              <div class="phone-status-bar">
                <div class="status-left">
                  <span class="status-time">22:03</span>
                  <span class="status-gold" data-ref="status-gold" title="金币"></span>
                </div>
                <div class="status-right">
                  <svg class="status-signal" viewBox="0 0 17 12" width="15" height="11">
                    <rect x="0" y="9" width="3" height="3" rx="0.5" fill="currentColor"/>
                    <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill="currentColor"/>
                    <rect x="9" y="3" width="3" height="9" rx="0.5" fill="currentColor"/>
                    <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="currentColor"/>
                  </svg>
                  <svg class="status-wifi" viewBox="0 0 16 12" width="14" height="11">
                    <path d="M8 9.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" fill="currentColor"/>
                    <path d="M4.8 7.8c1-1.1 2-1.8 3.2-1.8s2.2.7 3.2 1.8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
                    <path d="M2 5c1.8-2 3.8-3 6-3s4.2 1 6 3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
                  </svg>
                  <span class="status-battery">
                    <svg viewBox="0 0 28 14" width="22" height="11">
                      <rect x="0" y="0" width="24" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
                      <rect x="2" y="2" width="18" height="10" rx="1.5" fill="currentColor"/>
                      <rect x="25" y="4" width="3" height="6" rx="1" fill="currentColor"/>
                    </svg>
                    <span class="battery-pct">100%</span>
                  </span>
                </div>
              </div>

              <!-- 内容区域 -->
              <div class="phone-content">
                <!-- 锁屏 -->
                <div class="phone-lock-screen">
                  <div class="lock-screen-bg"></div>
                  <div class="lock-screen-rain"></div>
                  <div class="lock-screen-content">
                    <div class="lock-icon-row">
                      <svg class="lock-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </div>
                    <div class="lock-time">22:03</div>
                    <div class="lock-date">5月11日 星期日</div>
                  </div>
                  <div class="lock-screen-widgets">
                    <div class="lock-widget">
                      <div class="lock-widget-icon">⚙️</div>
                      <div class="lock-widget-label">设置</div>
                    </div>
                    <div class="lock-widget">
                      <div class="lock-widget-icon">📊</div>
                      <div class="lock-widget-label">状态</div>
                    </div>
                    <div class="lock-widget">
                      <div class="lock-widget-icon">📖</div>
                      <div class="lock-widget-label">日记</div>
                    </div>
                  </div>
                  <div class="lock-shortcuts">
                    <div class="lock-shortcut">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                        <path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 6a4 4 0 014 4c0 2-1 3-2 4v2h-4v-2c-1-1-2-2-2-4a4 4 0 014-4z"/>
                      </svg>
                    </div>
                    <div class="lock-shortcut">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                  </div>
                  <div class="lock-screen-hint">上滑解锁</div>
                </div>

                <!-- 主屏幕（应用列表） -->
                <div class="phone-home-screen" style="display: none;">
                  <div class="phone-wallpaper"></div>
                  <div class="phone-apps-grid"></div>
                </div>

                <!-- 应用容器 -->
                <div class="phone-app-container" style="display: none;"></div>
              </div>

              <!-- Home Indicator -->
              <div class="phone-home-indicator"></div>
            </div>
          </div>
        </div>
      `;
    }

    // ==================== 视口位置追踪 ====================
    // ST 的 <html> 设了 transform/perspective，导致 position:fixed 失效
    // 因此用 position:absolute + JS 手动同步视口位置

    _initViewportTracking() {
      // 找到实际滚动的元素（ST 可能用自定义滚动容器）
      this._scrollEl = document.scrollingElement || document.documentElement;

      // 初始定位
      this._updateViewportPosition();

      // 监听滚动和窗口大小变化
      this._onViewportChange = () => this._updateViewportPosition();
      window.addEventListener('scroll', this._onViewportChange, true);
      window.addEventListener('resize', this._onViewportChange);

      // 也监听 ST 可能用的滚动容器
      const stSheld = document.getElementById('sheld');
      if (stSheld) {
        stSheld.addEventListener('scroll', this._onViewportChange, true);
      }
    }

    _destroyViewportTracking() {
      if (this._onViewportChange) {
        window.removeEventListener('scroll', this._onViewportChange, true);
        window.removeEventListener('resize', this._onViewportChange);
        const stSheld = document.getElementById('sheld');
        if (stSheld) {
          stSheld.removeEventListener('scroll', this._onViewportChange, true);
        }
        this._onViewportChange = null;
      }
    }

    _updateViewportPosition() {
      const root = this._elements.root;
      const floatBtn = this._elements.floatBtn;
      if (!root) return;

      // 获取文档实际滚动偏移
      const scrollX = window.scrollX || this._scrollEl.scrollLeft || 0;
      const scrollY = window.scrollY || this._scrollEl.scrollTop || 0;

      // 更新 root 容器位置，使其始终覆盖当前可视区域
      root.style.left = scrollX + 'px';
      root.style.top = scrollY + 'px';

      // 仅在用户未拖拽过时才自动定位悬浮按钮
      if (floatBtn && !floatBtn._userPositioned) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        floatBtn.style.left = Math.max(8, vw - 62) + 'px';
        floatBtn.style.top = Math.max(8, vh - 132) + 'px';
      }
    }

    // ==================== 事件绑定 ====================

    _bindEvents() {
      const { floatBtn, overlay, btnMinimize, panelHeader, lockScreen, homeIndicator } = this._elements;

      // 悬浮按钮 → 拖拽 + 点击展开/收起
      floatBtn.addEventListener('mousedown', (e) => this._onFloatDragStart(e));
      floatBtn.addEventListener('touchstart', (e) => this._onFloatDragStart(e), { passive: false });

      // 遮罩点击 → 收起面板
      overlay.addEventListener('click', () => {
        this.collapse();
      });

      // 最小化按钮
      btnMinimize?.addEventListener('click', () => {
        this.collapse();
      });

      // Home Indicator → 回到主屏幕
      if (homeIndicator) {
        homeIndicator.addEventListener('click', (e) => {
          e.stopPropagation();
          this._phone?.goHome();
        });
        homeIndicator.style.cursor = 'pointer';
      }

      // 面板拖拽（弹性物理）
      if (this._config.draggable && panelHeader) {
        panelHeader.addEventListener('mousedown', (e) => this._onPanelDragStart(e));
        panelHeader.addEventListener('touchstart', (e) => this._onPanelDragStart(e), { passive: false });
      }

      // 锁屏上滑解锁
      if (lockScreen) {
        let startY = 0;
        lockScreen.addEventListener('touchstart', (e) => {
          startY = e.touches[0].clientY;
        }, { passive: true });
        lockScreen.addEventListener('touchend', (e) => {
          const endY = e.changedTouches[0].clientY;
          if (startY - endY > 60) {
            this._unlockScreen();
          }
        }, { passive: true });
        lockScreen.addEventListener('mousedown', (e) => {
          startY = e.clientY;
        });
        lockScreen.addEventListener('mouseup', (e) => {
          if (startY - e.clientY > 60) {
            this._unlockScreen();
          }
        });
      }

      // 全局鼠标/触摸事件
      this._onDocMouseMove = (e) => { this._onFloatDragMove(e); this._onPanelDragMove(e); };
      this._onDocMouseUp = (e) => { this._onFloatDragEnd(e); this._onPanelDragEnd(e); };
      this._onDocTouchMove = (e) => { this._onFloatDragMove(e); this._onPanelDragMove(e); };
      this._onDocTouchEnd = (e) => { this._onFloatDragEnd(e); this._onPanelDragEnd(e); };
      document.addEventListener('mousemove', this._onDocMouseMove);
      document.addEventListener('mouseup', this._onDocMouseUp);
      document.addEventListener('touchmove', this._onDocTouchMove, { passive: false });
      document.addEventListener('touchend', this._onDocTouchEnd);
    }

    // ==================== 悬浮按钮拖拽 ====================

    _onFloatDragStart(e) {
      const touch = e.touches?.[0] || e;
      const rect = this._elements.floatBtn.getBoundingClientRect();
      this._floatDrag.active = true;
      this._floatDrag.moved = false;
      this._floatDrag.offsetX = touch.clientX - rect.left;
      this._floatDrag.offsetY = touch.clientY - rect.top;
      this._floatDrag.startX = touch.clientX;
      this._floatDrag.startY = touch.clientY;
      e.preventDefault();
      e.stopPropagation();
    }

    _onFloatDragMove(e) {
      if (!this._floatDrag.active) return;
      const touch = e.touches?.[0] || e;
      const dx = touch.clientX - this._floatDrag.startX;
      const dy = touch.clientY - this._floatDrag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._floatDrag.moved = true;

      const floatBtn = this._elements.floatBtn;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = 52;
      let x = touch.clientX - this._floatDrag.offsetX;
      let y = touch.clientY - this._floatDrag.offsetY;
      // 限制在视口内
      x = Math.max(0, Math.min(vw - size, x));
      y = Math.max(0, Math.min(vh - size, y));
      floatBtn.style.left = x + 'px';
      floatBtn.style.top = y + 'px';
      floatBtn.style.transition = 'none';

      e.preventDefault();
      e.stopPropagation();
    }

    _onFloatDragEnd(e) {
      if (!this._floatDrag.active) return;
      this._floatDrag.active = false;
      const floatBtn = this._elements.floatBtn;
      floatBtn.style.transition = '';

      // 如果没有移动，视为点击 → 切换面板
      if (!this._floatDrag.moved) {
        this.toggle();
        return;
      }

      // 标记用户已手动定位，不再被 _updateViewportPosition 覆盖
      floatBtn._userPositioned = true;

      // 吸附到最近的边缘
      const rect = floatBtn.getBoundingClientRect();
      const vw = window.innerWidth;
      const centerX = rect.left + rect.width / 2;
      const targetX = centerX < vw / 2 ? 8 : vw - 60;
      floatBtn.style.left = targetX + 'px';
    }

    // ==================== 面板拖拽（真实手机手感） ====================

    _onPanelDragStart(e) {
      if (e.target.closest('.btn-minimize')) return;

      const touch = e.touches?.[0] || e;
      const panel = this._elements.panel;
      const rect = panel.getBoundingClientRect();

      // 记录锚点（鼠标点击位置相对于面板中心的偏移）
      this._panelPhysics.isDragging = true;
      this._panelPhysics.anchorX = touch.clientX - (rect.left + rect.width / 2);
      this._panelPhysics.anchorY = touch.clientY - (rect.top + rect.height / 2);
      this._panelPhysics.x = rect.left + rect.width / 2;
      this._panelPhysics.y = rect.top + rect.height / 2;
      this._panelPhysics.prevX = this._panelPhysics.x;
      this._panelPhysics.prevY = this._panelPhysics.y;
      this._panelPhysics.vx = 0;
      this._panelPhysics.vy = 0;

      panel.classList.add('phone-panel-dragging');
      e.preventDefault();
      e.stopPropagation();
    }

    _onPanelDragMove(e) {
      if (!this._panelPhysics.isDragging) return;

      const touch = e.touches?.[0] || e;
      const panel = this._elements.panel;

      // 直接跟随手指（1:1 映射，无延迟）
      const targetX = touch.clientX - this._panelPhysics.anchorX;
      const targetY = touch.clientY - this._panelPhysics.anchorY;

      // 记录速度（用于松手后的惯性）
      this._panelPhysics.vx = targetX - this._panelPhysics.x;
      this._panelPhysics.vy = targetY - this._panelPhysics.y;
      this._panelPhysics.prevX = this._panelPhysics.x;
      this._panelPhysics.prevY = this._panelPhysics.y;
      this._panelPhysics.x = targetX;
      this._panelPhysics.y = targetY;

      panel.style.left = `${targetX}px`;
      panel.style.top = `${targetY}px`;
      panel.style.transform = 'translate(-50%, -50%)';

      e.preventDefault();
      e.stopPropagation();
    }

    _onPanelDragEnd(e) {
      if (!this._panelPhysics.isDragging) return;
      this._panelPhysics.isDragging = false;

      const panel = this._elements.panel;
      panel.classList.remove('phone-panel-dragging');
      panel._dragged = true; // 标记已拖拽，expand 时不再重置位置

      // 轻微惯性滑动后停止
      this._animatePanelInertia();
      if (e) e.stopPropagation();
    }

    _animatePanelInertia() {
      if (this._panelPhysics.animFrame) cancelAnimationFrame(this._panelPhysics.animFrame);

      const panel = this._elements.panel;
      const friction = 0.88; // 摩擦系数，值越小停止越快
      const threshold = 0.3;

      const step = () => {
        this._panelPhysics.vx *= friction;
        this._panelPhysics.vy *= friction;
        this._panelPhysics.x += this._panelPhysics.vx;
        this._panelPhysics.y += this._panelPhysics.vy;

        panel.style.left = `${this._panelPhysics.x}px`;
        panel.style.top = `${this._panelPhysics.y}px`;

        const speed = Math.sqrt(this._panelPhysics.vx ** 2 + this._panelPhysics.vy ** 2);
        if (speed > threshold) {
          this._panelPhysics.animFrame = requestAnimationFrame(step);
        } else {
          this._panelPhysics.animFrame = null;
        }
      };

      this._panelPhysics.animFrame = requestAnimationFrame(step);
    }

    // ==================== 锁屏 ====================

    _unlockScreen() {
      const { lockScreen, homeScreen } = this._elements;
      if (!lockScreen) return;

      lockScreen.style.transform = 'translateY(-100%)';
      lockScreen.style.opacity = '0';

      setTimeout(() => {
        lockScreen.style.display = 'none';
        homeScreen.style.display = 'flex';
      }, 300);
    }

    _lockScreen() {
      const { lockScreen, homeScreen } = this._elements;
      if (!lockScreen) return;

      homeScreen.style.display = 'none';
      lockScreen.style.display = 'flex';
      lockScreen.style.transform = 'translateY(0)';
      lockScreen.style.opacity = '1';
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (document.getElementById('phone-renderer-v2-styles')) return;

      const wallpaperUrl = (window.__PHONE_BASE__ || './scripts/extensions/third-party/mobile/') + 'ASSETS/wallpaper.png';

      const styles = document.createElement('style');
      styles.id = 'phone-renderer-v2-styles';
      styles.textContent = `
        /* ========== 根容器 ========== */
        .phone-root {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 2147483647 !important;
          pointer-events: none !important;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif !important;
          display: block !important;
          visibility: visible !important;
          overflow: visible !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }

        /* ========== 遮罩 ========== */
        .phone-overlay {
          position: absolute !important;
          inset: 0 !important;
          background: rgba(0, 0, 0, 0.35) !important;
          backdrop-filter: blur(8px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(8px) saturate(180%) !important;
          opacity: 0 !important;
          transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          pointer-events: none !important;
        }
        .phone-overlay-visible {
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        /* ========== 悬浮按钮 ========== */
        .phone-float-btn {
          position: absolute !important;
          width: 52px !important;
          height: 52px !important;
          border-radius: 50% !important;
          background: linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%) !important;
          box-shadow:
            0 4px 16px rgba(0,0,0,0.18),
            0 1px 3px rgba(0,0,0,0.12),
            0 0 0 0.5px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.9) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          pointer-events: auto !important;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          color: #1d1d1f !important;
          z-index: 2147483647 !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .phone-float-btn:hover {
          transform: scale(1.1);
          box-shadow:
            0 8px 28px rgba(0,0,0,0.22),
            0 2px 6px rgba(0,0,0,0.14),
            0 0 0 0.5px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .phone-float-btn:active {
          transform: scale(0.95);
        }

        /* ========== 面板 ========== */
        .phone-panel {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0;
          pointer-events: none;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .phone-panel-visible {
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, -50%) scale(1);
        }
        .phone-panel-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0.8);
        }
        .phone-panel-dragging {
          transition: none !important;
        }

        /* ========== 面板头部 ========== */
        .phone-panel-header {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 6px 16px 4px;
          position: relative;
          cursor: grab;
        }
        .phone-panel-drag-handle {
          display: flex;
          justify-content: center;
        }
        .drag-bar {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.4);
        }
        .btn-minimize {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .btn-minimize:hover {
          background: rgba(255,255,255,0.3);
        }

        /* ========== 手机设备外壳 - 钛金属质感 ========== */
        .phone-device {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .phone-bezel {
          background: linear-gradient(145deg, #3a3a3c 0%, #1d1d1f 30%, #2c2c2e 60%, #1d1d1f 100%);
          border-radius: 50px;
          padding: 11px;
          position: relative;
          /* 多层 box-shadow 模拟钛金属高光和阴影 */
          box-shadow:
            /* 外层大阴影 */
            0 25px 70px rgba(0,0,0,0.55),
            0 10px 25px rgba(0,0,0,0.35),
            /* 钛金属边缘高光 - 左上 */
            inset 0 1px 1px rgba(255,255,255,0.12),
            inset 0 -1px 1px rgba(255,255,255,0.04),
            /* 细微边框高光 */
            0 0 0 0.5px rgba(255,255,255,0.18),
            /* 右下暗角 */
            0 0 0 1px rgba(0,0,0,0.3),
            /* 倒角高光 */
            0 0 0 3px rgba(60,60,65,0.4);
        }
        /* 侧边按钮暗示 */
        .phone-bezel::before {
          content: '';
          position: absolute;
          right: -2px;
          top: 120px;
          width: 3px;
          height: 28px;
          background: linear-gradient(180deg, #4a4a4c, #2c2c2e, #4a4a4c);
          border-radius: 0 2px 2px 0;
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.08);
        }
        .phone-bezel::after {
          content: '';
          position: absolute;
          left: -2px;
          top: 100px;
          width: 3px;
          height: 18px;
          background: linear-gradient(180deg, #4a4a4c, #2c2c2e, #4a4a4c);
          border-radius: 2px 0 0 2px;
          box-shadow:
            0 0 0 0.5px rgba(255,255,255,0.08),
            0 35px 0 0.5px rgba(255,255,255,0.06),
            0 38px 0 0.5px rgba(255,255,255,0.06);
        }

        /* ========== Dynamic Island - 真实药丸形状 ========== */
        .phone-dynamic-island {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: 105px;
          height: 30px;
          background: #000;
          border-radius: 20px;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
          /* 微妙的阴影让岛有浮起感 */
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.06);
        }
        .island-camera {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #1a1a2e 0%, #0a0a0f 60%, #000 100%);
          box-shadow:
            inset 0 0 2px rgba(50,50,120,0.3),
            0 0 0 1.5px #1a1a1a,
            0 0 0 2px #0d0d0d;
          position: relative;
        }
        .island-camera-lens {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(80,80,180,0.4) 0%, transparent 70%);
        }

        /* ========== 屏幕 ========== */
        .phone-screen {
          background: #000;
          border-radius: 40px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          /* 屏幕内发光效果 */
          box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.05);
        }

        /* ========== 状态栏 ========== */
        .phone-status-bar {
          height: 52px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding: 0 26px 6px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          z-index: 50;
          position: relative;
          letter-spacing: 0.2px;
        }
        .status-left, .status-right {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .status-time {
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.5px;
        }
        .status-gold {
          font-size: 11px;
          margin-left: 8px;
          font-weight: 600;
          opacity: 0.95;
        }
        .status-signal, .status-wifi {
          display: block;
          opacity: 0.9;
        }
        .status-battery {
          display: flex;
          align-items: center;
          gap: 3px;
          color: #fff;
        }
        .battery-pct {
          font-size: 12px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }

        /* ========== 内容区域 ========== */
        .phone-content {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        /* ========== 锁屏 - 精致毛玻璃效果 ========== */
        .phone-lock-screen {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 20;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lock-screen-bg {
          position: absolute;
          inset: 0;
          background: url('${wallpaperUrl}') center/cover no-repeat;
        }
        .lock-screen-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.15);
        }
        .lock-screen-rain {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(3px 3px at 60px 80px, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(2px 2px at 100px 50px, rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(4px 4px at 150px 120px, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(2px 2px at 200px 70px, rgba(255,255,255,0.5) 0%, transparent 100%),
            radial-gradient(3px 3px at 250px 150px, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(2px 2px at 300px 90px, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(4px 4px at 50px 200px, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(2px 2px at 180px 250px, rgba(255,255,255,0.4) 0%, transparent 100%),
            radial-gradient(3px 3px at 280px 200px, rgba(255,255,255,0.35) 0%, transparent 100%);
          opacity: 0.6;
        }
        .lock-screen-content {
          position: relative;
          z-index: 1;
          text-align: center;
          color: #fff;
        }
        .lock-icon-row {
          margin-bottom: 8px;
        }
        .lock-icon {
          opacity: 0.7;
        }
        .lock-time {
          font-size: 72px;
          font-weight: 700;
          letter-spacing: -3px;
          line-height: 1;
          margin-bottom: 6px;
          text-shadow: 0 2px 20px rgba(0,0,0,0.15);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
        }
        .lock-date {
          font-size: 17px;
          color: rgba(255,255,255,0.85);
          font-weight: 500;
          letter-spacing: 0.3px;
          text-shadow: 0 1px 8px rgba(0,0,0,0.1);
        }
        .lock-screen-widgets {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 14px;
          margin-top: 36px;
        }
        .lock-widget {
          width: 76px;
          height: 76px;
          border-radius: 20px;
          background: rgba(255,255,255,0.25);
          backdrop-filter: blur(30px) saturate(180%);
          -webkit-backdrop-filter: blur(30px) saturate(180%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow:
            0 2px 12px rgba(0,0,0,0.1),
            inset 0 0.5px 0 rgba(255,255,255,0.3),
            inset 0 -0.5px 0 rgba(255,255,255,0.05);
          border: 0.5px solid rgba(255,255,255,0.2);
        }
        .lock-widget-icon {
          font-size: 24px;
        }
        .lock-widget-label {
          font-size: 10px;
          color: rgba(255,255,255,0.9);
          font-weight: 500;
        }
        /* 底部手电筒/相机快捷图标 */
        .lock-shortcuts {
          position: absolute;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 40px;
          z-index: 1;
        }
        .lock-shortcut {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(255,255,255,0.25);
          backdrop-filter: blur(30px) saturate(180%);
          -webkit-backdrop-filter: blur(30px) saturate(180%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow:
            0 2px 10px rgba(0,0,0,0.1),
            inset 0 0.5px 0 rgba(255,255,255,0.3);
          border: 0.5px solid rgba(255,255,255,0.2);
        }
        .lock-screen-hint {
          position: absolute;
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          z-index: 1;
          animation: lockPulse 2.5s ease-in-out infinite;
          letter-spacing: 0.5px;
        }
        @keyframes lockPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }

        /* ========== 主屏幕 ========== */
        .phone-home-screen {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .phone-wallpaper {
          position: absolute;
          inset: 0;
          background: url('${wallpaperUrl}') center/cover no-repeat;
          z-index: 0;
        }
        .phone-wallpaper::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.05);
        }
        .phone-apps-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px 12px;
          padding: 50px 18px 16px;
          position: relative;
          z-index: 1;
          overflow-y: auto;
          align-content: start;
        }

        /* ========== 应用图标 - 写实风格 ========== */
        .phone-app-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .phone-app-icon:active {
          transform: scale(0.85);
        }
        .phone-app-icon .icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          /* iOS 写实渐变背景 */
          background: linear-gradient(145deg, #4facfe 0%, #00f2fe 100%);
          border: none;
          position: relative;
          color: #fff;
          /* 精致阴影效果 */
          box-shadow:
            0 6px 16px rgba(0,0,0,0.25),
            0 2px 4px rgba(0,0,0,0.15),
            0 0 0 0.5px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.35),
            inset 0 -1px 0 rgba(0,0,0,0.08);
        }
        .phone-app-icon .badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 19px;
          height: 19px;
          background: #ff3b30;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          box-shadow: 0 1px 4px rgba(255,59,48,0.4);
          border: 1.5px solid rgba(0,0,0,0.15);
        }
        .phone-app-icon .label {
          color: #fff;
          font-size: 10.5px;
          font-weight: 500;
          text-shadow: 0 1px 4px rgba(0,0,0,0.6), 0 0px 2px rgba(0,0,0,0.4);
          max-width: 66px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0.1px;
        }

        /* ========== 应用容器 ========== */
        .phone-app-container {
          position: absolute;
          inset: 0;
          background: #f2f2f7;
          z-index: 10;
        }

        /* ========== Home Indicator - 写实横条 ========== */
        .phone-home-indicator {
          height: 5px;
          width: 134px;
          background: rgba(255,255,255,0.55);
          border-radius: 100px;
          margin: 8px auto 6px;
          z-index: 50;
          transition: background 0.2s;
        }
        .phone-home-indicator:hover {
          background: rgba(255,255,255,0.85);
        }

        /* ========== App 导航栏 - iOS 大标题风格 ========== */
        .phone-app-navbar {
          display: flex;
          align-items: center;
          padding: 8px 14px 10px;
          background: rgba(249,249,249,0.94);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 0.5px solid rgba(0,0,0,0.1);
          flex-shrink: 0;
        }
        .phone-app-back-btn {
          width: 34px;
          height: 34px;
          border: none;
          background: none;
          color: #007aff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.15s;
          padding: 0;
        }
        .phone-app-back-btn:hover {
          background: rgba(0,122,255,0.08);
        }
        .phone-app-back-btn:active {
          background: rgba(0,122,255,0.16);
        }
        .phone-app-title {
          flex: 1;
          text-align: center;
          font-size: 17px;
          font-weight: 600;
          color: #000;
          margin-right: 34px;
          letter-spacing: -0.2px;
        }
        .phone-app-nav-spacer {
          width: 34px;
          flex-shrink: 0;
        }

        /* ========== 关机状态 ========== */
        .phone-panel.powered-off .phone-screen {
          background: #000;
        }
        .phone-panel.powered-off .phone-content,
        .phone-panel.powered-off .phone-status-bar,
        .phone-panel.powered-off .phone-home-indicator {
          opacity: 0;
        }

        /* ========== 通知 - iOS 17 风格 ========== */
        .phone-notification {
          position: absolute;
          top: 58px;
          left: 10px;
          right: 10px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border-radius: 20px;
          padding: 14px 16px;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.08);
          z-index: 200;
          animation: notifSlide 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          border: 0.5px solid rgba(255,255,255,0.5);
          max-height: 120px;
          overflow: hidden;
        }
        @keyframes notifSlide {
          from { transform: translateY(-100%) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .phone-notification .notif-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 5px;
        }
        .phone-notification .notif-icon {
          width: 20px;
          height: 20px;
          border-radius: 5px;
          background: #007aff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #fff;
          box-shadow: 0 1px 4px rgba(0,122,255,0.3);
        }
        .phone-notification .notif-app {
          font-size: 12px;
          color: #8e8e93;
          font-weight: 600;
          letter-spacing: 0.1px;
        }
        .phone-notification .notif-time {
          margin-left: auto;
          font-size: 11px;
          color: #c7c7cc;
          font-weight: 400;
        }
        .phone-notification .notif-title {
          font-size: 15px;
          font-weight: 600;
          color: #000;
          margin-bottom: 2px;
          letter-spacing: -0.1px;
        }
        .phone-notification .notif-body {
          font-size: 14px;
          color: #3a3a3c;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `;

      document.head.appendChild(styles);
    }

    // ==================== 更新方法 ====================

    _updateScreenSize(screen) {
      if (!this._elements.screen) return;
      const scale = this._config.panelScale;
      this._elements.screen.style.width = `${screen.width * scale}px`;
      this._elements.screen.style.height = `${screen.height * scale}px`;
    }

    _updateBattery(data) {
      if (!this._elements.batteryPct) return;
      this._elements.batteryPct.textContent = `${data.battery}%`;
    }

    _updateWifi(data) {
      // 可扩展
    }

    _updateSignal(data) {
      // 可扩展
    }

    _renderApps() {
      if (!this._elements.appsGrid || !this._phone) return;

      const apps = this._phone.getApps();
      const grid = this._elements.appsGrid;
      grid.innerHTML = '';

      apps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'phone-app-icon';
        item.dataset.appId = app.id;

        const iconWrap = document.createElement('div');
        iconWrap.className = 'icon';
        if (app.iconBg) iconWrap.style.background = app.iconBg;
        iconWrap.textContent = app.icon || '📱';

        if (app.badge > 0) {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = app.badge > 99 ? '99+' : app.badge;
          iconWrap.appendChild(badge);
        }

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = app.name;

        item.appendChild(iconWrap);
        item.appendChild(label);
        item.addEventListener('click', () => this._phone.launchApp(app.id));
        grid.appendChild(item);
      });
    }

    // ==================== 事件处理 ====================

    _onInitialized() {
      this.mount();
    }

    _onDeviceChanged(data) {
      console.log('[PhoneRenderer] 设备切换:', data.device.name);
    }

    _onOrientationChanged(data) {
      this._updateScreenSize(data);
    }

    _onPoweredOn() {
      this._elements.panel?.classList.remove('powered-off');
    }

    _onPoweredOff() {
      this._elements.panel?.classList.add('powered-off');
    }

    // [v4.3-fix] 改为 async 以支持 await app.render()
    async _onAppLaunched(data) {
      const app = this._phone.getApp(data.appId);
      if (!app) return;

      this._elements.homeScreen.style.display = 'none';
      this._elements.appContainer.style.display = 'flex';
      this._elements.appContainer.style.flexDirection = 'column';

      this._elements.appContainer.innerHTML = '';

      // 消息模块特殊处理：直接接管容器，不添加 navbar 包裹
      if (data.appId === 'message') {
        this._elements.appContainer.style.display = 'flex';
        this._elements.appContainer.style.flexDirection = 'column';
        this._elements.appContainer.style.height = '100%';
        this._elements.appContainer.style.overflow = 'hidden';
        if (app.render) {
          const appEl = app.render();
          if (appEl) {
            appEl.style.flex = '1';
            appEl.style.display = 'flex';
            appEl.style.flexDirection = 'column';
            appEl.style.height = '100%';
            appEl.style.overflow = 'hidden';
            this._elements.appContainer.appendChild(appEl);
          }
        }
        return;
      }

      // 其他模块：添加顶部返回栏
      const navBar = document.createElement('div');
      navBar.className = 'phone-app-navbar';
      navBar.innerHTML = `
        <button class="phone-app-back-btn" title="返回">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 19 9 12 15 5"/>
          </svg>
        </button>
        <div class="phone-app-nav-spacer"></div>
      `;
      // [安全修复 S-05] app.name 使用 textContent 赋值，防止 XSS
      const titleSpan = document.createElement('span');
      titleSpan.className = 'phone-app-title';
      titleSpan.textContent = app.name || '';
      navBar.appendChild(titleSpan);
      navBar.querySelector('.phone-app-back-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._phone.goBack();
      });
      this._elements.appContainer.appendChild(navBar);

      // 添加 app 内容区域
      const appContent = document.createElement('div');
      appContent.className = 'phone-app-content';
      appContent.style.flex = '1';
      appContent.style.overflow = 'auto';
      appContent.style.position = 'relative';
      // [v4.3-fix] render() 可能是 async，需要 await
      if (app.render) {
        const appEl = await app.render();
        if (appEl) appContent.appendChild(appEl);
      }
      this._elements.appContainer.appendChild(appContent);
    }

    _onHome() {
      this._elements.homeScreen.style.display = 'flex';
      this._elements.appContainer.style.display = 'none';
      this._elements.appContainer.innerHTML = '';
      this._renderApps();
    }

    _onTick(data) {
      const time = data.time;
      const hh = time.getHours().toString().padStart(2, '0');
      const mm = time.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hh}:${mm}`;

      if (this._elements.statusTime) this._elements.statusTime.textContent = timeStr;
      if (this._elements.lockTime) this._elements.lockTime.textContent = timeStr;
    }

    _onNotification(data) {
      const notifEl = document.createElement('div');
      notifEl.className = 'phone-notification';

      // 通知头部
      const header = document.createElement('div');
      header.className = 'notif-header';

      const iconEl = document.createElement('div');
      iconEl.className = 'notif-icon';
      iconEl.textContent = data.icon || '';

      const appEl = document.createElement('span');
      appEl.className = 'notif-app';
      appEl.textContent = data.appName || '通知';

      const timeEl = document.createElement('span');
      timeEl.className = 'notif-time';
      timeEl.textContent = '现在';

      header.appendChild(iconEl);
      header.appendChild(appEl);
      header.appendChild(timeEl);

      // 通知标题
      const titleEl = document.createElement('div');
      titleEl.className = 'notif-title';
      titleEl.textContent = data.title || '';

      // 通知正文
      const bodyEl = document.createElement('div');
      bodyEl.className = 'notif-body';
      bodyEl.textContent = data.body || '';

      notifEl.appendChild(header);
      notifEl.appendChild(titleEl);
      notifEl.appendChild(bodyEl);

      this._elements.screen?.appendChild(notifEl);

      setTimeout(() => {
        notifEl.style.animation = 'notifSlide 0.3s ease reverse';
        setTimeout(() => notifEl.remove(), 300);
      }, 5000);

      notifEl.addEventListener('click', () => {
        notifEl.remove();
        if (data.appId) this._phone.launchApp(data.appId);
      });
    }

    updateStatusGold(gold) {
      try {
        const el = this._elements.panel?.querySelector?.('[data-ref="status-gold"]')
          || this._elements.panel?.querySelector?.('.status-gold');
        if (el) el.textContent = '🪙' + (Number(gold) || 0);
      } catch (e) {
        console.warn('[PhoneRenderer] updateStatusGold 失败:', e);
      }
    }

    // ==================== 公共 API ====================

    getAppContainer() { return this._elements.appContainer; }
    getHomeScreen() { return this._elements.homeScreen; }
    getLockScreen() { return this._elements.lockScreen; }

    get isExpanded() { return this._panelState === 'expanded'; }
  }

  window.PhoneRenderer = PhoneRenderer;
  console.log('[PhoneRenderer] 渲染器v2已加载');
})();
