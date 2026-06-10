/**
 * MediaData - 本地图片/头像映射
 *
 * [铁则合规]
 * - 铁则一：数据读写通过 Schema
 * - 铁则九：错误降级不阻断
 *
 * [v3.7 修复]
 * - 废弃 fetch 扫描目录方案（ST服务器不提供目录列表）
 * - 改用构建时硬编码文件清单，零网络请求
 * - 新增按分类获取：getAvatarFiles / getPostFiles / getCoverFiles / getStickerFiles
 */

;(function () {
  'use strict';

  var DOMAIN = 'media';
  var IMAGES_FOLDER_URL = './scripts/extensions/third-party/mobile/IMAGES/';

  // ============================================================
  // 构建时生成的文件清单（由 scripts/build-image-manifest.sh 自动更新）
  // 手动新增图片后，需重新运行该脚本或手动在此追加文件名
  // ============================================================

  var AVATAR_FILES = [
    'хд┤хГП01.webp','хд┤хГП02.webp','хд┤хГП03.webp','хд┤хГП04.webp','хд┤хГП05.webp',
    'хд┤хГП06.webp','хд┤хГП07.webp','хд┤хГП08.webp','хд┤хГП09.webp','хд┤хГП10.webp',
    'хд┤хГП11.webp','хд┤хГП12.webp','хд┤хГП13.webp','хд┤хГП14.webp','хд┤хГП15.webp',
    'хд┤хГП16.webp','хд┤хГП17.webp','хд┤хГП18.webp','хд┤хГП19.webp','хд┤хГП20.webp',
    'хд┤хГП21.webp','хд┤хГП22.webp','хд┤хГП23.webp','хд┤хГП24.webp','хд┤хГП25.webp',
    'хд┤хГП26.webp','хд┤хГП27.webp','хд┤хГП28.webp','хд┤хГП29.webp','хд┤хГП30.webp',
    'хд┤хГП31.webp','хд┤хГП32.webp','хд┤хГП33.webp','хд┤хГП34.webp','хд┤хГП35.webp',
    'хд┤хГП36.webp','хд┤хГП37.webp','хд┤хГП38.webp','хд┤хГП39.webp','хд┤хГП40.webp',
    'хд┤хГП41.webp','хд┤хГП42.webp','хд┤хГП43.webp','хд┤хГП44.webp','хд┤хГП45.webp',
    'хд┤хГП46.webp','хд┤хГП47.webp','хд┤хГП48.webp','хд┤хГП49.webp','хд┤хГП50.webp',
    'хд┤хГП51.webp','хд┤хГП52.webp','хд┤хГП53.webp','хд┤хГП54.webp','хд┤хГП55.webp',
    'хд┤хГП56.webp','хд┤хГП57.webp','хд┤хГП58.webp','хд┤хГП59.webp','хд┤хГП60.webp',
    'хд┤хГП61.webp','хд┤хГП62.webp','хд┤хГП63.webp'
  ];

  var COVER_FILES = [
    '16ac4c7c18e5afe91d06be827f6de29a_720.jpg',
    '49f85c6e0289ced69c39e56eaee575fe_720.jpg',
    'e2f1d2a60f2739eb819db296762ae4da_720.jpg'
  ];

  var POST_FILES = [
    '16ac4c7c18e5afe91d06be827f6de29a_720.jpg',
    '49f85c6e0289ced69c39e56eaee575fe_720.jpg',
    'e2f1d2a60f2739eb819db296762ae4da_720.jpg',
    'qasebg_ч╗УцЮЬ.jpg',
    'redpack_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 2_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 3_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 4_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 5_ч╗УцЮЬ.png',
    '6eyt6n_ч╗УцЮЬ.gif','8kvr4u_ч╗УцЮЬ.gif','aotnxp_ч╗УцЮЬ.gif','au4ay5_ч╗УцЮЬ.gif',
    'emzckz_ч╗УцЮЬ.gif','hoghwb_ч╗УцЮЬ.gif','ivtswg_ч╗УцЮЬ.gif','kin0oj_ч╗УцЮЬ.gif',
    'kv2ubl_ч╗УцЮЬ.gif','l9nqv0_ч╗УцЮЬ.gif','lgply8_ч╗УцЮЬ.gif','s10h5m_ч╗УцЮЬ.gif',
    'xigzwa_ч╗УцЮЬ.gif','y7px4h_ч╗УцЮЬ.gif','z2sxmv_ч╗УцЮЬ.gif','zjlr8e_ч╗УцЮЬ.gif',
    'хд┤хГП01.webp','хд┤хГП02.webp','хд┤хГП03.webp','хд┤хГП04.webp','хд┤хГП05.webp',
    'хд┤хГП06.webp','хд┤хГП07.webp','хд┤хГП08.webp','хд┤хГП09.webp','хд┤хГП10.webp',
    'хд┤хГП11.webp','хд┤хГП12.webp','хд┤хГП13.webp','хд┤хГП14.webp','хд┤хГП15.webp',
    'хд┤хГП16.webp','хд┤хГП17.webp','хд┤хГП18.webp','хд┤хГП19.webp','хд┤хГП20.webp',
    'хд┤хГП21.webp','хд┤хГП22.webp','хд┤хГП23.webp','хд┤хГП24.webp','хд┤хГП25.webp',
    'хд┤хГП26.webp','хд┤хГП27.webp','хд┤хГП28.webp','хд┤хГП29.webp','хд┤хГП30.webp',
    'хд┤хГП31.webp','хд┤хГП32.webp','хд┤хГП33.webp','хд┤хГП34.webp','хд┤хГП35.webp',
    'хд┤хГП36.webp','хд┤хГП37.webp','хд┤хГП38.webp','хд┤хГП39.webp','хд┤хГП40.webp',
    'хд┤хГП41.webp','хд┤хГП42.webp','хд┤хГП43.webp','хд┤хГП44.webp','хд┤хГП45.webp',
    'хд┤хГП46.webp','хд┤хГП47.webp','хд┤хГП48.webp','хд┤хГП49.webp','хд┤хГП50.webp',
    'хд┤хГП51.webp','хд┤хГП52.webp','хд┤хГП53.webp','хд┤хГП54.webp','хд┤хГП55.webp',
    'хд┤хГП56.webp','хд┤хГП57.webp','хд┤хГП58.webp','хд┤хГП59.webp','хд┤хГП60.webp',
    'хд┤хГП61.webp','хд┤хГП62.webp','хд┤хГП63.webp'
  ];

  var STICKER_FILES = [
    'qasebg_ч╗УцЮЬ.jpg',
    'redpack_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 2_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 3_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 4_ч╗УцЮЬ.png',
    '╤Е╨лтХЫ╤ЕтЦТ╨Т 5_ч╗УцЮЬ.png',
    '6eyt6n_ч╗УцЮЬ.gif','8kvr4u_ч╗УцЮЬ.gif','aotnxp_ч╗УцЮЬ.gif','au4ay5_ч╗УцЮЬ.gif',
    'emzckz_ч╗УцЮЬ.gif','hoghwb_ч╗УцЮЬ.gif','ivtswg_ч╗УцЮЬ.gif','kin0oj_ч╗УцЮЬ.gif',
    'kv2ubl_ч╗УцЮЬ.gif','l9nqv0_ч╗УцЮЬ.gif','lgply8_ч╗УцЮЬ.gif','s10h5m_ч╗УцЮЬ.gif',
    'xigzwa_ч╗УцЮЬ.gif','y7px4h_ч╗УцЮЬ.gif','z2sxmv_ч╗УцЮЬ.gif','zjlr8e_ч╗УцЮЬ.gif'
  ];

  // 合并全部文件（带子目录前缀，兼容旧接口）
  var ALL_IMAGE_FILES = [];
  AVATAR_FILES.forEach(function (f) { ALL_IMAGE_FILES.push('avatars/' + f); });
  COVER_FILES.forEach(function (f) { ALL_IMAGE_FILES.push('covers/' + f); });
  POST_FILES.forEach(function (f) { ALL_IMAGE_FILES.push('posts/' + f); });
  STICKER_FILES.forEach(function (f) { ALL_IMAGE_FILES.push('stickers/' + f); });

  // ============================================================

  class MediaData {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this.imagesFolderUrl = IMAGES_FOLDER_URL;
    }

    // ==================== 相册 ====================

    async getGallery() {
      return await this._get('gallery', []);
    }

    async addToGallery(dataUrl, name) {
      var gallery = await this.getGallery();
      var item = { id: 'img_' + Date.now(), url: dataUrl, name: name || '', addedAt: Date.now() };
      gallery.unshift(item);
      if (gallery.length > 50) gallery.length = 50;
      await this._set('gallery', gallery);
      return item;
    }

    // ==================== 头像映射 ====================

    async getAvatarMap() {
      return await this._get('avatarMap', {});
    }

    async setAvatar(targetId, dataUrl) {
      var map = await this.getAvatarMap();
      map[targetId] = dataUrl;
      await this._set('avatarMap', map);
      return true;
    }

    async getAvatar(targetId) {
      var map = await this.getAvatarMap();
      return map[targetId] || null;
    }

    // ==================== 文件清单（硬编码，零网络请求） ====================

    /**
     * 获取全部图片文件列表（带子目录前缀）
     * 兼容旧接口 scanImagesFolder()
     * @returns {string[]} 如 ['avatars/xx.webp', 'posts/yy.jpg']
     */
    scanImagesFolder() {
      console.log('[MediaData] 返回硬编码清单:', ALL_IMAGE_FILES.length, '个文件');
      return ALL_IMAGE_FILES.slice();
    }

    /**
     * 获取头像文件列表
     * @returns {string[]} 文件名数组（不含前缀）
     */
    getAvatarFiles() {
      return AVATAR_FILES.slice();
    }

    /**
     * 获取封面文件列表
     * @returns {string[]} 文件名数组（不含前缀）
     */
    getCoverFiles() {
      return COVER_FILES.slice();
    }

    /**
     * 获取朋友圈/帖子图片文件列表
     * @returns {string[]} 文件名数组（不含前缀）
     */
    getPostFiles() {
      return POST_FILES.slice();
    }

    /**
     * 获取贴纸文件列表
     * @returns {string[]} 文件名数组（不含前缀）
     */
    getStickerFiles() {
      return STICKER_FILES.slice();
    }

    /**
     * 获取缓存的 IMAGES 文件列表（兼容旧接口）
     */
    async getCachedImagesFileList() {
      return ALL_IMAGE_FILES.slice();
    }

    // ==================== 内部方法 ====================

    async _get(key, def) {
      if (!this._platform?.data) return def;
      var v = await this._platform.data(DOMAIN, key, def);
      return v == null ? def : v;
    }

    async _set(key, val) {
      if (!this._platform?.setData) return false;
      await this._platform.setData(DOMAIN, key, val);
      return true;
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Media = MediaData;

  console.log('[Schema] MediaData 已加载（硬编码清单: ' + ALL_IMAGE_FILES.length + ' 个文件）');
})();
