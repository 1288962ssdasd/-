/**
 * 设置模块 - API + 提示词模板 + 事件日志 + 提示词可视化 (Phase 7)
 * 顶部 API（原版样式），下方提示词下拉编辑
 * 新增：提示词可视化编辑、专家选择、变量高亮
 */
(function () {
  'use strict';

  var SettingsRenderer = {
    render: function () {
      var div = document.createElement('div');
      div.className = 'settings-app';
      div.innerHTML =
        '<div class="settings-header"><h2>设置</h2></div>' +
        '<div class="settings-scroll">' +
          '<div class="settings-section-title">API 接口</div>' +
          '<div class="settings-card">' +
            '<label class="settings-label">API 地址</label>' +
            '<input class="settings-input" data-ref="api-base" placeholder="https://api.openai.com/v1" />' +
            '<label class="settings-label">API Key</label>' +
            '<input class="settings-input" data-ref="api-key" type="password" placeholder="sk-..." />' +
            '<div class="settings-actions">' +
              '<button class="settings-btn settings-btn-primary" data-action="save-api">保存 API</button>' +
              '<button class="settings-btn" data-action="test-api">测试连接</button>' +
            '</div>' +
            '<div class="settings-status" data-ref="api-status"></div>' +
          '</div>' +
          '<div class="settings-section-title">提示词设置</div>' +
          '<div class="settings-card">' +
            '<label class="settings-label">专家选择</label>' +
            '<select class="settings-select" data-ref="expert-select"></select>' +
            '<label class="settings-label">模板类型</label>' +
            '<div class="settings-template-tabs">' +
              '<button class="settings-tab settings-tab-active" data-template-type="system" data-action="switch-template">系统模板</button>' +
              '<button class="settings-tab" data-template-type="user" data-action="switch-template">用户模板</button>' +
            '</div>' +
            '<label class="settings-label">提示词编辑</label>' +
            '<div class="settings-prompt-editor-wrapper">' +
              '<textarea class="settings-textarea settings-prompt-editor" data-ref="prompt-editor" rows="12" placeholder="在此编辑提示词..."></textarea>' +
              '<div class="settings-prompt-overlay" data-ref="prompt-overlay"></div>' +
            '</div>' +
            '<div class="settings-variables-section">' +
              '<div class="settings-variables-header">' +
                '<span class="settings-label">可用变量</span>' +
                '<button class="settings-btn-small" data-action="refresh-variables">刷新</button>' +
              '</div>' +
              '<div class="settings-variables-list" data-ref="variables-list"></div>' +
            '</div>' +
            '<div class="settings-actions">' +
              '<button class="settings-btn" data-action="reset-prompt">恢复默认</button>' +
              '<button class="settings-btn settings-btn-primary" data-action="save-prompt">保存</button>' +
              '<button class="settings-btn" data-action="test-prompt">测试生成</button>' +
            '</div>' +
            '<div class="settings-status" data-ref="prompt-status"></div>' +
          '</div>' +
          '<div class="settings-section-title">系统</div>' +
          '<div class="settings-card settings-row">' +
            '<span>AI 管家（ST 每轮随机事件）</span>' +
            '<label class="settings-toggle"><input type="checkbox" data-ref="director-switch" /><span></span></label>' +
          '</div>' +
          '<div class="settings-section-title">事件更新</div>' +
          '<div class="settings-card">' +
            '<div class="settings-events-log" data-ref="events-log">加载中...</div>' +
            '<button class="settings-btn" data-action="refresh-events">刷新事件日志</button>' +
          '</div>' +
          '<div class="settings-card settings-link" data-action="open-full-api">打开完整 API / 大世界面板 ›</div>' +
        '</div>';
      return div;
    },
  };

  window.BuiltinModules = window.BuiltinModules || {};

  window.BuiltinModules.Settings = {
    id: 'settings',
    name: '设置',
    icon: '⚙️',
    iconBg: 'linear-gradient(135deg, #8e8e93 0%, #636366 100%)',

    init: function (shell) {
      this._shell = shell;
      // [v4.31.0-fix] 铁则一：通过 Service 层访问数据，不直接实例化 Schema
      this._apiConfigService = window.PhoneServices?.ApiConfig ? new window.PhoneServices.ApiConfig(window.Platform) : null;
      this._promptService = window.PhoneServices?.Prompt ? new window.PhoneServices.Prompt(window.Platform) : null;
      this._gateway = window.LLMGateway ? new window.LLMGateway(window.Platform) : null;
      this._currentTemplateType = 'system';
      this._currentExpert = '';
      this._availableVariables = [];
      this._unsubscribers = [];
    },

    render: function () {
      var div = SettingsRenderer.render();
      var self = this;

      setTimeout(function () {
        self._bind(div);
        self._loadApi();
        self._loadExperts(div);
        self._loadDirectorSwitch(div);
        self._loadEventLog(div);
      }, 0);

      return div;
    },

    _bind: function (div) {
      var self = this;
      div.addEventListener('click', function (e) {
        var action = e.target.closest('[data-action]')?.dataset?.action;
        if (!action) return;
        if (action === 'save-api') self._saveApi(div);
        if (action === 'test-api') self._testApi(div);
        if (action === 'save-prompt') self._savePrompt(div);
        if (action === 'reset-prompt') self._resetPrompt(div);
        if (action === 'test-prompt') self._testPrompt(div);
        if (action === 'switch-template') self._switchTemplate(div, e);
        if (action === 'refresh-variables') self._loadVariables(div);
        if (action === 'refresh-events') self._loadEventLog(div);
        if (action === 'open-full-api') window.__phoneShell?.launchApp('apiSettings');
      });

      var expertSel = div.querySelector('[data-ref="expert-select"]');
      if (expertSel) {
        expertSel.addEventListener('change', function () {
          self._currentExpert = expertSel.value;
          self._loadPromptForExpert(div, expertSel.value);
        });
      }

      var promptEditor = div.querySelector('[data-ref="prompt-editor"]');
      if (promptEditor) {
        promptEditor.addEventListener('input', function () {
          self._updatePromptOverlay(div);
        });
        promptEditor.addEventListener('scroll', function () {
          self._syncOverlayScroll(div);
        });
      }

      var sw = div.querySelector('[data-ref="director-switch"]');
      if (sw) {
        sw.addEventListener('change', async function () {
          try {
            if (window.__directorService?.setMasterSwitch) {
              await window.__directorService.setMasterSwitch(sw.checked);
            }
          } catch (err) {
            console.warn('[Settings] 管家开关失败:', err);
          }
        });
      }

      // [v4.31.0-fix] 生命周期：保存事件取消订阅函数
      var bus = window.Platform?.eventBus;
      if (bus) {
        var refresh = function () { self._loadEventLog(div); };
        var unsub1 = bus.on('director:plan', refresh);
        var unsub2 = bus.on('world:feedSynced', refresh);
        if (unsub1) this._unsubscribers.push(unsub1);
        if (unsub2) this._unsubscribers.push(unsub2);
      }
    },

    // [v4.31.0-fix] 生命周期：添加 destroy 方法清理资源
    destroy: function () {
      // 清理事件订阅
      this._unsubscribers.forEach(function (unsub) {
        if (typeof unsub === 'function') unsub();
      });
      this._unsubscribers = [];
      console.log('[SettingsModule] 已销毁');
    },

    _status: function (ref, msg, type, root) {
      var el = root.querySelector('[data-ref="' + ref + '"]');
      if (el) {
        el.textContent = msg;
        el.style.color = type === 'error' ? '#ff3b30' : type === 'ok' ? '#34c759' : '#8e8e93';
      }
    },

    // ==================== API 相关 ====================

    _loadApi: async function (div) {
      try {
        // [v4.31.0-fix] 使用 Service 层访问数据
        const cfg = await this._apiConfigService?.getMainConfig();
        if (cfg) {
          div.querySelector('[data-ref="api-base"]').value = cfg.baseUrl || '';
          div.querySelector('[data-ref="api-key"]').value = cfg.apiKey || '';
        }
      } catch (e) {
        console.warn('[Settings] 加载 API 失败:', e);
      }
    },

    async _saveApi(div) {
      try {
        const baseUrl = div.querySelector('[data-ref="api-base"]').value.trim();
        const apiKey = div.querySelector('[data-ref="api-key"]').value.trim();
        // [v4.31.0-fix] 使用 Service 层写入数据
        await this._apiConfigService?.updateMainConfig({ baseUrl, apiKey });
        this._status('api-status', 'API 已保存', 'ok', div);
      } catch (e) {
        this._status('api-status', '保存失败', 'error', div);
      }
    },

    async _testApi(div) {
      this._status('api-status', '测试中...', '', div);
      try {
        const AI = window.PhoneServices?.AI;
        if (!AI) throw new Error('AIService 不可用');
        const ai = new AI(window.Platform);
        const r = await ai.generate('ping', { maxTokens: 5 });
        this._status('api-status', r ? '连接成功' : '无响应', r ? 'ok' : 'error', div);
      } catch (e) {
        this._status('api-status', '测试失败: ' + e.message, 'error', div);
      }
    },

    // ==================== Phase 7: 提示词可视化 ====================

    async _loadExperts(div) {
      const sel = div.querySelector('[data-ref="expert-select"]');
      if (!sel) return;

      try {
        // 获取所有专家列表
        const experts = [
          { id: 'shop', name: '商店专家 (ShopExpert)' },
          { id: 'social', name: '社交专家 (SocialExpert)' },
          { id: 'news', name: '新闻专家 (NewsExpert)' },
          { id: 'quest', name: '任务专家 (QuestExpert)' },
          { id: 'world', name: '世界专家 (WorldExpert)' },
          { id: 'chat', name: '聊天专家 (ChatExpert)' },
        ];

        sel.innerHTML = '';
        experts.forEach(function (expert) {
          const opt = document.createElement('option');
          opt.value = expert.id;
          opt.textContent = expert.name;
          sel.appendChild(opt);
        });

        if (experts.length > 0) {
          this._currentExpert = experts[0].id;
          await this._loadPromptForExpert(div, experts[0].id);
        }
      } catch (e) {
        console.warn('[Settings] 加载专家列表失败:', e);
      }
    },

    async _loadPromptForExpert(div, expertId) {
      try {
        // [v4.31.0-fix] 使用 Service 层访问数据
        const promptData = await this._promptService?.getPrompt(expertId, this._currentTemplateType);
        const editor = div.querySelector('[data-ref="prompt-editor"]');
        if (editor) {
          editor.value = promptData?.template || '';
          this._updatePromptOverlay(div);
        }
        await this._loadVariables(div);
      } catch (e) {
        console.warn('[Settings] 加载提示词失败:', e);
      }
    },

    _switchTemplate(div, e) {
      const btn = e.target.closest('[data-template-type]');
      if (!btn) return;

      // 更新标签样式
      div.querySelectorAll('[data-template-type]').forEach(function (tab) {
        tab.classList.toggle('settings-tab-active', tab === btn);
      });

      this._currentTemplateType = btn.dataset.templateType;
      this._loadPromptForExpert(div, this._currentExpert);
    },

    async _loadVariables(div) {
      try {
        // [v4.31.0-fix] 使用 Service 层访问数据
        const variables = await this._promptService?.getVariables(this._currentExpert);
        this._availableVariables = variables || [];

        const listEl = div.querySelector('[data-ref="variables-list"]');
        if (!listEl) return;

        if (this._availableVariables.length === 0) {
          listEl.innerHTML = '<span class="settings-variable-empty">暂无可用变量</span>';
          return;
        }

        listEl.innerHTML = this._availableVariables.map(function (v) {
          return '<span class="settings-variable-tag" data-variable="' + v.name + '" title="' + (v.description || '') + '">' +
            '{{' + v.name + '}}</span>';
        }).join('');

        // 绑定变量点击插入
        listEl.querySelectorAll('.settings-variable-tag').forEach(function (tag) {
          tag.addEventListener('click', function () {
            const editor = div.querySelector('[data-ref="prompt-editor"]');
            const variable = tag.dataset.variable;
            if (editor) {
              const start = editor.selectionStart;
              const end = editor.selectionEnd;
              const text = editor.value;
              const insertText = '{{' + variable + '}}';
              editor.value = text.substring(0, start) + insertText + text.substring(end);
              editor.selectionStart = editor.selectionEnd = start + insertText.length;
              editor.focus();
            }
          });
        });
      } catch (e) {
        console.warn('[Settings] 加载变量列表失败:', e);
      }
    },

    _updatePromptOverlay(div) {
      const editor = div.querySelector('[data-ref="prompt-editor"]');
      const overlay = div.querySelector('[data-ref="prompt-overlay"]');
      if (!editor || !overlay) return;

      const text = editor.value;
      // 高亮变量 {{variable}}
      const highlighted = text.replace(/\{\{([^}]+)\}\}/g, '<span class="settings-variable-highlight">{{$1}}</span>');
      overlay.innerHTML = highlighted.replace(/\n/g, '<br>');
    },

    _syncOverlayScroll(div) {
      const editor = div.querySelector('[data-ref="prompt-editor"]');
      const overlay = div.querySelector('[data-ref="prompt-overlay"]');
      if (editor && overlay) {
        overlay.scrollTop = editor.scrollTop;
        overlay.scrollLeft = editor.scrollLeft;
      }
    },

    async _savePrompt(div) {
      const editor = div.querySelector('[data-ref="prompt-editor"]');
      const prompt = editor?.value || '';

      try {
        // [v4.31.0-fix] 使用 Service 层写入数据
        await this._promptService?.savePrompt(this._currentExpert, this._currentTemplateType, prompt);
        this._status('prompt-status', '提示词已保存: ' + this._currentExpert + '/' + this._currentTemplateType, 'ok', div);
      } catch (e) {
        this._status('prompt-status', '保存失败: ' + e.message, 'error', div);
      }
    },

    async _resetPrompt(div) {
      try {
        // [v4.31.0-fix] 使用 Service 层访问数据
        const defaultPrompt = await this._promptService?.getDefaultPrompt(this._currentExpert, this._currentTemplateType);
        const editor = div.querySelector('[data-ref="prompt-editor"]');
        if (editor) {
          editor.value = defaultPrompt || '';
          this._updatePromptOverlay(div);
        }
        this._status('prompt-status', '已恢复默认', 'ok', div);
      } catch (e) {
        this._status('prompt-status', '恢复失败: ' + e.message, 'error', div);
      }
    },

    async _testPrompt(div) {
      this._status('prompt-status', '测试生成中...', '', div);
      try {
        const editor = div.querySelector('[data-ref="prompt-editor"]');
        const prompt = editor?.value || '';
        
        // 替换变量为测试值
        let testPrompt = prompt;
        this._availableVariables.forEach(function (v) {
          const regex = new RegExp('\\{\\{' + v.name + '\\}\\}', 'g');
          testPrompt = testPrompt.replace(regex, v.testValue || '[测试' + v.name + ']');
        });

        const AI = window.PhoneServices?.AI;
        if (!AI) throw new Error('AIService 不可用');
        
        const ai = new AI(window.Platform);
        const result = await ai.generate(testPrompt, { 
          moduleId: 'settings',
          maxTokens: 200 
        });
        
        // 显示测试结果
        this._showTestResult(div, result);
        this._status('prompt-status', '测试成功', 'ok', div);
      } catch (e) {
        this._status('prompt-status', '测试失败: ' + e.message, 'error', div);
      }
    },

    _showTestResult(div, result) {
      // 创建测试结果弹窗
      const overlay = document.createElement('div');
      overlay.className = 'settings-modal-overlay';
      overlay.innerHTML =
        '<div class="settings-modal-box">' +
          '<div class="settings-modal-title">测试结果</div>' +
          '<div class="settings-modal-content">' +
            '<pre class="settings-test-result">' + this._escapeHtml(result || '无输出') + '</pre>' +
          '</div>' +
          '<div class="settings-modal-actions">' +
            '<button class="settings-btn settings-btn-primary" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>';
      
      div.appendChild(overlay);
      
      overlay.addEventListener('click', function (e) {
        if (e.target.closest('[data-action="close-modal"]') || e.target === overlay) {
          overlay.remove();
        }
      });
    },

    _escapeHtml: function (text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // ==================== 其他 ====================

    async _loadDirectorSwitch(div) {
      const sw = div.querySelector('[data-ref="director-switch"]');
      if (sw && window.__directorService?.isMasterSwitchOn) {
        sw.checked = window.__directorService.isMasterSwitchOn();
      }
    },

    async _loadEventLog(div) {
      const box = div.querySelector('[data-ref="events-log"]');
      if (!box) return;
      try {
        const director = window.Platform?.get?.('directorService') || window.__directorService;
        const history = director?.getEventHistory ? await director.getEventHistory(20) : [];
        if (!history?.length) {
          box.innerHTML = '<div class="settings-event-empty">暂无事件。请先生成大世界并开启管家，在 ST 对话后会自动记录。</div>';
          return;
        }
        box.innerHTML = history.map(function (h) {
          const ts = new Date(h.timestamp).toLocaleString('zh-CN');
          const evts = (h.events || []).map(function (e) {
            return '<span class="settings-event-tag">' + (e.type || '?') + '</span> ' + (e.name || e.content || e.from || '').toString().substring(0, 40);
          }).join('<br>');
          return '<div class="settings-event-item"><div class="settings-event-time">' + ts + '</div>' + evts + '</div>';
        }).join('');
      } catch (e) {
        box.textContent = '加载失败';
      }
    },
  };

  if (!document.getElementById('settings-module-styles')) {
    var st = document.createElement('style');
    st.id = 'settings-module-styles';
    st.textContent = `
      .settings-app { width:100%;height:100%;background:#f2f2f7;display:flex;flex-direction:column;font-family:-apple-system,sans-serif; }
      .settings-header { padding:16px;background:#fff;border-bottom:1px solid #e5e5ea; }
      .settings-header h2 { margin:0;font-size:20px;font-weight:600; }
      .settings-scroll { flex:1;overflow-y:auto;padding:12px 16px 24px; }
      .settings-section-title { font-size:13px;color:#8e8e93;margin:14px 0 8px;text-transform:uppercase; }
      .settings-card { background:#fff;border-radius:12px;padding:14px;margin-bottom:10px; }
      .settings-label { display:block;font-size:13px;color:#3a3a3c;margin:8px 0 4px; }
      .settings-input,.settings-select,.settings-textarea { width:100%;box-sizing:border-box;padding:10px;border:1px solid #e5e5ea;border-radius:8px;font-size:15px; }
      .settings-textarea { font-family:ui-monospace,monospace;font-size:12px;resize:vertical;line-height:1.6; }
      .settings-actions { display:flex;gap:8px;margin-top:10px;flex-wrap:wrap; }
      .settings-btn { padding:10px 14px;border:none;border-radius:8px;background:#e5e5ea;font-size:14px;cursor:pointer; }
      .settings-btn-primary { background:#007aff;color:#fff; }
      .settings-btn-small { padding:4px 10px;border:none;border-radius:6px;background:#e5e5ea;font-size:12px;cursor:pointer; }
      .settings-row { display:flex;align-items:center;justify-content:space-between; }
      .settings-toggle input { display:none; }
      .settings-toggle span { display:inline-block;width:48px;height:28px;background:#e5e5ea;border-radius:14px;position:relative; }
      .settings-toggle input:checked + span { background:#34c759; }
      .settings-toggle span::after { content:'';position:absolute;width:24px;height:24px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s; }
      .settings-toggle input:checked + span::after { transform:translateX(20px); }
      .settings-status { font-size:12px;margin-top:8px;min-height:16px; }
      .settings-events-log { max-height:200px;overflow-y:auto;font-size:12px;color:#333; }
      .settings-event-item { padding:8px 0;border-bottom:0.5px solid #eee; }
      .settings-event-time { color:#8e8e93;margin-bottom:4px; }
      .settings-event-tag { display:inline-block;background:#007aff22;color:#007aff;padding:2px 6px;border-radius:4px;margin-right:4px;font-size:11px; }
      .settings-event-empty { color:#8e8e93;padding:8px 0; }
      .settings-link { color:#007aff;text-align:center;cursor:pointer;font-size:15px; }
      .status-gold { font-size:11px;margin-left:8px;opacity:0.95;font-weight:600; }
      
      /* Phase 7: 提示词编辑器样式 */
      .settings-template-tabs { display:flex;gap:8px;margin-bottom:12px; }
      .settings-tab { flex:1;padding:8px 12px;border:none;border-radius:8px;background:#e5e5ea;font-size:13px;cursor:pointer;transition:all .2s; }
      .settings-tab-active { background:#007aff;color:#fff; }
      .settings-prompt-editor-wrapper { position:relative;margin-bottom:12px; }
      .settings-prompt-editor { position:relative;z-index:2;background:transparent;color:transparent;caret-color:#000; }
      .settings-prompt-overlay { position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;padding:10px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;pointer-events:none;overflow:auto;white-space:pre-wrap;word-wrap:break-word; }
      .settings-variable-highlight { background:#34c75933;color:#34c759;border-radius:3px;padding:0 2px; }
      .settings-variables-section { margin-top:12px; }
      .settings-variables-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px; }
      .settings-variables-list { display:flex;flex-wrap:wrap;gap:6px; }
      .settings-variable-tag { display:inline-block;background:#007aff15;color:#007aff;padding:4px 8px;border-radius:6px;font-size:12px;font-family:ui-monospace,monospace;cursor:pointer;transition:all .15s; }
      .settings-variable-tag:hover { background:#007aff30; }
      .settings-variable-empty { color:#8e8e93;font-size:12px; }
      
      /* 测试结果弹窗 */
      .settings-modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999; }
      .settings-modal-box { background:#fff;border-radius:16px;padding:20px;width:320px;max-height:70vh;display:flex;flex-direction:column; }
      .settings-modal-title { font-size:16px;font-weight:700;margin-bottom:12px; }
      .settings-modal-content { flex:1;overflow:auto;margin-bottom:16px; }
      .settings-test-result { background:#f5f5f7;padding:12px;border-radius:8px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;margin:0; }
      .settings-modal-actions { display:flex;justify-content:flex-end; }
    `;
    document.head.appendChild(st);
  }
})();
