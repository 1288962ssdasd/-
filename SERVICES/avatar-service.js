/**
 * AvatarService - 头像管理服务
 * 统一头像读写逻辑，从 avatar-settings-module 中提取
 *
 * 铁则合规：
 *   - 数据读写通过 Schema（铁则一）
 *   - Service 无状态，通过 Platform 容器管理（铁则二十）
 *   - try/catch 错误处理降级不阻断（铁则九）
 *   - 发射事件通知数据变更（铁则三）
 *
 * @version 1.0.0
 */

;(function () {
  'use strict';

  class AvatarService {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 获取头像 ====================

    /**
     * 获取当前微博头像 URL
     * @returns {Promise<string>} 头像 URL
     */
    async getWeiboAvatar() {
      try {
        var weiboAccount = await this._platform.data('weibo', 'account', {});
        return weiboAccount?.avatar || '';
      } catch (e) {
        console.warn('[AvatarService] 获取微博头像失败:', e);
        return '';
      }
    }

    /**
     * 获取当前朋友圈头像 URL
     * @returns {Promise<string>} 头像 URL
     */
    async getCircleAvatar() {
      try {
        var avatar = await this._platform.data('friendsCircle', 'myAvatar', '');
        return avatar || '';
      } catch (e) {
        console.warn('[AvatarService] 获取朋友圈头像失败:', e);
        return '';
      }
    }

    /**
     * 获取所有当前头像数据
     * @returns {Promise<{weiboAvatar: string, circleAvatar: string}>}
     */
    async getCurrentAvatars() {
      try {
        var results = await Promise.all([
          this.getWeiboAvatar(),
          this.getCircleAvatar(),
        ]);
        return {
          weiboAvatar: results[0],
          circleAvatar: results[1],
        };
      } catch (e) {
        console.warn('[AvatarService] 获取头像数据失败:', e);
        return { weiboAvatar: '', circleAvatar: '' };
      }
    }

    // ==================== 设置头像 ====================

    /**
     * 保存微博头像（通过 WeiboService）
     * @param {string} url - 头像 CDN URL
     * @returns {Promise<boolean>} 是否成功
     */
    async setWeiboAvatar(url) {
      try {
        var weiboService = this._platform?.get?.('weiboService');
        if (weiboService?.getUserStats && weiboService?.updateUserStats) {
          var stats = await weiboService.getUserStats();
          stats.avatar = url;
          await weiboService.updateUserStats(stats);
          this._platform.emit('avatar:updated', {
            id: 'weibo-avatar',
            type: 'avatar',
            data: { domain: 'weibo', url: url },
            timestamp: Date.now(),
            source: 'AvatarService',
          });
          return true;
        } else {
          console.warn('[AvatarService] weiboService 不可用');
          return false;
        }
      } catch (e) {
        console.warn('[AvatarService] 保存微博头像失败:', e);
        return false;
      }
    }

    /**
     * 保存朋友圈头像（通过 FriendsCircleService）
     * @param {string} url - 头像 CDN URL
     * @returns {Promise<boolean>} 是否成功
     */
    async setCircleAvatar(url) {
      try {
        var friendsCircleService = this._platform?.get?.('friendsCircleService');
        if (friendsCircleService?.setMyAvatar) {
          await friendsCircleService.setMyAvatar(url);
          this._platform.emit('avatar:updated', {
            id: 'circle-avatar',
            type: 'avatar',
            data: { domain: 'friendsCircle', url: url },
            timestamp: Date.now(),
            source: 'AvatarService',
          });
          return true;
        } else {
          console.warn('[AvatarService] friendsCircleService 不可用');
          return false;
        }
      } catch (e) {
        console.warn('[AvatarService] 保存朋友圈头像失败:', e);
        return false;
      }
    }

    /**
     * 批量保存头像设置
     * @param {Object} avatars - { weiboAvatar, circleAvatar }
     * @returns {Promise<{weibo: boolean, circle: boolean}>}
     */
    async saveAvatars(avatars) {
      var results = await Promise.all([
        this.setWeiboAvatar(avatars.weiboAvatar || ''),
        this.setCircleAvatar(avatars.circleAvatar || ''),
      ]);
      return { weibo: results[0], circle: results[1] };
    }

    // ==================== 头像列表管理 ====================

    /**
     * 获取可用头像列表（从相册库）
     * @returns {Promise<Array>} 头像 URL 列表
     */
    async getAvailableAvatars() {
      try {
        var mediaService = this._platform?.get?.('mediaLocalService');
        if (mediaService?.getGalleryImages) {
          return await mediaService.getGalleryImages();
        }
        return [];
      } catch (e) {
        console.warn('[AvatarService] 获取头像列表失败:', e);
        return [];
      }
    }

    /**
     * 添加图片到相册库
     * @returns {Promise<boolean>}
     */
    async addToGallery() {
      try {
        var mediaService = this._platform?.get?.('mediaLocalService');
        if (mediaService?.addGalleryImage) {
          await mediaService.addGalleryImage();
          return true;
        }
        return false;
      } catch (e) {
        console.warn('[AvatarService] 添加到相册失败:', e);
        return false;
      }
    }

    /**
     * 选择本地图片
     * @returns {Promise<string|null>} 图片 URL
     */
    async pickLocalImage() {
      try {
        var mediaService = this._platform?.get?.('mediaLocalService');
        if (mediaService?.pickImageFile) {
          return await mediaService.pickImageFile();
        }
        return null;
      } catch (e) {
        console.warn('[AvatarService] 选择本地图片失败:', e);
        return null;
      }
    }

    /**
     * 为 NPC 随机匹配相册头像
     * @param {string} charId - 角色 ID
     * @returns {Promise<number>} 匹配数量
     */
    async assignRandomNPCAvatars(charId) {
      try {
        var mediaService = this._platform?.get?.('mediaLocalService');
        if (mediaService?.assignRandomNPCAvatars) {
          var cid = charId || this._platform?.context?.getCurrentCharId?.() || 'default';
          return await mediaService.assignRandomNPCAvatars(cid);
        }
        return 0;
      } catch (e) {
        console.warn('[AvatarService] NPC头像匹配失败:', e);
        return 0;
      }
    }
  }

  // 全局挂载
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Avatar = AvatarService;

  console.log('[Service] AvatarService 已加载');
})();
