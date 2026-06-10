/**
 * Phone Dialog - 全局弹窗组件
 *
 * 提供 Toast、Alert、Confirm、Prompt 四种弹窗类型。
 * 所有弹窗渲染在手机壳 .phone-screen 内部。
 * iOS 风格设计：毛玻璃背景、圆角、系统字体。
 * 支持队列机制，多个弹窗依次显示。
 */

;(function () {
  'use strict';

  // ==================== 常量 ====================

  var STYLE_ID = 'phone-dialog-styles';
  var Z_INDEX = 9999;

  // Toast 类型颜色
  var TYPE_COLORS = {
    success: '#34c759',
    error: '#ff3b30',
    warning: '#ff9500',
    info: '#007aff',
  };

  // Toast 类型 SVG 图标
  var TYPE_ICONS = {
    success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#34c759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ff3b30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ff9500" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#007aff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  // ==================== 状态 ====================

  var _mountPoint = null;
  var _queue = [];
  var _isShowing = false;

  // ==================== 工具函数 ====================

  /**
   * 转义 HTML 特殊字符
   */
  function escapeHTML(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 确保挂载点存在
   */
  function ensureMountPoint() {
    if (!_mountPoint) {
      console.warn('[PhoneDialog] 挂载点未设置，尝试查找 .phone-screen');
      _mountPoint = document.querySelector('.phone-screen');
    }
    return _mountPoint;
  }

  /**
   * 处理队列中的下一个弹窗
   */
  function processQueue() {
    if (_isShowing || _queue.length === 0) return;
    _isShowing = true;
    var item = _queue.shift();
    item.execute(function () {
      _isShowing = false;
      // 延迟一帧再处理下一个，避免动画冲突
      requestAnimationFrame(function () {
        processQueue();
      });
    });
  }

  /**
   * 入队一个弹窗任务
   */
  function enqueue(executeFn) {
    return new Promise(function (resolve) {
      _queue.push({
        execute: function (done) {
          executeFn(done, resolve);
        },
      });
      processQueue();
    });
  }

  // ==================== 样式注入 ====================

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      /* ========== 弹窗容器 ========== */
      '.phone-dlg-container {',
      '  position: absolute;',
      '  inset: 0;',
      '  z-index: ' + Z_INDEX + ';',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  pointer-events: none;',
      '  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;',
      '  -webkit-font-smoothing: antialiased;',
      '  -moz-osx-font-smoothing: grayscale;',
      '}',

      /* ========== 遮罩层 ========== */
      '.phone-dlg-overlay {',
      '  position: absolute;',
      '  inset: 0;',
      '  background: rgba(0, 0, 0, 0.3);',
      '  backdrop-filter: blur(8px);',
      '  -webkit-backdrop-filter: blur(8px);',
      '  pointer-events: auto;',
      '  animation: phone-dlg-fade-in 0.25s ease-out;',
      '}',
      '.phone-dlg-overlay.phone-dlg-closing {',
      '  animation: phone-dlg-fade-out 0.2s ease-in forwards;',
      '}',

      /* ========== 弹窗主体 ========== */
      '.phone-dlg-dialog {',
      '  position: relative;',
      '  background: #fff;',
      '  border-radius: 14px;',
      '  overflow: hidden;',
      '  pointer-events: auto;',
      '  min-width: 270px;',
      '  max-width: 300px;',
      '  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 12px rgba(0, 0, 0, 0.1);',
      '  animation: phone-dlg-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);',
      '}',
      '.phone-dlg-dialog.phone-dlg-closing {',
      '  animation: phone-dlg-scale-out 0.2s ease-in forwards;',
      '}',

      /* ========== 弹窗标题 ========== */
      '.phone-dlg-title {',
      '  font-size: 17px;',
      '  font-weight: 600;',
      '  color: #000;',
      '  text-align: center;',
      '  padding: 20px 16px 4px;',
      '  letter-spacing: -0.2px;',
      '}',

      /* ========== 弹窗消息 ========== */
      '.phone-dlg-message {',
      '  font-size: 13px;',
      '  font-weight: 400;',
      '  color: #3a3a3c;',
      '  text-align: center;',
      '  padding: 4px 16px 20px;',
      '  line-height: 1.5;',
      '}',

      /* ========== 弹窗输入框 ========== */
      '.phone-dlg-input-wrap {',
      '  padding: 0 16px 16px;',
      '}',
      '.phone-dlg-input {',
      '  width: 100%;',
      '  padding: 10px 12px;',
      '  border: 1px solid #e5e5ea;',
      '  border-radius: 10px;',
      '  font-size: 15px;',
      '  outline: none;',
      '  transition: border-color 0.2s;',
      '  box-sizing: border-box;',
      '  font-family: inherit;',
      '  -webkit-font-smoothing: antialiased;',
      '  -moz-osx-font-smoothing: grayscale;',
      '}',
      '.phone-dlg-input:focus {',
      '  border-color: #007aff;',
      '}',

      /* ========== 弹窗按钮区域 ========== */
      '.phone-dlg-actions {',
      '  display: flex;',
      '  border-top: 0.5px solid rgba(0, 0, 0, 0.1);',
      '}',
      '.phone-dlg-btn {',
      '  flex: 1;',
      '  padding: 12px 8px;',
      '  border: none;',
      '  background: none;',
      '  font-size: 17px;',
      '  cursor: pointer;',
      '  transition: background 0.15s;',
      '  font-family: inherit;',
      '  font-weight: 400;',
      '  letter-spacing: -0.2px;',
      '}',
      '.phone-dlg-btn:active {',
      '  background: rgba(0, 0, 0, 0.06);',
      '}',
      '.phone-dlg-btn-cancel {',
      '  color: #007aff;',
      '  border-right: 0.5px solid rgba(0, 0, 0, 0.1);',
      '}',
      '.phone-dlg-btn-confirm {',
      '  color: #007aff;',
      '  font-weight: 600;',
      '}',

      /* ========== Toast ========== */
      '.phone-dlg-toast-wrap {',
      '  position: absolute;',
      '  bottom: 80px;',
      '  left: 50%;',
      '  transform: translateX(-50%);',
      '  z-index: ' + Z_INDEX + ';',
      '  display: flex;',
      '  flex-direction: column-reverse;',
      '  align-items: center;',
      '  gap: 8px;',
      '  pointer-events: none;',
      '}',
      '.phone-dlg-toast {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 12px 20px;',
      '  border-radius: 14px;',
      '  background: rgba(255, 255, 255, 0.88);',
      '  backdrop-filter: blur(20px) saturate(180%);',
      '  -webkit-backdrop-filter: blur(20px) saturate(180%);',
      '  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);',
      '  font-size: 14px;',
      '  font-weight: 500;',
      '  color: #1d1d1f;',
      '  white-space: nowrap;',
      '  animation: phone-dlg-toast-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);',
      '  pointer-events: auto;',
      '  border: 0.5px solid rgba(255, 255, 255, 0.6);',
      '}',
      '.phone-dlg-toast.phone-dlg-closing {',
      '  animation: phone-dlg-toast-out 0.25s ease-in forwards;',
      '}',

      /* ========== 动画 ========== */
      '@keyframes phone-dlg-fade-in {',
      '  from { opacity: 0; }',
      '  to { opacity: 1; }',
      '}',
      '@keyframes phone-dlg-fade-out {',
      '  from { opacity: 1; }',
      '  to { opacity: 0; }',
      '}',
      '@keyframes phone-dlg-scale-in {',
      '  from { opacity: 0; transform: scale(0.9); }',
      '  to { opacity: 1; transform: scale(1); }',
      '}',
      '@keyframes phone-dlg-scale-out {',
      '  from { opacity: 1; transform: scale(1); }',
      '  to { opacity: 0; transform: scale(0.9); }',
      '}',
      '@keyframes phone-dlg-toast-in {',
      '  from { opacity: 0; transform: translateY(20px) scale(0.9); }',
      '  to { opacity: 1; transform: translateY(0) scale(1); }',
      '}',
      '@keyframes phone-dlg-toast-out {',
      '  from { opacity: 1; transform: translateY(0) scale(1); }',
      '  to { opacity: 0; transform: translateY(20px) scale(0.9); }',
      '}',
    ].join('\n');

    document.head.appendChild(style);
  }

  // ==================== Toast ====================

  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 2000;

    var mount = ensureMountPoint();
    if (!mount) {
      console.warn('[PhoneDialog] 无法显示 Toast: 挂载点不存在');
      return;
    }

    // 确保 Toast 容器存在
    var toastWrap = mount.querySelector('.phone-dlg-toast-wrap');
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'phone-dlg-toast-wrap';
      mount.appendChild(toastWrap);
    }

    // 创建 Toast 元素
    var toast = document.createElement('div');
    toast.className = 'phone-dlg-toast';
    toast.innerHTML = (TYPE_ICONS[type] || TYPE_ICONS.info) +
      '<span>' + escapeHTML(message) + '</span>';

    toastWrap.appendChild(toast);

    // 自动消失
    setTimeout(function () {
      toast.classList.add('phone-dlg-closing');
      toast.addEventListener('animationend', function () {
        toast.remove();
        // 如果容器为空则移除容器
        if (toastWrap.children.length === 0) {
          toastWrap.remove();
        }
      });
    }, duration);
  }

  // ==================== Alert ====================

  function showAlert(options) {
    var title = options.title || '';
    var message = options.message || '';
    var confirmText = options.confirmText || '\u786e\u5b9a';

    return enqueue(function (done, resolve) {
      var mount = ensureMountPoint();
      if (!mount) {
        console.warn('[PhoneDialog] 无法显示 Alert: 挂载点不存在');
        resolve();
        done();
        return;
      }

      // 创建容器
      var container = document.createElement('div');
      container.className = 'phone-dlg-container';

      // 遮罩
      var overlay = document.createElement('div');
      overlay.className = 'phone-dlg-overlay';

      // 弹窗
      var dialog = document.createElement('div');
      dialog.className = 'phone-dlg-dialog';

      var html = '';
      if (title) {
        html += '<div class="phone-dlg-title">' + escapeHTML(title) + '</div>';
      }
      if (message) {
        html += '<div class="phone-dlg-message">' + escapeHTML(message) + '</div>';
      }
      html += '<div class="phone-dlg-actions">';
      html += '<button class="phone-dlg-btn phone-dlg-btn-confirm">' + escapeHTML(confirmText) + '</button>';
      html += '</div>';

      dialog.innerHTML = html;
      container.appendChild(overlay);
      container.appendChild(dialog);
      mount.appendChild(container);

      // 关闭函数
      function close() {
        overlay.classList.add('phone-dlg-closing');
        dialog.classList.add('phone-dlg-closing');
        dialog.addEventListener('animationend', function () {
          container.remove();
          resolve();
          done();
        });
      }

      // 绑定确认按钮
      dialog.querySelector('.phone-dlg-btn-confirm').addEventListener('click', close);

      // 点击遮罩也可关闭
      overlay.addEventListener('click', close);
    });
  }

  // ==================== Confirm ====================

  function showConfirm(options) {
    var title = options.title || '';
    var message = options.message || '';
    var confirmText = options.confirmText || '\u786e\u5b9a';
    var cancelText = options.cancelText || '\u53d6\u6d88';

    return enqueue(function (done, resolve) {
      var mount = ensureMountPoint();
      if (!mount) {
        console.warn('[PhoneDialog] 无法显示 Confirm: 挂载点不存在');
        resolve(false);
        done();
        return;
      }

      // 创建容器
      var container = document.createElement('div');
      container.className = 'phone-dlg-container';

      // 遮罩
      var overlay = document.createElement('div');
      overlay.className = 'phone-dlg-overlay';

      // 弹窗
      var dialog = document.createElement('div');
      dialog.className = 'phone-dlg-dialog';

      var html = '';
      if (title) {
        html += '<div class="phone-dlg-title">' + escapeHTML(title) + '</div>';
      }
      if (message) {
        html += '<div class="phone-dlg-message">' + escapeHTML(message) + '</div>';
      }
      html += '<div class="phone-dlg-actions">';
      html += '<button class="phone-dlg-btn phone-dlg-btn-cancel">' + escapeHTML(cancelText) + '</button>';
      html += '<button class="phone-dlg-btn phone-dlg-btn-confirm">' + escapeHTML(confirmText) + '</button>';
      html += '</div>';

      dialog.innerHTML = html;
      container.appendChild(overlay);
      container.appendChild(dialog);
      mount.appendChild(container);

      // 关闭函数
      function close(result) {
        overlay.classList.add('phone-dlg-closing');
        dialog.classList.add('phone-dlg-closing');
        dialog.addEventListener('animationend', function () {
          container.remove();
          resolve(result);
          done();
        });
      }

      // 绑定按钮
      dialog.querySelector('.phone-dlg-btn-cancel').addEventListener('click', function () {
        close(false);
      });
      dialog.querySelector('.phone-dlg-btn-confirm').addEventListener('click', function () {
        close(true);
      });

      // 点击遮罩 = 取消
      overlay.addEventListener('click', function () {
        close(false);
      });
    });
  }

  // ==================== Prompt ====================

  function showPrompt(options) {
    var title = options.title || '';
    var message = options.message || '';
    var placeholder = options.placeholder || '';
    var confirmText = options.confirmText || '\u786e\u5b9a';
    var cancelText = options.cancelText || '\u53d6\u6d88';
    var inputType = options.inputType || 'text';

    return enqueue(function (done, resolve) {
      var mount = ensureMountPoint();
      if (!mount) {
        console.warn('[PhoneDialog] 无法显示 Prompt: 挂载点不存在');
        resolve(null);
        done();
        return;
      }

      // 创建容器
      var container = document.createElement('div');
      container.className = 'phone-dlg-container';

      // 遮罩
      var overlay = document.createElement('div');
      overlay.className = 'phone-dlg-overlay';

      // 弹窗
      var dialog = document.createElement('div');
      dialog.className = 'phone-dlg-dialog';

      var html = '';
      if (title) {
        html += '<div class="phone-dlg-title">' + escapeHTML(title) + '</div>';
      }
      if (message) {
        html += '<div class="phone-dlg-message">' + escapeHTML(message) + '</div>';
      }
      html += '<div class="phone-dlg-input-wrap">';
      html += '<input class="phone-dlg-input" type="' + escapeHTML(inputType) + '" placeholder="' + escapeHTML(placeholder) + '" />';
      html += '</div>';
      html += '<div class="phone-dlg-actions">';
      html += '<button class="phone-dlg-btn phone-dlg-btn-cancel">' + escapeHTML(cancelText) + '</button>';
      html += '<button class="phone-dlg-btn phone-dlg-btn-confirm">' + escapeHTML(confirmText) + '</button>';
      html += '</div>';

      dialog.innerHTML = html;
      container.appendChild(overlay);
      container.appendChild(dialog);
      mount.appendChild(container);

      // 获取输入框引用
      var input = dialog.querySelector('.phone-dlg-input');

      // 自动聚焦
      setTimeout(function () {
        input.focus();
      }, 100);

      // 关闭函数
      function close(result) {
        overlay.classList.add('phone-dlg-closing');
        dialog.classList.add('phone-dlg-closing');
        dialog.addEventListener('animationend', function () {
          container.remove();
          resolve(result);
          done();
        });
      }

      // 绑定按钮
      dialog.querySelector('.phone-dlg-btn-cancel').addEventListener('click', function () {
        close(null);
      });
      dialog.querySelector('.phone-dlg-btn-confirm').addEventListener('click', function () {
        close(input.value || '');
      });

      // 回车确认
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          close(input.value || '');
        }
      });

      // 点击遮罩 = 取消
      overlay.addEventListener('click', function () {
        close(null);
      });
    });
  }

  // ==================== 设置挂载点 ====================

  function setMountPoint(screenEl) {
    _mountPoint = screenEl;
    console.log('[PhoneDialog] 挂载点已设置');
  }

  // ==================== 暴露 API ====================

  window.PhoneDialog = {
    showToast: showToast,
    showAlert: showAlert,
    showConfirm: showConfirm,
    showPrompt: showPrompt,
    setMountPoint: setMountPoint,
    _injectStyles: _injectStyles,
  };

  // 自动注入样式
  _injectStyles();

  console.log('[PhoneDialog] 全局弹窗组件已加载');
})();
