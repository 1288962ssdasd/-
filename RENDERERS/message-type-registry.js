/**
 * 消息类型注册表
 * 
 * 统一消息渲染入口，支持8种消息类型：
 * text, voice, redpack, image, transfer, location, sticker, system
 * 
 * 铁则合规：
 * - 纯渲染层，只负责DOM生成，不操作数据
 * - 不直接调用 Service 或 Schema
 * - 动画通过 CSS 类触发
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  // 消息类型注册表
  const MessageTypeRegistry = {
    // ==================== 文字消息 ====================
    text: {
      render(msg) {
        const content = escapeHtml(msg.content || '');
        return `<div class="msg-content text">${content}</div>`;
      },
      getAnimation() {
        return 'anim-msg-enter';
      }
    },

    // ==================== 语音消息 ====================
    voice: {
      render(msg) {
        const duration = msg.duration || 1;
        const isPlayed = msg.isPlayed ? 'played' : '';
        const width = Math.min(200, 60 + duration * 8);
        
        return `
          <div class="msg-content voice ${isPlayed}" style="width: ${width}px">
            <div class="voice-icon">
              <span class="voice-wave"></span>
              <span class="voice-wave"></span>
              <span class="voice-wave"></span>
            </div>
            <span class="voice-duration">${duration}"</span>
            <button class="voice-play-btn">▶</button>
          </div>
        `;
      },
      getAnimation() {
        return 'anim-msg-enter';
      },
      onMount(el, msg) {
        const playBtn = el.querySelector('.voice-play-btn');
        const waves = el.querySelectorAll('.voice-wave');
        
        playBtn.addEventListener('click', () => {
          // 触发自定义事件，由 Module 层处理播放逻辑
          el.dispatchEvent(new CustomEvent('voice:play', { 
            detail: { messageId: msg.id, url: msg.content },
            bubbles: true 
          }));
          
          // 视觉反馈
          el.classList.add('playing');
          waves.forEach((w, i) => {
            w.style.animationDelay = `${i * 0.1}s`;
          });
        });
      }
    },

    // ==================== 红包消息 ====================
    redpack: {
      render(msg) {
        const status = msg.status || 'pending'; // pending, opened, expired
        const blessing = escapeHtml(msg.blessing || '恭喜发财');
        
        return `
          <div class="msg-content redpack ${status}" data-id="${msg.id}">
            <div class="redpack-icon">🧧</div>
            <div class="redpack-info">
              <div class="redpack-blessing">${blessing}</div>
              <div class="redpack-status">${this._getStatusText(status)}</div>
            </div>
          </div>
        `;
      },
      _getStatusText(status) {
        const map = { pending: '点击领取', opened: '已领取', expired: '已过期' };
        return map[status] || '点击领取';
      },
      getAnimation() {
        return 'anim-bounce-in';
      },
      onMount(el, msg) {
        if (msg.status === 'pending') {
          // 未领取红包添加摇晃动画
          // [v4.31.0-fix] 内存泄漏修复：保存 intervalId 到元素属性，便于清理
          const intervalId = setInterval(() => {
            if (!el.classList.contains('opened')) {
              el.classList.add('wiggling');
              setTimeout(() => el.classList.remove('wiggling'), 500);
            }
          }, 3000);
          el._redpackIntervalId = intervalId;

          el.addEventListener('click', () => {
            el.dispatchEvent(new CustomEvent('redpack:claim', {
              detail: { messageId: msg.id },
              bubbles: true
            }));
          });
        }
      },
      // [v4.31.0-fix] 新增销毁钩子，清理定时器
      onUnmount(el) {
        if (el._redpackIntervalId) {
          clearInterval(el._redpackIntervalId);
          el._redpackIntervalId = null;
        }
      }
    },

    // ==================== 图片消息 ====================
    image: {
      render(msg) {
        // [v4.31.0-fix] XSS 防护：URL 不应使用 escapeHtml（会破坏 & 等字符），改用 encodeURI
        const url = encodeURI(msg.content || '');
        return `
          <div class="msg-content image">
            <img src="${url}" loading="lazy" alt="图片" />
          </div>
        `;
      },
      getAnimation() {
        return 'anim-scale-in';
      },
      onMount(el, msg) {
        const img = el.querySelector('img');
        img.addEventListener('click', () => {
          el.dispatchEvent(new CustomEvent('image:preview', {
            detail: { url: msg.content },
            bubbles: true
          }));
        });
        
        // 图片加载失败显示占位
        img.addEventListener('error', () => {
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/><text fill="%23999" x="50" y="55" text-anchor="middle">图片</text></svg>';
        });
      }
    },

    // ==================== 转账消息 ====================
    transfer: {
      render(msg) {
        const amount = msg.amount || 0;
        const status = msg.status || 'pending'; // pending, received, refunded
        
        return `
          <div class="msg-content transfer ${status}">
            <div class="transfer-icon">💰</div>
            <div class="transfer-amount">¥${amount.toFixed(2)}</div>
            <div class="transfer-status">${this._getStatusText(status)}</div>
          </div>
        `;
      },
      _getStatusText(status) {
        const map = { pending: '待收款', received: '已收款', refunded: '已退回' };
        return map[status] || '待收款';
      },
      getAnimation() {
        return 'anim-msg-enter';
      },
      onMount(el, msg) {
        if (msg.status === 'pending') {
          el.addEventListener('click', () => {
            el.dispatchEvent(new CustomEvent('transfer:claim', {
              detail: { messageId: msg.id },
              bubbles: true
            }));
          });
        }
      }
    },

    // ==================== 位置消息 ====================
    location: {
      render(msg) {
        const name = escapeHtml(msg.name || '位置');
        const address = escapeHtml(msg.address || '');
        
        return `
          <div class="msg-content location">
            <div class="location-map"></div>
            <div class="location-info">
              <div class="location-name">📍 ${name}</div>
              <div class="location-address">${address}</div>
            </div>
          </div>
        `;
      },
      getAnimation() {
        return 'anim-msg-enter';
      },
      onMount(el, msg) {
        el.addEventListener('click', () => {
          el.dispatchEvent(new CustomEvent('location:open', {
            detail: { lat: msg.lat, lng: msg.lng, name: msg.name },
            bubbles: true
          }));
        });
      }
    },

    // ==================== 贴纸消息 ====================
    sticker: {
      render(msg) {
        const stickerId = msg.stickerId || msg.content;
        // 贴纸使用表情符号或图片URL
        const isEmoji = /^[\u{1F300}-\u{1F9FF}]$/u.test(stickerId);

        if (isEmoji) {
          return `<div class="msg-content sticker emoji">${stickerId}</div>`;
        }

        // [v4.31.0-fix] XSS 防护：图片 URL 使用 encodeURI 编码，防止属性注入
        const safeStickerUrl = encodeURI(stickerId || '');
        return `<div class="msg-content sticker"><img src="${safeStickerUrl}" alt="贴纸" /></div>`;
      },
      getAnimation() {
        return 'anim-scale-in';
      }
    },

    // ==================== 系统消息 ====================
    system: {
      render(msg) {
        const content = escapeHtml(msg.content || '');
        return `<div class="msg-system">${content}</div>`;
      },
      getAnimation() {
        return 'anim-fade-in';
      }
    }
  };

  // ==================== 渲染入口 ====================

  /**
   * 渲染单条消息
   * @param {Object} msg - 消息数据对象
   * @param {Object} options - { isSelf, showTime }
   * @returns {HTMLElement}
   */
  function renderMessage(msg, options = {}) {
    const { isSelf = false, showTime = false } = options;
    const type = MessageTypeRegistry[msg.type] ? msg.type : 'text';
    const renderer = MessageTypeRegistry[type];
    
    // 创建消息容器
    const wrapper = document.createElement('div');
    wrapper.className = `msg-item ${type} ${isSelf ? 'self' : 'other'}`;
    wrapper.dataset.messageId = msg.id;
    wrapper.dataset.timestamp = msg.timestamp;
    
    // 添加时间戳（如果需要）
    if (showTime && msg.timestamp) {
      const timeEl = document.createElement('div');
      timeEl.className = 'msg-time';
      timeEl.textContent = formatTime(msg.timestamp);
      wrapper.appendChild(timeEl);
    }
    
    // 创建消息主体
    const body = document.createElement('div');
    body.className = 'msg-body';
    
    // 头像（非系统消息）
    if (type !== 'system') {
      const avatar = document.createElement('img');
      avatar.className = 'msg-avatar';
      avatar.src = msg.senderAvatar || (isSelf ? 'self-avatar.png' : 'default-avatar.png');
      body.appendChild(avatar);
    }
    
    // 消息内容
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderer.render(msg);
    
    // 添加动画类
    const animClass = renderer.getAnimation();
    if (animClass) {
      bubble.classList.add(animClass);
    }
    
    body.appendChild(bubble);
    wrapper.appendChild(body);
    
    // 挂载后回调
    if (renderer.onMount) {
      // 使用 requestAnimationFrame 确保 DOM 已插入
      requestAnimationFrame(() => {
        renderer.onMount(bubble.querySelector('.msg-content'), msg);
      });
    }
    
    return wrapper;
  }

  /**
   * 批量渲染消息列表
   * @param {Array} messages - 消息数组
   * @param {Object} options - 渲染选项
   * @returns {DocumentFragment}
   */
  function renderMessageList(messages, options = {}) {
    const fragment = document.createDocumentFragment();
    let lastTime = 0;
    const TIME_GAP = 5 * 60 * 1000; // 5分钟显示一次时间
    
    messages.forEach((msg, index) => {
      const showTime = index === 0 || (msg.timestamp - lastTime > TIME_GAP);
      if (showTime) lastTime = msg.timestamp;
      
      const el = renderMessage(msg, { ...options, showTime });
      fragment.appendChild(el);
    });
    
    return fragment;
  }

  // ==================== 工具函数 ====================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // ==================== 导出 ====================

  window.MessageTypeRegistry = MessageTypeRegistry;
  window.renderMessage = renderMessage;
  window.renderMessageList = renderMessageList;

})();
