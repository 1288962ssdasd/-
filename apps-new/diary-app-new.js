/**
 * DiaryAppNew - 日记应用重写模块
 * 继承 ContextDrivenApp 基类，使用 ES6+ 语法
 * 功能：查看日记列表、查看详情、新建日记、删除日记
 * CSS 前缀: diary-new-
 */
;(function () {
  'use strict';

  const WEATHER_ICONS = {
    '晴': '&#9728;',
    '多云': '&#9925;',
    '阴': '&#9729;',
    '小雨': '&#127783;',
    '大雨': '&#127784;',
    '雷阵雨': '&#9928;',
    '雪': '&#10052;',
    '雾': '&#127787;',
  };

  const MOOD_ICONS = {
    '开心': '&#128522;',
    '平静': '&#128528;',
    '难过': '&#128546;',
    '愤怒': '&#128545;',
    '兴奋': '&#129321;',
    '疲惫': '&#128564;',
    '焦虑': '&#128550;',
  };

  class DiaryAppNew extends window.__ContextDrivenApp__ {
    constructor() {
      super({ name: 'DiaryAppNew' });

      /** @type {Array<{id:string, date:string, content:string, weather:string, mood:string}>} */
      this._diaries = [];

      /** @type {'list'|'detail'|'create'} 当前视图 */
      this._currentView = 'list';

      /** @type {string|null} 当前查看的日记 ID */
      this._currentDiaryId = null;

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
      this._parseDiariesFromContext();
      this.updateHeader('日记');
      console.log('[DiaryAppNew] 初始化完成');
    }

    onDestroy() {
      this._diaries = [];
      this._currentDiaryId = null;
    }

    /* ------------------------------------------------------------------ */
    /*  数据层                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * 从 Mvu / SillyTavern context 读取原始日记数据
     * @returns {Object|null}
     */
    _getRawDiaryData() {
      // 路径 1: Mvu
      if (window.Mvu && typeof window.Mvu.getMvuData === 'function') {
        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        if (mvuData?.stat_data?.['日记']) {
          return mvuData.stat_data['日记'];
        }
        if (mvuData?.['日记']) {
          return mvuData['日记'];
        }
      }

      // 路径 2: SillyTavern context（备用）
      if (window.SillyTavern) {
        const ctx = typeof window.SillyTavern.getContext === 'function'
          ? window.SillyTavern.getContext()
          : window.SillyTavern;
        const statData = ctx?.chatMetadata?.variables?.['stat_data'];
        if (statData?.['日记']) {
          return statData['日记'];
        }
        const direct = ctx?.chatMetadata?.variables?.['日记'];
        if (direct && typeof direct === 'object') {
          return direct;
        }
      }

      // 路径 3: ConfigManager
      if (this._configManager) {
        try {
          const raw = this._configManager.get('xb.diary.entries');
          if (raw) {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (e) {
          console.warn('[DiaryAppNew] ConfigManager 读取失败:', e);
        }
      }

      return null;
    }

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
     * 将原始数据解析为内部日记格式
     * @param {Object} rawData
     * @returns {Array}
     */
    _parseDiaryData(rawData) {
      if (!rawData || typeof rawData !== 'object') return [];

      const diaries = [];
      for (const key of Object.keys(rawData)) {
        if (key === '$meta') continue;

        const entry = rawData[key];
        if (!entry || typeof entry !== 'object') continue;

        const val = (field) =>
          Array.isArray(entry[field]) ? entry[field][0] : (entry[field] || '');

        diaries.push({
          id: key,
          date: val('日期') || val('date') || key,
          content: val('内容') || val('content') || '',
          weather: val('天气') || val('weather') || '',
          mood: val('心情') || val('mood') || '',
        });
      }

      // 按日期倒序排列
      diaries.sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return db - da;
      });

      return diaries;
    }

    /**
     * 从上下文解析并更新内部日记列表
     */
    _parseDiariesFromContext() {
      const raw = this._getRawDiaryData();
      if (raw) {
        this._diaries = this._parseDiaryData(raw);
        console.log(`[DiaryAppNew] 解析到 ${this._diaries.length} 条日记`);
      } else {
        this._diaries = [];
        console.log('[DiaryAppNew] 未找到日记数据');
      }
    }

    /**
     * 计算数据哈希（用于变更检测）
     * @returns {string}
     */
    _computeDataHash() {
      try {
        return JSON.stringify(this._diaries);
      } catch (_) {
        return '';
      }
    }

    /* ------------------------------------------------------------------ */
    /*  日记操作                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * 新建日记
     * @param {Object} diaryData
     */
    async _createDiary(diaryData) {
      try {
        if (!window.Mvu) throw new Error('Mvu 不可用');

        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        const newId = 'diary_' + Date.now();
        const path = `日记.${newId}`;

        await window.Mvu.setMvuVariable(
          mvuData,
          `${path}.日期[0]`,
          diaryData.date,
          { reason: '新建日记', is_recursive: false },
        );
        await window.Mvu.setMvuVariable(
          mvuData,
          `${path}.内容[0]`,
          diaryData.content,
          { reason: '新建日记', is_recursive: false },
        );
        await window.Mvu.setMvuVariable(
          mvuData,
          `${path}.天气[0]`,
          diaryData.weather,
          { reason: '新建日记', is_recursive: false },
        );
        await window.Mvu.setMvuVariable(
          mvuData,
          `${path}.心情[0]`,
          diaryData.mood,
          { reason: '新建日记', is_recursive: false },
        );

        await window.Mvu.replaceMvuData(mvuData, { type: 'message', message_id: targetId });

        this.showToast('日记已保存', 'success');
        this._parseDiariesFromContext();
        this._currentView = 'list';
        this.updateHeader('日记');
        this.refresh();
      } catch (err) {
        console.error('[DiaryAppNew] 新建日记失败:', err);
        this.showToast('保存失败: ' + err.message, 'error');
      }
    }

    /**
     * 删除日记
     * @param {string} diaryId
     */
    async _deleteDiary(diaryId) {
      if (!confirm('确定要删除这篇日记吗？此操作不可撤销。')) return;

      try {
        if (!window.Mvu) throw new Error('Mvu 不可用');

        const targetId = this._resolveTargetMessageId();
        const mvuData = window.Mvu.getMvuData({ type: 'message', message_id: targetId });

        await window.Mvu.setMvuVariable(
          mvuData,
          `日记.${diaryId}`,
          null,
          { reason: '删除日记', is_recursive: false },
        );

        await window.Mvu.replaceMvuData(mvuData, { type: 'message', message_id: targetId });

        this.showToast('日记已删除', 'success');
        this._currentView = 'list';
        this.updateHeader('日记');
        this._parseDiariesFromContext();
        this.refresh();
      } catch (err) {
        console.error('[DiaryAppNew] 删除日记失败:', err);
        this.showToast('删除失败: ' + err.message, 'error');
      }
    }

    /* ------------------------------------------------------------------ */
    /*  渲染                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * 获取天气图标
     * @param {string} weather
     * @returns {string}
     */
    _weatherIcon(weather) {
      return WEATHER_ICONS[weather] || '&#9729;';
    }

    /**
     * 获取心情图标
     * @param {string} mood
     * @returns {string}
     */
    _moodIcon(mood) {
      return MOOD_ICONS[mood] || '&#128528;';
    }

    /**
     * 渲染日记列表
     * @returns {string}
     */
    _renderDiaryList() {
      if (this._diaries.length === 0) {
        return `
          <div class="diary-new-empty">
            <div class="diary-new-empty-icon">&#128221;</div>
            <div class="diary-new-empty-title">暂无日记</div>
            <div class="diary-new-empty-hint">点击右下角按钮开始记录</div>
          </div>`;
      }

      return this._diaries.map((d) => `
        <div class="diary-new-card" data-diary-id="${this._esc(d.id)}">
          <div class="diary-new-card-header">
            <span class="diary-new-date">${this._esc(d.date)}</span>
            <div class="diary-new-tags">
              ${d.weather ? `<span class="diary-new-tag diary-new-weather">${this._weatherIcon(d.weather)} ${this._esc(d.weather)}</span>` : ''}
              ${d.mood ? `<span class="diary-new-tag diary-new-mood">${this._moodIcon(d.mood)} ${this._esc(d.mood)}</span>` : ''}
            </div>
          </div>
          <div class="diary-new-card-body">
            <div class="diary-new-preview">${this._esc(this._truncate(d.content, 80))}</div>
          </div>
          <div class="diary-new-card-footer">
            <button class="diary-new-btn diary-new-btn-view" data-diary-id="${this._esc(d.id)}">查看详情</button>
            <button class="diary-new-btn diary-new-btn-delete" data-diary-id="${this._esc(d.id)}">删除</button>
          </div>
        </div>`).join('');
    }

    /**
     * 渲染日记详情
     * @param {Object} diary
     * @returns {string}
     */
    _renderDiaryDetail(diary) {
      if (!diary) {
        return `<div class="diary-new-empty"><div class="diary-new-empty-title">日记不存在</div></div>`;
      }

      return `
        <div class="diary-new-detail">
          <div class="diary-new-detail-header">
            <button class="diary-new-btn-back" id="diary-new-back">&larr; 返回列表</button>
            <div class="diary-new-detail-date">${this._esc(diary.date)}</div>
            <div class="diary-new-detail-tags">
              ${diary.weather ? `<span class="diary-new-tag diary-new-weather">${this._weatherIcon(diary.weather)} ${this._esc(diary.weather)}</span>` : ''}
              ${diary.mood ? `<span class="diary-new-tag diary-new-mood">${this._moodIcon(diary.mood)} ${this._esc(diary.mood)}</span>` : ''}
            </div>
          </div>
          <div class="diary-new-detail-body">
            <div class="diary-new-detail-content">${this._esc(diary.content).replace(/\n/g, '<br>')}</div>
          </div>
          <div class="diary-new-detail-footer">
            <button class="diary-new-btn diary-new-btn-delete" data-diary-id="${this._esc(diary.id)}">删除日记</button>
          </div>
        </div>`;
    }

    /**
     * 渲染新建日记表单
     * @returns {string}
     */
    _renderCreateForm() {
      const today = new Date().toISOString().slice(0, 10);
      const weatherOptions = Object.keys(WEATHER_ICONS).map(w =>
        `<option value="${w}">${w}</option>`
      ).join('');
      const moodOptions = Object.keys(MOOD_ICONS).map(m =>
        `<option value="${m}">${m}</option>`
      ).join('');

      return `
        <div class="diary-new-create">
          <div class="diary-new-create-header">
            <button class="diary-new-btn-back" id="diary-new-back">&larr; 返回列表</button>
            <span class="diary-new-create-title">新建日记</span>
          </div>
          <div class="diary-new-form">
            <div class="diary-new-form-group">
              <label class="diary-new-label">日期</label>
              <input type="date" class="diary-new-input" id="diary-new-date" value="${today}">
            </div>
            <div class="diary-new-form-group">
              <label class="diary-new-label">天气</label>
              <select class="diary-new-select" id="diary-new-weather">
                <option value="">请选择天气</option>
                ${weatherOptions}
              </select>
            </div>
            <div class="diary-new-form-group">
              <label class="diary-new-label">心情</label>
              <select class="diary-new-select" id="diary-new-mood">
                <option value="">请选择心情</option>
                ${moodOptions}
              </select>
            </div>
            <div class="diary-new-form-group">
              <label class="diary-new-label">内容</label>
              <textarea class="diary-new-textarea" id="diary-new-content" rows="8" placeholder="今天发生了什么..."></textarea>
            </div>
            <div class="diary-new-form-actions">
              <button class="diary-new-btn diary-new-btn-cancel" id="diary-new-cancel">取消</button>
              <button class="diary-new-btn diary-new-btn-save" id="diary-new-save">保存</button>
            </div>
          </div>
        </div>`;
    }

    /**
     * 返回应用完整 HTML
     * @returns {string}
     */
    getAppContent() {
      this._parseDiariesFromContext();

      let content = '';
      switch (this._currentView) {
        case 'detail': {
          const diary = this._diaries.find((d) => d.id === this._currentDiaryId);
          content = this._renderDiaryDetail(diary);
          break;
        }
        case 'create':
          content = this._renderCreateForm();
          break;
        default:
          content = this._renderDiaryList();
          break;
      }

      return `
        <div class="diary-new-app">
          <div class="diary-new-content" id="diary-new-content">${content}</div>
          ${this._currentView === 'list' ? `
            <button class="diary-new-fab" id="diary-new-fab" title="新建日记">+</button>
          ` : ''}
        </div>`;
    }

    /* ------------------------------------------------------------------ */
    /*  事件绑定                                                           */
    /* ------------------------------------------------------------------ */

    bindEvents() {
      const container = document.getElementById(this._containerId);
      if (!container) return;

      // 返回按钮
      container.querySelectorAll('#diary-new-back, #diary-new-cancel').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentView = 'list';
          this._currentDiaryId = null;
          this.updateHeader('日记');
          this.render();
        });
      });

      // 查看详情
      container.querySelectorAll('.diary-new-btn-view').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentDiaryId = e.currentTarget.dataset.diaryId;
          this._currentView = 'detail';
          this.updateHeader('日记详情');
          this.render();
        });
      });

      // 删除日记
      container.querySelectorAll('.diary-new-btn-delete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._deleteDiary(e.currentTarget.dataset.diaryId);
        });
      });

      // 新建日记按钮
      const fab = container.querySelector('#diary-new-fab');
      if (fab) {
        fab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._currentView = 'create';
          this.updateHeader('新建日记');
          this.render();
        });
      }

      // 保存日记
      const saveBtn = container.querySelector('#diary-new-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._handleSave();
        });
      }
    }

    /**
     * 处理保存日记
     */
    _handleSave() {
      const dateEl = document.getElementById('diary-new-date');
      const weatherEl = document.getElementById('diary-new-weather');
      const moodEl = document.getElementById('diary-new-mood');
      const contentEl = document.getElementById('diary-new-content');

      const date = dateEl ? dateEl.value : '';
      const weather = weatherEl ? weatherEl.value : '';
      const mood = moodEl ? moodEl.value : '';
      const content = contentEl ? contentEl.value.trim() : '';

      if (!date) {
        this.showToast('请选择日期', 'warning');
        return;
      }
      if (!content) {
        this.showToast('请输入日记内容', 'warning');
        return;
      }

      this._createDiary({ date, weather, mood, content });
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

    /**
     * 截断文本
     * @param {string} str
     * @param {number} maxLen
     * @returns {string}
     */
    _truncate(str, maxLen) {
      if (!str) return '';
      if (str.length <= maxLen) return str;
      return str.slice(0, maxLen) + '...';
    }
  }

  window.DiaryAppNew = new DiaryAppNew();
  console.log('[DiaryAppNew] 模块加载完成');
})();
