/**
 * MessageModule - 消息模块（消息 + 朋友圈合并）
 * 职责：生命周期管理、事件绑定、调用渲染器
 * 禁止：直接操作数据（必须通过 MessageService / FriendsCircleService）
 *
 * 两个 Tab 视图：CHAT_LIST（消息列表/会话列表）| MOMENTS（朋友圈）
 * 子视图：CHAT（聊天界面）
 * 全局挂载：window.PhoneModules.Message
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 模块注册通过 __phoneShell.registerModule（铁则五）
 *   - CSS 类名以 msg- 前缀（铁则十一）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class MessageModule extends PhoneApp {
    constructor() {
      super({
        id: 'message',
        name: '消息',
        icon: '💬',
        iconBg: '#07C160',
      });

      this._msgService = null;
      this._fcService = null;
      this._friendService = null;
      this._currentView = 'CHAT_LIST'; // CHAT_LIST | CHAT | MOMENTS
      this._currentFriendId = null;
      this._fcCurrentView = 'FEED'; // FEED | MY（朋友圈内部子视图）
      this._unsubscribers = [];
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._msgService = new window.PhoneServices.Message(window.Platform);
      this._fcService = new window.PhoneServices.FriendsCircle(window.Platform);
      this._friendService = new window.PhoneServices.Friend(window.Platform);
    }

    onResume(params) {
      if (params?.friendId) {
        this._currentFriendId = params.friendId;
        this._currentView = 'CHAT';
      }
      setTimeout(() => {
        if (this._currentView === 'CHAT' && this._currentFriendId) {
          this._openChat(this._currentFriendId);
        } else if (this._currentView === 'MOMENTS') {
          this._renderMoments();
        } else {
          // 默认显示消息列表
          this._currentView = 'CHAT_LIST';
          this._renderFriendList();
        }
      }, 50);
    }

    onPause() {}

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch (e) {} });
      this._unsubscribers = [];
    }

    // ==================== 渲染 ====================

    onRender() {
      // 确保样式只注入一次（类级别标志，避免 ID 选择器）
      if (!MessageModule._stylesInjected) {
        MessageModule._stylesInjected = true;
        const style = document.createElement('style');
        style.className = 'msg-module-styles';
        style.textContent = this._getEmbeddedStyles();
        document.head.appendChild(style);
      }

      // 渲染完成后发送事件
      setTimeout(() => this._onRenderComplete(), 0);

      return `
        <div class="msg-app" style="height:100%;display:flex;flex-direction:column;">
          <div class="msg-tabs">
            <button data-tab="CHAT_LIST" class="msg-tab msg-active">消息</button>
            <button data-tab="MOMENTS" class="msg-tab">朋友圈</button>
            <button data-action="go-home" class="msg-home-btn" title="返回主界面">🏠</button>
          </div>
          <div class="msg-views">
            <div class="msg-view" data-view="CHAT_LIST"></div>
            <div class="msg-view" data-view="CHAT" style="display:none;"></div>
            <div class="msg-view" data-view="MOMENTS" style="display:none;">
              <div class="msg-moments-header">
                <div class="msg-moments-tabs">
                  <button data-fc-tab="FEED" class="msg-fc-tab msg-active">朋友圈</button>
                  <button data-fc-tab="MY" class="msg-fc-tab">我的</button>
                </div>
                <button class="msg-publish-btn" data-action="publish">📷</button>
              </div>
              <div class="msg-moments-views">
                <div class="msg-moments-view" data-fc-view="FEED"></div>
                <div class="msg-moments-view" data-fc-view="MY" style="display:none;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    _getEmbeddedStyles() {
      return `
        /* ========== 微信写实风格 - 消息模块（完整 CSS） ========== */

        /* ---- 基础容器 ---- */
        .msg-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ededed;
          font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
          color: #111;
          font-size: 15px;
          line-height: 1.5;
        }

        /* ========== 顶部 Tab 栏 ========== */
        .msg-tabs {
          display: flex;
          background: #ededed;
          border-bottom: 0.5px solid #d9d9d9;
          position: relative;
          flex-shrink: 0;
        }
        .msg-tab {
          flex: 1;
          padding: 10px 0 9px;
          border: none;
          background: none;
          font-size: 15px;
          font-weight: 500;
          color: #888;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
          letter-spacing: 0.2px;
        }
        .msg-tab.msg-active {
          color: #07C160;
          font-weight: 600;
        }
        .msg-tab.msg-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 2.5px;
          background: #07C160;
          border-radius: 2px;
        }
        .msg-home-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: #f5f5f5;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          margin: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .msg-home-btn:hover {
          background: #e5e5e5;
        }

        /* ========== 视图容器 ========== */
        .msg-views {
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        .msg-view {
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ========== 消息列表页 ========== */

        /* 搜索栏 */
        .msg-search-bar {
          padding: 8px 12px;
          background: #ededed;
          flex-shrink: 0;
        }
        .msg-search-bar input {
          width: 100%;
          height: 34px;
          border: none;
          border-radius: 8px;
          background: #fff;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          color: #111;
          box-sizing: border-box;
        }
        .msg-search-bar input::placeholder {
          color: #b0b0b0;
        }

        /* 操作栏 */
        .msg-action-bar {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          background: #f7f7f7;
        }
        .msg-action-bar button {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
          font-size: 13px;
          cursor: pointer;
          color: #111;
        }
        .msg-action-bar button:active {
          background: #f0f0f0;
        }

        /* 好友列表 */
        .msg-friend-list {
          background: #fff;
        }
        .msg-friend-item {
          display: flex;
          align-items: center;
          padding: 12px 14px;
          position: relative;
          cursor: pointer;
          transition: background 0.1s;
          gap: 12px;
        }
        .msg-friend-item:active {
          background: #ececec;
        }
        /* 分隔线 */
        .msg-friend-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 68px;
          right: 0;
          height: 0.5px;
          background: #e5e5e5;
        }
        .msg-friend-item:last-child::after {
          display: none;
        }

        /* 圆形头像 */
        .msg-friend-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #c9c9c9;
          flex-shrink: 0;
          background-size: cover;
          background-position: center;
        }

        /* 好友信息区 */
        .msg-friend-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .msg-friend-name {
          font-size: 16px;
          font-weight: 500;
          color: #111;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .msg-last-message {
          font-size: 13px;
          color: #999;
          line-height: 1.4;
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* 好友时间 */
        .msg-friend-time {
          font-size: 11px;
          color: #b0b0b0;
          flex-shrink: 0;
          align-self: flex-start;
          margin-top: 2px;
        }

        /* 未读红点 */
        .msg-unread-badge {
          position: absolute;
          top: 10px;
          left: 46px;
          min-width: 12px;
          height: 12px;
          background: #fa5151;
          color: #fff;
          font-size: 10px;
          font-weight: 600;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          z-index: 1;
          line-height: 1;
        }

        /* ========== 聊天视图 ========== */

        /* 聊天顶栏 */
        .msg-chat-header {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          background: #ededed;
          border-bottom: 0.5px solid #d9d9d9;
          flex-shrink: 0;
          gap: 8px;
        }
        .msg-chat-header [data-action="back"] {
          width: 32px;
          height: 32px;
          border: none;
          background: none;
          color: #111;
          font-size: 22px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          padding: 0;
          line-height: 1;
          font-weight: 300;
        }
        .msg-chat-header [data-action="back"]:active {
          background: rgba(0,0,0,0.06);
        }
        .msg-chat-title {
          font-size: 17px;
          font-weight: 600;
          color: #111;
          flex: 1;
          text-align: center;
          margin-right: 32px;
        }

        /* 消息列表 */
        .msg-message-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* 时间戳 */
        .msg-timestamp {
          text-align: center;
          font-size: 12px;
          color: #b0b0b0;
          padding: 4px 0;
          line-height: 1;
        }

        /* 消息气泡 */
        .msg-message-bubble {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          max-width: 70%;
          position: relative;
        }
        .msg-message-bubble.msg-sent {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .msg-message-bubble.msg-received {
          align-self: flex-start;
        }

        /* 气泡内容 */
        .msg-message-content {
          padding: 9px 13px;
          border-radius: 6px;
          font-size: 15px;
          line-height: 1.5;
          word-break: break-word;
          position: relative;
        }
        /* 发送方绿色气泡 */
        .msg-sent .msg-message-content {
          background: #95ec69;
          color: #000;
          border-top-right-radius: 2px;
        }
        /* 接收方白色气泡 */
        .msg-received .msg-message-content {
          background: #fff;
          color: #111;
          border-top-left-radius: 2px;
        }

        /* 输入区 */
        .msg-input-area {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          background: #f7f7f7;
          border-top: 0.5px solid #d9d9d9;
          gap: 8px;
          flex-shrink: 0;
        }
        .msg-input-area button {
          border: none;
          background: none;
          font-size: 24px;
          cursor: pointer;
          padding: 6px;
          flex-shrink: 0;
          line-height: 1;
          border-radius: 50%;
          transition: background 0.15s;
        }
        .msg-input-area button:active {
          background: rgba(0,0,0,0.1);
        }
        .msg-input-area input {
          flex: 1;
          height: 40px;
          border: none;
          border-radius: 6px;
          background: #fff;
          padding: 0 12px;
          font-size: 15px;
          outline: none;
          color: #111;
        }
        .msg-input-area input::placeholder {
          color: #b0b0b0;
        }
        .msg-input-area [data-action="send"] {
          background: #07C160;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .msg-input-area [data-action="send"]:active {
          background: #06ad56;
        }
        .msg-input-area [data-action="voice"] {
          font-size: 22px;
        }
        .msg-input-area [data-action="voice"].msg-recording {
          background: #fa5151;
          color: #fff;
        }
        .msg-input-area [data-action="emoji"] {
          font-size: 22px;
        }
        .msg-input-area [data-action="redpacket"] {
          font-size: 22px;
        }

        /* 语音录制提示 */
        .msg-voice-recording-hint {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.7);
          color: #fff;
          padding: 20px 30px;
          border-radius: 12px;
          font-size: 16px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .msg-voice-recording-hint .msg-voice-icon {
          font-size: 48px;
          animation: msg-voice-pulse 1s ease-in-out infinite;
        }
        @keyframes msg-voice-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        /* 表情面板 */
        .msg-emoji-panel {
          position: absolute;
          bottom: 60px;
          left: 10px;
          right: 10px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
          padding: 15px;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 100;
        }
        .msg-emoji-item {
          font-size: 24px;
          text-align: center;
          cursor: pointer;
          padding: 5px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .msg-emoji-item:hover {
          background: #f0f0f0;
        }

        /* 红包面板 */
        .msg-redpacket-panel {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
          padding: 20px;
          width: 280px;
          z-index: 100;
        }
        .msg-redpacket-panel-title {
          font-size: 16px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 15px;
          color: #111;
        }
        .msg-redpacket-panel input {
          width: 100%;
          height: 40px;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 0 12px;
          font-size: 14px;
          margin-bottom: 10px;
          box-sizing: border-box;
        }
        .msg-redpacket-panel input:focus {
          border-color: #07C160;
          outline: none;
        }
        .msg-redpacket-panel-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .msg-redpacket-panel-actions button {
          flex: 1;
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          border: none;
        }
        .msg-redpacket-panel-actions .msg-btn-send {
          background: #fa5151;
          color: #fff;
        }
        .msg-redpacket-panel-actions .msg-btn-send:active {
          background: #e04545;
        }
        .msg-redpacket-panel-actions .msg-btn-cancel {
          background: #f5f5f5;
          color: #111;
          border: 1px solid #ddd;
        }

        /* 红包消息气泡 */
        .msg-redpacket-bubble {
          background: linear-gradient(135deg, #fa9d3b 0%, #fa5151 100%);
          border-radius: 8px;
          padding: 12px 15px;
          min-width: 180px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
        }
        .msg-redpacket-bubble .msg-redpacket-icon {
          font-size: 32px;
        }
        .msg-redpacket-bubble .msg-redpacket-info {
          flex: 1;
        }
        .msg-redpacket-bubble .msg-redpacket-remark {
          font-size: 15px;
          font-weight: 500;
        }
        .msg-redpacket-bubble .msg-redpacket-status {
          font-size: 11px;
          opacity: 0.9;
          margin-top: 2px;
        }
        .msg-redpacket-bubble.msg-opened {
          background: linear-gradient(135deg, #c9c9c9 0%, #999 100%);
        }

        /* 语音消息 */
        .msg-voice-bubble {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 15px;
          background: #95ec69;
          border-radius: 6px;
          cursor: pointer;
          min-width: 80px;
        }
        .msg-voice-bubble.msg-received {
          background: #fff;
        }
        .msg-voice-bubble .msg-voice-wave {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .msg-voice-bubble .msg-voice-wave span {
          width: 3px;
          background: currentColor;
          border-radius: 2px;
          animation: msg-wave 1s ease-in-out infinite;
        }
        .msg-voice-bubble .msg-voice-wave span:nth-child(1) { height: 8px; animation-delay: 0s; }
        .msg-voice-bubble .msg-voice-wave span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
        .msg-voice-bubble .msg-voice-wave span:nth-child(3) { height: 10px; animation-delay: 0.2s; }
        @keyframes msg-wave {
          0%, 100% { transform: scaleY(0.6); }
          50% { transform: scaleY(1); }
        }
        .msg-voice-bubble .msg-voice-duration {
          font-size: 13px;
          color: #666;
        }

        /* ========== 朋友圈 ========== */

        /* 朋友圈顶栏 */
        .msg-moments-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: #ededed;
          border-bottom: 0.5px solid #d9d9d9;
          flex-shrink: 0;
          gap: 8px;
        }
        .msg-moments-tabs {
          display: flex;
          flex: 1;
          gap: 0;
        }
        .msg-fc-tab {
          flex: 1;
          padding: 6px 0;
          border: none;
          background: none;
          font-size: 14px;
          font-weight: 500;
          color: #888;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }
        .msg-fc-tab.msg-active {
          color: #07C160;
          font-weight: 600;
        }
        .msg-fc-tab.msg-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 2px;
          background: #07C160;
          border-radius: 1px;
        }
        .msg-publish-btn {
          width: 30px;
          height: 30px;
          border: none;
          background: none;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          padding: 0;
        }
        .msg-publish-btn:active {
          background: rgba(0,0,0,0.06);
        }
        .msg-moments-views {
          flex: 1;
          overflow: hidden;
        }
        .msg-moments-view {
          height: 100%;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* 朋友圈封面区域（自适应高度，不用固定 200px） */
        .msg-moments-cover {
          width: 100%;
          height: 0;
          padding-bottom: 42%;
          background: linear-gradient(180deg, #4a6741 0%, #3a5232 40%, #2d4228 100%);
          position: relative;
        }
        .msg-moments-cover-info {
          position: absolute;
          bottom: 12px;
          right: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .msg-moments-cover-name {
          font-size: 17px;
          font-weight: 600;
          color: #fff;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .msg-moments-cover-avatar {
          width: 64px;
          height: 64px;
          border-radius: 10px;
          background: #c9c9c9;
          border: 2px solid #fff;
          background-size: cover;
          background-position: center;
        }

        /* 朋友圈动态卡片 */
        .msg-fc-circle {
          background: #fff;
          padding: 12px 14px;
          border-bottom: 0.5px solid #e5e5e5;
        }
        .msg-fc-circle-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
        }
        .msg-fc-avatar {
          width: 42px;
          height: 42px;
          border-radius: 6px;
          background: #c9c9c9;
          flex-shrink: 0;
          background-size: cover;
          background-position: center;
        }
        .msg-fc-info {
          flex: 1;
          min-width: 0;
        }
        .msg-fc-author {
          font-size: 15px;
          font-weight: 600;
          color: #576b95;
          line-height: 1.3;
        }
        .msg-fc-time {
          font-size: 12px;
          color: #b2b2b2;
          margin-top: 2px;
        }
        .msg-fc-delete-btn {
          border: none;
          background: none;
          color: #576b95;
          font-size: 13px;
          cursor: pointer;
          padding: 2px 6px;
          flex-shrink: 0;
        }
        .msg-fc-delete-btn:active {
          opacity: 0.6;
        }
        .msg-fc-content {
          font-size: 15px;
          color: #333;
          line-height: 1.5;
          margin-bottom: 8px;
          padding-left: 52px;
          word-break: break-word;
        }
        .msg-fc-images {
          display: grid;
          gap: 4px;
          margin-bottom: 8px;
          padding-left: 52px;
        }
        .msg-fc-image {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 4px;
          background: #eee;
          background-size: cover;
          background-position: center;
        }

        /* 底部点赞/评论区域 */
        .msg-fc-footer {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 6px 10px;
          margin-left: 52px;
          background: #f7f7f7;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        .msg-fc-action-btn {
          border: none;
          background: none;
          font-size: 13px;
          color: #576b95;
          cursor: pointer;
          padding: 2px 4px;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .msg-fc-action-btn:active {
          opacity: 0.6;
        }
        .msg-fc-ai-btn {
          margin-left: auto;
        }

        /* 评论列表 */
        .msg-fc-comments {
          margin-left: 52px;
          background: #f7f7f7;
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 14px;
        }
        .msg-fc-comment {
          padding: 3px 0;
          line-height: 1.5;
          color: #333;
          position: relative;
        }
        .msg-fc-comment + .msg-fc-comment {
          border-top: 0.5px solid #e8e8e8;
          padding-top: 4px;
        }
        .msg-fc-comment-author {
          color: #576b95;
          font-weight: 500;
        }
        .msg-fc-comment-reply {
          color: #576b95;
          font-weight: 500;
        }
        .msg-fc-comment-delete {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: none;
          color: #999;
          font-size: 16px;
          cursor: pointer;
          padding: 2px 6px;
          line-height: 1;
        }
        .msg-fc-comment-delete:active {
          color: #666;
        }

        /* 朋友圈操作按钮区 */
        .msg-fc-actions {
          display: flex;
          gap: 10px;
          padding: 14px;
        }
        .msg-fc-actions button {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .msg-fc-actions button[data-action="publish"] {
          background: #07C160;
          color: #fff;
        }
        .msg-fc-actions button[data-action="publish"]:active {
          background: #06ad56;
        }
        .msg-fc-actions button[data-action="ai-publish"] {
          background: #fff;
          color: #07C160;
          border: 1px solid #07C160;
        }
        .msg-fc-actions button[data-action="ai-publish"]:active {
          background: #f0faf3;
        }

        /* 添加好友表单 */
        .msg-add-friend-form {
          background: #fff;
          margin: 8px 12px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }
        .msg-add-friend-form-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #111;
        }
        .msg-add-friend-form input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 6px;
          margin-bottom: 8px;
          box-sizing: border-box;
          font-size: 13px;
          outline: none;
          color: #111;
        }
        .msg-add-friend-form input:focus {
          border-color: #07C160;
        }
        .msg-add-friend-form-actions {
          display: flex;
          gap: 8px;
        }
        .msg-add-friend-form-actions button {
          flex: 1;
          padding: 8px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }
        .msg-add-friend-form-actions .msg-btn-confirm {
          background: #07C160;
          color: #fff;
          border: none;
        }
        .msg-add-friend-form-actions .msg-btn-confirm:active {
          background: #06ad56;
        }
        .msg-add-friend-form-actions .msg-btn-cancel {
          background: #f5f5f5;
          border: 1px solid #ddd;
          color: #111;
        }
        .msg-add-friend-form-actions .msg-btn-cancel:active {
          background: #e8e8e8;
        }

        /* 好友请求面板 */
        .msg-requests-panel {
          background: #fff;
          margin: 8px 12px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #ddd;
          max-height: 300px;
          overflow-y: auto;
        }
        .msg-requests-panel-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #111;
        }
        .msg-request-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .msg-request-item:last-child {
          border-bottom: none;
        }
        .msg-request-name {
          font-size: 13px;
          font-weight: bold;
          color: #111;
        }
        .msg-request-message {
          font-size: 11px;
          color: #888;
        }
        .msg-request-actions {
          display: flex;
          gap: 4px;
        }
        .msg-request-actions button {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        .msg-request-actions .msg-btn-accept {
          background: #07C160;
          color: #fff;
          border: none;
        }
        .msg-request-actions .msg-btn-accept:active {
          background: #06ad56;
        }
        .msg-request-actions .msg-btn-reject {
          background: #f5f5f5;
          border: 1px solid #ddd;
          color: #111;
        }
        .msg-request-actions .msg-btn-reject:active {
          background: #e8e8e8;
        }

        /* 空状态和错误 */
        .msg-empty {
          text-align: center;
          padding: 40px 20px;
          color: #bbb;
          font-size: 14px;
        }
        .msg-error {
          text-align: center;
          padding: 40px 20px;
          color: #fa5151;
          font-size: 14px;
        }

        /* ========== 通讯录视图（从 friend-module 移植） ========== */

        .msg-contacts-search-bar {
          padding: 8px 12px;
          background: #ededed;
          flex-shrink: 0;
        }
        .msg-contacts-search-bar input {
          width: 100%;
          height: 34px;
          border: none;
          border-radius: 8px;
          background: #fff;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          color: #111;
          box-sizing: border-box;
        }
        .msg-contacts-search-bar input::placeholder {
          color: #b0b0b0;
        }

        .msg-contacts-shortcuts {
          background: #fff;
        }
        .msg-contacts-shortcut-item {
          display: flex;
          align-items: center;
          padding: 12px 14px;
          position: relative;
          cursor: pointer;
          transition: background 0.1s;
          gap: 12px;
        }
        .msg-contacts-shortcut-item:active {
          background: #ececec;
        }
        .msg-contacts-shortcut-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 68px;
          right: 0;
          height: 0.5px;
          background: #e5e5e5;
        }
        .msg-contacts-shortcut-item:last-child::after {
          display: none;
        }
        .msg-contacts-shortcut-icon {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          background: #f0fff4;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
        }
        .msg-contacts-shortcut-name {
          font-size: 16px;
          font-weight: 400;
          color: #111;
        }

        .msg-contacts-section-title {
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #888;
          background: #ededed;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .msg-contacts-list {
          background: #fff;
        }
        .msg-contacts-item {
          display: flex;
          align-items: center;
          padding: 12px 14px;
          position: relative;
          cursor: pointer;
          transition: background 0.1s;
          gap: 12px;
        }
        .msg-contacts-item:active {
          background: #ececec;
        }
        .msg-contacts-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 68px;
          right: 0;
          height: 0.5px;
          background: #e5e5e5;
        }
        .msg-contacts-item:last-child::after {
          display: none;
        }
        .msg-contacts-avatar {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          background: #c9c9c9;
          flex-shrink: 0;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          overflow: hidden;
        }
        .msg-contacts-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 6px;
        }
        .msg-contacts-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .msg-contacts-name {
          font-size: 16px;
          font-weight: 400;
          color: #111;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .msg-contacts-signature {
          font-size: 12px;
          color: #999;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .msg-contacts-index-bar {
          position: absolute;
          right: 2px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 10;
          padding: 2px;
        }
        .msg-contacts-index-letter {
          font-size: 10px;
          color: #07C160;
          padding: 1px 4px;
          cursor: pointer;
          line-height: 1.2;
          font-weight: 500;
        }
        .msg-contacts-index-letter:active {
          color: #111;
          font-weight: 700;
        }

        /* ========== 聊天头像（可点击更换） ========== */
        .msg-chat-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #c9c9c9;
          background-size: cover;
          background-position: center;
          flex-shrink: 0;
          cursor: pointer;
        }
      `;
    }

    _onRenderComplete() {
      // 渲染完成后发送事件，让 PhoneShell 知道渲染已完成
      if (this._container) {
        this._container.setAttribute('data-module-rendered', 'true');
        this._container.dispatchEvent(new CustomEvent('module:rendered', {
          bubbles: true,
          detail: { moduleId: this.id }
        }));
      }
    }

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // ---- 返回主界面 ----
          if (e.target.closest('[data-action="go-home"]')) {
            this._goHome();
            return;
          }

          // ---- 顶部 Tab 切换 ----
          const tabBtn = e.target.closest('[data-tab]');
          if (tabBtn) {
            await this._switchTab(tabBtn.dataset.tab);
            return;
          }

          // ---- 朋友圈内部 Tab 切换 ----
          const fcTabBtn = e.target.closest('[data-fc-tab]');
          if (fcTabBtn) {
            await this._switchFcTab(fcTabBtn.dataset.fcTab);
            return;
          }

          // ---- 消息列表：点击好友 ----
          const friendEl = e.target.closest('[data-friend-id]');
          if (friendEl) {
            await this._openChat(friendEl.dataset.friendId);
            return;
          }

          // ---- 聊天视图：更换头像 ----
          if (e.target.closest('[data-action="change-avatar"]')) {
            this._handleChangeAvatar();
            return;
          }

          // ---- 聊天视图：返回 ----
          if (e.target.closest('[data-action="back"]')) {
            this._backFromChat();
            return;
          }

          // ---- 聊天视图：发送消息 ----
          if (e.target.closest('[data-action="send"]')) {
            await this._handleSend();
            return;
          }

          // ---- 聊天视图：语音 ----
          if (e.target.closest('[data-action="voice"]')) {
            // 语音按钮在 mousedown/touchstart 时开始录音，在 mouseup/touchend 时结束
            return;
          }

          // ---- 聊天视图：表情 ----
          if (e.target.closest('[data-action="emoji"]')) {
            await this._handleEmojiPanel();
            return;
          }

          // ---- 聊天视图：更多输入（语音/红包等） ----
          if (e.target.closest('[data-action="more-input"]')) {
            await this._handleMoreInputPanel();
            return;
          }

          // ---- 聊天视图：发送语音 ----
          if (e.target.closest('[data-action="send-voice"]')) {
            await this._handleSendVoice();
            return;
          }

          // ---- 聊天视图：选择表情 ----
          const emojiEl = e.target.closest('[data-emoji]');
          if (emojiEl) {
            await this._handleEmojiSelect(emojiEl.dataset.emoji);
            return;
          }

          // ---- 聊天视图：红包 ----
          if (e.target.closest('[data-action="redpacket"]')) {
            await this._handleRedpacketPanel();
            return;
          }

          // ---- 聊天视图：打开红包 ----
          if (e.target.closest('[data-action="open-redpacket"]')) {
            const redpacketEl = e.target.closest('[data-redpacket-id]');
            if (redpacketEl) {
              await this._handleOpenRedpacket(redpacketEl.dataset.redpacketId);
            }
            return;
          }

          // ---- 聊天视图：播放语音 ----
          if (e.target.closest('[data-action="play-voice"]')) {
            const voiceEl = e.target.closest('[data-voice-id]');
            if (voiceEl) {
              await this._handlePlayVoice(voiceEl.dataset.voiceId);
            }
            return;
          }

          // ---- 聊天视图：更多操作菜单 ----
          if (e.target.closest('[data-action="more-options"]')) {
            await this._handleMoreOptions();
            return;
          }

          // ---- 聊天视图：删除好友 ----
          if (e.target.closest('[data-action="delete-friend"]')) {
            await this._handleDeleteFriend();
            return;
          }

          // ---- 聊天视图：清空聊天记录 ----
          if (e.target.closest('[data-action="clear-chat"]')) {
            await this._handleClearChat();
            return;
          }

          // ---- 聊天视图：退出群聊 ----
          if (e.target.closest('[data-action="leave-group"]')) {
            await this._handleLeaveGroup();
            return;
          }

          // ---- 朋友圈：发布 ----
          if (e.target.closest('[data-action="publish"]')) {
            await this._handlePublish();
            return;
          }

          // ---- 朋友圈：AI 发布 ----
          if (e.target.closest('[data-action="ai-publish"]')) {
            await this._handleAIPublish();
            return;
          }

          // ---- 朋友圈：点赞 ----
          const likeBtn = e.target.closest('[data-action="like"]');
          if (likeBtn) {
            await this._handleLike(likeBtn.dataset.circleId);
            return;
          }

          // ---- 朋友圈：评论 ----
          const commentBtn = e.target.closest('[data-action="comment"]');
          if (commentBtn) {
            await this._handleComment(commentBtn.dataset.circleId);
            return;
          }

          // ---- 朋友圈：AI 评论 ----
          const aiCommentBtn = e.target.closest('[data-action="ai-comment"]');
          if (aiCommentBtn) {
            await this._handleAIComment(aiCommentBtn.dataset.circleId);
            return;
          }

          // ---- 朋友圈：删除 ----
          const deleteBtn = e.target.closest('[data-action="delete"]');
          if (deleteBtn) {
            await this._handleDelete(deleteBtn.dataset.circleId);
            return;
          }

          // ---- 朋友圈：删除评论 ----
          const deleteCommentBtn = e.target.closest('[data-action="delete-comment"]');
          if (deleteCommentBtn) {
            await this._handleDeleteComment(deleteCommentBtn.dataset.circleId, deleteCommentBtn.dataset.commentId);
            return;
          }

          // ---- 好友管理：添加好友 ----
          if (e.target.closest('[data-action="add-friend"]')) {
            await this._handleAddFriend();
            return;
          }

          // ---- 好友管理：好友请求列表 ----
          if (e.target.closest('[data-action="friend-requests"]')) {
            await this._handleFriendRequests();
            return;
          }

          // ---- 好友管理：创建群聊 ----
          if (e.target.closest('[data-action="create-group"]')) {
            await this._handleCreateGroup();
            return;
          }

          // ---- 好友管理：接受请求 ----
          const acceptBtn = e.target.closest('[data-action="accept-request"]');
          if (acceptBtn) {
            await this._handleAcceptRequest(acceptBtn.dataset.requestId);
            return;
          }

          // ---- 好友管理：拒绝请求 ----
          const rejectBtn = e.target.closest('[data-action="reject-request"]');
          if (rejectBtn) {
            await this._handleRejectRequest(rejectBtn.dataset.requestId);
            return;
          }
        });

        this._container.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter' && e.target.matches('[data-ref="message-input"]')) {
            await this._handleSend();
          }
        });

        // 语音录制事件（mousedown/touchstart 开始，mouseup/touchend 结束）
        this._setupVoiceRecording();

        // DOM 就绪后：订阅数据 + 初始渲染
        this._subscribeData();
        this._renderFriendList();
      }, 0);
    }

    _setupVoiceRecording() {
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      if (!chatView) return;

      let isRecording = false;
      let recordingHint = null;

      const startRecording = async (e) => {
        if (isRecording) return;
        const voiceBtn = e.target.closest('[data-action="voice"]');
        if (!voiceBtn) return;

        e.preventDefault();
        isRecording = true;
        voiceBtn.classList.add('msg-recording');

        // 显示录制提示
        recordingHint = document.createElement('div');
        recordingHint.className = 'msg-voice-recording-hint';
        recordingHint.innerHTML = '<span class="msg-voice-icon">🎤</span><span>手指上滑，取消发送</span>';
        document.body.appendChild(recordingHint);
      };

      const endRecording = async (e) => {
        if (!isRecording) return;
        const voiceBtn = this._container?.querySelector('[data-action="voice"]');
        if (voiceBtn) voiceBtn.classList.remove('msg-recording');

        // 移除录制提示
        if (recordingHint) {
          recordingHint.remove();
          recordingHint = null;
        }

        // 检查是否取消（手指移出按钮区域）
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const btnRect = voiceBtn?.getBoundingClientRect();
        let canceled = false;
        if (btnRect && touch) {
          canceled = touch.clientX < btnRect.left || touch.clientX > btnRect.right ||
                     touch.clientY < btnRect.top || touch.clientY > btnRect.bottom;
        }

        isRecording = false;

        if (!canceled && this._currentFriendId) {
          // 发送语音消息（模拟 1-5 秒随机时长）
          const duration = Math.floor(Math.random() * 5) + 1;
          try {
            await this._msgService.sendVoice(this._currentFriendId, duration);
            const messages = await this._msgService.getMessages(this._currentFriendId);
            const friend = await this._msgService.getFriend(this._currentFriendId);
            const msgList = this._container?.querySelector('[data-ref="message-list"]');
            if (msgList) {
              this._renderMessages(msgList, messages, friend);
              this._scrollToBottom();
            }

            // 触发 AI 回复
            setTimeout(async () => {
              try {
                await this._msgService.sendAIReply(this._currentFriendId);
                const updatedMessages = await this._msgService.getMessages(this._currentFriendId);
                const updatedMsgList = this._container?.querySelector('[data-ref="message-list"]');
                if (updatedMsgList) {
                  this._renderMessages(updatedMsgList, updatedMessages, friend);
                  this._scrollToBottom();
                }
              } catch (aiErr) {
                console.warn('[MessageModule] AI 回复失败:', aiErr);
              }
            }, 1000 + Math.random() * 2000);
          } catch (err) {
            this.showToast('发送语音失败: ' + err.message, 'error');
          }
        }
      };

      chatView.addEventListener('mousedown', startRecording);
      chatView.addEventListener('touchstart', startRecording, { passive: false });

      chatView.addEventListener('mouseup', endRecording);
      chatView.addEventListener('touchend', endRecording);
      chatView.addEventListener('mouseleave', endRecording);
    }

    // ==================== 顶部 Tab 切换 ====================

    _goHome() {
      // 返回小手机主界面（桌面）
      try {
        const shell = window.__phoneShell;
        if (shell?.phone?.goHome) {
          shell.phone.goHome();
        } else if (shell?.phone?.goBack) {
          shell.phone.goBack();
        } else {
          // 降级：不做任何操作，避免白屏
          console.warn('[MessageModule] goHome 不可用');
        }
      } catch (err) {
        console.warn('[MessageModule] 返回主界面失败:', err);
      }
    }

    async _switchTab(tab) {
      this._currentView = tab;

      this._container.querySelectorAll('[data-tab]').forEach(btn => {
        btn.classList.toggle('msg-active', btn.dataset.tab === tab);
      });

      this._container.querySelectorAll('.msg-view').forEach(view => {
        view.style.display = view.dataset.view === tab ? 'block' : 'none';
      });

      if (tab === 'CHAT_LIST') {
        await this._renderFriendList();
      } else if (tab === 'MOMENTS') {
        await this._renderMoments();
      }
    }

    // ==================== 朋友圈内部 Tab 切换 ====================

    async _switchFcTab(tab) {
      this._fcCurrentView = tab;

      this._container.querySelectorAll('[data-fc-tab]').forEach(btn => {
        btn.classList.toggle('msg-active', btn.dataset.fcTab === tab);
      });

      this._container.querySelectorAll('[data-fc-view]').forEach(view => {
        view.style.display = view.dataset.fcView === tab ? 'block' : 'none';
      });

      if (tab === 'FEED') {
        await this._renderFeed();
      } else if (tab === 'MY') {
        await this._renderMyCircles();
      }
    }

    // ==================== 消息列表视图（会话列表）====================

    async _renderFriendList() {
      const container = this._container?.querySelector('[data-view="CHAT_LIST"]');
      if (!container) return;

      try {
        // 先移除可能存在的覆盖面板（群聊选择面板等）
        const overlayPanel = this._container?.querySelector('.msg-group-select-panel');
        if (overlayPanel) overlayPanel.remove();

        const friends = await this._msgService.getFriendList();
        container.innerHTML = '';

        // 顶部操作栏：添加好友 + 好友请求
        const actionBar = document.createElement('div');
        actionBar.className = 'msg-action-bar';
        actionBar.style.cssText = 'display:flex;gap:8px;padding:8px 12px;background:#f7f7f7;';

        const addBtn = document.createElement('button');
        addBtn.className = 'msg-btn-add-friend';
        addBtn.dataset.action = 'add-friend';
        addBtn.textContent = '➕ 添加好友';
        addBtn.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;';

        const reqBtn = document.createElement('button');
        reqBtn.className = 'msg-btn-friend-req';
        reqBtn.dataset.action = 'friend-requests';
        reqBtn.textContent = '📋 好友请求';
        reqBtn.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;';

        const groupBtn = document.createElement('button');
        groupBtn.className = 'msg-btn-create-group';
        groupBtn.dataset.action = 'create-group';
        groupBtn.textContent = '👥 创建群聊';
        groupBtn.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;';

        actionBar.appendChild(addBtn);
        actionBar.appendChild(reqBtn);
        actionBar.appendChild(groupBtn);
        container.appendChild(actionBar);

        if (!friends || friends.length === 0) {
          container.innerHTML += '<div class="msg-empty">暂无好友，点击上方添加</div>';
          return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'msg-friend-list';

        friends.forEach(friend => {
          const item = document.createElement('div');
          item.className = 'msg-friend-item';
          item.dataset.friendId = friend.id;

          // 头像
          const avatar = document.createElement('div');
          avatar.className = 'msg-friend-avatar';
          if (friend.avatar) {
            avatar.style.backgroundImage = 'url(' + friend.avatar + ')';
          } else {
            avatar.textContent = friend.name ? friend.name.charAt(0) : '?';
            avatar.style.display = 'flex';
            avatar.style.alignItems = 'center';
            avatar.style.justifyContent = 'center';
            avatar.style.color = '#fff';
            avatar.style.fontSize = '16px';
            avatar.style.fontWeight = '600';
            avatar.style.background = '#07C160';
          }

          // 信息区
          const info = document.createElement('div');
          info.className = 'msg-friend-info';

          const name = document.createElement('div');
          name.className = 'msg-friend-name';
          name.textContent = friend.name;

          const lastMsg = document.createElement('div');
          lastMsg.className = 'msg-last-message';
          lastMsg.textContent = friend.lastMessage || '暂无消息';

          info.appendChild(name);
          info.appendChild(lastMsg);

          // 时间和未读
          const meta = document.createElement('div');
          meta.className = 'msg-friend-meta';
          meta.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:4px;';

          const time = document.createElement('span');
          time.className = 'msg-friend-time';
          time.textContent = friend.lastMessageTime || '';

          meta.appendChild(time);

          if (friend.unread > 0) {
            const badge = document.createElement('span');
            badge.className = 'msg-unread-badge';
            badge.textContent = friend.unread;
            meta.appendChild(badge);
          }

          item.appendChild(avatar);
          item.appendChild(info);
          item.appendChild(meta);

          listEl.appendChild(item);
        });

        container.appendChild(listEl);
      } catch (e) {
        console.warn('[MessageModule] 渲染好友列表失败:', e);
        container.innerHTML = '<div class="msg-error">加载失败，请重试</div>';
      }
    }

    // ==================== 聊天视图 ====================

    async _openChat(friendId) {
      this._currentFriendId = friendId;
      this._currentView = 'CHAT';

      const friend = await this._msgService.getFriend(friendId);
      const messages = await this._msgService.getMessages(friendId);

      const listView = this._container?.querySelector('[data-view="CHAT_LIST"]');
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      const momentsView = this._container?.querySelector('[data-view="MOMENTS"]');
      const tabsBar = this._container?.querySelector('.msg-tabs');
      if (!listView || !chatView) return;

      // 隐藏其他视图和 Tab 栏，聊天视图全屏覆盖（像真实微信）
      listView.style.display = 'none';
      if (momentsView) momentsView.style.display = 'none';
      if (tabsBar) tabsBar.style.display = 'none';
      
      // 全屏覆盖式聊天视图
      chatView.style.display = 'flex';
      chatView.style.flexDirection = 'column';
      chatView.style.height = '100%';
      chatView.style.position = 'absolute';
      chatView.style.top = '0';
      chatView.style.left = '0';
      chatView.style.right = '0';
      chatView.style.bottom = '0';
      chatView.style.zIndex = '10';
      chatView.style.background = '#ededed';
      chatView.innerHTML = '';

      // 顶部栏
      const header = document.createElement('div');
      header.className = 'msg-chat-header';
      const backBtn = document.createElement('button');
      backBtn.dataset.action = 'back';
      backBtn.textContent = '←';
      const avatar = document.createElement('div');
      avatar.className = 'msg-chat-avatar';
      if (friend?.avatar) {
        avatar.style.backgroundImage = 'url(' + friend.avatar + ')';
      } else {
        avatar.textContent = friend?.name ? friend.name.charAt(0) : '?';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.style.color = '#fff';
        avatar.style.fontSize = '14px';
        avatar.style.fontWeight = '600';
        avatar.style.background = '#07C160';
      }
      avatar.dataset.action = 'change-avatar';
      const title = document.createElement('span');
      title.className = 'msg-chat-title';
      title.textContent = friend ? friend.name : friendId;
      
      // 更多操作按钮
      const moreBtn = document.createElement('button');
      moreBtn.dataset.action = 'more-options';
      moreBtn.textContent = '⋯';
      moreBtn.style.cssText = 'width:32px;height:32px;border:none;background:none;color:#111;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:50%;padding:0;line-height:1;font-weight:bold;';
      
      header.appendChild(backBtn);
      header.appendChild(avatar);
      header.appendChild(title);
      header.appendChild(moreBtn);
      chatView.appendChild(header);

      // 消息列表（flex:1 自动填充剩余空间，可滚动）
      const msgList = document.createElement('div');
      msgList.className = 'msg-message-list';
      msgList.dataset.ref = 'message-list';
      msgList.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      this._renderMessages(msgList, messages, friend);
      chatView.appendChild(msgList);

      // 输入区（微信风格：输入框 + 表情 + 加号/发送）
      const inputArea = document.createElement('div');
      inputArea.className = 'msg-input-area';
      inputArea.style.cssText = 'display:flex;align-items:center;padding:8px 10px;background:#f7f7f7;border-top:0.5px solid #d9d9d9;flex-shrink:0;gap:6px;';
      inputArea.innerHTML = `
        <input type="text" data-ref="message-input" placeholder="输入消息..." style="flex:1;min-width:0;height:36px;border:none;border-radius:4px;background:#fff;padding:0 10px;font-size:15px;outline:none;">
        <button data-action="emoji" title="表情" style="width:36px;height:36px;border:none;background:none;font-size:22px;cursor:pointer;padding:0;">😊</button>
        <button data-action="more-input" data-ref="send-toggle-btn" title="更多" style="width:36px;height:36px;border:none;background:#07C160;color:#fff;border-radius:4px;font-size:20px;cursor:pointer;padding:0;font-weight:bold;">+</button>
      `;
      chatView.appendChild(inputArea);

      // 监听输入框内容变化：有内容时 + 变为 发送，无内容时恢复 +
      const msgInput = inputArea.querySelector('[data-ref="message-input"]');
      const toggleBtn = inputArea.querySelector('[data-ref="send-toggle-btn"]');
      const onInputChange = () => {
        if (msgInput.value.trim()) {
          toggleBtn.textContent = '发送';
          toggleBtn.dataset.action = 'send';
          toggleBtn.title = '发送';
        } else {
          toggleBtn.textContent = '+';
          toggleBtn.dataset.action = 'more-input';
          toggleBtn.title = '更多';
        }
      };
      msgInput.addEventListener('input', onInputChange);
      msgInput.addEventListener('change', onInputChange);

      // 清空未读
      try { 
        await this._msgService.clearUnread(friendId); 
        // [修复] 清空未读后立即刷新好友列表，移除红点
        const friends = await this._msgService.getFriends();
        const listContainer = this._container?.querySelector('[data-ref="friends-list"]');
        if (listContainer) {
          this._renderFriendsList(listContainer, friends);
        }
      } catch (e) {}

      this._scrollToBottom();
    }

    _renderMessages(container, messages, friend) {
      if (!container) return;
      container.innerHTML = '';

      if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="msg-empty" style="padding:40px 20px;color:#bbb;">暂无消息，开始聊天吧</div>';
        return;
      }

      let lastDate = null;

      messages.forEach(msg => {
        // 时间分隔线（按天）
        const msgDate = msg.timestamp ? new Date(msg.timestamp).toDateString() : null;
        if (msgDate && msgDate !== lastDate) {
          const timeEl = document.createElement('div');
          timeEl.className = 'msg-timestamp';
          timeEl.textContent = this._formatMessageTime(msg.timestamp);
          container.appendChild(timeEl);
          lastDate = msgDate;
        }

        const isMe = msg.senderId === 'me';
        const msgEl = document.createElement('div');
        msgEl.className = 'msg-message-bubble ' + (isMe ? 'msg-sent' : 'msg-received');
        msgEl.dataset.messageId = msg.id;

        // 头像
        const avatar = document.createElement('div');
        avatar.className = 'msg-chat-avatar';
        avatar.style.width = '36px';
        avatar.style.height = '36px';
        if (isMe) {
          // 自己的头像（使用默认或从 service 获取）
          avatar.style.background = '#07C160';
          avatar.textContent = '我';
          avatar.style.display = 'flex';
          avatar.style.alignItems = 'center';
          avatar.style.justifyContent = 'center';
          avatar.style.color = '#fff';
          avatar.style.fontSize = '12px';
        } else {
          // 对方头像
          if (friend?.avatar) {
            avatar.style.backgroundImage = 'url(' + friend.avatar + ')';
          } else {
            avatar.style.background = '#c9c9c9';
            avatar.textContent = friend?.name ? friend.name.charAt(0) : '?';
            avatar.style.display = 'flex';
            avatar.style.alignItems = 'center';
            avatar.style.justifyContent = 'center';
            avatar.style.color = '#fff';
            avatar.style.fontSize = '14px';
          }
        }

        // 消息内容
        const content = document.createElement('div');
        content.className = 'msg-message-content';

        switch (msg.type) {
          case 'text':
            content.textContent = msg.content || '';
            break;
          case 'voice': {
            // 语音气泡（波形 + 时长），文字在下方显示
            const voiceBubble = document.createElement('div');
            voiceBubble.className = 'msg-voice-bubble ' + (isMe ? '' : 'msg-received');
            voiceBubble.dataset.action = 'play-voice';
            voiceBubble.dataset.voiceId = msg.id;
            voiceBubble.innerHTML = this._renderVoiceBubble(msg, isMe);

            content.appendChild(voiceBubble);

            // 如果有文字内容，在气泡下方显示
            const voiceText = msg.text || msg.content || '';
            if (voiceText) {
              const textLabel = document.createElement('div');
              textLabel.className = 'msg-voice-text-label';
              textLabel.style.cssText = 'font-size:12px;color:#999;margin-top:2px;max-width:200px;word-break:break-all;cursor:pointer;';
              textLabel.textContent = voiceText;
              content.appendChild(textLabel);
            }
            content.className = '';
            break;
          }
          case 'redpacket':
            content.innerHTML = this._renderRedpacketBubble(msg);
            content.className = 'msg-redpacket-bubble';
            content.dataset.action = 'open-redpacket';
            content.dataset.redpacketId = msg.id;
            if (msg.opened) {
              content.classList.add('msg-opened');
            }
            break;
          case 'transfer':
            content.textContent = '💰 转账 ' + (msg.amount || 0) + '元';
            break;
          case 'sticker':
          case 'emoji':
            content.innerHTML = '<span style="font-size:32px;">' + (msg.content || '😊') + '</span>';
            content.style.background = 'transparent';
            content.style.padding = '5px';
            break;
          default:
            content.textContent = msg.content || '[未知消息]';
        }

        msgEl.appendChild(avatar);
        msgEl.appendChild(content);
        container.appendChild(msgEl);
      });
    }

    _formatMessageTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();

      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const timeStr = hours + ':' + minutes;

      if (isToday) return timeStr;
      if (isYesterday) return '昨天 ' + timeStr;
      return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + timeStr;
    }

    _renderVoiceBubble(msg, isMe) {
      const duration = msg.duration || 1;
      const width = Math.min(200, 60 + duration * 10);
      return `
        <div class="msg-voice-wave" style="width:${width}px;justify-content:${isMe ? 'flex-end' : 'flex-start'};">
          ${isMe ? '' : '<span></span><span></span><span></span>'}
          <span style="font-size:16px;">🎤</span>
          ${isMe ? '<span></span><span></span><span></span>' : ''}
        </div>
        <span class="msg-voice-duration">${duration}"</span>
      `;
    }

    _renderRedpacketBubble(msg) {
      const opened = msg.opened ? 'msg-opened' : '';
      const status = msg.opened ? '已领取' : '领取红包';
      return `
        <span class="msg-redpacket-icon">🧧</span>
        <div class="msg-redpacket-info">
          <div class="msg-redpacket-remark">${this._escapeHtml(msg.remark || '恭喜发财，大吉大利')}</div>
          <div class="msg-redpacket-status">${status}</div>
        </div>
      `;
    }

    _backFromChat() {
      this._currentView = 'CHAT_LIST';
      this._currentFriendId = null;

      const listView = this._container?.querySelector('[data-view="CHAT_LIST"]');
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      const momentsView = this._container?.querySelector('[data-view="MOMENTS"]');
      const tabsBar = this._container?.querySelector('.msg-tabs');

      // 显示消息列表和 Tab 栏，隐藏聊天视图
      if (listView) listView.style.display = 'block';
      if (chatView) {
        chatView.style.display = 'none';
        chatView.style.position = '';
        chatView.style.top = '';
        chatView.style.left = '';
        chatView.style.right = '';
        chatView.style.bottom = '';
        chatView.style.zIndex = '';
        chatView.innerHTML = '';
      }
      if (momentsView) momentsView.style.display = 'none';
      if (tabsBar) tabsBar.style.display = 'flex';

      // 更新 Tab 状态
      this._container?.querySelectorAll('[data-tab]').forEach(btn => {
        btn.classList.toggle('msg-active', btn.dataset.tab === 'CHAT_LIST');
      });

      this._renderFriendList();
    }

    async _handleSend() {
      const input = this._container?.querySelector('[data-ref="message-input"]');
      const content = input?.value?.trim();

      if (!content || !this._currentFriendId) return;

      try {
        await this._msgService.sendText(this._currentFriendId, content);
        input.value = '';

        // 重置按钮：发送后 + 恢复为加号
        const toggleBtn = this._container?.querySelector('[data-ref="send-toggle-btn"]');
        if (toggleBtn) {
          toggleBtn.textContent = '+';
          toggleBtn.dataset.action = 'more-input';
          toggleBtn.title = '更多';
        }

        // 重新渲染消息列表
        const messages = await this._msgService.getMessages(this._currentFriendId);
        const friend = await this._msgService.getFriend(this._currentFriendId);
        const msgList = this._container?.querySelector('[data-ref="message-list"]');
        if (msgList) {
          this._renderMessages(msgList, messages, friend);
          this._scrollToBottom();
        }

        // 触发 AI 回复（延迟 1-3 秒，模拟真实回复时间）
        setTimeout(async () => {
          try {
            await this._msgService.sendAIReply(this._currentFriendId);
            // AI 回复后重新渲染
            const updatedMessages = await this._msgService.getMessages(this._currentFriendId);
            const updatedMsgList = this._container?.querySelector('[data-ref="message-list"]');
            if (updatedMsgList) {
              this._renderMessages(updatedMsgList, updatedMessages, friend);
              this._scrollToBottom();
            }
          } catch (aiErr) {
            console.warn('[MessageModule] AI 回复失败:', aiErr);
          }
        }, 1000 + Math.random() * 2000);

      } catch (err) {
        this.showToast('发送失败: ' + err.message, 'error');
      }
    }

    // ==================== 表情功能 ====================

    async _handleMoreInputPanel() {
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      if (!chatView) return;

      // 检查是否已有面板
      let panel = chatView.querySelector('.msg-more-input-panel');
      if (panel) {
        panel.remove();
        return;
      }

      // 移除表情面板（如果存在）
      const emojiPanel = chatView.querySelector('.msg-emoji-panel');
      if (emojiPanel) emojiPanel.remove();

      // 创建更多输入面板（微信风格：语音、红包）
      panel = document.createElement('div');
      panel.className = 'msg-more-input-panel';
      panel.style.cssText = 'position:absolute;bottom:52px;left:10px;right:10px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);padding:12px;display:flex;gap:12px;justify-content:center;z-index:100;';
      
      panel.innerHTML = `
        <div style="text-align:center;cursor:pointer;" data-action="send-voice">
          <div style="width:50px;height:50px;background:#07C160;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;">🎤</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">语音</div>
        </div>
        <div style="text-align:center;cursor:pointer;" data-action="redpacket">
          <div style="width:50px;height:50px;background:#fa9d3b;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;">🧧</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">红包</div>
        </div>
      `;

      chatView.appendChild(panel);

      // 点击外部关闭面板
      setTimeout(() => {
        const closePanel = (e) => {
          if (!e.target.closest('.msg-more-input-panel') && !e.target.closest('[data-action="more-input"]')) {
            panel.remove();
            document.removeEventListener('click', closePanel);
          }
        };
        document.addEventListener('click', closePanel);
      }, 100);
    }

    async _handleSendVoice() {
      if (!this._currentFriendId) return;

      // 关闭更多输入面板
      const panel = this._container?.querySelector('.msg-more-input-panel');
      if (panel) panel.remove();

      // 弹出输入框让用户输入语音内容
      const voiceText = await this.showPrompt({
        message: '请输入语音内容（将渲染为语音气泡）：',
        placeholder: '输入语音转文字内容...'
      });

      if (!voiceText?.trim()) return;

      try {
        // 发送语音消息（带文字内容）
        const duration = Math.ceil(voiceText.trim().length / 5); // 根据文字长度估算时长
        await this._msgService.sendVoiceWithText(this._currentFriendId, voiceText.trim(), Math.max(1, Math.min(duration, 60)));
        
        // 重新渲染消息列表
        const messages = await this._msgService.getMessages(this._currentFriendId);
        const friend = await this._msgService.getFriend(this._currentFriendId);
        const msgList = this._container?.querySelector('[data-ref="message-list"]');
        if (msgList) {
          this._renderMessages(msgList, messages, friend);
          this._scrollToBottom();
        }

        // 触发 AI 回复
        setTimeout(async () => {
          try {
            await this._msgService.sendAIReply(this._currentFriendId);
            const updatedMessages = await this._msgService.getMessages(this._currentFriendId);
            const updatedMsgList = this._container?.querySelector('[data-ref="message-list"]');
            if (updatedMsgList) {
              this._renderMessages(updatedMsgList, updatedMessages, friend);
              this._scrollToBottom();
            }
          } catch (aiErr) {
            console.warn('[MessageModule] AI 回复失败:', aiErr);
          }
        }, 1000 + Math.random() * 2000);

      } catch (err) {
        this.showToast('发送语音失败: ' + err.message, 'error');
      }
    }

    async _handleEmojiPanel() {
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      if (!chatView) return;

      // 检查是否已有表情面板
      let panel = chatView.querySelector('.msg-emoji-panel');
      if (panel) {
        panel.remove();
        return;
      }

      // 移除红包面板（如果存在）
      const redpacketPanel = chatView.querySelector('.msg-redpacket-panel');
      if (redpacketPanel) redpacketPanel.remove();

      // 创建表情面板
      panel = document.createElement('div');
      panel.className = 'msg-emoji-panel';

      const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
        '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳',
        '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
        '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫',
        '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '💪', '🎉', '🔥', '❤️', '💔', '💯', '✅', '❌', '⭐'];

      emojis.forEach(emoji => {
        const item = document.createElement('span');
        item.className = 'msg-emoji-item';
        item.dataset.emoji = emoji;
        item.textContent = emoji;
        panel.appendChild(item);
      });

      chatView.appendChild(panel);

      // 点击外部关闭面板
      setTimeout(() => {
        const closePanel = (e) => {
          if (!e.target.closest('.msg-emoji-panel') && !e.target.closest('[data-action="emoji"]')) {
            panel.remove();
            document.removeEventListener('click', closePanel);
          }
        };
        document.addEventListener('click', closePanel);
      }, 100);
    }

    async _handleEmojiSelect(emoji) {
      if (!this._currentFriendId || !emoji) return;

      try {
        await this._msgService.sendSticker(this._currentFriendId, emoji);

        // 关闭表情面板
        const panel = this._container?.querySelector('.msg-emoji-panel');
        if (panel) panel.remove();

        // 重新渲染消息列表
        const messages = await this._msgService.getMessages(this._currentFriendId);
        const friend = await this._msgService.getFriend(this._currentFriendId);
        const msgList = this._container?.querySelector('[data-ref="message-list"]');
        if (msgList) {
          this._renderMessages(msgList, messages, friend);
          this._scrollToBottom();
        }

        // 触发 AI 回复
        setTimeout(async () => {
          try {
            await this._msgService.sendAIReply(this._currentFriendId);
            const updatedMessages = await this._msgService.getMessages(this._currentFriendId);
            const updatedMsgList = this._container?.querySelector('[data-ref="message-list"]');
            if (updatedMsgList) {
              this._renderMessages(updatedMsgList, updatedMessages, friend);
              this._scrollToBottom();
            }
          } catch (aiErr) {
            console.warn('[MessageModule] AI 回复失败:', aiErr);
          }
        }, 1000 + Math.random() * 2000);
      } catch (err) {
        this.showToast('发送表情失败: ' + err.message, 'error');
      }
    }

    // ==================== 红包功能 ====================

    async _handleRedpacketPanel() {
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      if (!chatView) return;

      // 检查是否已有红包面板
      let panel = chatView.querySelector('.msg-redpacket-panel');
      if (panel) {
        panel.remove();
        return;
      }

      // 移除表情面板（如果存在）
      const emojiPanel = chatView.querySelector('.msg-emoji-panel');
      if (emojiPanel) emojiPanel.remove();

      // 创建红包面板
      panel = document.createElement('div');
      panel.className = 'msg-redpacket-panel';
      panel.innerHTML = `
        <div class="msg-redpacket-panel-title">🧧 发红包</div>
        <input type="number" data-ref="redpacket-amount" placeholder="金额（元）" min="0.01" step="0.01">
        <input type="text" data-ref="redpacket-remark" placeholder="祝福语（默认：恭喜发财，大吉大利）" maxlength="20">
        <div class="msg-redpacket-panel-actions">
          <button class="msg-btn-send" data-action="send-redpacket">发送红包</button>
          <button class="msg-btn-cancel" data-action="cancel-redpacket">取消</button>
        </div>
      `;

      // 绑定面板内事件
      panel.addEventListener('click', async (e) => {
        if (e.target.closest('[data-action="cancel-redpacket"]')) {
          panel.remove();
          return;
        }

        if (e.target.closest('[data-action="send-redpacket"]')) {
          const amountInput = panel.querySelector('[data-ref="redpacket-amount"]');
          const remarkInput = panel.querySelector('[data-ref="redpacket-remark"]');
          const amount = parseFloat(amountInput?.value);
          const remark = remarkInput?.value?.trim() || '恭喜发财，大吉大利';

          if (!amount || amount <= 0) {
            this.showToast('请输入有效的金额', 'error');
            return;
          }

          try {
            await this._msgService.sendRedpacket(this._currentFriendId, amount, remark);
            panel.remove();

            // 重新渲染消息列表
            const messages = await this._msgService.getMessages(this._currentFriendId);
            const friend = await this._msgService.getFriend(this._currentFriendId);
            const msgList = this._container?.querySelector('[data-ref="message-list"]');
            if (msgList) {
              this._renderMessages(msgList, messages, friend);
              this._scrollToBottom();
            }

            // 触发 AI 回复
            setTimeout(async () => {
              try {
                await this._msgService.sendAIReply(this._currentFriendId);
                const updatedMessages = await this._msgService.getMessages(this._currentFriendId);
                const updatedMsgList = this._container?.querySelector('[data-ref="message-list"]');
                if (updatedMsgList) {
                  this._renderMessages(updatedMsgList, updatedMessages, friend);
                  this._scrollToBottom();
                }
              } catch (aiErr) {
                console.warn('[MessageModule] AI 回复失败:', aiErr);
              }
            }, 1000 + Math.random() * 2000);
          } catch (err) {
            this.showToast('发送红包失败: ' + err.message, 'error');
          }
        }
      });

      chatView.appendChild(panel);

      // 点击外部关闭面板
      setTimeout(() => {
        const closePanel = (e) => {
          if (!e.target.closest('.msg-redpacket-panel') && !e.target.closest('[data-action="redpacket"]')) {
            panel.remove();
            document.removeEventListener('click', closePanel);
          }
        };
        document.addEventListener('click', closePanel);
      }, 100);
    }

    async _handleOpenRedpacket(messageId) {
      if (!this._currentFriendId || !messageId) return;

      try {
        const result = await this._msgService.claimRedpacket(this._currentFriendId, messageId);
        if (result) {
          this.showToast('🎉 领取成功！', 'success');
          // 重新渲染消息列表以更新红包状态
          const messages = await this._msgService.getMessages(this._currentFriendId);
          const friend = await this._msgService.getFriend(this._currentFriendId);
          const msgList = this._container?.querySelector('[data-ref="message-list"]');
          if (msgList) {
            this._renderMessages(msgList, messages, friend);
          }
        }
      } catch (err) {
        this.showToast('领取失败: ' + err.message, 'error');
      }
    }

    // ==================== 语音功能 ====================

    async _handlePlayVoice(messageId) {
      if (!messageId) return;
      
      try {
        const messages = await this._msgService.getMessages(this._currentFriendId);
        const voiceMsg = messages?.find(m => m.id === messageId);
        
        if (!voiceMsg || voiceMsg.type !== 'voice') {
          this.showToast('语音消息不存在', 'error');
          return;
        }
        
        const textContent = voiceMsg.text || voiceMsg.content || '';
        
        if (textContent) {
          // 有文字内容：切换气泡下方文字的展开/收起
          const voiceBubble = this._container?.querySelector(`[data-voice-id="${messageId}"]`);
          if (voiceBubble) {
            const existingLabel = voiceBubble.querySelector('.msg-voice-text-label');
            if (existingLabel) {
              // 已展开则收起
              existingLabel.remove();
            } else {
              // 已收起则展开
              const textLabel = document.createElement('div');
              textLabel.className = 'msg-voice-text-label';
              textLabel.style.cssText = 'font-size:12px;color:#999;margin-top:2px;max-width:200px;word-break:break-all;';
              textLabel.textContent = textContent;
              voiceBubble.appendChild(textLabel);
            }
          }
        } else {
          // 无文字内容，弹出输入框让用户输入
          const inputText = await this.showPrompt({
            message: '该语音消息无文字内容，请输入：',
            placeholder: '输入语音转文字内容...'
          });
          
          if (inputText && inputText.trim()) {
            await this._msgService.updateVoiceText(this._currentFriendId, messageId, inputText.trim());
            this.showToast('语音内容已设置', 'success');
            
            const updatedMessages = await this._msgService.getMessages(this._currentFriendId);
            const friend = await this._msgService.getFriend(this._currentFriendId);
            const msgList = this._container?.querySelector('[data-ref="message-list"]');
            if (msgList) {
              this._renderMessages(msgList, updatedMessages, friend);
            }
          }
        }
        
      } catch (err) {
        console.error('[MessageModule] 语音操作失败:', err);
        this.showToast('操作失败: ' + err.message, 'error');
      }
    }

    _scrollToBottom() {
      const container = this._container?.querySelector('[data-ref="message-list"]');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    // ==================== 更多操作菜单 ====================

    async _handleMoreOptions() {
      const chatView = this._container?.querySelector('[data-view="CHAT"]');
      if (!chatView) return;

      // 检查是否已有菜单
      let menu = chatView.querySelector('.msg-more-menu');
      if (menu) {
        menu.remove();
        return;
      }

      // 创建菜单
      menu = document.createElement('div');
      menu.className = 'msg-more-menu';
      menu.style.cssText = 'position:absolute;top:50px;right:10px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);z-index:100;min-width:140px;overflow:hidden;';
      
      const friend = await this._msgService.getFriend(this._currentFriendId);
      const isGroup = friend?.isGroup === true;

      menu.innerHTML = `
        <div data-action="clear-chat" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:14px;">🗑️ 清空聊天记录</div>
        ${!isGroup ? '<div data-action="delete-friend" style="padding:12px 16px;cursor:pointer;color:#fa5151;font-size:14px;">❌ 删除好友</div>' : '<div data-action="leave-group" style="padding:12px 16px;cursor:pointer;color:#fa5151;font-size:14px;">🚪 退出群聊</div>'}
      `;

      chatView.appendChild(menu);

      // 点击外部关闭
      setTimeout(() => {
        const closeMenu = (e) => {
          if (!e.target.closest('.msg-more-menu') && !e.target.closest('[data-action="more-options"]')) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        };
        document.addEventListener('click', closeMenu);
      }, 100);
    }

    async _handleDeleteFriend() {
      if (!this._currentFriendId) return;

      const confirmed = await this.confirm('确定要删除该好友吗？删除后聊天记录将一并清除。');

      if (!confirmed) return;

      try {
        // 删除好友
        await this._friendService.remove(this._currentFriendId);
        // 清空聊天记录
        await this._msgService.clearChat(this._currentFriendId);
        
        this.showToast('已删除好友', 'success');
        
        // 关闭菜单并返回消息列表
        const menu = this._container?.querySelector('.msg-more-menu');
        if (menu) menu.remove();
        
        this._backFromChat();
      } catch (err) {
        console.error('[MessageModule] 删除好友失败:', err);
        this.showToast('删除失败: ' + err.message, 'error');
      }
    }

    async _handleClearChat() {
      if (!this._currentFriendId) return;

      const confirmed = await this.confirm('确定要清空与该好友的聊天记录吗？');

      if (!confirmed) return;

      try {
        await this._msgService.clearChat(this._currentFriendId);
        
        this.showToast('聊天记录已清空', 'success');
        
        // 关闭菜单
        const menu = this._container?.querySelector('.msg-more-menu');
        if (menu) menu.remove();
        
        // 重新渲染消息列表
        const messages = await this._msgService.getMessages(this._currentFriendId);
        const friend = await this._msgService.getFriend(this._currentFriendId);
        const msgList = this._container?.querySelector('[data-ref="message-list"]');
        if (msgList) {
          this._renderMessages(msgList, messages, friend);
        }
      } catch (err) {
        console.error('[MessageModule] 清空聊天记录失败:', err);
        this.showToast('操作失败: ' + err.message, 'error');
      }
    }

    async _handleLeaveGroup() {
      if (!this._currentFriendId) return;

      const confirmed = await this.confirm('确定要退出该群聊吗？退出后聊天记录将一并清除。');

      if (!confirmed) return;

      try {
        // 删除群聊好友记录
        await this._friendService.remove(this._currentFriendId);
        // 清空聊天记录
        await this._msgService.clearChat(this._currentFriendId);
        
        this.showToast('已退出群聊', 'success');
        
        // 关闭菜单并返回消息列表
        const menu = this._container?.querySelector('.msg-more-menu');
        if (menu) menu.remove();
        
        this._backFromChat();
      } catch (err) {
        console.error('[MessageModule] 退出群聊失败:', err);
        this.showToast('操作失败: ' + err.message, 'error');
      }
    }

    _handleChangeAvatar() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            // 更新头像显示
            const avatarEl = this._container?.querySelector('.msg-chat-avatar');
            if (avatarEl) avatarEl.style.backgroundImage = 'url(' + dataUrl + ')';
            // 通过 Service 保存（如果支持）
            if (this._friendService?.updateAvatar) {
              this._friendService.updateAvatar(this._currentFriendId, dataUrl);
            }
            this.showToast('头像已更新', 'success');
          };
          reader.readAsDataURL(file);
        } catch (err) {
          this.showToast('设置头像失败', 'error');
        }
        input.remove();
      });
      input.click();
    }

    // ==================== 朋友圈视图 ====================

    async _renderMoments() {
      if (this._fcCurrentView === 'FEED') {
        await this._renderFeed();
      } else if (this._fcCurrentView === 'MY') {
        await this._renderMyCircles();
      }
    }

    async _renderFeed() {
      const container = this._container?.querySelector('[data-fc-view="FEED"]');
      if (!container) return;

      try {
        const circles = await this._fcService.getFeed();
        container.innerHTML = '';

        if (!circles || circles.length === 0) {
          container.innerHTML = '<div class="msg-empty">暂无朋友圈动态</div>';
          return;
        }

        circles.forEach(circle => {
          const circleEl = this._renderCircleItem(circle, false);
          container.appendChild(circleEl);
        });
      } catch (e) {
        console.warn('[MessageModule] 渲染朋友圈失败:', e);
        container.innerHTML = '<div class="msg-error">加载失败，请重试</div>';
      }
    }

    async _renderMyCircles() {
      const container = this._container?.querySelector('[data-fc-view="MY"]');
      if (!container) return;

      try {
        const myCircles = await this._fcService.getMyCircles();
        container.innerHTML = '';

        // 发布按钮
        const actionsEl = document.createElement('div');
        actionsEl.className = 'msg-fc-actions';
        actionsEl.innerHTML = `
          <button data-action="publish">发布朋友圈</button>
          <button data-action="ai-publish">AI 生成</button>
        `;
        container.appendChild(actionsEl);

        if (!myCircles || myCircles.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'msg-empty';
          emptyEl.textContent = '你还没有发布过朋友圈';
          container.appendChild(emptyEl);
          return;
        }

        myCircles.forEach(circle => {
          const circleEl = this._renderCircleItem(circle, true);
          container.appendChild(circleEl);
        });
      } catch (e) {
        console.warn('[MessageModule] 渲染我的朋友圈失败:', e);
        container.innerHTML = '<div class="msg-error">加载失败，请重试</div>';
      }
    }

    _renderCircleItem(circle, showDelete) {
      const circleEl = document.createElement('div');
      circleEl.className = 'msg-fc-circle';
      circleEl.dataset.circleId = circle.id;

      // 头部：头像 + 作者 + 时间
      const headerEl = document.createElement('div');
      headerEl.className = 'msg-fc-circle-header';

      const avatarEl = document.createElement('div');
      avatarEl.className = 'msg-fc-avatar';
      if (circle.authorAvatar) {
        avatarEl.style.backgroundImage = 'url(' + circle.authorAvatar + ')';
      }

      const infoEl = document.createElement('div');
      infoEl.className = 'msg-fc-info';
      infoEl.innerHTML =
        '<div class="msg-fc-author">' + this._escapeHtml(circle.authorName || '未知用户') + '</div>' +
        '<div class="msg-fc-time">' + (circle.time || '') + '</div>';

      headerEl.appendChild(avatarEl);
      headerEl.appendChild(infoEl);

      if (showDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'msg-fc-delete-btn';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.circleId = circle.id;
        deleteBtn.textContent = '删除';
        headerEl.appendChild(deleteBtn);
      }

      circleEl.appendChild(headerEl);

      // 内容
      if (circle.content) {
        const contentEl = document.createElement('div');
        contentEl.className = 'msg-fc-content';
        contentEl.textContent = circle.content;
        circleEl.appendChild(contentEl);
      }

      // 图片
      if (circle.images && circle.images.length > 0) {
        const imagesEl = document.createElement('div');
        imagesEl.className = 'msg-fc-images';
        imagesEl.style.gridTemplateColumns = circle.images.length === 1 ? '1fr' : 'repeat(3, 1fr)';

        circle.images.forEach(function (img) {
          const imgEl = document.createElement('div');
          imgEl.className = 'msg-fc-image';
          imgEl.style.backgroundImage = 'url(' + img + ')';
          imagesEl.appendChild(imgEl);
        });

        circleEl.appendChild(imagesEl);
      }

      // 底部：点赞 + 评论
      const footerEl = document.createElement('div');
      footerEl.className = 'msg-fc-footer';

      // 点赞按钮
      const likeBtn = document.createElement('button');
      likeBtn.className = 'msg-fc-action-btn';
      likeBtn.dataset.action = 'like';
      likeBtn.dataset.circleId = circle.id;
      const isLiked = circle.likes && circle.likes.some(function (l) { return l.userId === 'me'; });
      likeBtn.textContent = (isLiked ? '❤️' : '🤍') + ' ' + (circle.likes?.length || 0);
      footerEl.appendChild(likeBtn);

      // 评论按钮
      const commentBtn = document.createElement('button');
      commentBtn.className = 'msg-fc-action-btn';
      commentBtn.dataset.action = 'comment';
      commentBtn.dataset.circleId = circle.id;
      commentBtn.textContent = '💬 ' + (circle.comments?.length || 0);
      footerEl.appendChild(commentBtn);

      // AI 评论按钮
      const aiCommentBtn = document.createElement('button');
      aiCommentBtn.className = 'msg-fc-action-btn msg-fc-ai-btn';
      aiCommentBtn.dataset.action = 'ai-comment';
      aiCommentBtn.dataset.circleId = circle.id;
      aiCommentBtn.textContent = '🤖';
      footerEl.appendChild(aiCommentBtn);

      circleEl.appendChild(footerEl);

      // 评论列表
      if (circle.comments && circle.comments.length > 0) {
        const commentsEl = document.createElement('div');
        commentsEl.className = 'msg-fc-comments';

        circle.comments.forEach(function (comment) {
          const commentEl = document.createElement('div');
          commentEl.className = 'msg-fc-comment';

          let commentText = '<span class="msg-fc-comment-author">' + this._escapeHtml(comment.userName || '未知') + '</span>：';
          if (comment.replyTo) {
            commentText += '回复 <span class="msg-fc-comment-reply">' + this._escapeHtml(comment.replyTo) + '</span> ';
          }
          commentText += this._escapeHtml(comment.content);

          commentEl.innerHTML = commentText;

          // 删除自己的评论
          if (comment.userId === 'me') {
            const delBtn = document.createElement('button');
            delBtn.className = 'msg-fc-comment-delete';
            delBtn.dataset.action = 'delete-comment';
            delBtn.dataset.circleId = circle.id;
            delBtn.dataset.commentId = comment.id;
            delBtn.textContent = '×';
            commentEl.appendChild(delBtn);
          }

          commentsEl.appendChild(commentEl);
        }.bind(this));

        circleEl.appendChild(commentsEl);
      }

      return circleEl;
    }

    // ==================== 朋友圈业务处理 ====================

    async _handlePublish() {
      const content = await this.showPrompt({ message: '发布朋友圈:' });
      if (!content?.trim()) return;

      try {
        const circleId = await this._fcService.publish(content.trim());
        await this._refreshMoments();
        
        // Phase 6: 触发NPC互动检查
        await this._triggerNPCInteraction('moment', circleId);
      } catch (err) {
        this.showToast('发布失败: ' + err.message, 'error');
      }
    }
    
    /**
     * Phase 6: 触发NPC互动检查
     * @private
     */
    async _triggerNPCInteraction(contentType, contentId) {
      try {
        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const socialService = new window.PhoneServices.Social(this._platform);
        const interactions = await socialService.checkNPCInteraction(charId, contentType, contentId);
        
        if (interactions && interactions.length > 0) {
          // 显示NPC互动提示
          const npcNames = interactions.map(i => i.npcName).slice(0, 3);
          this.showToast(`${npcNames.join('、')} 等 ${interactions.length} 位NPC互动了`, 'info');
          
          // 延迟后刷新朋友圈以显示NPC互动
          setTimeout(async () => {
            await this._refreshMoments();
          }, 500);
        }
      } catch (e) {
        console.warn('[MessageModule] NPC互动检查失败:', e);
      }
    }

    async _handleAIPublish() {
      try {
        await this._fcService.publishAI();
        await this._refreshMoments();
      } catch (err) {
        this.showToast('AI 生成失败: ' + err.message, 'error');
      }
    }

    async _handleLike(circleId) {
      try {
        await this._fcService.toggleLike(circleId);
        await this._refreshMoments();
      } catch (err) {
        console.error('[MessageModule] 点赞失败:', err);
      }
    }

    async _handleComment(circleId) {
      const content = await this.showPrompt({ message: '评论:' });
      if (!content?.trim()) return;

      try {
        await this._fcService.addComment(circleId, content.trim());
        await this._refreshMoments();
      } catch (err) {
        this.showToast('评论失败: ' + err.message, 'error');
      }
    }

    async _handleAIComment(circleId) {
      try {
        await this._fcService.addCommentAI(circleId);
        await this._refreshMoments();
      } catch (err) {
        this.showToast('AI 评论失败: ' + err.message, 'error');
      }
    }

    async _handleDelete(circleId) {
      if (!(await this.confirm('确定删除这条朋友圈吗？'))) return;

      try {
        await this._fcService.delete(circleId);
        await this._refreshMoments();
      } catch (err) {
        this.showToast('删除失败: ' + err.message, 'error');
      }
    }

    async _handleDeleteComment(circleId, commentId) {
      try {
        await this._fcService.deleteComment(circleId, commentId);
        await this._refreshMoments();
      } catch (err) {
        console.error('[MessageModule] 删除评论失败:', err);
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      // 订阅好友列表变更
      try {
        const unsubFriends = this._msgService.subscribeFriends(() => {
          if (this._currentView === 'CHAT_LIST') {
            this._renderFriendList();
          }
        });
        if (unsubFriends) this._unsubscribers.push(unsubFriends);
      } catch (e) {
        console.warn('[MessageModule] 订阅好友列表失败:', e);
      }

      // 订阅所有消息变更
      try {
        const unsubMessages = this._msgService.subscribeAll(() => {
          if (this._currentView === 'CHAT' && this._currentFriendId) {
            Promise.all([
              this._msgService.getMessages(this._currentFriendId),
              this._msgService.getFriend(this._currentFriendId)
            ]).then(([messages, friend]) => {
              const msgList = this._container?.querySelector('[data-ref="message-list"]');
              if (msgList) {
                this._renderMessages(msgList, messages, friend);
                this._scrollToBottom();
              }
            }).catch(() => {});
          } else if (this._currentView === 'CHAT_LIST') {
            this._renderFriendList();
          }
        });
        if (unsubMessages) this._unsubscribers.push(unsubMessages);
      } catch (e) {
        console.warn('[MessageModule] 订阅消息变更失败:', e);
      }

      // 订阅朋友圈变更
      try {
        const unsubCircles = this._fcService.subscribeCircles(() => {
          if (this._currentView === 'MOMENTS') {
            this._refreshMoments();
          }
        });
        if (unsubCircles) this._unsubscribers.push(unsubCircles);
      } catch (e) {
        console.warn('[MessageModule] 订阅朋友圈失败:', e);
      }

      // 订阅 director:message 事件（断裂点2修复）
      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      try {
        const eventBus = window.Platform?.eventBus;
        if (eventBus) {
          const unsubMsg = eventBus.on('director:message', async (payload) => {
            console.log('[MessageModule] 收到director:message事件', payload);
            try {
              if (this._currentView === 'CHAT' && this._currentFriendId) {
                const msgList = this._container?.querySelector('[data-ref="message-list"]');
                if (msgList) {
                  const messages = await this._msgService.getMessages(this._currentFriendId);
                  const friend = await this._msgService.getFriend(this._currentFriendId);
                  this._renderMessages(msgList, messages, friend);
                  this._scrollToBottom();
                }
              } else if (this._currentView === 'CHAT_LIST') {
                await this._renderFriendList();
              }
            } catch (e) {
              console.warn('[MessageModule] 处理director:message事件失败:', e);
            }
          });
          if (unsubMsg) this._unsubscribers.push(unsubMsg);
        }
      } catch (e) {
        console.warn('[MessageModule] 订阅director:message事件失败:', e);
      }

      // 订阅 director:moment 事件（断裂点2修复 - 朋友圈在MessageModule中）
      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      try {
        const eventBus = window.Platform?.eventBus;
        if (eventBus) {
          const unsubMoment = eventBus.on('director:moment', async (payload) => {
            console.log('[MessageModule] 收到director:moment事件', payload);
            try {
              if (this._currentView === 'MOMENTS') {
                await this._refreshMoments();
              }
            } catch (e) {
              console.warn('[MessageModule] 处理director:moment事件失败:', e);
            }
          });
          if (unsubMoment) this._unsubscribers.push(unsubMoment);
        }
      } catch (e) {
        console.warn('[MessageModule] 订阅director:moment事件失败:', e);
      }
    }

    // ==================== 好友管理 ====================

    /**
     * 添加好友（内联表单，不使用 prompt）
     */
    async _handleAddFriend() {
      try {
        const container = this._container?.querySelector('[data-view="CHAT_LIST"]');
        if (!container) return;

        // 检查是否已有表单
        if (container.querySelector('.msg-add-friend-form')) return;

        const form = document.createElement('div');
        form.className = 'msg-add-friend-form';
        form.style.cssText = 'background:#fff;margin:8px 12px;padding:12px;border-radius:8px;border:1px solid #ddd;';
        form.innerHTML = `
          <div style="font-size:14px;font-weight:bold;margin-bottom:8px;">添加好友</div>
          <input type="text" data-ref="friend-id-input" placeholder="好友ID" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:8px;box-sizing:border-box;font-size:13px;">
          <input type="text" data-ref="friend-name-input" placeholder="好友名称" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-bottom:8px;box-sizing:border-box;font-size:13px;">
          <div style="display:flex;gap:8px;">
            <button data-action="confirm-add-friend" style="flex:1;padding:8px;background:#07C160;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;">确认添加</button>
            <button data-action="cancel-add-friend" style="flex:1;padding:8px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;font-size:13px;cursor:pointer;">取消</button>
          </div>
        `;
        container.insertBefore(form, container.querySelector('.msg-friend-list') || container.firstChild);

        // 绑定表单事件
        form.addEventListener('click', async (e) => {
          if (e.target.closest('[data-action="confirm-add-friend"]')) {
            const id = form.querySelector('[data-ref="friend-id-input"]').value.trim();
            const name = form.querySelector('[data-ref="friend-name-input"]').value.trim();
            if (!id || !name) {
              this.showToast('请填写好友ID和名称', 'error');
              return;
            }
            const result = await this._friendService.sendRequest({ id, name });
            if (result) {
              this.showToast('好友请求已发送', 'success');
              form.remove();
            } else {
              this.showToast('发送失败', 'error');
            }
          }
          if (e.target.closest('[data-action="cancel-add-friend"]')) {
            form.remove();
          }
        });
      } catch (err) {
        console.error('[MessageModule] 添加好友失败:', err);
        this.showToast('操作失败: ' + err.message, 'error');
      }
    }

    /**
     * 查看好友请求列表
     */
    async _handleFriendRequests() {
      try {
        const container = this._container?.querySelector('[data-view="CHAT_LIST"]');
        if (!container) return;

        const allRequests = await this._friendService.getRequests();
        // 只显示待处理的请求
        const requests = (allRequests || []).filter(r => r.status === 'pending' || !r.status);
        
        if (requests.length === 0) {
          this.showToast('暂无好友请求', 'info');
          return;
        }

        // 移除已有的请求面板
        const existPanel = container.querySelector('.msg-requests-panel');
        if (existPanel) { existPanel.remove(); return; }

        const panel = document.createElement('div');
        panel.className = 'msg-requests-panel';
        panel.style.cssText = 'background:#fff;margin:8px 12px;padding:12px;border-radius:8px;border:1px solid #ddd;max-height:300px;overflow-y:auto;';

        let html = '<div style="font-size:14px;font-weight:bold;margin-bottom:8px;">📋 好友请求 (' + requests.length + ')</div>';
        requests.forEach(req => {
          html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;">
            <div>
              <div style="font-size:13px;font-weight:bold;">${this._escapeHtml(req.name || req.id)}</div>
              <div style="font-size:11px;color:#888;">${this._escapeHtml(req.message || '请求添加你为好友')}</div>
            </div>
            <div style="display:flex;gap:4px;">
              <button data-action="accept-request" data-request-id="${this._escapeHtml(req.id || req.requestId)}" style="padding:4px 10px;background:#07C160;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;">接受</button>
              <button data-action="reject-request" data-request-id="${this._escapeHtml(req.id || req.requestId)}" style="padding:4px 10px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;font-size:12px;cursor:pointer;">拒绝</button>
            </div>
          </div>`;
        });
        panel.innerHTML = html;

        container.insertBefore(panel, container.querySelector('.msg-friend-list') || container.firstChild);
      } catch (err) {
        console.error('[MessageModule] 查看好友请求失败:', err);
        this.showToast('操作失败: ' + err.message, 'error');
      }
    }

    /**
     * 接受好友请求
     */
    async _handleAcceptRequest(requestId) {
      try {
        const result = await this._friendService.handleRequest(requestId, true);
        if (result) {
          this.showToast('已接受好友请求', 'success');
          // 移除好友请求面板
          const panel = this._container?.querySelector('.msg-requests-panel');
          if (panel) panel.remove();
          await this._renderFriendList();
        } else {
          this.showToast('操作失败', 'error');
        }
      } catch (err) {
        console.error('[MessageModule] 接受好友请求失败:', err);
        this.showToast('操作失败', 'error');
      }
    }

    /**
     * 拒绝好友请求
     */
    async _handleRejectRequest(requestId) {
      try {
        const result = await this._friendService.handleRequest(requestId, false);
        if (result) {
          this.showToast('已拒绝', 'success');
          // 移除好友请求面板
          const panel = this._container?.querySelector('.msg-requests-panel');
          if (panel) panel.remove();
          await this._renderFriendList();
        } else {
          this.showToast('操作失败', 'error');
        }
      } catch (err) {
        console.error('[MessageModule] 拒绝好友请求失败:', err);
        this.showToast('操作失败', 'error');
      }
    }

    /**
     * 创建群聊（带好友选择UI）
     */
    async _handleCreateGroup() {
      try {
        const friends = await this._msgService.getFriendList();
        
        if (!friends || friends.length === 0) {
          this.showToast('请先添加好友再创建群聊', 'info');
          return;
        }

        // 弹出群聊名称输入
        const groupName = await this.showPrompt({
          message: '请输入群聊名称',
          placeholder: '群聊名称'
        });

        if (!groupName?.trim()) {
          return;
        }

        // 创建好友选择面板（覆盖整个应用，而非仅在 CHAT_LIST 内）
        const appContainer = this._container?.querySelector('.msg-app');
        if (!appContainer) return;

        // 移除已有的选择面板
        const existPanel = appContainer.querySelector('.msg-group-select-panel');
        if (existPanel) existPanel.remove();

        const panel = document.createElement('div');
        panel.className = 'msg-group-select-panel';
        panel.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:#fff;z-index:50;display:flex;flex-direction:column;';

        panel.innerHTML = `
          <div style="padding:12px;background:#f7f7f7;border-bottom:1px solid #ddd;display:flex;align-items:center;justify-content:space-between;">
            <button data-action="cancel-group" style="padding:8px 12px;background:none;border:none;font-size:15px;color:#07C160;">取消</button>
            <span style="font-size:17px;font-weight:600;">选择群成员</span>
            <button data-action="confirm-group" style="padding:8px 12px;background:#07C160;color:#fff;border:none;border-radius:4px;font-size:15px;">确定</button>
          </div>
          <div style="padding:12px;color:#888;font-size:13px;">已选择: <span data-ref="selected-count">0</span> 人</div>
          <div data-ref="friend-select-list" style="flex:1;overflow-y:auto;padding:0 12px;"></div>
        `;

        const listEl = panel.querySelector('[data-ref="friend-select-list"]');
        const countEl = panel.querySelector('[data-ref="selected-count"]');
        const selectedFriends = new Set();

        friends.forEach(friend => {
          const item = document.createElement('div');
          item.style.cssText = 'display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;';
          item.dataset.friendId = friend.id;
          item.innerHTML = `
            <div style="width:40px;height:40px;background:#07C160;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;margin-right:12px;">${friend.name?.charAt(0) || '?'}</div>
            <div style="flex:1;font-size:15px;">${friend.name}</div>
            <div class="select-checkbox" style="width:22px;height:22px;border:2px solid #ddd;border-radius:50%;display:flex;align-items:center;justify-content:center;"></div>
          `;
          
          item.addEventListener('click', () => {
            if (selectedFriends.has(friend.id)) {
              selectedFriends.delete(friend.id);
              item.querySelector('.select-checkbox').style.background = '';
              item.querySelector('.select-checkbox').innerHTML = '';
            } else {
              selectedFriends.add(friend.id);
              item.querySelector('.select-checkbox').style.background = '#07C160';
              item.querySelector('.select-checkbox').innerHTML = '✓';
              item.querySelector('.select-checkbox').style.color = '#fff';
            }
            countEl.textContent = selectedFriends.size;
          });

          listEl.appendChild(item);
        });

        // 绑定按钮事件
        panel.addEventListener('click', async (e) => {
          if (e.target.closest('[data-action="cancel-group"]')) {
            panel.remove();
          }
          if (e.target.closest('[data-action="confirm-group"]')) {
            if (selectedFriends.size === 0) {
              this.showToast('请至少选择一位好友', 'error');
              return;
            }

            // [v4.31.0-fix] 铁则十：通过 Service 层创建群聊，不在 Module 层拼装数据对象
            const result = await this._friendService.createGroup(groupName.trim(), Array.from(selectedFriends));
            if (result) {
              this.showToast('群聊创建成功', 'success');
              panel.remove();
              await this._renderFriendList();
            } else {
              this.showToast('群聊创建失败', 'error');
            }
          }
        });

        appContainer.appendChild(panel);
      } catch (err) {
        console.error('[MessageModule] 创建群聊失败:', err);
        this.showToast('创建群聊失败: ' + err.message, 'error');
      }
    }

    // 注意：通讯录视图已移除，现在消息列表就是会话列表

    /**
     * 处理好友请求（工作流入口，由 WorkflowEngine 调用）
     */
    async handlePendingFriend() {
      try {
        await this._renderFriendList();
        this.showToast('收到新的好友请求', 'info');
      } catch (err) {
        console.warn('[MessageModule] 处理好友请求失败:', err);
      }
    }

    /**
     * 处理待处理消息（工作流入口，由 WorkflowEngine 调用）
     */
    async handlePendingMessage(params) {
      try {
        if (params?.friendId) {
          this._currentFriendId = params.friendId;
          this._currentView = 'CHAT';
          await this._openChat(params.friendId);
        } else {
          await this._renderFriendList();
        }
      } catch (err) {
        console.warn('[MessageModule] 处理待处理消息失败:', err);
      }
    }

    // ==================== 辅助方法 ====================

    async _refreshMoments() {
      if (this._fcCurrentView === 'FEED') {
        await this._renderFeed();
      } else if (this._fcCurrentView === 'MY') {
        await this._renderMyCircles();
      }
    }

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new MessageModule();
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
  window.PhoneModules.Message = MessageModule;

  console.log('[Module] MessageModule (消息+朋友圈合并版) 已加载');
})();
