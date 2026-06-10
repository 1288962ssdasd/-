/**
 * TTSService - TTS 语音服务
 * 
 * 平台层服务，封装 TTS 后端 API 调用
 * 
 * 【铁则合规说明】
 * - 此文件位于 PLATFORM/ 目录，属于平台层，允许调用 fetch
 * - 业务模块通过 Platform.getService('tts') 获取服务实例
 * - 不暴露 window.* 全局变量
 */

;(function () {
  'use strict';

  /**
   * TTSService TTS 服务类
   */
  class TTSService {
    constructor(platform) {
      this._platform = platform;
      this._pollTimer = null;
      this._eventsBound = false;
      
      // 默认配置
      this._config = {
        baseUrl: 'http://127.0.0.1:1221',
        ttsEndpoint: '/api/tts',
        timeoutMs: 30000,
        defaultVoice: 'zh-CN-YunxiNeural',
        defaultSpeed: 50,
        defaultPitch: 100,
      };
      
      // 角色声音映射
      this._voiceMap = {};
      
      console.log('[TTSService] 服务已创建');
    }

    // ==================== 配置管理 ====================

    /**
     * 获取当前配置
     * @returns {Object}
     */
    getConfig() {
      // 尝试从 CatboxTTS 全局配置读取
      if (typeof window !== 'undefined' && window.config) {
        const catboxConfig = window.config;
        return {
          baseUrl: catboxConfig.directTtsUrl
            ? catboxConfig.directTtsUrl.replace(/\/api\/tts$/, '')
            : this._config.baseUrl,
          ttsEndpoint: '/api/tts',
          timeoutMs: catboxConfig.requestTimeoutMs || this._config.timeoutMs,
          defaultVoice: catboxConfig.defaultVoice || this._config.defaultVoice,
          defaultSpeed: catboxConfig.speechRate || this._config.defaultSpeed,
          defaultPitch: catboxConfig.pitch || this._config.defaultPitch,
          requestMode: catboxConfig.requestMode || 'direct',
          bridgeServer: catboxConfig.bridgeServer || 'http://127.0.0.1:3002',
          globalHeaders: catboxConfig.globalHeaders || '',
        };
      }
      return { ...this._config };
    }

    /**
     * 更新配置
     * @param {Object} config
     */
    updateConfig(config) {
      Object.assign(this._config, config);
      this._emit('tts:configUpdated', { config: this._config });
    }

    /**
     * 设置角色声音映射
     * @param {Object} map - { characterName: voiceId }
     */
    setVoiceMap(map) {
      this._voiceMap = map;
      console.log('[TTSService] 声音映射已更新:', Object.keys(map));
    }

    /**
     * 获取角色对应的声音ID
     * @param {string} charName
     * @returns {string}
     */
    getVoiceForCharacter(charName) {
      return this._voiceMap[charName] || this.getConfig().defaultVoice;
    }

    // ==================== 核心功能 ====================

    /**
     * 合成语音（返回音频 Blob）
     * @param {string} text
     * @param {string} voiceId
     * @returns {Promise<Blob>}
     */
    async synthesize(text, voiceId) {
      const config = this.getConfig();
      const voice = voiceId || config.defaultVoice;

      if (!text || !text.trim()) {
        throw new Error('No text to synthesize');
      }

      const requestMode = config.requestMode || 'direct';
      let targetUrl;
      let requestBody;

      if (requestMode === 'direct') {
        targetUrl = config.baseUrl + config.ttsEndpoint;
        requestBody = {
          text: text.trim(),
          engine: '',
          locale: '',
          voice: voice,
          speed: config.defaultSpeed,
          pitch: config.defaultPitch,
        };
      } else {
        targetUrl = config.bridgeServer + '/tts';
        requestBody = {
          text: text.trim(),
          voice: voice,
          rate: config.defaultSpeed,
          pitch: config.defaultPitch,
          stream: true,
        };
      }

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'audio/wav, audio/mpeg, */*',
      };

      if (config.globalHeaders) {
        try {
          const customHeaders = this._parseGlobalHeaders(config.globalHeaders);
          Object.assign(headers, customHeaders);
        } catch (e) {
          console.warn('[TTSService] 解析自定义 headers 失败:', e);
        }
      }

      console.log('[TTSService] 合成语音: length=' + text.length, 'voice:', voice);

      // 使用 Platform 的 HTTP 请求方法（如果可用）
      const response = await this._fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        timeout: config.timeoutMs,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error('TTS Error ' + response.status + ': ' + errorText.substring(0, 200));
      }

      const audioBlob = await response.blob();
      console.log('[TTSService] 音频已接收:', audioBlob.size, 'bytes');
      return audioBlob;
    }

    /**
     * 播放语音（后端直接播放）
     * @param {string} text
     * @param {string} voiceId
     * @param {Function} onStateChange - 状态回调 (loading/playing/ended/error)
     */
    async play(text, voiceId, onStateChange) {
      const config = this.getConfig();
      const voice = voiceId || config.defaultVoice;

      if (!text || !text.trim()) {
        throw new Error('No text to speak');
      }

      if (onStateChange) onStateChange('loading');

      try {
        const speakUrl = config.baseUrl + '/api/tts/speak';
        const requestBody = {
          text: text.trim(),
          voice: voice,
          speed: config.defaultSpeed,
          pitch: config.defaultPitch,
        };

        const headers = { 'Content-Type': 'application/json' };
        if (config.globalHeaders) {
          try {
            Object.assign(headers, this._parseGlobalHeaders(config.globalHeaders));
          } catch (e) { /* skip */ }
        }

        console.log('[TTSService] 系统播放: length=' + text.length, 'voice:', voice);

        const response = await this._fetch(speakUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          timeout: config.timeoutMs,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error('TTS Error ' + response.status + ': ' + errorText.substring(0, 200));
        }

        if (onStateChange) onStateChange('playing');

        // 轮询播放状态
        this._pollPlaybackStatus(onStateChange);

      } catch (err) {
        console.error('[TTSService] 播放失败:', err);
        if (onStateChange) onStateChange('error');
        throw err;
      }
    }

    /**
     * 停止播放
     */
    stop() {
      if (this._pollTimer) {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
      }
      
      // 通知后端停止
      const config = this.getConfig();
      this._fetch(config.baseUrl + '/api/tts/stop', { method: 'POST' }).catch(() => {});
      
      // 重置所有语音气泡状态
      /** @deprecated DOM 操作应迁移到 Renderer 层（铁则三） */
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.phone-tts-playing').forEach(el => {
          el.classList.remove('phone-tts-playing');
        });
      }
    }

    /**
     * 检查 TTS 后端是否可用
     * @returns {Promise<boolean>}
     */
    async checkAvailability() {
      const config = this.getConfig();
      try {
        const statusUrl = config.baseUrl + '/api/tts/status';
        const response = await this._fetch(statusUrl, { 
          method: 'GET', 
          timeout: 3000 
        });
        return response.ok;
      } catch (e) {
        return true; // 即使状态接口失败，TTS 可能仍可用
      }
    }

    // ==================== UI 事件绑定 ====================

    /**
     * 绑定语音气泡点击事件
     * @deprecated DOM 操作应迁移到 Renderer 层（铁则三）
     */
    bindVoiceBubbleEvents() {
      if (this._eventsBound) {
        console.log('[TTSService] 事件已绑定，跳过');
        return;
      }
      this._eventsBound = true;

      if (typeof document === 'undefined') return;

      document.addEventListener('click', (e) => {
        const voiceBubble = e.target.closest(
          '.message-detail[data-msg-type="语音"], ' +
          '.message-detail[data-msg-type="voice"], ' +
          '.message-detail .voice-bubble, ' +
          '.voice-message'
        );

        if (!voiceBubble) return;

        // 提取文本内容
        const textEl = voiceBubble.querySelector('.message-text, .voice-content');
        let text = textEl?.getAttribute('data-tts-text') || textEl?.dataset.ttsText || '';
        
        if (!text && textEl) {
          text = textEl.textContent.trim();
        }

        // 过滤时间格式
        if (/^\d{1,2}:\d{2}$/.test(text)) {
          text = voiceBubble.getAttribute('data-content') || 
                 voiceBubble.getAttribute('data-msg-content') || '';
        }

        if (!text) return;

        // 获取发送者声音
        const senderEl = voiceBubble.querySelector('.message-sender');
        const senderName = senderEl ? senderEl.textContent.trim() : '';
        const voiceId = this.getVoiceForCharacter(senderName);

        // 切换播放/停止
        if (voiceBubble.classList.contains('phone-tts-playing')) {
          this.stop();
          return;
        }

        // 播放 TTS
        this.play(text, voiceId, (state) => {
          if (state === 'loading') {
            voiceBubble.classList.add('phone-tts-loading');
            voiceBubble.classList.remove('phone-tts-playing');
          } else if (state === 'playing') {
            voiceBubble.classList.remove('phone-tts-loading');
            voiceBubble.classList.add('phone-tts-playing');
          } else {
            voiceBubble.classList.remove('phone-tts-loading', 'phone-tts-playing');
          }
        });
      });

      console.log('[TTSService] 语音气泡事件已绑定');
    }

    // ==================== 内部方法 ====================

    /**
     * 封装的 fetch 方法（支持超时）
     * @private
     */
    async _fetch(url, options = {}) {
      const timeout = options.timeout || 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw err;
      }
    }

    /**
     * 轮询播放状态
     * @private
     */
    async _pollPlaybackStatus(onStateChange) {
      const config = this.getConfig();
      const statusUrl = config.baseUrl + '/api/tts/status';

      const poll = async () => {
        try {
          const response = await this._fetch(statusUrl, { method: 'GET' });
          if (!response.ok) return;

          const status = await response.json();
          if (status && status.playing === false) {
            if (onStateChange) onStateChange('ended');
            return;
          }
          this._pollTimer = setTimeout(poll, 500);
        } catch (e) {
          if (onStateChange) onStateChange('ended');
        }
      };

      this._pollTimer = setTimeout(poll, 1000);
    }

    /**
     * 解析全局 headers
     * @private
     */
    _parseGlobalHeaders(headerString) {
      if (!headerString || typeof headerString !== 'string') return {};
      const headers = {};
      headerString.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          if (key && value) {
            headers[key] = value;
          }
        }
      });
      return headers;
    }

    /**
     * 触发事件
     * @private
     */
    _emit(event, data) {
      if (this._platform?.emit) {
        this._platform.emit(event, data);
      }
    }
  }

  // ==================== 服务注册 ====================

  // 注册到 Platform 服务容器
  if (typeof window !== 'undefined' && window.Platform) {
    window.Platform.register('tts', (platform) => new TTSService(platform));
    console.log('[TTSService] 已注册到 Platform 服务容器');
  } else {
    // Platform 尚未就绪，延迟注册
    const checkPlatform = setInterval(() => {
      if (typeof window !== 'undefined' && window.Platform) {
        window.Platform.register('tts', (platform) => new TTSService(platform));
        console.log('[TTSService] 已注册到 Platform 服务容器（延迟）');
        clearInterval(checkPlatform);
      }
    }, 100);
    
    // 5秒后放弃
    setTimeout(() => clearInterval(checkPlatform), 5000);
  }

  console.log('[Platform] TTSService 已加载');
})();
