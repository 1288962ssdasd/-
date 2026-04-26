// ============================================================
// context-sync.js -- 三层上下文架构：手机聊天摘要生成、注入ST主上下文、同步监听
// 职责：
//   第一层（ST主上下文）：世界书+向量记忆+角色卡+主聊天记录 → AI做决策
//   第二层（手机摘要上下文）：手机LLM总结的结构化摘要 → 通过变量让AI知道手机里聊了什么
//   第三层（手机UI上下文）：消息渲染、朋友圈、语音TTS → 纯UI展示，不影响AI
// 关键原则：AI只看到摘要，看不到手机UI细节
// 运行环境：Android WebView + Node.js（不使用 ES Module、顶层 await、optional chaining 等）
// 依赖：window.XBBridge, window.BridgeAPI, window.RoleAPI, window.SillyTavern.getContext()
// ============================================================

(function () {
  'use strict';

  // ===== 常量 =====
  var LOG_PREFIX = '[ContextSync]';

  // 世界书条目固定key（用于匹配和创建）
  var WB_ENTRY_KEYS = '手机聊天/微信/小手机/手机摘要';
  // 世界书条目固定comment（辅助标识）
  var WB_ENTRY_COMMENT = '[ContextSync] 手机聊天摘要自动注入条目';

  // 防抖时间（毫秒）
  var DEBOUNCE_MS = 3000;
  // 用户发消息后延迟生成摘要（毫秒）
  var USER_MSG_DELAY_MS = 5000;
  // AI回复后延迟生成摘要（毫秒）
  var AI_REPLY_DELAY_MS = 3000;
  // 同一好友摘要更新的最小间隔（毫秒）— 避免每次对话都生成
  var SUMMARY_COOLDOWN_MS = 60000; // 60秒冷却

  // ===== 内部状态 =====
  var _isWatching = false;
  var _debounceTimers = {};    // friendId -> timerId
  var _summaryCache = {};      // friendId -> summaryObject
  var _lastSummaryTime = {};   // friendId -> timestamp（上次摘要更新时间）
  var _wbEntryUid = null;      // 已创建的世界书条目UID
  var _wbFile = null;          // 当前使用的世界书文件名
  var _pendingSummaries = {};  // friendId -> { timerId, friendName }
  var _stEventHandlers = {};   // eventName -> handlerRef

  // ===== 工具函数 =====

  function log() {
    var args = [LOG_PREFIX];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console.log.apply(console, args);
  }

  function warn() {
    var args = [LOG_PREFIX];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console.warn.apply(console, args);
  }

  function logError() {
    var args = [LOG_PREFIX];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console.error.apply(console, args);
  }

  /**
   * 安全读取配置值，带默认值
   */
  function getConfig(key, defaultVal) {
    if (window.BridgeAPI && window.BridgeAPI.ConfigManager) {
      return window.BridgeAPI.ConfigManager.get(key).then(function (val) {
        if (val !== null && val !== undefined && val !== '') return val;
        return defaultVal;
      }).catch(function () {
        return defaultVal;
      });
    }
    return Promise.resolve(defaultVal);
  }

  /**
   * 获取摘要变量名
   */
  function getSummaryVarName(friendName) {
    return 'xb.phone.chatSummary.' + friendName;
  }

  /**
   * 防抖：同一好友在 DEBOUNCE_MS 内不重复生成摘要
   * 返回 true 表示应该执行，false 表示被防抖跳过
   */
  function shouldDebounce(friendId) {
    if (_debounceTimers[friendId]) {
      clearTimeout(_debounceTimers[friendId]);
      delete _debounceTimers[friendId];
      return true; // 已有定时器，说明之前被防抖了，现在应该执行
    }
    return true;
  }

  /**
   * 设置防抖标记
   */
  function setDebounce(friendId) {
    _debounceTimers[friendId] = setTimeout(function () {
      delete _debounceTimers[friendId];
    }, DEBOUNCE_MS);
  }

  // ===== 规则摘要生成器（小白X不可用时的降级方案） =====

  /**
   * 情感关键词映射
   */
  var MOOD_KEYWORDS = {
    '开心': ['哈哈', '嘻嘻', '开心', '高兴', '好棒', '太好了', '喜欢', '爱你', '么么', '❤', '😊', '😄', '🥰', '哇', '棒', '赞'],
    '暧昧': ['想你', '思念', '喜欢', '亲爱的', '宝贝', '抱抱', '亲亲', '晚安', '早点睡', '注意身体', '关心', '在干嘛', '想见', '❤', '😘', '🥺', '宝贝'],
    '紧张': ['急', '担心', '害怕', '紧张', '怎么办', '救命', '不好', '麻烦', '出事', '危险', '😱', '😰'],
    '冷淡': ['哦', '嗯', '行', '随便', '无所谓', '不想', '别烦', '忙', '没空', '再说', '不想理', '拜拜']
  };

  /**
   * 基于关键词匹配的简单规则摘要生成
   * @param {Array} messages - 聊天记录数组 [{role, content, time}]
   * @param {string} friendName - 好友名
   * @returns {object} 结构化摘要
   */
  function generateRuleBasedSummary(messages, friendName) {
    var allText = '';
    var userTexts = [];
    var aiTexts = [];
    var i, msg, content;

    for (i = 0; i < messages.length; i++) {
      msg = messages[i];
      content = (msg.msgContent || msg.content || '').replace(/<[^>]+>/g, '').trim();
      if (!content) continue;
      allText += content + ' ';
      if (msg.role === 'user') {
        userTexts.push(content);
      } else {
        aiTexts.push(content);
      }
    }

    // 1. 判断情绪
    var mood = '平淡';
    var moodScores = {};
    var moodKeys = Object.keys(MOOD_KEYWORDS);
    for (i = 0; i < moodKeys.length; i++) {
      moodScores[moodKeys[i]] = 0;
    }
    for (i = 0; i < moodKeys.length; i++) {
      var mk = moodKeys[i];
      var keywords = MOOD_KEYWORDS[mk];
      for (var ki = 0; ki < keywords.length; ki++) {
        if (allText.indexOf(keywords[ki]) !== -1) {
          moodScores[mk]++;
        }
      }
    }
    var maxScore = 0;
    for (i = 0; i < moodKeys.length; i++) {
      if (moodScores[moodKeys[i]] > maxScore) {
        maxScore = moodScores[moodKeys[i]];
        mood = moodKeys[i];
      }
    }

    // 2. 提取话题
    var topic = '日常闲聊';
    var topicKeywords = {
      '工作': ['工作', '上班', '加班', '开会', '项目', '老板', '同事', '客户'],
      '美食': ['吃', '饭', '餐厅', '外卖', '做饭', '好吃', '饿', '火锅', '奶茶'],
      '约会': ['见面', '约会', '出去', '逛街', '看电影', '吃饭', '去哪'],
      '情感': ['喜欢', '爱', '分手', '在一起', '恋爱', '男朋友', '女朋友', '老公', '老婆'],
      '游戏': ['游戏', '打游戏', '王者', '吃鸡', '原神'],
      '学习': ['学习', '考试', '作业', '复习', '课程', '老师']
    };
    var topicScores = {};
    var topicNames = Object.keys(topicKeywords);
    for (i = 0; i < topicNames.length; i++) {
      topicScores[topicNames[i]] = 0;
      var tks = topicKeywords[topicNames[i]];
      for (var ti = 0; ti < tks.length; ti++) {
        if (allText.indexOf(tks[ti]) !== -1) {
          topicScores[topicNames[i]]++;
        }
      }
    }
    var maxTopicScore = 0;
    for (i = 0; i < topicNames.length; i++) {
      if (topicScores[topicNames[i]] > maxTopicScore) {
        maxTopicScore = topicScores[topicNames[i]];
        topic = topicNames[i];
      }
    }

    // 3. 关键事件检测
    var keyEvent = '';
    var eventPatterns = [
      { pattern: /分手|拜拜|再见|不联系/, event: '可能发生了分手或关系破裂' },
      { pattern: /对不起|抱歉|原谅|错了/, event: '发生了道歉事件' },
      { pattern: /生日|礼物|惊喜|庆祝/, event: '有生日或庆祝相关事件' },
      { pattern: /生病|不舒服|医院|药/, event: '有人生病或身体不适' },
      { pattern: /吵架|生气|烦|讨厌/, event: '发生了争吵或不愉快' },
      { pattern: /见面|约会|出去|一起/, event: '有见面或约会安排' }
    ];
    for (i = 0; i < eventPatterns.length; i++) {
      if (eventPatterns[i].pattern.test(allText)) {
        keyEvent = eventPatterns[i].event;
        break;
      }
    }

    // 4. 关系变化检测
    var relationshipChange = '';
    var relPatterns = [
      { pattern: /我喜欢你|我爱你|在一起/, change: '关系升温，表达了爱意' },
      { pattern: /分手|算了|不合适/, change: '关系降温，出现裂痕' },
      { pattern: /谢谢|感激|太好了/, change: '关系有所改善' }
    ];
    for (i = 0; i < relPatterns.length; i++) {
      if (relPatterns[i].pattern.test(allText)) {
        relationshipChange = relPatterns[i].change;
        break;
      }
    }

    // 5. 生成一句话总结
    var summary = friendName + '和用户进行了' + messages.length + '条消息的' + topic + '，氛围' + mood;
    if (keyEvent) summary += '，' + keyEvent;
    if (relationshipChange) summary += '，' + relationshipChange;

    return {
      mood: mood,
      topic: topic,
      keyEvent: keyEvent || '无',
      relationshipChange: relationshipChange || '无',
      summary: summary
    };
  }

  // ===== LLM摘要生成器（小白X可用时） =====

  /**
   * 构建摘要生成的LLM消息
   */
  function buildSummaryMessages(messages, friendName) {
    var chatContent = '';
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      var role = msg.role === 'user' ? '用户' : friendName;
      var content = (msg.msgContent || msg.content || '').replace(/<[^>]+>/g, '').trim();
      if (!content) continue;
      if (content.length > 150) content = content.substring(0, 150) + '...';
      chatContent += role + ': ' + content + '\n';
    }

    var systemPrompt = '你是一个聊天摘要助手。请根据以下聊天记录，生成一个结构化的JSON摘要。\n' +
      '要求：\n' +
      '1. 严格按照JSON格式输出，不要输出其他内容\n' +
      '2. mood字段：从"开心/平淡/紧张/暧昧/冷淡"中选择一个\n' +
      '3. topic字段：简短描述聊了什么话题（5个字以内）\n' +
      '4. keyEvent字段：关键事件描述（如无则填"无"）\n' +
      '5. relationshipChange字段：关系变化描述（如无则填"无"）\n' +
      '6. summary字段：一句话总结（30个字以内）\n\n' +
      '输出格式示例：\n' +
      '{"mood":"开心","topic":"日常闲聊","keyEvent":"无","relationshipChange":"无","summary":"两人愉快地聊了最近的美食体验"}';

    var userPrompt = '以下是' + friendName + '和用户的最近聊天记录：\n\n' + chatContent + '\n请生成摘要JSON：';

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }

  /**
   * 调用LLM生成摘要
   */
  function generateLLMSummary(messages, friendName) {
    if (!window.XBBridge || !window.XBBridge.generate || !window.XBBridge.isAvailable()) {
      return Promise.reject(new Error('小白X不可用'));
    }

    var llmMessages = buildSummaryMessages(messages, friendName);

    return window.XBBridge.generate.generate({
      provider: 'inherit',
      messages: llmMessages,
      max_tokens: 300,
      temperature: 0.3
    }).then(function (result) {
      var text = '';
      if (typeof result === 'string') {
        text = result;
      } else if (result && result.choices && result.choices[0]) {
        text = result.choices[0].message && result.choices[0].message.content
          ? result.choices[0].message.content
          : (result.choices[0].text || '');
      } else if (result && typeof result === 'object') {
        text = result.text || result.content || result.message || JSON.stringify(result);
      }

      // 尝试解析JSON
      text = text.trim();
      // 去除可能的 markdown 代码块包裹
      if (text.indexOf('```') === 0) {
        text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      try {
        var parsed = JSON.parse(text);
        // 校验必要字段
        if (!parsed.mood) parsed.mood = '平淡';
        if (!parsed.topic) parsed.topic = '日常闲聊';
        if (!parsed.keyEvent) parsed.keyEvent = '无';
        if (!parsed.relationshipChange) parsed.relationshipChange = '无';
        if (!parsed.summary) parsed.summary = friendName + '和用户进行了聊天';
        return parsed;
      } catch (e) {
        warn('LLM摘要JSON解析失败，回退到规则生成:', e, '原文:', text.substring(0, 100));
        return generateRuleBasedSummary(messages, friendName);
      }
    });
  }

  // ===== 世界书操作 =====

  /**
   * 获取当前聊天绑定的世界书文件名
   */
  function getCurrentWorldbookFile() {
    if (!window.XBBridge || !window.XBBridge.worldbook) {
      return Promise.resolve(null);
    }

    return window.XBBridge.worldbook.getChatBook({}).then(function (result) {
      if (result && result.file_name) {
        return result.file_name;
      }
      // 尝试其他格式
      if (result && typeof result === 'string') {
        return result;
      }
      if (result && result.name) {
        return result.name;
      }
      return null;
    }).catch(function (e) {
      warn('获取当前世界书失败:', e);
      return null;
    });
  }

  /**
   * 在世界书中查找摘要条目
   */
  function findSummaryEntry(wbFile) {
    if (!window.XBBridge || !window.XBBridge.worldbook) {
      return Promise.resolve(null);
    }

    var params = { file: wbFile, field: 'comment', text: WB_ENTRY_COMMENT };
    return window.XBBridge.worldbook.findEntry(params).then(function (result) {
      if (result && result.uid) {
        return result;
      }
      // 尝试通过key搜索
      var keyParams = { file: wbFile, field: 'key', text: '手机摘要' };
      return window.XBBridge.worldbook.findEntry(keyParams).then(function (keyResult) {
        if (keyResult && keyResult.uid) {
          return keyResult;
        }
        return null;
      });
    }).catch(function (e) {
      warn('查找世界书条目失败:', e);
      return null;
    });
  }

  /**
   * 创建世界书摘要条目
   */
  function createSummaryEntry(wbFile) {
    if (!window.XBBridge || !window.XBBridge.worldbook) {
      warn('XBBridge.worldbook 不可用，无法创建世界书条目');
      return Promise.resolve(null);
    }

    log('创建世界书摘要条目, file:', wbFile);
    return window.XBBridge.worldbook.createEntry({
      file: wbFile,
      key: WB_ENTRY_KEYS,
      content: '{{char}}最近和用户的手机聊天状态：\n（等待摘要生成）\n基于此调整{{char}}的行为和态度。',
      comment: WB_ENTRY_COMMENT,
      constant: true,
      enabled: true,
      selective: false,
      insertion_order: 100,
      position: 0
    }).then(function (result) {
      if (result && result.uid) {
        log('世界书条目创建成功, uid:', result.uid);
        _wbEntryUid = result.uid;
        _wbFile = wbFile;
        return result;
      }
      warn('世界书条目创建返回无效结果:', result);
      return null;
    }).catch(function (e) {
      logError('创建世界书条目失败:', e);
      return null;
    });
  }

  /**
   * 更新世界书条目的content字段
   */
  function updateSummaryEntryContent(uid, wbFile, content) {
    if (!window.XBBridge || !window.XBBridge.worldbook) {
      warn('XBBridge.worldbook 不可用，无法更新世界书条目');
      return Promise.resolve(false);
    }

    return window.XBBridge.worldbook.setEntryField({
      file: wbFile,
      uid: uid,
      field: 'content',
      value: content
    }).then(function (result) {
      log('世界书条目内容已更新, uid:', uid);
      return true;
    }).catch(function (e) {
      logError('更新世界书条目内容失败:', e);
      return false;
    });
  }

  // ===== 主模块：ContextSync =====

  var ContextSync = {

    // ---------- 1. 手机聊天摘要生成器 ----------

    /**
     * 生成指定好友的聊天摘要
     * @param {string} friendName - 好友名称
     * @param {string} friendId - 好友ID
     * @returns {Promise<object|null>} 摘要对象
     */
    summarizeChat: function (friendName, friendId) {
      var self = this;
      if (!friendName || !friendId) {
        warn('summarizeChat: 参数无效', friendName, friendId);
        return Promise.resolve(null);
      }

      // 防抖检查
      if (!shouldDebounce(friendId)) {
        log('summarizeChat: 防抖跳过', friendName);
        return Promise.resolve(null);
      }
      setDebounce(friendId);

      log('summarizeChat: 开始生成摘要', friendName, friendId);

      // 1. 获取聊天记录
      var messages = [];
      if (window.RoleAPI && window.RoleAPI.getChatHistory) {
        messages = window.RoleAPI.getChatHistory(friendId) || [];
      }

      // 同时检查自动消息历史
      var autoMessages = [];
      if (window.RoleAPI && window.RoleAPI.getAutoMsgHistory) {
        autoMessages = window.RoleAPI.getAutoMsgHistory(friendId) || [];
      }

      // 合并并按时间排序，取最近N条
      var allMessages = messages.concat(autoMessages);
      allMessages.sort(function (a, b) {
        return (a.time || 0) - (b.time || 0);
      });

      return getConfig('xb.phone.summary.maxMessages', 10).then(function (maxMsg) {
        var maxCount = parseInt(maxMsg) || 10;
        var recentMessages = allMessages.slice(-maxCount);

        if (recentMessages.length < 2) {
          log('summarizeChat: 消息不足2条，跳过摘要生成', friendName, '共', recentMessages.length, '条');
          return null;
        }

        log('summarizeChat: 使用', recentMessages.length, '条消息生成摘要', friendName);

        // 2. 尝试使用LLM生成摘要
        var useLLM = window.XBBridge && window.XBBridge.isAvailable() && window.XBBridge.generate;

        if (useLLM) {
          log('summarizeChat: 使用LLM生成摘要', friendName);
          return generateLLMSummary(recentMessages, friendName).then(function (summary) {
            return self._saveSummary(friendName, friendId, summary);
          }).catch(function (e) {
            warn('summarizeChat: LLM生成失败，回退到规则生成', friendName, e);
            var fallbackSummary = generateRuleBasedSummary(recentMessages, friendName);
            return self._saveSummary(friendName, friendId, fallbackSummary);
          });
        } else {
          log('summarizeChat: 小白X不可用，使用规则生成摘要', friendName);
          var ruleSummary = generateRuleBasedSummary(recentMessages, friendName);
          return self._saveSummary(friendName, friendId, ruleSummary);
        }
      });
    },

    /**
     * 保存摘要到变量和缓存
     * @private
     */
    _saveSummary: function (friendName, friendId, summary) {
      var self = this;
      var varName = getSummaryVarName(friendName);
      var summaryStr = JSON.stringify(summary);

      // 截断过长的摘要
      return getConfig('xb.phone.summary.maxLength', 500).then(function (maxLen) {
        var max = parseInt(maxLen) || 500;
        if (summaryStr.length > max) {
          summary.summary = summary.summary.substring(0, max - 100) + '...';
          summaryStr = JSON.stringify(summary);
        }

        // 写入变量
        if (window.BridgeAPI && window.BridgeAPI.setVar) {
          return window.BridgeAPI.setVar(varName, summaryStr).then(function () {
            log('_saveSummary: 摘要已写入变量', varName);
            // 更新缓存
            _summaryCache[friendId] = summary;
            return summary;
          }).catch(function (e) {
            warn('_saveSummary: 写入变量失败', varName, e);
            _summaryCache[friendId] = summary;
            return summary;
          });
        } else {
          warn('_saveSummary: BridgeAPI.setVar 不可用，仅缓存');
          _summaryCache[friendId] = summary;
          return summary;
        }
      });
    },

    // ---------- 2. 摘要注入到ST主上下文 ----------

    /**
     * 将好友摘要注入到ST主上下文的世界书条目中
     * @param {string} friendName - 好友名称
     * @returns {Promise<boolean>} 是否成功
     */
    injectSummaryToContext: function (friendName) {
      var self = this;
      if (!friendName) {
        warn('injectSummaryToContext: 参数无效');
        return Promise.resolve(false);
      }

      log('injectSummaryToContext: 开始注入摘要', friendName);

      // 1. 读取摘要变量
      var varName = getSummaryVarName(friendName);
      var summaryStr = null;

      var readPromise = Promise.resolve(null);
      if (window.BridgeAPI && window.BridgeAPI.getVar) {
        readPromise = window.BridgeAPI.getVar(varName);
      }

      return readPromise.then(function (val) {
        summaryStr = val;

        if (!summaryStr) {
          // 尝试从缓存读取
          var cachedIds = Object.keys(_summaryCache);
          for (var i = 0; i < cachedIds.length; i++) {
            if (_summaryCache[cachedIds[i]] && _summaryCache[cachedIds[i]]._friendName === friendName) {
              summaryStr = JSON.stringify(_summaryCache[cachedIds[i]]);
              break;
            }
          }
        }

        if (!summaryStr) {
          log('injectSummaryToContext: 无摘要数据', friendName);
          return false;
        }

        // 2. 获取当前世界书
        return getCurrentWorldbookFile().then(function (wbFile) {
          if (!wbFile) {
            warn('injectSummaryToContext: 无法获取当前世界书');
            return false;
          }

          _wbFile = wbFile;

          // 3. 查找或创建世界书条目
          return findSummaryEntry(wbFile).then(function (entry) {
            if (entry && entry.uid) {
              _wbEntryUid = entry.uid;
              log('injectSummaryToContext: 找到已有条目, uid:', entry.uid);
            } else {
              log('injectSummaryToContext: 未找到条目，将创建新条目');
              return createSummaryEntry(wbFile);
            }
            return _wbEntryUid ? { uid: _wbEntryUid } : null;
          }).then(function (entryInfo) {
            if (!entryInfo || !entryInfo.uid) {
              warn('injectSummaryToContext: 无法获取世界书条目UID');
              return false;
            }

            // 4. 构建条目内容
            var content = '{{char}}最近和用户的手机聊天状态：\n' +
              '{{xbgetvar_yaml::' + varName + '}}\n' +
              '基于此调整{{char}}的行为和态度。';

            // 5. 更新条目内容
            return updateSummaryEntryContent(entryInfo.uid, wbFile, content);
          });
        });
      }).then(function (success) {
        if (success) {
          log('injectSummaryToContext: 摘要注入成功', friendName);
        }
        return success;
      }).catch(function (e) {
        logError('injectSummaryToContext: 注入失败', friendName, e);
        return false;
      });
    },

    /**
     * 注入所有已缓存好友的摘要
     * @returns {Promise}
     */
    injectAllSummaries: function () {
      var self = this;
      var friendNames = Object.keys(_summaryCache);
      if (friendNames.length === 0) {
        log('injectAllSummaries: 无缓存摘要');
        return Promise.resolve();
      }

      log('injectAllSummaries: 注入', friendNames.length, '个好友的摘要');
      var chain = Promise.resolve();
      for (var i = 0; i < friendNames.length; i++) {
        (function (fid) {
          var cached = _summaryCache[fid];
          if (cached) {
            // 尝试从缓存中获取friendName
            var fname = cached._friendName || fid;
            chain = chain.then(function () {
              return self.injectSummaryToContext(fname);
            });
          }
        })(friendNames[i]);
      }
      return chain;
    },

    // ---------- 3. 上下文同步监听器 ----------

    /**
     * 启动上下文同步监听
     * 监听ST事件和手机聊天活动
     */
    startWatching: function () {
      var self = this;
      if (_isWatching) {
        log('startWatching: 已在监听中');
        return;
      }

      _isWatching = true;
      log('startWatching: 启动上下文同步监听');

      // 3.1 监听ST事件
      if (window.XBBridge && window.XBBridge.events && window.XBBridge.EVENT_NAMES) {
        var EVENT_NAMES = window.XBBridge.EVENT_NAMES;

        // MESSAGE_RECEIVED — AI回复后，检查是否需要更新手机摘要
        var onMessageReceived = function () {
          log('startWatching: 收到 MESSAGE_RECEIVED 事件');
          self._scheduleSummaryUpdate('ai_reply');
        };
        _stEventHandlers[EVENT_NAMES.MESSAGE_RECEIVED] = onMessageReceived;
        window.XBBridge.events.on(EVENT_NAMES.MESSAGE_RECEIVED, onMessageReceived);

        // GENERATE_AFTER — AI生成完成后
        var onGenerateAfter = function () {
          log('startWatching: 收到 GENERATE_AFTER 事件');
          self._scheduleSummaryUpdate('ai_reply');
        };
        _stEventHandlers[EVENT_NAMES.GENERATE_AFTER] = onGenerateAfter;
        window.XBBridge.events.on(EVENT_NAMES.GENERATE_AFTER, onGenerateAfter);

        // CHAT_CHANGED — 聊天切换时，清空当前摘要缓存
        var onChatChanged = function () {
          log('startWatching: 收到 CHAT_CHANGED 事件，清空摘要缓存');
          self._clearSummaryCache();
        };
        _stEventHandlers[EVENT_NAMES.CHAT_CHANGED] = onChatChanged;
        window.XBBridge.events.on(EVENT_NAMES.CHAT_CHANGED, onChatChanged);

        // MESSAGE_SENT — 用户发送消息后
        var onMessageSent = function () {
          log('startWatching: 收到 MESSAGE_SENT 事件');
          self._scheduleSummaryUpdate('user_msg');
        };
        _stEventHandlers[EVENT_NAMES.MESSAGE_SENT] = onMessageSent;
        window.XBBridge.events.on(EVENT_NAMES.MESSAGE_SENT, onMessageSent);

        log('startWatching: ST事件监听已注册');
      } else {
        warn('startWatching: XBBridge.events 不可用，跳过ST事件监听');
      }

      // 3.2 监听手机聊天活动（通过RoleAPI历史变化）
      self._watchPhoneChatActivity();

      // 3.3 初始化世界书条目
      self._ensureWorldbookEntry();

      log('startWatching: 上下文同步监听已启动');
    },

    /**
     * 停止上下文同步监听
     */
    stopWatching: function () {
      var self = this;
      if (!_isWatching) {
        log('stopWatching: 未在监听中');
        return;
      }

      _isWatching = false;
      log('stopWatching: 停止上下文同步监听');

      // 移除ST事件监听
      if (window.XBBridge && window.XBBridge.events) {
        var eventNames = Object.keys(_stEventHandlers);
        for (var i = 0; i < eventNames.length; i++) {
          window.XBBridge.events.off(eventNames[i], _stEventHandlers[eventNames[i]]);
        }
        _stEventHandlers = {};
        log('stopWatching: ST事件监听已移除');
      }

      // 清除所有待处理的摘要生成定时器
      var pendingKeys = Object.keys(_pendingSummaries);
      for (var j = 0; j < pendingKeys.length; j++) {
        if (_pendingSummaries[pendingKeys[j]] && _pendingSummaries[pendingKeys[j]].timerId) {
          clearTimeout(_pendingSummaries[pendingKeys[j]].timerId);
        }
      }
      _pendingSummaries = {};

      // 清除防抖定时器
      var debounceKeys = Object.keys(_debounceTimers);
      for (var k = 0; k < debounceKeys.length; k++) {
        clearTimeout(_debounceTimers[debounceKeys[k]]);
      }
      _debounceTimers = {};

      log('stopWatching: 所有定时器已清除');
    },

    /**
     * 调度摘要更新
     * @private
     * @param {string} trigger - 触发类型 ('user_msg' | 'ai_reply')
     */
    _scheduleSummaryUpdate: function (trigger) {
      var self = this;
      var delay = trigger === 'user_msg' ? USER_MSG_DELAY_MS : AI_REPLY_DELAY_MS;

      // 获取当前正在聊天的好友
      var friendId = null;
      var friendName = null;

      if (window.messageApp && window.messageApp.currentFriendId) {
        friendId = window.messageApp.currentFriendId;
      }
      if (window.messageApp && window.messageApp.currentFriend) {
        friendName = window.messageApp.currentFriend.name || window.messageApp.currentFriend;
      }

      if (!friendId) {
        log('_scheduleSummaryUpdate: 无当前聊天好友，跳过');
        return;
      }

      // 如果没有friendName，尝试从friendRenderer获取
      if (!friendName && window.friendRenderer && window.friendRenderer.friends) {
        var friends = window.friendRenderer.friends;
        for (var i = 0; i < friends.length; i++) {
          if (String(friends[i].number) === String(friendId)) {
            friendName = friends[i].name;
            break;
          }
        }
      }

      if (!friendName) {
        friendName = friendId; // 降级使用ID作为名称
      }

      // 冷却检查：同一好友在冷却期内不重复生成摘要
      var lastTime = _lastSummaryTime[friendId] || 0;
      var now = Date.now();
      if (now - lastTime < SUMMARY_COOLDOWN_MS) {
        log('_scheduleSummaryUpdate: 冷却中，跳过', friendName, '剩余:', Math.round((SUMMARY_COOLDOWN_MS - (now - lastTime)) / 1000) + 's');
        return;
      }

      log('_scheduleSummaryUpdate: 调度摘要更新', friendName, friendId, '触发:', trigger, '延迟:', delay + 'ms');

      // 取消之前的待处理摘要
      if (_pendingSummaries[friendId] && _pendingSummaries[friendId].timerId) {
        clearTimeout(_pendingSummaries[friendId].timerId);
      }

      // 设置新的定时器
      var timerId = setTimeout(function () {
        delete _pendingSummaries[friendId];
        log('_scheduleSummaryUpdate: 开始执行摘要更新', friendName);

        self.summarizeChat(friendName, friendId).then(function (summary) {
          if (summary) {
            // 记录本次摘要更新时间（冷却计时）
            _lastSummaryTime[friendId] = Date.now();
            // 注入到ST主上下文
            return self.injectSummaryToContext(friendName);
          }
          return null;
        }).catch(function (e) {
          warn('_scheduleSummaryUpdate: 摘要更新失败', friendName, e);
        });
      }, delay);

      _pendingSummaries[friendId] = {
        timerId: timerId,
        friendName: friendName,
        trigger: trigger
      };
    },

    /**
     * 监听手机聊天活动
     * 通过定期检查RoleAPI历史变化来检测新消息
     * @private
     */
    _watchPhoneChatActivity: function () {
      var self = this;
      var lastKnownLengths = {};

      // 初始化已知长度
      if (window.RoleAPI) {
        var chatIds = Object.keys(window.RoleAPI.chatHistories || {});
        for (var i = 0; i < chatIds.length; i++) {
          var history = window.RoleAPI.chatHistories[chatIds[i]];
          if (history) {
            lastKnownLengths[chatIds[i]] = history.length;
          }
        }
      }

      // 每2秒检查一次
      var watchInterval = setInterval(function () {
        if (!_isWatching) {
          clearInterval(watchInterval);
          return;
        }

        if (!window.RoleAPI || !window.RoleAPI.chatHistories) return;

        var currentIds = Object.keys(window.RoleAPI.chatHistories);
        for (var j = 0; j < currentIds.length; j++) {
          var cid = currentIds[j];
          var currentHistory = window.RoleAPI.chatHistories[cid];
          if (!currentHistory) continue;

          var prevLen = lastKnownLengths[cid] || 0;
          var curLen = currentHistory.length;

          if (curLen > prevLen) {
            // 检测到新消息
            var lastMsg = currentHistory[currentHistory.length - 1];
            var trigger = (lastMsg && lastMsg.role === 'user') ? 'user_msg' : 'ai_reply';

            log('_watchPhoneChatActivity: 检测到新消息', cid, '长度', prevLen, '->', curLen, '触发:', trigger);

            lastKnownLengths[cid] = curLen;

            // 获取好友名
            var fname = cid;
            if (window.friendRenderer && window.friendRenderer.friends) {
              var flist = window.friendRenderer.friends;
              for (var fi = 0; fi < flist.length; fi++) {
                if (String(flist[fi].number) === String(cid)) {
                  fname = flist[fi].name;
                  break;
                }
              }
            }

            // 延迟调度摘要更新
            var delay = trigger === 'user_msg' ? USER_MSG_DELAY_MS : AI_REPLY_DELAY_MS;

            // 取消之前的待处理
            if (_pendingSummaries[cid] && _pendingSummaries[cid].timerId) {
              clearTimeout(_pendingSummaries[cid].timerId);
            }

            (function (fId, fName, trig, d) {
              var tid = setTimeout(function () {
                delete _pendingSummaries[fId];
                self.summarizeChat(fName, fId).then(function (summary) {
                  if (summary) {
                    return self.injectSummaryToContext(fName);
                  }
                  return null;
                }).catch(function (e) {
                  warn('_watchPhoneChatActivity: 摘要更新失败', fName, e);
                });
              }, d);

              _pendingSummaries[fId] = {
                timerId: tid,
                friendName: fName,
                trigger: trig
              };
            })(cid, fname, trigger, delay);
          }
        }

        // 清理不再存在的历史
        var knownIds = Object.keys(lastKnownLengths);
        for (var k = 0; k < knownIds.length; k++) {
          if (currentIds.indexOf(knownIds[k]) === -1) {
            delete lastKnownLengths[knownIds[k]];
          }
        }
      }, 2000);

      log('_watchPhoneChatActivity: 手机聊天活动监听已启动');
    },

    /**
     * 确保世界书条目存在
     * @private
     */
    _ensureWorldbookEntry: function () {
      var self = this;
      if (!window.XBBridge || !window.XBBridge.worldbook) {
        warn('_ensureWorldbookEntry: XBBridge.worldbook 不可用');
        return;
      }

      getCurrentWorldbookFile().then(function (wbFile) {
        if (!wbFile) {
          warn('_ensureWorldbookEntry: 无法获取世界书文件');
          return;
        }

        _wbFile = wbFile;

        return findSummaryEntry(wbFile).then(function (entry) {
          if (entry && entry.uid) {
            _wbEntryUid = entry.uid;
            log('_ensureWorldbookEntry: 已有摘要条目, uid:', entry.uid);
          } else {
            log('_ensureWorldbookEntry: 创建默认摘要条目');
            return createSummaryEntry(wbFile);
          }
        });
      }).catch(function (e) {
        warn('_ensureWorldbookEntry: 初始化失败', e);
      });
    },

    /**
     * 清空摘要缓存
     * @private
     */
    _clearSummaryCache: function () {
      var keys = Object.keys(_summaryCache);
      _summaryCache = {};
      _wbEntryUid = null;
      _wbFile = null;

      // 清除所有待处理的摘要生成
      var pendingKeys = Object.keys(_pendingSummaries);
      for (var i = 0; i < pendingKeys.length; i++) {
        if (_pendingSummaries[pendingKeys[i]] && _pendingSummaries[pendingKeys[i]].timerId) {
          clearTimeout(_pendingSummaries[pendingKeys[i]].timerId);
        }
      }
      _pendingSummaries = {};

      log('_clearSummaryCache: 已清空', keys.length, '条缓存');
    },

    // ---------- 4. 手机内LLM调度 ----------

    /**
     * 生成动态事件
     * 根据当前世界状态，调用LLM生成一个动态事件描述
     * @param {object} worldState - 世界状态对象
     * @returns {Promise<string|null>} 事件描述
     */
    generateDynamicEvent: function (worldState) {
      var self = this;
      if (!worldState || typeof worldState !== 'object') {
        warn('generateDynamicEvent: 参数无效');
        return Promise.resolve(null);
      }

      log('generateDynamicEvent: 开始生成动态事件');

      // 构建世界状态描述
      var stateDesc = '';
      if (worldState.scene) stateDesc += '当前场景: ' + worldState.scene + '\n';
      if (worldState.phase) stateDesc += '当前阶段: ' + worldState.phase + '\n';
      if (worldState.activeChar) stateDesc += '当前角色: ' + worldState.activeChar + '\n';
      if (worldState.time) stateDesc += '当前时间: ' + worldState.time + '\n';
      if (worldState.weather) stateDesc += '天气: ' + worldState.weather + '\n';
      if (worldState.money) stateDesc += '金钱: ' + worldState.money + '\n';
      if (worldState.friends) stateDesc += '好友: ' + worldState.friends + '\n';

      // 如果有额外状态信息
      if (worldState.extra) {
        var extraKeys = Object.keys(worldState.extra);
        for (var i = 0; i < extraKeys.length; i++) {
          stateDesc += extraKeys[i] + ': ' + worldState.extra[extraKeys[i]] + '\n';
        }
      }

      var systemPrompt = '你是一个游戏事件生成器。根据当前世界状态，生成一个可能发生的动态事件。\n' +
        '要求：\n' +
        '1. 事件应该自然、合理，符合当前世界状态\n' +
        '2. 事件应该有趣，能推动剧情发展\n' +
        '3. 只输出事件描述（1-3句话），不要输出其他内容\n' +
        '4. 不要使用markdown格式\n' +
        '5. 事件可以是：某人发来消息、某个NPC出现、天气变化、突发事件等';

      var userPrompt = '当前世界状态：\n' + stateDesc + '\n请生成一个动态事件：';

      // 尝试使用小白X
      if (window.XBBridge && window.XBBridge.isAvailable() && window.XBBridge.generate) {
        return window.XBBridge.generate.generate({
          provider: 'inherit',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 200,
          temperature: 0.8
        }).then(function (result) {
          var text = '';
          if (typeof result === 'string') {
            text = result;
          } else if (result && result.choices && result.choices[0]) {
            text = result.choices[0].message && result.choices[0].message.content
              ? result.choices[0].message.content
              : (result.choices[0].text || '');
          } else if (result && typeof result === 'object') {
            text = result.text || result.content || result.message || '';
          }

          text = text.trim();
          if (!text) {
            warn('generateDynamicEvent: LLM返回空内容');
            return null;
          }

          log('generateDynamicEvent: 事件已生成', text.substring(0, 50));

          // 写入变量
          if (window.BridgeAPI && window.BridgeAPI.setVar) {
            return window.BridgeAPI.setVar('xb.phone.pendingEvent', text).then(function () {
              log('generateDynamicEvent: 已写入 xb.phone.pendingEvent');
              return text;
            }).catch(function (e) {
              warn('generateDynamicEvent: 写入变量失败', e);
              return text;
            });
          }
          return text;
        }).catch(function (e) {
          warn('generateDynamicEvent: LLM生成失败', e);
          return null;
        });
      } else {
        // 降级：使用预设事件
        var presetEvents = [
          '手机突然收到一条未知号码的消息',
          '窗外传来一阵喧闹声',
          '手机电量提醒：电量低于20%',
          '天气预报推送：明天有雨',
          '朋友圈有人发了一条新动态'
        ];
        var event = presetEvents[Math.floor(Math.random() * presetEvents.length)];
        log('generateDynamicEvent: 使用预设事件（小白X不可用）', event);

        if (window.BridgeAPI && window.BridgeAPI.setVar) {
          return window.BridgeAPI.setVar('xb.phone.pendingEvent', event).then(function () {
            return event;
          }).catch(function () {
            return event;
          });
        }
        return Promise.resolve(event);
      }
    },

    /**
     * 生成朋友圈内容
     * 为指定角色生成一条朋友圈动态
     * @param {string} friendName - 角色名
     * @param {string} scene - 场景描述
     * @returns {Promise<string|null>} 朋友圈内容
     */
    generateMomentsContent: function (friendName, scene) {
      var self = this;
      if (!friendName) {
        warn('generateMomentsContent: 参数无效');
        return Promise.resolve(null);
      }

      scene = scene || '日常';
      log('generateMomentsContent: 开始生成朋友圈内容', friendName, '场景:', scene);

      var systemPrompt = '你是一个朋友圈内容生成器。为指定角色生成一条自然的朋友圈动态。\n' +
        '要求：\n' +
        '1. 内容要符合角色性格\n' +
        '2. 像真人发朋友圈一样自然（可以有emoji）\n' +
        '3. 长度在10-50字之间\n' +
        '4. 只输出朋友圈文字内容，不要输出其他内容\n' +
        '5. 不要使用markdown格式或代码块';

      var userPrompt = '角色: ' + friendName + '\n场景: ' + scene + '\n请生成一条朋友圈动态：';

      // 尝试使用小白X
      if (window.XBBridge && window.XBBridge.isAvailable() && window.XBBridge.generate) {
        return window.XBBridge.generate.generate({
          provider: 'inherit',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 100,
          temperature: 0.9
        }).then(function (result) {
          var text = '';
          if (typeof result === 'string') {
            text = result;
          } else if (result && result.choices && result.choices[0]) {
            text = result.choices[0].message && result.choices[0].message.content
              ? result.choices[0].message.content
              : (result.choices[0].text || '');
          } else if (result && typeof result === 'object') {
            text = result.text || result.content || result.message || '';
          }

          text = text.trim();
          if (!text) {
            warn('generateMomentsContent: LLM返回空内容');
            return null;
          }

          log('generateMomentsContent: 朋友圈内容已生成', text.substring(0, 50));

          // 写入变量
          if (window.BridgeAPI && window.BridgeAPI.setVar) {
            return window.BridgeAPI.setVar('xb.phone.moments.lastContent', text).then(function () {
              log('generateMomentsContent: 已写入 xb.phone.moments.lastContent');
              return text;
            }).catch(function (e) {
              warn('generateMomentsContent: 写入变量失败', e);
              return text;
            });
          }
          return text;
        }).catch(function (e) {
          warn('generateMomentsContent: LLM生成失败', e);
          return null;
        });
      } else {
        // 降级：使用预设朋友圈内容
        var presetMoments = [
          '今天天气真好~',
          '又是无聊的一天...',
          '分享一张照片',
          '突然想吃火锅了',
          '生活不易，且行且珍惜',
          '晚安~',
          '今天遇到了一件有趣的事',
          '好累啊，想休息'
        ];
        var content = presetMoments[Math.floor(Math.random() * presetMoments.length)];
        log('generateMomentsContent: 使用预设内容（小白X不可用）', content);

        if (window.BridgeAPI && window.BridgeAPI.setVar) {
          return window.BridgeAPI.setVar('xb.phone.moments.lastContent', content).then(function () {
            return content;
          }).catch(function () {
            return content;
          });
        }
        return Promise.resolve(content);
      }
    },

    // ---------- 5. 辅助方法 ----------

    /**
     * 获取指定好友的当前摘要
     * @param {string} friendId - 好友ID
     * @returns {object|null} 摘要对象
     */
    getSummary: function (friendId) {
      if (_summaryCache[friendId]) {
        return _summaryCache[friendId];
      }
      return null;
    },

    /**
     * 获取所有已缓存的摘要
     * @returns {object} { friendId: summaryObject }
     */
    getAllSummaries: function () {
      var result = {};
      var keys = Object.keys(_summaryCache);
      for (var i = 0; i < keys.length; i++) {
        result[keys[i]] = _summaryCache[keys[i]];
      }
      return result;
    },

    /**
     * 手动触发指定好友的摘要生成和注入
     * @param {string} friendName - 好友名
     * @param {string} friendId - 好友ID
     * @returns {Promise}
     */
    refreshSummary: function (friendName, friendId) {
      var self = this;
      log('refreshSummary: 手动刷新摘要', friendName, friendId);

      return self.summarizeChat(friendName, friendId).then(function (summary) {
        if (summary) {
          // 保存friendName到缓存中以便后续使用
          summary._friendName = friendName;
          _summaryCache[friendId] = summary;
          return self.injectSummaryToContext(friendName);
        }
        return null;
      });
    },

    /**
     * 获取当前监听状态
     * @returns {boolean}
     */
    isWatching: function () {
      return _isWatching;
    },

    /**
     * 获取当前世界书条目信息
     * @returns {object} { uid, file }
     */
    getWorldbookEntryInfo: function () {
      return {
        uid: _wbEntryUid,
        file: _wbFile
      };
    },

    /**
     * 初始化方法
     * 自动检测依赖并决定是否启动监听
     */
    init: function () {
      var self = this;
      log('init: 初始化三层上下文架构');

      // 检查依赖
      var hasXBBridge = !!(window.XBBridge);
      var hasBridgeAPI = !!(window.BridgeAPI);
      var hasRoleAPI = !!(window.RoleAPI);

      log('init: 依赖检查 - XBBridge:', hasXBBridge, 'BridgeAPI:', hasBridgeAPI, 'RoleAPI:', hasRoleAPI);

      if (!hasBridgeAPI) {
        warn('init: BridgeAPI 不可用，摘要变量读写将受限');
      }

      if (!hasRoleAPI) {
        warn('init: RoleAPI 不可用，聊天记录获取将受限');
      }

      if (!hasXBBridge) {
        warn('init: XBBridge 不可用，将使用规则生成摘要（不调用LLM）');
      }

      // 读取配置决定是否自动启动监听
      return getConfig('xb.phone.contextSync.enabled', 'true').then(function (enabled) {
        if (enabled === 'true') {
          self.startWatching();
        } else {
          log('init: 上下文同步已禁用（配置 xb.phone.contextSync.enabled = false）');
        }
      }).catch(function () {
        // 配置读取失败时默认启动
        self.startWatching();
      });
    },

    /**
     * 销毁方法，清理所有资源
     */
    destroy: function () {
      var self = this;
      self.stopWatching();
      _summaryCache = {};
      _wbEntryUid = null;
      _wbFile = null;
      log('destroy: 资源已清理');
    }
  };

  // ===== 挂载全局 =====
  window.ContextSync = ContextSync;

  // ===== 初始化日志 =====
  log('模块已加载');
  log('三层上下文架构：');
  log('  第一层（ST主上下文）：世界书+向量记忆+角色卡+主聊天记录 → AI做决策');
  log('  第二层（手机摘要上下文）：手机LLM总结的结构化摘要 → 通过变量让AI知道手机里聊了什么');
  log('  第三层（手机UI上下文）：消息渲染、朋友圈、语音TTS → 纯UI展示，不影响AI');
  log('关键原则：AI只看到摘要，看不到手机UI细节');

})();
