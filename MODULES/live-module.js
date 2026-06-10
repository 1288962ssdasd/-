/**
 * LiveModule - 直播模块
 * 职责：生命周期管理、事件绑定、调用 Service
 * 禁止：直接操作数据（必须通过 Service）
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Live
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 消息监听通过 Platform 事件订阅，不直接监听 WebSocket（铁则二）
 *   - Module 层不包含业务逻辑，只调用 Service（铁则三）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 live- 前缀隔离（铁则十一）
 */

;(function () {
  'use strict';

  // ==================== 预设弹幕池 ====================
  // AI 调用失败时的降级弹幕
  const PRESET_DANMAKU = [
    '主播好厉害！', '666', '来了来了', '支持主播！', '太好看了吧',
    '哈哈哈哈', '第一次来，关注了', '主播唱首歌吧', '加油！', '打卡',
    '主播今天状态不错', '冲冲冲', '这个好好玩', '笑死我了', '主播几点下播',
    '礼物走一波', '新人报道', '主播好漂亮', '太棒了', '前排占座',
  ];

  // 礼物等级定义：小/中/大
  const GIFT_TIERS = {
    small: ['flower', 'like', 'candy'],   // 小礼物：弹幕区域文字 + emoji
    medium: ['heart', 'beer', 'cake'],     // 中礼物：屏幕中央弹出 + 粒子
    large: ['rocket', 'crown'],            // 大礼物：全屏特效 + 连击
  };

  // 礼物 emoji 映射
  const GIFT_EMOJI = {
    flower: '\u{1F338}', like: '\u{1F44D}', candy: '\u{1F36C}',
    heart: '\u{2764}\u{FE0F}', beer: '\u{1F37A}', cake: '\u{1F382}',
    rocket: '\u{1F680}', crown: '\u{1F451}',
  };

  // 礼物中文名映射
  const GIFT_NAMES = {
    flower: '鲜花', like: '点赞', candy: '糖果',
    heart: '爱心', beer: '啤酒', cake: '蛋糕',
    rocket: '火箭', crown: '皇冠',
  };

  // 礼物价格映射（与 LiveData.GIFT_VALUES 保持一致）
  const GIFT_PRICES = {
    flower: 1, like: 1, candy: 2,
    heart: 5, beer: 10, cake: 20,
    rocket: 50, crown: 100,
  };

  // 充值档位
  const RECHARGE_OPTIONS = [
    { amount: 100, bonus: 0, label: '100' },
    { amount: 500, bonus: 50, label: '500' },
    { amount: 1000, bonus: 150, label: '1000' },
    { amount: 5000, bonus: 1000, label: '5000' },
  ];

  class LiveModule extends PhoneApp {
    constructor() {
      super({
        id: 'live',
        name: '直播',
        icon: '\uD83D\uDCFA',
        iconBg: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
      });

      this._service = null;
      this._economyService = null;
      this._friendService = null;
      this._currentView = 'LIST'; // LIST | WATCH | HISTORY | RECHARGE
      this._currentStreamId = null;
      this._unsubscribers = [];
      this._danmakuTimer = null;
      this._npcDanmakuTimer = null;
      this._viewersTimer = null;
      this._liveDurationTimer = null;
      this._liveStartTime = null;
      this._danmakuFloatIndex = 0; // 弹幕飘屏行号计数器
      this._goldBalance = 0;
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Live(window.Platform);
      this._economyService = window.Platform?.get?.('economyService')
        || new window.PhoneServices.Economy(window.Platform);
      this._friendService = window.Platform?.get?.('friendService')
        || new window.PhoneServices.Friend(window.Platform);

      // 订阅消息事件，自动解析直播消息（铁则二：不直接监听 WebSocket）
      if (this._platform?.on) {
        this._platform.on('message:received', (data) => {
          this._handleIncomingMessage(data);
        });
      }
    }

    onResume(params) {
      setTimeout(() => this._refresh(), 50);
      // 如果当前在观看视图，重启弹幕轮询
      if (this._currentView === 'WATCH') {
        this._startDanmakuPolling();
        this._startNPCDanmaku();
        this._startViewersUpdate();
        this._startLiveDuration();
      }
    }

    onPause() {
      this._stopDanmakuPolling();
      this._stopNPCDanmaku();
      this._stopViewersUpdate();
      this._stopLiveDuration();
    }

    onDispose() {
      this._stopDanmakuPolling();
      this._stopNPCDanmaku();
      this._stopViewersUpdate();
      this._stopLiveDuration();
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (LiveModule._stylesInjected) return;
      LiveModule._stylesInjected = true;

      const css = `
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
        /* 热门卡片上的 LIVE 标记 */
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
        /* 热门卡片上的观看人数 */
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
        .live-watch {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0F0F23;
        }

        /* 斗鱼风格观看页容器 */
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
        /* 用户等级颜色 */
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
          content: ' \u{1FA99}';
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

        /* ===== 原有 Watch View 样式保留 ===== */
        .live-watch-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(22, 33, 62, 0.9);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          flex-shrink: 0;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
          z-index: 10;
        }
        .live-watch-header .live-btn {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 500;
          border-radius: 14px;
        }
        .live-watch-header .live-btn:active {
          background: rgba(255, 255, 255, 0.18);
        }
        .live-watch-title {
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          text-align: center;
          padding: 0 8px;
        }
        .live-watch-viewers {
          font-size: 12px;
          color: #FF6B35;
          font-weight: 500;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 3px;
        }

        /* Video Area */
        .live-video-area {
          flex: 1;
          background: linear-gradient(180deg, #1A1A2E 0%, #0F0F23 100%);
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          padding: 16px;
          min-height: 120px;
          position: relative;
          background-size: cover;
          background-position: center;
          max-width: 100%;
          overflow: hidden;
        }
        .live-video-area .live-streamer-info-float {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          padding: 6px 12px 6px 6px;
          border-radius: 20px;
          position: absolute;
          bottom: 16px;
          left: 16px;
        }
        .live-streamer-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-color: #2A2A4A;
          border: 1.5px solid rgba(255, 107, 53, 0.5);
          flex-shrink: 0;
        }
        .live-streamer-name {
          font-size: 13px;
          font-weight: 600;
          color: #FFFFFF;
        }
        /* 直播时长计时器 */
        .live-duration-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 3px 10px;
          background: rgba(0, 0, 0, 0.6);
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 500;
          border-radius: 10px;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          font-variant-numeric: tabular-nums;
        }
        /* 主播信息浮层（顶部） */
        .live-anchor-overlay {
          position: absolute;
          top: 12px;
          left: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          padding: 4px 12px 4px 4px;
          border-radius: 16px;
        }
        .live-anchor-overlay .live-streamer-avatar {
          width: 28px;
          height: 28px;
        }
        .live-anchor-overlay .live-streamer-name {
          font-size: 12px;
        }

        /* ===== 弹幕飘屏区域 ===== */
        .live-danmaku-area {
          height: 180px;
          position: relative;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.35);
          flex-shrink: 0;
        }
        /* 飘屏弹幕 */
        .live-danmaku-float {
          position: absolute;
          white-space: nowrap;
          animation: danmaku-scroll var(--duration, 8s) linear forwards;
          font-size: 14px;
          color: #FFFFFF;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0, 0, 0, 0.3);
          padding: 2px 0;
          pointer-events: none;
          will-change: transform;
        }
        .live-danmaku-float .live-danmaku-user {
          color: #FFD60A;
          font-weight: 600;
        }
        .live-danmaku-float .live-danmaku-system {
          color: #FFD60A;
          font-weight: 500;
        }
        .live-danmaku-float .live-danmaku-gift {
          color: #FF6B35;
          font-weight: 600;
        }
        @keyframes danmaku-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }

        /* 弹幕列表（底部保留少量最近弹幕） */
        .live-danmaku-list {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 60px;
          overflow: hidden;
          padding: 4px 10px;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.4));
        }
        .live-danmaku-list-item {
          padding: 1px 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.4;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-danmaku-list-item .live-danmaku-user {
          color: #FFD60A;
          font-weight: 600;
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
        /* 小礼物：弹幕区域文字 + emoji */
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
        /* 中礼物：屏幕中央弹出 + 粒子 */
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
        /* 粒子效果 */
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
        /* 大礼物：全屏横幅 + 连击 */
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

        /* 礼物消息区域（底部列表） */
        .live-gift-area {
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.25);
          flex-shrink: 0;
          min-height: 28px;
          max-height: 56px;
          overflow: hidden;
        }
        .live-gift-item {
          font-size: 12px;
          color: #FF6B35;
          padding: 2px 0;
          font-weight: 500;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
          animation: gift-fade-in 0.3s ease;
        }
        @keyframes gift-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== Input Area ===== */
        .live-input-area {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #16213E;
          flex-shrink: 0;
          box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.05);
        }
        .live-danmaku-input {
          flex: 1;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: #FFFFFF;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .live-danmaku-input::placeholder {
          color: #6E6E82;
        }
        .live-danmaku-input:focus {
          border-color: #FF6B35;
          background: rgba(255, 255, 255, 0.12);
        }
        .live-input-area .live-btn {
          padding: 8px 16px;
          background: #FF6B35;
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 600;
          border-radius: 16px;
          flex-shrink: 0;
        }
        .live-input-area .live-btn:active {
          background: #E55A28;
          transform: scale(0.95);
        }
        .live-input-area .live-btn[data-action="ai-danmaku"] {
          background: linear-gradient(135deg, #5856D6 0%, #7B68EE 100%);
        }
        .live-input-area .live-btn[data-action="ai-danmaku"]:active {
          background: linear-gradient(135deg, #4A48B8 0%, #6A58D6 100%);
        }
        .live-input-area .live-btn[data-action="show-gift-bar"] {
          background: linear-gradient(135deg, #FF3B30 0%, #FF6B35 100%);
        }

        /* ===== Gift Bar ===== */
        .live-gift-bar {
          display: none;
          flex-direction: column;
          background: #0F0F23;
          flex-shrink: 0;
          overflow: hidden;
        }
        .live-gift-bar.visible {
          display: flex;
        }
        /* 充值入口 */
        .live-recharge-entry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(22, 33, 62, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .live-gold-balance {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #FFD60A;
          font-weight: 600;
        }
        .live-gold-balance::before {
          content: '\\u{1FA99}';
          font-size: 14px;
        }
        .live-btn-recharge {
          padding: 4px 12px;
          background: linear-gradient(135deg, #FFD60A 0%, #FFB800 100%);
          color: #1a1a1a;
          font-size: 12px;
          font-weight: 700;
          border-radius: 12px;
        }
        .live-btn-recharge:active {
          transform: scale(0.95);
          background: linear-gradient(135deg, #FFB800 0%, #FF9500 100%);
        }
        /* 礼物网格 */
        .live-gift-grid {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .live-gift-grid::-webkit-scrollbar {
          display: none;
        }
        .live-btn-gift {
          flex-shrink: 0;
          width: 64px;
          height: 64px;
          background: #16213E;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-size: 11px;
          font-weight: 500;
          color: #FFFFFF;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: all 0.15s ease;
        }
        .live-btn-gift:active {
          transform: scale(0.92);
          background: #1A2744;
        }
        .live-btn-gift-emoji {
          font-size: 22px;
          line-height: 1;
        }
        .live-btn-gift-price {
          font-size: 10px;
          color: #FFD60A;
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

      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
    }

    // ==================== 渲染 ====================

    onRender() {
      this._injectStyles();
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

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 进入直播间
          const streamItem = e.target.closest('[data-stream-id]');
          if (streamItem && !e.target.closest('[data-action]')) {
            await this._watchStream(streamItem.dataset.streamId);
            return;
          }

          // 返回列表
          if (e.target.closest('[data-action="back"]')) {
            await this._showListView();
            return;
          }

          // 发送弹幕
          if (e.target.closest('[data-action="send-danmaku"]')) {
            await this._handleSendDanmaku();
            return;
          }

          // AI 弹幕
          if (e.target.closest('[data-action="ai-danmaku"]')) {
            await this._handleAIDanmaku();
            return;
          }

          // 显示/隐藏礼物栏
          if (e.target.closest('[data-action="show-gift-bar"]')) {
            this._toggleGiftBar();
            return;
          }

          // 切换礼物面板（斗鱼风格）
          if (e.target.closest('[data-action="toggle-gift-panel"]')) {
            this._toggleGiftPanel();
            return;
          }

          // 关闭礼物面板
          if (e.target.closest('[data-action="close-gift-panel"]')) {
            this._hideGiftPanel();
            return;
          }

          // 关注主播
          if (e.target.closest('[data-action="follow-anchor"]')) {
            this._handleFollowAnchor(e.target.closest('[data-action="follow-anchor"]'));
            return;
          }

          // 分享直播间
          if (e.target.closest('[data-action="share-stream"]')) {
            this._handleShareStream();
            return;
          }

          // 送礼物
          const giftBtn = e.target.closest('[data-action="send-gift"]');
          if (giftBtn) {
            await this._handleSendGift(giftBtn.dataset.giftType);
            return;
          }

          // 开始直播
          if (e.target.closest('[data-action="start-live"]')) {
            await this._handleStartLive();
            return;
          }

          if (e.target.closest('[data-action="set-cover"]')) {
            await this._handleSetCover();
            return;
          }

          // 结束直播
          if (e.target.closest('[data-action="end-live"]')) {
            await this._handleEndLive();
            return;
          }

          // 观看历史
          if (e.target.closest('[data-action="show-history"]')) {
            await this._showHistoryView();
            return;
          }

          // 清空历史
          if (e.target.closest('[data-action="clear-history"]')) {
            await this._handleClearHistory();
            return;
          }

          // 充值按钮
          if (e.target.closest('[data-action="show-recharge"]')) {
            this._showRechargePanel();
            return;
          }

          // 充值选项
          const rechargeOpt = e.target.closest('[data-recharge-amount]');
          if (rechargeOpt) {
            this._selectRechargeOption(rechargeOpt);
            return;
          }

          // 确认充值
          if (e.target.closest('[data-action="confirm-recharge"]')) {
            await this._handleConfirmRecharge();
            return;
          }

          // 取消充值
          if (e.target.closest('[data-action="cancel-recharge"]')) {
            this._hideRechargePanel();
            return;
          }

          // 点击充值遮罩关闭
          if (e.target.closest('[data-action="recharge-overlay"]')) {
            this._hideRechargePanel();
            return;
          }
        });

        this._subscribeData();
        this._renderList();
      }, 0);
    }

    // ==================== 视图切换 ====================

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      // 头部按钮只在列表视图显示
      const historyBtn = this._container?.querySelector('[data-action="show-history"]');
      if (historyBtn) {
        historyBtn.style.display = viewName === 'LIST' ? 'inline-block' : 'none';
      }
      this._currentView = viewName;
    }

    async _showListView() {
      this._stopDanmakuPolling();
      this._stopNPCDanmaku();
      this._stopViewersUpdate();
      this._stopLiveDuration();
      this._currentStreamId = null;
      this._liveStartTime = null;
      this._showView('LIST');
      await this._renderList();
    }

    async _watchStream(streamId) {
      if (!streamId) {
        console.warn('[LiveModule] _watchStream: streamId 为空');
        return;
      }
      this._currentStreamId = streamId;
      this._liveStartTime = Date.now();
      this._danmakuFloatIndex = 0;
      this._showView('WATCH');
      await this._renderWatchView();
      this._startDanmakuPolling();
      this._startNPCDanmaku();
      this._startViewersUpdate();
      this._startLiveDuration();
      // 加载金币余额
      await this._loadGoldBalance();
    }

    async _showHistoryView() {
      this._showView('HISTORY');
      await this._renderHistory();
    }

    // ==================== 直播广场视图 ====================

    async _renderList() {
      const container = this._container?.querySelector('[data-view="LIST"]');
      if (!container) return;

      try {
        let streams = await this._service.getLiveStreams();
        
        // [修复] 如果没有直播，自动生成NPC直播
        if (!streams || streams.length === 0) {
          streams = await this._generateNPCStreams();
        }
        
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

          for (const stream of hotStreams) {
            const cover = await this._resolveStreamCover(stream);
            const card = document.createElement('div');
            card.className = 'live-hot-card';
            card.dataset.streamId = stream.id;
            card.innerHTML = `
              <div class="live-hot-cover" style="background-image: url('${this._safeUrl(cover || '')}')"></div>
              <div class="live-hot-badge">LIVE</div>
              <div class="live-hot-viewer-badge">${this._formatViewers(stream.viewers)}</div>
              <div class="live-hot-info">
                <div class="live-hot-title">${this._escapeHtml(stream.title)}</div>
                <div class="live-hot-meta">
                  <span>${this._escapeHtml(stream.streamerName)}</span>
                  <span class="live-hot-viewers">${this._formatViewers(stream.viewers)}</span>
                </div>
              </div>
            `;
            hotScroll.appendChild(card);
          }

          hotSection.appendChild(hotScroll);
          container.appendChild(hotSection);
        }

        // 全部直播列表
        const allSection = document.createElement('div');
        allSection.innerHTML = '<div class="live-section-title">全部直播</div>';
        container.appendChild(allSection);

        const listEl = document.createElement('div');
        listEl.className = 'live-list';

        // 标签池，随机分配给直播间
        const tagPool = ['hot', 'new', 'game', 'chat'];
        const tagLabels = { hot: '热门', new: '新品', game: '游戏', chat: '聊天' };

        for (const stream of streams) {
          const itemEl = document.createElement('div');
          itemEl.className = 'live-stream-item';
          itemEl.dataset.streamId = stream.id;
          const cover = await this._resolveStreamCover(stream);

          // 随机分配标签
          const tagKey = tagPool[Math.floor(Math.random() * tagPool.length)];
          const tagHtml = `<span class="live-tag live-tag-${tagKey}">${tagLabels[tagKey]}</span>`;

          itemEl.innerHTML = `
            <div class="live-card-cover" style="background-image: url('${this._safeUrl(cover || '')}')">
              <div class="live-badge">LIVE</div>
            </div>
            <div class="live-card-body">
              <div class="live-stream-avatar" style="background-image: url('${this._safeUrl(stream.streamerAvatar || '')}')"></div>
              <div class="live-stream-info">
                <div class="live-stream-title">${tagHtml}${this._escapeHtml(stream.title)}</div>
                <div class="live-stream-meta">
                  <span class="live-streamer">${this._escapeHtml(stream.streamerName)}</span>
                  <span class="live-viewers">${this._formatViewers(stream.viewers)}</span>
                </div>
              </div>
            </div>
          `;

          listEl.appendChild(itemEl);
        }

        container.appendChild(listEl);
      } catch (e) {
        console.warn('[LiveModule] 渲染直播列表失败:', e);
        container.innerHTML = '<div class="live-error">加载失败，请重试</div>';
      }
    }

    /**
     * [修复] 自动生成NPC直播
     * 当没有直播时，从好友列表或世界NPC中创建虚拟直播间
     */
    async _generateNPCStreams() {
      try {
        const streams = [];
        
        // 尝试从好友列表获取NPC
        let npcs = [];
        if (this._friendService) {
          const friends = await this._friendService.getList();
          npcs = friends.filter(f => f.id !== 'me' && f.id !== 'user').slice(0, 5);
        }
        
        // 如果好友列表为空，使用默认NPC
        if (npcs.length === 0) {
          npcs = [
            { id: 'npc_streamer_1', name: '小甜甜', avatar: '', personality: '甜美可爱' },
            { id: 'npc_streamer_2', name: '游戏大神', avatar: '', personality: '技术流' },
            { id: 'npc_streamer_3', name: '音乐达人', avatar: '', personality: '文艺青年' },
            { id: 'npc_streamer_4', name: '美食博主', avatar: '', personality: '热爱生活' },
          ];
        }
        
        // 直播标题模板
        const titleTemplates = [
          '{name}的直播间',
          '欢迎来到{name}的直播间',
          '{name}正在直播',
          '和{name}一起玩游戏',
          '{name}的日常直播',
        ];
        
        // 为每个NPC创建直播间
        for (let i = 0; i < npcs.length; i++) {
          const npc = npcs[i];
          const template = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
          const title = template.replace('{name}', npc.name);
          const viewers = Math.floor(Math.random() * 5000) + 100;
          
          // [修复] 直接在 startLive 时传入 viewers，避免 updateStream 竞态条件
          const stream = await this._service.startLive({
            streamerId: npc.id,
            streamerName: npc.name,
            streamerAvatar: npc.avatar || '',
            title: title,
            viewers: viewers,
          });
          
          if (stream) {
            streams.push(stream);
          }
        }
        
        console.log('[LiveModule] 自动生成NPC直播:', streams.length, '个');
        return streams;
      } catch (e) {
        console.warn('[LiveModule] 生成NPC直播失败:', e);
        return [];
      }
    }

    // ==================== 观看视图 ====================

    async _renderWatchView() {
      const container = this._container?.querySelector('[data-view="WATCH"]');
      if (!container || !this._currentStreamId) return;

      try {
        const stream = await this._service.getStream(this._currentStreamId);
        
        // [修复] 如果按ID查不到，尝试从所有直播中查找
        if (!stream) {
          console.warn('[LiveModule] 按 ID 未找到直播:', this._currentStreamId);
          const allStreams = await this._service.getLiveStreams();
          if (allStreams && allStreams.length > 0) {
            // 使用第一个可用的直播（不递归调用，直接使用）
            const fallback = allStreams[0];
            this._currentStreamId = fallback.id;
            console.log('[LiveModule] 降级使用第一个直播:', this._currentStreamId);
            // 直接使用 fallback 渲染，避免递归
            this._renderStreamContent(container, fallback);
            return;
          }

          // [修复v2] 所有直播都不存在时，自动生成NPC直播而不是显示错误
          console.log('[LiveModule] 无可用直播，尝试自动生成...');
          const generated = await this._generateNPCStreams();
          if (generated && generated.length > 0) {
            const fallback = generated[0];
            this._currentStreamId = fallback.id;
            console.log('[LiveModule] 自动生成直播:', this._currentStreamId);
            this._renderStreamContent(container, fallback);
            return;
          }

          container.innerHTML = '<div class="live-error">直播间不存在，请返回重试</div>';
          return;
        }
        
        this._renderStreamContent(container, stream);
      } catch (e) {
        console.warn('[LiveModule] 渲染观看视图失败:', e);
        container.innerHTML = '<div class="live-error">加载失败，请重试</div>';
      }
    }

    /**
     * 渲染直播内容（从 _renderWatchView 抽取，避免递归）
     */
    async _renderStreamContent(container, stream) {
      if (!stream) return;
      try {
      const title = stream.title || '未命名直播';
      const streamerName = stream.streamerName || '未知主播';
      const streamerAvatar = stream.streamerAvatar || '';
      const viewers = stream.viewers || 0;

      const cover = await this._resolveStreamCover(stream);

      // 构建礼物面板 HTML - 斗鱼风格网格
        const giftTypes = Object.keys(GIFT_EMOJI);
        let giftPanelHtml = '';
        for (const gt of giftTypes) {
          const tier = this._getGiftTier(gt);
          const tierClass = `live-gift-tier-${tier}`;
          giftPanelHtml += `
            <div class="live-gift-item-douyu ${tierClass}" data-action="send-gift" data-gift-type="${gt}">
              <div class="live-gift-icon-douyu">${GIFT_EMOJI[gt]}</div>
              <div class="live-gift-name-douyu">${GIFT_NAMES[gt]}</div>
              <div class="live-gift-price-douyu">${GIFT_PRICES[gt]}</div>
            </div>
          `;
        }

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
                  <div class="live-douyu-avatar" style="background-image: url('${this._safeUrl(stream.streamerAvatar || '')}')"></div>
                  <div class="live-douyu-online-dot"></div>
                </div>
                <div class="live-douyu-info">
                  <div class="live-douyu-name">${this._escapeHtml(stream.streamerName)}</div>
                  <div class="live-douyu-title">${this._escapeHtml(stream.title)}</div>
                </div>
                <button class="live-douyu-follow" data-action="follow-anchor">+ 关注</button>
              </div>
              <div class="live-douyu-header-right">
                <div class="live-douyu-viewers">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  <span data-viewers-display>${this._formatViewers(stream.viewers)}</span>
                </div>
                <div class="live-douyu-share" data-action="share-stream">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                </div>
              </div>
            </div>

            <!-- 视频区域 -->
            <div class="live-douyu-video" style="background-image: url('${this._safeUrl(cover || '')}')">
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
                <span class="live-douyu-chat-count">${this._formatViewers(stream.viewers)}人</span>
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
                  <span data-gold-display>${this._goldBalance}</span>
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

        // 加载弹幕
        await this._loadDanmaku();
        await this._loadGifts();
      } catch (e) {
        console.warn('[LiveModule] 渲染观看页面失败:', e);
        container.innerHTML = '<div class="live-error">加载失败，请重试</div>';
      }
    }

    // ==================== 历史视图 ====================

    async _renderHistory() {
      const container = this._container?.querySelector('[data-view="HISTORY"]');
      if (!container) return;

      try {
        const history = await this._service.getHistory();
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
              <div class="live-history-title">${this._escapeHtml(record.title || record.streamTitle || '')}</div>
              <div class="live-history-meta">
                <span class="live-history-streamer">${this._escapeHtml(record.streamerName || '')}</span>
                <span class="live-history-date">${this._escapeHtml(record.date || record.watchDate || '')}</span>
              </div>
            </div>
          `;
          listEl.appendChild(el);
        });

        container.appendChild(listEl);
      } catch (e) {
        console.warn('[LiveModule] 渲染观看历史失败:', e);
        container.innerHTML = '<div class="live-error">加载失败，请重试</div>';
      }
    }

    // ==================== 弹幕轮询 ====================

    _startDanmakuPolling() {
      this._stopDanmakuPolling();
      this._danmakuTimer = setInterval(() => {
        this._loadDanmaku();
      }, 3000);
    }

    _stopDanmakuPolling() {
      if (this._danmakuTimer) {
        clearInterval(this._danmakuTimer);
        this._danmakuTimer = null;
      }
    }

    // ==================== NPC 自动弹幕 ====================

    _startNPCDanmaku() {
      this._stopNPCDanmaku();
      // 每 5-8 秒生成一条 NPC 弹幕
      const scheduleNext = () => {
        const delay = 5000 + Math.random() * 3000;
        this._npcDanmakuTimer = setTimeout(async () => {
          await this._generateNPCDanmaku();
          scheduleNext();
        }, delay);
      };
      scheduleNext();
    }

    _stopNPCDanmaku() {
      if (this._npcDanmakuTimer) {
        clearTimeout(this._npcDanmakuTimer);
        this._npcDanmakuTimer = null;
      }
    }

    /**
     * 生成 NPC 弹幕
     * 优先调用 AI 生成，失败时使用预设弹幕池
     */
    async _generateNPCDanmaku() {
      if (!this._currentStreamId) return;

      try {
        // 从好友列表随机选取 NPC 名字
        let npcName = '路人' + Math.floor(Math.random() * 999 + 1);
        try {
          const friends = await this._friendService.getList();
          if (friends && friends.length > 0) {
            const npc = friends[Math.floor(Math.random() * friends.length)];
            npcName = npc.name || npcName;
          }
        } catch (_) {
          // 获取好友列表失败，使用默认名字
        }

        // 尝试调用 AI 生成弹幕
        let content = null;
        try {
          const result = await this._service.generateDanmaku(this._currentStreamId);
          if (result) {
            content = result.content;
          }
        } catch (_) {
          // AI 调用失败，使用预设弹幕池
        }

        // 降级：使用预设弹幕池
        if (!content) {
          content = PRESET_DANMAKU[Math.floor(Math.random() * PRESET_DANMAKU.length)];
        }

        // 通过 Service 发送弹幕（铁则一：数据操作通过 Service）
        await this._service.sendDanmaku(this._currentStreamId, content, {
          userId: 'npc_' + npcName,
          userName: npcName,
        });

        // 刷新弹幕显示
        await this._loadDanmaku();
      } catch (e) {
        console.warn('[LiveModule] NPC 弹幕生成失败:', e);
      }
    }

    // ==================== 观众数实时更新 ====================

    _startViewersUpdate() {
      this._stopViewersUpdate();
      this._viewersTimer = setInterval(async () => {
        if (!this._currentStreamId) return;
        try {
          // 随机增减观众数模拟真实感
          const delta = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : -Math.floor(Math.random() * 2);
          const viewers = await this._service.updateViewers(this._currentStreamId, delta);
          const display = this._container?.querySelector('[data-viewers-display]');
          if (display && viewers !== undefined) {
            display.textContent = this._formatViewers(viewers);
          }
        } catch (e) {
          console.warn('[LiveModule] 更新观众数失败:', e);
        }
      }, 5000);
    }

    _stopViewersUpdate() {
      if (this._viewersTimer) {
        clearInterval(this._viewersTimer);
        this._viewersTimer = null;
      }
    }

    // ==================== 直播时长计时器 ====================

    _startLiveDuration() {
      this._stopLiveDuration();
      if (!this._liveStartTime) this._liveStartTime = Date.now();
      this._liveDurationTimer = setInterval(() => {
        const elapsed = Date.now() - this._liveStartTime;
        const h = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
        const display = this._container?.querySelector('[data-duration-display]');
        if (display) {
          display.textContent = `${h}:${m}:${s}`;
        }
      }, 1000);
    }

    _stopLiveDuration() {
      if (this._liveDurationTimer) {
        clearInterval(this._liveDurationTimer);
        this._liveDurationTimer = null;
      }
    }

    // ==================== 弹幕加载与飘屏 ====================

    async _loadDanmaku() {
      if (!this._currentStreamId) return;

      const danmakuFloatArea = this._container?.querySelector('[data-danmaku-float-area]');
      const danmakuList = this._container?.querySelector('[data-danmaku-list]');
      if (!danmakuFloatArea || !danmakuList) return;

      try {
        const danmakuData = await this._service.getDanmaku(this._currentStreamId);

        // 获取已显示的弹幕数量，只处理新增的
        const existingCount = danmakuList.children.length;
        const newDanmaku = danmakuData.slice(existingCount);

        newDanmaku.forEach(d => {
          // 飘屏弹幕（斗鱼风格）
          this._createFloatingDanmakuDouyu(danmakuFloatArea, d);

          // 右侧弹幕列表（保留最近 20 条）
          const listItem = document.createElement('div');
          listItem.className = 'live-douyu-chat-item';

          if (d.type === 'system') {
            listItem.classList.add('system');
            listItem.innerHTML = `<span class="chat-system">${this._escapeHtml(d.content)}</span>`;
          } else if (d.type === 'gift') {
            listItem.classList.add('gift');
            listItem.innerHTML = `<span class="chat-gift">${this._escapeHtml(d.content)}</span>`;
          } else if (d.type === 'anchor') {
            listItem.classList.add('anchor');
            listItem.innerHTML = `<span class="chat-anchor">主播</span>: ${this._escapeHtml(d.content)}`;
          } else {
            // 普通用户弹幕，根据等级显示不同颜色
            const level = this._getUserLevel(d.userId);
            listItem.innerHTML = `<span class="chat-user level-${level}">${this._escapeHtml(d.userName)}</span>: ${this._escapeHtml(d.content)}`;
          }

          danmakuList.appendChild(listItem);

          // 限制右侧列表数量
          while (danmakuList.children.length > 20) {
            danmakuList.removeChild(danmakuList.firstChild);
          }

          // 自动滚动到底部
          danmakuList.scrollTop = danmakuList.scrollHeight;
        });
      } catch (e) {
        console.warn('[LiveModule] 加载弹幕失败:', e);
      }
    }

    /**
     * 获取用户等级（用于弹幕颜色区分）
     */
    _getUserLevel(userId) {
      if (!userId) return 1;
      // 根据用户ID哈希计算等级 1-6
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash) % 6 + 1;
    }

    /**
     * 创建飘屏弹幕元素
     * @param {HTMLElement} area - 弹幕区域容器
     * @param {Object} d - 弹幕数据
     */
    _createFloatingDanmaku(area, d) {
      const floatEl = document.createElement('div');
      floatEl.className = 'live-danmaku-float';

      // 随机垂直位置（弹幕区域高度 180px，留出底部列表空间）
      const maxTop = 110;
      const top = Math.floor(Math.random() * maxTop);
      floatEl.style.top = top + 'px';

      // 随机动画时长（6-10秒）
      const duration = 6 + Math.random() * 4;
      floatEl.style.setProperty('--duration', duration + 's');

      // 构建内容
      if (d.type === 'system') {
        floatEl.innerHTML = `<span class="live-danmaku-system">${this._escapeHtml(d.content)}</span>`;
      } else if (d.type === 'gift') {
        floatEl.innerHTML = `<span class="live-danmaku-gift">${this._escapeHtml(d.content)}</span>`;
      } else {
        floatEl.innerHTML = `<span class="live-danmaku-user">${this._escapeHtml(d.userName)}</span>: ${this._escapeHtml(d.content)}`;
      }

      area.appendChild(floatEl);

      // 动画结束后移除元素，防止内存泄漏
      const removeDelay = (duration + 0.5) * 1000;
      setTimeout(() => {
        if (floatEl.parentNode) {
          floatEl.parentNode.removeChild(floatEl);
        }
      }, removeDelay);
    }

    /**
     * 创建斗鱼风格飘屏弹幕
     * @param {HTMLElement} area - 弹幕区域容器
     * @param {Object} d - 弹幕数据
     */
    _createFloatingDanmakuDouyu(area, d) {
      const floatEl = document.createElement('div');
      floatEl.className = 'live-douyu-danmaku-item';

      // 计算轨道位置（8条轨道，避免重叠）
      this._danmakuFloatIndex = (this._danmakuFloatIndex + 1) % 8;
      const trackHeight = 28;
      const top = this._danmakuFloatIndex * trackHeight + 8;
      floatEl.style.top = top + 'px';

      // 随机动画时长（7-12秒）
      const duration = 7 + Math.random() * 5;
      floatEl.style.setProperty('--duration', duration + 's');

      // 构建内容
      if (d.type === 'system') {
        floatEl.classList.add('system');
        floatEl.innerHTML = `<span class="danmaku-system">${this._escapeHtml(d.content)}</span>`;
      } else if (d.type === 'gift') {
        floatEl.classList.add('gift');
        floatEl.innerHTML = `<span class="danmaku-gift">${this._escapeHtml(d.content)}</span>`;
      } else if (d.type === 'anchor') {
        floatEl.classList.add('anchor');
        floatEl.innerHTML = `<span class="danmaku-anchor">主播</span>: ${this._escapeHtml(d.content)}`;
      } else {
        // 普通用户弹幕，根据等级显示不同颜色
        const level = this._getUserLevel(d.userId);
        floatEl.classList.add(`level-${level}`);
        floatEl.innerHTML = `<span class="danmaku-user">${this._escapeHtml(d.userName)}</span>: ${this._escapeHtml(d.content)}`;
      }

      area.appendChild(floatEl);

      // 动画结束后移除元素
      const removeDelay = (duration + 0.5) * 1000;
      setTimeout(() => {
        if (floatEl.parentNode) {
          floatEl.parentNode.removeChild(floatEl);
        }
      }, removeDelay);
    }

    async _loadGifts() {
      if (!this._currentStreamId) return;

      const container = this._container?.querySelector('[data-gift-area]');
      if (!container) return;

      try {
        const gifts = await this._service.getGifts(this._currentStreamId);

        // 只显示最近5个礼物
        const recentGifts = gifts.slice(-5);

        // 增量更新
        const existingCount = container.children.length;
        const newGifts = recentGifts.slice(existingCount);

        newGifts.forEach(g => {
          const el = document.createElement('div');
          el.className = 'live-gift-item';
          el.textContent = `${g.userName} 送出了 ${g.name}`;
          container.appendChild(el);
        });
      } catch (e) {
        console.warn('[LiveModule] 加载礼物失败:', e);
      }
    }

    // ==================== 礼物特效 ====================

    /**
     * 触发礼物特效
     * @param {string} giftType - 礼物类型
     * @param {string} userName - 送礼人
     */
    _triggerGiftEffect(giftType, userName) {
      const effectArea = this._container?.querySelector('[data-gift-effect-area]');
      if (!effectArea) return;

      const tier = this._getGiftTier(giftType);
      const emoji = GIFT_EMOJI[giftType] || '\u{1F381}';
      const name = GIFT_NAMES[giftType] || '礼物';

      if (tier === 'small') {
        this._createSmallGiftEffect(effectArea, emoji, userName, name);
      } else if (tier === 'medium') {
        this._createMediumGiftEffect(effectArea, emoji, userName, name);
      } else if (tier === 'large') {
        this._createLargeGiftEffect(effectArea, emoji, userName, name);
      }
    }

    /**
     * 小礼物特效：弹幕区域文字 + emoji 动画
     */
    _createSmallGiftEffect(area, emoji, userName, giftName) {
      const el = document.createElement('div');
      el.className = 'live-gift-small';
      el.textContent = emoji;
      // 随机水平位置
      el.style.left = (20 + Math.random() * 60) + '%';
      el.style.bottom = '10px';
      area.appendChild(el);

      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 2200);
    }

    /**
     * 中礼物特效：屏幕中央弹出 + 粒子效果
     */
    _createMediumGiftEffect(area, emoji, userName, giftName) {
      const container = document.createElement('div');
      container.className = 'live-gift-medium-container';
      container.innerHTML = `
        <span class="live-gift-medium-icon">${emoji}</span>
        <div class="live-gift-medium-text">${this._escapeHtml(userName)} 送出 ${giftName}</div>
      `;
      // 延迟添加淡出类
      setTimeout(() => {
        container.classList.add('live-gift-medium-fadeout');
      }, 100);
      area.appendChild(container);

      // 创建粒子效果
      this._createParticles(area, 8);

      setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
      }, 2200);
    }

    /**
     * 大礼物特效：全屏横幅 + 连击
     */
    _createLargeGiftEffect(area, emoji, userName, giftName) {
      const banner = document.createElement('div');
      banner.className = 'live-gift-large-banner';
      banner.innerHTML = `
        <span class="live-gift-large-icon">${emoji}</span>
        <span class="live-gift-large-text">${this._escapeHtml(userName)} 送出 ${giftName}</span>
        <span class="live-gift-large-combo">x1</span>
      `;
      area.appendChild(banner);

      // 创建粒子效果
      this._createParticles(area, 16);

      setTimeout(() => {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 3200);
    }

    /**
     * 创建粒子扩散效果
     * @param {HTMLElement} area - 特效区域
     * @param {number} count - 粒子数量
     */
    _createParticles(area, count) {
      const colors = ['#FF3B30', '#FF6B35', '#FFD60A', '#34C759', '#007AFF', '#AF52DE'];
      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'live-gift-particle';
        // 随机方向和距离
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const distance = 40 + Math.random() * 60;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = '50%';
        particle.style.top = '50%';
        area.appendChild(particle);

        setTimeout(() => {
          if (particle.parentNode) particle.parentNode.removeChild(particle);
        }, 900);
      }
    }

    /**
     * 获取礼物等级
     */
    _getGiftTier(giftType) {
      if (GIFT_TIERS.large.includes(giftType)) return 'large';
      if (GIFT_TIERS.medium.includes(giftType)) return 'medium';
      return 'small';
    }

    // ==================== 礼物栏切换 ====================

    _toggleGiftBar() {
      const giftBar = this._container?.querySelector('[data-gift-bar]');
      if (!giftBar) return;
      giftBar.classList.toggle('visible');
      // 切换时刷新金币余额
      if (giftBar.classList.contains('visible')) {
        this._loadGoldBalance();
      }
    }

    // ==================== 斗鱼风格礼物面板 ====================

    _toggleGiftPanel() {
      const giftPanel = this._container?.querySelector('[data-gift-panel]');
      if (!giftPanel) return;
      giftPanel.classList.toggle('visible');
      // 切换时刷新金币余额
      if (giftPanel.classList.contains('visible')) {
        this._loadGoldBalance();
      }
    }

    _hideGiftPanel() {
      const giftPanel = this._container?.querySelector('[data-gift-panel]');
      if (giftPanel) {
        giftPanel.classList.remove('visible');
      }
    }

    _handleFollowAnchor(btn) {
      if (btn.classList.contains('followed')) {
        btn.textContent = '+ 关注';
        btn.classList.remove('followed');
        this.showToast('已取消关注', 'info');
      } else {
        btn.textContent = '已关注';
        btn.classList.add('followed');
        this.showToast('关注成功！', 'success');
      }
    }

    _handleShareStream() {
      this.showToast('分享链接已复制到剪贴板', 'success');
    }

    // ==================== 充值系统 ====================

    _showRechargePanel() {
      // 移除已有充值面板
      this._hideRechargePanel();

      const watchView = this._container?.querySelector('.live-watch');
      if (!watchView) return;

      let optionsHtml = '';
      RECHARGE_OPTIONS.forEach((opt, idx) => {
        const bonusText = opt.bonus > 0 ? `+${opt.bonus} 赠送` : '';
        const selectedClass = idx === 0 ? ' selected' : '';
        optionsHtml += `
          <div class="live-recharge-option${selectedClass}" data-recharge-amount="${opt.amount}" data-recharge-bonus="${opt.bonus}">
            <span class="live-recharge-amount">${opt.amount}</span>
            ${bonusText ? `<div class="live-recharge-bonus">${bonusText}</div>` : ''}
          </div>
        `;
      });

      const overlay = document.createElement('div');
      overlay.className = 'live-recharge-overlay';
      overlay.dataset.action = 'recharge-overlay';
      overlay.innerHTML = `
        <div class="live-recharge-panel">
          <div class="live-recharge-title">充值金币</div>
          <div class="live-recharge-grid">
            ${optionsHtml}
          </div>
          <button class="live-recharge-confirm" data-action="confirm-recharge">确认充值</button>
          <button class="live-recharge-cancel" data-action="cancel-recharge">取消</button>
        </div>
      `;

      watchView.appendChild(overlay);
      this._selectedRechargeAmount = RECHARGE_OPTIONS[0].amount;
      this._selectedRechargeBonus = RECHARGE_OPTIONS[0].bonus;
    }

    _hideRechargePanel() {
      const overlay = this._container?.querySelector('.live-recharge-overlay');
      if (overlay) {
        overlay.parentNode?.removeChild(overlay);
      }
    }

    _selectRechargeOption(el) {
      // 移除所有选中状态
      const options = this._container?.querySelectorAll('.live-recharge-option');
      if (options) {
        options.forEach(opt => opt.classList.remove('selected'));
      }
      el.classList.add('selected');
      this._selectedRechargeAmount = parseInt(el.dataset.rechargeAmount, 10) || 0;
      this._selectedRechargeBonus = parseInt(el.dataset.rechargeBonus, 10) || 0;
    }

    async _handleConfirmRecharge() {
      const totalAmount = (this._selectedRechargeAmount || 0) + (this._selectedRechargeBonus || 0);
      if (totalAmount <= 0) {
        this.showToast('请选择充值金额', 'warning');
        return;
      }

      try {
        const result = await this._economyService.add(totalAmount, 'gold', 'live_recharge', {
          baseAmount: this._selectedRechargeAmount,
          bonus: this._selectedRechargeBonus,
        });

        if (result?.ok) {
          this.showToast(`充值成功！获得 ${totalAmount} 金币`, 'success');
          await this._loadGoldBalance();
          this._hideRechargePanel();
        } else {
          this.showToast('充值失败', 'error');
        }
      } catch (e) {
        console.warn('[LiveModule] 充值失败:', e);
        this.showToast('充值失败: ' + (e.message || ''), 'error');
      }
    }

    async _loadGoldBalance() {
      try {
        const balance = await this._economyService.getBalance('gold');
        this._goldBalance = balance;
        const display = this._container?.querySelector('[data-gold-display]');
        if (display) {
          display.textContent = balance;
        }
      } catch (e) {
        console.warn('[LiveModule] 获取金币余额失败:', e);
      }
    }

    // ==================== 业务处理 ====================

    async _handleSendDanmaku() {
      const input = this._container?.querySelector('.live-douyu-input, .live-danmaku-input');
      if (!input) return;

      const content = input.value?.trim();
      if (!content) return;

      try {
        await this._service.sendDanmaku(this._currentStreamId, content);
        input.value = '';
        await this._loadDanmaku();
      } catch (err) {
        console.error('[LiveModule] 发送弹幕失败:', err);
        this.showToast('发送弹幕失败: ' + err.message, 'error');
      }
    }

    async _handleAIDanmaku() {
      try {
        await this._service.generateDanmaku(this._currentStreamId);
        await this._loadDanmaku();
      } catch (err) {
        console.error('[LiveModule] AI弹幕失败:', err);
        this.showToast('AI弹幕失败: ' + err.message, 'error');
      }
    }

    async _handleSendGift(giftType) {
      try {
        const result = await this._service.sendGift(this._currentStreamId, giftType);
        if (result?.error === 'insufficient_funds') {
          this.showToast('金币不足，需要 ' + (result.required || 0) + ' 金币', 'error');
          // 自动打开充值面板
          this._showRechargePanel();
          return;
        }
        if (!result) {
          this.showToast('送礼物失败', 'error');
          return;
        }

        // 触发礼物特效
        this._triggerGiftEffect(giftType, result.userName || '我');

        await this._loadGifts();
        await this._loadDanmaku();
        // 刷新金币余额
        await this._loadGoldBalance();
      } catch (err) {
        console.error('[LiveModule] 送礼物失败:', err);
        this.showToast('送礼物失败: ' + err.message, 'error');
      }
    }

    async _resolveStreamCover(stream) {
      if (!stream) return '';
      if (stream.coverImage) return stream.coverImage;
      try {
        const media = window.Platform?.get?.('mediaLocalService')
          || (window.PhoneServices?.MediaLocal && new window.PhoneServices.MediaLocal(window.Platform));
        if (media) {
          const local = await media.getStreamCover(stream.id);
          if (local) return local;
        }
      } catch (_) {}
      return stream.streamerAvatar || '';
    }

    async _handleSetCover() {
      if (!this._currentStreamId) return;
      try {
        const media = window.Platform?.get?.('mediaLocalService')
          || (window.PhoneServices?.MediaLocal && new window.PhoneServices.MediaLocal(window.Platform));
        const url = await media?.pickImageFile?.();
        if (!url) return;
        await media.setStreamCover(this._currentStreamId, url);
        await this._service?.updateStream?.(this._currentStreamId, { coverImage: url });
        await this._renderWatchView();
        this.showToast('封面已更新', 'success');
      } catch (e) {
        this.showToast('设置封面失败', 'error');
      }
    }

    async _handleStartLive() {
      try {
        const title = await this.showPrompt({ message: '请输入直播标题:', placeholder: '直播标题' });
        if (!title?.trim()) return;

        let coverImage = '';
        try {
          const media = window.Platform?.get?.('mediaLocalService')
            || (window.PhoneServices?.MediaLocal && new window.PhoneServices.MediaLocal(window.Platform));
          if (media && confirm('是否选择本地图片作为直播封面？')) {
            coverImage = (await media.pickImageFile()) || '';
          }
        } catch (_) {}

        const started = await this._service.startLive({
          streamerName: '我',
          title: title.trim(),
          coverImage,
        });
        if (started?.id && coverImage) {
          const media = window.Platform?.get?.('mediaLocalService');
          if (media?.setStreamCover) await media.setStreamCover(started.id, coverImage);
        }
        this.showToast('直播已开始', 'success');
        await this._renderList();
      } catch (err) {
        console.error('[LiveModule] 开始直播失败:', err);
        this.showToast('直播功能暂未接入API', 'warning');
      }
    }

    async _handleEndLive() {
      if (!await this.confirm('确定结束直播吗？')) return;

      try {
        await this._service.endLive(this._currentStreamId);
        await this._showListView();
      } catch (err) {
        this.showToast('结束直播失败: ' + err.message, 'error');
      }
    }

    async _handleClearHistory() {
      if (!await this.confirm('确定清空观看历史吗？')) return;

      try {
        const result = await this._service.clearHistory();
        if (result) {
          this.showToast('历史已清空', 'success');
          await this._renderHistory();
        } else {
          this.showToast('清空失败', 'error');
        }
      } catch (err) {
        console.error('[LiveModule] 清空历史失败:', err);
        this.showToast('清空失败: ' + err.message, 'error');
      }
    }

    /**
     * 处理收到的消息（通过 Platform 事件订阅，不直接监听 WebSocket）
     * 铁则二：WebSocket 只死在适配器里
     */
    async _handleIncomingMessage(data) {
      if (!this._currentStreamId || !data?.message) return;

      try {
        const result = await this._service.handleIncomingMessage(
          data.friendId,
          data.message,
          this._currentStreamId
        );

        if (result) {
          // 有直播事件被解析，刷新弹幕和礼物
          await this._loadDanmaku();
          if (result.gifts?.length > 0) {
            await this._loadGifts();
            // 触发礼物特效
            result.gifts.forEach(g => {
              this._triggerGiftEffect(g.type, g.userName);
            });
          }
        }
      } catch (e) {
        console.warn('[LiveModule] 处理消息失败:', e);
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsub = this._service.subscribeStreams(() => {
          if (this._currentView === 'LIST') {
            this._renderList();
          }
        });
        if (unsub) this._unsubscribers.push(unsub);
      } catch (e) {
        console.warn('[LiveModule] 订阅直播列表失败:', e);
      }

      // 订阅 director:live 事件
      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      try {
        const eventBus = window.Platform?.eventBus;
        if (eventBus) {
          const unsub = eventBus.on('director:live', async (payload) => {
            console.log('[LiveModule] 收到director:live事件', payload);
            try {
              if (this._currentView === 'LIST') {
                await this._renderList();
              } else if (this._currentView === 'WATCH' && this._currentStreamId) {
                await this._loadDanmaku();
                await this._loadGifts();
              }
            } catch (e) {
              console.warn('[LiveModule] 处理director:live事件失败:', e);
            }
          });
          if (unsub) this._unsubscribers.push(unsub);
        }
      } catch (e) {
        console.warn('[LiveModule] 订阅director:live事件失败:', e);
      }
    }

    // ==================== 辅助方法 ====================

    async _refresh() {
      if (this._currentView === 'LIST') {
        await this._renderList();
      }
    }

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * 安全处理URL（用于图片背景）
     * [修复] 不对URL进行HTML转义，避免破坏图片路径
     * @param {string} url
     * @returns {string}
     */
    _safeUrl(url) {
      if (!url) return '';
      // 只允许特定字符，防止XSS
      return String(url).replace(/["'<>]/g, '');
    }

    /**
     * 格式化观看人数
     * @param {number} count
     * @returns {string}
     */
    _formatViewers(count) {
      if (!count && count !== 0) return '0';
      if (count >= 10000) {
        return (count / 10000).toFixed(1) + '万';
      }
      return String(count);
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new LiveModule();
      return {
        id: instance.id,
        name: instance.name,
        icon: instance.icon,
        iconBg: instance.iconBg,
        init: (phone, params) => instance.init(phone, params),
        resume: (params) => instance.resume(params),
        pause: () => instance.pause(),
        destroy: () => instance.destroy(),
        render: () => instance.render(),
      };
    }
  }

  // 暴露到全局
  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Live = LiveModule;

  console.log('[Module] LiveModule 已加载');
})();
