/**
 * font-fix-styles.js - 字体模糊修复样式注入
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 注入字体模糊修复样式
   */
  function inject() {
    if (document.getElementById('phone-font-fix-styles')) return;

    var style = document.createElement('style');
    style.id = 'phone-font-fix-styles';
    style.textContent = [
      '.phone-screen input,',
      '.phone-screen textarea,',
      '.phone-screen [contenteditable="true"],',
      '.msg-input,',
      '.post-input,',
      '.dialog-input,',
      '.add-friend-input,',
      '.api-input,',
      '.api-textarea,',
      '.phone-app-container input,',
      '.phone-app-container textarea {',
      '  -webkit-font-smoothing: antialiased !important;',
      '  -moz-osx-font-smoothing: grayscale !important;',
      '  text-rendering: optimizeLegibility !important;',
      '  font-smooth: always !important;',
      '  transform: translateZ(0) !important;',
      '  backface-visibility: hidden !important;',
      '  perspective: 1000px !important;',
      '}',
      '.msg-bubble-text,',
      '.post-content,',
      '.voice-text,',
      '.transfer-remark,',
      '.redpacket-title {',
      '  -webkit-font-smoothing: antialiased !important;',
      '  -moz-osx-font-smoothing: grayscale !important;',
      '  text-rendering: optimizeLegibility !important;',
      '}',
      '.phone-screen input::placeholder,',
      '.phone-screen textarea::placeholder,',
      '.msg-input::placeholder,',
      '.post-input::placeholder {',
      '  -webkit-font-smoothing: antialiased !important;',
      '  opacity: 0.6 !important;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
    console.info('[Phone Init] 字体模糊修复样式已注入');
  }

  window.PhoneFontFix = {
    inject: inject,
  };

})();
