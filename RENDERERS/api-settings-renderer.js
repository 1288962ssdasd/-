/**
 * @layer Renderer
 * @file   api-settings-renderer.js
 *
 * 职责: API 设置面板 UI 渲染
 * 禁止: 包含业务逻辑、调用 Service、直接操作 Schema
 *
 * 铁则合规：
 *   - 纯展示层，只接收数据对象返回 DOM（铁则三）
 *   - CSS 类名以 api- 前缀隔离（铁则二十一）
 *   - 通过 callbacks 回调交互事件，不直接调用 Service
 */

;(function () {
  'use strict';

  // ==================== 常量 ====================

  /**
   * 角色分组配置
   * key: 分组ID, value: { label: 显示名称, description: 描述 }
   */
  var ROLE_GROUPS = {
    'core':    { label: '核心角色',   description: '基础对话与内容生成' },
    'world':   { label: '世界系统',   description: '世界事件与剧情推进' },
    'custom':  { label: '自定义角色', description: '用户扩展角色' }
  };

  /**
   * 角色颜色映射
   */
  var ROLE_COLORS = {
    'chat-reply':      '#007AFF',
    'world-director':  '#FF9500',
    'content-creator': '#AF52DE'
  };

  /**
   * 角色图标映射
   */
  var ROLE_ICONS = {
    'chat-reply':      '\uD83C\uDFAD',
    'world-director':  '\uD83C\uDFAC',
    'content-creator': '\u270D\uFE0F'
  };

  /**
   * 角色分组映射
   */
  var ROLE_TO_GROUP = {
    'chat-reply':      'core',
    'world-director':  'world',
    'content-creator': 'core'
  };

  /**
   * 获取所有可用角色列表
   * @returns {Array<{id: string, name: string, color: string, icon: string, group: string}>}
   */
  function getAvailableRoles() {
    var defaults = window.LLMGateway?.DEFAULT_ROLES || {};
    var roleIds = Object.keys(defaults);

    if (roleIds.length === 0) {
      roleIds = Object.keys(ROLE_COLORS);
    }

    return roleIds.map(function (id) {
      var def = defaults[id] || {};
      return {
        id: id,
        name: (def.name || ROLE_ICONS[id] + ' ' + id),
        color: ROLE_COLORS[id] || '#8E8E93',
        icon: ROLE_ICONS[id] || '\u2699\uFE0F',
        group: ROLE_TO_GROUP[id] || 'custom'
      };
    });
  }

  // ==================== Renderer 类 ====================

  class ApiSettingsRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;

      const css = `
        /* ===== iOS Settings Style ===== */
        .api-app {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          background: #F2F2F7;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          color: #000000;
          box-sizing: border-box;
        }

        .api-header {
          background: #FFFFFF;
          padding: 20px 16px 14px 16px;
          position: relative;
        }

        .api-header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 0.5px;
          background: #C6C6C8;
        }

        .api-title {
          font-size: 34px;
          font-weight: 700;
          line-height: 1.1;
          color: #000000;
          letter-spacing: 0.37px;
        }

        .api-scroll {
          overflow-y: auto;
          flex: 1;
          padding: 16px;
          -webkit-overflow-scrolling: touch;
        }

        /* ===== 区域标题 ===== */
        .api-section-label {
          font-size: 13px;
          font-weight: 400;
          color: #6D6D72;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          padding: 8px 4px 6px 4px;
          margin-bottom: 8px;
        }

        /* ===== API 接口卡片 ===== */
        .api-card {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          box-shadow: 0 0.5px 0 rgba(0,0,0,0.08);
        }

        .api-card-title {
          font-size: 17px;
          font-weight: 600;
          color: #000000;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 0.5px solid #E5E5EA;
        }

        .api-form-group {
          margin-bottom: 14px;
        }

        .api-form-group:last-child {
          margin-bottom: 0;
        }

        .api-label {
          display: block;
          font-size: 13px;
          font-weight: 400;
          color: #8E8E93;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          margin-bottom: 6px;
          padding-left: 4px;
        }

        .api-input {
          display: block;
          width: 100%;
          height: 44px;
          border: 1px solid #E5E5EA;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 16px;
          font-family: inherit;
          color: #000000;
          background: #FFFFFF;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          -webkit-appearance: none;
          appearance: none;
        }

        .api-input::placeholder {
          color: #C7C7CC;
        }

        .api-input:focus {
          border: 2px solid #007AFF;
          box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
        }

        /* ===== 按钮 ===== */
        .api-form-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 0 0 0;
        }

        .api-btn {
          display: block;
          width: 100%;
          height: 44px;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          text-align: center;
          line-height: 44px;
          padding: 0;
          box-sizing: border-box;
          transition: opacity 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .api-btn:active {
          opacity: 0.6;
        }

        .api-btn-save {
          background: #007AFF;
          color: #FFFFFF;
        }

        .api-btn-test {
          background: #007AFF;
          color: #FFFFFF;
        }

        .api-btn-reset {
          background: #FF3B30;
          color: #FFFFFF;
        }

        /* ===== 状态提示 ===== */
        .api-form-status {
          margin-top: 16px;
          min-height: 0;
          transition: all 0.25s ease;
        }

        .api-status-success {
          background: #34C759;
          color: #FFFFFF;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          text-align: center;
        }

        .api-status-error {
          background: #FF3B30;
          color: #FFFFFF;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          text-align: center;
        }

        .api-status-info {
          background: #007AFF;
          color: #FFFFFF;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          text-align: center;
        }

        /* ===== LLM 可折叠卡片 ===== */
        .api-llm-card {
          background: #FFFFFF;
          border-radius: 12px;
          margin-bottom: 12px;
          overflow: hidden;
          box-shadow: 0 0.5px 0 rgba(0,0,0,0.08);
        }

        .api-llm-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          transition: background 0.15s ease;
        }

        .api-llm-card-header:active {
          background: rgba(0,0,0,0.04);
        }

        .api-llm-card-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .api-llm-card-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .api-llm-card-name {
          font-size: 17px;
          font-weight: 600;
          color: #000000;
        }

        .api-llm-card-arrow {
          font-size: 13px;
          color: #C7C7CC;
          transition: transform 0.25s ease;
        }

        .api-llm-card-arrow.api-expanded {
          transform: rotate(90deg);
        }

        .api-llm-card-body {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease, padding 0.3s ease;
        }

        .api-llm-card-body.api-expanded {
          max-height: 800px;
        }

        .api-llm-card-body-inner {
          padding: 0 16px 16px 16px;
        }

        .api-llm-divider {
          height: 0.5px;
          background: #E5E5EA;
          margin: 0 16px;
        }

        /* ===== 温度滑块 ===== */
        .api-slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .api-slider {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: #E5E5EA;
          outline: none;
        }

        .api-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04);
          cursor: pointer;
        }

        .api-slider-value {
          min-width: 36px;
          text-align: center;
          font-size: 15px;
          font-weight: 500;
          color: #3A3A3C;
          font-variant-numeric: tabular-nums;
        }

        /* ===== 多行文本框 ===== */
        .api-textarea {
          display: block;
          width: 100%;
          min-height: 100px;
          border: 1px solid #E5E5EA;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 15px;
          font-family: inherit;
          color: #000000;
          background: #FFFFFF;
          outline: none;
          box-sizing: border-box;
          resize: vertical;
          line-height: 1.5;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .api-textarea::placeholder {
          color: #C7C7CC;
        }

        .api-textarea:focus {
          border: 2px solid #007AFF;
          box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
        }

        /* ===== 占位符提示 ===== */
        .api-placeholder-hint {
          font-size: 12px;
          color: #8E8E93;
          margin-top: 4px;
          padding-left: 2px;
          line-height: 1.4;
        }

        /* ===== 占位符折叠区域 ===== */
        .api-placeholder-section {
          margin-top: 6px;
          border: 1px solid #E5E5EA;
          border-radius: 8px;
          overflow: hidden;
        }

        .api-placeholder-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #6D6D72;
          background: #F9F9F9;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          transition: background 0.15s ease;
        }

        .api-placeholder-toggle:active {
          background: #F2F2F7;
        }

        .api-placeholder-arrow {
          font-size: 10px;
          color: #AEAEB2;
          transition: transform 0.2s ease;
          display: inline-block;
        }

        .api-placeholder-tags {
          display: none;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px 10px;
          background: #FFFFFF;
        }

        .api-placeholder-tag {
          display: inline-block;
          padding: 3px 8px;
          font-size: 11px;
          font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
          color: #007AFF;
          background: rgba(0, 122, 255, 0.08);
          border: 1px solid rgba(0, 122, 255, 0.2);
          border-radius: 6px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s ease, transform 0.1s ease;
          user-select: none;
        }

        .api-placeholder-tag:active {
          background: rgba(0, 122, 255, 0.18);
          transform: scale(0.96);
        }

        /* ===== LLM 底部按钮 ===== */
        .api-llm-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 4px;
        }

        /* ===== 加载态 ===== */
        .api-loading {
          text-align: center;
          padding: 40px 16px;
          color: #8E8E93;
          font-size: 15px;
        }

        /* ===== iOS Toggle Switch ===== */
        .api-toggle {
          position: relative;
          display: inline-block;
          width: 51px;
          height: 31px;
          flex-shrink: 0;
        }
        .api-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .api-toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #E5E5EA;
          border-radius: 31px;
          transition: background 0.3s ease;
        }
        .api-toggle-slider::before {
          content: '';
          position: absolute;
          height: 27px;
          width: 27px;
          left: 2px;
          bottom: 2px;
          background: #FFFFFF;
          border-radius: 50%;
          transition: transform 0.3s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .api-toggle input:checked + .api-toggle-slider {
          background: #34C759;
        }
        .api-toggle input:checked + .api-toggle-slider::before {
          transform: translateX(20px);
        }

        /* ===== 世界信息卡片 ===== */
        .api-world-info {
          background: #F2F2F7;
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          color: #3A3A3C;
          line-height: 1.6;
        }
        .api-world-info strong {
          color: #000000;
        }
        .api-channel-tag {
          display: inline-block;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(0,0,0,0.06);
          color: #6D6D72;
          margin-left: 6px;
        }

        .api-channel-card {
          background: #FFFFFF;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 12px;
          border: 1px solid #E5E5EA;
        }

        .api-channel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .api-channel-name {
          font-weight: 600;
          font-size: 15px;
          color: #000;
        }

        .api-channel-desc {
          font-size: 12px;
          color: #8E8E93;
          margin-bottom: 10px;
        }

        .api-channel-model-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #E5E5EA;
          border-radius: 8px;
          font-size: 14px;
          background: #F9F9F9;
        }

        .api-channel-model-input:focus {
          outline: none;
          border-color: #007AFF;
          background: #FFFFFF;
        }

        .api-channel-active {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #34C759;
          margin-left: 8px;
        }

        .api-channel-inactive {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #FF3B30;
          margin-left: 8px;
        }
      `;

      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
      this._stylesInjected = true;
    }

    // ==================== 主渲染 ====================

    /**
     * 渲染 API 设置主界面
     * @param {Object} data - { expandedRoles, channelConfigs }
     * @param {Object} callbacks - 回调函数集合
     * @returns {string} HTML 字符串
     */
    renderApp(data, callbacks) {
      this.injectStyles();

      var expandedRoles = data.expandedRoles || {};
      var channelConfigs = data.channelConfigs || null;

      var llmCardsHTML = this.renderLLMCardsByGroup(expandedRoles);
      var channelSectionHTML = this.renderChannelSection(channelConfigs);

      return `
        <div class="api-app">
          <div class="api-header">
            <span class="api-title">设置</span>
          </div>
          <div class="api-scroll">
            <!-- 区域1: API 接口设置 -->
            <div class="api-section-label">API 接口</div>
            <div class="api-card">
              <div class="api-card-title">API 接口</div>
              <div class="api-form-group">
                <label class="api-label">Base URL</label>
                <input type="text" class="api-input" data-ref="baseUrl" placeholder="https://api.openai.com/v1">
              </div>
              <div class="api-form-group">
                <label class="api-label">API Key</label>
                <input type="password" class="api-input" data-ref="apiKey" placeholder="sk-...">
              </div>
              <div class="api-form-group">
                <label class="api-label">模型</label>
                <input type="text" class="api-input" data-ref="model" placeholder="gpt-3.5-turbo">
              </div>
              <div class="api-form-group">
                <label class="api-label">Temperature</label>
                <input type="number" class="api-input" data-ref="temperature" min="0" max="2" step="0.1" value="0.7">
              </div>
              <div class="api-form-group">
                <label class="api-label">Max Tokens</label>
                <input type="number" class="api-input" data-ref="maxTokens" min="1" max="128000" step="1" value="2048">
              </div>
              <div class="api-form-actions">
                <button class="api-btn api-btn-save" data-action="save-api">保存</button>
                <button class="api-btn api-btn-test" data-action="test-api">测试连接</button>
              </div>
              <div class="api-form-status" data-ref="api-status"></div>
            </div>

            <!-- 区域2: LLM 链路配置 -->
            <div class="api-section-label">LLM 链路配置</div>
            ${llmCardsHTML}
            <div class="api-llm-actions">
              <button class="api-btn api-btn-save" data-action="save-llm">保存 LLM 配置</button>
              <button class="api-btn api-btn-reset" data-action="reset-llm">恢复默认</button>
            </div>
            <div class="api-form-status" data-ref="llm-status"></div>

            <!-- 区域2.5: 四通道配置 -->
            <div class="api-section-label">🚀 四通道模型配置</div>
            ${channelSectionHTML}

            <!-- 区域3: 大世界系统 -->
            <div class="api-section-label">大世界系统</div>
            <div class="api-card">
              <div class="api-card-title">🌍 大世界系统</div>
              <div class="api-form-group">
                <label class="api-label">AI管家总开关</label>
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;">
                  <span style="font-size:15px;color:#3A3A3C;">DirectorService 剧情分析</span>
                  <label class="api-toggle" data-ref="director-toggle">
                    <input type="checkbox" data-ref="director-switch">
                    <span class="api-toggle-slider"></span>
                  </label>
                </div>
                <div style="font-size:12px;color:#8E8E93;margin-top:2px;padding-left:4px;">开启后，每次ST生成结束会自动分析剧情并更新手机面板</div>
              </div>
              <div class="api-form-actions">
                <button class="api-btn api-btn-save" data-action="generate-world" style="background:#34C759;">🌍 生成大世界</button>
                <button class="api-btn api-btn-reset" data-action="reset-world">🗑️ 重置世界数据</button>
              </div>
              <div class="api-form-status" data-ref="world-status"></div>
              <div data-ref="world-info" style="margin-top:12px;"></div>
            </div>
          </div>
        </div>
      `;
    }

    // ==================== LLM 角色卡片 ====================

    /**
     * 渲染单个 LLM 角色卡片
     * @param {Object} role - 角色对象 { id, name, color, icon, group }
     * @param {Object} expandedRoles - 已展开的角色映射
     * @returns {string} HTML 字符串
     */
    renderLLMCard(role, expandedRoles) {
      var isExpanded = !!(expandedRoles && expandedRoles[role.id]);

      // 从 DEFAULT_ROLES 获取占位符列表
      var defaultRole = window.LLMGateway?.DEFAULT_ROLES?.[role.id];
      var contextSources = defaultRole?.contextSources || [];

      // 构建可折叠占位符标签区域
      var placeholderSection = '';
      if (contextSources.length > 0) {
        var tagsHTML = contextSources.map(function (s) {
          var name = typeof s === 'string' ? s : (s.name || s.key || '');
          var escaped = name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
          return '<span class="api-placeholder-tag" data-placeholder="{{' + escaped + '}}">{{' + escaped + '}}</span>';
        }).join('\n                ');

        placeholderSection = `
                <div class="api-placeholder-section" data-ref="${role.id}-placeholders">
                  <div class="api-placeholder-toggle" data-action="toggle-placeholders" data-role="${role.id}">
                    <span class="api-placeholder-arrow">&#9654;</span>
                    <span>可用占位符 (${contextSources.length}个)</span>
                  </div>
                  <div class="api-placeholder-tags">
                    ${tagsHTML}
                  </div>
                </div>`;
      }

      return `
        <div class="api-llm-card">
          <div class="api-llm-card-header" data-action="toggle" data-role="${role.id}">
            <div class="api-llm-card-header-left">
              <span class="api-llm-card-dot" style="background:${role.color}"></span>
              <span class="api-llm-card-name">${role.icon} ${role.name}</span>
            </div>
            <span class="api-llm-card-arrow${isExpanded ? ' api-expanded' : ''}" data-ref="${role.id}-arrow">&#9654;</span>
          </div>
          <div class="api-llm-divider"></div>
          <div class="api-llm-card-body${isExpanded ? ' api-expanded' : ''}" data-ref="${role.id}-body">
            <div class="api-llm-card-body-inner">
              <div class="api-form-group">
                <label class="api-label">温度 (Temperature)</label>
                <div class="api-slider-row">
                  <input type="range" class="api-slider" data-ref="${role.id}-temp" data-role="${role.id}" min="0" max="2" step="0.1" value="0.7">
                  <span class="api-slider-value" data-ref="${role.id}-temp-val">0.7</span>
                </div>
              </div>
              <div class="api-form-group">
                <label class="api-label">最大 Token (Max Tokens)</label>
                <input type="number" class="api-input" data-ref="${role.id}-maxTokens" min="1" max="128000" step="1" placeholder="2048">
              </div>
              <div class="api-form-group">
                <label class="api-label">超时时间 (Timeout, ms)</label>
                <input type="number" class="api-input" data-ref="${role.id}-timeout" min="1000" max="300000" step="1000" placeholder="30000">
              </div>
              <div class="api-form-group">
                <label class="api-label">系统提示词 (System Prompt)</label>
                <textarea class="api-textarea" data-ref="${role.id}-systemPrompt" placeholder="输入系统提示词..." rows="4"></textarea>
                ${placeholderSection}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * 按分组渲染 LLM 角色卡片
     * @param {Object} expandedRoles - 已展开的角色映射
     * @returns {string} 分组后的 HTML 字符串
     */
    renderLLMCardsByGroup(expandedRoles) {
      var roles = getAvailableRoles();
      if (!roles || roles.length === 0) {
        return '<div class="api-loading">暂无可用角色</div>';
      }

      // 按分组归类
      var grouped = {};
      roles.forEach(function (role) {
        var groupId = role.group || 'custom';
        if (!grouped[groupId]) {
          grouped[groupId] = [];
        }
        grouped[groupId].push(role);
      });

      // 按 ROLE_GROUPS 定义的顺序渲染分组
      var html = '';
      var groupOrder = Object.keys(ROLE_GROUPS);

      // 追加可能存在的自定义分组（不在 ROLE_GROUPS 中的）
      Object.keys(grouped).forEach(function (gid) {
        if (groupOrder.indexOf(gid) === -1) {
          groupOrder.push(gid);
        }
      });

      var self = this;
      groupOrder.forEach(function (groupId) {
        var groupRoles = grouped[groupId];
        if (!groupRoles || groupRoles.length === 0) return;

        var groupInfo = ROLE_GROUPS[groupId] || { label: groupId, description: '' };
        html += '<div class="api-section-label">' + groupInfo.label;
        if (groupInfo.description) {
          html += ' <span style="font-size:11px;color:#AEAEB2;text-transform:none;letter-spacing:0;">' + groupInfo.description + '</span>';
        }
        html += '</div>\n';

        groupRoles.forEach(function (role) {
          html += self.renderLLMCard(role, expandedRoles) + '\n';
        });
      });

      return html;
    }

    // ==================== 四通道配置渲染 ====================

    /**
     * 渲染单个通道卡片
     * @param {string} channelId - 通道 ID
     * @param {Object} channel - 通道配置
     * @returns {string} HTML 字符串
     */
    renderChannelCard(channelId, channel) {
      var isActive = !!channel.model;
      var statusClass = isActive ? 'api-channel-active' : 'api-channel-inactive';
      var statusTitle = isActive ? '已配置模型' : '未配置（使用默认）';

      return `
        <div class="api-channel-card" data-channel-id="${channelId}">
          <div class="api-channel-header">
            <div>
              <span class="api-channel-name">${channel.name}</span>
              <span class="api-channel-tag">${channelId}</span>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="font-size: 11px; color: #8E8E93;">${statusTitle}</span>
              <div class="${statusClass}" title="${statusTitle}"></div>
            </div>
          </div>
          <div class="api-channel-desc">${channel.description || ''}</div>
          <div class="api-form-group">
            <label class="api-label">模型名称</label>
            <input type="text"
                   class="api-channel-model-input"
                   data-channel="${channelId}"
                   data-field="model"
                   placeholder="例如: gpt-4, deepseek-chat, claude-3-sonnet"
                   value="${channel.model || ''}">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="api-form-group">
              <label class="api-label">超时(ms)</label>
              <input type="number"
                     class="api-input"
                     data-channel="${channelId}"
                     data-field="timeout"
                     value="${channel.timeout || 30000}">
            </div>
            <div class="api-form-group">
              <label class="api-label">最大并发</label>
              <input type="number"
                     class="api-input"
                     data-channel="${channelId}"
                     data-field="maxConcurrent"
                     value="${channel.maxConcurrent || 1}">
            </div>
          </div>
        </div>
      `;
    }

    /**
     * 渲染四通道配置区域
     * @param {Object} channelConfigs - 通道配置映射
     * @returns {string} HTML 字符串
     */
    renderChannelSection(channelConfigs) {
      if (!channelConfigs) {
        return '<div class="api-form-status">加载通道配置中...</div>';
      }

      var self = this;
      var channelOrder = ['channel-world', 'channel-director', 'channel-content', 'channel-fallback'];
      var channelsHTML = channelOrder
        .filter(function (id) { return channelConfigs[id]; })
        .map(function (id) { return self.renderChannelCard(id, channelConfigs[id]); })
        .join('\n');

      return `
        <div class="api-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none;">
          <div style="color: white; margin-bottom: 12px;">
            <div style="font-size: 17px; font-weight: 600; margin-bottom: 4px;">🚀 LLM 四通道架构</div>
            <div style="font-size: 12px; opacity: 0.85;">每个通道独立配置模型，可实现不同任务使用不同模型</div>
          </div>
          ${channelsHTML}
          <div style="display: flex; gap: 10px; margin-top: 12px;">
            <button class="api-btn" data-action="save-channels" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);">
              💾 保存通道
            </button>
            <button class="api-btn" data-action="reset-channels" style="flex: 1; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.2);">
              🔄 恢复默认
            </button>
          </div>
          <div class="api-form-status" data-ref="channel-status" style="color: white;"></div>
        </div>
      `;
    }

    // ==================== 世界信息渲染 ====================

    /**
     * 渲染世界信息卡片
     * @param {Object} world - 世界数据
     * @returns {string} HTML 字符串
     */
    renderWorldInfo(world) {
      if (!world) return '';

      // 兼容 V1 和 V2 数据结构
      var worldName = world.name || (world.meta?.truth?.background?.substring(0, 30)) || '未知世界';
      var era = world.era || (world.meta?.atmosphere?.current?.mood) || '';
      var theme = world.theme || '';
      var description = world.description || (world.meta?.truth?.background) || '';
      var keyLocations = world.keyLocations || (world.maps?.outdoor?.nodes?.map(function(n) { return n.name; })) || [];

      // factions 可能是字符串数组或对象数组
      var factionNames = [];
      if (world.factions && world.factions.length > 0) {
        factionNames = world.factions.map(function(f) {
          return typeof f === 'string' ? f : (f.name || f.description || '');
        }).filter(Boolean);
      }

      // rules 可能是字符串数组或对象
      var rules = [];
      if (world.rules && world.rules.length > 0) {
        rules = world.rules.map(function(r) {
          return typeof r === 'string' ? r : (r.description || r.name || '');
        }).filter(Boolean);
      }

      var parts = [];
      parts.push('<div class="api-world-info">');
      parts.push('<strong>🌍 ' + worldName + '</strong>');
      if (era) parts.push('<br>时代: ' + era);
      if (theme) parts.push('<br>主题: ' + theme);
      if (description && description !== worldName) {
        parts.push('<br>' + (description.length > 100 ? description.substring(0, 100) + '...' : description));
      }
      if (keyLocations.length > 0) {
        parts.push('<br>地点: ' + keyLocations.slice(0, 5).join(', '));
      }
      if (factionNames.length > 0) {
        parts.push('<br>势力: ' + factionNames.join(', '));
      }
      if (world.npcs && world.npcs.length > 0) {
        parts.push('<br>NPC: ' + world.npcs.length + ' 个');
        var names = world.npcs.slice(0, 5).map(function (n) { return n.name || n.id; }).join('、');
        if (names) parts.push(' (' + names + (world.npcs.length > 5 ? '…' : '') + ')');
      }
      if (rules.length > 0) {
        parts.push('<br>规则: ' + rules.slice(0, 2).join('；'));
      }
      parts.push('</div>');
      return parts.join('');
    }
  }

  // ==================== 导出 ====================

  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.ApiSettings = ApiSettingsRenderer;

  console.log('[Renderer] ApiSettingsRenderer 已加载');
})();
