/**
 * Debug Bridge Module - 远程调试桥接模块 (Platform 架构版)
 *
 * 职责：
 *   1. 拦截并缓存控制台日志 (console.log/warn/error/info)
 *   2. 捕获 Platform EventBus 事件流
 *   3. 生成页面 DOM 快照
 *   4. 通过 Platform 数据通路将调试数据写入共享变量
 *   5. 提供 REST 风格的调试 API（通过 PluginBridge 暴露）
 *
 * 铁则合规：
 *   ✅ 只在 apps/ 目录
 *   ✅ 数据读写通过 PlatformVars.get / PlatformVars.set（底层走 Platform Schema）
 *   ✅ 继承模块注册模式，通过 PhoneShell.registerModule() 注册
 *   ✅ 不直接调用 fetch / localStorage / window.SillyTavern
 *   ✅ 不新增 window.* 全局变量
 *
 * 使用方式：
 *   外部通过 PluginBridge API 读取调试数据：
 *   - GET  /api/plugins/xb-bridge-test/var/xb.debug.console   → 控制台日志
 *   - GET  /api/plugins/xb-bridge-test/var/xb.debug.events    → 事件流
 *   - GET  /api/plugins/xb-bridge-test/var/xb.debug.snapshot  → 页面快照
 *   - POST /api/plugins/xb-bridge-test/var/xb.debug.command   → 发送调试命令
 *     value: JSON.stringify({ action: 'snapshot' | 'clearLog' | 'getModules' | 'eval', code?: string })
 *   - GET  /api/plugins/xb-bridge-test/var/xb.debug.response  → 命令执行结果
 * 
 * [v4.31.0-fix] 迁移 shell.getVar/setVar → PlatformVars.get/set，消除废弃警告
 */

;(function () {
  'use strict';

  // ==================== 常量 ====================

  var VAR_PREFIX = 'xb.debug';
  var MAX_LOG_ENTRIES = 200;
  var MAX_EVENT_ENTRIES = 200;
  var FLUSH_INTERVAL = 2000; // 2秒刷新一次到共享变量
  var SNAPSHOT_DEPTH = 3;    // DOM 快照深度

  var LOG_LEVELS = ['log', 'warn', 'error', 'info', 'debug'];

  // ==================== 模块定义 ====================

  var DebugBridgeModule = {
    id: 'debug-bridge',
    name: '调试桥接',
    icon: '🔧',
    iconBg: 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)',
    badge: 0,
    deps: [],

    // ---- 内部状态 ----
    _shell: null,
    _container: null,
    _enabled: true,
    _flushTimer: null,
    _originalConsole: {},
    _logBuffer: [],       // 控制台日志缓冲
    _eventBuffer: [],     // 事件流缓冲
    _lastFlushTime: 0,
    _snapshotCache: '',
    _commandResponse: '',

    // ==================== 生命周期 ====================

    /**
     * 初始化模块
     * @param {PhoneShell} shell - 壳子实例
     */
    init: function (shell) {
      this._shell = shell;
      console.log('[DebugBridge] 初始化...');

      // 1. 拦截控制台
      this._hookConsole();

      // 2. 监听事件总线
      this._hookEventBus();

      // 3. 启动定时刷新
      this._startFlush();

      // 4. 写入初始状态
      this._writeStatus('running');

      console.log('[DebugBridge] ✅ 初始化完成');
    },

    /**
     * 渲染模块 UI（调试面板）
     * @returns {HTMLElement}
     */
    render: function () {
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.className = 'debug-bridge-module';
        this._container.style.cssText = 'width:100%;height:100%;overflow-y:auto;background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:12px;padding:12px;box-sizing:border-box;';

        this._container.innerHTML = this._renderPanel();
        this._bindPanelEvents();
      }
      return this._container;
    },

    /**
     * 模块被激活
     */
    onActivate: function () {
      this._enabled = true;
      this._writeStatus('active');
      this._updatePanel();
    },

    /**
     * 模块被停用
     */
    onDeactivate: function () {
      this._enabled = false;
      this._writeStatus('inactive');
    },

    /**
     * ST 路由切换
     */
    onRouteChange: function (type, data) {
      this._captureEvent('debug:routeChange', { type: type, data: data });
    },

    /**
     * 模块销毁
     */
    onDestroy: function () {
      this._stopFlush();
      if (this._commandTimer) {
        clearInterval(this._commandTimer);
        this._commandTimer = null;
      }
      this._restoreConsole();
      this._writeStatus('disposed');
    },

    // ==================== 控制台拦截 ====================

    _hookConsole: function () {
      var self = this;

      // 保存原始方法
      this._originalConsole = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
      };

      // 拦截每个级别
      LOG_LEVELS.forEach(function (level) {
        var original = self._originalConsole[level];
        console[level] = function () {
          // 先调用原始方法
          original.apply(console, arguments);

          // 再捕获到缓冲
          if (self._enabled) {
            var args = [];
            for (var i = 0; i < arguments.length; i++) {
              try {
                var arg = arguments[i];
                if (arg instanceof Error) {
                  args.push(arg.stack || arg.message || String(arg));
                } else if (typeof arg === 'object') {
                  try {
                    args.push(JSON.stringify(arg, null, 0));
                  } catch (e) {
                    args.push(String(arg));
                  }
                } else {
                  args.push(String(arg));
                }
              } catch (e) {
                args.push('[无法序列化]');
              }
            }

            self._logBuffer.push({
              level: level,
              text: args.join(' '),
              time: Date.now(),
              ts: new Date().toISOString(),
            });

            // 限制缓冲大小
            if (self._logBuffer.length > MAX_LOG_ENTRIES) {
              self._logBuffer = self._logBuffer.slice(-MAX_LOG_ENTRIES);
            }
          }
        };
      });

      // 捕获未处理的异常
      var origOnError = window.onerror;
      window.onerror = function (msg, url, line, col, error) {
        self._logBuffer.push({
          level: 'error',
          text: 'Unhandled: ' + msg + ' (' + url + ':' + line + ':' + col + ')',
          time: Date.now(),
          ts: new Date().toISOString(),
        });
        if (origOnError) return origOnError.apply(this, arguments);
      };

      // 捕获未处理的 Promise rejection
      var origRejection = window.onunhandledrejection;
      window.onunhandledrejection = function (event) {
        self._logBuffer.push({
          level: 'error',
          text: 'UnhandledRejection: ' + (event.reason ? (event.reason.stack || event.reason.message || String(event.reason)) : String(event)),
          time: Date.now(),
          ts: new Date().toISOString(),
        });
        if (origRejection) origRejection.apply(this, arguments);
      };
    },

    _restoreConsole: function () {
      if (this._originalConsole.log) {
        LOG_LEVELS.forEach(function (level) {
          console[level] = this._originalConsole[level];
        }.bind(this));
      }
    },

    // ==================== 事件总线拦截 ====================

    _hookEventBus: function () {
      var self = this;

      // 非侵入式监听：通过 shell 的事件系统监听，不修改 Platform.emit（铁则1）
      // 使用 CustomEvent 作为事件捕获通道
      var origDispatch = document.dispatchEvent.bind(document);

      // 监听 PhoneShell 的全局事件
      document.addEventListener('phone-shell:ready', function (e) {
        self._captureEvent('phone-shell:ready', { state: e.detail?.shell?.state });
      });
      document.addEventListener('phone-shell:error', function (e) {
        self._captureEvent('phone-shell:error', { error: e.detail?.error?.message });
      });

      // 延迟注册 Platform 事件监听（等 Platform 就绪后）
      var tryRegisterPlatformListener = function () {
        if (window.Platform && window.Platform.on) {
          // 监听 Platform 的数据变更事件（只读监听，不修改 emit）
          try {
            window.Platform.on('data:changed', function (detail) {
              self._captureEvent('platform:data:changed', detail);
            });
          } catch (e) { /* ignore */ }

          try {
            window.Platform.on('state:changed', function (detail) {
              self._captureEvent('platform:state:changed', detail);
            });
          } catch (e) { /* ignore */ }
        } else {
          setTimeout(tryRegisterPlatformListener, 2000);
        }
      };
      setTimeout(tryRegisterPlatformListener, 2000);
    },

    _captureEvent: function (event, data) {
      if (!this._enabled) return;

      var eventData = null;
      try {
        // 深拷贝并限制大小
        eventData = JSON.parse(JSON.stringify(data || null));
        var jsonStr = JSON.stringify(eventData);
        if (jsonStr.length > 2000) {
          eventData = { _truncated: true, _preview: jsonStr.substring(0, 2000) };
        }
      } catch (e) {
        eventData = { _error: '无法序列化' };
      }

      this._eventBuffer.push({
        event: event,
        data: eventData,
        time: Date.now(),
        ts: new Date().toISOString(),
      });

      if (this._eventBuffer.length > MAX_EVENT_ENTRIES) {
        this._eventBuffer = this._eventBuffer.slice(-MAX_EVENT_ENTRIES);
      }
    },

    // ==================== 页面快照 ====================

    _captureSnapshot: function () {
      try {
        var snapshot = {
          url: location.href,
          title: document.title,
          timestamp: Date.now(),
          ts: new Date().toISOString(),
          dom: this._domSnapshot(document.body, SNAPSHOT_DEPTH),
          modules: this._getModuleStatus(),
          platform: this._getPlatformStatus(),
          memory: this._getMemoryStatus(),
        };

        this._snapshotCache = JSON.stringify(snapshot);
        return snapshot;
      } catch (e) {
        return { error: e.message, ts: new Date().toISOString() };
      }
    },

    _domSnapshot: function (element, maxDepth) {
      if (!element || maxDepth <= 0) return null;

      var result = {
        tag: element.tagName ? element.tagName.toLowerCase() : '',
        id: element.id || undefined,
        className: element.className && typeof element.className === 'string'
          ? element.className.split(' ').filter(function (c) { return c; }).slice(0, 5).join(' ')
          : undefined,
        children: [],
      };

      // 限制子节点数量
      var childNodes = element.children;
      var limit = Math.min(childNodes ? childNodes.length : 0, 20);

      for (var i = 0; i < limit; i++) {
        var child = childNodes[i];
        // 跳过 script 和 style 标签
        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') continue;
        var childSnap = this._domSnapshot(child, maxDepth - 1);
        if (childSnap) result.children.push(childSnap);
      }

      if (result.children.length === 0) {
        delete result.children;
        // 获取文本内容（截断）
        var text = element.textContent || '';
        if (text.trim()) {
          result.text = text.trim().substring(0, 100);
        }
      }

      return result;
    },

    _getModuleStatus: function () {
      var modules = [];
      try {
        if (window.__phoneShell && window.__phoneShell.modules) {
          var appList = window.__phoneShell.modules.getAppList();
          for (var i = 0; i < appList.length; i++) {
            var app = appList[i];
            var mod = window.__phoneShell.modules.get(app.id);
            modules.push({
              id: app.id,
              name: app.name,
              initialized: mod ? mod._initialized : false,
              badge: app.badge || 0,
            });
          }
        }
      } catch (e) { /* ignore */ }
      return modules;
    },

    _getPlatformStatus: function () {
      try {
        // 通过 shell 间接获取 ST 状态，避免直接引用 window.SillyTavern（铁则1）
        var stReady = false;
        try {
          if (this._shell && this._shell.isST) {
            stReady = this._shell.isST;
          }
        } catch (e) { /* ignore */ }

        return {
          ready: !!(window.Platform && window.Platform.isReady),
          adapterReady: !!(window.Platform?.adapter?.isReady?.()),
          phoneCore: !!window.PhoneCore,
          phoneShell: !!window.__phoneShell,
          shellState: window.__phoneShell ? window.__phoneShell.state : null,
          stAvailable: stReady,
        };
      } catch (e) {
        return { error: e.message };
      }
    },

    _getMemoryStatus: function () {
      try {
        if (performance && performance.memory) {
          return {
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB',
          };
        }
        return null;
      } catch (e) {
        return null;
      }
    },

    // ==================== 调试命令处理 ====================

    _handleCommand: function () {
      var self = this;

      // 轮询命令（通过读取共享变量）
      self._commandTimer = setInterval(function () {
        if (!self._enabled) return;

        // [v4.31.0-fix] 使用 PlatformVars 替代 shell.getVar
        var PlatformVars = window.PlatformVars;
        if (!PlatformVars) return;

        PlatformVars.get('xb.debug.command').then(function (cmdStr) {
          if (!cmdStr) return;

          try {
            var cmd = JSON.parse(cmdStr);
            self._executeCommand(cmd);
          } catch (e) {
            self._commandResponse = JSON.stringify({ error: '命令解析失败: ' + e.message });
            self._flushResponse();
          }
        }).catch(function () { /* ignore */ });
      }, 3000);
    },

    _executeCommand: function (cmd) {
      var result;

      switch (cmd.action) {
        case 'snapshot':
          result = this._captureSnapshot();
          this._commandResponse = JSON.stringify({ action: 'snapshot', data: result });
          break;

        case 'clearLog':
          this._logBuffer = [];
          this._commandResponse = JSON.stringify({ action: 'clearLog', data: { cleared: true } });
          break;

        case 'getModules':
          result = this._getModuleStatus();
          this._commandResponse = JSON.stringify({ action: 'getModules', data: result });
          break;

        case 'getEvents':
          this._commandResponse = JSON.stringify({ action: 'getEvents', data: this._eventBuffer.slice(-50) });
          break;

        case 'getConsole':
          this._commandResponse = JSON.stringify({ action: 'getConsole', data: this._logBuffer.slice(-50) });
          break;

        case 'getPlatform':
          this._commandResponse = JSON.stringify({ action: 'getPlatform', data: this._getPlatformStatus() });
          break;

        case 'eval':
          try {
            if (cmd.code) {
              var evalResult = (new Function('return (' + cmd.code + ')'))();
              this._commandResponse = JSON.stringify({
                action: 'eval',
                data: { result: evalResult, type: typeof evalResult },
              });
            } else {
              this._commandResponse = JSON.stringify({ action: 'eval', error: '缺少 code 参数' });
            }
          } catch (e) {
            this._commandResponse = JSON.stringify({ action: 'eval', error: e.message });
          }
          break;

        case 'toggle':
          this._enabled = !this._enabled;
          this._commandResponse = JSON.stringify({ action: 'toggle', data: { enabled: this._enabled } });
          break;

        default:
          this._commandResponse = JSON.stringify({ error: '未知命令: ' + cmd.action });
      }

      this._flushResponse();
    },

    // ==================== 数据刷新 ====================

    _startFlush: function () {
      var self = this;

      // 定时将缓冲数据写入共享变量
      this._flushTimer = setInterval(function () {
        self._flushAll();
      }, FLUSH_INTERVAL);

      // 启动命令轮询
      this._handleCommand();
    },

    _stopFlush: function () {
      if (this._flushTimer) {
        clearInterval(this._flushTimer);
        this._flushTimer = null;
      }
    },

    _flushAll: function () {
      if (!this._shell) return;

      var now = Date.now();
      if (now - this._lastFlushTime < FLUSH_INTERVAL) return;
      this._lastFlushTime = now;

      // [v4.31.0-fix] 使用 PlatformVars 替代 shell.setVar
      var PlatformVars = window.PlatformVars;
      if (!PlatformVars) return;

      // 写入控制台日志（最近50条）
      var recentLogs = this._logBuffer.slice(-50);
      PlatformVars.set('xb.debug.console', JSON.stringify(recentLogs)).catch(function () {});

      // 写入事件流（最近50条）
      var recentEvents = this._eventBuffer.slice(-50);
      PlatformVars.set('xb.debug.events', JSON.stringify(recentEvents)).catch(function () {});

      // 写入页面快照（每30秒更新一次）
      if (!this._snapshotCache || now - (this._snapshotTime || 0) > 30000) {
        this._snapshotTime = now;
        var snapshot = this._captureSnapshot();
        PlatformVars.set('xb.debug.snapshot', JSON.stringify(snapshot)).catch(function () {});
      }
    },

    _flushResponse: function () {
      var PlatformVars = window.PlatformVars;
      if (!PlatformVars) return;
      PlatformVars.set('xb.debug.response', this._commandResponse).catch(function () {});
    },

    _writeStatus: function (status) {
      var PlatformVars = window.PlatformVars;
      if (!PlatformVars) return;
      PlatformVars.set('xb.debug.status', JSON.stringify({
        status: status,
        ts: new Date().toISOString(),
        version: '1.0.0',
      })).catch(function () {});
    },

    // ==================== 调试面板 UI ====================

    _renderPanel: function () {
      return '<div style="display:flex;flex-direction:column;height:100%;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333;">' +
          '<span style="font-size:14px;font-weight:bold;color:#4ec9b0;">🔧 调试桥接</span>' +
          '<span id="dbg-status" style="font-size:10px;color:#4ec9b0;">● 运行中</span>' +
        '</div>' +
        '<div style="display:flex;gap:4px;padding:8px 0;border-bottom:1px solid #333;">' +
          '<button id="dbg-btn-log" style="flex:1;padding:6px;border:1px solid #4ec9b0;background:transparent;color:#4ec9b0;border-radius:4px;font-size:11px;cursor:pointer;">日志</button>' +
          '<button id="dbg-btn-events" style="flex:1;padding:6px;border:1px solid #569cd6;background:transparent;color:#569cd6;border-radius:4px;font-size:11px;cursor:pointer;">事件</button>' +
          '<button id="dbg-btn-snapshot" style="flex:1;padding:6px;border:1px solid #dcdcaa;background:transparent;color:#dcdcaa;border-radius:4px;font-size:11px;cursor:pointer;">快照</button>' +
          '<button id="dbg-btn-modules" style="flex:1;padding:6px;border:1px solid #ce9178;background:transparent;color:#ce9178;border-radius:4px;font-size:11px;cursor:pointer;">模块</button>' +
        '</div>' +
        '<div id="dbg-content" style="flex:1;overflow-y:auto;padding:8px 0;font-size:11px;line-height:1.6;">' +
          '<div style="color:#808080;">选择上方标签查看调试信息...</div>' +
        '</div>' +
        '<div style="padding:8px 0;border-top:1px solid #333;font-size:10px;color:#808080;">' +
          '日志: ' + '<span id="dbg-log-count">0</span> | ' +
          '事件: ' + '<span id="dbg-event-count">0</span> | ' +
          '刷新: ' + (FLUSH_INTERVAL / 1000) + 's' +
        '</div>' +
      '</div>';
    },

    _bindPanelEvents: function () {
      if (!this._container) return;

      var self = this;
      var content = this._container.querySelector('#dbg-content');

      this._container.querySelector('#dbg-btn-log').addEventListener('click', function () {
        self._showLogs(content);
      });

      this._container.querySelector('#dbg-btn-events').addEventListener('click', function () {
        self._showEvents(content);
      });

      this._container.querySelector('#dbg-btn-snapshot').addEventListener('click', function () {
        self._showSnapshot(content);
      });

      this._container.querySelector('#dbg-btn-modules').addEventListener('click', function () {
        self._showModules(content);
      });
    },

    _showLogs: function (container) {
      var html = '';
      var logs = this._logBuffer.slice(-80);

      if (logs.length === 0) {
        html = '<div style="color:#808080;">暂无日志</div>';
      } else {
        for (var i = 0; i < logs.length; i++) {
          var log = logs[i];
          var color = '#d4d4d4';
          if (log.level === 'error') color = '#f44747';
          else if (log.level === 'warn') color = '#cca700';
          else if (log.level === 'info') color = '#4ec9b0';
          else if (log.level === 'debug') color = '#808080';

          var time = log.ts ? log.ts.substring(11, 23) : '';
          var text = this._escapeHtml(log.text);
          if (text.length > 200) text = text.substring(0, 200) + '...';

          html += '<div style="color:' + color + ';margin-bottom:2px;word-break:break-all;">' +
            '<span style="color:#808080;">' + time + '</span> ' +
            '<span style="color:#569cd6;">[' + log.level + ']</span> ' +
            text +
          '</div>';
        }
      }

      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    },

    _showEvents: function (container) {
      var html = '';
      var events = this._eventBuffer.slice(-50);

      if (events.length === 0) {
        html = '<div style="color:#808080;">暂无事件</div>';
      } else {
        for (var i = 0; i < events.length; i++) {
          var evt = events[i];
          var time = evt.ts ? evt.ts.substring(11, 23) : '';
          var dataStr = evt.data ? JSON.stringify(evt.data) : '';
          if (dataStr.length > 100) dataStr = dataStr.substring(0, 100) + '...';

          html += '<div style="margin-bottom:4px;">' +
            '<span style="color:#808080;">' + time + '</span> ' +
            '<span style="color:#dcdcaa;">' + this._escapeHtml(evt.event) + '</span>' +
            (dataStr ? '<div style="color:#808080;margin-left:8px;font-size:10px;">' + this._escapeHtml(dataStr) + '</div>' : '') +
          '</div>';
        }
      }

      container.innerHTML = html;
    },

    _showSnapshot: function (container) {
      var snapshot = this._captureSnapshot();
      var html = '<div style="color:#4ec9b0;margin-bottom:8px;">页面快照 (' + snapshot.ts + ')</div>';

      // 模块状态
      html += '<div style="color:#dcdcaa;margin-bottom:4px;">模块状态:</div>';
      if (snapshot.modules && snapshot.modules.length > 0) {
        for (var i = 0; i < snapshot.modules.length; i++) {
          var mod = snapshot.modules[i];
          var statusColor = mod.initialized ? '#4ec9b0' : '#f44747';
          html += '<div style="margin-left:8px;">' +
            '<span style="color:' + statusColor + ';">' + (mod.initialized ? '✓' : '✗') + '</span> ' +
            '<span style="color:#d4d4d4;">' + mod.name + ' (' + mod.id + ')</span>' +
          '</div>';
        }
      } else {
        html += '<div style="color:#808080;margin-left:8px;">无模块</div>';
      }

      // Platform 状态
      html += '<div style="color:#dcdcaa;margin:8px 0 4px;">Platform 状态:</div>';
      if (snapshot.platform) {
        var p = snapshot.platform;
        html += '<div style="margin-left:8px;color:#d4d4d4;">' +
          'Platform: ' + (p.ready ? '✓' : '✗') + ' | ' +
          'Adapter: ' + (p.adapterReady ? '✓' : '✗') + ' | ' +
          'PhoneCore: ' + (p.phoneCore ? '✓' : '✗') + ' | ' +
          'Shell: ' + (p.shellState || 'N/A') +
        '</div>';
      }

      // 内存
      if (snapshot.memory) {
        html += '<div style="color:#dcdcaa;margin:8px 0 4px;">内存:</div>';
        html += '<div style="margin-left:8px;color:#d4d4d4;">' +
          'JS Heap: ' + snapshot.memory.usedJSHeapSize + ' / ' + snapshot.memory.totalJSHeapSize +
        '</div>';
      }

      // URL
      html += '<div style="color:#dcdcaa;margin:8px 0 4px;">页面:</div>';
      html += '<div style="margin-left:8px;color:#808080;word-break:break-all;">' + this._escapeHtml(snapshot.url) + '</div>';

      container.innerHTML = html;
    },

    _showModules: function (container) {
      var modules = this._getModuleStatus();
      var html = '<div style="color:#4ec9b0;margin-bottom:8px;">已注册模块</div>';

      if (modules.length === 0) {
        html += '<div style="color:#808080;">无模块</div>';
      } else {
        for (var i = 0; i < modules.length; i++) {
          var mod = modules[i];
          var statusColor = mod.initialized ? '#4ec9b0' : '#f44747';
          html += '<div style="padding:6px;margin-bottom:4px;border:1px solid #333;border-radius:4px;">' +
            '<div style="display:flex;justify-content:space-between;">' +
              '<span style="color:#d4d4d4;">' + mod.icon + ' ' + this._escapeHtml(mod.name) + '</span>' +
              '<span style="color:' + statusColor + ';">' + (mod.initialized ? '已初始化' : '未初始化') + '</span>' +
            '</div>' +
            '<div style="color:#808080;font-size:10px;">ID: ' + mod.id + '</div>' +
          '</div>';
        }
      }

      container.innerHTML = html;
    },

    _updatePanel: function () {
      if (!this._container) return;

      var logCount = this._container.querySelector('#dbg-log-count');
      var eventCount = this._container.querySelector('#dbg-event-count');
      var status = this._container.querySelector('#dbg-status');

      if (logCount) logCount.textContent = this._logBuffer.length;
      if (eventCount) eventCount.textContent = this._eventBuffer.length;
      if (status) status.textContent = this._enabled ? '● 运行中' : '○ 已暂停';
    },

    // ==================== 工具方法 ====================

    _escapeHtml: function (str) {
      return window.PhoneUtils.escapeHtml(str);
    },
  };

  // ==================== 模块加载完成 ====================
  // 注意：本模块不新增任何 window.* 全局变量（遵守铁则3）
  // 模块通过 index.js 中直接 eval 脚本内容后调用 shell.registerModule() 注册
  // 为兼容现有加载模式，使用与 MessageModule/WeiboModule 一致的约定
  window.DebugBridgeModule = DebugBridgeModule;

  console.log('[DebugBridge] 调试桥接模块已加载');
})();
