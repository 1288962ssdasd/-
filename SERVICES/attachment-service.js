/**
 * AttachmentService - 附件发送服务
 * 独立 Service，处理图片、文件等附件的发送
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Attachment
 *
 * 铁则合规：
 *   - 所有消息通过 MessageService 统一发送（铁则三）
 *   - 禁止直接调用 MessagesData.add() 绕过 MessageService
 *   - 不包含 DOM 操作（铁则三）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class AttachmentService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      // 通过 MessageService 统一发送，不直接调 Schema（铁则三）
      this._messageService = new (window.PhoneServices?.Message || function(){})(this._platform);
    }

    // ==================== 图片发送 ====================

    /**
     * 发送图片消息
     * @param {string} friendId - 好友ID
     * @param {File|Blob|string} source - 图片文件、Blob 或 URL
     * @param {Object} options - { width?, height?, thumbnailUrl? }
     * @returns {Promise<Object>}
     */
    async sendImage(friendId, source, options = {}) {
      try {
        let imageUrl = '';
        let width = options.width || 0;
        let height = options.height || 0;
        let thumbnailUrl = options.thumbnailUrl || '';

        // 处理不同类型的输入
        if (typeof source === 'string') {
          // 直接是 URL
          imageUrl = source;
        } else if (source instanceof File || source instanceof Blob) {
          // 文件或 Blob，尝试创建本地 URL
          imageUrl = await this._processImageFile(source);
          // 获取图片尺寸
          const dimensions = await this._getImageDimensions(imageUrl);
          width = dimensions.width;
          height = dimensions.height;
        }

        if (!imageUrl) {
          throw new Error('图片处理失败');
        }

        // 构建图片消息对象
        const imageMessage = {
          type: 'image',
          imageUrl: imageUrl,
          thumbnailUrl: thumbnailUrl || imageUrl,
          width: width,
          height: height,
          senderId: 'me',
        };

        // 交给 MessageService 统一发送（铁则三：不绕过 MessageService）
        return await this._messageService._sendImageMessage(friendId, imageMessage);
      } catch (e) {
        console.error('[AttachmentService] 发送图片失败:', e);
        throw e;
      }
    }

    /**
     * 批量发送图片
     * @param {string} friendId
     * @param {Array<File|Blob|string>} sources
     * @returns {Promise<Array<Object>>}
     */
    async sendImages(friendId, sources) {
      if (!sources || sources.length === 0) {
        throw new Error('没有图片需要发送');
      }

      const results = [];
      for (const source of sources) {
        try {
          const result = await this.sendImage(friendId, source);
          results.push(result);
        } catch (e) {
          console.warn('[AttachmentService] 批量发送中某张图片失败:', e);
          // 继续发送下一张，不阻断（铁则九）
        }
      }
      return results;
    }

    // ==================== 文件发送 ====================

    /**
     * 发送文件消息
     * @param {string} friendId - 好友ID
     * @param {File} file - 文件对象
     * @returns {Promise<Object>}
     */
    async sendFile(friendId, file) {
      try {
        if (!file) {
          throw new Error('文件不能为空');
        }

        // 处理文件（上传或创建本地 URL）
        const fileUrl = await this._processFile(file);

        // 构建文件消息对象
        const fileMessage = {
          type: 'file',
          fileUrl: fileUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          senderId: 'me',
        };

        // 交给 MessageService 统一发送
        return await this._messageService._sendFileMessage(friendId, fileMessage);
      } catch (e) {
        console.error('[AttachmentService] 发送文件失败:', e);
        throw e;
      }
    }

    // ==================== 语音文件发送 ====================

    /**
     * 发送语音文件（带音频数据）
     * @param {string} friendId
     * @param {Blob|File} audioBlob - 音频 Blob
     * @param {number} duration - 时长（秒）
     * @param {string} text - 可选的语音转文字内容
     * @returns {Promise<Object>}
     */
    async sendVoiceWithAudio(friendId, audioBlob, duration, text = '') {
      try {
        if (!audioBlob) {
          throw new Error('音频数据不能为空');
        }

        // 处理音频文件
        const audioUrl = await this._processAudio(audioBlob);

        // 构建语音消息对象
        const voiceMessage = {
          type: 'voice',
          duration: Math.round(duration),
          audioUrl: audioUrl,
          text: text,
          senderId: 'me',
        };

        // 交给 MessageService 统一发送
        return await this._messageService._sendVoiceMessage(friendId, voiceMessage);
      } catch (e) {
        console.error('[AttachmentService] 发送语音失败:', e);
        throw e;
      }
    }

    // ==================== 视频发送 ====================

    /**
     * 发送视频消息
     * @param {string} friendId
     * @param {File|Blob|string} source - 视频文件或 URL
     * @param {Object} options - { duration?, thumbnailUrl? }
     * @returns {Promise<Object>}
     */
    async sendVideo(friendId, source, options = {}) {
      try {
        let videoUrl = '';
        let duration = options.duration || 0;

        if (typeof source === 'string') {
          videoUrl = source;
        } else if (source instanceof File || source instanceof Blob) {
          videoUrl = await this._processVideo(source);
        }

        if (!videoUrl) {
          throw new Error('视频处理失败');
        }

        const videoMessage = {
          type: 'video',
          videoUrl: videoUrl,
          duration: duration,
          thumbnailUrl: options.thumbnailUrl || '',
          senderId: 'me',
        };

        return await this._messageService._sendVideoMessage(friendId, videoMessage);
      } catch (e) {
        console.error('[AttachmentService] 发送视频失败:', e);
        throw e;
      }
    }

    // ==================== 位置发送 ====================

    /**
     * 发送位置消息
     * @param {string} friendId
     * @param {Object} location - { latitude, longitude, name?, address? }
     * @returns {Promise<Object>}
     */
    async sendLocation(friendId, location) {
      try {
        if (!location || !location.latitude || !location.longitude) {
          throw new Error('位置信息不完整');
        }

        const locationMessage = {
          type: 'location',
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name || '位置分享',
          address: location.address || '',
          senderId: 'me',
        };

        return await this._messageService._sendLocationMessage(friendId, locationMessage);
      } catch (e) {
        console.error('[AttachmentService] 发送位置失败:', e);
        throw e;
      }
    }

    // ==================== 内部处理方法 ====================

    /**
     * 处理图片文件
     * @param {File|Blob} file
     * @returns {Promise<string>} 图片 URL
     */
    async _processImageFile(file) {
      // 创建本地 Blob URL
      return URL.createObjectURL(file);
    }

    /**
     * 获取图片尺寸
     * @param {string} url
     * @returns {Promise<{width: number, height: number}>}
     */
    async _getImageDimensions(url) {
      try {
        // 使用 Platform 适配器获取图片信息（铁则三：Service 不直接操作 DOM）
        // 降级方案：返回默认尺寸
        if (this._platform?.request) {
          try {
            const resp = await this._platform.request(url, { method: 'HEAD' });
            // 无法从 HEAD 获取尺寸，返回默认值
          } catch (e) {
            // URL 可能不可达，忽略
          }
        }
        return { width: 0, height: 0 };
      } catch (e) {
        console.warn('[AttachmentService] _getImageDimensions 失败:', e);
        return { width: 0, height: 0 };
      }
    }

    /**
     * 处理文件
     * @param {File} file
     * @returns {Promise<string>} 文件 URL
     */
    async _processFile(file) {
      // 创建本地 Blob URL
      return URL.createObjectURL(file);
    }

    /**
     * 处理音频
     * @param {Blob} audioBlob
     * @returns {Promise<string>} 音频 URL
     */
    async _processAudio(audioBlob) {
      return URL.createObjectURL(audioBlob);
    }

    /**
     * 处理视频
     * @param {File|Blob} videoFile
     * @returns {Promise<string>} 视频 URL
     */
    async _processVideo(videoFile) {
      return URL.createObjectURL(videoFile);
    }
  }

  // 暴露到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Attachment = AttachmentService;

  console.log('[Service] AttachmentService 已加载');
})();
