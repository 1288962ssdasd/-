/**
 * PhoneUtils - 统一工具函数
 * 所有辅助函数的唯一来源，避免重复定义
 */

;(function () {
  'use strict';

  window.PhoneUtils = window.PhoneUtils || {};

  /**
   * 统一 HTML 转义函数 — 全局唯一实现
   * 转义：& < > " '
   * @param {*} text - 要转义的值
   * @returns {string} 转义后的安全字符串
   */
  window.PhoneUtils.escapeHtml = function (text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
})();
