/**
 * 消息模块专用样式
 * 
 * 使用全局CSS变量，确保视觉一致性
 * 铁则合规：纯渲染层样式
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  const MESSAGE_STYLES = `
/* ============================================================
   消息模块样式 - 使用全局CSS变量
   ============================================================ */

/* ===== 消息列表容器 ===== */
.msg-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ===== 消息项 ===== */
.msg-item {
  display: flex;
  flex-direction: column;
  animation: var(--transition-fast);
}

.msg-item.self {
  align-items: flex-end;
}

.msg-item.other {
  align-items: flex-start;
}

.msg-item.system {
  align-items: center;
}

/* ===== 时间戳 ===== */
.msg-time {
  font-size: var(--font-size-2xs);
  color: var(--color-text-time);
  text-align: center;
  margin: var(--space-3) 0 var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--color-bg-page);
  border-radius: var(--radius-pill);
}

/* ===== 消息主体 ===== */
.msg-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  max-width: 75%;
}

.msg-item.self .msg-body {
  flex-direction: row-reverse;
}

/* ===== 头像 ===== */
.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-bg-input);
}

/* ===== 消息气泡 ===== */
.msg-bubble {
  position: relative;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  max-width: 100%;
  word-break: break-word;
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  transition: transform var(--transition-fast);
}

.msg-item.self .msg-bubble {
  background: var(--color-bubble-self);
  color: var(--color-text-primary);
  border-bottom-right-radius: var(--radius-sm);
}

.msg-item.other .msg-bubble {
  background: var(--color-bubble-other);
  color: var(--color-text-primary);
  border: var(--border-thin);
  border-bottom-left-radius: var(--radius-sm);
}

.msg-item.system .msg-bubble {
  background: transparent;
  padding: var(--space-1) var(--space-3);
}

/* ===== 文字消息 ===== */
.msg-content.text {
  white-space: pre-wrap;
}

/* ===== 语音消息 ===== */
.msg-content.voice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 80px;
  cursor: pointer;
  user-select: none;
}

.voice-icon {
  display: flex;
  align-items: center;
  gap: 2px;
}

.voice-wave {
  width: 3px;
  height: 12px;
  background: currentColor;
  border-radius: var(--radius-xs);
  opacity: 0.6;
}

.msg-content.voice.playing .voice-wave {
  animation: voice-wave 0.6s ease-in-out infinite;
}

.msg-content.voice.playing .voice-wave:nth-child(2) {
  animation-delay: 0.1s;
}

.msg-content.voice.playing .voice-wave:nth-child(3) {
  animation-delay: 0.2s;
}

@keyframes voice-wave {
  0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
  50% { transform: scaleY(1); opacity: 1; }
}

.voice-duration {
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

.voice-play-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(0,0,0,0.1);
  border-radius: var(--radius-full);
  font-size: 10px;
  cursor: pointer;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-content.voice.played {
  opacity: 0.7;
}

/* ===== 红包消息 ===== */
.msg-content.redpack {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: linear-gradient(135deg, #fa9d3b 0%, #f56c1e 100%);
  color: white;
  min-width: 200px;
  cursor: pointer;
  user-select: none;
  border-radius: var(--radius-lg);
}

.msg-content.redpack.opened {
  background: linear-gradient(135deg, #f0c0a0 0%, #e0a080 100%);
}

.msg-content.redpack.expired {
  background: linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%);
}

.redpack-icon {
  font-size: 36px;
  line-height: 1;
}

.redpack-info {
  flex: 1;
}

.redpack-blessing {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-1);
}

.redpack-status {
  font-size: var(--font-size-xs);
  opacity: 0.9;
}

.msg-content.redpack.wiggling {
  animation: anim-wiggle 0.5s ease-in-out;
}

/* ===== 图片消息 ===== */
.msg-content.image {
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  max-width: 200px;
  cursor: pointer;
}

.msg-content.image img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: var(--radius-lg);
}

/* ===== 转账消息 ===== */
.msg-content.transfer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-brand-warning);
  color: white;
  min-width: 180px;
  cursor: pointer;
  user-select: none;
  border-radius: var(--radius-lg);
}

.msg-content.transfer.received {
  background: #c0c0c0;
}

.msg-content.transfer.refunded {
  background: #a0a0a0;
}

.transfer-icon {
  font-size: 32px;
}

.transfer-amount {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  flex: 1;
}

.transfer-status {
  font-size: var(--font-size-xs);
  opacity: 0.9;
}

/* ===== 位置消息 ===== */
.msg-content.location {
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--color-bg-card);
  border: var(--border-thin);
  cursor: pointer;
  min-width: 200px;
}

.location-map {
  height: 100px;
  background: linear-gradient(135deg, #e8f4e8 0%, #d0e8d0 100%);
  position: relative;
}

.location-map::after {
  content: '📍';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
}

.location-info {
  padding: var(--space-3);
}

.location-name {
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-1);
}

.location-address {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

/* ===== 贴纸消息 ===== */
.msg-content.sticker {
  padding: 0;
  background: transparent;
}

.msg-content.sticker.emoji {
  font-size: 48px;
  line-height: 1;
}

.msg-content.sticker img {
  max-width: 120px;
  max-height: 120px;
}

/* ===== 系统消息 ===== */
.msg-system {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  text-align: center;
  padding: var(--space-2) var(--space-4);
  background: var(--color-bg-page);
  border-radius: var(--radius-pill);
}

/* ===== 消息操作菜单 ===== */
.msg-actions {
  position: absolute;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2) 0;
  min-width: 120px;
  z-index: 100;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.msg-action-item {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.msg-action-item:hover {
  background: var(--color-bg-hover);
}

.msg-action-item.danger {
  color: var(--color-danger);
}

/* ===== 正在输入指示器 ===== */
.msg-typing {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  border: var(--border-thin);
  align-self: flex-start;
  margin-left: 44px;
}

/* ===== 响应式 ===== */
@media (max-width: 375px) {
  .msg-body {
    max-width: 85%;
  }
  
  .msg-content.redpack,
  .msg-content.transfer,
  .msg-content.location {
    min-width: 160px;
  }
}
`;

  // IIFE 挂载
  window.MESSAGE_STYLES = MESSAGE_STYLES;

})();
