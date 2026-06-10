/**
 * DiaryModule - 日记模块
 * 职责：生命周期管理、事件绑定、调用 Service
 *
 * 启动阶段：阶段 5（Module 初始化）
 * 全局挂载：window.PhoneModules.Diary
 *
 * 铁则合规：
 *   - 数据读写通过 Service（铁则一）
 *   - 无本地缓存，每次从 Service 获取（铁则八）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - CSS 类名以 diary- 前缀隔离（铁则十一）
 */

;(function () {
  'use strict';

  class DiaryModule extends PhoneApp {
    constructor() {
      super({
        id: 'diary',
        name: '日记',
        icon: '\uD83D\uDCD4',
        iconBg: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
      });
      this._service = null;
      this._unsubscribers = [];
      this._currentView = 'LIST'; // LIST | DETAIL | EDIT | STATS | TIMELINE
      this._currentDiaryId = null;
    }

    // ==================== 生命周期 ====================

    async onInit(phone, params) {
      this._service = new window.PhoneServices.Diary(window.Platform);
    }

    onDispose() {
      this._unsubscribers.forEach(unsub => { try { unsub(); } catch(e) {} });
      this._unsubscribers = [];
    }

    // ==================== 样式注入 ====================

    _injectStyles() {
      if (DiaryModule._stylesInjected) return;
      DiaryModule._stylesInjected = true;

      const style = document.createElement('style');
      style.textContent = `
        /* ===== iOS 写实风格 - Diary Module ===== */
        .diary-app {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #FFFFFF;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          color: #1C1C1E;
          overflow: hidden;
        }

        /* --- Header --- */
        .diary-header {
          background: #FFFFFF;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 0.5px solid #C6C6C8;
          flex-shrink: 0;
        }
        .diary-title {
          font-size: 34px;
          font-weight: 700;
          letter-spacing: 0.37px;
          color: #000000;
          margin: 0;
          line-height: 1.2;
        }

        /* --- Toolbar --- */
        .diary-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #F2F2F7;
          flex-shrink: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .diary-toolbar .diary-btn {
          flex-shrink: 0;
          padding: 6px 14px;
          border-radius: 8px;
          border: none;
          background: rgba(255, 255, 255, 0.8);
          color: #007AFF;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
          white-space: nowrap;
        }
        .diary-toolbar .diary-btn:active {
          background: rgba(0, 122, 255, 0.12);
        }

        /* --- Views Container --- */
        .diary-views {
          flex: 1;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* --- Diary List Item --- */
        .diary-item {
          background: #FFFFFF;
          margin: 8px 12px;
          padding: 12px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .diary-item:active {
          transform: scale(0.98);
          box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.06);
        }
        .diary-item-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .diary-date {
          font-size: 20px;
          font-weight: 700;
          color: #8E8E93;
          line-height: 1.1;
          letter-spacing: -1px;
        }
        .diary-item-title {
          font-size: 16px;
          font-weight: 600;
          color: #000000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .diary-preview {
          font-size: 14px;
          color: #8E8E93;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* --- Detail View --- */
        .diary-detail {
          background: #FFFFFF;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        .diary-detail-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 0.5px solid #C6C6C8;
          flex-shrink: 0;
          gap: 12px;
        }
        .diary-detail-header .diary-btn {
          border: none;
          background: none;
          color: #007AFF;
          font-size: 16px;
          font-weight: 400;
          cursor: pointer;
          padding: 4px 0;
          flex-shrink: 0;
        }
        .diary-detail-header .diary-btn:active {
          opacity: 0.5;
        }
        .diary-detail-title {
          flex: 1;
          font-size: 17px;
          font-weight: 600;
          color: #000000;
          margin: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .diary-detail-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          flex-shrink: 0;
        }
        .diary-detail-date {
          font-size: 13px;
          color: #8E8E93;
        }
        .diary-detail-mood {
          font-size: 13px;
          color: #8E8E93;
        }
        .diary-detail-content {
          flex: 1;
          font-size: 16px;
          line-height: 1.8;
          color: #1C1C1E;
          padding: 16px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .diary-detail-actions {
          display: flex;
          justify-content: center;
          padding: 12px 16px 24px;
          border-top: 0.5px solid #C6C6C8;
          flex-shrink: 0;
        }
        .diary-detail-actions .diary-btn {
          border: none;
          background: none;
          color: #FF3B30;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 20px;
        }
        .diary-detail-actions .diary-btn:active {
          opacity: 0.5;
        }

        /* --- Edit View --- */
        .diary-edit {
          background: #F2F2F7;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        .diary-edit-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: #FFFFFF;
          border-bottom: 0.5px solid #C6C6C8;
          flex-shrink: 0;
          gap: 12px;
        }
        .diary-edit-header .diary-btn {
          border: none;
          background: none;
          color: #007AFF;
          font-size: 16px;
          font-weight: 400;
          cursor: pointer;
          padding: 4px 0;
          flex-shrink: 0;
        }
        .diary-edit-header .diary-btn:active {
          opacity: 0.5;
        }
        .diary-edit-title {
          flex: 1;
          font-size: 17px;
          font-weight: 600;
          color: #000000;
          margin: 0;
          text-align: center;
        }
        .diary-edit-body {
          flex: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .diary-edit-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .diary-edit-label {
          font-size: 13px;
          font-weight: 500;
          color: #8E8E93;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding-left: 4px;
        }
        .diary-edit-input,
        .diary-edit-select {
          width: 100%;
          padding: 12px;
          border: 1px solid #E5E5EA;
          border-radius: 10px;
          font-size: 16px;
          color: #1C1C1E;
          background: #FFFFFF;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          transition: border-color 0.2s ease;
          box-sizing: border-box;
        }
        .diary-edit-input:focus,
        .diary-edit-select:focus {
          border-color: #007AFF;
        }
        .diary-edit-input::placeholder {
          color: #C7C7CC;
        }
        .diary-edit-textarea {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border: 1px solid #E5E5EA;
          border-radius: 10px;
          font-size: 16px;
          line-height: 1.6;
          color: #1C1C1E;
          background: #FFFFFF;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
          font-family: inherit;
        }
        .diary-edit-textarea:focus {
          border-color: #007AFF;
        }
        .diary-edit-textarea::placeholder {
          color: #C7C7CC;
        }
        .diary-edit-actions {
          display: flex;
          justify-content: center;
          padding: 12px 16px 24px;
          background: #F2F2F7;
          flex-shrink: 0;
        }
        .diary-btn-save {
          border: none;
          background: #34C759;
          color: #FFFFFF;
          font-size: 17px;
          font-weight: 600;
          padding: 12px 48px;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .diary-btn-save:active {
          opacity: 0.75;
        }
        .diary-btn-delete {
          color: #FF3B30;
        }

        /* --- Stats View --- */
        .diary-stats {
          background: #F2F2F7;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        .diary-stats-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: #FFFFFF;
          border-bottom: 0.5px solid #C6C6C8;
          flex-shrink: 0;
          gap: 12px;
        }
        .diary-stats-header .diary-btn {
          border: none;
          background: none;
          color: #007AFF;
          font-size: 16px;
          font-weight: 400;
          cursor: pointer;
          padding: 4px 0;
          flex-shrink: 0;
        }
        .diary-stats-header .diary-btn:active {
          opacity: 0.5;
        }
        .diary-stats-title {
          flex: 1;
          font-size: 17px;
          font-weight: 600;
          color: #000000;
          margin: 0;
          text-align: center;
        }
        .diary-stats-body {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .diary-stats-item {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .diary-stats-label {
          font-size: 15px;
          color: #3C3C43;
          font-weight: 400;
        }
        .diary-stats-value {
          font-size: 28px;
          font-weight: 700;
          color: #007AFF;
        }

        /* --- Empty / Error States --- */
        .diary-empty,
        .diary-error {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #8E8E93;
          font-size: 15px;
          padding: 60px 24px;
        }

        /* --- [v4.1] 剧情推演时间线 --- */
        .diary-tl {
          background: #F2F2F7;
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        .diary-tl-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: #FFFFFF;
          border-bottom: 0.5px solid #C6C6C8;
          flex-shrink: 0;
          gap: 12px;
        }
        .diary-tl-header .diary-btn {
          border: none;
          background: none;
          color: #007AFF;
          font-size: 16px;
          cursor: pointer;
          padding: 4px 0;
        }
        .diary-tl-title {
          flex: 1;
          font-size: 17px;
          font-weight: 600;
          color: #000000;
          text-align: center;
        }
        .diary-tl-body {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .diary-tl-item {
          display: flex;
          gap: 12px;
          padding: 10px 0;
          position: relative;
        }
        .diary-tl-dot-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 20px;
          flex-shrink: 0;
        }
        .diary-tl-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .diary-tl-dot.major { background: #FF3B30; }
        .diary-tl-dot.minor { background: #FF9500; }
        .diary-tl-dot.background { background: #34C759; }
        .diary-tl-line {
          width: 2px;
          flex: 1;
          background: #E5E5EA;
          margin: 4px 0;
        }
        .diary-tl-content {
          flex: 1;
          background: #FFFFFF;
          border-radius: 10px;
          padding: 10px 12px;
          box-shadow: 0 0.5px 1px rgba(0,0,0,0.06);
        }
        .diary-tl-type {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .diary-tl-type.major { color: #FF3B30; }
        .diary-tl-type.minor { color: #FF9500; }
        .diary-tl-type.background { color: #34C759; }
        .diary-tl-text {
          font-size: 14px;
          color: #1C1C1E;
          line-height: 1.5;
        }
        .diary-tl-time {
          font-size: 12px;
          color: #8E8E93;
          margin-top: 4px;
        }
      `;
      document.head.appendChild(style);
    }

    // ==================== 渲染 ====================

    onRender() {
      this._injectStyles();
      return `
        <div class="diary-app">
          <div class="diary-header">
            <h3 class="diary-title">日记</h3>
          </div>
          <div class="diary-toolbar">
            <button class="diary-btn" data-action="add-diary">+ 写日记</button>
            <button class="diary-btn" data-action="ai-diary">AI 生成</button>
            <button class="diary-btn" data-action="show-timeline">剧情推演</button>
            <button class="diary-btn" data-action="search">搜索</button>
            <button class="diary-btn" data-action="show-stats">统计</button>
          </div>
          <div class="diary-views">
            <div class="diary-view" data-view="LIST"></div>
            <div class="diary-view" data-view="DETAIL" style="display:none;"></div>
            <div class="diary-view" data-view="EDIT" style="display:none;"></div>
            <div class="diary-view" data-view="STATS" style="display:none;"></div>
            <div class="diary-view" data-view="TIMELINE" style="display:none;"></div>
          </div>
        </div>
      `;
    }

    _bindEvents() {
      setTimeout(() => {
        if (!this._container) return;

        this._container.addEventListener('click', async (e) => {
          // 新增日记
          if (e.target.closest('[data-action="add-diary"]')) {
            await this._showEditView();
            return;
          }

          // AI 生成日记
          if (e.target.closest('[data-action="ai-diary"]')) {
            await this._handleAIGenerateDiary();
            return;
          }

          // 搜索
          if (e.target.closest('[data-action="search"]')) {
            await this._handleSearch();
            return;
          }

          // 清除搜索
          if (e.target.closest('[data-action="clear-search"]')) {
            await this._showListView();
            return;
          }

          // 统计
          if (e.target.closest('[data-action="show-stats"]')) {
            await this._showStatsView();
            return;
          }

          // [v4.1] 剧情推演
          if (e.target.closest('[data-action="show-timeline"]')) {
            await this._showTimelineView();
            return;
          }

          // 返回
          if (e.target.closest('[data-action="back"]')) {
            await this._showListView();
            return;
          }

          // 保存日记
          if (e.target.closest('[data-action="save-diary"]')) {
            await this._handleSaveDiary();
            return;
          }

          // 删除日记
          if (e.target.closest('[data-action="delete-diary"]')) {
            await this._handleDeleteDiary();
            return;
          }

          // 点击日记查看详情
          const diaryItem = e.target.closest('[data-diary-id]');
          if (diaryItem && !e.target.closest('[data-action]')) {
            await this._showDiaryDetail(diaryItem.dataset.diaryId);
            return;
          }
        });

        this._subscribeData();
        this._renderList();
      }, 0);
    }

    // ==================== 视图切换 ====================

    _showView(viewName) {
      this._container.querySelectorAll('[data-view]').forEach(view => {
        view.style.display = view.dataset.view === viewName ? 'block' : 'none';
      });
      // 工具栏只在列表视图显示
      const toolbar = this._container?.querySelector('.diary-toolbar');
      if (toolbar) {
        toolbar.style.display = viewName === 'LIST' ? 'flex' : 'none';
      }
      this._currentView = viewName;
    }

    async _showListView() {
      this._currentDiaryId = null;
      this._showView('LIST');
      await this._renderList();
    }

    async _showDiaryDetail(diaryId) {
      this._currentDiaryId = diaryId;
      this._showView('DETAIL');
      await this._renderDetail();
    }

    async _showEditView() {
      this._currentDiaryId = null;
      this._showView('EDIT');
      await this._renderEdit();
    }

    async _showStatsView() {
      this._showView('STATS');
      await this._renderStats();
    }

    // ==================== [v4.1] 剧情推演时间线 ====================

    async _showTimelineView() {
      this._showView('TIMELINE');
      await this._renderTimeline();
    }

    async _renderTimeline() {
      var container = this._container?.querySelector('[data-view="TIMELINE"]');
      if (!container) return;

      try {
        // [铁则一] 通过 Platform.data() 读取时间线，禁止直接实例化 Schema
        var timeline = null;
        try {
          timeline = await window.Platform?.data?.('storyEvolution', 'timeline', 'default');
        } catch (e) {
          console.warn('[DiaryModule] 获取 StoryEvolution 数据失败:', e);
        }

        if (!timeline) {
          container.innerHTML = '<div class="diary-empty">剧情推演模块未加载</div>';
          return;
        }

        if (!timeline || !timeline.points || timeline.points.length === 0) {
          container.innerHTML = '<div class="diary-empty">暂无剧情推演记录<br><span style="font-size:12px;color:#8E8E93;">开启AI管家后，剧情事件会自动记录在这里</span></div>';
          return;
        }

        // 按时间倒序（最新的在上面）
        var points = timeline.points.slice().reverse();

        var html = '<div class="diary-tl">';
        html += '<div class="diary-tl-header">';
        html += '<button class="diary-btn" data-action="back">← 日记</button>';
        html += '<div class="diary-tl-title">剧情推演</div>';
        html += '<div style="width:40px;"></div>';
        html += '</div>';
        html += '<div class="diary-tl-body">';

        points.forEach(function(point, idx) {
          var type = point.type || 'background';
          var dotClass = type === 'major' ? 'major' : type === 'minor' ? 'minor' : 'background';
          var typeLabel = type === 'major' ? '主线剧情' : type === 'minor' ? '支线剧情' : '背景事件';
          var isLast = idx === points.length - 1;

          html += '<div class="diary-tl-item">';
          html += '<div class="diary-tl-dot-col">';
          html += '<div class="diary-tl-dot ' + dotClass + '"></div>';
          if (!isLast) html += '<div class="diary-tl-line"></div>';
          html += '</div>';
          html += '<div class="diary-tl-content">';
          html += '<div class="diary-tl-type ' + dotClass + '">' + typeLabel + '</div>';
          html += '<div class="diary-tl-text">' + (point.text || point.description || '无内容') + '</div>';
          if (point.timestamp) {
            var d = new Date(point.timestamp);
            html += '<div class="diary-tl-time">' + d.toLocaleString('zh-CN') + '</div>';
          }
          html += '</div></div>';
        });

        html += '</div></div>';
        container.innerHTML = html;
      } catch (e) {
        console.warn('[DiaryModule] 渲染时间线失败:', e);
        container.innerHTML = '<div class="diary-error">加载失败</div>';
      }
    }

    // ==================== 列表视图 ====================

    async _renderList() {
      const container = this._container?.querySelector('[data-view="LIST"]');
      if (!container) return;

      try {
        const diaries = await this._service.getDiaries();
        container.innerHTML = '';

        if (!diaries || diaries.length === 0) {
          container.innerHTML = '<div class="diary-empty">暂无日记</div>';
          return;
        }

        diaries.forEach(diary => {
          const el = document.createElement('div');
          el.className = 'diary-item';
          el.dataset.diaryId = diary.id || diary.diaryId;
          el.innerHTML = `
            <div class="diary-item-info">
              <div class="diary-date">${this._escapeHtml(diary.date || '')}</div>
              <div class="diary-item-title">${this._escapeHtml(diary.title || '无标题')}</div>
              <div class="diary-preview">${this._escapeHtml(diary.content?.substring(0, 50) || '')}...</div>
            </div>
          `;
          container.appendChild(el);
        });
      } catch (e) {
        console.warn('[DiaryModule] 渲染失败:', e);
        container.innerHTML = '<div class="diary-error">加载失败，请重试</div>';
      }
    }

    // ==================== 详情视图 ====================

    async _renderDetail() {
      const container = this._container?.querySelector('[data-view="DETAIL"]');
      if (!container || !this._currentDiaryId) return;

      try {
        const diary = await this._service.getDiary(this._currentDiaryId);
        if (!diary) {
          container.innerHTML = '<div class="diary-error">日记不存在</div>';
          return;
        }

        container.innerHTML = `
          <div class="diary-detail">
            <div class="diary-detail-header">
              <button class="diary-btn" data-action="back">&larr; 返回</button>
              <h4 class="diary-detail-title">${this._escapeHtml(diary.title || '无标题')}</h4>
            </div>
            <div class="diary-detail-meta">
              <span class="diary-detail-date">${this._escapeHtml(diary.date || '')}</span>
              <span class="diary-detail-mood">${this._escapeHtml(diary.mood || '')}</span>
            </div>
            <div class="diary-detail-content">${this._escapeHtml(diary.content || '')}</div>
            <div class="diary-detail-actions">
              <button class="diary-btn diary-btn-delete" data-action="delete-diary">删除</button>
            </div>
          </div>
        `;
      } catch (e) {
        console.warn('[DiaryModule] 渲染详情失败:', e);
        container.innerHTML = '<div class="diary-error">加载失败，请重试</div>';
      }
    }

    // ==================== 编辑视图 ====================

    async _renderEdit() {
      const container = this._container?.querySelector('[data-view="EDIT"]');
      if (!container) return;

      container.innerHTML = `
        <div class="diary-edit">
          <div class="diary-edit-header">
            <button class="diary-btn" data-action="back">&larr; 返回</button>
            <h4 class="diary-edit-title">写日记</h4>
          </div>
          <div class="diary-edit-body">
            <div class="diary-edit-row">
              <label class="diary-edit-label">标题:</label>
              <input class="diary-edit-input" type="text" data-ref="diary-edit-title" placeholder="日记标题" />
            </div>
            <div class="diary-edit-row">
              <label class="diary-edit-label">心情:</label>
              <select class="diary-edit-select" data-ref="diary-edit-mood">
                <option value="normal">普通</option>
                <option value="happy">开心</option>
                <option value="sad">难过</option>
                <option value="angry">生气</option>
                <option value="excited">兴奋</option>
              </select>
            </div>
            <div class="diary-edit-row">
              <label class="diary-edit-label">内容:</label>
              <textarea class="diary-edit-textarea" data-ref="diary-edit-content" rows="8" placeholder="今天发生了什么..."></textarea>
            </div>
          </div>
          <div class="diary-edit-actions">
            <button class="diary-btn diary-btn-save" data-action="save-diary">保存</button>
          </div>
        </div>
      `;
    }

    // ==================== 统计视图 ====================

    async _renderStats() {
      const container = this._container?.querySelector('[data-view="STATS"]');
      if (!container) return;

      try {
        const stats = await this._service.getStats();

        container.innerHTML = `
          <div class="diary-stats">
            <div class="diary-stats-header">
              <button class="diary-btn" data-action="back">&larr; 返回</button>
              <h4 class="diary-stats-title">日记统计</h4>
            </div>
            <div class="diary-stats-body">
              <div class="diary-stats-item">
                <span class="diary-stats-label">总篇数:</span>
                <span class="diary-stats-value">${stats.total || 0}</span>
              </div>
            </div>
          </div>
        `;
      } catch (e) {
        console.warn('[DiaryModule] 渲染统计失败:', e);
        container.innerHTML = '<div class="diary-error">加载失败，请重试</div>';
      }
    }

    // ==================== 业务处理 ====================

    async _handleSaveDiary() {
      const title = this._container.querySelector('[data-ref="diary-edit-title"]')?.value?.trim();
      const mood = this._container.querySelector('[data-ref="diary-edit-mood"]')?.value || 'normal';
      const content = this._container.querySelector('[data-ref="diary-edit-content"]')?.value?.trim();

      if (!content) {
        this.showToast('请输入日记内容', 'warning');
        return;
      }

      try {
        const result = await this._service.addDiary({ title: title || '无标题', mood, content });
        if (result) {
          this.showToast('日记已保存', 'success');
          await this._showListView();
        } else {
          this.showToast('保存失败', 'error');
        }
      } catch (err) {
        console.error('[DiaryModule] 保存日记失败:', err);
        this.showToast('保存失败: ' + err.message, 'error');
      }
    }

    async _handleDeleteDiary() {
      if (!this._currentDiaryId) return;
      if (!await this.confirm('确定删除此日记吗？')) return;

      try {
        const result = await this._service.deleteDiary(this._currentDiaryId);
        if (result) {
          this.showToast('日记已删除', 'success');
          await this._showListView();
        } else {
          this.showToast('删除失败', 'error');
        }
      } catch (err) {
        console.error('[DiaryModule] 删除日记失败:', err);
        this.showToast('删除失败: ' + err.message, 'error');
      }
    }

    async _handleAIGenerateDiary() {
      try {
        this.showToast('AI 正在生成日记...', 'info');
        const diary = await this._service.generateDiary();
        if (diary) {
          this.showToast('AI 日记已生成', 'success');
          await this._showListView();
        } else {
          this.showToast('AI 生成失败', 'error');
        }
      } catch (err) {
        console.error('[DiaryModule] AI生成日记失败:', err);
        this.showToast('AI 生成失败: ' + err.message, 'error');
      }
    }

    async _handleSearch() {
      const keyword = await this.showPrompt({ message: '搜索关键词:', placeholder: '输入关键词' });
      if (!keyword?.trim()) return;

      try {
        const results = await this._service.searchDiaries(keyword.trim());
        const container = this._container?.querySelector('[data-view="LIST"]');
        if (!container) return;

        container.innerHTML = '';

        // 添加清除搜索按钮
        const clearBtn = document.createElement('div');
        clearBtn.style.cssText = 'text-align:center; padding: 8px 0;';
        clearBtn.innerHTML = '<button class="diary-btn" data-action="clear-search" style="color:#007AFF; font-size:14px; border:none; background:none; cursor:pointer; text-decoration:underline;">清除搜索</button>';
        container.appendChild(clearBtn);

        if (!results || results.length === 0) {
          container.innerHTML = `<div class="diary-empty">未找到包含"${this._escapeHtml(keyword.trim())}"的日记</div>`;
          return;
        }

        results.forEach(diary => {
          const el = document.createElement('div');
          el.className = 'diary-item';
          el.dataset.diaryId = diary.id || diary.diaryId;
          el.innerHTML = `
            <div class="diary-item-info">
              <div class="diary-date">${this._escapeHtml(diary.date || '')}</div>
              <div class="diary-item-title">${this._escapeHtml(diary.title || '无标题')}</div>
              <div class="diary-preview">${this._escapeHtml(diary.content?.substring(0, 50) || '')}...</div>
            </div>
          `;
          container.appendChild(el);
        });
      } catch (err) {
        console.error('[DiaryModule] 搜索失败:', err);
        this.showToast('搜索失败: ' + err.message, 'error');
      }
    }

    // ==================== 数据订阅 ====================

    _subscribeData() {
      try {
        const unsub = this._service.subscribeDiaries(() => {
          if (this._currentView === 'LIST') {
            this._renderList();
          }
        });
        if (unsub) this._unsubscribers.push(unsub);
      } catch (e) {
        console.warn('[DiaryModule] 订阅日记数据失败:', e);
      }
    }

    // ==================== 辅助方法 ====================

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // [铁则五] 静态工厂方法：返回普通对象供 __phoneShell.registerModule 使用
    static toPlainObject() {
      const instance = new DiaryModule();
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

  window.PhoneModules = window.PhoneModules || {};
  window.PhoneModules.Diary = DiaryModule;

  console.log('[Module] DiaryModule 已加载');
})();
