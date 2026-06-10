/**
 * @提及系统
 * 
 * 输入@时弹出好友列表，选中后插入高亮标签
 * 铁则合规：纯UI交互，最终数据写入走MessageService.sendText
 * 
 * @version 1.0.0
 * @since 3.8.0
 */

(function() {
  'use strict';

  class MentionSystem {
    /**
     * @param {HTMLElement} inputEl - 输入框元素
     * @param {Object} platform - Platform实例
     * @param {Object} options - { onSelect }
     */
    constructor(inputEl, platform, options = {}) {
      this._input = inputEl;
      this._platform = platform;
      this._onSelect = options.onSelect || null;
      this._dropdown = null;
      this._isVisible = false;
      this._friends = [];
      this._filter = '';

      this._bindInput();
    }

    _bindInput() {
      this._input.addEventListener('input', (e) => {
        const value = e.target.value;
        const atIndex = value.lastIndexOf('@');

        if (atIndex === -1) {
          this._hide();
          return;
        }

        // 提取@后面的搜索文本
        const afterAt = value.substring(atIndex + 1);
        // 如果后面有空格，说明@已完成
        if (afterAt.includes(' ')) {
          this._hide();
          return;
        }

        this._filter = afterAt;
        this._show(atIndex);
      });

      // 点击外部关闭
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.mention-dropdown') && e.target !== this._input) {
          this._hide();
        }
      });
    }

    async _show(atIndex) {
      // 从DataStore获取好友列表
      try {
        const friends = await this._platform.data('friends', 'list', []);
        this._friends = friends.filter(f => !f.isGroup);
      } catch (e) {
        this._friends = [];
      }

      // 过滤
      const filtered = this._filter
        ? this._friends.filter(f => f.name.toLowerCase().includes(this._filter.toLowerCase()))
        : this._friends;

      if (filtered.length === 0) {
        this._hide();
        return;
      }

      if (!this._dropdown) {
        this._dropdown = document.createElement('div');
        this._dropdown.className = 'mention-dropdown';
        this._dropdown.style.cssText = `
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          max-height: 200px;
          overflow-y: auto;
          background: var(--color-bg-card);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 50;
          padding: var(--space-1) 0;
        `;
        this._input.parentElement.style.position = 'relative';
        this._input.parentElement.appendChild(this._dropdown);
      }

      this._dropdown.innerHTML = filtered.map(f => `
        <div class="mention-item" data-friend-id="${f.id}" data-friend-name="${f.name}" style="
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          cursor: pointer;
          transition: background var(--transition-fast);
        ">
          <img src="${f.avatar || ''}" style="width:28px;height:28px;border-radius:var(--radius-full);object-fit:cover;background:var(--color-bg-input);" />
          <span style="font-size:var(--font-size-md);color:var(--color-text-primary);">${f.name}</span>
        </div>
      `).join('');

      // 绑定点击
      this._dropdown.querySelectorAll('.mention-item').forEach(item => {
        item.addEventListener('click', () => {
          const friendName = item.dataset.friendName;
          const friendId = item.dataset.friendId;
          this._insertMention(atIndex, friendName, friendId);
          this._hide();
        });
        // hover效果
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--color-bg-hover)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = '';
        });
      });

      this._isVisible = true;
    }

    _insertMention(atIndex, friendName, friendId) {
      const value = this._input.value;
      // 替换@及后面的搜索文本为 @好友名
      const before = value.substring(0, atIndex);
      const after = value.substring(atIndex + 1 + this._filter.length);

      // 创建@标签（使用contenteditable的span）
      // 对于普通input，插入纯文本@好友名
      this._input.value = `${before}@${friendName} ${after}`;

      // 触发回调
      if (this._onSelect) {
        this._onSelect({ friendId, friendName });
      }

      // 聚焦输入框
      this._input.focus();

      // 触发input事件
      this._input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _hide() {
      if (this._dropdown) {
        this._dropdown.style.display = 'none';
        this._isVisible = false;
      }
    }

    destroy() {
      if (this._dropdown) {
        this._dropdown.remove();
        this._dropdown = null;
      }
    }
  }

  window.MentionSystem = MentionSystem;

})();
