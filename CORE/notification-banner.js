/**
 * 通知横幅系统
 * 
 * 在ST页面顶部显示iOS风格推送通知
 * 内容从DataStore订阅获取，不直接监听WebSocket
 * 
 * 铁则合规：
 * - 从DataStore订阅数据，不直接操作WebSocket
 * - 纯渲染层，不操作业务数据
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  class NotificationBanner {
    constructor(platform) {
      this._platform = platform;
      this._container = null;
      this._currentBanner = null;
      this._queue = [];
      this._isShowing = false;
      this._subscriptions = [];
      
      this._init();
    }

    _init() {
      // 创建容器
      this._container = document.createElement('div');
      this._container.id = 'phone-notification-container';
      this._container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        pointer-events: none;
        padding: 12px;
      `;
      document.body.appendChild(this._container);

      // 订阅消息事件（通过EventBus，不直接监听WebSocket）
      this._subscribeToEvents();
    }

    _subscribeToEvents() {
      if (!this._platform?.eventBus) return;

      // 订阅消息发送事件
      const unsubMessage = this._platform.eventBus.on('message:received', (event) => {
        this._handleMessage(event.data);
      });
      this._subscriptions.push(unsubMessage);

      // 订阅红包事件
      const unsubRedpack = this._platform.eventBus.on('redpack:claimed', (event) => {
        this._handleRedpack(event.data);
      });
      this._subscriptions.push(unsubRedpack);

      // 订阅转账事件
      const unsubTransfer = this._platform.eventBus.on('transfer:claimed', (event) => {
        this._handleTransfer(event.data);
      });
      this._subscriptions.push(unsubTransfer);

      // [F-01] 订阅 DirectorServiceV2 的通知事件
      const unsubDirector = this._platform.eventBus.on('director:showNotification', (event) => {
        this._handleDirectorNotification(event.data);
      });
      this._subscriptions.push(unsubDirector);
    }

    _handleMessage(data) {
      const { friendId, content, isAI } = data;
      
      // 从FriendsData获取好友信息
      this._platform.data('friends', 'list', []).then(friends => {
        const friend = friends.find(f => f.id === friendId);
        if (!friend) return;

        this.show({
          type: 'message',
          icon: friend.avatar || 'default-avatar.png',
          title: friend.name,
          body: this._truncate(content, 50),
          action: () => {
            // 点击打开消息应用
            this._platform.eventBus.emit('app:open', { appId: 'message', data: { friendId } });
          }
        });
      });
    }

    _handleRedpack(data) {
      const { friendId, amount } = data;
      
      this._platform.data('friends', 'list', []).then(friends => {
        const friend = friends.find(f => f.id === friendId);
        
        this.show({
          type: 'redpack',
          icon: '🧧',
          title: friend?.name || '好友',
          body: `发来一个红包，金额 ¥${amount}`,
          style: 'redpack',
          duration: 8000
        });
      });
    }

    _handleTransfer(data) {
      const { friendId, amount } = data;
      
      this._platform.data('friends', 'list', []).then(friends => {
        const friend = friends.find(f => f.id === friendId);
        
        this.show({
          type: 'transfer',
          icon: '💰',
          title: friend?.name || '好友',
          body: `转账 ¥${amount} 给你`,
          style: 'transfer',
          duration: 8000
        });
      });
    }

    show(options) {
      const { 
        type = 'default',
        icon, 
        title, 
        body, 
        action,
        style = 'default',
        duration = 5000 
      } = options;

      // 如果正在显示，加入队列
      if (this._isShowing) {
        this._queue.push(options);
        return;
      }

      this._isShowing = true;

      // 创建横幅
      const banner = document.createElement('div');
      banner.className = `phone-notification-banner ${style}`;
      banner.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: var(--radius-2xl);
        padding: var(--space-4);
        margin-bottom: var(--space-3);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        gap: var(--space-3);
        pointer-events: auto;
        cursor: pointer;
        animation: anim-banner-in 400ms var(--ease-spring) both;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      `;

      // 特殊样式
      if (style === 'redpack') {
        banner.style.background = 'linear-gradient(135deg, #fa9d3b 0%, #f56c1e 100%)';
        banner.style.color = 'white';
      } else if (style === 'transfer') {
        banner.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
        banner.style.color = '#333';
      }

      // 图标
      const iconEl = document.createElement('div');
      iconEl.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md);
        overflow: hidden;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        background: ${style === 'default' ? 'var(--color-bg-input)' : 'rgba(255,255,255,0.3)'};
      `;
      if (icon.startsWith('http') || icon.startsWith('data:')) {
        iconEl.innerHTML = `<img src="${icon}" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        iconEl.textContent = icon;
      }
      banner.appendChild(iconEl);

      // 内容
      const content = document.createElement('div');
      content.style.cssText = 'flex: 1; min-width: 0;';
      content.innerHTML = `
        <div style="font-weight: var(--font-weight-semibold); font-size: var(--font-size-md); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
        <div style="font-size: var(--font-size-sm); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${body}</div>
      `;
      banner.appendChild(content);

      // 点击事件
      banner.addEventListener('click', () => {
        this._dismiss(banner);
        if (action) action();
      });

      // 自动消失
      const autoDismiss = setTimeout(() => {
        this._dismiss(banner);
      }, duration);

      // 鼠标悬停暂停计时
      banner.addEventListener('mouseenter', () => {
        clearTimeout(autoDismiss);
      });

      this._container.appendChild(banner);
      this._currentBanner = banner;
    }

    _dismiss(banner) {
      if (!banner) return;
      
      banner.style.animation = 'anim-banner-out 300ms ease both';
      
      setTimeout(() => {
        banner.remove();
        this._isShowing = false;
        this._currentBanner = null;
        
        // 处理队列
        if (this._queue.length > 0) {
          const next = this._queue.shift();
          setTimeout(() => this.show(next), 200);
        }
      }, 300);
    }

    _handleDirectorNotification(data) {
      const { app, title, message } = data || {};
      if (!title && !message) return;

      try {
        // 优先使用 PhoneShell 的 showNotification（系统级通知）
        if (window.PhoneShell?.showNotification) {
          window.PhoneShell.showNotification(app || 'system', title || '通知', message || '');
          return;
        }
      } catch (e) {
        console.warn('[NotificationBanner] PhoneShell.showNotification 调用失败，降级为横幅显示:', e?.message || e);
      }

      // 降级：使用横幅显示
      this.show({
        type: 'director',
        icon: '📱',
        title: title || '通知',
        body: message || '',
        style: 'default',
        duration: 5000,
        action: () => {
          if (app) {
            this._platform.eventBus.emit('app:open', { appId: app });
          }
        }
      });
    }

    _truncate(text, maxLength) {
      if (!text) return '';
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    }

    destroy() {
      // 取消订阅
      this._subscriptions.forEach(unsub => unsub());
      this._subscriptions = [];
      
      // 清除容器
      if (this._container) {
        this._container.remove();
        this._container = null;
      }
    }
  }

  // 导出
  window.NotificationBanner = NotificationBanner;

})();
