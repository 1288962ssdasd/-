// ============================================================
// bridge-api.js -- 桥接API模块
// 职责：ConfigManager + 变量管理 + 聊天摘要 + 发布-订阅消费端 + 游戏变量同步
// 运行环境：Android WebView + Node.js（不使用 ES Module、顶层 await、optional chaining 等）
// ============================================================

(function () {
  'use strict';

  // ===== ConfigManager（共享配置管理器） =====
  // 从小白X变量系统读取/写入配置，30秒缓存，统一入口

  var ConfigManager = {
    _cache: null,
    _cacheTime: 0,
    CACHE_TTL: 30000,

    // 默认配置值
    defaults: {
      'xb.phone.api.enabled': 'true',
      'xb.phone.api.url': '',
      'xb.phone.api.key': '',
      'xb.phone.api.model': '',
      'xb.phone.api.temperature': '0.8',
      'xb.phone.api.maxTokens': '500',
      'xb.phone.autoMsg.enabled': 'true',
      'xb.phone.autoMsg.interval': '60',
      'xb.phone.autoMsg.probability': '30',
      'xb.phone.bizyair.enabled': 'false',
      'xb.phone.bizyair.probability': '30',
      'xb.phone.bizyair.cooldown': '30',
      'xb.phone.bizyair.autoGenerate': 'true',
      'xb.phone.bizyair.triggerProbability': '30',
      'xb.phone.image.autoInsert': 'true',
      'xb.phone.image.interval': '5',
      'xb.phone.image.sceneDetection': 'true',

      // 游戏状态变量（ST主LLM/循环任务写入，小手机读取）
      'xb.game.activeChar': '苏晚晴',
      'xb.game.phase': '完全职业',
      'xb.game.scene': '翡翠湾小区',
      'xb.game.money': '10000',
      'xb.game.rose': '0',
      'xb.game.friends': '',

      // 小手机状态变量
      'xb.phone.pendingFriend': '',
      'xb.phone.moments.enabled': 'false',
      'xb.phone.moments.last': '',
      'xb.phone.lastMsg.from': '',
      'xb.phone.lastMsg.time': '',

      // BizyAir联动变量
      'xb.bizyair.autoGen': 'false',
      'xb.bizyair.activeChar': '',

      // UI控制变量
      'xb.ui.hideStateBlocks': 'true',
      'xb.ui.hideThinking': 'true',
      'xb.ui.beautifyFriends': 'true',
      'xb.ui.renderQuickReply': 'true',
      'xb.ui.hideMainChat': 'false',

      // 小白X桥接配置
      'xb.phone.api.useXBBridge': 'true',
      'xb.phone.context.autoSync': 'true',
      'xb.phone.memory.autoSync': 'true',
      'xb.phone.contact.autoSync': 'true',
      'xb.phone.contact.syncInterval': '60',

      // 动态任务系统变量
      'xb.quest.enabled': 'true',
      'xb.quest.pendingNotify': '',
      'xb.quest.lastCompleted': '',
      'xb.quest.lastCompletedType': '',
      'xb.quest.lastCompletedResult': ''
    },

    // 读取小白X变量
    _readVar: function (key) {
      var self = this;
      return new Promise(function (resolve) {
        try {
          if (window.STscript) {
            window.STscript('/getvar key=' + key).then(function (val) {
              if (val && val !== '' && val !== 'undefined' && val !== 'null') resolve(val);
              else resolve(null);
            }).catch(function () { resolve(null); });
          } else {
            resolve(null);
          }
        } catch (e) { resolve(null); }
      });
    },

    // 写入小白X变量
    _writeVar: function (key, value) {
      var self = this;
      return new Promise(function (resolve) {
        try {
          if (window.STscript) {
            window.STscript('/setvar key=' + key + ' ' + String(value)).then(function () {
              self._cache = null;
              resolve(true);
            }).catch(function (e) {
              console.warn('[ConfigManager] 写入失败:', key, e);
              resolve(false);
            });
          } else {
            resolve(false);
          }
        } catch (e) {
          console.warn('[ConfigManager] 写入失败:', key, e);
          resolve(false);
        }
      });
    },

    // 批量加载所有配置（带缓存）
    getAll: function () {
      var self = this;
      var now = Date.now();
      if (self._cache && (now - self._cacheTime) < self.CACHE_TTL) {
        return Promise.resolve(self._cache);
      }
      var config = {};
      var keys = Object.keys(self.defaults);
      var chain = Promise.resolve();
      for (var i = 0; i < keys.length; i++) {
        (function (key) {
          chain = chain.then(function () {
            return self._readVar(key);
          }).then(function (val) {
            if (val !== null) {
              config[key] = val;
            } else {
              config[key] = self.defaults[key];
            }
          });
        })(keys[i]);
      }
      return chain.then(function () {
        self._cache = config;
        self._cacheTime = Date.now();
        return config;
      });
    },

    // 读取单个配置
    get: function (key) {
      var self = this;
      return self.getAll().then(function (config) { return config[key]; });
    },

    set: function (key, value) {
      return this._writeVar(key, value);
    },

    init: function () {
      console.log('[ConfigManager] 初始化完成');
    }
  };

  // ===== BridgeAPI（桥接API） =====
  // 变量管理、聊天摘要、发布-订阅消费端、游戏变量同步 + PluginBridge 双通道

  var BridgeAPI = {
    ConfigManager: ConfigManager,

    // ---------- PluginBridge 双通道 ----------
    _bridgeEnabled: false,

    // 变量监听状态
    _varWatchState: {
      enabled: false,
      timer: null,
      interval: 2000,  // 轮询间隔2秒
      lastValues: {},   // 上次读取的变量值快照
      watchers: []      // 监听器列表
    },

    // 初始化 PluginBridge 连接
    initBridge: function () {
      var self = this;

      if (!window.BridgeClient) {
        console.log('[BridgeAPI] BridgeClient 不可用，跳过 PluginBridge 初始化');
        return;
      }

      console.log('[BridgeAPI] 正在初始化 PluginBridge...');

      try {
        // 连接到 PluginBridge 服务器
        window.BridgeClient.init();

        // 订阅 var.changed 事件，收到后更新本地缓存
        window.BridgeClient.subscribe('var.changed', function (data) {
          if (data && data.key) {
            console.log('[BridgeAPI] 收到 var.changed:', data.key, data.value);
            // 更新 ConfigManager 缓存
            if (ConfigManager._cache) {
              ConfigManager._cache[data.key] = data.value;
            }
          }
        });

        // 订阅 quest.* 通配符事件，触发本地事件处理
        window.BridgeClient.subscribe('quest.*', function (data) {
          console.log('[BridgeAPI] 收到 quest 事件:', data);
          // 通知 QuestEngine 处理（如果可用）
          if (window.QuestEngine && typeof window.QuestEngine.emit === 'function') {
            try {
              window.QuestEngine.emit('quest:bridge', data);
            } catch (e) {
              console.warn('[BridgeAPI] quest 事件转发失败:', e);
            }
          }
        });

        // 标记 PluginBridge 已启用
        self._bridgeEnabled = true;
        console.log('[BridgeAPI] PluginBridge 已启用');

        // 启动变量轮询监听器
        self.startVarWatcher();

        // 注册 connected 事件处理器（重连时重新订阅）
        window.BridgeClient.on('connected', function () {
          console.log('[BridgeAPI] PluginBridge 重连成功，重新订阅事件');
          self._bridgeEnabled = true;

          // 重新订阅 var.changed
          window.BridgeClient.subscribe('var.changed', function (data) {
            if (data && data.key) {
              console.log('[BridgeAPI] 收到 var.changed:', data.key, data.value);
              if (ConfigManager._cache) {
                ConfigManager._cache[data.key] = data.value;
              }
            }
          });

          // 重新订阅 quest.*
          window.BridgeClient.subscribe('quest.*', function (data) {
            console.log('[BridgeAPI] 收到 quest 事件:', data);
            if (window.QuestEngine && typeof window.QuestEngine.emit === 'function') {
              try {
                window.QuestEngine.emit('quest:bridge', data);
              } catch (e) {
                console.warn('[BridgeAPI] quest 事件转发失败:', e);
              }
            }
          });

          // 断线重连后同步所有任务变量
          self._syncAllQuestVars();
        });

        // 注册 fallback 事件处理器（降级时禁用双通道）
        window.BridgeClient.on('fallback', function () {
          console.log('[BridgeAPI] PluginBridge 降级，禁用双通道');
          self._bridgeEnabled = false;
        });

      } catch (e) {
        console.warn('[BridgeAPI] PluginBridge 初始化失败:', e);
        self._bridgeEnabled = false;
      }
    },

    // 封装事件发布逻辑
    _publishEvent: function (eventName, data) {
      if (!this._bridgeEnabled) {
        return;
      }
      try {
        window.BridgeClient.publish(eventName, data);
      } catch (e) {
        console.warn('[BridgeAPI] 事件发布失败:', eventName, e);
      }
    },

    // 断线重连后同步所有 xb.quest.* 变量到 PluginBridge
    _syncAllQuestVars: function () {
      var self = this;
      var questKeys = [
        'xb.quest.enabled',
        'xb.quest.pendingNotify',
        'xb.quest.lastCompleted',
        'xb.quest.lastCompletedType',
        'xb.quest.lastCompletedResult'
      ];
      var chain = Promise.resolve();

      for (var i = 0; i < questKeys.length; i++) {
        (function (key) {
          chain = chain.then(function () {
            return ConfigManager._readVar(key);
          }).then(function (val) {
            if (val !== null && self._bridgeEnabled) {
              try {
                window.BridgeClient.setVar(key, val);
              } catch (e) {
                console.warn('[BridgeAPI] 同步变量失败:', key, e);
              }
            }
          });
        })(questKeys[i]);
      }

      return chain.then(function () {
        console.log('[BridgeAPI] 任务变量同步完成');
      }).catch(function (e) {
        console.warn('[BridgeAPI] 任务变量同步失败:', e);
      });
    },

    // ---------- 变量轮询监听器 ----------

    // 启动变量轮询监听器
    startVarWatcher: function () {
      var self = this;

      // 检查是否已在运行，避免重复启动
      if (self._varWatchState.enabled) {
        console.log('[BridgeAPI] 变量监听器已在运行中');
        return;
      }

      // 设置状态
      self._varWatchState.enabled = true;

      // 注册默认监听器
      self._registerDefaultWatchers();

      // 启动定时器
      self._varWatchState.timer = setInterval(function () {
        self._pollVariables();
      }, self._varWatchState.interval);

      console.log('[BridgeAPI] 变量监听器已启动');
    },

    // 停止变量轮询监听器
    stopVarWatcher: function () {
      var self = this;

      // 清除定时器
      if (self._varWatchState.timer) {
        clearInterval(self._varWatchState.timer);
        self._varWatchState.timer = null;
      }

      // 设置状态
      self._varWatchState.enabled = false;

      console.log('[BridgeAPI] 变量监听器已停止');
    },

    // 添加自定义变量监听器
    addVarWatcher: function (config) {
      var self = this;

      if (!config || !config.key || typeof config.handler !== 'function') {
        console.warn('[BridgeAPI] addVarWatcher: 无效的监听器配置');
        return;
      }

      // 检查是否已存在同 key 的监听器，避免重复
      for (var i = 0; i < self._varWatchState.watchers.length; i++) {
        if (self._varWatchState.watchers[i].key === config.key) {
          console.log('[BridgeAPI] 监听器已存在:', config.key);
          return;
        }
      }

      self._varWatchState.watchers.push({
        key: config.key,
        handler: config.handler,
        immediate: config.immediate || false
      });

      // 如果设置了 immediate，立即执行一次
      if (config.immediate) {
        ConfigManager._readVar(config.key).then(function (val) {
          config.handler(val, null);
        }).catch(function () {
          // 静默
        });
      }
    },

    // 核心轮询逻辑
    _pollVariables: function () {
      var self = this;
      var watchers = self._varWatchState.watchers;

      if (watchers.length === 0) return;

      // 并行读取所有变量
      var promises = [];
      for (var i = 0; i < watchers.length; i++) {
        (function (watcher) {
          promises.push(
            ConfigManager._readVar(watcher.key).then(function (currentValue) {
              var oldValue = self._varWatchState.lastValues[watcher.key];

              // 比较值是否变化
              if (currentValue !== oldValue) {
                // 新值不为空时触发回调
                if (currentValue !== null && currentValue !== '' && currentValue !== undefined) {
                  try {
                    watcher.handler(currentValue, oldValue);
                  } catch (e) {
                    console.warn('[BridgeAPI] 监听器回调执行失败:', watcher.key, e);
                  }
                }
                // 更新快照（无论是否触发回调都更新，避免重复触发）
                self._varWatchState.lastValues[watcher.key] = currentValue;
              }
            }).catch(function (e) {
              // 捕获异常不影响其他监听器
              console.warn('[BridgeAPI] 读取变量失败:', watcher.key, e);
            })
          );
        })(watchers[i]);
      }

      // 使用 Promise.all 并行等待所有读取完成
      Promise.all(promises).catch(function () {
        // 整体异常静默处理
      });
    },

    // 注册默认的变量监听器
    _registerDefaultWatchers: function () {
      var self = this;

      // 监听1: 待添加好友
      self.addVarWatcher({
        key: 'xb.phone.pendingFriend',
        handler: function (newValue, oldValue) {
          if (newValue && newValue !== '') {
            console.log('[BridgeAPI] 检测到待添加好友:', newValue);
            self.processPendingFriend();
          }
        }
      });

      // 监听2: 待处理消息
      self.addVarWatcher({
        key: 'xb.phone.pendingMsg',
        handler: function (newValue, oldValue) {
          if (newValue && newValue !== '') {
            console.log('[BridgeAPI] 检测到待处理消息:', newValue.substring(0, 30));
            self.processPendingMessages();
          }
        }
      });

      // 监听3: 任务通知
      self.addVarWatcher({
        key: 'xb.quest.pendingNotify',
        handler: function (newValue, oldValue) {
          if (newValue && newValue !== '') {
            console.log('[BridgeAPI] 检测到任务通知:', newValue.substring(0, 50));
            self.processPendingQuestNotify();
          }
        }
      });

      // 监听4: 任务注册表变更（小白X推演生成新任务）
      self.addVarWatcher({
        key: 'xb.quest.registry',
        handler: function (newValue, oldValue) {
          if (newValue && newValue !== '' && newValue !== oldValue) {
            console.log('[BridgeAPI] 检测到任务注册表变更');
            // 通知 QuestEngine 重新加载任务
            if (window.QuestEngine && typeof window.QuestEngine.emit === 'function') {
              try {
                window.QuestEngine.emit('quest:registry_changed', { registry: newValue });
              } catch (e) {
                console.warn('[BridgeAPI] 任务注册表变更通知失败:', e);
              }
            }
            // 通过 PluginBridge 广播变更
            self._publishEvent('quest.registry_changed', { registry: newValue, timestamp: Date.now() });
          }
        }
      });

      // 监听5: 游戏数据变更（小白板变量同步）
      self.addVarWatcher({
        key: '游戏数据.系统.当前角色',
        handler: function (newValue, oldValue) {
          if (newValue && newValue !== '' && newValue !== oldValue) {
            console.log('[BridgeAPI] 检测到角色变更:', newValue);
            self.syncGameVariables();
          }
        }
      });

      // 监听6: ENA Planner 推演结果
      self.addVarWatcher({
        key: 'xb.ena.lastPlot',
        handler: function (newValue, oldValue) {
          if (newValue && newValue !== '' && newValue !== oldValue) {
            console.log('[BridgeAPI] 检测到ENA推演结果');
            self._publishEvent('ena.plot_updated', { plot: newValue, timestamp: Date.now() });
            // 通知 QuestEngine
            if (window.QuestEngine && typeof window.QuestEngine.emit === 'function') {
              try {
                window.QuestEngine.emit('quest:ena_plot', { plot: newValue });
              } catch (e) {
                // 静默
              }
            }
          }
        }
      });
    },

    // ---------- 初始化 ----------
    init: function () {
      ConfigManager.init();
      console.log('[BridgeAPI] 初始化完成');

      // 延迟3秒尝试初始化 PluginBridge，等待其他模块加载
      var self = this;
      setTimeout(function () {
        self.initBridge();
      }, 3000);

      // 5秒后如果变量监听器未启动（BridgeClient不可用时），直接启动纯轮询模式
      setTimeout(function () {
        if (!self._varWatchState.enabled) {
          console.log('[BridgeAPI] BridgeClient不可用，启动纯轮询模式');
          self.startVarWatcher();
        }
      }, 5000);
    },

    // ---------- 获取API配置 ----------
    getAPIConfig: function () {
      // 优先从 window.mobileCustomAPIConfig 读取
      if (window.mobileCustomAPIConfig) {
        var settings = window.mobileCustomAPIConfig.currentSettings;
        if (settings && settings.apiKey && settings.apiKey !== '你的API Key' && !/[^\x00-\x7F]/.test(settings.apiKey)) {
          // 清理URL中的反引号和空白
          if (settings.apiUrl) {
            settings.apiUrl = settings.apiUrl.replace(/^[\s`'"]+|[\s`'"]+$/g, '');
          }
          // 如果基础model为空，尝试从chat场景预设获取
          if (!settings.model && settings.profiles && settings.profiles.chat && settings.profiles.chat.model) {
            settings.model = settings.profiles.chat.model;
            console.log('[BridgeAPI] 基础model为空，使用chat场景预设:', settings.model);
          }
          return settings;
        }
      }
      // 回退默认配置
      return {
        apiUrl: 'https://api.siliconflow.cn/v1',
        apiKey: 'sk-bqsgdxowdqpvkcgruqghiggjssjeiwfthtqhfsodqrpssdte',
        model: 'Qwen/Qwen2.5-7B-Instruct',
        temperature: 0.8,
        maxTokens: 300
      };
    },

    // ---------- 变量管理 ----------

    getVar: function (key) {
      var self = this;
      var stResult = ConfigManager._readVar(key);

      // 如果 _bridgeEnabled，同时尝试从 BridgeClient 读取作为备用数据源
      if (self._bridgeEnabled && window.BridgeClient) {
        try {
          window.BridgeClient.getVar(key).then(function (bridgeVal) {
            if (bridgeVal !== null && bridgeVal !== undefined) {
              console.log('[BridgeAPI] BridgeClient 备用数据源:', key, '=', bridgeVal);
            }
          }).catch(function () {
            // 静默忽略，STscript 是主数据源
          });
        } catch (e) {
          // 静默忽略
        }
      }

      // 返回 STscript 的结果（主数据源）
      return stResult;
    },

    setVar: function (key, value) {
      var self = this;

      // 保留原有逻辑（通过 STscript 写入变量）
      return ConfigManager._writeVar(key, value).then(function (success) {
        if (!success) return false;

        // 写入成功后，如果 _bridgeEnabled 为 true，同步到 PluginBridge 服务器
        if (self._bridgeEnabled && window.BridgeClient) {
          try {
            // 异步执行，不阻塞主流程
            window.BridgeClient.setVar(key, value).catch(function (e) {
              console.warn('[BridgeAPI] BridgeClient.setVar 失败:', key, e);
            });

            // 发布变更事件
            self._publishEvent('var.changed', {
              key: key,
              value: value,
              timestamp: Date.now()
            });
          } catch (e) {
            console.warn('[BridgeAPI] PluginBridge 同步失败:', key, e);
          }
        }

        return true;
      });
    },

    readFriendVars: function (friendName) {
      var self = this;
      var vars = {};
      var keys = [
        'phone.' + friendName + '.affection',
        'phone.' + friendName + '.summary',
        'phone.' + friendName + '.msgCount',
        'phone.' + friendName + '.lastActive'
      ];
      var legacyKeys = [
        'mobile.affection.' + friendName,
        '游戏数据.' + friendName + '.沉沦度',
        '游戏数据.' + friendName + '.阶段'
      ];
      var chain = Promise.resolve();
      for (var i = 0; i < keys.length; i++) {
        (function (k) {
          chain = chain.then(function () {
            return self.getVar(k);
          }).then(function (val) {
            if (val !== null) vars[k.replace('phone.' + friendName + '.', '')] = val;
          });
        })(keys[i]);
      }
      for (var j = 0; j < legacyKeys.length; j++) {
        (function (lk) {
          chain = chain.then(function () {
            return self.getVar(lk);
          }).then(function (lval) {
            if (lval !== null) vars['legacy_' + lk.split('.').pop()] = lval;
          });
        })(legacyKeys[j]);
      }
      return chain.then(function () { return vars; });
    },

    readGlobalContext: function () {
      return this.getVar('phone.global.context');
    },

    writeChatSummary: function (friendName, friendId) {
      var self = this;
      var history = null;
      if (window.RoleAPI && window.RoleAPI.getChatHistory) {
        history = window.RoleAPI.getChatHistory(friendId);
      }
      if (!history || history.length < 2) return Promise.resolve();
      var recent = history.slice(-6);
      var summary = '';
      for (var i = 0; i < recent.length; i++) {
        var role = recent[i].role === 'user' ? '吴宇伦' : friendName;
        var content = (recent[i].msgContent || recent[i].content || '').substring(0, 80);
        summary += role + ': ' + content + '\n';
      }
      if (summary.length > 300) summary = summary.substring(0, 300) + '...';
      return self.setVar('phone.' + friendName + '.summary', summary).then(function () {
        return self.setVar('phone.' + friendName + '.msgCount', String(history.length));
      }).then(function () {
        return self.setVar('phone.' + friendName + '.lastActive', new Date().toLocaleString('zh-CN'));
      });
    },

    updateFriendVars: function (friendName, friendId) {
      var self = this;
      return self.getVar('phone.' + friendName + '.affection').then(function (current) {
        var val = parseInt(current) || 50;
        return self.setVar('phone.' + friendName + '.affection', String(Math.min(100, val + 1)));
      }).then(function () {
        return self.writeChatSummary(friendName, friendId);
      });
    },

    _clearPhoneVars: function () {
      var self = this;
      var names = ['苏晚晴', '柳如烟', '王捷', '苏媚', '吴梦娜'];
      var chain = Promise.resolve();
      for (var i = 0; i < names.length; i++) {
        (function (name) {
          chain = chain.then(function () { return self.setVar('phone.' + name + '.summary', ''); })
            .then(function () { return self.setVar('phone.' + name + '.affection', '50'); })
            .then(function () { return self.setVar('phone.' + name + '.msgCount', '0'); })
            .then(function () { return self.setVar('phone.' + name + '.lastActive', ''); });
        })(names[i]);
      }
      return chain.then(function () {
        return self.setVar('phone.global.context', '');
      });
    },

    // ---------- 发布-订阅消费端 ----------

    processPendingFriend: function () {
      var self = this;
      return Promise.resolve().then(function () {
        return ConfigManager.get('xb.phone.pendingFriend');
      }).then(function (pending) {
        if (!pending || pending === '') return;

        var parts = pending.split('|');
        var name = parts[0] || '';
        var id = parts[1] || '';

        console.log('[BridgeAPI] 处理待添加好友:', name, id);

        if (window.friendRenderer && window.friendRenderer.addFriend) {
          window.friendRenderer.addFriend(name, id);
        }

        return ConfigManager.get('xb.game.friends').then(function (friends) {
          var friendList = friends ? friends.split(',') : [];
          if (!friendList.includes(name)) {
            friendList.push(name);
            return ConfigManager.set('xb.game.friends', friendList.join(','));
          }
        }).then(function () {
          return ConfigManager.set('xb.phone.pendingFriend', '');
        }).then(function () {
          console.log('[BridgeAPI] 待添加好友已处理:', name);
        });
      }).catch(function (e) {
        console.warn('[BridgeAPI] 处理待添加好友失败:', e);
      });
    },

    processPendingMessages: function () {
      var self = this;
      return Promise.resolve().then(function () {
        return ConfigManager.get('xb.phone.pendingMsg');
      }).then(function (pending) {
        if (!pending || pending === '') return;

        if (!window.messageRenderer || !window.messageRenderer.renderSingleMessage) {
          console.log('[BridgeAPI] messageRenderer未就绪，延迟处理pendingMsg');
          return;
        }

        var parts = pending.split('|');
        if (parts.length < 4) return;

        var charName = parts[0];
        var charId = parts[1];
        var msgType = parts[2];
        var content = parts.slice(3).join('|');

        console.log('[BridgeAPI] 处理待发送消息:', charName, msgType, content.substring(0, 30));

        var msgObj = {
          fullMatch: '[对方消息|' + charName + '|' + charId + '|' + msgType + '|' + content + ']',
          messageType: msgType,
          content: content,
          senderName: charName,
          senderId: charId
        };
        window.messageRenderer.renderSingleMessage(msgObj);
        console.log('[BridgeAPI] 消息已渲染到小手机');

        return ConfigManager.set('xb.phone.pendingMsg', '');
      }).catch(function (e) {
        console.warn('[BridgeAPI] 处理待发送消息失败:', e);
      });
    },

    // 处理动态任务系统的待处理通知
    processPendingQuestNotify: function () {
      var self = this;
      return Promise.resolve().then(function () {
        return ConfigManager.get('xb.quest.pendingNotify');
      }).then(function (pending) {
        if (!pending || pending === '') return;

        console.log('[BridgeAPI] 处理待处理任务通知:', pending.substring(0, 50));

        // 通知 QuestEngine 处理（如果可用）
        if (window.QuestEngine && typeof window.QuestEngine.emit === 'function') {
          try {
            var notifyData = JSON.parse(pending);
            window.QuestEngine.emit('quest:notify', notifyData);
          } catch (e) {
            // 如果不是JSON，作为纯文本通知
            window.QuestEngine.emit('quest:notify', { message: pending });
          }
        }

        return ConfigManager.set('xb.quest.pendingNotify', '');
      }).catch(function (e) {
        console.warn('[BridgeAPI] 处理待处理任务通知失败:', e);
      });
    },

    // ---------- 游戏变量同步 ----------

    syncGameVariables: function () {
      var self = this;
      return Promise.resolve().then(function () {
        return ConfigManager._readVar('游戏数据.系统.当前角色');
      }).then(function (currentChar) {
        if (currentChar && currentChar !== '') {
          return ConfigManager.set('xb.game.activeChar', currentChar);
        }
      }).then(function () {
        return ConfigManager._readVar('游戏数据.系统.当前场景');
      }).then(function (currentScene) {
        if (currentScene && currentScene !== '') {
          return ConfigManager.set('xb.game.scene', currentScene);
        }
      }).then(function () {
        return ConfigManager._readVar('游戏数据.系统.当前阶段');
      }).then(function (currentPhase) {
        if (currentPhase && currentPhase !== '') {
          return ConfigManager.set('xb.game.phase', currentPhase);
        }
      }).then(function () {
        console.log('[BridgeAPI] 游戏变量同步完成');
      }).catch(function (e) {
        console.warn('[BridgeAPI] 游戏变量同步失败:', e);
      });
    }
  };

  // ===== 挂载全局 =====
  if (!window.BridgeAPI) {
    window.BridgeAPI = BridgeAPI;
  } else {
    console.log('[BridgeAPI] 已存在，跳过重复加载');
  }
  window.PhoneConfig = ConfigManager;

  console.log('[BridgeAPI] 模块已加载');

  // 自动初始化（延迟500ms等待依赖模块加载）
  setTimeout(function () {
    if (window.BridgeAPI && typeof window.BridgeAPI.init === 'function') {
      window.BridgeAPI.init();
    }
  }, 500);
})();
