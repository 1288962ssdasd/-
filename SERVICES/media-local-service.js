/**
 * MediaLocalService - 本地图片选择、NPC/直播封面绑定
 *
 * [铁则合规]
 * - 铁则一：数据读写通过 Schema (MediaData)
 * - 铁则三：Service 层不操作 DOM
 * - 铁则九：错误降级不阻断
 *
 * [修复内容]
 * 1. 添加 getRandomImageFromFolder() 从 IMAGES 文件夹随机获取一张图片
 * 2. 添加 getRandomImagesFromFolder(count) 从 IMAGES 文件夹随机获取多张不重复图片
 * 3. 修改 assignRandomNPCAvatars() 优先从 IMAGES 文件夹获取图片
 * 4. 添加 getRandomImageForPost() 供朋友圈/微博使用
 */
;(function () {
  'use strict';

  class MediaLocalService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._mediaData = new (window.PhoneData?.Media || function () {})(this._platform);
    }

    pickImageFile() {
      return new Promise((resolve) => {
        try {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          };
          input.click();
        } catch (e) {
          console.warn('[MediaLocalService] pickImageFile 失败:', e);
          resolve(null);
        }
      });
    }

    async addGalleryImage() {
      const url = await this.pickImageFile();
      if (!url) return null;
      return await this._mediaData.addToGallery(url);
    }

    async assignAvatar(targetId, imageUrl) {
      if (!targetId) return null;
      const url = imageUrl || (await this.pickImageFile());
      if (!url) return null;
      await this._mediaData.setAvatar(targetId, url);

      const Friends = window.PhoneData?.Friends;
      if (Friends) {
        const fd = new Friends(this._platform);
        const f = await fd.getById(targetId);
        if (f) await fd.update(targetId, { avatar: url });
      }
      return url;
    }

    /**
     * [新增] 从 IMAGES 文件夹随机获取一张图片
     * 调用 mediaData.scanImagesFolder() 获取图片列表，随机选择一张返回完整URL
     *
     * @returns {Promise<string|null>} 图片的完整URL，失败返回null
     */
    async getRandomImageFromFolder() {
      try {
        // 扫描 IMAGES 文件夹获取图片列表
        var fileList = await this._mediaData.scanImagesFolder();
        if (!fileList || fileList.length === 0) {
          console.warn('[MediaLocalService] IMAGES文件夹为空，无法获取随机图片');
          return null;
        }

        // 随机选择一张图片
        var randomIndex = Math.floor(Math.random() * fileList.length);
        var filename = fileList[randomIndex];
        var baseUrl = this._mediaData.imagesFolderUrl || './scripts/extensions/third-party/mobile/IMAGES/';

        // 拼接完整URL，确保路径正确
        var fullUrl = baseUrl + filename;
        console.log('[MediaLocalService] 随机选取图片:', filename);
        return fullUrl;
      } catch (e) {
        // [铁则九] 错误降级不阻断
        console.warn('[MediaLocalService] getRandomImageFromFolder 异常:', e);
        return null;
      }
    }

    /**
     * [新增] 从 IMAGES 文件夹随机获取多张不重复的图片
     *
     * @param {number} count - 需要的图片数量
     * @returns {Promise<string[]>} 图片完整URL数组
     */
    async getRandomImagesFromFolder(count) {
      try {
        var fileList = await this._mediaData.scanImagesFolder();
        if (!fileList || fileList.length === 0) {
          console.warn('[MediaLocalService] IMAGES文件夹为空，无法获取随机图片');
          return [];
        }

        // 如果请求数量大于文件数量，返回全部
        var actualCount = Math.min(count, fileList.length);
        var result = [];
        // 复制数组避免修改原数组
        var available = fileList.slice();

        // Fisher-Yates 洗牌算法取前 actualCount 个
        for (var i = 0; i < actualCount; i++) {
          var swapIndex = Math.floor(Math.random() * available.length);
          var filename = available[swapIndex];
          // 从可用列表中移除已选中的
          available.splice(swapIndex, 1);

          var baseUrl = this._mediaData.imagesFolderUrl || './scripts/extensions/third-party/mobile/IMAGES/';
          result.push(baseUrl + filename);
        }

        console.log('[MediaLocalService] 随机选取', result.length, '张图片');
        return result;
      } catch (e) {
        // [铁则九] 错误降级不阻断
        console.warn('[MediaLocalService] getRandomImagesFromFolder 异常:', e);
        return [];
      }
    }

    /**
     * [修复] 为NPC随机分配头像
     * 优先从 IMAGES 文件夹获取图片，如果文件夹为空再从用户相册获取
     *
     * @param {string} charId - 角色ID
     * @returns {Promise<number>} 成功分配头像的NPC数量
     */
    async assignRandomNPCAvatars(charId) {
      try {
        // [修复] 优先从 IMAGES 文件夹获取图片
        var folderImages = await this.getRandomImagesFromFolder(50);
        var useFolderImages = folderImages && folderImages.length > 0;

        if (useFolderImages) {
          console.log('[MediaLocalService] 使用IMAGES文件夹图片分配NPC头像，可用图片:', folderImages.length);
        }

        // 获取用户相册作为备选
        var gallery = [];
        if (!useFolderImages) {
          gallery = await this._mediaData.getGallery();
          console.log('[MediaLocalService] IMAGES文件夹为空，使用用户相册，可用图片:', gallery.length);
        }

        var imagePool = useFolderImages ? folderImages : gallery.map(function (img) { return img.url; });
        if (!imagePool.length) return 0;

        var NPCData = window.PhoneData?.NPC;
        if (!NPCData) return 0;
        var nd = new NPCData(this._platform);
        var npcs = await nd.getAll(charId);
        var n = 0;

        // 打乱图片池顺序，让每个NPC获得不同的图片
        var shuffled = imagePool.slice().sort(function () { return Math.random() - 0.5; });

        for (var i = 0; i < npcs.length; i++) {
          var npc = npcs[i];
          var imgUrl = shuffled[i % shuffled.length];
          if (imgUrl) {
            try {
              await this._mediaData.setAvatar(npc.id, imgUrl);
              await nd.update?.(charId, npc.id, { avatar: imgUrl, appearance: imgUrl });
              var Friends = window.PhoneData?.Friends;
              if (Friends) {
                var fd = new Friends(this._platform);
                var list = await fd.getList();
                var hit = list.find(function (f) { return f.id === npc.id || f.name === npc.name; });
                if (hit) await fd.update(hit.id, { avatar: imgUrl });
              }
              n++;
            } catch (npcErr) {
              // [铁则九] 单个NPC失败不阻断整体流程
              console.warn('[MediaLocalService] 分配NPC头像失败 (' + npc.name + '):', npcErr);
            }
          }
        }
        return n;
      } catch (e) {
        console.warn('[MediaLocalService] assignRandomNPCAvatars 失败:', e);
        return 0;
      }
    }

    /**
     * [新增] 获取随机图片供朋友圈/微博使用
     * 优先从 IMAGES 文件夹获取，如果文件夹为空则从用户相册获取
     *
     * @returns {Promise<string|null>} 图片URL，失败返回null
     */
    async getRandomImageForPost() {
      try {
        // 优先从 IMAGES 文件夹获取
        var folderUrl = await this.getRandomImageFromFolder();
        if (folderUrl) {
          console.log('[MediaLocalService] 从IMAGES文件夹获取朋友圈图片');
          return folderUrl;
        }

        // 降级：从用户相册获取
        var gallery = await this._mediaData.getGallery();
        if (gallery && gallery.length > 0) {
          var randomItem = gallery[Math.floor(Math.random() * gallery.length)];
          console.log('[MediaLocalService] 从用户相册获取朋友圈图片');
          return randomItem.url || null;
        }

        console.warn('[MediaLocalService] 无可用图片源（IMAGES文件夹和用户相册均为空）');
        return null;
      } catch (e) {
        // [铁则九] 错误降级不阻断
        console.warn('[MediaLocalService] getRandomImageForPost 异常:', e);
        return null;
      }
    }

    async getStreamCover(streamId) {
      return await this._mediaData.getAvatar('live_' + streamId);
    }

    async setStreamCover(streamId, url) {
      return await this._mediaData.setAvatar('live_' + streamId, url);
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.MediaLocal = MediaLocalService;
})();
