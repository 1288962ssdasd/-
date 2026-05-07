/**
 * StatusAppNew - 状态应用重写模块
 * 继承 ContextDrivenApp 基类，使用 ES6+ 语法
 * 功能：查看角色状态（HP/MP/属性面板）、NPC 列表展示
 * CSS 前缀: status-new-
 */
;(function () {
  'use strict';

  /** 属性配置映射：中文名 -> 显示配置 */
  const ATTR_CONFIG = {
    'HP':       { key: 'hp',       label: 'HP',  color: '#e74c3c', icon: '&#10084;', max: 100 },
    'MP':       { key: 'mp',       label: 'MP',  color: '#3498db', icon: '&#9733;',  max: 100 },
    '力量':     { key: 'strength', label: '力量', color: '#e67e22', icon: '&#128170;', max: 100 },
    '敏捷':     { key: 'agility',  label: '敏捷', color: '#2ecc71', icon: '&#127939;', max: 100 },
    '智力':     { key: 'intel',    label: '智力', color: '#9b59b6', icon: '&#128218;', max: 100 },
    '体力':     { key: 'stamina',  label: '体力', color: '#f39c12', icon: '&#128293;', max: 100 },
    '魅力':     { key: 'charisma', label: '魅力', color: '#e91e63', icon: '&#128149;', max: 100 },
    '幸运':     { key: 'luck',     label: '幸运', color: '#ff9800', icon: '&#127808;', max: 100 },
    '防御':     { key: 'defense',  label: '防御', color: '#607d8b', icon: '&#128737;', max: 100 },
    '速度':     { key: 'speed',    label: '速度', color: '#00bcd4', icon: '&#9889;',  max: 100 },
  };

  class StatusAppNew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'StatusAppNew' });

      /** @type {Object} 角色状态数据 */
      this._status = {
        name: '',
        level: 1,
        exp: 0,
        expMax: 100,
        avatar: '',
        attrs: {},
      };

      /** @type {Array<{id:string, name:string, role:string, desc:string, relation:string}>} NPC 列表 */
      this._npcList = [];

      /** @type {'status'|'npc'} 当前视图 */
      this._currentView = 'status';

      /** @type {Object|null} 数据层引用 */
      this._phoneDataStore = null;

      /** @type {Object|null} 配置管理器引用 */
      this._configManager = null;
    }

    /* ------------------------------------------------------------------ */
    /*  生命周期                                                           */
    /* ------------------------------------------------------------------ */

    onInit() {
      this._phoneDataStore = this.getService('phoneDataStore');
      this._configManager = this.getService('configManager');
      this._parseStatusFromContext();
      this._parseNPCFromContext();
      this.updateHeader('角色状态');
      console.log('[StatusAppNew] 初始化完成');
    }

    onDestroy() {
      this._status = { name: '', level: 1, exp: 0, expMax: 100, avatar: '', attrs: {} };
      this._npcList = [];
    }

    /* ------------------------------------------------------------------ */
    /*  数据层                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * 获取目标消息 ID
     * @returns {string|number}
     */
    _resolveTargetMessageId() {
      if (typeof window.getLastMessageId !== 'function' || typeof window.getChatMessages !== 'function') {
        return 'latest';
      }
      let currentId = window.getLastMessageId();
      while (currentId >= 0) {
        const message = window.getChatMessages(currentId).at(-1);
        if (message && message.role !== 'user') {
          return currentId;
        }
        currentId--;
      }
      return 'latest';
    }

    /**
     * 从 Mvu / SillyTavern context 读取原始状态数据
     * @returns {Object|null}
     */
    _getRawStatusData() {
      // 路径 1: Mvu
      if (window.Mvu && typeof window.Mvu.getMvuData === 'function') {
        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (mvuData?.stat_data?.['角色状态']) {
          return mvuData.stat_data['角色状态'];
        }
        if (mvuData?.['角色状态']) {
          return mvuData['角色状态'];
        }
      }

      // 路径 2: SillyTavern context
      if (window.SillyTavern) {
        const ctx = typeof window.SillyTavern.getContext === 'function'
          ? window.SillyTavern.getContext()
          : window.SillyTavern;
        const statData = ctx?.chatMetadata?.variables?.['stat_data'];
        if (statData?.['角色状态']) {
          return statData['角色状态'];
        }
        const direct = ctx?.chatMetadata?.variables?.['角色状态'];
        if (direct && typeof direct === 'object') {
          return direct;
        }
      }

      // 路径 3: ConfigManager
      if (this._configManager) {
        try {
          const raw = this._configManager.get('xb.status.character');
          if (raw) {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (e) {
          console.warn('[StatusAppNew] ConfigManager 读取失败:', e);
        }
      }

      return null;
    }

    /**
     * 从 Mvu / SillyTavern context 读取 NPC 数据
     * @returns {Object|null}
     */
    _getRawNPCData() {
      if (window.Mvu && typeof window.Mvu.getMvuData === 'function') {
        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (mvuData?.stat_data?.['NPC']) {
          return mvuData.stat_data['NPC'];
        }
        if (mvuData?.['NPC']) {
          return mvuData['NPC'];
        }
      }

      if (window.SillyTavern) {
        const ctx = typeof window.SillyTavern.getContext === 'function'
          ? window.SillyTavern.getContext()
          : window.SillyTavern;
        const statData = ctx?.chatMetadata?.variables?.['stat_data'];
        if (statData?.['NPC']) {
          return statData['NPC'];
        }
        const direct = ctx?.chatMetadata?.variables?.['NPC'];
        if (direct && typeof direct === 'object') {
          return direct;
        }
      }

      if (this._configManager) {
        try {
          const raw = this._configManager.get('xb.status.npcs');
          if (raw) {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (e) {
          console.warn('[StatusAppNew] ConfigManager NPC 读取失败:', e);
        }
      }

      return null;
    }

    /**
     * 解析角色状态数据
     * @param {Object} rawData
     */
    _parseStatusData(rawData) {
      if (!rawData || typeof rawData !== 'object') return;

      const val = (field) =>
        Array.isArray(rawData[field]) ? rawData[field][0] : (rawData[field] || '');

      this._status.name = val('名称') || val('name') || '未知角色';
      this._status.level = parseInt(val('等级') || val('level') || '1', 10) || 1;
      this._status.exp = parseInt(val('经验') || val('exp') || '0', 10) || 0;
      this._status.expMax = parseInt(val('经验上限') || val('expMax') || '100', 10) || 100;
      this._status.avatar = val('头像') || val('avatar') || '';

      // 解析属性
      this._status.attrs = {};
      for (const attrName of Object.keys(ATTR_CONFIG)) {
        const rawVal = val(attrName);
        if (rawVal !== '') {
          this._status.attrs[attrName] = {
            current: parseInt(rawVal, 10) || 0,
            max: parseInt(val(attrName + '上限') || ATTR_CONFIG[attrName].max, 10) || ATTR_CONFIG[attrName].max,
          };
        }
      }
    }

    /**
     * 解析 NPC 列表数据
     * @param {Object} rawData
     */
    _parseNPCData(rawData) {
      if (!rawData || typeof rawData !== 'object') return;

      this._npcList = [];
      for (const key of Object.keys(rawData)) {
        if (key === '$meta') continue;

        const entry = rawData[key];
        if (!entry || typeof entry !== 'object') continue;

        const val = (field) =>
          Array.isArray(entry[field]) ? entry[field][0] : (entry[field] || '');

        this._npcList.push({
          id: key,
          name: val('名称') || val('name') || key,
          role: val('身份') || val('role') || '',
          desc: val('描述') || val('desc') || '',
          relation: val('关系') || val('relation') || '',
        });
      }
    }

    /**
     * 从上下文解析角色状态
     */
    _parseStatusFromContext() {
      const raw = this._getRawStatusData();
      if (raw) {
        this._parseStatusData(raw);
        console.log('[StatusAppNew] 角色状态解析完成:', this._status.name);
      } else {
        console.log('[StatusAppNew] 未找到角色状态数据');
      }
    }

    /**
     * 从上下文解析 NPC 列表
     */
    _parseNPCFromContext() {
      const raw = this._getRawNPCData();
      if (raw) {
        this._parseNPCData(raw);
        console.log(`[StatusAppNew] 解析到 ${this._npcList.length} 个 NPC`);
      } else {
        this._npcList = [];
        console.log('[StatusAppNew] 未找到 NPC 数据');
      }
    }

    /**
     * 计算数据哈希
     * @returns {string}
     */
    _computeDataHash() {
      try {
        return JSON.stringify({ status: this._status, npcs: this._npcList });
      } catch (_) {
        return '';
      }
    }

    /* ------------------------------------------------------------------ */
    /*  渲染                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * 渲染角色头像区域
     * @returns {string}
     */
    _renderAvatarSection() {
      const expPercent = this._status.expMax > 0
        ? Math.min(100, Math.round((this._status.exp / this._status.expMax) * 100))
        : 0;

      return `
        <div class="status-new-avatar-section">
          <div class="status-new-avatar">
            ${this._status.avatar
              ? `<img src="${this._esc(this._status.avatar)}" alt="${this._esc(this._status.name)}" class="status-new-avatar-img">`
              : `<div class="status-new-avatar-placeholder">${this._esc(this._status.name[0] || '?')}</div>`
            }
          </div>
          <div class="status-new-name">${this._esc(this._status.name)}</div>
          <div class="status-new-level">Lv. ${this._status.level}</div>
          <div class="status-new-exp-bar">
            <div class="status-new-exp-fill" style="width: ${expPercent}%"></div>
          </div>
          <div class="status-new-exp-text">EXP: ${this._status.exp} / ${this._status.expMax}</div>
        </div>`;
    }

    /**
     * 渲染属性面板
     * @returns {string}
     */
    _renderAttrPanel() {
      const attrEntries = Object.keys(ATTR_CONFIG);
      const activeAttrs = attrEntries.filter((name) => this._status.attrs[name]);

      if (activeAttrs.length === 0) {
        return `
          <div class="status-new-empty-attrs">
            <div class="status-new-empty-icon">&#128200;</div>
            <div class="status-new-empty-text">暂无属性数据</div>
          </div>`;
      }

      return `
        <div class="status-new-attrs">
          ${activeAttrs.map((name) => {
            const cfg = ATTR_CONFIG[name];
            const attr = this._status.attrs[name];
            const percent = attr.max > 0 ? Math.min(100, Math.round((attr.current / attr.max) * 100)) : 0;
            return `
              <div class="status-new-attr-row">
                <span class="status-new-attr-icon">${cfg.icon}</span>
                <span class="status-new-attr-label">${cfg.label}</span>
                <div class="status-new-attr-bar">
                  <div class="status-new-attr-fill" style="width: ${percent}%; background: ${cfg.color}"></div>
                </div>
                <span class="status-new-attr-value">${attr.current}/${attr.max}</span>
              </div>`;
          }).join('')}
        </div>`;
    }

    /**
     * 渲染状态视图
     * @returns {string}
     */
    _renderStatusView() {
      return `
        <div class="status-new-panel">
          ${this._renderAvatarSection()}
          <div class="status-new-section-title">属性面板</div>
          ${this._renderAttrPanel()}
        </div>`;
    }

    /**
     * 渲染 NPC 列表视图
     * @returns {string}
     */
    _renderNPCView() {
      if (this._npcList.length === 0) {
        return `
          <div class="status-new-npc-panel">
            <div class="status-new-section-title">NPC 列表</div>
            <div class="status-new-empty">
              <div class="status-new-empty-icon">&#128101;</div>
              <div class="status-new-empty-title">暂无 NPC 数据</div>
              <div class="status-new-empty-hint">NPC 信息将在互动后出现</div>
            </div>
          </div>`;
      }

      return `
        <div class="status-new-npc-panel">
          <div class="status-new-section-title">NPC 列表 (${this._npcList.length})</div>
          <div class="status-new-npc-list">
            ${this._npcList.map((npc) => `
              <div class="status-new-npc-card" data-npc-id="${this._esc(npc.id)}">
                <div class="status-new-npc-avatar">${this._esc(npc.name[0] || '?')}</div>
                <div class="status-new-npc-info">
                  <div class="status-new-npc-name">${this._esc(npc.name)}</div>
                  ${npc.role ? `<div class="status-new-npc-role">${this._esc(npc.role)}</div>` : ''}
                  ${npc.relation ? `<div class="status-new-npc-relation">${this._esc(npc.relation)}</div>` : ''}
                  ${npc.desc ? `<div class="status-new-npc-desc">${this._esc(npc.desc)}</div>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }

    /**
     * 渲染 Tab 导航
     * @returns {string}
     */
    _renderTabs() {
      const tabs = [
        { key: 'status', label: '角色状态', icon: '&#128100;' },
        { key: 'npc', label: 'NPC 列表', icon: '&#128101;' },
      ];

      return `
        <div class="status-new-tabs">
          ${tabs.map((t) => `
            <button class="status-new-tab ${this._currentView === t.key ? 'active' : ''}" data-view="${t.key}">
              ${t.icon} ${t.label}
            </button>`).join('')}
        </div>`;
    }

    /**
     * 返回应用完整 HTML
     * @returns {string}
     */
    getAppContent() {
      this._parseStatusFromContext();
      this._parseNPCFromContext();

      const content = this._currentView === 'npc'
        ? this._renderNPCView()
        : this._renderStatusView();

      return `
        <div class="status-new-app">
          ${this._renderTabs()}
          <div class="status-new-content" id="status-new-content">${content}</div>
        </div>`;
    }

    /* ------------------------------------------------------------------ */
    /*  事件绑定                                                           */
    /* ------------------------------------------------------------------ */

    bindEvents() {
      const container = document.getElementById(this._containerId);
      if (!container) return;

      // Tab 切换
      container.querySelectorAll('.status-new-tab').forEach((tab) => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._switchView(e.currentTarget.dataset.view);
        });
      });
    }

    /**
     * 切换视图
     * @param {string} view
     */
    _switchView(view) {
      if (this._currentView === view) return;
      this._currentView = view;

      const titles = { status: '角色状态', npc: 'NPC 列表' };
      this.updateHeader(titles[view] || '角色状态');
      this.render();
    }

    /* ------------------------------------------------------------------ */
    /*  工具方法                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * HTML 转义
     * @param {string} str
     * @returns {string}
     */
    _esc(str) {
      if (!str) return '';
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(str).replace(/[&<>"']/g, (c) => map[c]);
    }
  }

  window.StatusAppNew = new StatusAppNew();
  console.log('[StatusAppNew] 模块加载完成');
})();
