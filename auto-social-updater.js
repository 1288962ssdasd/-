// auto-social-updater.js -- 自动社交内容更新器
// 职责：通过小白X循环任务定期自动更新微博、朋友圈、论坛内容，模拟NPC社交活动
// 运行环境：Android WebView + Node.js（不使用 ES Module、顶层 await、optional chaining 等）
// 依赖：mobileCustomAPIConfig、RoleAPI、XBBridge、BridgeAPI（均为已有模块）
// ============================================================

(function() {
  'use strict';

  var _isRunning = false;
  var _timers = {};
  var _lastUpdate = { weibo: 0, friends: 0, forum: 0 };
  var _stats = { weibo: 0, friends: 0, forum: 0, errors: 0 };

  var DEFAULT_CONFIG = {
    enabled: false,
    weibo:   { enabled: true,  interval: 300000, minPosts: 1, maxPosts: 3 },
    friends: { enabled: true,  interval: 600000, minPosts: 1, maxPosts: 2 },
    forum:   { enabled: true,  interval: 900000, minPosts: 1, maxPosts: 2 }
  };

  var config = {};
  var TYPES = ['weibo', 'friends', 'forum'];
  var NUM_KEYS = ['interval', 'minPosts', 'maxPosts'];

  // ===== 配置管理 =====

  function loadConfig() {
    var cm = (window.BridgeAPI && window.BridgeAPI.ConfigManager) || null;
    if (!cm) {
      console.warn('[AutoSocialUpdater] ConfigManager 不可用，使用默认配置');
      config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      return Promise.resolve();
    }
    var chain = cm.get('xb.phone.autoSocial.enabled').then(function(v) { config.enabled = v === 'true'; });
    for (var ti = 0; ti < TYPES.length; ti++) {
      (function(type) {
        chain = chain.then(function() { return cm.get('xb.phone.autoSocial.' + type + '.enabled'); })
          .then(function(v) {
            config[type] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[type]));
            config[type].enabled = v !== 'false';
          });
        for (var ni = 0; ni < NUM_KEYS.length; ni++) {
          (function(key) {
            chain = chain.then(function() { return cm.get('xb.phone.autoSocial.' + type + '.' + key); })
              .then(function(v) { config[type][key] = parseInt(v) || DEFAULT_CONFIG[type][key]; });
          })(NUM_KEYS[ni]);
        }
      })(TYPES[ti]);
    }
    return chain.then(function() {
      console.log('[AutoSocialUpdater] 配置已加载:', JSON.stringify(config));
    }).catch(function(e) {
      console.warn('[AutoSocialUpdater] 加载配置出错，使用默认:', e);
      config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    });
  }

  function saveConfig() {
    var cm = (window.BridgeAPI && window.BridgeAPI.ConfigManager) || null;
    if (!cm) return Promise.resolve();
    var vars = [['xb.phone.autoSocial.enabled', String(config.enabled)]];
    for (var ti = 0; ti < TYPES.length; ti++) {
      vars.push(['xb.phone.autoSocial.' + TYPES[ti] + '.enabled', String(config[TYPES[ti]].enabled)]);
      for (var ni = 0; ni < NUM_KEYS.length; ni++) {
        vars.push(['xb.phone.autoSocial.' + TYPES[ti] + '.' + NUM_KEYS[ni], String(config[TYPES[ti]][NUM_KEYS[ni]])]);
      }
    }
    var chain = Promise.resolve();
    for (var i = 0; i < vars.length; i++) {
      (function(pair) { chain = chain.then(function() { return cm.set(pair[0], pair[1]); }); })(vars[i]);
    }
    return chain.then(function() { console.log('[AutoSocialUpdater] 配置已保存'); });
  }

  // ===== AI 内容生成 =====

  function generateContent(prompt, profile) {
    if (window.mobileCustomAPIConfig && window.mobileCustomAPIConfig.isAPIAvailable && window.mobileCustomAPIConfig.isAPIAvailable()) {
      var options = {};
      if (profile) options.profile = profile;
      console.log('[AutoSocialUpdater] 使用 mobileCustomAPIConfig, profile=' + (profile || 'default'));
      return window.mobileCustomAPIConfig.callAPI([{ role: 'user', content: prompt }], options)
        .then(function(r) { return (r && r.content) ? r.content.trim() : ''; })
        .catch(function(e) {
          console.warn('[AutoSocialUpdater] mobileCustomAPIConfig 失败，回退:', e.message);
          return fallbackGenerate(prompt);
        });
    }
    return fallbackGenerate(prompt);
  }

  function fallbackGenerate(prompt) {
    if (window.XBBridge && window.XBBridge.isAvailable && window.XBBridge.isAvailable()) {
      console.log('[AutoSocialUpdater] 使用 XBBridge');
      return window.XBBridge.generate.generate({
        provider: 'inherit', messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0.9
      }).then(function(r) {
        if (typeof r === 'string') return r.trim();
        return (r && (r.content || r.text)) ? (r.content || r.text).trim() : '';
      }).catch(function(e) {
        console.warn('[AutoSocialUpdater] XBBridge 失败，回退fetch:', e.message);
        return directFetchGenerate(prompt);
      });
    }
    return directFetchGenerate(prompt);
  }

  function directFetchGenerate(prompt) {
    var apiConfig = null;
    if (window.RoleAPI && window.RoleAPI.getAPIConfig) apiConfig = window.RoleAPI.getAPIConfig();
    else if (window.BridgeAPI && window.BridgeAPI.getAPIConfig) apiConfig = window.BridgeAPI.getAPIConfig();
    if (!apiConfig || !apiConfig.apiUrl || !apiConfig.apiKey) {
      console.error('[AutoSocialUpdater] 无可用API配置');
      return Promise.resolve('');
    }
    console.log('[AutoSocialUpdater] 使用直接 fetch');
    var apiUrl = apiConfig.apiUrl.replace(/\/+$/, '');
    if (!apiUrl.endsWith('/chat/completions')) {
      if (!apiUrl.endsWith('/v1')) apiUrl += '/v1';
      apiUrl += '/chat/completions';
    }
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiConfig.apiKey },
      body: JSON.stringify({
        model: apiConfig.model || 'Qwen/Qwen2.5-7B-Instruct',
        messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0.9
      })
    }).then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function(data) {
      return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ?
        data.choices[0].message.content.trim() : '';
    }).catch(function(e) { console.error('[AutoSocialUpdater] fetch失败:', e.message); return ''; });
  }

  // ===== 社交内容生成 =====

  function generateWeiboPost() {
    if (!window.weiboManager) {
      console.log('[AutoSocialUpdater] weiboManager 未加载，跳过');
      return Promise.resolve(false);
    }
    var prompt = '请生成一条自然的生活微博动态。格式：[微博发布|作者名|内容]。' +
      '要求：内容真实自然，像普通人发的，50-100字，可以带emoji。只输出格式化结果。';
    console.log('[AutoSocialUpdater] 生成微博动态...');
    return generateContent(prompt, 'weibo').then(function(result) {
      if (!result) { console.warn('[AutoSocialUpdater] 微博生成失败：空结果'); _stats.errors++; return false; }
      var match = result.match(/\[微博发布\|([^|]+)\|(.+)\]/);
      if (!match) { console.warn('[AutoSocialUpdater] 微博格式解析失败:', result.substring(0, 80)); _stats.errors++; return false; }
      console.log('[AutoSocialUpdater] 微博已生成:', match[1].trim(), '-', match[2].trim().substring(0, 50));
      _stats.weibo++; _lastUpdate.weibo = Date.now(); return true;
    });
  }

  function generateFriendsCirclePost() {
    if (!window.friendsCircle) {
      console.log('[AutoSocialUpdater] friendsCircle 未加载，跳过');
      return Promise.resolve(false);
    }
    var prompt = '请生成一条自然的朋友圈动态。格式：[朋友圈|角色名|好友ID|w楼层ID|内容]。' +
      '要求：内容真实自然，30-80字，可以带emoji。角色名从苏晚晴、柳如烟、王捷、苏媚中选择。' +
      '好友ID用4-6位数字，楼层ID用w加3位数字。只输出格式化结果。';
    console.log('[AutoSocialUpdater] 生成朋友圈内容...');
    return generateContent(prompt, 'friends').then(function(result) {
      if (!result) { console.warn('[AutoSocialUpdater] 朋友圈生成失败：空结果'); _stats.errors++; return false; }
      var match = result.match(/\[朋友圈\|([^|]+)\|([^|]+)\|(w\d+)\|(.+)\]/);
      if (!match) { console.warn('[AutoSocialUpdater] 朋友圈格式解析失败:', result.substring(0, 80)); _stats.errors++; return false; }
      var content = match[4].trim();
      if (typeof window.friendsCircle.sendTextCircle === 'function') {
        console.log('[AutoSocialUpdater] 注入朋友圈:', match[1].trim(), '-', content.substring(0, 50));
        return window.friendsCircle.sendTextCircle(content).then(function() {
          _stats.friends++; _lastUpdate.friends = Date.now(); return true;
        }).catch(function(e) {
          console.warn('[AutoSocialUpdater] sendTextCircle失败:', e.message);
          _stats.friends++; _lastUpdate.friends = Date.now(); return true;
        });
      }
      console.log('[AutoSocialUpdater] 朋友圈已生成（无注入方法）:', match[1].trim());
      _stats.friends++; _lastUpdate.friends = Date.now(); return true;
    });
  }

  function generateForumPost() {
    if (!window.forumManager) {
      console.log('[AutoSocialUpdater] forumManager 未加载，跳过');
      return Promise.resolve(false);
    }
    var prompt = '请生成一条自然的论坛帖子。格式：[论坛帖子|帖子ID|标题|作者|板块|内容]。' +
      '要求：标题10-20字，内容50-100字。作者从匿名用户、路人甲、吃瓜群众、键盘侠、技术宅中选择。' +
      '板块从闲聊灌水、情感天地、技术交流、生活吐槽中选择。帖子ID用t加3位数字。只输出格式化结果。';
    console.log('[AutoSocialUpdater] 生成论坛帖子...');
    return generateContent(prompt, 'forum').then(function(result) {
      if (!result) { console.warn('[AutoSocialUpdater] 论坛生成失败：空结果'); _stats.errors++; return false; }
      var match = result.match(/\[论坛帖子\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.+)\]/);
      if (!match) { console.warn('[AutoSocialUpdater] 论坛格式解析失败:', result.substring(0, 80)); _stats.errors++; return false; }
      console.log('[AutoSocialUpdater] 论坛已生成:', match[2].trim(), '- by', match[3].trim());
      _stats.forum++; _lastUpdate.forum = Date.now(); return true;
    });
  }

  // ===== 定时器管理 =====

  var GENERATORS = { weibo: generateWeiboPost, friends: generateFriendsCirclePost, forum: generateForumPost };

  function startTimer(type) {
    if (_timers[type]) return;
    var tc = config[type];
    if (!tc || !tc.enabled) { console.log('[AutoSocialUpdater] ' + type + ' 未启用'); return; }
    var interval = tc.interval || 300000;
    var minP = tc.minPosts || 1, maxP = tc.maxPosts || 2;
    _timers[type] = setInterval(function() {
      if (!_isRunning) return;
      var count = minP + Math.floor(Math.random() * (maxP - minP + 1));
      var chain = Promise.resolve();
      for (var i = 0; i < count; i++) {
        (function(idx) {
          chain = chain.then(function() {
            if (idx > 0) return new Promise(function(r) { setTimeout(r, 1000 + Math.floor(Math.random() * 2000)); });
          }).then(function() { return GENERATORS[type](); });
        })(i);
      }
      chain.catch(function(e) { console.warn('[AutoSocialUpdater] 批量生成' + type + '出错:', e.message); });
    }, interval);
    console.log('[AutoSocialUpdater] ' + type + ' 定时器已启动, 间隔=' + (interval / 1000) + 's');
  }

  function stopTimer(type) {
    if (_timers[type]) { clearInterval(_timers[type]); _timers[type] = null; }
  }

  function triggerUpdate(type) {
    if (GENERATORS[type]) return GENERATORS[type]();
    console.warn('[AutoSocialUpdater] 未知类型:', type);
    return Promise.resolve(false);
  }

  // ===== 公开API =====

  window.AutoSocialUpdater = {
    start: function() {
      if (_isRunning) { console.log('[AutoSocialUpdater] 已在运行中'); return; }
      loadConfig().then(function() {
        if (!config.enabled) {
          console.log('[AutoSocialUpdater] 总开关未启用，设置 xb.phone.autoSocial.enabled = true');
          return;
        }
        _isRunning = true;
        for (var i = 0; i < TYPES.length; i++) startTimer(TYPES[i]);
        console.log('[AutoSocialUpdater] 已启动');
      });
    },

    stop: function() {
      _isRunning = false;
      for (var i = 0; i < TYPES.length; i++) stopTimer(TYPES[i]);
      console.log('[AutoSocialUpdater] 已停止');
    },

    isRunning: function() { return _isRunning; },

    getConfig: function() { return JSON.parse(JSON.stringify(config)); },

    updateConfig: function(newConfig) {
      if (!newConfig || typeof newConfig !== 'object') return;
      if (newConfig.enabled !== undefined) config.enabled = !!newConfig.enabled;
      for (var ti = 0; ti < TYPES.length; ti++) {
        var t = TYPES[ti];
        if (newConfig[t] && typeof newConfig[t] === 'object') {
          for (var k in newConfig[t]) { if (newConfig[t].hasOwnProperty(k)) config[t][k] = newConfig[t][k]; }
        }
      }
      console.log('[AutoSocialUpdater] 配置已更新');
      saveConfig().then(function() {
        if (_isRunning) {
          for (var i = 0; i < TYPES.length; i++) stopTimer(TYPES[i]);
          for (var j = 0; j < TYPES.length; j++) startTimer(TYPES[j]);
          console.log('[AutoSocialUpdater] 定时器已重启');
        }
      });
    },

    triggerUpdate: function(type) {
      if (type === 'all') {
        console.log('[AutoSocialUpdater] 手动触发全部更新');
        return triggerUpdate('weibo').then(function() { return triggerUpdate('friends'); })
          .then(function() { return triggerUpdate('forum'); });
      }
      console.log('[AutoSocialUpdater] 手动触发 ' + type);
      return triggerUpdate(type);
    },

    getStats: function() {
      return {
        isRunning: _isRunning,
        stats: JSON.parse(JSON.stringify(_stats)),
        lastUpdate: {
          weibo: _lastUpdate.weibo ? new Date(_lastUpdate.weibo).toLocaleString('zh-CN') : '从未',
          friends: _lastUpdate.friends ? new Date(_lastUpdate.friends).toLocaleString('zh-CN') : '从未',
          forum: _lastUpdate.forum ? new Date(_lastUpdate.forum).toLocaleString('zh-CN') : '从未'
        },
        activeTimers: { weibo: !!_timers.weibo, friends: !!_timers.friends, forum: !!_timers.forum },
        modulesAvailable: {
          weiboManager: !!window.weiboManager, friendsCircle: !!window.friendsCircle, forumManager: !!window.forumManager
        }
      };
    }
  };

  console.log('[AutoSocialUpdater] 模块已加载');
})();
