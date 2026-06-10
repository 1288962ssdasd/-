/**
 * 直播沉浸模式 - Live Immersive Mode
 *
 * 功能：
 * 1. 全屏直播间体验（隐藏手机壳，沉浸式背景）
 * 2. 弹幕飞入动画（从右向左滚动，支持颜色/大小分级）
 * 3. 礼物特效系统（花朵/爱心/火箭/皇冠 各有专属动画）
 * 4. 观众数实时跳动动画
 * 5. 进入/退出直播间过渡动画
 *
 * 依赖：ANIMATION_CLASSES, Feedback, design-tokens CSS变量
 * 导出：window.LiveImmersive
 */
(function () {
  'use strict';

  // ==================== 礼物特效配置 ====================
  var GIFT_EFFECTS = {
    flower: {
      name: '鲜花',
      icon: '🌸',
      particles: 8,
      colors: ['#FF6B9D', '#FF85A1', '#FFB3C6', '#FFC2D4'],
      duration: 2000,
      floatDistance: 120,
    },
    like: {
      name: '点赞',
      icon: '👍',
      particles: 6,
      colors: ['#74B9FF', '#0984E3', '#6C5CE7', '#A29BFE'],
      duration: 1800,
      floatDistance: 100,
    },
    heart: {
      name: '爱心',
      icon: '❤️',
      particles: 12,
      colors: ['#FF4757', '#FF6B81', '#FF8A9E', '#FFAAB8'],
      duration: 2500,
      floatDistance: 150,
    },
    rocket: {
      name: '火箭',
      icon: '🚀',
      particles: 20,
      colors: ['#FF6348', '#FF7F50', '#FFA502', '#FFD700'],
      duration: 3000,
      floatDistance: 200,
    },
    crown: {
      name: '皇冠',
      icon: '👑',
      particles: 25,
      colors: ['#FFD700', '#FFC107', '#FFB300', '#FF9800'],
      duration: 3500,
      floatDistance: 250,
    },
    beer: {
      name: '啤酒',
      icon: '🍺',
      particles: 10,
      colors: ['#FDCB6E', '#F39C12', '#E67E22', '#D35400'],
      duration: 2200,
      floatDistance: 130,
    },
    cake: {
      name: '蛋糕',
      icon: '🎂',
      particles: 15,
      colors: ['#FD79A8', '#E84393', '#FDCB6E', '#FF6B6B'],
      duration: 2800,
      floatDistance: 160,
    },
    candy: {
      name: '糖果',
      icon: '🍬',
      particles: 8,
      colors: ['#A29BFE', '#6C5CE7', '#FD79A8', '#FDCB6E'],
      duration: 2000,
      floatDistance: 110,
    },
  };

  // ==================== 弹幕颜色池 ====================
  var DANMAKU_COLORS = [
    '#FFFFFF', '#FF6B6B', '#48DBFB', '#FF9FF3',
    '#FECA57', '#54A0FF', '#5F27CD', '#01A3A4',
    '#F368E0', '#FF9F43', '#EE5A24', '#A3CB38',
  ];

  // ==================== CSS 注入 ====================
  var STYLES = '\
/* ===== 直播沉浸模式 ===== */\
.live-immersive-container {\
  position: absolute;\
  top: 0; left: 0; right: 0; bottom: 0;\
  z-index: 100;\
  background: linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);\
  display: flex;\
  flex-direction: column;\
  overflow: hidden;\
  opacity: 0;\
  transition: opacity 0.4s ease;\
}\
.live-immersive-container.active {\
  opacity: 1;\
}\
.live-immersive-container.exiting {\
  opacity: 0;\
  transition: opacity 0.3s ease;\
}\
\
/* --- 顶部信息栏 --- */\
.live-immersive-header {\
  position: relative;\
  z-index: 10;\
  padding: 12px 16px 8px;\
  display: flex;\
  align-items: center;\
  gap: 10px;\
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);\
}\
.live-immersive-streamer {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
  flex: 1;\
  min-width: 0;\
}\
.live-immersive-avatar {\
  width: 36px; height: 36px;\
  border-radius: 50%;\
  border: 2px solid var(--color-brand-primary, #FF6B6B);\
  object-fit: cover;\
  flex-shrink: 0;\
}\
.live-immersive-info {\
  min-width: 0;\
}\
.live-immersive-name {\
  font-size: 13px;\
  font-weight: 600;\
  color: #fff;\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.live-immersive-title {\
  font-size: 11px;\
  color: rgba(255,255,255,0.7);\
  white-space: nowrap;\
  overflow: hidden;\
  text-overflow: ellipsis;\
}\
.live-immersive-live-badge {\
  display: inline-flex;\
  align-items: center;\
  gap: 3px;\
  padding: 2px 8px;\
  background: linear-gradient(135deg, #FF4757, #FF6B81);\
  border-radius: 10px;\
  font-size: 10px;\
  font-weight: 700;\
  color: #fff;\
  letter-spacing: 0.5px;\
  flex-shrink: 0;\
}\
.live-immersive-live-badge .dot {\
  width: 5px; height: 5px;\
  border-radius: 50%;\
  background: #fff;\
  animation: imm-pulse-dot 1.2s ease-in-out infinite;\
}\
@keyframes imm-pulse-dot {\
  0%, 100% { opacity: 1; transform: scale(1); }\
  50% { opacity: 0.4; transform: scale(0.7); }\
}\
.live-immersive-viewers {\
  display: flex;\
  align-items: center;\
  gap: 4px;\
  padding: 4px 10px;\
  background: rgba(255,255,255,0.15);\
  border-radius: 12px;\
  font-size: 12px;\
  color: #fff;\
  flex-shrink: 0;\
  backdrop-filter: blur(8px);\
  -webkit-backdrop-filter: blur(8px);\
}\
.live-immersive-viewers .viewer-icon {\
  font-size: 13px;\
}\
.live-immersive-viewers .viewer-count {\
  font-weight: 600;\
  transition: transform 0.2s ease;\
}\
.live-immersive-viewers .viewer-count.bump {\
  animation: imm-viewer-bump 0.3s ease;\
}\
@keyframes imm-viewer-bump {\
  0% { transform: scale(1); }\
  40% { transform: scale(1.3); color: #FECA57; }\
  100% { transform: scale(1); }\
}\
.live-immersive-close {\
  width: 32px; height: 32px;\
  border-radius: 50%;\
  background: rgba(255,255,255,0.15);\
  border: none;\
  color: #fff;\
  font-size: 16px;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  cursor: pointer;\
  flex-shrink: 0;\
  backdrop-filter: blur(8px);\
  -webkit-backdrop-filter: blur(8px);\
  transition: background 0.2s, transform 0.15s;\
}\
.live-immersive-close:active {\
  transform: scale(0.9);\
  background: rgba(255,255,255,0.25);\
}\
\
/* --- 弹幕飞行区域 --- */\
.live-immersive-danmaku-area {\
  position: relative;\
  flex: 1;\
  overflow: hidden;\
  pointer-events: none;\
  z-index: 5;\
}\
\
/* --- 弹幕飞行动画 --- */\
.live-danmaku-fly {\
  position: absolute;\
  white-space: nowrap;\
  padding: 3px 10px;\
  border-radius: 14px;\
  font-size: 13px;\
  font-weight: 500;\
  color: #fff;\
  background: rgba(0,0,0,0.35);\
  backdrop-filter: blur(4px);\
  -webkit-backdrop-filter: blur(4px);\
  pointer-events: none;\
  will-change: transform;\
  animation: imm-danmaku-fly var(--fly-duration, 6s) linear forwards;\
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);\
}\
.live-danmaku-fly.gift-danmaku {\
  background: linear-gradient(90deg, rgba(255,215,0,0.3), rgba(255,107,107,0.3));\
  border: 1px solid rgba(255,215,0,0.4);\
}\
.live-danmaku-fly.system-danmaku {\
  background: rgba(255,71,87,0.4);\
  font-size: 12px;\
}\
@keyframes imm-danmaku-fly {\
  from { transform: translateX(0); }\
  to { transform: translateX(calc(-100% - 100vw)); }\
}\
\
/* --- 礼物特效层 --- */\
.live-immersive-gift-layer {\
  position: absolute;\
  top: 0; left: 0; right: 0; bottom: 0;\
  pointer-events: none;\
  z-index: 15;\
  overflow: hidden;\
}\
\
/* --- 礼物通知条 --- */\
.live-gift-notify {\
  position: absolute;\
  left: 12px;\
  display: flex;\
  align-items: center;\
  gap: 6px;\
  padding: 6px 14px 6px 8px;\
  background: linear-gradient(90deg, rgba(255,215,0,0.25), rgba(255,215,0,0.08));\
  border: 1px solid rgba(255,215,0,0.3);\
  border-radius: 20px;\
  backdrop-filter: blur(10px);\
  -webkit-backdrop-filter: blur(10px);\
  animation: imm-gift-notify-in 0.4s ease forwards, imm-gift-notify-out 0.4s ease 2.5s forwards;\
  white-space: nowrap;\
}\
.live-gift-notify .gift-notify-avatar {\
  width: 24px; height: 24px;\
  border-radius: 50%;\
  object-fit: cover;\
}\
.live-gift-notify .gift-notify-text {\
  font-size: 12px;\
  color: #fff;\
}\
.live-gift-notify .gift-notify-text strong {\
  color: #FFD700;\
}\
.live-gift-notify .gift-notify-icon {\
  font-size: 18px;\
}\
@keyframes imm-gift-notify-in {\
  from { opacity: 0; transform: translateX(-30px) scale(0.8); }\
  to { opacity: 1; transform: translateX(0) scale(1); }\
}\
@keyframes imm-gift-notify-out {\
  from { opacity: 1; transform: translateX(0); }\
  to { opacity: 0; transform: translateX(-20px); }\
}\
\
/* --- 礼物粒子 --- */\
.live-gift-particle {\
  position: absolute;\
  pointer-events: none;\
  will-change: transform, opacity;\
  animation: imm-particle-float var(--p-duration, 2s) ease-out forwards;\
}\
@keyframes imm-particle-float {\
  0% {\
    opacity: 1;\
    transform: translate(0, 0) scale(1) rotate(0deg);\
  }\
  50% {\
    opacity: 0.9;\
    transform: translate(var(--p-mx, 30px), calc(var(--p-my, -80px) * 0.5)) scale(1.2) rotate(180deg);\
  }\
  100% {\
    opacity: 0;\
    transform: translate(var(--p-mx, 30px), var(--p-my, -80px)) scale(0.3) rotate(360deg);\
  }\
}\
\
/* --- 火箭特效 --- */\
.live-rocket-effect {\
  position: absolute;\
  bottom: -60px;\
  left: 50%;\
  transform: translateX(-50%);\
  font-size: 48px;\
  animation: imm-rocket-launch 1.5s ease-in forwards;\
  filter: drop-shadow(0 0 20px rgba(255,99,72,0.8));\
}\
@keyframes imm-rocket-launch {\
  0% { bottom: -60px; opacity: 1; }\
  60% { opacity: 1; }\
  100% { bottom: 110%; opacity: 0; }\
}\
.live-rocket-trail {\
  position: absolute;\
  bottom: -80px;\
  left: 50%;\
  transform: translateX(-50%);\
  width: 8px;\
  height: 80px;\
  background: linear-gradient(180deg, #FF6348, #FFA502, transparent);\
  border-radius: 4px;\
  animation: imm-rocket-launch 1.5s ease-in forwards;\
  opacity: 0.6;\
}\
\
/* --- 皇冠特效 --- */\
.live-crown-effect {\
  position: absolute;\
  top: 50%; left: 50%;\
  transform: translate(-50%, -50%) scale(0);\
  font-size: 64px;\
  animation: imm-crown-appear 2s ease forwards;\
  filter: drop-shadow(0 0 30px rgba(255,215,0,0.9));\
}\
@keyframes imm-crown-appear {\
  0% { transform: translate(-50%, -50%) scale(0) rotate(-30deg); opacity: 0; }\
  20% { transform: translate(-50%, -50%) scale(1.5) rotate(10deg); opacity: 1; }\
  40% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }\
  80% { opacity: 1; }\
  100% { transform: translate(-50%, -50%) scale(1.2) rotate(0deg); opacity: 0; }\
}\
.live-crown-rays {\
  position: absolute;\
  top: 50%; left: 50%;\
  transform: translate(-50%, -50%);\
  width: 200px; height: 200px;\
  border-radius: 50%;\
  background: radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%);\
  animation: imm-crown-rays 2s ease forwards;\
}\
@keyframes imm-crown-rays {\
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }\
  30% { transform: translate(-50%, -50%) scale(1); opacity: 1; }\
  80% { opacity: 0.5; }\
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }\
}\
\
/* --- 底部操作栏 --- */\
.live-immersive-bottom {\
  position: relative;\
  z-index: 10;\
  padding: 10px 16px 16px;\
  background: linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 100%);\
  display: flex;\
  align-items: flex-end;\
  gap: 10px;\
}\
.live-immersive-danmaku-input-wrap {\
  flex: 1;\
  position: relative;\
}\
.live-immersive-danmaku-input {\
  width: 100%;\
  padding: 8px 14px;\
  border-radius: 20px;\
  border: 1px solid rgba(255,255,255,0.2);\
  background: rgba(255,255,255,0.1);\
  color: #fff;\
  font-size: 13px;\
  outline: none;\
  backdrop-filter: blur(8px);\
  -webkit-backdrop-filter: blur(8px);\
  transition: border-color 0.2s, background 0.2s;\
}\
.live-immersive-danmaku-input::placeholder {\
  color: rgba(255,255,255,0.4);\
}\
.live-immersive-danmaku-input:focus {\
  border-color: rgba(255,255,255,0.4);\
  background: rgba(255,255,255,0.15);\
}\
.live-immersive-actions {\
  display: flex;\
  gap: 8px;\
  flex-shrink: 0;\
}\
.live-immersive-action-btn {\
  width: 40px; height: 40px;\
  border-radius: 50%;\
  border: none;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  font-size: 20px;\
  cursor: pointer;\
  transition: transform 0.15s, opacity 0.15s;\
  position: relative;\
}\
.live-immersive-action-btn:active {\
  transform: scale(0.88);\
}\
.live-immersive-action-btn.gift-btn {\
  background: linear-gradient(135deg, #FFD700, #FFA502);\
  box-shadow: 0 2px 8px rgba(255,215,0,0.4);\
}\
.live-immersive-action-btn.share-btn {\
  background: rgba(255,255,255,0.15);\
  backdrop-filter: blur(8px);\
  -webkit-backdrop-filter: blur(8px);\
}\
\
/* --- 礼物面板 --- */\
.live-gift-panel {\
  position: absolute;\
  bottom: 0; left: 0; right: 0;\
  z-index: 20;\
  background: linear-gradient(180deg, rgba(20,20,30,0.95), rgba(10,10,20,0.98));\
  backdrop-filter: blur(20px);\
  -webkit-backdrop-filter: blur(20px);\
  border-radius: 16px 16px 0 0;\
  padding: 16px;\
  transform: translateY(100%);\
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);\
}\
.live-gift-panel.open {\
  transform: translateY(0);\
}\
.live-gift-panel-header {\
  display: flex;\
  justify-content: space-between;\
  align-items: center;\
  margin-bottom: 14px;\
}\
.live-gift-panel-title {\
  font-size: 15px;\
  font-weight: 600;\
  color: #fff;\
}\
.live-gift-panel-close {\
  width: 28px; height: 28px;\
  border-radius: 50%;\
  background: rgba(255,255,255,0.1);\
  border: none;\
  color: rgba(255,255,255,0.6);\
  font-size: 14px;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  cursor: pointer;\
}\
.live-gift-grid {\
  display: grid;\
  grid-template-columns: repeat(4, 1fr);\
  gap: 12px;\
}\
.live-gift-item {\
  display: flex;\
  flex-direction: column;\
  align-items: center;\
  gap: 4px;\
  padding: 10px 4px;\
  border-radius: 12px;\
  background: rgba(255,255,255,0.05);\
  border: 1px solid transparent;\
  cursor: pointer;\
  transition: background 0.2s, border-color 0.2s, transform 0.15s;\
}\
.live-gift-item:hover {\
  background: rgba(255,255,255,0.1);\
}\
.live-gift-item:active {\
  transform: scale(0.93);\
}\
.live-gift-item.selected {\
  border-color: var(--color-brand-primary, #FF6B6B);\
  background: rgba(255,107,107,0.1);\
}\
.live-gift-item .gift-icon {\
  font-size: 32px;\
}\
.live-gift-item .gift-name {\
  font-size: 11px;\
  color: rgba(255,255,255,0.7);\
}\
.live-gift-item .gift-value {\
  font-size: 10px;\
  color: #FFD700;\
}\
.live-gift-send-btn {\
  width: 100%;\
  margin-top: 14px;\
  padding: 10px;\
  border-radius: 22px;\
  border: none;\
  background: linear-gradient(135deg, #FF6B6B, #FF4757);\
  color: #fff;\
  font-size: 14px;\
  font-weight: 600;\
  cursor: pointer;\
  transition: transform 0.15s, opacity 0.15s;\
}\
.live-gift-send-btn:active {\
  transform: scale(0.96);\
  opacity: 0.85;\
}\
\
/* --- 数值飘字 --- */\
.live-value-float {\
  position: absolute;\
  pointer-events: none;\
  font-size: 18px;\
  font-weight: 700;\
  color: #FFD700;\
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);\
  animation: imm-value-float 1.5s ease-out forwards;\
  z-index: 20;\
}\
@keyframes imm-value-float {\
  0% { opacity: 1; transform: translateY(0) scale(0.8); }\
  20% { transform: translateY(-10px) scale(1.1); }\
  100% { opacity: 0; transform: translateY(-60px) scale(0.9); }\
}\
\
/* --- 背景光效 --- */\
.live-bg-glow {\
  position: absolute;\
  border-radius: 50%;\
  pointer-events: none;\
  filter: blur(60px);\
  opacity: 0.3;\
  animation: imm-bg-glow-pulse 4s ease-in-out infinite alternate;\
}\
@keyframes imm-bg-glow-pulse {\
  0% { opacity: 0.2; transform: scale(1); }\
  100% { opacity: 0.4; transform: scale(1.1); }\
}\
';

  // ==================== LiveImmersive 类 ====================
  function LiveImmersive() {
    this._container = null;
    this._isActive = false;
    this._giftPanel = null;
    this._giftPanelOpen = false;
    this._selectedGift = null;
    this._danmakuLaneIndex = 0;
    this._danmakuLaneCount = 8;
    this._danmakuLaneUsed = {};
    this._giftNotifyIndex = 0;
    this._onSendDanmaku = null;
    this._onSendGift = null;
    this._onClose = null;
    this._streamData = null;
  }

  // ==================== 初始化 ====================
  LiveImmersive.prototype.init = function (parentEl) {
    this._container = document.createElement('div');
    this._container.className = 'live-immersive-container';
    this._container.innerHTML = this._buildHTML();
    parentEl.appendChild(this._container);

    this._giftPanel = this._container.querySelector('.live-gift-panel');
    this._bindEvents();
  };

  // ==================== 构建 HTML ====================
  LiveImmersive.prototype._buildHTML = function () {
    return '\
      <div class="live-bg-glow" style="width:200px;height:200px;background:#FF6B6B;top:20%;left:-40px;"></div>\
      <div class="live-bg-glow" style="width:160px;height:160px;background:#6C5CE7;top:40%;right:-30px;animation-delay:-2s;"></div>\
      <div class="live-bg-glow" style="width:120px;height:120px;background:#FFD700;bottom:20%;left:30%;animation-delay:-1s;"></div>\
      <div class="live-immersive-header">\
        <div class="live-immersive-streamer">\
          <img class="live-immersive-avatar" src="" alt="">\
          <div class="live-immersive-info">\
            <div class="live-immersive-name"></div>\
            <div class="live-immersive-title"></div>\
          </div>\
        </div>\
        <div class="live-immersive-live-badge"><span class="dot"></span>LIVE</div>\
        <div class="live-immersive-viewers">\
          <span class="viewer-icon">👁</span>\
          <span class="viewer-count">0</span>\
        </div>\
        <button class="live-immersive-close" data-action="close">✕</button>\
      </div>\
      <div class="live-immersive-danmaku-area"></div>\
      <div class="live-immersive-gift-layer"></div>\
      <div class="live-immersive-bottom">\
        <div class="live-immersive-danmaku-input-wrap">\
          <input class="live-immersive-danmaku-input" type="text" placeholder="发一条弹幕..." maxlength="50">\
        </div>\
        <div class="live-immersive-actions">\
          <button class="live-immersive-action-btn gift-btn" data-action="toggle-gift-panel">🎁</button>\
          <button class="live-immersive-action-btn share-btn" data-action="share">🔗</button>\
        </div>\
      </div>\
      <div class="live-gift-panel">\
        <div class="live-gift-panel-header">\
          <span class="live-gift-panel-title">礼物</span>\
          <button class="live-gift-panel-close" data-action="close-gift-panel">✕</button>\
        </div>\
        <div class="live-gift-grid">' + this._buildGiftGrid() + '</div>\
        <button class="live-gift-send-btn" data-action="send-gift">发送</button>\
      </div>';
  };

  // ==================== 礼物网格 ====================
  LiveImmersive.prototype._buildGiftGrid = function () {
    var html = '';
    var types = ['flower', 'like', 'heart', 'rocket', 'crown', 'beer', 'cake', 'candy'];
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var cfg = GIFT_EFFECTS[t];
      if (!cfg) continue;
      html += '<div class="live-gift-item" data-gift="' + t + '">\
        <span class="gift-icon">' + cfg.icon + '</span>\
        <span class="gift-name">' + cfg.name + '</span>\
        <span class="gift-value">' + cfg.particles + ' 积分</span>\
      </div>';
    }
    return html;
  };

  // ==================== 事件绑定 ====================
  LiveImmersive.prototype._bindEvents = function () {
    var self = this;
    this._container.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-action');

      switch (action) {
        case 'close':
          self.exit();
          if (self._onClose) self._onClose();
          break;
        case 'toggle-gift-panel':
          self._toggleGiftPanel();
          break;
        case 'close-gift-panel':
          self._closeGiftPanel();
          break;
        case 'send-gift':
          self._handleSendGift();
          break;
        case 'share':
          if (window.Feedback) window.Feedback.tab();
          break;
      }
    });

    // 礼物选择
    this._container.addEventListener('click', function (e) {
      var item = e.target.closest('.live-gift-item');
      if (!item) return;
      var giftType = item.getAttribute('data-gift');
      self._selectGift(giftType);
    });

    // 弹幕输入
    var input = this._container.querySelector('.live-immersive-danmaku-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        self._handleSendDanmaku();
      }
    });
  };

  // ==================== 进入沉浸模式 ====================
  LiveImmersive.prototype.enter = function (streamData, callbacks) {
    if (!this._container) return;
    this._streamData = streamData || {};
    this._onSendDanmaku = (callbacks && callbacks.onSendDanmaku) || null;
    this._onSendGift = (callbacks && callbacks.onSendGift) || null;
    this._onClose = (callbacks && callbacks.onClose) || null;

    // 更新头部信息
    var avatar = this._container.querySelector('.live-immersive-avatar');
    var name = this._container.querySelector('.live-immersive-name');
    var title = this._container.querySelector('.live-immersive-title');
    var viewerCount = this._container.querySelector('.viewer-count');

    if (avatar) avatar.src = streamData.streamerAvatar || '';
    if (name) name.textContent = streamData.streamerName || '主播';
    if (title) title.textContent = streamData.title || '直播中...';
    if (viewerCount) viewerCount.textContent = streamData.viewers || 0;

    // 重置状态
    this._danmakuLaneIndex = 0;
    this._danmakuLaneUsed = {};
    this._giftNotifyIndex = 0;
    this._selectedGift = null;
    this._closeGiftPanel();

    // 清空弹幕和礼物层
    var danmakuArea = this._container.querySelector('.live-immersive-danmaku-area');
    var giftLayer = this._container.querySelector('.live-immersive-gift-layer');
    if (danmakuArea) danmakuArea.innerHTML = '';
    if (giftLayer) giftLayer.innerHTML = '';

    // 显示
    this._container.style.display = 'flex';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        self._container.classList.add('active');
      });
    });
    this._isActive = true;

    // 声效反馈
    if (window.Feedback) window.Feedback.success();

    // 聚焦输入框
    setTimeout(function () {
      var input = self._container.querySelector('.live-immersive-danmaku-input');
      if (input) input.focus();
    }, 500);
  };

  // ==================== 退出沉浸模式 ====================
  LiveImmersive.prototype.exit = function () {
    if (!this._container || !this._isActive) return;
    var self = this;
    this._container.classList.remove('active');
    this._container.classList.add('exiting');
    this._closeGiftPanel();

    setTimeout(function () {
      self._container.style.display = 'none';
      self._container.classList.remove('exiting');
      self._isActive = false;
    }, 350);
  };

  // ==================== 是否激活 ====================
  LiveImmersive.prototype.isActive = function () {
    return this._isActive;
  };

  // ==================== 发送弹幕 ====================
  LiveImmersive.prototype._handleSendDanmaku = function () {
    var input = this._container.querySelector('.live-immersive-danmaku-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    if (window.Feedback) window.Feedback.send();

    if (this._onSendDanmaku) {
      this._onSendDanmaku(text);
    }
  };

  // ==================== 发送礼物 ====================
  LiveImmersive.prototype._handleSendGift = function () {
    if (!this._selectedGift) return;
    if (window.Feedback) window.Feedback.coin();

    if (this._onSendGift) {
      this._onSendGift(this._selectedGift);
    }
    this._closeGiftPanel();
    this._selectedGift = null;
  };

  // ==================== 礼物面板 ====================
  LiveImmersive.prototype._toggleGiftPanel = function () {
    if (this._giftPanelOpen) {
      this._closeGiftPanel();
    } else {
      this._openGiftPanel();
    }
  };

  LiveImmersive.prototype._openGiftPanel = function () {
    if (!this._giftPanel) return;
    this._giftPanel.classList.add('open');
    this._giftPanelOpen = true;
  };

  LiveImmersive.prototype._closeGiftPanel = function () {
    if (!this._giftPanel) return;
    this._giftPanel.classList.remove('open');
    this._giftPanelOpen = false;
  };

  LiveImmersive.prototype._selectGift = function (giftType) {
    this._selectedGift = giftType;
    var items = this._container.querySelectorAll('.live-gift-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('selected', items[i].getAttribute('data-gift') === giftType);
    }
    if (window.Feedback) window.Feedback.tab();
  };

  // ==================== 添加弹幕（外部调用） ====================
  LiveImmersive.prototype.addDanmaku = function (danmaku) {
    if (!this._isActive || !this._container) return;

    var area = this._container.querySelector('.live-immersive-danmaku-area');
    if (!area) return;

    var el = document.createElement('div');
    var isGift = danmaku.type === 'gift';
    var isSystem = danmaku.type === 'system';

    el.className = 'live-danmaku-fly' + (isGift ? ' gift-danmaku' : '') + (isSystem ? ' system-danmaku' : '');

    // 随机颜色
    var color = isSystem ? '#FF6B6B' : DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)];
    el.style.color = color;

    // 内容
    if (isGift) {
      el.textContent = danmaku.icon + ' ' + danmaku.userName + ' 送出 ' + (danmaku.giftName || '礼物');
    } else if (isSystem) {
      el.textContent = '📢 ' + danmaku.content;
    } else {
      var prefix = danmaku.userName ? '<span style="color:' + color + ';font-weight:600;">' + danmaku.userName + ':</span> ' : '';
      el.innerHTML = prefix + this._escapeHtml(danmaku.content || '');
    }

    // 轨道分配
    var lane = this._getNextLane();
    var areaHeight = area.clientHeight || 300;
    var laneHeight = areaHeight / this._danmakuLaneCount;
    el.style.top = (lane * laneHeight + 4) + 'px';
    el.style.right = '-300px';

    // 飞行时长（随机 5-8 秒）
    var duration = 5 + Math.random() * 3;
    el.style.setProperty('--fly-duration', duration + 's');

    area.appendChild(el);

    // 动画结束后移除
    var removeTime = duration * 1000 + 500;
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, removeTime);
  };

  // ==================== 轨道分配 ====================
  LiveImmersive.prototype._getNextLane = function () {
    var now = Date.now();
    // 找到最久未使用的轨道
    var bestLane = 0;
    var oldestTime = Infinity;
    for (var i = 0; i < this._danmakuLaneCount; i++) {
      if (!this._danmakuLaneUsed[i] || this._danmakuLaneUsed[i] < oldestTime) {
        oldestTime = this._danmakuLaneUsed[i] || 0;
        bestLane = i;
      }
    }
    this._danmakuLaneUsed[bestLane] = now;
    this._danmakuLaneIndex = (this._danmakuLaneIndex + 1) % this._danmakuLaneCount;
    return bestLane;
  };

  // ==================== 触发礼物特效（外部调用） ====================
  LiveImmersive.prototype.triggerGiftEffect = function (gift) {
    if (!this._isActive || !this._container) return;

    var type = gift.type || 'flower';
    var cfg = GIFT_EFFECTS[type] || GIFT_EFFECTS.flower;
    var giftLayer = this._container.querySelector('.live-immersive-gift-layer');
    if (!giftLayer) return;

    // 声效
    if (window.Feedback) window.Feedback.coin();

    // 1. 礼物通知条
    this._showGiftNotify(gift, cfg);

    // 2. 数值飘字
    this._showValueFloat(gift);

    // 3. 根据礼物类型触发专属特效
    if (type === 'rocket') {
      this._showRocketEffect(giftLayer);
    } else if (type === 'crown') {
      this._showCrownEffect(giftLayer);
    } else {
      this._showParticleEffect(giftLayer, cfg);
    }
  };

  // ==================== 礼物通知条 ====================
  LiveImmersive.prototype._showGiftNotify = function (gift, cfg) {
    var giftLayer = this._container.querySelector('.live-immersive-gift-layer');
    if (!giftLayer) return;

    var notify = document.createElement('div');
    notify.className = 'live-gift-notify';
    notify.style.top = (60 + this._giftNotifyIndex * 44) + 'px';
    this._giftNotifyIndex = (this._giftNotifyIndex + 1) % 5;

    notify.innerHTML = '\
      <img class="gift-notify-avatar" src="' + (gift.userAvatar || '') + '" alt="">\
      <span class="gift-notify-text"><strong>' + this._escapeHtml(gift.userName || '用户') + '</strong> 送出 ' + cfg.icon + ' ' + cfg.name + '</span>\
      <span class="gift-notify-icon">' + cfg.icon + '</span>';

    giftLayer.appendChild(notify);

    // 3秒后移除
    setTimeout(function () {
      if (notify.parentNode) notify.parentNode.removeChild(notify);
    }, 3200);
  };

  // ==================== 数值飘字 ====================
  LiveImmersive.prototype._showValueFloat = function (gift) {
    var giftLayer = this._container.querySelector('.live-immersive-gift-layer');
    if (!giftLayer) return;

    var float = document.createElement('div');
    float.className = 'live-value-float';
    float.textContent = '+' + (gift.value || 0);
    float.style.left = (40 + Math.random() * 60) + '%';
    float.style.top = '45%';

    giftLayer.appendChild(float);

    setTimeout(function () {
      if (float.parentNode) float.parentNode.removeChild(float);
    }, 1800);
  };

  // ==================== 粒子特效（花朵/爱心/自定义） ====================
  LiveImmersive.prototype._showParticleEffect = function (container, cfg) {
    var centerX = container.clientWidth / 2;
    var centerY = container.clientHeight / 2;

    for (var i = 0; i < cfg.particles; i++) {
      (function (index) {
        setTimeout(function () {
          var particle = document.createElement('div');
          particle.className = 'live-gift-particle';
          particle.textContent = cfg.icon;
          particle.style.fontSize = (16 + Math.random() * 16) + 'px';
          particle.style.left = (centerX + (Math.random() - 0.5) * 100) + 'px';
          particle.style.top = (centerY + (Math.random() - 0.5) * 60) + 'px';

          var mx = (Math.random() - 0.5) * cfg.floatDistance;
          var my = -(40 + Math.random() * cfg.floatDistance);
          particle.style.setProperty('--p-mx', mx + 'px');
          particle.style.setProperty('--p-my', my + 'px');
          particle.style.setProperty('--p-duration', (cfg.duration + Math.random() * 500) + 'ms');

          container.appendChild(particle);

          setTimeout(function () {
            if (particle.parentNode) particle.parentNode.removeChild(particle);
          }, cfg.duration + 600);
        }, index * 50);
      })(i);
    }
  };

  // ==================== 火箭特效 ====================
  LiveImmersive.prototype._showRocketEffect = function (container) {
    var trail = document.createElement('div');
    trail.className = 'live-rocket-trail';
    container.appendChild(trail);

    var rocket = document.createElement('div');
    rocket.className = 'live-rocket-effect';
    rocket.textContent = '🚀';
    container.appendChild(rocket);

    // 震动
    if (window.Feedback && window.Feedback.haptic) {
      window.Feedback.haptic.heavy();
    }

    setTimeout(function () {
      if (trail.parentNode) trail.parentNode.removeChild(trail);
      if (rocket.parentNode) rocket.parentNode.removeChild(rocket);
    }, 1800);
  };

  // ==================== 皇冠特效 ====================
  LiveImmersive.prototype._showCrownEffect = function (container) {
    var rays = document.createElement('div');
    rays.className = 'live-crown-rays';
    container.appendChild(rays);

    var crown = document.createElement('div');
    crown.className = 'live-crown-effect';
    crown.textContent = '👑';
    container.appendChild(crown);

    // 震动
    if (window.Feedback && window.Feedback.haptic) {
      window.Feedback.haptic.success();
    }

    setTimeout(function () {
      if (rays.parentNode) rays.parentNode.removeChild(rays);
      if (crown.parentNode) crown.parentNode.removeChild(crown);
    }, 2500);
  };

  // ==================== 更新观众数（带动画） ====================
  LiveImmersive.prototype.updateViewers = function (count) {
    if (!this._container) return;
    var el = this._container.querySelector('.viewer-count');
    if (!el) return;

    var oldCount = parseInt(el.textContent) || 0;
    el.textContent = count;

    if (count !== oldCount) {
      el.classList.remove('bump');
      void el.offsetWidth; // 强制重排
      el.classList.add('bump');
      setTimeout(function () {
        el.classList.remove('bump');
      }, 350);
    }
  };

  // ==================== 更新直播标题 ====================
  LiveImmersive.prototype.updateTitle = function (title) {
    if (!this._container) return;
    var el = this._container.querySelector('.live-immersive-title');
    if (el) el.textContent = title;
  };

  // ==================== 注入样式 ====================
  LiveImmersive.injectStyles = function () {
    if (typeof document !== 'undefined') {
      var style = document.createElement('style');
      style.id = 'live-immersive-styles';
      style.textContent = STYLES;
      document.documentElement.appendChild(style);
    }
  };

  // ==================== 工具方法 ====================
  LiveImmersive.prototype._escapeHtml = function (str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // ==================== 导出 ====================
  window.LiveImmersive = LiveImmersive;
  window.LiveImmersive.GIFT_EFFECTS = GIFT_EFFECTS;
})();
