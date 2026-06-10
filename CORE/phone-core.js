/**
 * Phone Core - 手机模拟器核心
 *
 * 基于 Platform 架构的手机模拟器核心模块。
 * 提供设备模拟、屏幕管理、应用容器等核心能力。
 */

;(function () {
  'use strict';

  /**
   * PhoneCore - 手机模拟器核心类
   */
  class PhoneCore {
    constructor() {
      // 设备配置
      this._device = null;
      
      // 屏幕状态
      this._screen = {
        width: 0,
        height: 0,
        orientation: 'portrait', // portrait | landscape
        brightness: 100,
        locked: false,
      };
      
      // 系统状态
      this._system = {
        powered: false,
        booting: false,
        time: new Date(),
        battery: 100,
        charging: false,
        airplaneMode: false,
        wifi: true,
        signal: 4, // 0-4
      };
      
      // 应用管理
      this._apps = new Map();
      this._activeApp = null;
      this._appStack = []; // 应用栈，用于返回键
      
      // 通知中心
      this._notifications = [];
      this._notificationId = 0;
      
      // 渲染器
      this._renderer = null;
      
      // 事件监听
      this._listeners = new Map();
      
      console.log('[PhoneCore] 实例已创建');
    }

    // ==================== 初始化与销毁 ====================

    /**
     * 初始化手机模拟器
     * @param {Object} config - 配置
     *   - device: 设备型号
     *   - renderer: 渲染器实例
     */
    async init(config = {}) {
      console.log('[PhoneCore] 开始初始化...');

      // 加载设备配置
      if (config.device) {
        await this.loadDevice(config.device);
      }

      // 设置渲染器
      if (config.renderer) {
        this._renderer = config.renderer;
        this._renderer.attach(this);
      }

      // 注册到 Platform
      if (window.Platform) {
        window.Platform.register('phone', this);
      }

      // 启动系统时钟
      this._startSystemClock();

      console.log('[PhoneCore] ✅ 初始化完成');
      this.emit('phone:initialized');
    }

    /**
     * 销毁手机模拟器
     */
    async dispose() {
      this.emit('phone:disposing');

      // 关闭所有应用
      for (const [appId, app] of this._apps) {
        if (app.dispose) {
          await app.dispose();
        }
      }
      this._apps.clear();

      // 停止系统时钟
      this._stopSystemClock();

      // 清理渲染器
      if (this._renderer) {
        this._renderer.detach();
        this._renderer = null;
      }

      this._listeners.clear();

      console.log('[PhoneCore] 已销毁');
    }

    // ==================== 设备管理 ====================

    /**
     * 加载设备配置
     * @param {string} deviceId - 设备型号ID
     */
    async loadDevice(deviceId) {
      const device = DeviceRegistry.get(deviceId);
      if (!device) {
        throw new Error(`未知设备型号: ${deviceId}`);
      }

      this._device = device;
      this._screen.width = device.screen.width;
      this._screen.height = device.screen.height;

      console.log('[PhoneCore] 加载设备:', device.name);
      this.emit('phone:deviceChanged', { device });
    }

    /**
     * 获取当前设备信息
     */
    getDevice() {
      return this._device;
    }

    /**
     * 获取设备列表
     */
    getAvailableDevices() {
      return DeviceRegistry.list();
    }

    // ==================== 屏幕控制 ====================

    /**
     * 旋转屏幕
     */
    rotateScreen() {
      const wasPortrait = this._screen.orientation === 'portrait';
      this._screen.orientation = wasPortrait ? 'landscape' : 'portrait';
      
      // 交换宽高
      const temp = this._screen.width;
      this._screen.width = this._screen.height;
      this._screen.height = temp;

      this.emit('phone:orientationChanged', { 
        orientation: this._screen.orientation,
        width: this._screen.width,
        height: this._screen.height,
      });

      return this._screen.orientation;
    }

    /**
     * 设置屏幕亮度
     * @param {number} level - 0-100
     */
    setBrightness(level) {
      this._screen.brightness = Math.max(0, Math.min(100, level));
      this.emit('phone:brightnessChanged', { brightness: this._screen.brightness });
    }

    /**
     * 锁定/解锁屏幕
     * @param {boolean} locked
     */
    setScreenLocked(locked) {
      this._screen.locked = locked;
      this.emit('phone:screenLockChanged', { locked });
    }

    /**
     * 获取屏幕状态
     */
    getScreen() {
      return { ...this._screen };
    }

    // ==================== 系统控制 ====================

    /**
     * 开机
     */
    async powerOn() {
      if (this._system.powered) return;

      this._system.booting = true;
      this.emit('phone:booting');

      // 模拟开机过程
      await this._delay(1500);

      this._system.powered = true;
      this._system.booting = false;
      this.emit('phone:poweredOn');
    }

    /**
     * 关机
     */
    async powerOff() {
      if (!this._system.powered) return;

      // 关闭所有运行中的应用
      if (this._activeApp) {
        const activeApp = this._apps.get(this._activeApp);
        if (activeApp && activeApp.pause) {
          try { await activeApp.pause(); } catch (e) { /* ignore */ }
        }
      }
      for (const appId of this._appStack) {
        const app = this._apps.get(appId);
        if (app && app.pause) {
          try { await app.pause(); } catch (e) { /* ignore */ }
        }
      }

      this._activeApp = null;
      this._appStack = [];

      this._system.powered = false;
      this.emit('phone:poweredOff');
    }

    /**
     * 设置系统时间
     * @param {Date} time
     */
    setTime(time) {
      this._system.time = time;
      this.emit('phone:timeChanged', { time });
    }

    /**
     * 设置电池电量
     * @param {number} level - 0-100
     */
    setBattery(level) {
      this._system.battery = Math.max(0, Math.min(100, level));
      this.emit('phone:batteryChanged', { battery: this._system.battery });
    }

    /**
     * 设置充电状态
     * @param {boolean} charging
     */
    setCharging(charging) {
      this._system.charging = charging;
      this.emit('phone:chargingChanged', { charging });
    }

    /**
     * 设置飞行模式
     * @param {boolean} enabled
     */
    setAirplaneMode(enabled) {
      this._system.airplaneMode = enabled;
      if (enabled) {
        this._system.wifi = false;
        this._system.signal = 0;
      }
      this.emit('phone:airplaneModeChanged', { enabled });
    }

    /**
     * 设置WiFi状态
     * @param {boolean} enabled
     */
    setWifi(enabled) {
      if (this._system.airplaneMode && enabled) {
        this._system.airplaneMode = false;
      }
      this._system.wifi = enabled;
      this.emit('phone:wifiChanged', { enabled });
    }

    /**
     * 设置信号强度
     * @param {number} level - 0-4
     */
    setSignal(level) {
      this._system.signal = Math.max(0, Math.min(4, level));
      this.emit('phone:signalChanged', { signal: this._system.signal });
    }

    /**
     * 获取系统状态
     */
    getSystem() {
      return { ...this._system };
    }

    // ==================== 应用管理 ====================

    /**
     * 注册应用
     * @param {string} appId - 应用ID
     * @param {Object} app - 应用实例
     */
    registerApp(appId, app) {
      this._apps.set(appId, app);
      console.log('[PhoneCore] 注册应用:', appId);
    }

    /**
     * 启动应用
     * @param {string} appId - 应用ID
     * @param {Object} params - 启动参数
     */
    async launchApp(appId, params = {}) {
      const app = this._apps.get(appId);
      if (!app) {
        console.error('[PhoneCore] 应用不存在:', appId);
        return false;
      }

      // 将当前应用压入栈
      if (this._activeApp) {
        this._appStack.push(this._activeApp);
        const currentApp = this._apps.get(this._activeApp);
        if (currentApp?.pause) {
          await currentApp.pause();
        }
      }

      this._activeApp = appId;

      // 初始化应用
      if (app.init && !app._initialized) {
        await app.init(this, params);
        app._initialized = true;
      }

      // 恢复/启动应用
      if (app.resume) {
        await app.resume(params);
      }

      this.emit('phone:appLaunched', { appId, params });
      return true;
    }

    /**
     * 返回上一个应用
     */
    async goBack() {
      if (this._appStack.length === 0) {
        // 返回桌面
        if (this._activeApp) {
          const app = this._apps.get(this._activeApp);
          if (app?.pause) {
            await app.pause();
          }
          this._activeApp = null;
          this.emit('phone:home');
        }
        return;
      }

      // 暂停当前应用
      if (this._activeApp) {
        const currentApp = this._apps.get(this._activeApp);
        if (currentApp?.pause) {
          await currentApp.pause();
        }
      }

      // 恢复上一个应用
      this._activeApp = this._appStack.pop();
      const app = this._apps.get(this._activeApp);
      if (app?.resume) {
        await app.resume();
      }

      this.emit('phone:appResumed', { appId: this._activeApp });
    }

    /**
     * 返回桌面
     */
    async goHome() {
      this._appStack = [];
      
      if (this._activeApp) {
        const app = this._apps.get(this._activeApp);
        if (app?.pause) {
          await app.pause();
        }
        this._activeApp = null;
      }

      this.emit('phone:home');
    }

    /**
     * 获取当前应用
     */
    getActiveApp() {
      return this._activeApp;
    }

    /**
     * 获取应用实例
     * @param {string} appId
     */
    getApp(appId) {
      return this._apps.get(appId);
    }

    /**
     * 获取所有应用
     */
    getApps() {
      return Array.from(this._apps.entries()).map(([id, app]) => ({
        id,
        name: app.name || id,
        icon: app.icon,
        iconBg: app.iconBg,
        badge: app.badge || 0,
      }));
    }

    // ==================== 通知中心 ====================

    /**
     * 发送通知
     * @param {Object} notification
     *   - title: 标题
     *   - body: 内容
     *   - icon: 图标
     *   - appId: 来源应用
     *   - actions: 操作按钮
     *   - persistent: 是否持久显示
     */
    sendNotification(notification) {
      const id = ++this._notificationId;
      const notif = {
        id,
        timestamp: Date.now(),
        read: false,
        ...notification,
      };

      this._notifications.unshift(notif);

      // 限制通知数量
      if (this._notifications.length > 50) {
        this._notifications = this._notifications.slice(0, 50);
      }

      this.emit('phone:notification', notif);

      // 触发应用角标更新
      if (notification.appId) {
        const app = this._apps.get(notification.appId);
        if (app) {
          app.badge = (app.badge || 0) + 1;
          this.emit('phone:badgeUpdated', { appId: notification.appId, badge: app.badge });
        }
      }

      return id;
    }

    /**
     * 标记通知已读
     * @param {number} id - 通知ID
     */
    markNotificationRead(id) {
      const notif = this._notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        this.emit('phone:notificationRead', { id });
      }
    }

    /**
     * 清除通知
     * @param {number} id - 通知ID，不传则清除所有
     */
    clearNotification(id) {
      if (id) {
        this._notifications = this._notifications.filter(n => n.id !== id);
        this.emit('phone:notificationCleared', { id });
      } else {
        this._notifications = [];
        this.emit('phone:allNotificationsCleared');
      }
    }

    /**
     * 获取通知列表
     * @param {boolean} unreadOnly - 只返回未读
     */
    getNotifications(unreadOnly = false) {
      if (unreadOnly) {
        return this._notifications.filter(n => !n.read);
      }
      return [...this._notifications];
    }

    // ==================== 事件系统 ====================

    /**
     * 订阅事件
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    on(event, handler) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(handler);

      return () => this.off(event, handler);
    }

    /**
     * 取消订阅
     */
    off(event, handler) {
      this._listeners.get(event)?.delete(handler);
    }

    /**
     * 触发事件
     */
    emit(event, data) {
      const handlers = this._listeners.get(event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (e) {
            console.error('[PhoneCore] 事件处理错误:', event, e);
          }
        }
      }

      // 同时触发到 Platform 事件总线
      if (window.Platform?.emit) {
        window.Platform.emit(event, data);
      }
    }

    // ==================== 内部方法 ====================

    _startSystemClock() {
      this._clockInterval = setInterval(() => {
        this._system.time = new Date();
        this.emit('phone:tick', { time: this._system.time });
      }, 1000);
    }

    _stopSystemClock() {
      if (this._clockInterval) {
        clearInterval(this._clockInterval);
        this._clockInterval = null;
      }
    }

    _delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // ==================== 设备注册表 ====================

  const DeviceRegistry = {
    _devices: new Map(),

    register(device) {
      this._devices.set(device.id, device);
    },

    get(id) {
      return this._devices.get(id);
    },

    list() {
      return Array.from(this._devices.values()).map(d => ({
        id: d.id,
        name: d.name,
        platform: d.platform,
        screen: d.screen,
      }));
    },
  };

  // 注册默认设备
  DeviceRegistry.register({
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    platform: 'iOS',
    screen: { width: 393, height: 852, dpr: 3 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    touch: true,
    notch: true,
    homeIndicator: true,
  });

  DeviceRegistry.register({
    id: 'iphone-15-pro-max',
    name: 'iPhone 15 Pro Max',
    platform: 'iOS',
    screen: { width: 430, height: 932, dpr: 3 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    touch: true,
    notch: true,
    homeIndicator: true,
  });

  DeviceRegistry.register({
    id: 'pixel-8',
    name: 'Google Pixel 8',
    platform: 'Android',
    screen: { width: 412, height: 915, dpr: 2.625 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    touch: true,
    notch: false,
    homeIndicator: true,
  });

  DeviceRegistry.register({
    id: 'pixel-8-pro',
    name: 'Google Pixel 8 Pro',
    platform: 'Android',
    screen: { width: 448, height: 998, dpr: 3 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36',
    touch: true,
    notch: false,
    homeIndicator: true,
  });

  DeviceRegistry.register({
    id: 'samsung-s24',
    name: 'Samsung Galaxy S24',
    platform: 'Android',
    screen: { width: 412, height: 915, dpr: 3 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36',
    touch: true,
    notch: false,
    homeIndicator: true,
  });

  // 暴露到全局
  window.PhoneCore = PhoneCore;
  window.PhoneDeviceRegistry = DeviceRegistry;

  console.log('[PhoneCore] 核心模块已加载');
})();
