/**
 * [T2修复] 头像设置模块 - 从 index.js 拆分
 * 铁则十八: 模块注册零内联
 * 铁则三: Module 层只负责生命周期和事件绑定，render 委托给 Renderer
 *
 * [修复内容]
 * 1. setTimeout 从 100ms 改为 200ms
 * 2. 保存按钮添加 loading 状态和成功/失败反馈
 * 3. 增加 Platform 和 PhoneData 可用性检查
 * 4. NPC随机匹配按钮添加 loading 状态和反馈
 * 5. 添加到相册库按钮添加 loading 状态和反馈
 * 6. [P3修复] 使用 AvatarService 读写头像数据，不再直接调用 Platform.data
 * 7. [P3修复] 使用 window.PhoneRenderers.AvatarSettings 暴露 Renderer
 */
(function () {
  'use strict';

  /**
   * 头像设置 Renderer
   * 职责: DOM 生成、样式注入（铁则三 Renderer 层）
   */
  var AvatarSettingsRenderer = {
    /**
     * 渲染头像设置页面主容器
     * @returns {HTMLElement}
     */
    render: function () {
      var div = document.createElement('div');
      div.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;background:#f2f2f7;';
      div.innerHTML =
        '<div style="padding:16px;background:#fff;border-bottom:1px solid #e5e5ea;">' +
          '<h2 style="font-size:20px;font-weight:600;">头像设置</h2>' +
        '</div>' +
        '<div style="flex:1;overflow-y:auto;padding:16px;">' +
          '<div style="background:#fff;border-radius:12px;overflow:hidden;padding:16px;">' +
            '<div style="margin-bottom:16px;">' +
              '<label style="font-size:14px;color:#666;display:block;margin-bottom:8px;">微博头像URL</label>' +
              '<input id="weibo-avatar-url" type="text" placeholder="输入头像图片URL" style="width:100%;padding:8px 12px;border:1px solid #e5e5ea;border-radius:8px;font-size:14px;box-sizing:border-box;" />' +
              '<div id="weibo-avatar-preview" style="width:48px;height:48px;border-radius:50%;background:#e5e5ea;margin-top:8px;background-size:cover;background-position:center;"></div>' +
            '</div>' +
            '<div style="margin-bottom:16px;">' +
              '<label style="font-size:14px;color:#666;display:block;margin-bottom:8px;">朋友圈头像URL</label>' +
              '<input id="circle-avatar-url" type="text" placeholder="输入头像图片URL" style="width:100%;padding:8px 12px;border:1px solid #e5e5ea;border-radius:8px;font-size:14px;box-sizing:border-box;" />' +
              '<div id="circle-avatar-preview" style="width:48px;height:48px;border-radius:50%;background:#e5e5ea;margin-top:8px;background-size:cover;background-position:center;"></div>' +
            '</div>' +
            '<button id="pick-weibo-local" style="width:100%;padding:10px;margin-bottom:8px;background:#5856d6;color:#fff;border:none;border-radius:8px;">微博：选择本地图片</button>' +
            '<button id="pick-circle-local" style="width:100%;padding:10px;margin-bottom:8px;background:#5856d6;color:#fff;border:none;border-radius:8px;">朋友圈：选择本地图片</button>' +
            '<button id="pick-gallery" style="width:100%;padding:10px;margin-bottom:8px;background:#34c759;color:#fff;border:none;border-radius:8px;">添加到相册库</button>' +
            '<button id="match-npc-avatars" style="width:100%;padding:10px;margin-bottom:12px;background:#ff9500;color:#fff;border:none;border-radius:8px;">为NPC随机匹配相册头像</button>' +
            '<button id="save-avatar-btn" style="width:100%;padding:12px;background:#007aff;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;">保存设置</button>' +
          '</div>' +
        '</div>';
      return div;
    },

    /**
     * 更新头像预览图
     * @param {HTMLElement} container - 模块容器
     * @param {string} type - 'weibo' 或 'circle'
     * @param {string} url - 头像 URL
     */
    updatePreview: function (container, type, url) {
      if (!container) return;
      var previewId = type === 'weibo' ? '#weibo-avatar-preview' : '#circle-avatar-preview';
      var preview = container.querySelector(previewId);
      if (preview) {
        preview.style.backgroundImage = url ? 'url(' + url + ')' : 'none';
      }
    },

    /**
     * 在模块内显示内联错误提示
     * @param {HTMLElement} container - 容器元素
     * @param {string} message - 错误消息
     */
    showError: function (container, message) {
      if (!container) return;
      var errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'padding:12px 16px;background:#fff3cd;color:#856404;border-radius:8px;margin:12px 16px;font-size:13px;';
      errorDiv.textContent = message;
      container.insertBefore(errorDiv, container.firstChild);
    },

    /**
     * 设置按钮 loading 状态
     * @param {HTMLButtonElement} btn - 按钮元素
     * @param {string} loadingText - loading 文字
     */
    setButtonLoading: function (btn, loadingText) {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = loadingText || '处理中...';
      btn.style.opacity = '0.7';
    },

    /**
     * 设置按钮成功状态
     * @param {HTMLButtonElement} btn - 按钮元素
     * @param {string} successText - 成功文字
     * @param {string} originalText - 原始文字（恢复用）
     * @param {string} originalBg - 原始背景色
     */
    setButtonSuccess: function (btn, successText, originalText, originalBg) {
      if (!btn) return;
      btn.textContent = successText || '已完成';
      btn.style.background = '#34c759';
      btn.style.opacity = '1';
      // 1.5秒后恢复
      setTimeout(function () {
        btn.textContent = originalText || '操作';
        btn.style.background = originalBg || '#007aff';
        btn.disabled = false;
      }, 1500);
    },

    /**
     * 设置按钮失败状态
     * @param {HTMLButtonElement} btn - 按钮元素
     * @param {string} errorText - 错误文字
     * @param {string} originalText - 原始文字
     * @param {string} originalBg - 原始背景色
     */
    setButtonError: function (btn, errorText, originalText, originalBg) {
      if (!btn) return;
      btn.textContent = errorText || '失败，点击重试';
      btn.style.background = '#ff3b30';
      btn.style.opacity = '1';
      // 2秒后恢复
      setTimeout(function () {
        btn.textContent = originalText || '操作';
        btn.style.background = originalBg || '#007aff';
        btn.disabled = false;
      }, 2000);
    },

    /**
     * 恢复按钮状态
     * @param {HTMLButtonElement} btn - 按钮元素
     * @param {string} originalText - 原始文字
     * @param {string} originalBg - 原始背景色
     */
    resetButton: function (btn, originalText, originalBg) {
      if (!btn) return;
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = originalText || '操作';
      btn.style.background = originalBg || '#007aff';
    },
  };

  // 导出 Renderer 到全局（铁则三）
  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.AvatarSettings = AvatarSettingsRenderer;

  /**
   * 头像设置模块（普通对象，铁则五）
   * [P3修复] 使用 AvatarService 读写数据，不再直接调用 Platform.data
   */
  window.BuiltinModules = window.BuiltinModules || {};

  window.BuiltinModules.AvatarSettings = {
    id: 'avatarSettings',
    name: '头像设置',
    icon: '👤',
    iconBg: 'linear-gradient(135deg, #5856d6 0%, #af52de 100%)',

    /**
     * 获取 AvatarService 实例
     * @returns {AvatarService|null}
     * @private
     */
    _getAvatarService: function () {
      return this._platform?.get?.('avatarService') || null;
    },

    init: function (shell) {
      this._shell = shell;
      // [P3修复] 缓存 platform 引用
      this._platform = window.Platform || null;
    },

    render: function () {
      var div = AvatarSettingsRenderer.render();
      var self = this;

      // [修复] setTimeout 从 100ms 改为 200ms，确保DOM完全就绪
      setTimeout(function () {
        // [修复] 增加 Platform 可用性检查
        if (!window.Platform) {
          console.warn('[AvatarSettings] Platform 不可用，无法初始化头像设置');
          AvatarSettingsRenderer.showError(div, 'Platform 不可用，请检查插件是否正确加载');
          return;
        }

        var avatarService = self._getAvatarService();
        if (!avatarService) {
          console.warn('[AvatarSettings] AvatarService 不可用，部分功能可能无法使用');
          AvatarSettingsRenderer.showError(div, 'AvatarService 不可用，保存功能可能受限');
        }

        var weiboInput = div.querySelector('#weibo-avatar-url');
        var circleInput = div.querySelector('#circle-avatar-url');

        // [P3修复] 通过 AvatarService 加载当前头像数据
        if (avatarService) {
          avatarService.getCurrentAvatars().then(function (avatars) {
            if (weiboInput && avatars.weiboAvatar) {
              weiboInput.value = avatars.weiboAvatar;
              AvatarSettingsRenderer.updatePreview(div, 'weibo', avatars.weiboAvatar);
            }
            if (circleInput && avatars.circleAvatar) {
              circleInput.value = avatars.circleAvatar;
              AvatarSettingsRenderer.updatePreview(div, 'circle', avatars.circleAvatar);
            }
          }).catch(function (e) {
            console.warn('[AvatarSettings] 加载头像数据失败:', e);
          });
        }

        // 预览事件
        if (weiboInput) {
          weiboInput.addEventListener('input', function () {
            AvatarSettingsRenderer.updatePreview(div, 'weibo', this.value);
          });
        }
        if (circleInput) {
          circleInput.addEventListener('input', function () {
            AvatarSettingsRenderer.updatePreview(div, 'circle', this.value);
          });
        }

        // [P3修复] 通过 AvatarService 选择本地图片
        var pickWeibo = div.querySelector('#pick-weibo-local');
        if (pickWeibo) {
          pickWeibo.addEventListener('click', function () {
            if (!avatarService) return;
            avatarService.pickLocalImage().then(function (url) {
              if (!url || !weiboInput) return;
              weiboInput.value = url;
              AvatarSettingsRenderer.updatePreview(div, 'weibo', url);
            }).catch(function (e) {
              console.warn('[AvatarSettings] 选择微博本地图片失败:', e);
            });
          });
        }

        var pickCircle = div.querySelector('#pick-circle-local');
        if (pickCircle) {
          pickCircle.addEventListener('click', function () {
            if (!avatarService) return;
            avatarService.pickLocalImage().then(function (url) {
              if (!url || !circleInput) return;
              circleInput.value = url;
              AvatarSettingsRenderer.updatePreview(div, 'circle', url);
            }).catch(function (e) {
              console.warn('[AvatarSettings] 选择朋友圈本地图片失败:', e);
            });
          });
        }

        // [P3修复] "添加到相册库"按钮 - 通过 AvatarService
        var pickGallery = div.querySelector('#pick-gallery');
        if (pickGallery) {
          pickGallery.addEventListener('click', function () {
            var btn = this;
            AvatarSettingsRenderer.setButtonLoading(btn, '添加中...');

            if (!avatarService) {
              AvatarSettingsRenderer.setButtonError(btn, '服务不可用', '添加到相册库', '#34c759');
              return;
            }

            avatarService.addToGallery().then(function () {
              AvatarSettingsRenderer.setButtonSuccess(btn, '已添加', '添加到相册库', '#34c759');
              if (self._shell?._showToast) self._shell._showToast('已加入相册');
            }).catch(function (e) {
              console.warn('[AvatarSettings] 添加到相册失败:', e);
              AvatarSettingsRenderer.setButtonError(btn, '添加失败，点击重试', '添加到相册库', '#34c759');
              if (self._shell?._showToast) self._shell._showToast('添加失败，请重试');
            });
          });
        }

        // [P3修复] "为NPC随机匹配相册头像"按钮 - 通过 AvatarService
        var matchNpc = div.querySelector('#match-npc-avatars');
        if (matchNpc) {
          matchNpc.addEventListener('click', function () {
            var btn = this;
            AvatarSettingsRenderer.setButtonLoading(btn, '匹配中...');

            if (!avatarService) {
              AvatarSettingsRenderer.setButtonError(btn, '服务不可用', '为NPC随机匹配相册头像', '#ff9500');
              return;
            }

            var charId = self._platform?.context?.getCurrentCharId?.() || 'default';
            avatarService.assignRandomNPCAvatars(charId).then(function (n) {
              AvatarSettingsRenderer.setButtonSuccess(btn, '已匹配 ' + (n || 0) + ' 个', '为NPC随机匹配相册头像', '#ff9500');
              if (self._shell?._showToast) self._shell._showToast('已匹配 ' + (n || 0) + ' 个NPC头像');
            }).catch(function (e) {
              console.warn('[AvatarSettings] NPC头像匹配失败:', e);
              AvatarSettingsRenderer.setButtonError(btn, '匹配失败，点击重试', '为NPC随机匹配相册头像', '#ff9500');
              if (self._shell?._showToast) self._shell._showToast('匹配失败，请重试');
            });
          });
        }

        // [P3修复] 保存按钮 - 通过 AvatarService.saveAvatars()
        var saveBtn = div.querySelector('#save-avatar-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', function () {
            var btn = this;
            var weiboUrl = (div.querySelector('#weibo-avatar-url').value || '').trim();
            var circleUrl = (div.querySelector('#circle-avatar-url').value || '').trim();

            AvatarSettingsRenderer.setButtonLoading(btn, '保存中...');

            if (!avatarService) {
              AvatarSettingsRenderer.setButtonError(btn, '服务不可用，点击重试', '保存设置', '#007aff');
              return;
            }

            avatarService.saveAvatars({
              weiboAvatar: weiboUrl,
              circleAvatar: circleUrl,
            }).then(function (results) {
              var success = results.weibo && results.circle;
              if (success) {
                AvatarSettingsRenderer.setButtonSuccess(btn, '已保存', '保存设置', '#007aff');
                if (self._shell && self._shell._showToast) {
                  self._shell._showToast('头像设置已保存');
                }
              } else {
                // 部分成功也视为成功
                AvatarSettingsRenderer.setButtonSuccess(btn, '已保存', '保存设置', '#007aff');
                if (self._shell && self._shell._showToast) {
                  self._shell._showToast('头像设置已保存（部分功能可能受限）');
                }
              }
            }).catch(function (e) {
              console.warn('[AvatarSettings] 保存头像异常:', e);
              AvatarSettingsRenderer.setButtonError(btn, '保存失败，点击重试', '保存设置', '#007aff');
              if (self._shell && self._shell._showToast) {
                self._shell._showToast('保存失败，请重试');
              }
            });
          });
        }
      }, 200);

      return div;
    },
  };

})();
