/**
 * @layer Renderer
 * @file   settings-renderer.js
 *
 * 职责: 设置 UI 渲染 - API 配置、提示词编辑、事件日志
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 settings- 前缀
 */

;(function () {
  'use strict';

  class SettingsRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

      const style = document.createElement('style');
      style.id = 'settings-module-styles';
      style.textContent = `
        .settings-app { width:100%;height:100%;background:#f2f2f7;display:flex;flex-direction:column;font-family:-apple-system,sans-serif; }
        .settings-header { padding:16px;background:#fff;border-bottom:1px solid #e5e5ea; }
        .settings-header h2 { margin:0;font-size:20px;font-weight:600; }
        .settings-scroll { flex:1;overflow-y:auto;padding:12px 16px 24px; }
        .settings-section-title { font-size:13px;color:#8e8e93;margin:14px 0 8px;text-transform:uppercase; }
        .settings-card { background:#fff;border-radius:12px;padding:14px;margin-bottom:10px; }
        .settings-label { display:block;font-size:13px;color:#3a3a3c;margin:8px 0 4px; }
        .settings-input,.settings-select,.settings-textarea { width:100%;box-sizing:border-box;padding:10px;border:1px solid #e5e5ea;border-radius:8px;font-size:15px; }
        .settings-textarea { font-family:ui-monospace,monospace;font-size:12px;resize:vertical;line-height:1.6; }
        .settings-actions { display:flex;gap:8px;margin-top:10px;flex-wrap:wrap; }
        .settings-btn { padding:10px 14px;border:none;border-radius:8px;background:#e5e5ea;font-size:14px;cursor:pointer; }
        .settings-btn-primary { background:#007aff;color:#fff; }
        .settings-btn-small { padding:4px 10px;border:none;border-radius:6px;background:#e5e5ea;font-size:12px;cursor:pointer; }
        .settings-row { display:flex;align-items:center;justify-content:space-between; }
        .settings-toggle input { display:none; }
        .settings-toggle span { display:inline-block;width:48px;height:28px;background:#e5e5ea;border-radius:14px;position:relative; }
        .settings-toggle input:checked + span { background:#34c759; }
        .settings-toggle span::after { content:'';position:absolute;width:24px;height:24px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s; }
        .settings-toggle input:checked + span::after { transform:translateX(20px); }
        .settings-status { font-size:12px;margin-top:8px;min-height:16px; }
        .settings-events-log { max-height:200px;overflow-y:auto;font-size:12px;color:#333; }
        .settings-event-item { padding:8px 0;border-bottom:0.5px solid #eee; }
        .settings-event-time { color:#8e8e93;margin-bottom:4px; }
        .settings-event-tag { display:inline-block;background:#007aff22;color:#007aff;padding:2px 6px;border-radius:4px;margin-right:4px;font-size:11px; }
        .settings-event-empty { color:#8e8e93;padding:8px 0; }
        .settings-link { color:#007aff;text-align:center;cursor:pointer;font-size:15px; }
        .settings-template-tabs { display:flex;gap:8px;margin-bottom:12px; }
        .settings-tab { flex:1;padding:8px 12px;border:none;border-radius:8px;background:#e5e5ea;font-size:13px;cursor:pointer;transition:all .2s; }
        .settings-tab-active { background:#007aff;color:#fff; }
        .settings-prompt-editor-wrapper { position:relative;margin-bottom:12px; }
        .settings-prompt-editor { position:relative;z-index:2;background:transparent;color:transparent;caret-color:#000; }
        .settings-prompt-overlay { position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;padding:10px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;pointer-events:none;overflow:auto;white-space:pre-wrap;word-wrap:break-word; }
        .settings-variable-highlight { background:#34c75933;color:#34c759;border-radius:3px;padding:0 2px; }
        .settings-variables-section { margin-top:12px; }
        .settings-variables-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
        .settings-variables-list { display:flex;flex-wrap:wrap;gap:6px; }
        .settings-variable-tag { display:inline-block;background:#007aff15;color:#007aff;padding:4px 8px;border-radius:6px;font-size:12px;font-family:ui-monospace,monospace;cursor:pointer;transition:all .15s; }
        .settings-variable-tag:hover { background:#007aff30; }
        .settings-variable-empty { color:#8e8e93;font-size:12px; }
        .settings-modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999; }
        .settings-modal-box { background:#fff;border-radius:16px;padding:20px;width:320px;max-height:70vh;display:flex;flex-direction:column; }
        .settings-modal-title { font-size:16px;font-weight:700;margin-bottom:12px; }
        .settings-modal-content { flex:1;overflow:auto;margin-bottom:16px; }
        .settings-test-result { background:#f5f5f7;padding:12px;border-radius:8px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;margin:0; }
        .settings-modal-actions { display:flex;justify-content:flex-end; }
      `;
      document.head.appendChild(style);
    }

    // ==================== 主框架渲染 ====================

    renderShell() {
      var div = document.createElement('div');
      div.className = 'settings-app';
      div.innerHTML =
        '<div class="settings-header"><h2>设置</h2></div>' +
        '<div class="settings-scroll">' +
          '<div class="settings-section-title">API 接口</div>' +
          '<div class="settings-card">' +
            '<label class="settings-label">API 地址</label>' +
            '<input class="settings-input" data-ref="api-base" placeholder="https://api.openai.com/v1" />' +
            '<label class="settings-label">API Key</label>' +
            '<input class="settings-input" data-ref="api-key" type="password" placeholder="sk-..." />' +
            '<div class="settings-actions">' +
              '<button class="settings-btn settings-btn-primary" data-action="save-api">保存 API</button>' +
              '<button class="settings-btn" data-action="test-api">测试连接</button>' +
            '</div>' +
            '<div class="settings-status" data-ref="api-status"></div>' +
          '</div>' +
          '<div class="settings-section-title">提示词设置</div>' +
          '<div class="settings-card">' +
            '<label class="settings-label">专家选择</label>' +
            '<select class="settings-select" data-ref="expert-select"></select>' +
            '<label class="settings-label">模板类型</label>' +
            '<div class="settings-template-tabs">' +
              '<button class="settings-tab settings-tab-active" data-template-type="system" data-action="switch-template">系统模板</button>' +
              '<button class="settings-tab" data-template-type="user" data-action="switch-template">用户模板</button>' +
            '</div>' +
            '<label class="settings-label">提示词编辑</label>' +
            '<div class="settings-prompt-editor-wrapper">' +
              '<textarea class="settings-textarea settings-prompt-editor" data-ref="prompt-editor" rows="12" placeholder="在此编辑提示词..."></textarea>' +
              '<div class="settings-prompt-overlay" data-ref="prompt-overlay"></div>' +
            '</div>' +
            '<div class="settings-variables-section">' +
              '<div class="settings-variables-header">' +
                '<span class="settings-label">可用变量</span>' +
                '<button class="settings-btn-small" data-action="refresh-variables">刷新</button>' +
              '</div>' +
              '<div class="settings-variables-list" data-ref="variables-list"></div>' +
            '</div>' +
            '<div class="settings-actions">' +
              '<button class="settings-btn" data-action="reset-prompt">恢复默认</button>' +
              '<button class="settings-btn settings-btn-primary" data-action="save-prompt">保存</button>' +
              '<button class="settings-btn" data-action="test-prompt">测试生成</button>' +
            '</div>' +
            '<div class="settings-status" data-ref="prompt-status"></div>' +
          '</div>' +
          '<div class="settings-section-title">系统</div>' +
          '<div class="settings-card settings-row">' +
            '<span>AI 管家（ST 每轮随机事件）</span>' +
            '<label class="settings-toggle"><input type="checkbox" data-ref="director-switch" /><span></span></label>' +
          '</div>' +
          '<div class="settings-section-title">事件更新</div>' +
          '<div class="settings-card">' +
            '<div class="settings-events-log" data-ref="events-log">加载中...</div>' +
            '<button class="settings-btn" data-action="refresh-events">刷新事件日志</button>' +
          '</div>' +
          '<div class="settings-card settings-link" data-action="open-full-api">打开完整 API / 大世界面板 ›</div>' +
        '</div>';
      return div;
    }

    // ==================== 空状态 / 错误 ====================

    renderEmpty(message) {
      const el = document.createElement('div');
      el.className = 'settings-event-empty';
      el.textContent = message || '暂无数据';
      return el;
    }

    renderError(message) {
      const el = document.createElement('div');
      el.className = 'settings-event-empty';
      el.textContent = message || '加载失败';
      return el;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Settings = SettingsRenderer;

  console.log('[Renderer] SettingsRenderer 已加载');
})();
