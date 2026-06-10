/**
 * @layer Renderer
 * @file   avatar-settings-renderer.js
 *
 * 职责: 头像设置模块 UI 渲染
 * 禁止: 包含业务逻辑、调用 Service、直接操作 Schema
 *
 * 铁则合规：
 *   - 纯展示层，只接收数据对象返回 DOM（铁则三）
 *   - 通过 callbacks 回调交互事件，不直接调用 Service
 */

;(function () {
  'use strict';

  // ==================== Renderer 类 ====================

  class AvatarSettingsRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;
      const style = document.createElement('style');
      style.id = 'avatar-settings-module-styles';
      style.textContent = `
        .avatar-settings-app {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f2f2f7;
        }
        .avatar-settings-header {
          padding: 16px;
          background: #fff;
          border-bottom: 1px solid #e5e5ea;
        }
        .avatar-settings-header h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .avatar-settings-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .avatar-settings-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          padding: 16px;
        }
        .avatar-settings-field {
          margin-bottom: 16px;
        }
        .avatar-settings-label {
          font-size: 14px;
          color: #666;
          display: block;
          margin-bottom: 8px;
        }
        .avatar-settings-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e5e5ea;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .avatar-settings-preview {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #e5e5ea;
          margin-top: 8px;
          background-size: cover;
          background-position: center;
        }
        .avatar-settings-btn {
          width: 100%;
          padding: 10px;
          margin-bottom: 8px;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .avatar-settings-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .avatar-settings-btn-primary {
          background: #007aff;
        }
        .avatar-settings-btn-purple {
          background: #5856d6;
        }
        .avatar-settings-btn-green {
          background: #34c759;
        }
        .avatar-settings-btn-orange {
          background: #ff9500;
        }
        .avatar-settings-btn-save {
          padding: 12px;
          font-size: 16px;
          margin-bottom: 12px;
        }
        .avatar-settings-error {
          padding: 12px 16px;
          background: #fff3cd;
          color: #856404;
          border-radius: 8px;
          margin: 12px 16px;
          font-size: 13px;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 主渲染 ====================

    /**
     * 渲染头像设置主界面
     * @param {Object} data - 数据对象 { weiboAvatar, circleAvatar }
     * @param {Object} callbacks - 回调 {
     *   onWeiboPreview, onCirclePreview,
     *   onPickWeiboLocal, onPickCircleLocal,
     *   onAddGallery, onMatchNpc,
     *   onSave
     * }
     * @returns {HTMLElement}
     */
    render(data, callbacks) {
      this.injectStyles();
      const div = document.createElement('div');
      div.className = 'avatar-settings-app';
      div.innerHTML =
        '<div class="avatar-settings-header">' +
          '<h2>头像设置</h2>' +
        '</div>' +
        '<div class="avatar-settings-body">' +
          '<div class="avatar-settings-card">' +
            '<div class="avatar-settings-field">' +
              '<label class="avatar-settings-label">微博头像URL</label>' +
              '<input class="avatar-settings-input" data-ref="weibo-avatar-url" type="text" placeholder="输入头像图片URL" />' +
              '<div class="avatar-settings-preview" data-ref="weibo-avatar-preview"></div>' +
            '</div>' +
            '<div class="avatar-settings-field">' +
              '<label class="avatar-settings-label">朋友圈头像URL</label>' +
              '<input class="avatar-settings-input" data-ref="circle-avatar-url" type="text" placeholder="输入头像图片URL" />' +
              '<div class="avatar-settings-preview" data-ref="circle-avatar-preview"></div>' +
            '</div>' +
            '<button class="avatar-settings-btn avatar-settings-btn-purple" data-action="pick-weibo-local">微博：选择本地图片</button>' +
            '<button class="avatar-settings-btn avatar-settings-btn-purple" data-action="pick-circle-local">朋友圈：选择本地图片</button>' +
            '<button class="avatar-settings-btn avatar-settings-btn-green" data-action="pick-gallery">添加到相册库</button>' +
            '<button class="avatar-settings-btn avatar-settings-btn-orange" data-action="match-npc">为NPC随机匹配相册头像</button>' +
            '<button class="avatar-settings-btn avatar-settings-btn-primary avatar-settings-btn-save" data-action="save">保存设置</button>' +
          '</div>' +
        '</div>';

      // 填充已有数据
      if (data) {
        const weiboInput = div.querySelector('[data-ref="weibo-avatar-url"]');
        const circleInput = div.querySelector('[data-ref="circle-avatar-url"]');
        if (data.weiboAvatar && weiboInput) {
          weiboInput.value = data.weiboAvatar;
          div.querySelector('[data-ref="weibo-avatar-preview"]').style.backgroundImage = 'url(' + data.weiboAvatar + ')';
        }
        if (data.circleAvatar && circleInput) {
          circleInput.value = data.circleAvatar;
          div.querySelector('[data-ref="circle-avatar-preview"]').style.backgroundImage = 'url(' + data.circleAvatar + ')';
        }
      }

      // 绑定交互回调
      this._bindEvents(div, callbacks);
      return div;
    }

    // ==================== 数据更新渲染 ====================

    /**
     * 更新微博头像预览
     * @param {HTMLElement} container - 根容器
     * @param {string} url - 头像 URL
     */
    renderWeiboPreview(container, url) {
      const preview = container.querySelector('[data-ref="weibo-avatar-preview"]');
      if (preview) {
        preview.style.backgroundImage = url ? 'url(' + url + ')' : 'none';
      }
    }

    /**
     * 更新朋友圈头像预览
     * @param {HTMLElement} container - 根容器
     * @param {string} url - 头像 URL
     */
    renderCirclePreview(container, url) {
      const preview = container.querySelector('[data-ref="circle-avatar-preview"]');
      if (preview) {
        preview.style.backgroundImage = url ? 'url(' + url + ')' : 'none';
      }
    }

    /**
     * 渲染内联错误提示
     * @param {HTMLElement} container - 根容器
     * @param {string} message - 错误消息
     */
    renderError(container, message) {
      if (!container) return;
      const errorDiv = document.createElement('div');
      errorDiv.className = 'avatar-settings-error';
      errorDiv.textContent = message;
      container.insertBefore(errorDiv, container.firstChild);
    }

    /**
     * 更新按钮状态（loading / 成功 / 失败）
     * @param {HTMLElement} container - 根容器
     * @param {string} action - 按钮的 data-action
     * @param {Object} state - { text, background, disabled }
     */
    renderButtonState(container, action, state) {
      const btn = container.querySelector('[data-action="' + action + '"]');
      if (!btn) return;
      if (state.text) btn.textContent = state.text;
      if (state.background) btn.style.background = state.background;
      if (state.disabled !== undefined) btn.disabled = state.disabled;
      if (state.opacity !== undefined) btn.style.opacity = state.opacity;
    }

    // ==================== 内部方法 ====================

    /**
     * 绑定交互事件
     * @param {HTMLElement} div - 根容器
     * @param {Object} callbacks - 回调对象
     */
    _bindEvents(div, callbacks) {
      if (!callbacks) return;

      // 输入预览事件
      var weiboInput = div.querySelector('[data-ref="weibo-avatar-url"]');
      var circleInput = div.querySelector('[data-ref="circle-avatar-url"]');

      if (weiboInput && callbacks.onWeiboPreview) {
        weiboInput.addEventListener('input', function () {
          callbacks.onWeiboPreview(this.value);
        });
      }
      if (circleInput && callbacks.onCirclePreview) {
        circleInput.addEventListener('input', function () {
          callbacks.onCirclePreview(this.value);
        });
      }

      // 按钮点击事件
      div.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        switch (btn.dataset.action) {
          case 'pick-weibo-local':
            if (callbacks.onPickWeiboLocal) callbacks.onPickWeiboLocal();
            break;
          case 'pick-circle-local':
            if (callbacks.onPickCircleLocal) callbacks.onPickCircleLocal();
            break;
          case 'pick-gallery':
            if (callbacks.onAddGallery) callbacks.onAddGallery();
            break;
          case 'match-npc':
            if (callbacks.onMatchNpc) callbacks.onMatchNpc();
            break;
          case 'save':
            if (callbacks.onSave) {
              var weiboUrl = (div.querySelector('[data-ref="weibo-avatar-url"]').value || '').trim();
              var circleUrl = (div.querySelector('[data-ref="circle-avatar-url"]').value || '').trim();
              callbacks.onSave(weiboUrl, circleUrl);
            }
            break;
        }
      });
    }
  }

  // 全局挂载
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.AvatarSettings = AvatarSettingsRenderer;

  console.log('[Renderer] AvatarSettingsRenderer 已加载');
})();
