/**
 * 全局设计令牌系统 (Design Tokens)
 * 
 * 所有模块必须使用此文件定义的 CSS 变量，禁止硬编码颜色/字体/间距。
 * 本文件在 phone-shell.js 启动时注入到 document.documentElement。
 * 
 * 铁则合规：
 * - 纯渲染层改动，不影响数据流
 * - 不操作DOM（仅提供CSS变量）
 * - 不包含任何业务逻辑
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

const DESIGN_TOKENS = `/* ============================================================
   全局设计令牌 - Design Tokens
   所有模块必须使用 CSS 变量，禁止硬编码
   ============================================================ */

:root {
  /* ===== 颜色系统 ===== */

  /* 背景色 */
  --color-bg-page: #f5f5f5;
  --color-bg-card: #ffffff;
  --color-bg-ios: #f2f2f7;
  --color-bg-wechat: #ededed;
  --color-bg-input: #f7f7f7;
  --color-bg-pressed: #f0f0f0;
  --color-bg-active: #ececec;
  --color-bg-hover: rgba(0, 0, 0, 0.04);
  --color-bg-overlay: rgba(0, 0, 0, 0.4);
  --color-bg-overlay-light: rgba(0, 0, 0, 0.15);

  /* 文字色 */
  --color-text-primary: #1C1C1E;
  --color-text-secondary: #333333;
  --color-text-tertiary: #888888;
  --color-text-placeholder: #999999;
  --color-text-disabled: #C7C7CC;
  --color-text-time: #b0b0b0;
  --color-text-ios-gray: #8E8E93;
  --color-text-white: #ffffff;

  /* 品牌色 */
  --color-brand-blue: #007AFF;
  --color-brand-green: #07C160;
  --color-brand-green-dark: #06ad56;
  --color-brand-red: #ff3b30;
  --color-brand-orange: #ff9500;
  --color-brand-purple: #667eea;
  --color-brand-success: #34c759;
  --color-brand-warning: #FFD700;
  --color-brand-link: #576b95;

  /* 模块品牌色（各模块保留独立品牌色） */
  --color-module-message: #07C160;
  --color-module-weibo: #FF8200;
  --color-module-forum: #ff2442;
  --color-module-live: #FF6B35;
  --color-module-shop: #e74c3c;
  --color-module-inventory: #e67e22;
  --color-module-status: #667eea;
  --color-module-diary: #5856D6;
  --color-module-task: #FF9500;
  --color-module-profile: #FF2D55;
  --color-module-api: #8E8E93;

  /* 边框色 */
  --color-border-light: #f0f0f0;
  --color-border-default: #e5e5e5;
  --color-border-ios: #e5e5ea;
  --color-border-medium: #dddddd;
  --color-border-dark: #C6C6C8;

  /* 功能色 */
  --color-danger: #ff3b30;
  --color-success: #34c759;
  --color-warning: #ff9500;
  --color-info: #007AFF;

  /* 聊天气泡 */
  --color-bubble-self: #95ec69;
  --color-bubble-other: #ffffff;
  --color-red-dot: #fa5151;

  /* ===== 字体系统 ===== */

  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  --font-family-cn: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;

  /* 字号阶梯 */
  --font-size-xs: 10px;
  --font-size-2xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 15px;
  --font-size-xl: 16px;
  --font-size-2xl: 17px;
  --font-size-3xl: 18px;
  --font-size-4xl: 20px;
  --font-size-5xl: 28px;
  --font-size-6xl: 34px;

  /* 字重 */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* 行高 */
  --line-height-tight: 1.2;
  --line-height-normal: 1.4;
  --line-height-relaxed: 1.6;

  /* ===== 圆角系统 ===== */

  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
  --radius-2xl: 14px;
  --radius-3xl: 16px;
  --radius-pill: 18px;
  --radius-4xl: 20px;
  --radius-full: 50%;

  /* ===== 阴影系统 ===== */

  --shadow-xs: 0 0.5px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.2);
  --shadow-dialog: 0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 12px rgba(0, 0, 0, 0.1);
  --shadow-toast: 0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
  --shadow-float: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* ===== 间距系统 ===== */

  --space-0: 0px;
  --space-1: 4px;
  --space-2: 6px;
  --space-3: 8px;
  --space-4: 10px;
  --space-5: 12px;
  --space-6: 14px;
  --space-7: 16px;
  --space-8: 20px;
  --space-9: 24px;
  --space-10: 32px;
  --space-11: 40px;

  /* ===== 过渡系统 ===== */

  --ease-default: ease;
  --ease-ios: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-medium: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;

  --transition-fast: var(--duration-fast) var(--ease-default);
  --transition-normal: var(--duration-normal) var(--ease-default);
  --transition-medium: var(--duration-medium) var(--ease-default);
  --transition-slow: var(--duration-slow) var(--ease-default);
  --transition-spring: var(--duration-slow) var(--ease-spring);
  --transition-ios: var(--duration-slow) var(--ease-ios);

  /* ===== 分割线 ===== */

  --border-thin: 0.5px solid var(--color-border-default);
  --border-ios: 0.5px solid var(--color-border-ios);
  --border-light: 0.5px solid var(--color-border-light);
  --border-medium: 1px solid var(--color-border-medium);

  /* ===== 安全区域 ===== */

  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);

  /* ===== 毛玻璃效果 ===== */

  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-blur: 20px;
  --glass-border: 1px solid rgba(255, 255, 255, 0.18);
  --glass-bg-heavy: rgba(255, 255, 255, 0.85);
  --glass-blur-heavy: 40px;
  --glass-bg-light: rgba(255, 255, 255, 0.45);
  --glass-blur-light: 12px;

  /* ===== 渐变色系统（应用图标渐变） ===== */

  --gradient-message: linear-gradient(135deg, #07C160 0%, #06ad56 100%);
  --gradient-weibo: linear-gradient(135deg, #FF8200 0%, #FF6B00 100%);
  --gradient-forum: linear-gradient(135deg, #ff2442 0%, #e91e63 100%);
  --gradient-live: linear-gradient(135deg, #FF6B35 0%, #FF4500 100%);
  --gradient-shop: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  --gradient-diary: linear-gradient(135deg, #5856D6 0%, #7B68EE 100%);
  --gradient-status: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-profile: linear-gradient(135deg, #FF2D55 0%, #FF6B81 100%);

  /* 通用渐变 */
  --gradient-warm: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --gradient-cool: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  --gradient-sunset: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  --gradient-ocean: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  --gradient-aurora: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);

  /* ===== 卡片悬浮效果 ===== */

  --card-hover-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  --card-hover-transform: translateY(-2px);
  --card-hover-transition: transform var(--duration-normal) var(--ease-spring), box-shadow var(--duration-normal) var(--ease-default);
  --card-press-transform: translateY(0) scale(0.98);
  --card-press-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  /* ===== 论坛 CSS 变量体系 ===== */

  --forum-bg: #ffffff;
  --forum-bg-secondary: #f8f9fa;
  --forum-bg-hot: #fff8f0;
  --forum-bg-pinned: #f0f7ff;
  --forum-text-title: #1a1a1a;
  --forum-text-content: #333333;
  --forum-text-meta: #999999;
  --forum-text-tag: #576b95;
  --forum-border-post: #f0f0f0;
  --forum-border-divider: #e8e8e8;
  --forum-accent-hot: #ff2442;
  --forum-accent-pinned: #007AFF;
  --forum-accent-tag-bg: rgba(87, 107, 149, 0.08);
  --forum-accent-tag-border: rgba(87, 107, 149, 0.2);
  --forum-avatar-size: 40px;
  --forum-post-padding: 12px 16px;
  --forum-reply-indent: 40px;

  /* ===== 手机面板尺寸 ===== */

  --phone-width: 375px;
  --phone-height: 812px;
  --phone-radius: 40px;
  --phone-statusbar-height: 54px;
  --phone-navbar-height: 44px;
  --phone-tabbar-height: 83px;
  --phone-content-height: calc(var(--phone-height) - var(--phone-statusbar-height) - var(--phone-navbar-height));
}

/* ===== 暗色主题 ===== */

[data-theme="dark"] {
  --color-bg-page: #111111;
  --color-bg-card: #1c1c1e;
  --color-bg-ios: #1c1c1e;
  --color-bg-wechat: #111111;
  --color-bg-input: #2c2c2e;
  --color-bg-pressed: #3a3a3c;
  --color-bg-active: #2c2c2e;
  --color-bg-hover: rgba(255, 255, 255, 0.06);
  --color-bg-overlay: rgba(0, 0, 0, 0.6);
  --color-bg-overlay-light: rgba(0, 0, 0, 0.3);

  --color-text-primary: #ffffff;
  --color-text-secondary: #e5e5ea;
  --color-text-tertiary: #98989d;
  --color-text-placeholder: #636366;
  --color-text-disabled: #48484a;
  --color-text-time: #636366;
  --color-text-ios-gray: #98989d;

  --color-border-light: #2c2c2e;
  --color-border-default: #38383a;
  --color-border-ios: #38383a;
  --color-border-medium: #48484a;
  --color-border-dark: #636366;

  --color-bubble-self: #2c2c2e;
  --color-bubble-other: #1c1c1e;

  --shadow-xs: 0 0.5px 2px rgba(0, 0, 0, 0.2);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.5);
  --shadow-dialog: 0 8px 40px rgba(0, 0, 0, 0.5), 0 2px 12px rgba(0, 0, 0, 0.3);
  --shadow-toast: 0 4px 20px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.2);

  /* ===== 暗色主题：模块品牌色覆盖（降低饱和度适配深色背景） ===== */

  --color-module-message: #2ecc71;
  --color-module-weibo: #FF9F43;
  --color-module-forum: #ff6b81;
  --color-module-live: #FF8C5A;
  --color-module-shop: #e57373;
  --color-module-inventory: #f0a04b;
  --color-module-status: #8599e8;
  --color-module-diary: #7c7ce0;
  --color-module-task: #ffb347;
  --color-module-profile: #ff5c7c;
  --color-module-api: #a0a0a5;

  /* ===== 暗色主题：毛玻璃效果覆盖 ===== */

  --glass-bg: rgba(30, 30, 30, 0.72);
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-bg-heavy: rgba(30, 30, 30, 0.88);
  --glass-bg-light: rgba(30, 30, 30, 0.45);

  /* ===== 暗色主题：卡片悬浮效果覆盖 ===== */

  --card-hover-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  --card-press-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

  /* ===== 暗色主题：论坛变量覆盖 ===== */

  --forum-bg: #1c1c1e;
  --forum-bg-secondary: #2c2c2e;
  --forum-bg-hot: #2a1f1a;
  --forum-bg-pinned: #1a2233;
  --forum-text-title: #e5e5ea;
  --forum-text-content: #d1d1d6;
  --forum-text-meta: #636366;
  --forum-border-post: #2c2c2e;
  --forum-border-divider: #38383a;
  --forum-accent-tag-bg: rgba(87, 107, 149, 0.15);
  --forum-accent-tag-border: rgba(87, 107, 149, 0.3);
}
`;

// IIFE 模式挂载到 window，供 phone-shell.js 使用
;(function () {
  'use strict';
  window.DESIGN_TOKENS = DESIGN_TOKENS;
})();
