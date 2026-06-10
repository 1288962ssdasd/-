/**
 * 日记沉浸写作 - Diary Immersive Writer
 *
 * 功能：
 * 1. 全屏沉浸式写作界面（隐藏手机壳，纯净写作环境）
 * 2. 心情选择器（5种心情 + 对应背景氛围光效）
 * 3. 天气/位置快捷标签
 * 4. AI 生成等待动画（打字机效果 + 心情粒子）
 * 5. 心情趋势热力图（基于历史数据）
 * 6. 自动保存 + 字数统计
 *
 * 依赖：ANIMATION_CLASSES, Feedback, design-tokens CSS变量
 * 导出：window.DiaryImmersive
 */
(function () {
  'use strict';

  // ==================== 心情配置 ====================
  var MOOD_CONFIG = {
    normal: {
      name: '平静',
      icon: '😊',
      colors: ['#74B9FF', '#A3D8F4', '#DFE6E9'],
      bgGradient: 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 50%, #636e72 100%)',
      glowColor: 'rgba(116,185,255,0.3)',
      particleColor: '#74B9FF',
    },
    happy: {
      name: '开心',
      icon: '😄',
      colors: ['#FFEAA7', '#FDCB6E', '#F9CA24'],
      bgGradient: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 50%, #f39c12 100%)',
      glowColor: 'rgba(253,203,110,0.4)',
      particleColor: '#FDCB6E',
    },
    sad: {
      name: '难过',
      icon: '😢',
      colors: ['#74B9FF', '#0984E3', '#6C5CE7'],
      bgGradient: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 50%, #6c5ce7 100%)',
      glowColor: 'rgba(108,92,231,0.3)',
      particleColor: '#6C5CE7',
    },
    angry: {
      name: '生气',
      icon: '😠',
      colors: ['#FF7675', '#D63031', '#E17055'],
      bgGradient: 'linear-gradient(135deg, #ff7675 0%, #d63031 50%, #e17055 100%)',
      glowColor: 'rgba(214,48,49,0.3)',
      particleColor: '#FF7675',
    },
    excited: {
      name: '兴奋',
      icon: '🤩',
      colors: ['#A29BFE', '#6C5CE7', '#FD79A8'],
      bgGradient: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 50%, #fd79a8 100%)',
      glowColor: 'rgba(162,155,254,0.4)',
      particleColor: '#A29BFE',
    },
  };

  // ==================== 天气配置 ====================
  var WEATHER_OPTIONS = [
    { value: 'sunny', icon: '☀️', name: '晴天' },
    { value: 'cloudy', icon: '☁️', name: '多云' },
    { value: 'rainy', icon: '🌧', name: '下雨' },
    { value: 'snowy', icon: '❄️', name: '下雪' },
    { value: 'windy', icon: '💨', name: '大风' },
    { value: 'foggy', icon: '🌫', name: '雾天' },
  ];

  // ==================== CSS 注入 ====================
  var STYLES = '\
/* ===== 日记沉浸写作 ===== */\
.diary-immersive-container {\
  position: absolute;\
  top: 0; left: 0; right: 0; bottom: 0;\
  z-index: 100;\
  display: flex;\
  flex-direction: column;\
  overflow: hidden;\
  opacity: 0;\
  transition: opacity 0.4s ease;\
}\
.diary-immersive-container.active {\
  opacity: 1;\
}\
.diary-immersive-container.exiting {\
  opacity: 0;\
  transition: opacity 0.3s ease;\
}\
\
/* --- 背景氛围层 --- */\
.diary-immersive-bg {\
  position: absolute;\
  top: 0; left: 0; right: 0; bottom: 0;\
  z-index: 0;\
  transition: background 0.8s ease;\
}\
.diary-immersive-glow {\
  position: absolute;\
  border-radius: 50%;\
  pointer-events: none;\
  filter: blur(80px);\
  opacity: 0;\
  transition: opacity 0.8s ease, background 0.8s ease;\
  animation: dim-glow-breathe 5s ease-in-out infinite alternate;\
}\
.diary-immersive-glow.visible {\
  opacity: 0.4;\
}\
@keyframes dim-glow-breathe {\
  0% { transform: scale(1) translate(0, 0); }\
  100% { transform: scale(1.15) translate(5px, -5px); }\
}\
\
/* --- 顶部工具栏 --- */\
.diary-immersive-header {\
  position: relative;\
  z-index: 10;\
  padding: 12px 16px;\
  display: flex;\
  align-items: center;\
  justify-content: space-between;\
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%);\
}\
.diary-immersive-header-left,\
.diary-immersive-header-right {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
}\
.diary-immersive-btn {\
  padding: 6px 12px;\
  border-radius: 16px;\
  border: none;\
  font-size: 13px;\
  font-weight: 500;\
  cursor: pointer;\
  display: flex;\
  align-items: center;\
  gap: 4px;\
  transition: transform 0.15s, opacity 0.15s;\
  backdrop-filter: blur(10px);\
  -webkit-backdrop-filter: blur(10px);\
}\
.diary-immersive-btn:active {\
  transform: scale(0.93);\
}\
.diary-immersive-btn.close-btn {\
  background: rgba(255,255,255,0.15);\
  color: #fff;\
}\
.diary-immersive-btn.ai-btn {\
  background: linear-gradient(135deg, rgba(162,155,254,0.6), rgba(108,92,231,0.6));\
  color: #fff;\
}\
.diary-immersive-btn.ai-btn.generating {\
  opacity: 0.7;\
  pointer-events: none;\
}\
.diary-immersive-btn.save-btn {\
  background: rgba(255,255,255,0.2);\
  color: #fff;\
}\
.diary-immersed-date {\
  font-size: 14px;\
  font-weight: 600;\
  color: rgba(255,255,255,0.9);\
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);\
}\
\
/* --- 写作区域 --- */\
.diary-immersive-body {\
  position: relative;\
  z-index: 5;\
  flex: 1;\
  display: flex;\
  flex-direction: column;\
  padding: 0 20px;\
  overflow: hidden;\
}\
\
/* --- 标题输入 --- */\
.diary-immersive-title-input {\
  width: 100%;\
  border: none;\
  background: transparent;\
  font-size: 22px;\
  font-weight: 700;\
  color: #fff;\
  outline: none;\
  padding: 8px 0;\
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);\
}\
.diary-immersive-title-input::placeholder {\
  color: rgba(255,255,255,0.4);\
}\
\
/* --- 内容编辑器 --- */\
.diary-immersive-editor {\
  flex: 1;\
  width: 100%;\
  border: none;\
  background: transparent;\
  font-size: 16px;\
  line-height: 1.8;\
  color: rgba(255,255,255,0.92);\
  outline: none;\
  resize: none;\
  padding: 8px 0;\
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);\
  font-family: inherit;\
}\
.diary-immersive-editor::placeholder {\
  color: rgba(255,255,255,0.35);\
}\
\
/* --- AI 生成覆盖层 --- */\
.diary-ai-overlay {\
  position: absolute;\
  top: 0; left: 0; right: 0; bottom: 0;\
  z-index: 8;\
  display: none;\
  flex-direction: column;\
  align-items: center;\
  justify-content: center;\
  gap: 16px;\
  padding: 40px;\
}\
.diary-ai-overlay.active {\
  display: flex;\
}\
.diary-ai-typing {\
  font-size: 16px;\
  line-height: 1.8;\
  color: rgba(255,255,255,0.9);\
  text-align: center;\
  max-width: 100%;\
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);\
}\
.diary-ai-cursor {\
  display: inline-block;\
  width: 2px;\
  height: 18px;\
  background: #fff;\
  vertical-align: text-bottom;\
  margin-left: 2px;\
  animation: dim-cursor-blink 0.8s step-end infinite;\
}\
@keyframes dim-cursor-blink {\
  0%, 100% { opacity: 1; }\
  50% { opacity: 0; }\
}\
.diary-ai-status {\
  font-size: 12px;\
  color: rgba(255,255,255,0.5);\
  display: flex;\
  align-items: center;\
  gap: 6px;\
}\
.diary-ai-status .ai-dot {\
  width: 6px; height: 6px;\
  border-radius: 50%;\
  background: #A29BFE;\
  animation: dim-ai-pulse 1.2s ease-in-out infinite;\
}\
@keyframes dim-ai-pulse {\
  0%, 100% { opacity: 1; transform: scale(1); }\
  50% { opacity: 0.4; transform: scale(0.7); }\
}\
\
/* --- 心情粒子 --- */\
.diary-mood-particle {\
  position: absolute;\
  pointer-events: none;\
  font-size: 16px;\
  opacity: 0;\
  animation: dim-mood-particle 3s ease-out forwards;\
}\
@keyframes dim-mood-particle {\
  0% { opacity: 0; transform: translateY(0) scale(0.5) rotate(0deg); }\
  15% { opacity: 0.8; transform: translateY(-20px) scale(1) rotate(30deg); }\
  100% { opacity: 0; transform: translateY(-120px) scale(0.3) rotate(180deg); }\
}\
\
/* --- 底部面板 --- */\
.diary-immersive-footer {\
  position: relative;\
  z-index: 10;\
  padding: 0 16px 16px;\
  background: linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 100%);\
}\
\
/* --- 心情选择器 --- */\
.diary-mood-selector {\
  display: flex;\
  align-items: center;\
  gap: 6px;\
  margin-bottom: 10px;\
}\
.diary-mood-label {\
  font-size: 12px;\
  color: rgba(255,255,255,0.5);\
  margin-right: 4px;\
  flex-shrink: 0;\
}\
.diary-mood-item {\
  width: 36px; height: 36px;\
  border-radius: 50%;\
  border: 2px solid transparent;\
  background: rgba(255,255,255,0.1);\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  font-size: 18px;\
  cursor: pointer;\
  transition: transform 0.2s, border-color 0.2s, background 0.2s;\
  backdrop-filter: blur(8px);\
  -webkit-backdrop-filter: blur(8px);\
}\
.diary-mood-item:hover {\
  background: rgba(255,255,255,0.2);\
}\
.diary-mood-item:active {\
  transform: scale(0.88);\
}\
.diary-mood-item.selected {\
  border-color: rgba(255,255,255,0.8);\
  background: rgba(255,255,255,0.2);\
  transform: scale(1.1);\
}\
\
/* --- 标签栏 --- */\
.diary-tag-bar {\
  display: flex;\
  align-items: center;\
  gap: 6px;\
  flex-wrap: wrap;\
}\
.diary-tag-label {\
  font-size: 12px;\
  color: rgba(255,255,255,0.5);\
  margin-right: 4px;\
  flex-shrink: 0;\
}\
.diary-weather-item {\
  padding: 4px 10px;\
  border-radius: 12px;\
  border: 1px solid rgba(255,255,255,0.15);\
  background: rgba(255,255,255,0.08);\
  font-size: 12px;\
  color: rgba(255,255,255,0.7);\
  cursor: pointer;\
  display: flex;\
  align-items: center;\
  gap: 3px;\
  transition: background 0.2s, border-color 0.2s, transform 0.15s;\
}\
.diary-weather-item:hover {\
  background: rgba(255,255,255,0.15);\
}\
.diary-weather-item:active {\
  transform: scale(0.93);\
}\
.diary-weather-item.selected {\
  border-color: rgba(255,255,255,0.5);\
  background: rgba(255,255,255,0.2);\
  color: #fff;\
}\
.diary-location-input {\
  padding: 4px 10px;\
  border-radius: 12px;\
  border: 1px solid rgba(255,255,255,0.15);\
  background: rgba(255,255,255,0.08);\
  font-size: 12px;\
  color: rgba(255,255,255,0.7);\
  outline: none;\
  width: 80px;\
  transition: border-color 0.2s, width 0.3s;\
}\
.diary-location-input:focus {\
  border-color: rgba(255,255,255,0.4);\
  width: 120px;\
}\
.diary-location-input::placeholder {\
  color: rgba(255,255,255,0.3);\
}\
\
/* --- 字数统计 --- */\
.diary-word-count {\
  position: absolute;\
  bottom: 8px;\
  right: 16px;\
  font-size: 11px;\
  color: rgba(255,255,255,0.35);\
  z-index: 10;\
}\
\
/* --- 自动保存提示 --- */\
.diary-auto-save-toast {\
  position: absolute;\
  top: 60px;\
  left: 50%;\
  transform: translateX(-50%) translateY(-10px);\
  padding: 6px 16px;\
  border-radius: 14px;\
  background: rgba(0,0,0,0.5);\
  backdrop-filter: blur(10px);\
  -webkit-backdrop-filter: blur(10px);\
  font-size: 12px;\
  color: rgba(255,255,255,0.8);\
  opacity: 0;\
  transition: opacity 0.3s, transform 0.3s;\
  z-index: 15;\
  pointer-events: none;\
}\
.diary-auto-save-toast.visible {\
  opacity: 1;\
  transform: translateX(-50%) translateY(0);\
}\
\
/* ===== 心情趋势热力图 ===== */\
.diary-heatmap-container {\
  padding: 16px;\
  overflow-x: auto;\
}\
.diary-heatmap-title {\
  font-size: 15px;\
  font-weight: 600;\
  color: var(--color-text-primary, #333);\
  margin-bottom: 12px;\
}\
.diary-heatmap-grid {\
  display: flex;\
  gap: 3px;\
  flex-wrap: nowrap;\
}\
.diary-heatmap-week {\
  display: flex;\
  flex-direction: column;\
  gap: 3px;\
}\
.diary-heatmap-cell {\
  width: 14px; height: 14px;\
  border-radius: 3px;\
  background: var(--color-bg-secondary, #f0f0f0);\
  transition: transform 0.15s, opacity 0.15s;\
  cursor: pointer;\
  position: relative;\
}\
.diary-heatmap-cell:hover {\
  transform: scale(1.4);\
  z-index: 2;\
}\
.diary-heatmap-cell.mood-normal { background: #74B9FF; opacity: 0.5; }\
.diary-heatmap-cell.mood-happy { background: #FDCB6E; opacity: 0.6; }\
.diary-heatmap-cell.mood-sad { background: #0984E3; opacity: 0.6; }\
.diary-heatmap-cell.mood-angry { background: #D63031; opacity: 0.6; }\
.diary-heatmap-cell.mood-excited { background: #A29BFE; opacity: 0.6; }\
.diary-heatmap-cell.intensity-1 { opacity: 0.35; }\
.diary-heatmap-cell.intensity-2 { opacity: 0.55; }\
.diary-heatmap-cell.intensity-3 { opacity: 0.75; }\
.diary-heatmap-cell.intensity-4 { opacity: 0.95; }\
\
/* --- 热力图 Tooltip --- */\
.diary-heatmap-tooltip {\
  position: fixed;\
  padding: 6px 10px;\
  border-radius: 8px;\
  background: rgba(0,0,0,0.8);\
  color: #fff;\
  font-size: 11px;\
  pointer-events: none;\
  z-index: 1000;\
  white-space: nowrap;\
  opacity: 0;\
  transition: opacity 0.15s;\
}\
.diary-heatmap-tooltip.visible {\
  opacity: 1;\
}\
\
/* --- 心情统计条 --- */\
.diary-mood-stats {\
  display: flex;\
  gap: 12px;\
  padding: 12px 0;\
  flex-wrap: wrap;\
}\
.diary-mood-stat-item {\
  display: flex;\
  align-items: center;\
  gap: 4px;\
  font-size: 12px;\
  color: var(--color-text-secondary, #666);\
}\
.diary-mood-stat-icon {\
  font-size: 16px;\
}\
.diary-mood-stat-bar {\
  width: 60px; height: 6px;\
  border-radius: 3px;\
  background: var(--color-bg-secondary, #f0f0f0);\
  overflow: hidden;\
}\
.diary-mood-stat-fill {\
  height: 100%;\
  border-radius: 3px;\
  transition: width 0.5s ease;\
}\
';

  // ==================== DiaryImmersive 类 ====================
  function DiaryImmersive() {
    this._container = null;
    this._isActive = false;
    this._currentMood = 'normal';
    this._currentWeather = '';
    this._currentLocation = '';
    this._autoSaveTimer = null;
    this._aiGenerating = false;
    this._aiTypingTimer = null;
    this._onSave = null;
    this._onAIGenerate = null;
    this._onClose = null;
    this._editMode = false; // false=新建, true=编辑
    this._editDiaryId = null;
    this._particleTimer = null;
  }

  // ==================== 初始化 ====================
  DiaryImmersive.prototype.init = function (parentEl) {
    this._container = document.createElement('div');
    this._container.className = 'diary-immersive-container';
    this._container.innerHTML = this._buildHTML();
    parentEl.appendChild(this._container);
    this._bindEvents();
    this._setMood('normal');
  };

  // ==================== 构建 HTML ====================
  DiaryImmersive.prototype._buildHTML = function () {
    var moodItems = '';
    var moods = ['normal', 'happy', 'sad', 'angry', 'excited'];
    for (var i = 0; i < moods.length; i++) {
      var m = moods[i];
      moodItems += '<div class="diary-mood-item" data-mood="' + m + '">' + MOOD_CONFIG[m].icon + '</div>';
    }

    var weatherItems = '';
    for (var j = 0; j < WEATHER_OPTIONS.length; j++) {
      var w = WEATHER_OPTIONS[j];
      weatherItems += '<div class="diary-weather-item" data-weather="' + w.value + '">' + w.icon + ' ' + w.name + '</div>';
    }

    return '\
      <div class="diary-immersive-bg"></div>\
      <div class="diary-immersive-glow" style="width:250px;height:250px;top:10%;left:-60px;"></div>\
      <div class="diary-immersive-glow" style="width:200px;height:200px;bottom:15%;right:-40px;animation-delay:-2.5s;"></div>\
      <div class="diary-auto-save-toast">已自动保存</div>\
      <div class="diary-immersive-header">\
        <div class="diary-immersive-header-left">\
          <button class="diary-immersive-btn close-btn" data-action="close">← 返回</button>\
        </div>\
        <div class="diary-immersed-date"></div>\
        <div class="diary-immersive-header-right">\
          <button class="diary-immersive-btn ai-btn" data-action="ai-generate">✨ AI 写日记</button>\
          <button class="diary-immersive-btn save-btn" data-action="save">保存</button>\
        </div>\
      </div>\
      <div class="diary-immersive-body">\
        <input class="diary-immersive-title-input" type="text" placeholder="标题..." maxlength="50">\
        <textarea class="diary-immersive-editor" placeholder="今天发生了什么..."></textarea>\
        <div class="diary-ai-overlay">\
          <div class="diary-ai-typing"></div>\
          <div class="diary-ai-status"><span class="ai-dot"></span>AI 正在构思...</div>\
        </div>\
      </div>\
      <div class="diary-word-count">0 字</div>\
      <div class="diary-immersive-footer">\
        <div class="diary-mood-selector">\
          <span class="diary-mood-label">心情</span>\
          ' + moodItems + '\
        </div>\
        <div class="diary-tag-bar">\
          <span class="diary-tag-label">天气</span>\
          ' + weatherItems + '\
          <input class="diary-location-input" type="text" placeholder="📍 地点" maxlength="20">\
        </div>\
      </div>';
  };

  // ==================== 事件绑定 ====================
  DiaryImmersive.prototype._bindEvents = function () {
    var self = this;

    this._container.addEventListener('click', function (e) {
      var actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      var action = actionEl.getAttribute('data-action');

      switch (action) {
        case 'close':
          self.exit();
          if (self._onClose) self._onClose();
          break;
        case 'save':
          self._handleSave();
          break;
        case 'ai-generate':
          self._handleAIGenerate();
          break;
      }
    });

    // 心情选择
    this._container.addEventListener('click', function (e) {
      var item = e.target.closest('.diary-mood-item');
      if (!item) return;
      self._setMood(item.getAttribute('data-mood'));
      if (window.Feedback) window.Feedback.tab();
    });

    // 天气选择
    this._container.addEventListener('click', function (e) {
      var item = e.target.closest('.diary-weather-item');
      if (!item) return;
      var val = item.getAttribute('data-weather');
      self._setWeather(val);
      if (window.Feedback) window.Feedback.tab();
    });

    // 字数统计 + 自动保存
    var editor = this._container.querySelector('.diary-immersive-editor');
    editor.addEventListener('input', function () {
      self._updateWordCount();
      self._scheduleAutoSave();
    });

    var titleInput = this._container.querySelector('.diary-immersive-title-input');
    titleInput.addEventListener('input', function () {
      self._scheduleAutoSave();
    });
  };

  // ==================== 进入沉浸模式 ====================
  DiaryImmersive.prototype.enter = function (options) {
    if (!this._container) return;
    options = options || {};

    this._editMode = !!options.diaryId;
    this._editDiaryId = options.diaryId || null;
    this._onSave = options.onSave || null;
    this._onAIGenerate = options.onAIGenerate || null;
    this._onClose = options.onClose || null;

    // 设置日期
    var dateEl = this._container.querySelector('.diary-immersed-date');
    var today = new Date();
    var dateStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';
    var weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    dateStr += ' 星期' + weekDays[today.getDay()];
    if (dateEl) dateEl.textContent = dateStr;

    // 填充已有内容（编辑模式）
    var titleInput = this._container.querySelector('.diary-immersive-title-input');
    var editor = this._container.querySelector('.diary-immersive-editor');
    if (this._editMode && options.diary) {
      titleInput.value = options.diary.title || '';
      editor.value = options.diary.content || '';
      this._setMood(options.diary.mood || 'normal');
      this._setWeather(options.diary.weather || '');
      var locInput = this._container.querySelector('.diary-location-input');
      if (locInput) locInput.value = options.diary.location || '';
    } else {
      titleInput.value = '';
      editor.value = '';
      this._setMood('normal');
      this._clearWeather();
      var locInput2 = this._container.querySelector('.diary-location-input');
      if (locInput2) locInput2.value = '';
    }

    this._updateWordCount();
    this._stopAutoSave();

    // 显示
    this._container.style.display = 'flex';
    var self = this;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        self._container.classList.add('active');
      });
    });
    this._isActive = true;

    if (window.Feedback) window.Feedback.success();

    // 聚焦标题
    setTimeout(function () {
      titleInput.focus();
    }, 500);
  };

  // ==================== 退出沉浸模式 ====================
  DiaryImmersive.prototype.exit = function () {
    if (!this._container || !this._isActive) return;
    var self = this;
    this._container.classList.remove('active');
    this._container.classList.add('exiting');
    this._stopAutoSave();
    this._stopAIGeneration();
    this._stopParticles();

    setTimeout(function () {
      self._container.style.display = 'none';
      self._container.classList.remove('exiting');
      self._isActive = false;
    }, 350);
  };

  // ==================== 是否激活 ====================
  DiaryImmersive.prototype.isActive = function () {
    return this._isActive;
  };

  // ==================== 设置心情 ====================
  DiaryImmersive.prototype._setMood = function (mood) {
    this._currentMood = mood;
    var cfg = MOOD_CONFIG[mood] || MOOD_CONFIG.normal;

    // 更新背景
    var bg = this._container.querySelector('.diary-immersive-bg');
    if (bg) bg.style.background = cfg.bgGradient;

    // 更新光晕
    var glows = this._container.querySelectorAll('.diary-immersive-glow');
    for (var i = 0; i < glows.length; i++) {
      glows[i].style.background = cfg.glowColor;
      glows[i].classList.add('visible');
    }

    // 更新选中状态
    var items = this._container.querySelectorAll('.diary-mood-item');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('selected', items[j].getAttribute('data-mood') === mood);
    }

    // 发射心情粒子
    this._emitMoodParticles(cfg);
  };

  // ==================== 心情粒子 ====================
  DiaryImmersive.prototype._emitMoodParticles = function (cfg) {
    this._stopParticles();
    var body = this._container.querySelector('.diary-immersive-body');
    if (!body) return;

    var self = this;
    var icons = [cfg.icon, '✨', '💫', '⭐'];

    this._particleTimer = setInterval(function () {
      if (!self._isActive) {
        self._stopParticles();
        return;
      }
      var particle = document.createElement('div');
      particle.className = 'diary-mood-particle';
      particle.textContent = icons[Math.floor(Math.random() * icons.length)];
      particle.style.left = (10 + Math.random() * 80) + '%';
      particle.style.bottom = '20%';
      particle.style.fontSize = (14 + Math.random() * 12) + 'px';
      particle.style.animationDuration = (2.5 + Math.random() * 2) + 's';
      body.appendChild(particle);

      setTimeout(function () {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      }, 5000);
    }, 800);
  };

  DiaryImmersive.prototype._stopParticles = function () {
    if (this._particleTimer) {
      clearInterval(this._particleTimer);
      this._particleTimer = null;
    }
  };

  // ==================== 设置天气 ====================
  DiaryImmersive.prototype._setWeather = function (weather) {
    this._currentWeather = weather;
    var items = this._container.querySelectorAll('.diary-weather-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('selected', items[i].getAttribute('data-weather') === weather);
    }
  };

  DiaryImmersive.prototype._clearWeather = function () {
    this._currentWeather = '';
    var items = this._container.querySelectorAll('.diary-weather-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('selected');
    }
  };

  // ==================== 字数统计 ====================
  DiaryImmersive.prototype._updateWordCount = function () {
    var editor = this._container.querySelector('.diary-immersive-editor');
    var countEl = this._container.querySelector('.diary-word-count');
    if (!editor || !countEl) return;
    var text = editor.value.trim();
    var count = text.length;
    countEl.textContent = count + ' 字';
  };

  // ==================== 自动保存 ====================
  DiaryImmersive.prototype._scheduleAutoSave = function () {
    this._stopAutoSave();
    var self = this;
    this._autoSaveTimer = setTimeout(function () {
      self._doAutoSave();
    }, 3000);
  };

  DiaryImmersive.prototype._stopAutoSave = function () {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  };

  DiaryImmersive.prototype._doAutoSave = function () {
    var data = this._getDiaryData();
    if (!data.title && !data.content) return;

    // 显示自动保存提示
    var toast = this._container.querySelector('.diary-auto-save-toast');
    if (toast) {
      toast.classList.add('visible');
      setTimeout(function () {
        toast.classList.remove('visible');
      }, 1500);
    }

    if (this._onSave) {
      this._onSave(data, true); // true = autoSave
    }
  };

  // ==================== 手动保存 ====================
  DiaryImmersive.prototype._handleSave = function () {
    var data = this._getDiaryData();
    if (!data.title && !data.content) {
      if (window.Feedback) window.Feedback.error();
      return;
    }

    if (window.Feedback) window.Feedback.success();

    if (this._onSave) {
      this._onSave(data, false); // false = manual save
    }

    // 保存后退出
    var self = this;
    setTimeout(function () {
      self.exit();
    }, 300);
  };

  // ==================== 获取日记数据 ====================
  DiaryImmersive.prototype._getDiaryData = function () {
    var titleInput = this._container.querySelector('.diary-immersive-title-input');
    var editor = this._container.querySelector('.diary-immersive-editor');
    var locInput = this._container.querySelector('.diary-location-input');

    return {
      id: this._editDiaryId || null,
      title: (titleInput ? titleInput.value.trim() : '') || '无标题',
      content: editor ? editor.value : '',
      mood: this._currentMood,
      weather: this._currentWeather,
      location: locInput ? locInput.value.trim() : '',
    };
  };

  // ==================== AI 生成 ====================
  DiaryImmersive.prototype._handleAIGenerate = function () {
    if (this._aiGenerating) return;
    this._aiGenerating = true;

    var aiBtn = this._container.querySelector('.ai-btn');
    if (aiBtn) {
      aiBtn.classList.add('generating');
      aiBtn.textContent = '✨ 生成中...';
    }

    // 显示覆盖层
    var overlay = this._container.querySelector('.diary-ai-overlay');
    var typingEl = this._container.querySelector('.diary-ai-typing');
    if (overlay) overlay.classList.add('active');
    if (typingEl) typingEl.innerHTML = '';

    if (window.Feedback) window.Feedback.tab();

    if (this._onAIGenerate) {
      var self = this;
      var context = {
        mood: this._currentMood,
        weather: this._currentWeather,
        location: this._currentLocation,
      };
      this._onAIGenerate(context, function (text) {
        self._showAITyping(text);
      });
    } else {
      // 没有回调，模拟生成
      this._simulateAIGeneration();
    }
  };

  // ==================== AI 打字机效果 ====================
  DiaryImmersive.prototype._showAITyping = function (text) {
    var self = this;
    var typingEl = this._container.querySelector('.diary-ai-typing');
    if (!typingEl) return;

    typingEl.innerHTML = '';
    var index = 0;
    var speed = 50; // 每字 50ms

    this._aiTypingTimer = setInterval(function () {
      if (index < text.length) {
        typingEl.innerHTML = self._escapeHtml(text.substring(0, index + 1)) + '<span class="diary-ai-cursor"></span>';
        index++;
      } else {
        self._finishAIGeneration(text);
      }
    }, speed);
  };

  // ==================== 模拟 AI 生成 ====================
  DiaryImmersive.prototype._simulateAIGeneration = function () {
    var sampleTexts = [
      '今天天气很好，阳光透过窗帘洒在书桌上。泡了一杯热茶，翻开了一本很久没看的书。窗外的鸟叫声让人感到格外平静。这样的日子，简单却很幸福。',
      '下午和朋友去了附近的咖啡馆，聊了很多以前的事情。时间过得真快，转眼间已经过去这么多年了。不过有些东西是不会变的，比如友情。',
      '晚上一个人散步，看到了很美的晚霞。拿出手机拍了几张照片，但总觉得拍不出眼睛看到的美。有些风景，只能用心去记。',
    ];
    var text = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    this._showAITyping(text);
  };

  // ==================== 完成 AI 生成 ====================
  DiaryImmersive.prototype._finishAIGeneration = function (text) {
    this._stopAIGeneration();

    var editor = this._container.querySelector('.diary-immersive-editor');
    if (editor) {
      editor.value = text;
      this._updateWordCount();
    }

    // 隐藏覆盖层
    var overlay = this._container.querySelector('.diary-ai-overlay');
    if (overlay) overlay.classList.remove('active');

    // 恢复按钮
    var aiBtn = this._container.querySelector('.ai-btn');
    if (aiBtn) {
      aiBtn.classList.remove('generating');
      aiBtn.innerHTML = '✨ AI 写日记';
    }

    this._aiGenerating = false;

    if (window.Feedback) window.Feedback.success();
  };

  // ==================== 停止 AI 生成 ====================
  DiaryImmersive.prototype._stopAIGeneration = function () {
    if (this._aiTypingTimer) {
      clearInterval(this._aiTypingTimer);
      this._aiTypingTimer = null;
    }
    this._aiGenerating = false;

    var overlay = this._container.querySelector('.diary-ai-overlay');
    if (overlay) overlay.classList.remove('active');

    var aiBtn = this._container.querySelector('.ai-btn');
    if (aiBtn) {
      aiBtn.classList.remove('generating');
      aiBtn.innerHTML = '✨ AI 写日记';
    }
  };

  // ==================== 心情趋势热力图（外部调用） ====================
  DiaryImmersive.renderHeatmap = function (diaries, container) {
    if (!container || !diaries || diaries.length === 0) {
      if (container) container.innerHTML = '<p style="text-align:center;color:var(--color-text-tertiary,#999);padding:20px;font-size:13px;">暂无日记数据</p>';
      return;
    }

    // 构建日期->日记映射
    var diaryMap = {};
    for (var i = 0; i < diaries.length; i++) {
      var d = diaries[i];
      if (d.date) {
        if (!diaryMap[d.date]) diaryMap[d.date] = [];
        diaryMap[d.date].push(d);
      }
    }

    // 生成最近 12 周（84天）的网格
    var today = new Date();
    var startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 83);
    // 对齐到周日
    startDate.setDate(startDate.getDate() - startDate.getDay());

    var weeks = [];
    var currentWeek = [];
    var current = new Date(startDate);

    while (current <= today || currentWeek.length < 7) {
      var dateStr = current.getFullYear() + '-' +
        String(current.getMonth() + 1).padStart(2, '0') + '-' +
        String(current.getDate()).padStart(2, '0');

      var dayDiaries = diaryMap[dateStr] || [];
      var mood = dayDiaries.length > 0 ? dayDiaries[dayDiaries.length - 1].mood : null;
      var intensity = Math.min(dayDiaries.length, 4);

      currentWeek.push({
        date: dateStr,
        mood: mood,
        intensity: intensity,
        count: dayDiaries.length,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // 渲染
    var html = '<div class="diary-heatmap-container">';
    html += '<div class="diary-heatmap-title">心情趋势</div>';
    html += '<div class="diary-heatmap-grid">';

    for (var w = 0; w < weeks.length; w++) {
      html += '<div class="diary-heatmap-week">';
      for (var d = 0; d < weeks[w].length; d++) {
        var cell = weeks[w][d];
        var classes = 'diary-heatmap-cell';
        if (cell.mood) classes += ' mood-' + cell.mood;
        if (cell.intensity > 0) classes += ' intensity-' + cell.intensity;
        var title = cell.date + (cell.count > 0 ? ' (' + cell.count + '篇, ' + (MOOD_CONFIG[cell.mood] ? MOOD_CONFIG[cell.mood].icon + MOOD_CONFIG[cell.mood].name : '') + ')' : '');
        html += '<div class="' + classes + '" data-date="' + cell.date + '" title="' + title + '"></div>';
      }
      html += '</div>';
    }

    html += '</div>';

    // 心情统计
    var moodCounts = { normal: 0, happy: 0, sad: 0, angry: 0, excited: 0 };
    var total = 0;
    for (var k = 0; k < diaries.length; k++) {
      var m = diaries[k].mood;
      if (moodCounts.hasOwnProperty(m)) {
        moodCounts[m]++;
        total++;
      }
    }

    html += '<div class="diary-mood-stats">';
    var moodKeys = ['happy', 'excited', 'normal', 'sad', 'angry'];
    for (var mi = 0; mi < moodKeys.length; mi++) {
      var mk = moodKeys[mi];
      var mc = moodCounts[mk];
      var pct = total > 0 ? Math.round((mc / total) * 100) : 0;
      var mcfg = MOOD_CONFIG[mk];
      html += '<div class="diary-mood-stat-item">\
        <span class="diary-mood-stat-icon">' + mcfg.icon + '</span>\
        <span>' + mcfg.name + '</span>\
        <div class="diary-mood-stat-bar">\
          <div class="diary-mood-stat-fill" style="width:' + pct + '%;background:' + mcfg.colors[0] + ';"></div>\
        </div>\
        <span>' + mc + '</span>\
      </div>';
    }
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  };

  // ==================== 注入样式 ====================
  DiaryImmersive.injectStyles = function () {
    if (typeof document !== 'undefined') {
      var style = document.createElement('style');
      style.id = 'diary-immersive-styles';
      style.textContent = STYLES;
      document.documentElement.appendChild(style);
    }
  };

  // ==================== 工具方法 ====================
  DiaryImmersive.prototype._escapeHtml = function (str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // ==================== 导出 ====================
  window.DiaryImmersive = DiaryImmersive;
  window.DiaryImmersive.MOOD_CONFIG = MOOD_CONFIG;
  window.DiaryImmersive.WEATHER_OPTIONS = WEATHER_OPTIONS;
})();
