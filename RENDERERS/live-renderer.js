/**
 * @layer Renderer
 * @file   live-renderer.js
 *
 * 职责: 直播模块 UI 渲染 - 斗鱼风格
 * 禁止: 包含业务逻辑、调用 Service、修改数据
 *
 * 从 live-module.js 提取的渲染方法：
 *   - injectStyles()              ← _injectStyles() 中的 CSS
 *   - renderApp()                 ← onRender()
 *   - renderList()                ← _renderList()
 *   - renderStreamContent()       ← _renderStreamContent()
 *   - renderHistory()             ← _renderHistory()
 *   - renderDanmakuList()        ← _loadDanmaku() 中的 DOM 部分
 *   - createFloatingDanmaku()     ← _createFloatingDanmaku()
 *   - createFloatingDanmakuDouyu() ← _createFloatingDanmakuDouyu()
 *   - getUserLevel()              ← _getUserLevel()
 *
 * 铁则合规：
 *   - CSS 类名以 live- 前缀（铁则二十一）
 *   - Renderer 不直接调用 Service（铁则三）
 *   - 通过 callbacks 对象将事件传递给 Module
 */

;(function () {
  'use strict';

  // ==================== 预设常量（纯展示用） ====================

  const GIFT_EMOJI = {
    flower: '\u{1F338}', like: '\u{1F44D}', candy: '\u{1F36C}',
    heart: '\u{2764}\u{FE0F}', beer: '\u{1F37A}', cake: '\u{1F382}',
    rocket: '\u{1F680}', crown: '\u{1F451}',
  };

  const GIFT_NAMES = {
    flower: '鲜花', like: '点赞', candy: '糖果',
    heart: '爱心', beer: '啤酒', cake: '蛋糕',
    rocket: '火箭', crown: '皇冠',
  };

  const GIFT_PRICES = {
    flower: 1, like: 1, candy: 2,
    heart: 5, beer: 10, cake: 20,
    rocket: 50, crown: 100,
  };

  const GIFT_TIERS = {
    small: ['flower', 'like', 'candy'],
    medium: ['heart', 'beer', 'cake'],
    large: ['rocket', 'crown'],
  };

  class LiveRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.className = 'live-module-styles';
      style.textContent = this._getEmbeddedStyles();
      document.head.appendChild(style);
    }

    _getEmbeddedStyles() {
      return `
        /* ===== Live Module - 直播广场风格 ===== */
        .live-app {
          width: 100%;
          height: 100%;
          background: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
          color: #FFFFFF;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* ===== Header ===== */
        .live-header {
          background: #16213E;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .live-title {
          font-size: 17px;
          font-weight: 600;
          color: #FFFFFF;
          margin: 0;
          letter-spacing: -0.2px;
        }

        /* ===== Buttons - Base ===== */
        .live-btn {
          border: none;
          cursor: pointer;
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
          transition: all 0.2s ease;
        }
        .live-btn-history {
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 500;
          border-radius: 14px;
        }
        .live-btn-history:active {
          background: rgba(255, 255, 255, 0.18);
          transform: scale(0.95);
        }

        /* ===== Views Container ===== */
        .live-views {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .live-view {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ===== Actions Bar ===== */
        .live-actions {
          padding: 12px 16px;
          flex-shrink: 0;
        }
        .live-btn-start {
          width: 100%;
          padding: 12px 0;
          background: linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%);
          color: #FFFFFF;
          font-size: 15px;
          font-weight: 600;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.35);
        }
        .live-btn-start:active {
          transform: scale(0.97);
          box-shadow: 0 2px 6px rgba(255, 107, 53, 0.25);
        }

        /* ===== 直播广场 - 热门横向滚动 ===== */
        .live-hot-section {
          padding: 12px 0 4px 0;
          flex-shrink: 0;
        }
        .live-section-title {
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
          padding: 0 16px 8px 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .live-section-title::before {
          content: '';
          display: inline-block;
          width: 3px;
          height: 14px;
          background: linear-gradient(180deg, #FF6B35 0%, #FF3B30 100%);
          border-radius: 2px;
        }
        .live-hot-scroll {
          display: flex;
          gap: 10px;
          padding: 0 16px 12px 16px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .live-hot-scroll::-webkit-scrollbar {
          display: none;
        }

        /* 热门直播卡片 */
        .live-hot-card {
          flex-shrink: 0;
          width: 140px;
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          background: #16213E;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.15s ease;
        }
        .live-hot-card:active {
          transform: scale(0.96);
        }
        .live-hot-cover {
          width: 100%;
          height: 90px;
          background-size: cover;
          background-position: center;
          background-color: #2A2A4A;
          max-width: 100%;
          overflow: hidden;
        }
        .live-hot-info {
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .live-hot-title {
          font-size: 12px;
          font-weight: 500;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-hot-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #8E8EA0;
        }
        .live-hot-viewers {
          color: #FF6B35;
          font-weight: 500;
        }
        .live-hot-badge {
          position: absolute;
          top: 6px;
          left: 6px;
          padding: 1px 6px;
          background: #FF3B30;
          color: #FFFFFF;
          font-size: 9px;
          font-weight: 700;
          border-radius: 4px;
          letter-spacing: 0.5px;
          box-shadow: 0 1px 3px rgba(255, 59, 48, 0.5);
          animation: live-badge-pulse 2s ease-in-out infinite;
        }
        .live-hot-viewer-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 1px 6px;
          background: rgba(0, 0, 0, 0.6);
          color: #FFFFFF;
          font-size: 10px;
          border-radius: 4px;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        /* ===== 直播列表 ===== */
        .live-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 16px 16px 16px;
        }

        /* 直播列表卡片 */
        .live-stream-item {
          background: #16213E;
          border-radius: 12px;
          padding: 0;
          display: flex;
          flex-direction: column;
          position: relative;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.15s ease, background 0.15s ease;
          cursor: pointer;
          overflow: hidden;
        }
        .live-card-cover {
          height: 100px;
          background-size: cover;
          background-position: center;
          background-color: #2A2A4A;
          max-width: 100%;
          overflow: hidden;
        }
        .live-card-body {
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .live-stream-item:active {
          transform: scale(0.98);
          background: #1A2744;
        }

        /* 直播标签 */
        .live-tag {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-right: 4px;
        }
        .live-tag-hot {
          background: rgba(255, 59, 48, 0.2);
          color: #FF3B30;
        }
        .live-tag-new {
          background: rgba(0, 122, 255, 0.2);
          color: #007AFF;
        }
        .live-tag-game {
          background: rgba(52, 199, 89, 0.2);
          color: #34C759;
        }
        .live-tag-chat {
          background: rgba(175, 82, 222, 0.2);
          color: #AF52DE;
        }

        /* Stream Avatar */
        .live-stream-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-color: #2A2A4A;
          flex-shrink: 0;
          border: 2px solid rgba(255, 107, 53, 0.4);
          position: relative;
        }
        .live-stream-avatar::before {
          content: '';
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #3A3A5C 0%, #2A2A4A 100%);
        }
        .live-stream-avatar[style*="url"]::before {
          display: none;
        }

        /* Stream Info */
        .live-stream-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .live-stream-title {
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.1px;
        }
        .live-stream-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .live-streamer {
          font-size: 13px;
          color: #8E8EA0;
          font-weight: 400;
        }
        .live-viewers {
          font-size: 12px;
          color: #FF6B35;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 3px;
        }

        /* Badge */
        .live-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 2px 8px;
          background: #FF3B30;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: 700;
          border-radius: 6px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 1px 4px rgba(255, 59, 48, 0.4);
          animation: live-badge-pulse 2s ease-in-out infinite;
        }
        @keyframes live-badge-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* ===== Watch View - 斗鱼风格 ===== */
        .live-watch-douyu {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0a0a0a;
          position: relative;
          overflow: hidden;
        }

        /* ===== 顶部主播信息卡 ===== */
        .live-douyu-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%);
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          gap: 10px;
        }
        .live-douyu-back {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .live-douyu-back svg {
          width: 20px;
          height: 20px;
        }
        .live-douyu-back:active {
          background: rgba(255,255,255,0.2);
          transform: scale(0.95);
        }
        .live-douyu-anchor {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .live-douyu-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .live-douyu-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-color: #2A2A4A;
          border: 2px solid rgba(255,255,255,0.3);
        }
        .live-douyu-online-dot {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 10px;
          height: 10px;
          background: #34C759;
          border-radius: 50%;
          border: 2px solid #0a0a0a;
          animation: online-pulse 2s ease-in-out infinite;
        }
        @keyframes online-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(52, 199, 89, 0); }
        }
        .live-douyu-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .live-douyu-name {
          font-size: 14px;
          font-weight: 600;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-douyu-title {
          font-size: 11px;
          color: rgba(255,255,255,0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-douyu-follow {
          padding: 5px 12px;
          background: linear-gradient(135deg, #FF6B35 0%, #FF3B30 100%);
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 600;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .live-douyu-follow:active {
          transform: scale(0.95);
        }
        .live-douyu-follow.followed {
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.8);
        }
        .live-douyu-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .live-douyu-viewers {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(0,0,0,0.5);
          border-radius: 12px;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 500;
        }
        .live-douyu-viewers svg {
          width: 14px;
          height: 14px;
          color: #FF6B35;
        }
        .live-douyu-share {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          transition: all 0.2s ease;
        }
        .live-douyu-share svg {
          width: 18px;
          height: 18px;
        }
        .live-douyu-share:active {
          background: rgba(255,255,255,0.2);
          transform: scale(0.95);
        }

        /* ===== 视频区域 ===== */
        .live-douyu-video {
          flex: 1;
          background: linear-gradient(180deg, #1A1A2E 0%, #0F0F23 100%);
          position: relative;
          background-size: cover;
          background-position: center;
          min-height: 200px;
          overflow: hidden;
        }
        .live-douyu-duration {
          position: absolute;
          top: 60px;
          right: 12px;
          padding: 3px 10px;
          background: rgba(0,0,0,0.6);
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 500;
          border-radius: 10px;
          font-variant-numeric: tabular-nums;
          z-index: 10;
        }
        .live-douyu-cover-btn {
          position: absolute;
          top: 60px;
          right: 80px;
          padding: 4px 10px;
          background: rgba(0,0,0,0.5);
          color: #fff;
          font-size: 11px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          z-index: 10;
        }

        /* ===== 飘屏弹幕区域 ===== */
        .live-douyu-danmaku-float {
          position: absolute;
          top: 60px;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 20;
        }
        .live-douyu-danmaku-item {
          position: absolute;
          white-space: nowrap;
          animation: danmaku-scroll-douyu var(--duration, 8s) linear forwards;
          font-size: 14px;
          color: #FFFFFF;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.5);
          padding: 4px 8px;
          pointer-events: none;
          will-change: transform;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .live-douyu-danmaku-item .danmaku-user {
          font-weight: 600;
        }
        .live-douyu-danmaku-item .danmaku-anchor {
          color: #FF6B35;
          font-weight: 700;
          background: rgba(255,107,53,0.2);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 11px;
        }
        .live-douyu-danmaku-item .danmaku-system {
          color: #FFD60A;
          font-weight: 600;
        }
        .live-douyu-danmaku-item .danmaku-gift {
          color: #FF6B35;
          font-weight: 600;
        }
        /* 用户等级颜色 */
        .live-douyu-danmaku-item.level-1 .danmaku-user { color: #FFFFFF; }
        .live-douyu-danmaku-item.level-2 .danmaku-user { color: #34C759; }
        .live-douyu-danmaku-item.level-3 .danmaku-user { color: #007AFF; }
        .live-douyu-danmaku-item.level-4 .danmaku-user { color: #AF52DE; }
        .live-douyu-danmaku-item.level-5 .danmaku-user { color: #FF9500; }
        .live-douyu-danmaku-item.level-6 .danmaku-user { color: #FFD60A; }
        @keyframes danmaku-scroll-douyu {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }

        /* ===== 右侧弹幕列表 ===== */
        .live-douyu-chat-panel {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          width: 140px;
          max-height: 40%;
          background: rgba(0,0,0,0.4);
          border-radius: 12px;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          z-index: 30;
          overflow: hidden;
        }
        .live-douyu-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          font-size: 11px;
          color: rgba(255,255,255,0.8);
        }
        .live-douyu-chat-count {
          color: #FF6B35;
          font-weight: 500;
        }
        .live-douyu-chat-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          scrollbar-width: none;
        }
        .live-douyu-chat-list::-webkit-scrollbar {
          display: none;
        }
        .live-douyu-chat-item {
          font-size: 11px;
          line-height: 1.4;
          word-break: break-word;
        }
        .live-douyu-chat-item .chat-user {
          font-weight: 600;
        }
        .live-douyu-chat-item .chat-anchor {
          color: #FF6B35;
          font-weight: 700;
          background: rgba(255,107,53,0.2);
          padding: 0 4px;
          border-radius: 3px;
          font-size: 10px;
        }
        .live-douyu-chat-item .chat-system {
          color: #FFD60A;
          font-weight: 600;
        }
        .live-douyu-chat-item .chat-gift {
          color: #FF6B35;
          font-weight: 600;
        }
        .live-douyu-chat-item .chat-user.level-1 { color: #FFFFFF; }
        .live-douyu-chat-item .chat-user.level-2 { color: #34C759; }
        .live-douyu-chat-item .chat-user.level-3 { color: #007AFF; }
        .live-douyu-chat-item .chat-user.level-4 { color: #AF52DE; }
        .live-douyu-chat-item .chat-user.level-5 { color: #FF9500; }
        .live-douyu-chat-item .chat-user.level-6 { color: #FFD60A; }

        /* ===== 底部互动区 ===== */
        .live-douyu-input-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          padding: 10px 12px;
          background: rgba(0,0,0,0.85);
          gap: 10px;
          z-index: 50;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .live-douyu-input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 2px 2px 2px 14px;
          gap: 6px;
        }
        .live-douyu-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #FFFFFF;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          padding: 8px 0;
        }
        .live-douyu-input::placeholder {
          color: rgba(255,255,255,0.4);
        }
        .live-douyu-ai-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #5856D6 0%, #7B68EE 100%);
          border: none;
          border-radius: 50%;
          color: #FFFFFF;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .live-douyu-ai-btn svg {
          width: 16px;
          height: 16px;
        }
        .live-douyu-ai-btn:active {
          transform: scale(0.9);
        }
        .live-douyu-send-btn {
          padding: 10px 18px;
          background: linear-gradient(135deg, #FF6B35 0%, #FF3B30 100%);
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 18px;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .live-douyu-send-btn:active {
          transform: scale(0.95);
        }
        .live-douyu-gift-toggle {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #FFD60A 0%, #FFB800 100%);
          border: none;
          border-radius: 50%;
          color: #1a1a1a;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .live-douyu-gift-toggle svg {
          width: 22px;
          height: 22px;
        }
        .live-douyu-gift-toggle:active {
          transform: scale(0.9);
        }

        /* ===== 礼物面板 ===== */
        .live-douyu-gift-panel {
          position: absolute;
          bottom: 70px;
          left: 12px;
          right: 12px;
          background: rgba(22, 33, 62, 0.98);
          border-radius: 16px;
          padding: 16px;
          z-index: 60;
          transform: translateY(120%);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
        }
        .live-douyu-gift-panel.visible {
          transform: translateY(0);
        }
        .live-douyu-gift-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .live-douyu-balance {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          color: #FFD60A;
          font-weight: 600;
        }
        .live-douyu-balance-icon {
          font-size: 18px;
        }
        .live-douyu-recharge-btn {
          padding: 6px 14px;
          background: linear-gradient(135deg, #FFD60A 0%, #FFB800 100%);
          color: #1a1a1a;
          font-size: 12px;
          font-weight: 700;
          border: none;
          border-radius: 12px;
          cursor: pointer;
        }
        .live-douyu-recharge-btn:active {
          transform: scale(0.95);
        }
        .live-douyu-gift-close {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 50%;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          margin-left: 10px;
        }
        .live-douyu-gift-close svg {
          width: 16px;
          height: 16px;
        }
        .live-douyu-gift-close:active {
          background: rgba(255,255,255,0.2);
        }
        .live-douyu-gift-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .live-gift-item-douyu {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid transparent;
        }
        .live-gift-item-douyu:active {
          transform: scale(0.95);
          background: rgba(255,255,255,0.1);
        }
        .live-gift-item-douyu.live-gift-tier-large {
          background: linear-gradient(135deg, rgba(255,107,53,0.2) 0%, rgba(255,59,48,0.2) 100%);
          border-color: rgba(255,107,53,0.5);
        }
        .live-gift-item-douyu.live-gift-tier-medium {
          background: linear-gradient(135deg, rgba(175,82,222,0.15) 0%, rgba(88,86,214,0.15) 100%);
          border-color: rgba(175,82,222,0.4);
        }
        .live-gift-icon-douyu {
          font-size: 28px;
          margin-bottom: 4px;
        }
        .live-gift-name-douyu {
          font-size: 11px;
          color: #FFFFFF;
          margin-bottom: 2px;
        }
        .live-gift-price-douyu {
          font-size: 11px;
          color: #FFD60A;
          font-weight: 600;
        }
        .live-gift-price-douyu::after {
          content: ' \\u{1FA99}';
          font-size: 10px;
        }

        /* ===== 响应式适配 ===== */
        @media (max-width: 380px) {
          .live-douyu-gift-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .live-gift-item-douyu {
            padding: 10px 6px;
          }
          .live-gift-icon-douyu {
            font-size: 24px;
          }
          .live-douyu-chat-panel {
            width: 120px;
          }
        }

        /* ===== 礼物特效区域 ===== */
        .live-gift-effect-area {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 5;
          overflow: hidden;
        }
        .live-gift-small {
          position: absolute;
          font-size: 20px;
          animation: gift-small-float 2s ease-out forwards;
          pointer-events: none;
        }
        @keyframes gift-small-float {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { transform: translateY(-10px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
        .live-gift-medium-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          animation: gift-pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          pointer-events: none;
        }
        .live-gift-medium-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 4px;
        }
        .live-gift-medium-text {
          font-size: 13px;
          color: #FFD60A;
          font-weight: 600;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        }
        .live-gift-medium-container .live-gift-medium-fadeout {
          animation: gift-medium-fadeout 0.5s ease 1.5s forwards;
        }
        @keyframes gift-pop-in {
          0% { transform: translate(-50%, -50%) scale(0) rotate(-15deg); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes gift-medium-fadeout {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8) translateY(-20px); }
        }
        .live-gift-particle {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: particle-burst 0.8s ease-out forwards;
          pointer-events: none;
        }
        @keyframes particle-burst {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        .live-gift-large-banner {
          position: absolute;
          top: 40%;
          left: 0;
          right: 0;
          padding: 12px 20px;
          background: linear-gradient(90deg, transparent, rgba(255, 107, 53, 0.3), rgba(255, 59, 48, 0.3), transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          animation: full-screen-gift 3s ease-in-out forwards;
          pointer-events: none;
        }
        .live-gift-large-icon {
          font-size: 56px;
          animation: gift-large-bounce 0.6s ease infinite alternate;
        }
        @keyframes gift-large-bounce {
          0% { transform: scale(1) rotate(-5deg); }
          100% { transform: scale(1.15) rotate(5deg); }
        }
        .live-gift-large-text {
          font-size: 16px;
          color: #FFFFFF;
          font-weight: 700;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        }
        .live-gift-large-combo {
          font-size: 24px;
          color: #FFD60A;
          font-weight: 800;
          text-shadow: 0 0 10px rgba(255, 214, 10, 0.5);
        }
        @keyframes full-screen-gift {
          0% { transform: translateX(100%); opacity: 0; }
          10% { transform: translateX(0); opacity: 1; }
          80% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-100%); opacity: 0; }
        }

        /* ===== 充值面板 ===== */
        .live-recharge-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: flex-end;
          z-index: 20;
          animation: recharge-overlay-in 0.25s ease;
        }
        @keyframes recharge-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .live-recharge-panel {
          width: 100%;
          background: #16213E;
          border-radius: 16px 16px 0 0;
          padding: 20px 16px 24px;
          animation: recharge-panel-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes recharge-panel-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .live-recharge-title {
          font-size: 17px;
          font-weight: 600;
          color: #FFFFFF;
          text-align: center;
          margin-bottom: 16px;
        }
        .live-recharge-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        .live-recharge-option {
          padding: 14px 0;
          background: #1A2744;
          border: 2px solid transparent;
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .live-recharge-option:active {
          transform: scale(0.96);
        }
        .live-recharge-option.selected {
          border-color: #FFD60A;
          background: rgba(255, 214, 10, 0.1);
        }
        .live-recharge-amount {
          font-size: 20px;
          font-weight: 700;
          color: #FFD60A;
          display: block;
        }
        .live-recharge-amount::after {
          content: ' \\u{1FA99}';
          font-size: 14px;
        }
        .live-recharge-bonus {
          font-size: 11px;
          color: #34C759;
          margin-top: 2px;
        }
        .live-recharge-confirm {
          width: 100%;
          padding: 12px 0;
          background: linear-gradient(135deg, #FFD60A 0%, #FFB800 100%);
          color: #1a1a1a;
          font-size: 15px;
          font-weight: 700;
          border-radius: 12px;
          border: none;
          cursor: pointer;
        }
        .live-recharge-confirm:active {
          transform: scale(0.97);
        }
        .live-recharge-cancel {
          width: 100%;
          padding: 10px 0;
          background: transparent;
          color: #8E8EA0;
          font-size: 14px;
          border: none;
          cursor: pointer;
          margin-top: 8px;
        }
        .live-recharge-cancel:active {
          color: #FFFFFF;
        }

        /* ===== History View ===== */
        .live-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #16213E;
          flex-shrink: 0;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .live-history-header .live-btn {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 500;
          border-radius: 14px;
        }
        .live-history-header .live-btn:active {
          background: rgba(255, 255, 255, 0.18);
        }
        .live-btn-clear {
          background: rgba(255, 59, 48, 0.15);
          color: #FF6B6B;
        }
        .live-btn-clear:active {
          background: rgba(255, 59, 48, 0.25);
        }
        .live-history-title {
          font-size: 16px;
          font-weight: 600;
          color: #FFFFFF;
          margin: 0;
        }

        /* History List */
        .live-history-list {
          display: flex;
          flex-direction: column;
          padding: 8px 16px 16px 16px;
        }
        .live-history-item {
          background: #16213E;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          transition: transform 0.15s ease;
        }
        .live-history-item:active {
          transform: scale(0.98);
        }
        .live-history-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .live-history-title {
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-history-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .live-history-streamer {
          font-size: 13px;
          color: #8E8EA0;
        }
        .live-history-date {
          font-size: 12px;
          color: #6E6E82;
        }

        /* Empty & Error States */
        .live-empty,
        .live-error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          font-size: 15px;
          color: #6E6E82;
          font-weight: 400;
          text-align: center;
          padding: 32px;
        }
        .live-error {
          color: #FF6B6B;
        }
      `;
    }

    // ==================== 主框架渲染 ====================

    /**
     * 渲染直播模块主框架
     * @returns {string} HTML 字符串
     */
    renderApp() {
      return `
        <div class="live-app">
          <div class="live-header">
            <h3 class="live-title">直播广场</h3>
            <button class="live-btn live-btn-history" data-action="show-history">历史</button>
          </div>
          <div class="live-views">
            <div class="live-view" data-view="LIST"></div>
            <div class="live-view" data-view="WATCH" style="display:none;"></div>
            <div class="live-view" data-view="HISTORY" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    // ==================== 直播列表渲染 ====================

    /**
     * 渲染直播广场列表
     * @param {HTMLElement} container - 挂载容器
     * @param {Array} streams - 直播数据
     * @param {Object} helpers - 辅助方法 { formatViewers, escapeHtml, safeUrl, resolveStreamCover }
     */
    renderList(container, streams, helpers) {
      if (!container) return;
      container.innerHTML = '';

      // 操作按钮
      const actionsEl = document.createElement('div');
      actionsEl.className = 'live-actions';
      actionsEl.innerHTML = '<button class="live-btn live-btn-start" data-action="start-live">开始直播</button>';
      container.appendChild(actionsEl);

      if (!streams || streams.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'live-empty';
        emptyEl.textContent = '暂无直播';
        container.appendChild(emptyEl);
        return;
      }

      // 热门直播横向滚动（取前5个观看人数最多的）
      const hotStreams = [...streams]
        .sort((a, b) => (b.viewers || 0) - (a.viewers || 0))
        .slice(0, 5);

      if (hotStreams.length > 0) {
        const hotSection = document.createElement('div');
        hotSection.className = 'live-hot-section';
        hotSection.innerHTML = '<div class="live-section-title">热门直播</div>';

        const hotScroll = document.createElement('div');
        hotScroll.className = 'live-hot-scroll';

        hotStreams.forEach(stream => {
          const card = document.createElement('div');
          card.className = 'live-hot-card';
          card.dataset.streamId = stream.id;
          card.innerHTML = `
            <div class="live-hot-cover" style="background-image: url('${helpers.safeUrl(stream.cover || '')}')"></div>
            <div class="live-hot-badge">LIVE</div>
            <div class="live-hot-viewer-badge">${helpers.formatViewers(stream.viewers)}</div>
            <div class="live-hot-info">
              <div class="live-hot-title">${helpers.escapeHtml(stream.title)}</div>
              <div class="live-hot-meta">
                <span>${helpers.escapeHtml(stream.streamerName)}</span>
                <span class="live-hot-viewers">${helpers.formatViewers(stream.viewers)}</span>
              </div>
            </div>
          `;
          hotScroll.appendChild(card);
        });

        hotSection.appendChild(hotScroll);
        container.appendChild(hotSection);
      }

      // 全部直播列表
      const allSection = document.createElement('div');
      allSection.innerHTML = '<div class="live-section-title">全部直播</div>';
      container.appendChild(allSection);

      const listEl = document.createElement('div');
      listEl.className = 'live-list';

      // 标签池
      const tagPool = ['hot', 'new', 'game', 'chat'];
      const tagLabels = { hot: '热门', new: '新品', game: '游戏', chat: '聊天' };

      streams.forEach((stream, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'live-stream-item';
        itemEl.dataset.streamId = stream.id;

        const tagKey = tagPool[idx % tagPool.length];
        const tagHtml = '<span class="live-tag live-tag-' + tagKey + '">' + tagLabels[tagKey] + '</span>';

        itemEl.innerHTML = `
          <div class="live-card-cover" style="background-image: url('${helpers.safeUrl(stream.cover || '')}')">
            <div class="live-badge">LIVE</div>
          </div>
          <div class="live-card-body">
            <div class="live-stream-avatar" style="background-image: url('${helpers.safeUrl(stream.streamerAvatar || '')}')"></div>
            <div class="live-stream-info">
              <div class="live-stream-title">${tagHtml}${helpers.escapeHtml(stream.title)}</div>
              <div class="live-stream-meta">
                <span class="live-streamer">${helpers.escapeHtml(stream.streamerName)}</span>
                <span class="live-viewers">${helpers.formatViewers(stream.viewers)}</span>
              </div>
            </div>
          </div>
        `;

        listEl.appendChild(itemEl);
      });

      container.appendChild(listEl);
    }

    // ==================== 观看视图渲染 ====================

    /**
     * 渲染直播观看内容（斗鱼风格）
     * @param {HTMLElement} container - 挂载容器
     * @param {Object} stream - 直播数据
     * @param {Object} helpers - 辅助方法
     * @param {Object} extraData - 额外数据 { goldBalance }
     */
    renderStreamContent(container, stream, helpers, extraData) {
      if (!container || !stream) return;

      const goldBalance = extraData?.goldBalance || 0;

      // 构建礼物面板 HTML
      const giftTypes = Object.keys(GIFT_EMOJI);
      let giftPanelHtml = '';
      giftTypes.forEach(gt => {
        const tier = this._getGiftTier(gt);
        const tierClass = 'live-gift-tier-' + tier;
        giftPanelHtml += `
          <div class="live-gift-item-douyu ${tierClass}" data-action="send-gift" data-gift-type="${gt}">
            <div class="live-gift-icon-douyu">${GIFT_EMOJI[gt]}</div>
            <div class="live-gift-name-douyu">${GIFT_NAMES[gt]}</div>
            <div class="live-gift-price-douyu">${GIFT_PRICES[gt]}</div>
          </div>
        `;
      });

      container.innerHTML = `
        <div class="live-watch-douyu">
          <!-- 顶部主播信息卡 -->
          <div class="live-douyu-header">
            <div class="live-douyu-back" data-action="back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </div>
            <div class="live-douyu-anchor">
              <div class="live-douyu-avatar-wrap">
                <div class="live-douyu-avatar" style="background-image: url('${helpers.safeUrl(stream.streamerAvatar || '')}')"></div>
                <div class="live-douyu-online-dot"></div>
              </div>
              <div class="live-douyu-info">
                <div class="live-douyu-name">${helpers.escapeHtml(stream.streamerName)}</div>
                <div class="live-douyu-title">${helpers.escapeHtml(stream.title)}</div>
              </div>
              <button class="live-douyu-follow" data-action="follow-anchor">+ 关注</button>
            </div>
            <div class="live-douyu-header-right">
              <div class="live-douyu-viewers">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                <span data-viewers-display>${helpers.formatViewers(stream.viewers)}</span>
              </div>
              <div class="live-douyu-share" data-action="share-stream">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
              </div>
            </div>
          </div>

          <!-- 视频区域 -->
          <div class="live-douyu-video" style="background-image: url('${helpers.safeUrl(stream.cover || '')}')">
            <!-- 飘屏弹幕区域 -->
            <div class="live-douyu-danmaku-float" data-danmaku-float-area></div>

            <!-- 礼物特效区域 -->
            <div class="live-gift-effect-area" data-gift-effect-area></div>

            <!-- 直播时长 -->
            <div class="live-douyu-duration" data-duration-display>00:00:00</div>

            <!-- 换封面按钮 -->
            <button class="live-douyu-cover-btn" data-action="set-cover">换封面</button>
          </div>

          <!-- 右侧弹幕列表 -->
          <div class="live-douyu-chat-panel">
            <div class="live-douyu-chat-header">
              <span>弹幕</span>
              <span class="live-douyu-chat-count">${helpers.formatViewers(stream.viewers)}人</span>
            </div>
            <div class="live-douyu-chat-list" data-danmaku-list></div>
          </div>

          <!-- 底部互动区 -->
          <div class="live-douyu-input-bar">
            <div class="live-douyu-input-wrap">
              <input type="text" class="live-douyu-input" placeholder="发弹幕参与互动..." maxlength="50" />
              <button class="live-douyu-ai-btn" data-action="ai-danmaku" title="AI弹幕">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </button>
            </div>
            <button class="live-douyu-send-btn" data-action="send-danmaku">发送</button>
            <button class="live-douyu-gift-toggle" data-action="toggle-gift-panel">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>
            </button>
          </div>

          <!-- 礼物面板 -->
          <div class="live-douyu-gift-panel" data-gift-panel>
            <div class="live-douyu-gift-header">
              <div class="live-douyu-balance">
                <span class="live-douyu-balance-icon">\u{1FA99}</span>
                <span data-gold-display>${goldBalance}</span>
              </div>
              <button class="live-douyu-recharge-btn" data-action="show-recharge">充值</button>
              <button class="live-douyu-gift-close" data-action="close-gift-panel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="live-douyu-gift-grid">
              ${giftPanelHtml}
            </div>
          </div>
        </div>
      `;
    }

    // ==================== 历史视图渲染 ====================

    /**
     * 渲染观看历史
     * @param {HTMLElement} container - 挂载容器
     * @param {Array} history - 历史数据
     * @param {Object} helpers - 辅助方法
     */
    renderHistory(container, history, helpers) {
      if (!container) return;
      container.innerHTML = '';

      const headerEl = document.createElement('div');
      headerEl.className = 'live-history-header';
      headerEl.innerHTML = `
        <button class="live-btn" data-action="back">&larr; 返回</button>
        <h4 class="live-history-title">观看历史</h4>
        <button class="live-btn live-btn-clear" data-action="clear-history">清空</button>
      `;
      container.appendChild(headerEl);

      if (!history || history.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'live-empty';
        emptyEl.textContent = '暂无观看历史';
        container.appendChild(emptyEl);
        return;
      }

      const listEl = document.createElement('div');
      listEl.className = 'live-history-list';

      history.forEach(record => {
        const el = document.createElement('div');
        el.className = 'live-history-item';
        el.innerHTML = `
          <div class="live-history-info">
            <div class="live-history-title">${helpers.escapeHtml(record.title || record.streamTitle || '')}</div>
            <div class="live-history-meta">
              <span class="live-history-streamer">${helpers.escapeHtml(record.streamerName || '')}</span>
              <span class="live-history-date">${helpers.escapeHtml(record.date || record.watchDate || '')}</span>
            </div>
          </div>
        `;
        listEl.appendChild(el);
      });

      container.appendChild(listEl);
    }

    // ==================== 弹幕渲染 ====================

    /**
     * 渲染弹幕列表（增量更新）
     * @param {HTMLElement} danmakuFloatArea - 飘屏弹幕区域
     * @param {HTMLElement} danmakuList - 弹幕列表容器
     * @param {Array} newDanmaku - 新弹幕数据
     * @param {number} danmakuFloatIndex - 当前飘屏轨道索引（引用传递）
     * @param {Object} helpers - 辅助方法
     */
    renderDanmakuList(danmakuFloatArea, danmakuList, newDanmaku, danmakuFloatIndex, helpers) {
      if (!danmakuFloatArea || !danmakuList) return;

      newDanmaku.forEach(d => {
        // 飘屏弹幕（斗鱼风格）
        this.createFloatingDanmakuDouyu(danmakuFloatArea, d, danmakuFloatIndex, helpers);

        // 右侧弹幕列表
        const listItem = document.createElement('div');
        listItem.className = 'live-douyu-chat-item';

        if (d.type === 'system') {
          listItem.classList.add('system');
          listItem.innerHTML = '<span class="chat-system">' + helpers.escapeHtml(d.content) + '</span>';
        } else if (d.type === 'gift') {
          listItem.classList.add('gift');
          listItem.innerHTML = '<span class="chat-gift">' + helpers.escapeHtml(d.content) + '</span>';
        } else if (d.type === 'anchor') {
          listItem.classList.add('anchor');
          listItem.innerHTML = '<span class="chat-anchor">主播</span>: ' + helpers.escapeHtml(d.content);
        } else {
          const level = this.getUserLevel(d.userId);
          listItem.innerHTML = '<span class="chat-user level-' + level + '">' + helpers.escapeHtml(d.userName) + '</span>: ' + helpers.escapeHtml(d.content);
        }

        danmakuList.appendChild(listItem);

        // 限制右侧列表数量
        while (danmakuList.children.length > 20) {
          danmakuList.removeChild(danmakuList.firstChild);
        }

        danmakuList.scrollTop = danmakuList.scrollHeight;
      });
    }

    // ==================== 飘屏弹幕 ====================

    /**
     * 创建飘屏弹幕元素（旧版，保留兼容）
     * @param {HTMLElement} area - 弹幕区域容器
     * @param {Object} d - 弹幕数据
     * @param {Object} helpers - 辅助方法
     */
    createFloatingDanmaku(area, d, helpers) {
      const floatEl = document.createElement('div');
      floatEl.className = 'live-danmaku-float';

      const maxTop = 110;
      const top = Math.floor(Math.random() * maxTop);
      floatEl.style.top = top + 'px';

      const duration = 6 + Math.random() * 4;
      floatEl.style.setProperty('--duration', duration + 's');

      if (d.type === 'system') {
        floatEl.innerHTML = '<span class="live-danmaku-system">' + helpers.escapeHtml(d.content) + '</span>';
      } else if (d.type === 'gift') {
        floatEl.innerHTML = '<span class="live-danmaku-gift">' + helpers.escapeHtml(d.content) + '</span>';
      } else {
        floatEl.innerHTML = '<span class="live-danmaku-user">' + helpers.escapeHtml(d.userName) + '</span>: ' + helpers.escapeHtml(d.content);
      }

      area.appendChild(floatEl);

      // [v4.31.0-fix] 内存泄漏修复：保存 timerId 到元素属性，便于外部清理
      const removeDelay = (duration + 0.5) * 1000;
      const timerId = setTimeout(() => {
        if (floatEl.parentNode) {
          floatEl.parentNode.removeChild(floatEl);
        }
      }, removeDelay);
      floatEl._removeTimerId = timerId;
    }

    /**
     * 创建斗鱼风格飘屏弹幕
     * @param {HTMLElement} area - 弹幕区域容器
     * @param {Object} d - 弹幕数据
     * @param {Object} floatIndex - 飘屏轨道索引对象 { value: number }
     * @param {Object} helpers - 辅助方法
     */
    createFloatingDanmakuDouyu(area, d, floatIndex, helpers) {
      const floatEl = document.createElement('div');
      floatEl.className = 'live-douyu-danmaku-item';

      // 计算轨道位置（8条轨道，避免重叠）
      floatIndex.value = (floatIndex.value + 1) % 8;
      const trackHeight = 28;
      const top = floatIndex.value * trackHeight + 8;
      floatEl.style.top = top + 'px';

      const duration = 7 + Math.random() * 5;
      floatEl.style.setProperty('--duration', duration + 's');

      if (d.type === 'system') {
        floatEl.classList.add('system');
        floatEl.innerHTML = '<span class="danmaku-system">' + helpers.escapeHtml(d.content) + '</span>';
      } else if (d.type === 'gift') {
        floatEl.classList.add('gift');
        floatEl.innerHTML = '<span class="danmaku-gift">' + helpers.escapeHtml(d.content) + '</span>';
      } else if (d.type === 'anchor') {
        floatEl.classList.add('anchor');
        floatEl.innerHTML = '<span class="danmaku-anchor">主播</span>: ' + helpers.escapeHtml(d.content);
      } else {
        const level = this.getUserLevel(d.userId);
        floatEl.classList.add('level-' + level);
        floatEl.innerHTML = '<span class="danmaku-user">' + helpers.escapeHtml(d.userName) + '</span>: ' + helpers.escapeHtml(d.content);
      }

      area.appendChild(floatEl);

      // [v4.31.0-fix] 内存泄漏修复：保存 timerId 到元素属性，便于外部清理
      const removeDelay = (duration + 0.5) * 1000;
      const timerId = setTimeout(() => {
        if (floatEl.parentNode) {
          floatEl.parentNode.removeChild(floatEl);
        }
      }, removeDelay);
      floatEl._removeTimerId = timerId;
    }

    // ==================== 空状态 ====================

    /**
     * 渲染空状态
     * @param {string} text
     * @returns {HTMLElement}
     */
    renderEmptyState(text) {
      const el = document.createElement('div');
      el.className = 'live-empty';
      el.textContent = text || '暂无数据';
      return el;
    }

    // ==================== 纯展示工具方法 ====================

    /**
     * 获取用户等级（用于弹幕颜色区分）
     * @param {string} userId
     * @returns {number} 1-6
     */
    getUserLevel(userId) {
      if (!userId) return 1;
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash) % 6 + 1;
    }

    /**
     * 获取礼物等级
     * @param {string} giftType
     * @returns {string} small | medium | large
     */
    _getGiftTier(giftType) {
      if (GIFT_TIERS.large.includes(giftType)) return 'large';
      if (GIFT_TIERS.medium.includes(giftType)) return 'medium';
      return 'small';
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Live = LiveRenderer;

  console.log('[Renderer] LiveRenderer 已加载');
})();
