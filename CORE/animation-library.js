/**
 * 标准动画类库 (Animation Library)
 * 
 * 提供全局可复用的CSS动画类，所有模块统一使用。
 * 本文件在 phone-shell.js 启动时注入到 document.documentElement。
 * 
 * 铁则合规：
 * - 纯渲染层改动，不影响数据流
 * - 不操作DOM（仅提供CSS类）
 * - 不包含任何业务逻辑
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

const ANIMATION_CLASSES = `
/* ============================================================
   标准动画类库
   使用方式：element.classList.add('anim-fade-in')
   ============================================================ */

/* ===== 入场动画 ===== */

/* 淡入 */
.anim-fade-in {
  animation: anim-fade-in var(--duration-slow) var(--ease-default) both;
}
@keyframes anim-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 上滑入场 */
.anim-slide-up {
  animation: anim-slide-up var(--duration-slow) var(--ease-spring) both;
}
@keyframes anim-slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 下滑入场 */
.anim-slide-down {
  animation: anim-slide-down var(--duration-slow) var(--ease-spring) both;
}
@keyframes anim-slide-down {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 左滑入场 */
.anim-slide-left {
  animation: anim-slide-left var(--duration-slow) var(--ease-ios) both;
}
@keyframes anim-slide-left {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 右滑入场 */
.anim-slide-right {
  animation: anim-slide-right var(--duration-slow) var(--ease-ios) both;
}
@keyframes anim-slide-right {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 缩放入场 */
.anim-scale-in {
  animation: anim-scale-in var(--duration-medium) var(--ease-spring) both;
}
@keyframes anim-scale-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* 弹跳入场 */
.anim-bounce-in {
  animation: anim-bounce-in 500ms var(--ease-spring) both;
}
@keyframes anim-bounce-in {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* 消息气泡入场 */
.anim-msg-enter {
  animation: anim-msg-enter 300ms var(--ease-spring) both;
}
@keyframes anim-msg-enter {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ===== 退场动画 ===== */

/* 淡出 */
.anim-fade-out {
  animation: anim-fade-out var(--duration-medium) var(--ease-default) both;
}
@keyframes anim-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* 上滑退场 */
.anim-slide-up-out {
  animation: anim-slide-up-out var(--duration-medium) var(--ease-default) both;
}
@keyframes anim-slide-up-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}

/* 缩小退场 */
.anim-scale-out {
  animation: anim-scale-out var(--duration-medium) var(--ease-default) both;
}
@keyframes anim-scale-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.9); }
}

/* ===== 反馈动画 ===== */

/* 抖动（错误提示） */
.anim-shake {
  animation: anim-shake 400ms var(--ease-default);
}
@keyframes anim-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

/* 脉冲（通知提醒） */
.anim-pulse {
  animation: anim-pulse 2s var(--ease-default) infinite;
}
@keyframes anim-pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

/* 呼吸灯（直播LIVE徽章） */
.anim-breathe {
  animation: anim-breathe 2s var(--ease-default) infinite;
}
@keyframes anim-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 摇晃（红包未领取） */
.anim-wiggle {
  animation: anim-wiggle 0.5s var(--ease-default);
}
@keyframes anim-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}

/* 点击缩放反馈 */
.anim-tap {
  animation: anim-tap 150ms var(--ease-default);
}
@keyframes anim-tap {
  0% { transform: scale(1); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* ===== 加载动画 ===== */

/* 旋转加载 */
.anim-spin {
  animation: anim-spin 0.8s linear infinite;
}
@keyframes anim-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 骨架屏闪烁 */
.anim-skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: anim-skeleton 1.5s ease-in-out infinite;
}
[data-theme="dark"] .anim-skeleton {
  background: linear-gradient(90deg, #2c2c2e 25%, #3a3a3c 50%, #2c2c2e 75%);
  background-size: 200% 100%;
}
@keyframes anim-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 弹跳点（正在输入） */
.anim-dots span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  animation: anim-dot-bounce 1.4s ease-in-out infinite both;
}
.anim-dots span:nth-child(1) { animation-delay: 0s; }
.anim-dots span:nth-child(2) { animation-delay: 0.16s; }
.anim-dots span:nth-child(3) { animation-delay: 0.32s; }
@keyframes anim-dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ===== 通知动画 ===== */

/* 通知横幅入场 */
.anim-banner-in {
  animation: anim-banner-in 400ms var(--ease-spring) both;
}
@keyframes anim-banner-in {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 通知横幅退场 */
.anim-banner-out {
  animation: anim-banner-out 300ms var(--ease-default) both;
}
@keyframes anim-banner-out {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-100%); opacity: 0; }
}

/* Toast 入场 */
.anim-toast-in {
  animation: anim-toast-in 300ms var(--ease-spring) both;
}
@keyframes anim-toast-in {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Toast 退场 */
.anim-toast-out {
  animation: anim-toast-out 200ms var(--ease-default) both;
}
@keyframes anim-toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-10px) scale(0.95); }
}

/* ===== 数值变化动画 ===== */

/* 伤害数字飘字 */
.anim-damage-float {
  animation: anim-damage-float 800ms var(--ease-out) both;
}
@keyframes anim-damage-float {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  50% { transform: translateY(-30px) scale(1.2); }
  100% { transform: translateY(-50px) scale(0.8); opacity: 0; }
}

/* 金币掉落 */
.anim-coin-drop {
  animation: anim-coin-drop 600ms var(--ease-spring) both;
}
@keyframes anim-coin-drop {
  0% { transform: translateY(-20px) scale(0.5); opacity: 0; }
  60% { transform: translateY(5px) scale(1.1); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

/* ===== 模块切换过渡 ===== */

/* 模块淡出 */
.anim-module-out {
  animation: anim-module-out 200ms var(--ease-default) both;
}
@keyframes anim-module-out {
  to { opacity: 0; transform: scale(0.98); }
}

/* 模块淡入 */
.anim-module-in {
  animation: anim-module-in 300ms var(--ease-ios) both;
}
@keyframes anim-module-in {
  from { opacity: 0; transform: scale(1.02); }
  to { opacity: 1; transform: scale(1); }
}

/* ===== 视差壁纸 ===== */

.parallax-wallpaper {
  position: fixed;
  inset: -20px;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.parallax-wallpaper .wallpaper-layer {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  transition: transform 0.1s ease-out;
}

/* ===== 通用工具类 ===== */

/* 隐藏 */
.anim-hidden { display: none !important; }

/* 不可见但占位 */
.anim-invisible { visibility: hidden; }

/* 禁用动画（无障碍） */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

// IIFE 模式挂载到 window，供 phone-shell.js 使用
;(function () {
  'use strict';
  window.ANIMATION_CLASSES = ANIMATION_CLASSES;
})();
