/**
 * @layer Renderer
 * @file   diary-renderer.js
 *
 * 职责: 日记 UI 渲染 - iOS 写实风格列表、详情、编辑、统计、时间线
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 diary- 前缀
 */

;(function () {
  'use strict';

  class DiaryRenderer {
    constructor() {
      this._stylesInjected = false;
    }

    // ==================== 样式注入 ====================

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;

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

    // ==================== 辅助方法 ====================

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ==================== 主框架渲染 ====================

    renderShell() {
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

    // ==================== 列表视图 ====================

    renderList(diaries) {
      const fragment = document.createDocumentFragment();

      if (!diaries || diaries.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'diary-empty';
        emptyEl.textContent = '暂无日记';
        fragment.appendChild(emptyEl);
        return fragment;
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
        fragment.appendChild(el);
      });

      return fragment;
    }

    // ==================== 详情视图 ====================

    renderDetail(diary) {
      const container = document.createElement('div');
      container.className = 'diary-detail';
      container.innerHTML = `
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
      `;
      return container;
    }

    // ==================== 编辑视图 ====================

    renderEdit() {
      const container = document.createElement('div');
      container.className = 'diary-edit';
      container.innerHTML = `
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
      `;
      return container;
    }

    // ==================== 统计视图 ====================

    renderStats(stats) {
      const container = document.createElement('div');
      container.className = 'diary-stats';
      container.innerHTML = `
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
      `;
      return container;
    }

    // ==================== 时间线视图 ====================

    renderTimeline(timeline) {
      if (!timeline || !timeline.points || timeline.points.length === 0) {
        const container = document.createElement('div');
        container.className = 'diary-empty';
        container.innerHTML = '暂无剧情推演记录<br><span style="font-size:12px;color:#8E8E93;">开启AI管家后，剧情事件会自动记录在这里</span>';
        return container;
      }

      const points = timeline.points.slice().reverse();

      const container = document.createElement('div');
      container.className = 'diary-tl';
      let html = '';
      html += '<div class="diary-tl-header">';
      html += '<button class="diary-btn" data-action="back">\u2190 日记</button>';
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

      html += '</div>';
      container.innerHTML = html;
      return container;
    }

    // ==================== 空状态 / 错误 ====================

    renderEmpty(message) {
      const el = document.createElement('div');
      el.className = 'diary-empty';
      el.textContent = message || '暂无日记';
      return el;
    }

    renderError(message) {
      const el = document.createElement('div');
      el.className = 'diary-error';
      el.textContent = message || '加载失败，请重试';
      return el;
    }
  }

  // 暴露到全局
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Diary = DiaryRenderer;

  console.log('[Renderer] DiaryRenderer 已加载');
})();
