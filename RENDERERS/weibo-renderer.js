/**
 * @layer Renderer
 * @file   weibo-renderer.js
 *
 * 职责: 微博 UI 渲染 - 首页、热搜榜、消息、个人资料页
 * 禁止: 包含业务逻辑、调用 Service
 *
 * 铁则合规:
 *   - 铁则三: Module 的 render() 不直接拼接 HTML
 *   - 铁则十九: Module 禁止内联超 20 行 HTML
 *   - 铁则二十一: CSS 类名使用 weibo- 前缀
 */

;(function () {
  'use strict';

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    hot: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 3-4 3-7 .5 2 1.5 3 3 3s2.5-1 3-3z"/></svg>',
    message: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    profile: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FFF" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    repost: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    like: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    likeActive: '<svg viewBox="0 0 24 24" width="16" height="16" fill="#E6162D" stroke="#E6162D" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    defaultAvatar: '<svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="18" fill="#E0E0E0"/><circle cx="18" cy="14" r="5" fill="#BDBDBD"/><ellipse cx="18" cy="28" rx="9" ry="7" fill="#BDBDBD"/></svg>',
    defaultAvatarLarge: '<svg viewBox="0 0 60 60" width="60" height="60"><circle cx="30" cy="30" r="30" fill="#E0E0E0"/><circle cx="30" cy="23" r="8" fill="#BDBDBD"/><ellipse cx="30" cy="46" rx="14" ry="11" fill="#BDBDBD"/></svg>',
  };

  class WeiboRenderer {
    constructor() { this._stylesInjected = false; }

    injectStyles() {
      if (this._stylesInjected) return;
      this._stylesInjected = true;
      const style = document.createElement('style');
      style.textContent = `
        .weibo-app{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif;background:#f3f3f3;color:#222;height:100%;display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
        .weibo-navbar{display:flex;align-items:center;justify-content:center;height:44px;background:#FFF;border-bottom:.5px solid #E0E0E0;flex-shrink:0;position:relative}
        .weibo-navbar-title{font-size:17px;font-weight:600;color:#222}
        .weibo-navbar-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:none;background:#FF8200;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .weibo-views{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
        .weibo-tabbar{display:flex;background:#FFF;border-top:.5px solid #E0E0E0;padding-bottom:env(safe-area-inset-bottom,0);flex-shrink:0}
        .weibo-tabbar button{flex:1;border:none;background:none;font-size:10px;color:#999;padding:4px 0 6px;text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;flex-direction:column;align-items:center;gap:1px}
        .weibo-tabbar button .weibo-tab-icon{display:flex;align-items:center;justify-content:center;width:22px;height:22px;margin-bottom:1px}
        .weibo-tabbar button.weibo-active{color:#FF8200;font-weight:600}
        .weibo-actions{display:flex;gap:10px;padding:12px 16px;background:#FFF;border-bottom:.5px solid #E5E5E5}
        .weibo-actions button{flex:1;height:36px;border:none;border-radius:18px;font-size:14px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .weibo-actions button:first-child{background:#FF8200;color:#FFF}
        .weibo-actions button:nth-child(2){background:#FFF3E0;color:#FF8200;border:.5px solid #FFCC80}
        .weibo-list{padding:0}
        .weibo-post{background:#FFF;padding:14px 16px;border-bottom:8px solid #f3f3f3}
        .weibo-post-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .weibo-post-avatar{width:36px;height:36px;border-radius:18px;flex-shrink:0;overflow:hidden;background:#E0E0E0;display:flex;align-items:center;justify-content:center}
        .weibo-post-avatar img{width:100%;height:100%;object-fit:cover;border-radius:18px}
        .weibo-post-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .weibo-post-author{font-size:15px;font-weight:600;color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .weibo-post-time{font-size:12px;color:#999}
        .weibo-post-content{font-size:15px;line-height:1.7;color:#333;margin-bottom:10px;white-space:pre-wrap;word-break:break-word}
        .weibo-post-images{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px;border-radius:8px;overflow:hidden}
        .weibo-post-image{aspect-ratio:1;background:#eee;background-size:cover;background-position:center;cursor:pointer}
        .weibo-post-footer{display:flex;align-items:center;justify-content:space-around;padding-top:10px;border-top:.5px solid #f0f0f0}
        .weibo-action-btn{display:flex;align-items:center;gap:4px;border:none;background:none;color:#999;font-size:13px;cursor:pointer;padding:6px 12px;border-radius:16px;-webkit-tap-highlight-color:transparent;transition:background .15s,color .15s}
        .weibo-action-btn:active{background:#f5f5f5}
        .weibo-action-btn.weibo-liked{color:#E6162D}
        .weibo-action-btn svg{width:16px;height:16px}
        .weibo-comment-section{background:#FFF;padding:14px 16px;border-bottom:8px solid #f3f3f3}
        .weibo-comment-section h4{font-size:15px;font-weight:600;color:#222;margin:0 0 12px}
        .weibo-comment-item{display:flex;gap:10px;padding:10px 0;border-bottom:.5px solid #f0f0f0}
        .weibo-comment-item:last-child{border-bottom:none}
        .weibo-comment-avatar{width:30px;height:30px;border-radius:15px;flex-shrink:0;background:#E0E0E0;overflow:hidden}
        .weibo-comment-avatar img{width:100%;height:100%;object-fit:cover}
        .weibo-comment-body{flex:1;min-width:0}
        .weibo-comment-author{font-size:14px;font-weight:500;color:#666}
        .weibo-comment-text{font-size:14px;color:#333;line-height:1.5;margin-top:2px}
        .weibo-comment-time{font-size:12px;color:#999;margin-top:4px}
        .weibo-hot-list{background:#FFF;padding:0}
        .weibo-hot-item{display:flex;align-items:center;padding:14px 16px;border-bottom:.5px solid #f0f0f0;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .weibo-hot-item:active{background:#f9f9f9}
        .weibo-hot-rank{width:24px;font-size:16px;font-weight:700;color:#999;flex-shrink:0;text-align:center}
        .weibo-hot-rank.weibo-hot-top{color:#FF8200}
        .weibo-hot-title{flex:1;font-size:15px;color:#222;margin-left:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .weibo-hot-count{font-size:12px;color:#999;flex-shrink:0;margin-left:8px}
        .weibo-profile{background:#FFF}
        .weibo-profile-header{display:flex;flex-direction:column;align-items:center;padding:24px 16px 16px;background:linear-gradient(135deg,#FF8200,#FFB74D)}
        .weibo-profile-avatar{width:60px;height:60px;border-radius:30px;border:3px solid rgba(255,255,255,.4);overflow:hidden;background:#E0E0E0}
        .weibo-profile-avatar img{width:100%;height:100%;object-fit:cover}
        .weibo-profile-name{font-size:18px;font-weight:700;color:#FFF;margin-top:10px}
        .weibo-profile-bio{font-size:13px;color:rgba(255,255,255,.8);margin-top:4px}
        .weibo-profile-stats{display:flex;justify-content:space-around;padding:16px;background:#FFF;border-bottom:.5px solid #f0f0f0}
        .weibo-profile-stat{text-align:center}
        .weibo-profile-stat-val{font-size:18px;font-weight:700;color:#222}
        .weibo-profile-stat-label{font-size:12px;color:#999;margin-top:2px}
        .weibo-profile-actions{display:flex;gap:10px;padding:16px;background:#FFF}
        .weibo-profile-actions button{flex:1;height:38px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .weibo-profile-actions button:first-child{background:#FF8200;color:#FFF}
        .weibo-profile-actions button:nth-child(2){background:#f5f5f5;color:#666}
        .weibo-empty,.weibo-error{text-align:center;color:#999;font-size:14px;padding:60px 20px}
        .weibo-error{color:#E6162D}
        .weibo-compose{background:#FFF;padding:16px;min-height:100%}
        .weibo-compose textarea{width:100%;min-height:120px;border:1px solid #e5e5e5;border-radius:8px;padding:12px;font-size:15px;color:#222;resize:vertical;outline:none;box-sizing:border-box;font-family:inherit}
        .weibo-compose textarea:focus{border-color:#FF8200}
        .weibo-compose-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}
        .weibo-compose-actions button{padding:8px 24px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer}
        .weibo-compose-actions button:first-child{background:#FF8200;color:#FFF}
        .weibo-compose-actions button:last-child{background:#f5f5f5;color:#666}
        .weibo-loading{display:flex;align-items:center;justify-content:center;padding:40px;color:#999;font-size:14px}
      `;
      document.head.appendChild(style);
    }

    _escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ==================== 主框架 ====================

    renderShell() {
      return '<div class="weibo-app">' +
        '<div class="weibo-navbar"><span class="weibo-navbar-title">微博</span>' +
        '<button class="weibo-navbar-btn" data-action="compose">' + ICONS.plus + '</button></div>' +
        '<div class="weibo-views">' +
        '<div class="weibo-view" data-view="HOME"></div>' +
        '<div class="weibo-view" data-view="HOT" style="display:none;"></div>' +
        '<div class="weibo-view" data-view="MESSAGE" style="display:none;"></div>' +
        '<div class="weibo-view" data-view="PROFILE" style="display:none;"></div>' +
        '<div class="weibo-view" data-view="COMPOSE" style="display:none;"></div>' +
        '<div class="weibo-view" data-view="POST_DETAIL" style="display:none;"></div>' +
        '</div>' +
        '<div class="weibo-tabbar">' +
        '<button data-tab="HOME" class="weibo-active"><span class="weibo-tab-icon">' + ICONS.home + '</span>首页</button>' +
        '<button data-tab="HOT"><span class="weibo-tab-icon">' + ICONS.hot + '</span>热搜</button>' +
        '<button data-tab="MESSAGE"><span class="weibo-tab-icon">' + ICONS.message + '</span>消息</button>' +
        '<button data-tab="PROFILE"><span class="weibo-tab-icon">' + ICONS.profile + '</span>我的</button>' +
        '</div></div>';
    }

    // ==================== 首页 ====================

    renderHome(posts) {
      const fragment = document.createDocumentFragment();
      const actions = document.createElement('div');
      actions.className = 'weibo-actions';
      actions.innerHTML = '<button data-action="compose">发微博</button><button data-action="ai-compose">AI 生成</button>';
      fragment.appendChild(actions);

      if (!posts || posts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'weibo-empty';
        empty.textContent = '暂无微博';
        fragment.appendChild(empty);
        return fragment;
      }

      const list = document.createElement('div');
      list.className = 'weibo-list';
      posts.forEach(post => { list.appendChild(this._renderPostCard(post)); });
      fragment.appendChild(list);
      return fragment;
    }

    _renderPostCard(post) {
      const el = document.createElement('div');
      el.className = 'weibo-post';
      el.dataset.postId = post.id;
      const imagesHtml = post.images && post.images.length > 0
        ? '<div class="weibo-post-images">' + post.images.map(img =>
            '<div class="weibo-post-image" style="background-image:url(\'' + this._escapeHtml(img) + '\')"></div>'
          ).join('') + '</div>'
        : '';
      el.innerHTML =
        '<div class="weibo-post-header">' +
          '<div class="weibo-post-avatar">' + ICONS.defaultAvatar + '</div>' +
          '<div class="weibo-post-meta">' +
            '<span class="weibo-post-author">' + this._escapeHtml(post.author || '匿名') + '</span>' +
            '<span class="weibo-post-time">' + this._escapeHtml(post.time || '') + '</span>' +
          '</div></div>' +
        '<div class="weibo-post-content">' + this._escapeHtml(post.content || '') + '</div>' +
        imagesHtml +
        '<div class="weibo-post-footer">' +
          '<button class="weibo-action-btn" data-action="repost" data-post-id="' + post.id + '">' + ICONS.repost + ' ' + (post.reposts || 0) + '</button>' +
          '<button class="weibo-action-btn" data-action="comment" data-post-id="' + post.id + '">' + ICONS.comment + ' ' + (post.comments || 0) + '</button>' +
          '<button class="weibo-action-btn ' + (post.liked ? 'weibo-liked' : '') + '" data-action="like" data-post-id="' + post.id + '">' + (post.liked ? ICONS.likeActive : ICONS.like) + ' ' + (post.likes || 0) + '</button>' +
        '</div>';
      return el;
    }

    // ==================== 帖子详情+评论 ====================

    renderPostDetail(post, comments) {
      const container = document.createElement('div');
      container.innerHTML =
        '<div style="padding:12px 16px;background:#FFF;border-bottom:.5px solid #E0E0E0">' +
          '<button style="border:none;background:none;color:#FF8200;font-size:16px;cursor:pointer" data-action="back">\u2190 返回</button></div>' +
        '<div class="weibo-post" style="border-bottom:none">' +
          '<div class="weibo-post-header">' +
            '<div class="weibo-post-avatar">' + ICONS.defaultAvatar + '</div>' +
            '<div class="weibo-post-meta">' +
              '<span class="weibo-post-author">' + this._escapeHtml(post.author || '匿名') + '</span>' +
              '<span class="weibo-post-time">' + this._escapeHtml(post.time || '') + '</span>' +
            '</div></div>' +
          '<div class="weibo-post-content">' + this._escapeHtml(post.content || '') + '</div>' +
          '<div class="weibo-post-footer">' +
            '<button class="weibo-action-btn" data-action="repost" data-post-id="' + post.id + '">' + ICONS.repost + ' ' + (post.reposts || 0) + '</button>' +
            '<button class="weibo-action-btn" data-action="comment" data-post-id="' + post.id + '">' + ICONS.comment + ' ' + (post.comments || 0) + '</button>' +
            '<button class="weibo-action-btn ' + (post.liked ? 'weibo-liked' : '') + '" data-action="like" data-post-id="' + post.id + '">' + (post.liked ? ICONS.likeActive : ICONS.like) + ' ' + (post.likes || 0) + '</button>' +
          '</div></div>' +
        '<div class="weibo-comment-section">' +
          '<h4>评论 (' + (comments ? comments.length : 0) + ')</h4>' +
          (comments && comments.length > 0
            ? comments.map(c =>
                '<div class="weibo-comment-item">' +
                  '<div class="weibo-comment-avatar">' + ICONS.defaultAvatar + '</div>' +
                  '<div class="weibo-comment-body">' +
                    '<div class="weibo-comment-author">' + this._escapeHtml(c.author || '匿名') + '</div>' +
                    '<div class="weibo-comment-text">' + this._escapeHtml(c.content || '') + '</div>' +
                    '<div class="weibo-comment-time">' + this._escapeHtml(c.time || '') + '</div>' +
                  '</div></div>'
              ).join('')
            : '<div class="weibo-empty">暂无评论</div>') +
        '</div>';
      return container;
    }

    // ==================== 热搜榜 ====================

    renderHotList(hotItems) {
      const container = document.createDocumentFragment();
      if (!hotItems || hotItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'weibo-empty';
        empty.textContent = '暂无热搜';
        container.appendChild(empty);
        return container;
      }
      const list = document.createElement('div');
      list.className = 'weibo-hot-list';
      hotItems.forEach(function(item, idx) {
        const el = document.createElement('div');
        el.className = 'weibo-hot-item';
        el.dataset.hotId = item.id || idx;
        // [v4.31.0-fix] XSS 防护：热搜数据使用 _escapeHtml 转义
        el.innerHTML =
          '<span class="weibo-hot-rank ' + (idx < 3 ? 'weibo-hot-top' : '') + '">' + (idx + 1) + '</span>' +
          '<span class="weibo-hot-title">' + this._escapeHtml(item.title || item.name || '') + '</span>' +
          '<span class="weibo-hot-count">' + this._escapeHtml(item.count || item.heat || '') + '</span>';
        list.appendChild(el);
      });
      container.appendChild(list);
      return container;
    }

    // ==================== 消息页 ====================

    renderMessageList(messages) {
      const container = document.createDocumentFragment();
      if (!messages || messages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'weibo-empty';
        empty.textContent = '暂无消息';
        container.appendChild(empty);
        return container;
      }
      const list = document.createElement('div');
      list.className = 'weibo-list';
      messages.forEach(function(msg) {
        const el = document.createElement('div');
        el.className = 'weibo-post';
        el.dataset.msgId = msg.id;
        // [v4.31.0-fix] XSS 防护：消息数据使用 _escapeHtml 转义
        el.innerHTML =
          '<div class="weibo-post-header">' +
            '<div class="weibo-post-avatar">' + ICONS.defaultAvatar + '</div>' +
            '<div class="weibo-post-meta">' +
              '<span class="weibo-post-author">' + this._escapeHtml(msg.author || msg.from || '系统') + '</span>' +
              '<span class="weibo-post-time">' + this._escapeHtml(msg.time || '') + '</span>' +
            '</div></div>' +
          '<div class="weibo-post-content">' + this._escapeHtml(msg.content || msg.text || '') + '</div>';
        list.appendChild(el);
      });
      container.appendChild(list);
      return container;
    }

    // ==================== 个人资料页 ====================

    renderProfile(profileData) {
      const container = document.createElement('div');
      container.className = 'weibo-profile';
      container.innerHTML =
        '<div class="weibo-profile-header">' +
          '<div class="weibo-profile-avatar">' + ICONS.defaultAvatarLarge + '</div>' +
          '<div class="weibo-profile-name">' + this._escapeHtml(profileData?.name || '用户') + '</div>' +
          '<div class="weibo-profile-bio">' + this._escapeHtml(profileData?.bio || profileData?.description || '') + '</div>' +
        '</div>' +
        '<div class="weibo-profile-stats">' +
          '<div class="weibo-profile-stat"><div class="weibo-profile-stat-val">' + (profileData?.posts || 0) + '</div><div class="weibo-profile-stat-label">微博</div></div>' +
          '<div class="weibo-profile-stat"><div class="weibo-profile-stat-val">' + (profileData?.following || 0) + '</div><div class="weibo-profile-stat-label">关注</div></div>' +
          '<div class="weibo-profile-stat"><div class="weibo-profile-stat-val">' + (profileData?.followers || 0) + '</div><div class="weibo-profile-stat-label">粉丝</div></div>' +
        '</div>' +
        '<div class="weibo-profile-actions">' +
          '<button data-action="edit-profile">编辑资料</button>' +
          '<button data-action="settings">设置</button>' +
        '</div>';
      return container;
    }

    // ==================== 发微博 ====================

    renderCompose() {
      const container = document.createElement('div');
      container.className = 'weibo-compose';
      container.innerHTML =
        '<div style="padding:12px 16px;background:#FFF;border-bottom:.5px solid #E0E0E0">' +
          '<button style="border:none;background:none;color:#FF8200;font-size:16px;cursor:pointer" data-action="back">\u2190 取消</button></div>' +
        '<div style="padding:16px">' +
          '<textarea placeholder="分享新鲜事..." data-ref="weibo-compose-text"></textarea>' +
          '<div class="weibo-compose-actions">' +
            '<button data-action="publish">发布</button>' +
            '<button data-action="cancel">取消</button>' +
          '</div></div>';
      return container;
    }

    // ==================== 空状态 / 错误 / 加载 ====================

    renderEmpty(msg) {
      const el = document.createElement('div');
      el.className = 'weibo-empty';
      el.textContent = msg || '暂无数据';
      return el;
    }
    renderError(msg) {
      const el = document.createElement('div');
      el.className = 'weibo-error';
      el.textContent = msg || '加载失败';
      return el;
    }
    renderLoading() {
      const el = document.createElement('div');
      el.className = 'weibo-loading';
      el.textContent = '加载中...';
      return el;
    }
  }

  window.PhoneRenderers = window.PhoneRenderers || {};
  window.PhoneRenderers.Weibo = WeiboRenderer;
  console.log('[Renderer] WeiboRenderer 已加载');
})();
