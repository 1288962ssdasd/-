/**
 * settings-ui.js - 插件设置 UI
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  var _extensionSettings = null;

  /**
   * 创建设置面板 UI
   * @param {object} settings - extension_settings.mobile_context
   * @param {string} version - 插件版本号
   */
  function create(settings, version) {
    _extensionSettings = settings;

    var html = '<div id="mobile_context_settings">' +
      '<div class="inline-drawer">' +
      '<div class="inline-drawer-toggle inline-drawer-header">' +
      '<b>外置手机 v' + version + '</b>' +
      '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>' +
      '</div>' +
      '<div class="inline-drawer-content">' +
      '<div class="flex-container" style="flex-wrap:wrap;flex-direction:row;">' +
      '<label class="checkbox_label" for="mobile_tavern_compatibility_mode">' +
      '<input id="mobile_tavern_compatibility_mode" type="checkbox" />' +
      '<span>酒馆页面与手机控制兼容</span></label>' +
      '<label class="checkbox_label" for="mobile_hide_phone">' +
      '<input id="mobile_hide_phone" type="checkbox" />' +
      '<span>隐藏手机按钮</span></label>' +
      '<label class="checkbox_label" for="mobile_disable_body_text">' +
      '<input id="mobile_disable_body_text" type="checkbox" />' +
      '<span>禁止正文</span></label>' +
      '</div></div></div></div>';

    jQuery('#extensions_settings').append(html);
  }

  /**
   * 绑定设置控件事件
   * @param {object} settings - extension_settings.mobile_context
   */
  function bind(settings) {
    _extensionSettings = settings;
    var $ = jQuery;

    function save() {
      try {
        var ctx = window.Platform?.adapter?.getSTContext?.()
          || window.Platform?.adapter?.getContext?.()
          || null;
        if (ctx && ctx.saveSettingsDebounced) ctx.saveSettingsDebounced();
        else if (window.saveSettingsDebounced) window.saveSettingsDebounced();
      } catch (e) { /* ignore */ }
    }

    $('#mobile_tavern_compatibility_mode').prop('checked', settings.tavernCompatibilityMode)
      .on('change', function () { settings.tavernCompatibilityMode = $(this).prop('checked'); save(); updatePointerEvents(); });
    $('#mobile_hide_phone').prop('checked', settings.hidePhone)
      .on('change', function () { settings.hidePhone = $(this).prop('checked'); save(); updatePhoneVisibility(); });
    $('#mobile_disable_body_text').prop('checked', settings.disableBodyText)
      .on('change', function () { settings.disableBodyText = $(this).prop('checked'); save(); });
  }

  function updatePointerEvents() {
    var container = document.querySelector('.mobile-phone-container');
    var frame = document.querySelector('.mobile-phone-frame');
    if (!container || !frame) return;
    if (_extensionSettings.tavernCompatibilityMode) {
      container.style.pointerEvents = 'none';
      frame.style.pointerEvents = 'auto';
    } else {
      container.style.pointerEvents = 'auto';
      frame.style.pointerEvents = 'auto';
    }
  }

  function updatePhoneVisibility() {
    var trigger = document.getElementById('mobile-phone-trigger');
    if (!trigger) return;
    trigger.style.display = _extensionSettings.hidePhone ? 'none' : 'block';
  }

  window.PhoneSettingsUI = {
    create: create,
    bind: bind,
  };

})();
