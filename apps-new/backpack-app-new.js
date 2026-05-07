/**
 * BackpackAppNew - 背包应用重写模块
 * 继承 ContextDrivenApp 基类，使用 ES6+ 语法
 * 功能：浏览物品、搜索过滤、分类筛选、使用物品
 * CSS 前缀: backpack-new-
 */
;(function () {
  'use strict';

  /** 物品类型配置 */
  const TYPE_CONFIG = {
    '武器':   { icon: '&#9876;',  color: '#e74c3c', bg: '#fdecea' },
    '防具':   { icon: '&#128737;', color: '#3498db', bg: '#ebf5fb' },
    '药水':   { icon: '&#127861;', color: '#2ecc71', bg: '#eafaf1' },
    '食物':   { icon: '&#127860;', color: '#f39c12', bg: '#fef9e7' },
    '材料':   { icon: '&#128300;', color: '#9b59b6', bg: '#f4ecf7' },
    '饰品':   { icon: '&#128142;', color: '#e91e63', bg: '#fce4ec' },
    '工具':   { icon: '&#128295;', color: '#607d8b', bg: '#eceff1' },
    '书籍':   { icon: '&#128214;', color: '#795548', bg: '#efebe9' },
    '任务物品': { icon: '&#128203;', color: '#ff9800', bg: '#fff3e0' },
    '其他':   { icon: '&#128230;', color: '#95a5a6', bg: '#f5f5f5' },
  };

  class BackpackAppNew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'BackpackAppNew' });

      /** @type {Array<{id:string, name:string, quantity:number, type:string, desc:string, icon:string}>} 物品列表 */
      this._items = [];

      /** @type {string} 当前分类筛选 */
      this._currentCategory = '全部';

      /** @type {string} 搜索关键词 */
      this._searchKeyword = '';

      /** @type {string|null} 当前查看详情的物品 ID */
      this._currentItemId = null;

      /** @type {'grid'|'detail'} 当前视图 */
      this._currentView = 'grid';

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
      this._parseItemsFromContext();
      this.updateHeader('背包');
      console.log('[BackpackAppNew] 初始化完成');
    }

    onDestroy() {
      this._items = [];
      this._currentItemId = null;
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
     * 从 Mvu / SillyTavern context 读取原始物品数据
     * @returns {Object|null}
     */
    _getRawItemData() {
      // 路径 1: Mvu
      if (window.Mvu && typeof window.Mvu.getMvuData === 'function') {
        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (mvuData?.stat_data?.['背包']) {
          return mvuData.stat_data['背包'];
        }
        if (mvuData?.['背包']) {
          return mvuData['背包'];
        }
        // 备用键名
        if (mvuData?.stat_data?.['物品']) {
          return mvuData.stat_data['物品'];
        }
        if (mvuData?.['物品']) {
          return mvuData['物品'];
        }
      }

      // 路径 2: SillyTavern context
      if (window.SillyTavern) {
        const ctx = typeof window.SillyTavern.getContext === 'function'
          ? window.SillyTavern.getContext()
          : window.SillyTavern;
        const statData = ctx?.chatMetadata?.variables?.['stat_data'];
        if (statData?.['背包']) {
          return statData['背包'];
        }
        if (statData?.['物品']) {
          return statData['物品'];
        }
        const direct = ctx?.chatMetadata?.variables?.['背包'];
        if (direct && typeof direct === 'object') {
          return direct;
        }
      }

      // 路径 3: ConfigManager
      if (this._configManager) {
        try {
          const raw = this._configManager.get('xb.backpack.items');
          if (raw) {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (e) {
          console.warn('[BackpackAppNew] ConfigManager 读取失败:', e);
        }
      }

      return null;
    }

    /**
     * 解析物品数据
     * @param {Object} rawData
     * @returns {Array}
     */
    _parseItemData(rawData) {
      if (!rawData || typeof rawData !== 'object') return [];

      const items = [];
      for (const key of Object.keys(rawData)) {
        if (key === '$meta') continue;

        const entry = rawData[key];
        if (!entry || typeof entry !== 'object') continue;

        const val = (field) =>
          Array.isArray(entry[field]) ? entry[field][0] : (entry[field] || '');

        const quantity = parseInt(val('数量') || val('quantity') || '1', 10) || 1;

        items.push({
          id: key,
          name: val('名称') || val('name') || key,
          quantity,
          type: val('类型') || val('type') || '其他',
          desc: val('描述') || val('desc') || '',
          icon: val('图标') || val('icon') || '',
        });
      }

      return items;
    }

    /**
     * 从上下文解析物品列表
     */
    _parseItemsFromContext() {
      const raw = this._getRawItemData();
      if (raw) {
        this._items = this._parseItemData(raw);
        console.log(`[BackpackAppNew] 解析到 ${this._items.length} 个物品`);
      } else {
        this._items = [];
        console.log('[BackpackAppNew] 未找到物品数据');
      }
    }

    /**
     * 计算数据哈希
     * @returns {string}
     */
    _computeDataHash() {
      try {
        return JSON.stringify(this._items);
      } catch (_) {
        return '';
      }
    }

    /* ------------------------------------------------------------------ */
    /*  物品操作                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * 使用物品
     * @param {string} itemId
     */
    _useItem(itemId) {
      const item = this._items.find((i) => i.id === itemId);
      if (!item) {
        this.showToast('物品不存在', 'warning');
        return;
      }

      if (!confirm(`确定使用「${item.name}」吗？`)) return;

      // 消耗型物品减少数量
      if (item.quantity > 1) {
        item.quantity--;
        this.showToast(`使用了 ${item.name}（剩余 ${item.quantity}）`, 'success');
      } else {
        this._items = this._items.filter((i) => i.id !== itemId);
        this.showToast(`使用了 ${item.name}`, 'success');
      }

      this._currentView = 'grid';
      this._currentItemId = null;
      this.updateHeader('背包');
      this.render();
    }

    /* ------------------------------------------------------------------ */
    /*  筛选与搜索                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * 获取所有分类
     * @returns {Array<string>}
     */
    _getCategories() {
      const cats = new Set(this._items.map((i) => i.type));
      return ['全部', ...Array.from(cats)];
    }

    /**
     * 筛选物品
     * @returns {Array}
     */
    _getFilteredItems() {
      let filtered = this._items;

      // 分类筛选
      if (this._currentCategory !== '全部') {
        filtered = filtered.filter((i) => i.type === this._currentCategory);
      }

      // 搜索关键词
      if (this._searchKeyword) {
        const kw = this._searchKeyword.toLowerCase();
        filtered = filtered.filter((i) =>
          i.name.toLowerCase().includes(kw) ||
          i.desc.toLowerCase().includes(kw) ||
          i.type.toLowerCase().includes(kw),
        );
      }

      return filtered;
    }

    /**
     * 计算物品总数
     * @returns {number}
     */
    _getTotalCount() {
      return this._items.reduce((sum, i) => sum + i.quantity, 0);
    }

    /* ------------------------------------------------------------------ */
    /*  渲染                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * 渲染搜索栏
     * @returns {string}
     */
    _renderSearchBar() {
      return `
        <div class="backpack-new-search">
          <input type="text" class="backpack-new-search-input" id="backpack-new-search"
            placeholder="搜索物品..." value="${this._esc(this._searchKeyword)}">
        </div>`;
    }

    /**
     * 渲染分类筛选栏
     * @returns {string}
     */
    _renderCategoryBar() {
      const categories = this._getCategories();
      return `
        <div class="backpack-new-categories">
          ${categories.map((cat) => {
            const cfg = TYPE_CONFIG[cat] || TYPE_CONFIG['其他'];
            return `
              <button class="backpack-new-cat-btn ${this._currentCategory === cat ? 'active' : ''}" data-category="${this._esc(cat)}">
                ${cfg.icon} ${this._esc(cat)}
              </button>`;
          }).join('')}
        </div>`;
    }

    /**
     * 渲染统计栏
     * @returns {string}
     */
    _renderStatsBar() {
      const totalCount = this._getTotalCount();
      const typeCount = this._items.length;
      return `
        <div class="backpack-new-stats">
          <span class="backpack-new-stat">物品种类: ${typeCount}</span>
          <span class="backpack-new-stat">物品总数: ${totalCount}</span>
        </div>`;
    }

    /**
     * 渲染物品图标
     * @param {Object} item
     * @param {string} size - 'normal' | 'large'
     * @returns {string}
     */
    _renderItemIcon(item, size) {
      const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG['其他'];
      const sizeClass = size === 'large' ? ' backpack-new-icon-lg' : '';

      if (item.icon) {
        return `<div class="backpack-new-item-icon${sizeClass}" style="background: ${cfg.bg}">
          <img src="${this._esc(item.icon)}" alt="${this._esc(item.name)}" class="backpack-new-icon-img">
        </div>`;
      }

      return `<div class="backpack-new-item-icon${sizeClass}" style="background: ${cfg.bg}; color: ${cfg.color}">
        ${cfg.icon}
      </div>`;
    }

    /**
     * 渲染单个物品卡片
     * @param {Object} item
     * @returns {string}
     */
    _renderItemCard(item) {
      const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG['其他'];

      return `
        <div class="backpack-new-item-card" data-item-id="${this._esc(item.id)}">
          ${this._renderItemIcon(item, 'normal')}
          <div class="backpack-new-item-name">${this._esc(item.name)}</div>
          <div class="backpack-new-item-type" style="color: ${cfg.color}">${this._esc(item.type)}</div>
          <div class="backpack-new-item-qty">x${item.quantity}</div>
        </div>`;
    }

    /**
     * 渲染物品网格
     * @returns {string}
     */
    _renderItemGrid() {
      const filtered = this._getFilteredItems();

      if (filtered.length === 0) {
        return `
          <div class="backpack-new-empty">
            <div class="backpack-new-empty-icon">&#127890;</div>
            <div class="backpack-new-empty-title">${this._items.length === 0 ? '背包是空的' : '没有找到物品'}</div>
            <div class="backpack-new-empty-hint">${this._items.length === 0 ? '探索世界来获取物品吧' : '试试其他分类或关键词'}</div>
          </div>`;
      }

      return `
        <div class="backpack-new-item-grid">
          ${filtered.map((item) => this._renderItemCard(item)).join('')}
        </div>`;
    }

    /**
     * 渲染物品详情
     * @param {Object} item
     * @returns {string}
     */
    _renderItemDetail(item) {
      if (!item) {
        return `
          <div class="backpack-new-empty">
            <div class="backpack-new-empty-title">物品不存在</div>
          </div>`;
      }

      const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG['其他'];

      return `
        <div class="backpack-new-detail">
          <div class="backpack-new-detail-header">
            <button class="backpack-new-btn-back" id="backpack-new-back">&larr; 返回</button>
          </div>
          <div class="backpack-new-detail-body">
            <div class="backpack-new-detail-icon">
              ${this._renderItemIcon(item, 'large')}
            </div>
            <div class="backpack-new-detail-info">
              <div class="backpack-new-detail-name">${this._esc(item.name)}</div>
              <div class="backpack-new-detail-type" style="color: ${cfg.color}">
                ${cfg.icon} ${this._esc(item.type)}
              </div>
              <div class="backpack-new-detail-qty">数量: ${item.quantity}</div>
              ${item.desc ? `<div class="backpack-new-detail-desc">${this._esc(item.desc)}</div>` : ''}
            </div>
          </div>
          <div class="backpack-new-detail-actions">
            <button class="backpack-new-btn backpack-new-btn-use" data-item-id="${this._esc(item.id)}">使用</button>
          </div>
        </div>`;
    }

    /**
     * 返回应用完整 HTML
     * @returns {string}
     */
    getAppContent() {
      this._parseItemsFromContext();

      let content = '';
      if (this._currentView === 'detail') {
        const item = this._items.find((i) => i.id === this._currentItemId);
        content = this._renderItemDetail(item);
      } else {
        content = `
          ${this._renderStatsBar()}
          ${this._renderSearchBar()}
          ${this._renderCategoryBar()}
          ${this._renderItemGrid()}`;
      }

      return `
        <div class="backpack-new-app">
          <div class="backpack-new-content" id="backpack-new-content">${content}</div>
        </div>`;
    }

    /* ------------------------------------------------------------------ */
    /*  事件绑定                                                           */
    /* ------------------------------------------------------------------ */

    bindEvents() {
      const container = document.getElementById(this._containerId);
      if (!container) return;

      // 返回按钮
      const backBtn = container.querySelector('#backpack-new-back');
      if (backBtn) {
        backBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentView = 'grid';
          this._currentItemId = null;
          this.updateHeader('背包');
          this.render();
        });
      }

      // 物品卡片点击 -> 查看详情
      container.querySelectorAll('.backpack-new-item-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentItemId = e.currentTarget.dataset.itemId;
          this._currentView = 'detail';
          const item = this._items.find((i) => i.id === this._currentItemId);
          this.updateHeader(item ? item.name : '物品详情');
          this.render();
        });
      });

      // 使用物品
      container.querySelectorAll('.backpack-new-btn-use').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._useItem(e.currentTarget.dataset.itemId);
        });
      });

      // 分类筛选
      container.querySelectorAll('.backpack-new-cat-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentCategory = e.currentTarget.dataset.category;
          this.render();
        });
      });

      // 搜索输入
      const searchInput = container.querySelector('#backpack-new-search');
      if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this._searchKeyword = e.target.value.trim();
            this.render();
            // 重新聚焦搜索框
            const newInput = document.getElementById('backpack-new-search');
            if (newInput) {
              newInput.focus();
              newInput.setSelectionRange(newInput.value.length, newInput.value.length);
            }
          }, 300);
        });
      }
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

  window.BackpackAppNew = new BackpackAppNew();
  console.log('[BackpackAppNew] 模块加载完成');
})();
