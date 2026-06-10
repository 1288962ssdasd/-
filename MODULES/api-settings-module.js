/**
 * ApiSettingsModule - 统一设置面板（API 接口 + LLM 链路配置）
 * 职责：管理 API 配置和 LLM 角色配置的统一设置界面
 * 禁止：直接操作数据（必须通过 ApiConfigData / LLMGateway）
 *
 * 全局挂载：window.PhoneModules.ApiSettings
 *
 * 铁则合规：
 *   - 数据读写通过 Data 层（铁则一）
 *   - Module 层不直接写数据，通过 ApiConfigData 和 LLMGateway（铁则三）
 *   - 通过 __phoneShell.registerModule 注册（铁则五）
 *   - 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 api- 前缀（铁则十一）
 */

;(function () {
  'use strict';

  // ==================== 常量 ====================

  // ==================== 动态角色系统 ====================

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
   * key: 角色ID, value: CSS 颜色值
   */
  var ROLE_COLORS = {
    'chat-reply':      '#007AFF',
    'world-director':  '#FF9500',
    'content-creator': '#AF52DE'
  };

  /**
   * 角色图标映射
   * key: 角色ID, value: emoji 图标
   */
  var ROLE_ICONS = {
    'chat-reply':      '\uD83C\uDFAD',
    'world-director':  '\uD83C\uDFAC',
    'content-creator': '\u270D\uFE0F'
  };

  /**
   * 角色分组映射
   * key: 角色ID, value: 所属分组ID
   */
  var ROLE_TO_GROUP = {
    'chat-reply':      'core',
    'world-director':  'world',
    'content-creator': 'core'
  };

  /**
   * 获取所有可用角色列表
   * 优先从 LLMGateway.DEFAULT_ROLES 动态获取，回退到静态定义
   * @returns {Array<{id: string, name: string, color: string, icon: string, group: string}>}
   */
  function getAvailableRoles() {
    var defaults = window.LLMGateway?.DEFAULT_ROLES || {};
    var roleIds = Object.keys(defaults);

    // 如果 DEFAULT_ROLES 为空，回退到静态角色列表
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

  // 兼容引用：供未迁移代码使用
  var LLM_ROLES = [];

  // ==================== 模块类 ====================

  class ApiSettingsModule extends PhoneApp {
    constructor() {
      super({
        id: 'api-settings',
        name: '设置',
        icon: '⚙️',
        iconBg: '#8E8E93',
      });

      this._apiConfig = null;
      this._gateway = null;
      this._formEl = null;
      this._expandedRoles = {};
      this._channelConfigs = null;  // 四通道配置
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      // 铁则三：通过 Data 层初始化
      this._apiConfig = new (window.PhoneData?.ApiConfig || function () {})(window.Platform);

      // 加载四通道配置
      try {
        this._channelConfigs = await this._apiConfig.getChannelConfig();
        console.log('[ApiSettingsModule] 四通道配置已加载:', Object.keys(this._channelConfigs || {}));
      } catch (e) {
        console.warn('[ApiSettingsModule] 加载通道配置失败:', e);
        this._channelConfigs = null;
      }

      // 懒初始化 LLMGateway
      if (window.LLMGateway) {
        try {
          this._gateway = new window.LLMGateway(window.Platform);
        } catch (err) {
          console.warn('[ApiSettingsModule] LLMGateway 初始化失败:', err);
        }
      }
    }

    onResume() {}

    onPause() {}

    onDispose() {
      this._gateway = null;
      this._expandedRoles = {};
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (ApiSettingsModule._stylesInjected) return;

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
      ApiSettingsModule._stylesInjected = true;
    }

    // ==================== 渲染 ====================

    /**
     * 生成单个 LLM 角色卡片的 HTML
     */
    _renderLLMCard(role) {
      const isExpanded = !!this._expandedRoles[role.id];

      // 从 DEFAULT_ROLES 获取占位符列表
      const defaultRole = window.LLMGateway?.DEFAULT_ROLES?.[role.id];
      const contextSources = defaultRole?.contextSources || [];

      // 构建可折叠占位符标签区域
      let placeholderSection = '';
      if (contextSources.length > 0) {
        const tagsHTML = contextSources.map(function (s) {
          const name = typeof s === 'string' ? s : (s.name || s.key || '');
          const escaped = name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
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

    // ==================== 四通道配置渲染 ====================

    /**
     * 按分组渲染 LLM 角色卡片
     * 每个分组前加分组标题，组内角色按顺序排列
     * @returns {string} 分组后的 HTML 字符串
     */
    _renderLLMCardsByGroup() {
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
          html += this._renderLLMCard(role) + '\n';
        }.bind(this));
      }.bind(this));

      return html;
    }

    _renderChannelCard(channelId, channel) {
      const isActive = !!channel.model;
      const statusClass = isActive ? 'api-channel-active' : 'api-channel-inactive';
      const statusTitle = isActive ? '已配置模型' : '未配置（使用默认）';

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

    _renderChannelSection() {
      if (!this._channelConfigs) {
        return '<div class="api-form-status">加载通道配置中...</div>';
      }

      const channelOrder = ['channel-world', 'channel-director', 'channel-content', 'channel-fallback'];
      const channelsHTML = channelOrder
        .filter(id => this._channelConfigs[id])
        .map(id => this._renderChannelCard(id, this._channelConfigs[id]))
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

    _bindChannelEvents() {
      const container = this._formEl;
      if (!container) return;

      // 保存通道配置
      container.querySelector('[data-action="save-channels"]')?.addEventListener('click', async () => {
        const statusEl = container.querySelector('[data-ref="channel-status"]');
        statusEl.textContent = '⏳ 保存中...';
        statusEl.style.color = '#FFD60A';

        try {
          const configs = {};
          container.querySelectorAll('[data-channel]').forEach(input => {
            const channelId = input.dataset.channel;
            const field = input.dataset.field;
            const value = input.type === 'number' ? parseInt(input.value) : input.value;

            if (!configs[channelId]) {
              configs[channelId] = Object.assign({}, this._channelConfigs[channelId] || {});
            }
            configs[channelId][field] = value;
          });

          await this._apiConfig.saveChannelConfig(configs);
          this._channelConfigs = configs;

          // 更新 LLMGateway 通道配置
          if (this._gateway) {
            for (const [channelId, config] of Object.entries(configs)) {
              this._gateway.updateChannel(channelId, config);
            }
          }

          statusEl.textContent = '✅ 通道配置已保存！';
          statusEl.style.color = '#34C759';
          console.log('[ApiSettingsModule] 通道配置已保存:', configs);

          // 3秒后清除状态
          setTimeout(() => {
            if (statusEl.textContent === '✅ 通道配置已保存！') {
              statusEl.textContent = '';
            }
          }, 3000);
        } catch (err) {
          console.error('[ApiSettingsModule] 保存通道配置失败:', err);
          statusEl.textContent = '❌ 保存失败: ' + err.message;
          statusEl.style.color = '#FF453A';
        }
      });

      // 重置通道配置
      container.querySelector('[data-action="reset-channels"]')?.addEventListener('click', async () => {
        if (!confirm('确定要恢复通道配置为默认值吗？')) return;

        try {
          await this._apiConfig.resetChannelConfig();
          this._channelConfigs = await this._apiConfig.getChannelConfig();

          // 重新渲染
          this._renderChannelSection();

          const statusEl = container.querySelector('[data-ref="channel-status"]');
          statusEl.textContent = '🔄 已恢复默认配置';
          statusEl.style.color = '#34C759';
        } catch (err) {
          console.error('[ApiSettingsModule] 重置通道配置失败:', err);
        }
      });
    }

    onRender() {
      this._injectStyles();

      const llmCardsHTML = this._renderLLMCardsByGroup();
      const channelSectionHTML = this._renderChannelSection();

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

            <!-- 区域2.5: 四通道配置（新增） -->
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

    // ==================== 事件绑定 ====================

    _bindEvents() {
      setTimeout(() => {
        this._formEl = this._container?.querySelector('.api-app');
        if (!this._formEl) {
          console.warn('[ApiSettingsModule] 表单容器未找到');
          return;
        }

        // 事件委托：所有点击
        this._formEl.addEventListener('click', (e) => {
          // LLM 卡片折叠/展开
          const toggleEl = e.target.closest('[data-action="toggle"]');
          if (toggleEl) {
            const roleId = toggleEl.getAttribute('data-role');
            if (roleId) this._toggleCard(roleId);
            return;
          }

          // 占位符标签区域折叠/展开
          const togglePhEl = e.target.closest('[data-action="toggle-placeholders"]');
          if (togglePhEl) {
            const roleId = togglePhEl.getAttribute('data-role');
            if (roleId) this._togglePlaceholders(roleId);
            return;
          }

          // 占位符标签点击 - 自动插入到textarea光标位置
          const tagEl = e.target.closest('.api-placeholder-tag');
          if (tagEl) {
            const placeholder = tagEl.getAttribute('data-placeholder') || tagEl.textContent;
            if (placeholder) this._insertPlaceholder(tagEl, placeholder);
            return;
          }

          // API 保存
          const saveApiBtn = e.target.closest('[data-action="save-api"]');
          if (saveApiBtn) {
            this._handleSaveApi().catch((err) => {
              console.error('[ApiSettingsModule] API 保存失败:', err);
              this._showStatus('api-status', '保存失败: ' + err.message, 'error');
            });
            return;
          }

          // API 测试
          const testApiBtn = e.target.closest('[data-action="test-api"]');
          if (testApiBtn) {
            this._handleTestApi().catch((err) => {
              console.error('[ApiSettingsModule] API 测试失败:', err);
              this._showStatus('api-status', '测试失败: ' + err.message, 'error');
            });
            return;
          }

          // LLM 保存
          const saveLlmBtn = e.target.closest('[data-action="save-llm"]');
          if (saveLlmBtn) {
            this._handleSaveLlm().catch((err) => {
              console.error('[ApiSettingsModule] LLM 保存失败:', err);
              this._showStatus('llm-status', '保存失败: ' + err.message, 'error');
            });
            return;
          }

          // LLM 恢复默认
          const resetLlmBtn = e.target.closest('[data-action="reset-llm"]');
          if (resetLlmBtn) {
            this._handleResetLlm().catch((err) => {
              console.error('[ApiSettingsModule] LLM 恢复默认失败:', err);
              this._showStatus('llm-status', '恢复默认失败: ' + err.message, 'error');
            });
            return;
          }

          // [v4.1] 生成大世界
          const genWorldBtn = e.target.closest('[data-action="generate-world"]');
          if (genWorldBtn) {
            this._handleGenerateWorld().catch((err) => {
              console.error('[ApiSettingsModule] 世界生成失败:', err);
            });
            return;
          }

          // [v4.1] 重置世界
          const resetWorldBtn = e.target.closest('[data-action="reset-world"]');
          if (resetWorldBtn) {
            this._handleResetWorld().catch((err) => {
              console.error('[ApiSettingsModule] 世界重置失败:', err);
            });
            return;
          }
        });

        // [v4.1] Director 总开关
        var directorSwitch = this._formEl.querySelector('[data-ref="director-switch"]');
        if (directorSwitch) {
          directorSwitch.addEventListener('change', (e) => {
            this._handleDirectorToggle(e.target.checked).catch((err) => {
              console.error('[ApiSettingsModule] Director开关失败:', err);
            });
          });
        }

        // 温度滑块实时反馈
        this._formEl.addEventListener('input', (e) => {
          if (e.target.classList.contains('api-slider')) {
            const roleId = e.target.getAttribute('data-role');
            if (roleId) this._onTempInput(roleId, e.target.value);
          }
        });

        // DOM 就绪后加载数据
        this._loadSettings().catch((err) => {
          console.error('[ApiSettingsModule] 加载设置失败:', err);
        });

        // [v4.1] 加载世界系统状态
        this._loadWorldSystemState().catch((err) => {
          console.warn('[ApiSettingsModule] 加载世界系统状态失败:', err);
        });

        // [v3.0] 订阅世界事件
        this._subscribeWorldEvents();

        // [v3.3.2-fix] 绑定四通道配置事件
        this._bindChannelEvents();
      }, 0);
    }

    // ==================== 辅助方法 ====================

    /**
     * [v3.0] 订阅世界事件，自动刷新 UI
     * 铁则三：Module 层只订阅事件，不直接操作 Schema
     */
    _subscribeWorldEvents() {
      var eventBus = window.Platform?.eventBus;
      if (!eventBus) return;

      eventBus.on('world:generated', async (data) => {
        console.log('[ApiSettingsModule] 收到 world:generated 事件:', data);
        this._showStatus('world-status', '✅ 世界已更新: ' + (data?.worldName || '未知'), 'success');
        // 通过 Service 获取最新数据刷新 UI
        if (window.__worldService) {
          try {
            var world = await window.__worldService.getWorld(data?.charId || 'default');
            if (world) {
              this._renderWorldInfo(world);
            }
          } catch (e) {
            console.warn('[ApiSettingsModule] 刷新世界信息失败:', e);
          }
        }
      });

      eventBus.on('world:reset', () => {
        console.log('[ApiSettingsModule] 收到 world:reset 事件');
        this._showStatus('world-status', '🗑️ 世界数据已重置', 'success');
        var infoEl = this._getEl('world-info');
        if (infoEl) infoEl.innerHTML = '';
      });
    }

    _getEl(ref) {
      return this._formEl?.querySelector('[data-ref="' + ref + '"]')
        || this._container?.querySelector('[data-ref="' + ref + '"]');
    }

    _showStatus(ref, message, type) {
      const statusEl = this._getEl(ref);
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.className = 'api-form-status';
      if (type) {
        statusEl.classList.add('api-status-' + type);
      }
    }

    // ==================== 数据加载 ====================

    async _loadSettings() {
      // 并行加载 API 配置和 LLM 配置
      const loadApi = this._loadApiConfig();
      const loadLlm = this._loadLlmConfigs();

      await Promise.allSettled([loadApi, loadLlm]);
    }

    async _loadApiConfig() {
      if (!this._apiConfig) return;

      try {
        const config = await this._apiConfig.getMainConfig();

        const baseUrl = this._getEl('baseUrl');
        const apiKey = this._getEl('apiKey');
        const model = this._getEl('model');
        const temp = this._getEl('temperature');
        const maxTokens = this._getEl('maxTokens');

        if (baseUrl) baseUrl.value = config.baseUrl || '';
        if (apiKey) apiKey.value = config.apiKey || '';
        if (model) model.value = config.model || '';
        if (temp) temp.value = config.temperature ?? 0.7;
        if (maxTokens) maxTokens.value = config.maxTokens ?? 2048;
      } catch (err) {
        console.error('[ApiSettingsModule] 加载 API 配置失败:', err);
      }
    }

    async _loadLlmConfigs() {
      if (!this._gateway) {
        console.warn('[ApiSettingsModule] LLMGateway 不可用，无法加载 LLM 配置');
        return;
      }

      try {
        const allConfigs = await this._gateway.getAllRoleConfigs();
        console.log('[ApiSettingsModule] LLM 配置加载结果:', Object.keys(allConfigs || {}));
        if (!allConfigs || typeof allConfigs !== 'object') {
          return;
        }

        const defaults = window.LLMGateway?.DEFAULT_ROLES || {};

        getAvailableRoles().forEach((role) => {
          const roleConfig = allConfigs[role.id] || defaults[role.id] || null;
          console.log('[ApiSettingsModule] 角色', role.id, 'systemPrompt长度:', (roleConfig?.systemPrompt || '').length);
          this._fillRoleConfig(role.id, roleConfig);
        });
      } catch (err) {
        console.error('[ApiSettingsModule] 加载 LLM 配置失败:', err);
        this._showStatus('llm-status', '加载 LLM 配置失败: ' + err.message, 'error');
      }
    }

    // ==================== API 设置操作 ====================

    async _handleSaveApi() {
      const config = {
        provider: 'openai',
        baseUrl: (this._getEl('baseUrl')?.value || '').trim(),
        apiKey: (this._getEl('apiKey')?.value || '').trim(),
        model: (this._getEl('model')?.value || '').trim(),
        temperature: parseFloat(this._getEl('temperature')?.value) || 0.7,
        maxTokens: parseInt(this._getEl('maxTokens')?.value, 10) || 2048,
      };

      try {
        await this._apiConfig.updateMainConfig(config);
        this._showStatus('api-status', '保存成功', 'success');
      } catch (err) {
        this._showStatus('api-status', '保存失败: ' + err.message, 'error');
      }
    }

    async _handleTestApi() {
      if (!this._apiConfig) {
        this._showStatus('api-status', '模块尚未初始化', 'error');
        return;
      }

      this._showStatus('api-status', '测试中...', 'info');

      try {
        const aiService = new window.PhoneServices.AI(window.Platform);
        const result = await aiService.generate('Hello', { maxTokens: 10 });

        if (result) {
          this._showStatus('api-status', '连接成功', 'success');
        } else {
          this._showStatus('api-status', '连接失败: 无响应', 'error');
        }
      } catch (err) {
        this._showStatus('api-status', '连接失败: ' + err.message, 'error');
      }
    }

    // ==================== LLM 配置操作 ====================

    _toggleCard(roleId) {
      this._expandedRoles[roleId] = !this._expandedRoles[roleId];

      const body = this._getEl(roleId + '-body');
      const arrow = this._getEl(roleId + '-arrow');

      if (body) {
        body.classList.toggle('api-expanded', this._expandedRoles[roleId]);
      }
      if (arrow) {
        arrow.classList.toggle('api-expanded', this._expandedRoles[roleId]);
      }
    }

    /**
     * 切换占位符标签区域的显示/隐藏
     * @param {string} roleId - 角色ID
     */
    _togglePlaceholders(roleId) {
      const section = this._getEl(roleId + '-placeholders');
      if (!section) return;

      const tagsContainer = section.querySelector('.api-placeholder-tags');
      const arrow = section.querySelector('.api-placeholder-arrow');
      if (!tagsContainer) return;

      const isHidden = tagsContainer.style.display === 'none' || !tagsContainer.style.display;
      tagsContainer.style.display = isHidden ? 'flex' : 'none';

      if (arrow) {
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    }

    /**
     * 将占位符文本插入到对应的 textarea 光标位置
     * @param {HTMLElement} tagEl - 被点击的标签元素
     * @param {string} placeholder - 占位符文本，如 {{charName}}
     */
    _insertPlaceholder(tagEl, placeholder) {
      // 找到同一个 api-form-group 内的 textarea
      const formGroup = tagEl.closest('.api-form-group');
      if (!formGroup) return;

      const textarea = formGroup.querySelector('.api-textarea');
      if (!textarea) return;

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const value = textarea.value;

      textarea.value = value.substring(0, start) + placeholder + value.substring(end);
      textarea.focus();

      const newPos = start + placeholder.length;
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
    }

    _onTempInput(roleId, value) {
      const tempValEl = this._getEl(roleId + '-temp-val');
      if (tempValEl) {
        tempValEl.textContent = parseFloat(value).toFixed(1);
      }
    }

    _collectRoleConfig(roleId) {
      const tempEl = this._getEl(roleId + '-temp');
      const tokenEl = this._getEl(roleId + '-maxTokens');
      const timeoutEl = this._getEl(roleId + '-timeout');
      const promptEl = this._getEl(roleId + '-systemPrompt');

      const config = {};

      if (tempEl) {
        const temp = parseFloat(tempEl.value);
        if (!isNaN(temp)) config.temperature = temp;
      }
      if (tokenEl) {
        const tokens = parseInt(tokenEl.value, 10);
        if (!isNaN(tokens)) config.maxTokens = tokens;
      }
      if (timeoutEl) {
        const timeout = parseInt(timeoutEl.value, 10);
        if (!isNaN(timeout)) config.timeout = timeout;
      }
      if (promptEl) config.systemPrompt = promptEl.value;

      return config;
    }

    _fillRoleConfig(roleId, config) {
      if (!config) return;

      const tempEl = this._getEl(roleId + '-temp');
      const tempValEl = this._getEl(roleId + '-temp-val');
      const tokenEl = this._getEl(roleId + '-maxTokens');
      const timeoutEl = this._getEl(roleId + '-timeout');
      const promptEl = this._getEl(roleId + '-systemPrompt');

      if (tempEl && config.temperature !== undefined) tempEl.value = config.temperature;
      if (tempValEl && config.temperature !== undefined) tempValEl.textContent = config.temperature.toFixed(1);
      if (tokenEl && config.maxTokens !== undefined) tokenEl.value = config.maxTokens;
      if (timeoutEl && config.timeout !== undefined) timeoutEl.value = config.timeout;
      if (promptEl && config.systemPrompt !== undefined) promptEl.value = config.systemPrompt;
    }

    async _handleSaveLlm() {
      if (!this._gateway) {
        this._showStatus('llm-status', 'LLM 网关未就绪', 'error');
        return;
      }

      this._showStatus('llm-status', '保存中...', 'info');

      try {
        const savePromises = getAvailableRoles().map(async (role) => {
          const config = this._collectRoleConfig(role.id);
          console.log('[ApiSettingsModule] 收集配置', role.id, ':', Object.keys(config), 'systemPrompt长度:', (config.systemPrompt || '').length);
          const currentConfig = await this._gateway.getRoleConfig(role.id);
          const merged = Object.assign({}, currentConfig || {}, config);
          console.log('[ApiSettingsModule] 合并后 systemPrompt长度:', (merged.systemPrompt || '').length);
          return this._gateway.updateRoleConfig(role.id, merged)
            .then(() => {
              console.log('[ApiSettingsModule] 已保存', role.id);
            });
        });

        await Promise.all(savePromises);
        this._showStatus('llm-status', '所有 LLM 配置已保存', 'success');
      } catch (err) {
        console.error('[ApiSettingsModule] LLM 保存失败:', err);
        this._showStatus('llm-status', '保存失败: ' + err.message, 'error');
      }
    }

    async _handleResetLlm() {
      if (!this._gateway) {
        this._showStatus('llm-status', 'LLM 网关未就绪', 'error');
        return;
      }

      this._showStatus('llm-status', '恢复中...', 'info');

      try {
        const resetPromises = getAvailableRoles().map((role) => {
          return this._gateway.resetRoleConfig(role.id)
            .then(() => {
              // 重置后重新读取该角色的配置
              return this._gateway.getRoleConfig(role.id);
            })
            .then((config) => {
              this._fillRoleConfig(role.id, config);
            });
        });

        await Promise.all(resetPromises);
        this._showStatus('llm-status', '已恢复默认配置', 'success');
      } catch (err) {
        console.error('[ApiSettingsModule] LLM 恢复默认失败:', err);
        this._showStatus('llm-status', '恢复默认失败: ' + err.message, 'error');
      }
    }

    // ==================== [v4.1] 大世界系统操作 ====================

    async _loadWorldSystemState() {
      try {
        // 加载 Director 总开关状态
        var directorSwitch = this._getEl('director-switch');
        if (directorSwitch && window.__directorService) {
          directorSwitch.checked = window.__directorService.isMasterSwitchOn();
        }

        // 加载世界信息
        if (window.__worldService) {
          var world = await window.__worldService.getWorld('default');
          if (world) {
            this._renderWorldInfo(world);
          }
        }
      } catch (e) {
        console.warn('[ApiSettingsModule] 加载世界状态失败:', e);
      }
    }

    async _handleDirectorToggle(enabled) {
      try {
        if (window.__directorService) {
          await window.__directorService.setMasterSwitch(enabled);
          this._showStatus('world-status', enabled ? '✅ AI管家已开启' : '⏸️ AI管家已关闭', enabled ? 'success' : 'info');
        } else {
          this._showStatus('world-status', 'DirectorService 不可用', 'error');
        }
      } catch (e) {
        this._showStatus('world-status', '操作失败: ' + e.message, 'error');
      }
    }

    async _handleGenerateWorld() {
      if (!window.__worldService) {
        this._showStatus('world-status', 'WorldService 不可用', 'error');
        return;
      }

      this._showStatus('world-status', '🌍 正在生成大世界（两步生成）...', 'info');

      try {
        // [v4.3-fix] 使用两步生成（V2），生成包含洋葱叙事结构的完整世界
        var result = await window.__worldService.generateFullWorldV2('default');
        var worldName = result.meta?.truth?.background
          ? result.meta.truth.background.substring(0, 30) + '...'
          : (result.world?.name || '未知');
        this._showStatus('world-status', '✅ 世界生成完成: ' + worldName + ' (' + (result.npcs?.length || 0) + '个NPC)', 'success');
        // 刷新世界信息显示
        var world = await window.__worldService.getWorld('default');
        if (world) {
          this._renderWorldInfo(world);
        }
      } catch (e) {
        console.error('[ApiSettingsModule] V2世界生成失败，尝试V1降级:', e);
        try {
          // 降级到 V1 单步生成
          var result = await window.__worldService.generateWorld('default');
          this._showStatus('world-status', '✅ 世界生成完成(V1降级): ' + (result.world?.name || '未知'), 'success');
          var world = await window.__worldService.getWorld('default');
          if (world) {
            this._renderWorldInfo(world);
          }
        } catch (e2) {
          this._showStatus('world-status', '❌ 生成失败: ' + e2.message, 'error');
        }
      }
    }

    async _handleResetWorld() {
      if (!window.__worldService) {
        this._showStatus('world-status', 'WorldService 不可用', 'error');
        return;
      }

      try {
        await window.__worldService.resetWorld('default');
        this._showStatus('world-status', '🗑️ 世界数据已重置', 'success');
        var infoEl = this._getEl('world-info');
        if (infoEl) infoEl.innerHTML = '';
      } catch (e) {
        this._showStatus('world-status', '❌ 重置失败: ' + e.message, 'error');
      }
    }

    _renderWorldInfo(world) {
      var infoEl = this._getEl('world-info');
      if (!infoEl || !world) return;

      // [v4.3-fix] 兼容 V1 和 V2 数据结构
      var worldName = world.name || world.meta?.truth?.background?.substring(0, 30) || '未知世界';
      var era = world.era || world.meta?.atmosphere?.current?.mood || '';
      var theme = world.theme || '';
      var description = world.description || world.meta?.truth?.background || '';
      var keyLocations = world.keyLocations || world.maps?.outdoor?.nodes?.map(function(n) { return n.name; }) || [];
      
      // [v4.3-fix] factions 可能是字符串数组或对象数组
      var factionNames = [];
      if (world.factions && world.factions.length > 0) {
        factionNames = world.factions.map(function(f) {
          return typeof f === 'string' ? f : (f.name || f.description || '');
        }).filter(Boolean);
      }
      
      // [v4.3-fix] rules 可能是字符串数组或对象
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
      infoEl.innerHTML = parts.join('');
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new ApiSettingsModule();
      return {
        id: instance.id,
        name: instance.name,
        icon: instance.icon,
        iconBg: instance.iconBg,
        init: (phone, params) => instance.init(phone, params),
        resume: (params) => instance.resume(params),
        pause: () => instance.pause(),
        destroy: () => instance.destroy(),
        render: () => instance.render(),
      };
    }
  }

  // ==================== 导出 ====================

  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.ApiSettings = ApiSettingsModule;

  console.log('[Module] ApiSettingsModule (统一设置面板) 已加载');
})();
