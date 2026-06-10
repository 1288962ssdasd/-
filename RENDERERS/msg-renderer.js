/**
 * @layer Renderer
 * @file   msg-renderer.js
 *
 * 职责: 消息模块 UI 渲染 - 微信写实风格
 * 禁止: 包含业务逻辑、调用 Service、修改数据
 *
 * 从 msg-module.js 提取的渲染方法：
 *   - injectStyles()        ← _getEmbeddedStyles()
 *   - renderApp()           ← onRender()
 *   - renderFriendList()    ← _renderFriendList()
 *   - renderChatView()      ← _openChat() 中的 DOM 构建部分
 *   - renderMessages()      ← _renderMessages()
 *   - renderVoiceBubble()   ← _renderVoiceBubble()
 *   - renderRedpacketBubble() ← _renderRedpacketBubble()
 *   - renderFeed()          ← _renderFeed()
 *   - renderMyCircles()     ← _renderMyCircles()
 *   - renderCircleItem()    ← _renderCircleItem()
 *
 * 铁则合规：
 *   - CSS 类名以 msg- 前缀（铁则二十一）
 *   - Renderer 不直接调用 Service（铁则三）
 *   - 通过 callbacks 对象将事件传递给 Module
 */

;(function () {
  'use strict';

  class MsgRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.className = 'msg-module-styles';
      style.textContent = this._getEmbeddedStyles();
      document.head.appendChild(style);
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

    // ==================== 主框架渲染 ====================

    /**
     * 渲染消息模块主框架（App 骨架）
     * @returns {HTMLElement}
     */
    renderApp(callbacks) {
      const wrapper = document.createElement('div');
      wrapper.className = 'msg-app';
      wrapper.style.cssText = 'height:100%;display:flex;flex-direction:column;';

      // 顶部 Tab 栏
      const tabs = document.createElement('div');
      tabs.className = 'msg-tabs';

      const tabChat = document.createElement('button');
      tabChat.dataset.tab = 'CHAT_LIST';
      tabChat.className = 'msg-tab msg-active';
      tabChat.textContent = '消息';
      if (callbacks?.onTabSwitch) tabChat.addEventListener('click', () => callbacks.onTabSwitch('CHAT_LIST'));

      const tabMoments = document.createElement('button');
      tabMoments.dataset.tab = 'MOMENTS';
      tabMoments.className = 'msg-tab';
      tabMoments.textContent = '朋友圈';
      if (callbacks?.onTabSwitch) tabMoments.addEventListener('click', () => callbacks.onTabSwitch('MOMENTS'));

      const homeBtn = document.createElement('button');
      homeBtn.dataset.action = 'go-home';
      homeBtn.className = 'msg-home-btn';
      homeBtn.title = '返回主界面';
      homeBtn.textContent = '\uD83C\uDFE0';
      if (callbacks?.onGoHome) homeBtn.addEventListener('click', () => callbacks.onGoHome());

      tabs.appendChild(tabChat);
      tabs.appendChild(tabMoments);
      tabs.appendChild(homeBtn);
      wrapper.appendChild(tabs);

      // 视图容器
      const views = document.createElement('div');
      views.className = 'msg-views';

      const chatListView = document.createElement('div');
      chatListView.className = 'msg-view';
      chatListView.dataset.view = 'CHAT_LIST';

      const chatView = document.createElement('div');
      chatView.className = 'msg-view';
      chatView.dataset.view = 'CHAT';
      chatView.style.display = 'none';

      const momentsView = document.createElement('div');
      momentsView.className = 'msg-view';
      momentsView.dataset.view = 'MOMENTS';
      momentsView.style.display = 'none';

      // 朋友圈内部结构
      const momentsHeader = document.createElement('div');
      momentsHeader.className = 'msg-moments-header';

      const momentsTabs = document.createElement('div');
      momentsTabs.className = 'msg-moments-tabs';

      const fcTabFeed = document.createElement('button');
      fcTabFeed.dataset.fcTab = 'FEED';
      fcTabFeed.className = 'msg-fc-tab msg-active';
      fcTabFeed.textContent = '朋友圈';
      if (callbacks?.onFcTabSwitch) fcTabFeed.addEventListener('click', () => callbacks.onFcTabSwitch('FEED'));

      const fcTabMy = document.createElement('button');
      fcTabMy.dataset.fcTab = 'MY';
      fcTabMy.className = 'msg-fc-tab';
      fcTabMy.textContent = '我的';
      if (callbacks?.onFcTabSwitch) fcTabMy.addEventListener('click', () => callbacks.onFcTabSwitch('MY'));

      momentsTabs.appendChild(fcTabFeed);
      momentsTabs.appendChild(fcTabMy);

      const publishBtn = document.createElement('button');
      publishBtn.className = 'msg-publish-btn';
      publishBtn.dataset.action = 'publish';
      publishBtn.textContent = '\uD83D\uDCF7';
      if (callbacks?.onPublish) publishBtn.addEventListener('click', () => callbacks.onPublish());

      momentsHeader.appendChild(momentsTabs);
      momentsHeader.appendChild(publishBtn);

      const momentsViews = document.createElement('div');
      momentsViews.className = 'msg-moments-views';

      const feedView = document.createElement('div');
      feedView.className = 'msg-moments-view';
      feedView.dataset.fcView = 'FEED';

      const myView = document.createElement('div');
      myView.className = 'msg-moments-view';
      myView.dataset.fcView = 'MY';
      myView.style.display = 'none';

      momentsViews.appendChild(feedView);
      momentsViews.appendChild(myView);
      momentsView.appendChild(momentsHeader);
      momentsView.appendChild(momentsViews);

      views.appendChild(chatListView);
      views.appendChild(chatView);
      views.appendChild(momentsView);
      wrapper.appendChild(views);

      return wrapper;
    }

    // ==================== 好友列表渲染 ====================

    /**
     * 渲染好友列表（会话列表）
     * @param {HTMLElement} container - 挂载容器
     * @param {Array} friends - 好友数据数组
     * @param {Object} callbacks - 回调对象
     */
    renderFriendList(container, friends, callbacks) {
      if (!container) return;
      container.innerHTML = '';

      // 顶部操作栏
      const actionBar = document.createElement('div');
      actionBar.className = 'msg-action-bar';
      actionBar.style.cssText = 'display:flex;gap:8px;padding:8px 12px;background:#f7f7f7;';

      const addBtn = document.createElement('button');
      addBtn.className = 'msg-btn-add-friend';
      addBtn.dataset.action = 'add-friend';
      addBtn.textContent = '\u2795 添加好友';
      addBtn.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;';

      const reqBtn = document.createElement('button');
      reqBtn.className = 'msg-btn-friend-req';
      reqBtn.dataset.action = 'friend-requests';
      reqBtn.textContent = '\uD83D\uDCCB 好友请求';
      reqBtn.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;';

      const groupBtn = document.createElement('button');
      groupBtn.className = 'msg-btn-create-group';
      groupBtn.dataset.action = 'create-group';
      groupBtn.textContent = '\uD83D\uDC65 创建群聊';
      groupBtn.style.cssText = 'flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;';

      actionBar.appendChild(addBtn);
      actionBar.appendChild(reqBtn);
      actionBar.appendChild(groupBtn);
      container.appendChild(actionBar);

      if (!friends || friends.length === 0) {
        container.appendChild(this.renderEmptyState('暂无好友，点击上方添加'));
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
          // [v4.31.0-fix] CSS 注入防护：使用 JSON.stringify 包裹 URL，防止注入
          avatar.style.backgroundImage = 'url(' + JSON.stringify(friend.avatar).slice(1, -1) + ')';
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
    }

    // ==================== 聊天视图渲染 ====================

    /**
     * 渲染聊天视图（DOM 构建）
     * @param {Object} friend - 好友数据
     * @param {Array} messages - 消息数据
     * @param {Object} callbacks - 回调对象
     * @returns {HTMLElement} 聊天视图根节点
     */
    renderChatView(friend, messages, callbacks) {
      const chatView = document.createElement('div');
      chatView.className = 'msg-chat-view-wrapper';
      chatView.style.cssText = 'display:flex;flex-direction:column;height:100%;position:absolute;top:0;left:0;right:0;bottom:0;z-index:10;background:#ededed;';

      // 顶部栏
      const header = document.createElement('div');
      header.className = 'msg-chat-header';

      const backBtn = document.createElement('button');
      backBtn.dataset.action = 'back';
      backBtn.textContent = '\u2190';
      if (callbacks?.onBack) backBtn.addEventListener('click', () => callbacks.onBack());

      const avatar = document.createElement('div');
      avatar.className = 'msg-chat-avatar';
      if (friend?.avatar) {
        // [v4.31.0-fix] CSS 注入防护：使用 JSON.stringify 包裹 URL，防止注入
        avatar.style.backgroundImage = 'url(' + JSON.stringify(friend.avatar).slice(1, -1) + ')';
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
      if (callbacks?.onChangeAvatar) avatar.addEventListener('click', () => callbacks.onChangeAvatar());

      const title = document.createElement('span');
      title.className = 'msg-chat-title';
      title.textContent = friend ? friend.name : '';

      const moreBtn = document.createElement('button');
      moreBtn.dataset.action = 'more-options';
      moreBtn.textContent = '\u22EF';
      moreBtn.style.cssText = 'width:32px;height:32px;border:none;background:none;color:#111;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:50%;padding:0;line-height:1;font-weight:bold;';
      if (callbacks?.onMoreOptions) moreBtn.addEventListener('click', () => callbacks.onMoreOptions());

      header.appendChild(backBtn);
      header.appendChild(avatar);
      header.appendChild(title);
      header.appendChild(moreBtn);
      chatView.appendChild(header);

      // 消息列表
      const msgList = document.createElement('div');
      msgList.className = 'msg-message-list';
      msgList.dataset.ref = 'message-list';
      msgList.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      this.renderMessages(msgList, messages, friend);
      chatView.appendChild(msgList);

      // 输入区
      const inputArea = document.createElement('div');
      inputArea.className = 'msg-input-area';
      inputArea.style.cssText = 'display:flex;align-items:center;padding:8px 10px;background:#f7f7f7;border-top:0.5px solid #d9d9d9;flex-shrink:0;gap:6px;';

      const msgInput = document.createElement('input');
      msgInput.type = 'text';
      msgInput.dataset.ref = 'message-input';
      msgInput.placeholder = '输入消息...';
      msgInput.style.cssText = 'flex:1;min-width:0;height:36px;border:none;border-radius:4px;background:#fff;padding:0 10px;font-size:15px;outline:none;';

      const emojiBtn = document.createElement('button');
      emojiBtn.dataset.action = 'emoji';
      emojiBtn.title = '表情';
      emojiBtn.style.cssText = 'width:36px;height:36px;border:none;background:none;font-size:22px;cursor:pointer;padding:0;';
      emojiBtn.textContent = '\uD83D\uDE0A';
      if (callbacks?.onEmoji) emojiBtn.addEventListener('click', () => callbacks.onEmoji());

      const toggleBtn = document.createElement('button');
      toggleBtn.dataset.action = 'more-input';
      toggleBtn.dataset.ref = 'send-toggle-btn';
      toggleBtn.title = '更多';
      toggleBtn.style.cssText = 'width:36px;height:36px;border:none;background:#07C160;color:#fff;border-radius:4px;font-size:20px;cursor:pointer;padding:0;font-weight:bold;';
      toggleBtn.textContent = '+';

      // 监听输入框内容变化
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

      // Enter 发送
      msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && callbacks?.onSend) {
          callbacks.onSend();
        }
      });

      // 发送 / 更多按钮
      toggleBtn.addEventListener('click', () => {
        if (toggleBtn.dataset.action === 'send' && callbacks?.onSend) {
          callbacks.onSend();
        } else if (callbacks?.onMoreInput) {
          callbacks.onMoreInput();
        }
      });

      inputArea.appendChild(msgInput);
      inputArea.appendChild(emojiBtn);
      inputArea.appendChild(toggleBtn);
      chatView.appendChild(inputArea);

      return chatView;
    }

    // ==================== 消息列表渲染 ====================

    /**
     * 渲染消息列表
     * @param {HTMLElement} container - 消息列表容器
     * @param {Array} messages - 消息数据
     * @param {Object} friend - 好友数据
     */
    renderMessages(container, messages, friend) {
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
          timeEl.textContent = this.formatMessageTime(msg.timestamp);
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
          avatar.style.background = '#07C160';
          avatar.textContent = '我';
          avatar.style.display = 'flex';
          avatar.style.alignItems = 'center';
          avatar.style.justifyContent = 'center';
          avatar.style.color = '#fff';
          avatar.style.fontSize = '12px';
        } else {
          if (friend?.avatar) {
            // [v4.31.0-fix] CSS 注入防护：使用 JSON.stringify 包裹 URL，防止注入
            avatar.style.backgroundImage = 'url(' + JSON.stringify(friend.avatar).slice(1, -1) + ')';
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
            const voiceBubble = document.createElement('div');
            voiceBubble.className = 'msg-voice-bubble ' + (isMe ? '' : 'msg-received');
            voiceBubble.dataset.action = 'play-voice';
            voiceBubble.dataset.voiceId = msg.id;
            voiceBubble.innerHTML = this.renderVoiceBubble(msg, isMe);

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
            content.innerHTML = this.renderRedpacketBubble(msg);
            content.className = 'msg-redpacket-bubble';
            content.dataset.action = 'open-redpacket';
            content.dataset.redpacketId = msg.id;
            if (msg.opened) {
              content.classList.add('msg-opened');
            }
            break;
          case 'transfer':
            content.textContent = '\uD83D\uDCB0 转账 ' + (msg.amount || 0) + '元';
            break;
          case 'sticker':
          case 'emoji':
            // [v4.31.0-fix] XSS 防护：使用 textContent 代替 innerHTML，emoji 是文本内容
            const emojiSpan = document.createElement('span');
            emojiSpan.style.fontSize = '32px';
            emojiSpan.textContent = msg.content || '\uD83D\uDE0A';
            content.appendChild(emojiSpan);
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

    // ==================== 子组件渲染 ====================

    /**
     * 渲染语音气泡 HTML
     * @param {Object} msg - 消息数据
     * @param {boolean} isMe - 是否是自己发送的
     * @returns {string} HTML 字符串
     */
    renderVoiceBubble(msg, isMe) {
      const duration = msg.duration || 1;
      const width = Math.min(200, 60 + duration * 10);
      return `
        <div class="msg-voice-wave" style="width:${width}px;justify-content:${isMe ? 'flex-end' : 'flex-start'};">
          ${isMe ? '' : '<span></span><span></span><span></span>'}
          <span style="font-size:16px;">\uD83C\uDFA4</span>
          ${isMe ? '<span></span><span></span><span></span>' : ''}
        </div>
        <span class="msg-voice-duration">${duration}"</span>
      `;
    }

    /**
     * 渲染红包气泡 HTML
     * @param {Object} msg - 消息数据
     * @returns {string} HTML 字符串
     */
    renderRedpacketBubble(msg) {
      const status = msg.opened ? '已领取' : '领取红包';
      return `
        <span class="msg-redpacket-icon">\uD83E\uDE47</span>
        <div class="msg-redpacket-info">
          <div class="msg-redpacket-remark">${this._escapeHtml(msg.remark || '恭喜发财，大吉大利')}</div>
          <div class="msg-redpacket-status">${status}</div>
        </div>
      `;
    }

    // ==================== 朋友圈渲染 ====================

    /**
     * 渲染朋友圈 Feed
     * @param {HTMLElement} container - 容器
     * @param {Array} circles - 动态数据
     */
    renderFeed(container, circles) {
      if (!container) return;
      container.innerHTML = '';

      if (!circles || circles.length === 0) {
        container.innerHTML = '<div class="msg-empty">暂无朋友圈动态</div>';
        return;
      }

      circles.forEach(circle => {
        const circleEl = this.renderCircleItem(circle, false);
        container.appendChild(circleEl);
      });
    }

    /**
     * 渲染我的朋友圈
     * @param {HTMLElement} container - 容器
     * @param {Array} circles - 我的动态数据
     * @param {Object} callbacks - 回调
     */
    renderMyCircles(container, circles, callbacks) {
      if (!container) return;
      container.innerHTML = '';

      // 发布按钮
      const actionsEl = document.createElement('div');
      actionsEl.className = 'msg-fc-actions';
      actionsEl.innerHTML = `
        <button data-action="publish">发布朋友圈</button>
        <button data-action="ai-publish">AI 生成</button>
      `;
      container.appendChild(actionsEl);

      if (!circles || circles.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'msg-empty';
        emptyEl.textContent = '你还没有发布过朋友圈';
        container.appendChild(emptyEl);
        return;
      }

      circles.forEach(circle => {
        const circleEl = this.renderCircleItem(circle, true);
        container.appendChild(circleEl);
      });
    }

    /**
     * 渲染单条朋友圈动态
     * @param {Object} circle - 动态数据
     * @param {boolean} showDelete - 是否显示删除按钮
     * @returns {HTMLElement}
     */
    renderCircleItem(circle, showDelete) {
      const circleEl = document.createElement('div');
      circleEl.className = 'msg-fc-circle';
      circleEl.dataset.circleId = circle.id;

      // 头部：头像 + 作者 + 时间
      const headerEl = document.createElement('div');
      headerEl.className = 'msg-fc-circle-header';

      const avatarEl = document.createElement('div');
      avatarEl.className = 'msg-fc-avatar';
      if (circle.authorAvatar) {
        // [v4.31.0-fix] CSS 注入防护：使用 JSON.stringify 包裹 URL，防止注入
        avatarEl.style.backgroundImage = 'url(' + JSON.stringify(circle.authorAvatar).slice(1, -1) + ')';
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
          // [v4.31.0-fix] CSS 注入防护：使用 JSON.stringify 包裹 URL，防止注入
          imgEl.style.backgroundImage = 'url(' + JSON.stringify(img).slice(1, -1) + ')';
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
      likeBtn.textContent = (isLiked ? '\u2764\uFE0F' : '\uD83E\uDD0D') + ' ' + (circle.likes?.length || 0);
      footerEl.appendChild(likeBtn);

      // 评论按钮
      const commentBtn = document.createElement('button');
      commentBtn.className = 'msg-fc-action-btn';
      commentBtn.dataset.action = 'comment';
      commentBtn.dataset.circleId = circle.id;
      commentBtn.textContent = '\uD83D\uDCAC ' + (circle.comments?.length || 0);
      footerEl.appendChild(commentBtn);

      // AI 评论按钮
      const aiCommentBtn = document.createElement('button');
      aiCommentBtn.className = 'msg-fc-action-btn msg-fc-ai-btn';
      aiCommentBtn.dataset.action = 'ai-comment';
      aiCommentBtn.dataset.circleId = circle.id;
      aiCommentBtn.textContent = '\uD83E\uDD16';
      footerEl.appendChild(aiCommentBtn);

      circleEl.appendChild(footerEl);

      // 评论列表
      if (circle.comments && circle.comments.length > 0) {
        const commentsEl = document.createElement('div');
        commentsEl.className = 'msg-fc-comments';

        circle.comments.forEach(function (comment) {
          const commentEl = document.createElement('div');
          commentEl.className = 'msg-fc-comment';

          let commentText = '<span class="msg-fc-comment-author">' + this._escapeHtml(comment.userName || '未知') + '</span>\uFF1A';
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
            delBtn.textContent = '\u00D7';
            commentEl.appendChild(delBtn);
          }

          commentsEl.appendChild(commentEl);
        }.bind(this));

        circleEl.appendChild(commentsEl);
      }

      return circleEl;
    }

    // ==================== 空状态 ====================

    /**
     * 渲染空状态
     * @param {string} text - 提示文字
     * @returns {HTMLElement}
     */
    renderEmptyState(text) {
      const el = document.createElement('div');
      el.className = 'msg-empty';
      el.textContent = text || '暂无数据';
      return el;
    }

    // ==================== 纯展示工具方法 ====================

    /**
     * 格式化消息时间
     * @param {number} timestamp
     * @returns {string}
     */
    formatMessageTime(timestamp) {
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

    /**
     * HTML 转义
     * @param {string} text
     * @returns {string}
     */
    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Msg = MsgRenderer;

  console.log('[Renderer] MsgRenderer 已加载');
})();
