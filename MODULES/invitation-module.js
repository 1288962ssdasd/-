/**
 * @layer Module
 * @file   invitation-module.js
 * @depends InvitationService, InvitationData, Platform
 * @subscribes invitation:created, invitation:accepted, invitation:declined, invitation:expired
 *
 * 职责: 邀约模块 - 管理NPC邀约UI、用户响应
 * 禁止: 直接操作数据、直接调用Schema
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  const MODULE_ID = 'invitation';

  class InvitationModule {
    constructor() {
      this.id = MODULE_ID;
      this._platform = null;
      this._service = null;
      this._renderer = null;
      this._unsubscribers = [];
      this._isInitialized = false;
    }

    /**
     * 初始化模块
     */
    async init(platform) {
      console.log(`[${MODULE_ID}] 初始化邀约模块...`);
      this._platform = platform;

      // 获取Service
      this._service = this._platform.get?.('invitationService');
      if (!this._service) {
        console.warn(`[${MODULE_ID}] InvitationService 未就绪`);
      }

      // 初始化Renderer
      if (window.PhoneRenderers?.Invitation) {
        this._renderer = new window.PhoneRenderers.Invitation();
      }

      // 订阅事件
      this._subscribeEvents();

      this._isInitialized = true;
      console.log(`[${MODULE_ID}] 初始化完成`);
    }

    /**
     * 订阅事件
     */
    _subscribeEvents() {
      const eventBus = this._platform?.eventBus;
      if (!eventBus) return;

      this._unsubscribers.push(
        eventBus.on('invitation:created', (data) => this._onInvitationCreated(data)),
        eventBus.on('invitation:accepted', (data) => this._onInvitationAccepted(data)),
        eventBus.on('invitation:declined', (data) => this._onInvitationDeclined(data)),
        eventBus.on('invitation:expired', (data) => this._onInvitationExpired(data)),
        eventBus.on('director:contentReady', (data) => this._onDirectorContent(data))
      );
    }

    /**
     * 渲染邀约列表
     */
    async render() {
      if (!this._service) {
        return this._renderErrorState('邀约服务未就绪');
      }

      try {
        const charId = await this._getCurrentCharId();
        if (!charId) {
          return this._renderErrorState('无法获取角色ID');
        }

        const invitations = await this._service.getPendingInvitations(charId);

        if (this._renderer) {
          return this._renderer.renderInvitationList(invitations, {
            onAccept: (id) => this.acceptInvitation(id),
            onDecline: (id) => this.declineInvitation(id),
            onView: (id) => this.showInvitationDetail(id)
          });
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] 渲染邀约列表失败:`, e);
      }

      return this._renderErrorState('邀约加载失败');
    }

    // [v4.3-fix] 错误状态渲染，避免返回 null 导致空白
    _renderErrorState(message) {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 40px; text-align: center; color: #999;';
      div.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">💌</div>
        <div style="font-size: 14px;">${message || '邀约加载失败'}</div>
      `;
      return div;
    }

    /**
     * 接受邀约
     */
    async acceptInvitation(invitationId) {
      if (!this._service) return false;

      try {
        const charId = await this._getCurrentCharId();
        const result = await this._service.acceptInvitation(charId, invitationId);

        if (result) {
          this._showNotification('已接受邀约', 'success');
          await this.refreshUI();
        }

        return result;
      } catch (e) {
        console.warn(`[${MODULE_ID}] 接受邀约失败:`, e);
        return false;
      }
    }

    /**
     * 拒绝邀约
     */
    async declineInvitation(invitationId, reason = '') {
      if (!this._service) return false;

      try {
        const charId = await this._getCurrentCharId();
        const result = await this._service.declineInvitation(charId, invitationId, reason);

        if (result) {
          this._showNotification('已拒绝邀约', 'info');
          await this.refreshUI();
        }

        return result;
      } catch (e) {
        console.warn(`[${MODULE_ID}] 拒绝邀约失败:`, e);
        return false;
      }
    }

    /**
     * 显示邀约详情
     */
    async showInvitationDetail(invitationId) {
      if (!this._service) return;

      try {
        const charId = await this._getCurrentCharId();
        const invitations = await this._service.getAllInvitations(charId);
        const invitation = invitations.find(inv => inv.id === invitationId);

        if (!invitation) return;

        if (this._renderer) {
          const modal = this._renderer.renderInvitationDetail(invitation, {
            onAccept: () => this.acceptInvitation(invitationId),
            onDecline: () => this.declineInvitation(invitationId),
            onClose: () => this._closeModal()
          });

          this._showModal(modal);
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] 显示邀约详情失败:`, e);
      }
    }

    /**
     * 刷新UI
     */
    async refreshUI() {
      // 邀约通常显示在消息应用中
      const container = document.getElementById('message-list');
      if (!container) return;

      const content = await this.render();
      if (content) {
        // 将邀约插入到消息列表顶部
        container.insertBefore(content, container.firstChild);
      }
    }

    // ==================== 事件处理器 ====================

    _onInvitationCreated(data) {
      console.log(`[${MODULE_ID}] 新邀约:`, data);
      this._showNotification(
        `${data.npcName || '有人'} 向你发出邀约`,
        'info'
      );
      this.refreshUI();
    }

    _onInvitationAccepted(data) {
      console.log(`[${MODULE_ID}] 邀约已接受:`, data);
      this.refreshUI();
    }

    _onInvitationDeclined(data) {
      console.log(`[${MODULE_ID}] 邀约已拒绝:`, data);
      this.refreshUI();
    }

    _onInvitationExpired(data) {
      console.log(`[${MODULE_ID}] 邀约已过期:`, data);
      this._showNotification('一个邀约已过期', 'warning');
      this.refreshUI();
    }

    _onDirectorContent(data) {
      if (data.type === 'invitation') {
        this._onInvitationCreated(data.data);
      }
    }

    // ==================== UI辅助方法 ====================

    _showNotification(message, type = 'info') {
      if (window.PhoneShell?.showNotification) {
        window.PhoneShell.showNotification('message', '邀约', message);
      }
    }

    _showModal(content) {
      let modal = document.getElementById('invitation-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'invitation-modal';
        modal.className = 'phone-modal';
        document.body.appendChild(modal);
      }

      modal.innerHTML = '';
      modal.appendChild(content);
      modal.style.display = 'flex';
    }

    _closeModal() {
      const modal = document.getElementById('invitation-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    }

    async _getCurrentCharId() {
      try {
        return await this._platform?.adapter?.getCurrentCharacterId?.() || 'default';
      } catch (e) {
        return 'default';
      }
    }

    /**
     * 销毁模块
     */
    destroy() {
      this._unsubscribers.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      this._unsubscribers = [];
      this._isInitialized = false;
      console.log(`[${MODULE_ID}] 模块已销毁`);
    }
  }

  // [v4.31.0-fix] 铁则五：模块注册必须使用普通对象，不能使用类实例
  // 将类转换为普通对象
  const invitationModule = {
    id: MODULE_ID,
    _platform: null,
    _service: null,
    _renderer: null,
    _unsubscribers: [],
    _isInitialized: false,

    init: function (platform) {
      console.log(`[${MODULE_ID}] 初始化邀约模块...`);
      this._platform = platform;

      // 获取Service
      this._service = this._platform.get?.('invitationService');
      if (!this._service) {
        console.warn(`[${MODULE_ID}] InvitationService 未就绪`);
      }

      // 初始化Renderer
      if (window.PhoneRenderers?.Invitation) {
        this._renderer = new window.PhoneRenderers.Invitation();
      }

      // 订阅事件
      this._subscribeEvents();

      this._isInitialized = true;
      console.log(`[${MODULE_ID}] 初始化完成`);
    },

    _subscribeEvents: function () {
      const eventBus = this._platform?.eventBus;
      if (!eventBus) return;

      this._unsubscribers.push(
        eventBus.on('invitation:created', (data) => this._onInvitationCreated(data)),
        eventBus.on('invitation:accepted', (data) => this._onInvitationAccepted(data)),
        eventBus.on('invitation:declined', (data) => this._onInvitationDeclined(data)),
        eventBus.on('invitation:expired', (data) => this._onInvitationExpired(data)),
        eventBus.on('director:contentReady', (data) => this._onDirectorContent(data))
      );
    },

    destroy: function () {
      this._unsubscribers.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      this._unsubscribers = [];
      this._isInitialized = false;
      console.log(`[${MODULE_ID}] 模块已销毁`);
    }
  };

  // 复制其他方法到普通对象
  InvitationModule.prototype && Object.getOwnPropertyNames(InvitationModule.prototype).forEach(function (name) {
    if (name !== 'constructor' && typeof InvitationModule.prototype[name] === 'function') {
      invitationModule[name] = InvitationModule.prototype[name];
    }
  });

  if (window.__phoneShell?.registerModule) {
    window.__phoneShell.registerModule(invitationModule);
  } else {
    window.PhoneModules = window.PhoneModules || {};
    window.PhoneModules.Invitation = invitationModule;
  }

  console.log(`[Module] InvitationModule 已注册`);
})();
