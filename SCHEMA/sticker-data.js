/**
 * StickerData - 表情包数据 Schema 辅助函数
 * 
 * 内置JSON定义 + SVG/CSS渲染
 * 
 * 严格遵守铁则2：所有数据读写通过 Schema 辅助函数
 */

;(function () {
  'use strict';

  const DOMAIN = 'sticker';

  /**
   * 内置表情包定义（SVG/CSS渲染）
   * 每个表情包含：id, name, category, svg(内联SVG代码)
   */
  const BUILTIN_STICKERS = [
    // ========== 经典表情 ==========
    { id: 'smile', name: '微笑', category: 'classic', emoji: '😊' },
    { id: 'laugh', name: '大笑', category: 'classic', emoji: '😄' },
    { id: 'cry', name: '哭泣', category: 'classic', emoji: '😢' },
    { id: 'angry', name: '愤怒', category: 'classic', emoji: '😠' },
    { id: 'love', name: '喜爱', category: 'classic', emoji: '😍' },
    { id: 'shy', name: '害羞', category: 'classic', emoji: '😳' },
    { id: 'cool', name: '酷', category: 'classic', emoji: '😎' },
    { id: 'think', name: '思考', category: 'classic', emoji: '🤔' },
    { id: 'ok', name: 'OK', category: 'classic', emoji: '👌' },
    { id: 'thumbup', name: '点赞', category: 'classic', emoji: '👍' },
    { id: 'thumbdown', name: '踩', category: 'classic', emoji: '👎' },
    { id: 'clap', name: '鼓掌', category: 'classic', emoji: '👏' },
    
    // ========== 表情动作 ==========
    { id: 'facepalm', name: '捂脸', category: 'action', emoji: '🤦' },
    { id: 'shrug', name: '摊手', category: 'action', emoji: '🤷' },
    { id: 'facepalm2', name: '扶额', category: 'action', emoji: '😑' },
    { id: 'sweat', name: '流汗', category: 'action', emoji: '😅' },
    { id: 'sleep', name: '睡觉', category: 'action', emoji: '😴' },
    { id: 'sneeze', name: '打喷嚏', category: 'action', emoji: '🤧' },
    { id: 'vomit', name: '呕吐', category: 'action', emoji: '🤮' },
    { id: 'dizzy', name: '晕', category: 'action', emoji: '😵' },
    
    // ========== 动物表情 ==========
    { id: 'dog', name: '狗', category: 'animal', emoji: '🐶' },
    { id: 'cat', name: '猫', category: 'animal', emoji: '🐱' },
    { id: 'panda', name: '熊猫', category: 'animal', emoji: '🐼' },
    { id: 'pig', name: '猪', category: 'animal', emoji: '🐷' },
    { id: 'rabbit', name: '兔子', category: 'animal', emoji: '🐰' },
    { id: 'fox', name: '狐狸', category: 'animal', emoji: '🦊' },
    { id: 'bear', name: '熊', category: 'animal', emoji: '🐻' },
    { id: 'monkey', name: '猴子', category: 'animal', emoji: '🐵' },
    
    // ========== 食物表情 ==========
    { id: 'coffee', name: '咖啡', category: 'food', emoji: '☕' },
    { id: 'beer', name: '啤酒', category: 'food', emoji: '🍺' },
    { id: 'cake', name: '蛋糕', category: 'food', emoji: '🎂' },
    { id: 'pizza', name: '披萨', category: 'food', emoji: '🍕' },
    { id: 'icecream', name: '冰淇淋', category: 'food', emoji: '🍦' },
    { id: 'heart', name: '爱心', category: 'symbol', emoji: '❤️' },
    { id: 'brokenheart', name: '心碎', category: 'symbol', emoji: '💔' },
    { id: 'star', name: '星星', category: 'symbol', emoji: '⭐' },
    { id: 'fire', name: '火', category: 'symbol', emoji: '🔥' },
    { id: 'sparkles', name: '闪亮', category: 'symbol', emoji: '✨' },
    { id: 'rocket', name: '火箭', category: 'symbol', emoji: '🚀' },
    { id: 'gift', name: '礼物', category: 'symbol', emoji: '🎁' },
  ];

  // 分类定义
  const CATEGORIES = [
    { id: 'classic', name: '经典', icon: '😀' },
    { id: 'action', name: '动作', icon: '🤦' },
    { id: 'animal', name: '动物', icon: '🐶' },
    { id: 'food', name: '食物', icon: '🍕' },
    { id: 'symbol', name: '符号', icon: '❤️' },
    { id: 'recent', name: '最近', icon: '🕐' },
  ];

  /**
   * StickerData 表情包数据操作类
   */
  class StickerData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 读取操作 ====================

    /**
     * 获取所有内置表情
     * @returns {Array}
     */
    getAllStickers() {
      return BUILTIN_STICKERS;
    }

    /**
     * 获取表情分类
     * @returns {Array}
     */
    getCategories() {
      return CATEGORIES;
    }

    /**
     * 按分类获取表情
     * @param {string} categoryId
     * @returns {Array}
     */
    getStickersByCategory(categoryId) {
      if (categoryId === 'recent') {
        return this.getRecentStickers();
      }
      return BUILTIN_STICKERS.filter(s => s.category === categoryId);
    }

    /**
     * 获取单个表情
     * @param {string} stickerId
     * @returns {Object|null}
     */
    getSticker(stickerId) {
      return BUILTIN_STICKERS.find(s => s.id === stickerId) || null;
    }

    /**
     * 获取最近使用的表情
     * @returns {Promise<Array>}
     */
    async getRecentStickers() {
      const recent = await this._get('recent', []);
      // 按使用时间倒序，返回表情详情
      return recent
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20)
        .map(r => BUILTIN_STICKERS.find(s => s.id === r.stickerId))
        .filter(Boolean);
    }

    /**
     * 获取收藏的表情
     * @returns {Promise<Array>}
     */
    async getFavoriteStickers() {
      const favorites = await this._get('favorites', []);
      return favorites
        .map(id => BUILTIN_STICKERS.find(s => s.id === id))
        .filter(Boolean);
    }

    /**
     * 搜索表情
     * @param {string} keyword
     * @returns {Array}
     */
    searchStickers(keyword) {
      if (!keyword) return BUILTIN_STICKERS;
      const lower = keyword.toLowerCase();
      return BUILTIN_STICKERS.filter(s => 
        s.name.includes(keyword) || 
        s.id.toLowerCase().includes(lower)
      );
    }

    // ==================== 写入操作 ====================

    /**
     * 记录表情使用
     * @param {string} stickerId
     * @returns {Promise<boolean>}
     */
    async recordUsage(stickerId) {
      const recent = await this._get('recent', []);
      
      // 查找是否已存在
      const existingIndex = recent.findIndex(r => r.stickerId === stickerId);
      
      if (existingIndex !== -1) {
        // 更新时间戳
        recent[existingIndex].timestamp = Date.now();
      } else {
        // 添加新记录
        recent.push({ stickerId, timestamp: Date.now() });
      }
      
      // 限制数量
      if (recent.length > 50) {
        recent.sort((a, b) => b.timestamp - a.timestamp);
        recent.length = 50;
      }
      
      await this._set('recent', recent);
      return true;
    }

    /**
     * 收藏表情
     * @param {string} stickerId
     * @returns {Promise<boolean>}
     */
    async addFavorite(stickerId) {
      const favorites = await this._get('favorites', []);
      
      if (favorites.includes(stickerId)) {
        return false; // 已收藏
      }
      
      favorites.push(stickerId);
      await this._set('favorites', favorites);
      
      this._emit('sticker:favorited', { stickerId });
      return true;
    }

    /**
     * 取消收藏
     * @param {string} stickerId
     * @returns {Promise<boolean>}
     */
    async removeFavorite(stickerId) {
      const favorites = await this._get('favorites', []);
      const index = favorites.indexOf(stickerId);
      
      if (index === -1) return false;
      
      favorites.splice(index, 1);
      await this._set('favorites', favorites);
      
      this._emit('sticker:unfavorited', { stickerId });
      return true;
    }

    /**
     * 检查是否已收藏
     * @param {string} stickerId
     * @returns {Promise<boolean>}
     */
    async isFavorite(stickerId) {
      const favorites = await this._get('favorites', []);
      return favorites.includes(stickerId);
    }

    // ==================== 渲染辅助（@deprecated 应移至渲染层） ====================

    /**
     * 渲染表情为HTML
     * @param {string} stickerId
     * @param {Object} options - { size?: number, className?: string }
     * @returns {string}
     */
    renderStickerHTML(stickerId, options = {}) {
      const sticker = this.getSticker(stickerId);
      if (!sticker) return '';
      
      const size = options.size || 24;
      const className = options.className || 'sticker-item';
      
      return `<span class="${className}" data-sticker-id="${sticker.id}" title="${sticker.name}" style="font-size: ${size}px; line-height: 1;">${sticker.emoji}</span>`;
    }

    /**
     * 渲染表情面板HTML
     * @param {Object} options - { activeCategory?: string }
     * @returns {string}
     */
    renderPanelHTML(options = {}) {
      const activeCategory = options.activeCategory || 'classic';
      const categories = this.getCategories();
      const stickers = this.getStickersByCategory(activeCategory);
      
      const categoryTabs = categories.map(cat => `
        <button class="sticker-tab ${cat.id === activeCategory ? 'active' : ''}" 
                data-category="${cat.id}" title="${cat.name}">
          ${cat.icon}
        </button>
      `).join('');
      
      const stickerItems = stickers.map(s => `
        <button class="sticker-item" data-sticker-id="${s.id}" title="${s.name}">
          ${s.emoji}
        </button>
      `).join('');
      
      return `
        <div class="sticker-panel">
          <div class="sticker-tabs">${categoryTabs}</div>
          <div class="sticker-grid">${stickerItems}</div>
        </div>
      `;
    }

    // ==================== 订阅 ====================

    subscribeRecent(callback) {
      return this._subscribe('recent', callback);
    }

    subscribeFavorites(callback) {
      return this._subscribe('favorites', callback);
    }

    // ==================== 内部方法 ====================

        async _get(key, defaultValue) {
      // [修复] 等待 Platform 就绪
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化');
        return defaultValue;
      }
      
      // [修复] 如果 Platform 未就绪，等待其就绪
      if (!this._platform.isReady && this._platform.waitForReady) {
        try {
          await this._platform.waitForReady(5000);
        } catch (e) {
          console.warn('[Schema] Platform 就绪超时，使用默认值');
          return defaultValue;
        }
      }
      
      const result = await this._platform.data(DOMAIN, key, defaultValue);
      // 防御性编程：如果平台返回 undefined/null，使用默认值
      return result !== undefined && result !== null ? result : defaultValue;
    }

        async _set(key, value) {
      if (!this._platform) {
        console.warn('[Schema] Platform 未初始化，无法写入数据');
        return false;
      }
      
      // [铁则一] 通过 Platform.setData 写入，由 DataStore 管理防抖和持久化
      // 不手动调用 flush()，避免破坏 DataStore 的防抖队列导致数据丢失
      await this._platform.setData(DOMAIN, key, value, { persist: true });

      return true;
    }

    _subscribe(key, callback) {
      if (!this._platform?.subscribeData) return () => {};
      return this._platform.subscribeData(DOMAIN, key, callback);
    }

    _emit(event, data) {
      if (this._platform?.emit) {
        this._platform.emit(event, data);
      }
    }
  }

  // 暴露到全局
  if (!window.PhoneData) window.PhoneData = {};
  window.PhoneData.Sticker = StickerData;

  console.log('[Schema] StickerData 已加载');
})();
