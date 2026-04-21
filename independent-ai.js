// ============================================================
// independent-ai.js v2.0 — 重构版
// 职责：独立LLM聊天 + 四选项渲染 + 图片管理 + 统一调度
// 运行环境：SillyTavern 外置手机3.0插件（安卓Node.js封装APP）
// ============================================================

// ===== 模块1：配置管理 (ConfigManager) =====
// 从小白X变量系统读取/写入配置，30秒缓存，统一入口

const ConfigManager = {
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
        'xb.phone.image.autoInsert': 'true',
        'xb.phone.image.interval': '5',

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
        'xb.ui.hideMainChat': 'false'
    },

    // 读取小白X变量
    async _readVar(key) {
        try {
            if (window.STscript) {
                var val = await window.STscript('/getvar key=' + key);
                if (val && val !== '' && val !== 'undefined' && val !== 'null') return val;
            }
        } catch (e) { /* STscript不可用 */ }
        return null;
    },

    // 写入小白X变量
    async _writeVar(key, value) {
        try {
            if (window.STscript) {
                await window.STscript('/setvar key=' + key + ' ' + String(value));
                this._cache = null; // 清除缓存
                return true;
            }
        } catch (e) {
            console.warn('[ConfigManager] 写入失败:', key, e);
        }
        return false;
    },

    // 批量加载所有配置（带缓存）
    async getAll() {
        var now = Date.now();
        if (this._cache && (now - this._cacheTime) < this.CACHE_TTL) {
            return this._cache;
        }
        var config = {};
        var keys = Object.keys(this.defaults);
        for (var i = 0; i < keys.length; i++) {
            var val = await this._readVar(keys[i]);
            if (val !== null) {
                config[keys[i]] = val;
            } else {
                config[keys[i]] = this.defaults[keys[i]];
            }
        }
        this._cache = config;
        this._cacheTime = now;
        return config;
    },

    // 读取单个配置
    async get(key) {
        var config = await this.getAll();
        return config[key];
    },

    // 写入单个配置
    async set(key, value) {
        return await this._writeVar(key, value);
    },

    init() {
        console.log('[ConfigManager] 初始化完成');
    }
};

// ===== 模块2：独立AI聊天 (IndependentAI) =====
// 独立LLM聊天、自动消息、变量管理

const IndependentAI = {
    chatHistories: {},        // 用户主动聊天的历史（每个好友独立）
    autoMsgHistories: {},     // 主动消息历史（独立隔离）
    isGenerating: false,
    abortController: null,
    _systemPromptCache: null,
    _systemPromptCacheTime: 0,
    _autoMsgTimer: null,
    _autoMsgRunning: false,
    _msgCount: 0,

    // ---------- 初始化 ----------

    async init() {
        this._loadHistories();
        this._loadAutoMsgHistories();
        this._watchCharacterChange();
        await this._syncGameVariables();
        console.log('[IndependentAI] 初始化完成');
    },

    // ---------- 同步游戏变量 ----------
    async _syncGameVariables() {
        try {
            // 从小白X游戏变量同步到全局变量
            var currentChar = await ConfigManager._readVar('游戏数据.系统.当前角色');
            if (currentChar && currentChar !== '') {
                await ConfigManager.set('xb.game.activeChar', currentChar);
            }
            var currentScene = await ConfigManager._readVar('游戏数据.系统.当前场景');
            if (currentScene && currentScene !== '') {
                await ConfigManager.set('xb.game.scene', currentScene);
            }
            var currentPhase = await ConfigManager._readVar('游戏数据.系统.当前阶段');
            if (currentPhase && currentPhase !== '') {
                await ConfigManager.set('xb.game.phase', currentPhase);
            }
            console.log('[IndependentAI] 游戏变量同步完成');
        } catch(e) {
            console.warn('[IndependentAI] 游戏变量同步失败:', e);
        }
    },

    // ---------- 配置与状态 ----------

    isEnabled() {
        var config = this.getAPIConfig();
        var enabled = !!(config && config.apiKey && config.apiUrl);
        if (enabled) this.startAutoMessages();
        return enabled;
    },

    getAPIConfig() {
        // 优先从 window.mobileCustomAPIConfig 读取
        if (window.mobileCustomAPIConfig) {
            var settings = window.mobileCustomAPIConfig.currentSettings;
            if (settings && settings.apiKey && settings.apiKey !== '你的API Key' && !/[^\x00-\x7F]/.test(settings.apiKey)) {
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

    // ---------- 历史记录持久化 ----------

    _getCurrentCharName() {
        try {
            var el = document.querySelector('#character_name_input') ||
                     document.querySelector('.character_select .selected_char_name');
            return el ? (el.value || el.textContent || '').trim() : '';
        } catch (e) { return ''; }
    },

    _loadHistories() {
        try {
            var charName = this._getCurrentCharName();
            var saved = localStorage.getItem('mobile_independent_ai_histories_' + (charName || 'default'));
            this.chatHistories = saved ? JSON.parse(saved) : {};
        } catch (e) { this.chatHistories = {}; }
    },

    _loadAutoMsgHistories() {
        try {
            var charName = this._getCurrentCharName();
            var saved = localStorage.getItem('mobile_independent_ai_auto_histories_' + (charName || 'default'));
            this.autoMsgHistories = saved ? JSON.parse(saved) : {};
        } catch (e) { this.autoMsgHistories = {}; }
    },

    _saveHistories() {
        try {
            var charName = this._getCurrentCharName();
            localStorage.setItem('mobile_independent_ai_histories_' + (charName || 'default'), JSON.stringify(this.chatHistories));
        } catch (e) { /* 忽略 */ }
    },

    _saveAutoMsgHistories() {
        try {
            var charName = this._getCurrentCharName();
            localStorage.setItem('mobile_independent_ai_auto_histories_' + (charName || 'default'), JSON.stringify(this.autoMsgHistories));
        } catch (e) { /* 忽略 */ }
    },

    getChatHistory(friendId) {
        if (!this.chatHistories[friendId]) this.chatHistories[friendId] = [];
        return this.chatHistories[friendId];
    },

    getAutoMsgHistory(friendId) {
        if (!this.autoMsgHistories[friendId]) this.autoMsgHistories[friendId] = [];
        return this.autoMsgHistories[friendId];
    },

    addToHistory(friendId, role, content, meta) {
        var history = this.getChatHistory(friendId);
        var entry = { role: role, content: content, time: Date.now() };
        if (meta) {
            entry.fullMatch = meta.fullMatch || null;
            entry.messageType = meta.messageType || '文字';
            entry.msgContent = meta.content || content;
        }
        history.push(entry);
        if (history.length > 30) this.chatHistories[friendId] = history.slice(-30);
        this._saveHistories();
    },

    addToAutoMsgHistory(friendId, role, content) {
        var history = this.getAutoMsgHistory(friendId);
        history.push({ role: role, content: content, time: Date.now() });
        if (history.length > 10) this.autoMsgHistories[friendId] = history.slice(-10);
        this._saveAutoMsgHistories();
    },

    clearHistory(friendId) {
        this.chatHistories[friendId] = [];
        this._saveHistories();
    },

    clearAllHistories() {
        var count = Object.keys(this.chatHistories).length;
        this.chatHistories = {};
        this.autoMsgHistories = {};
        this._saveHistories();
        this._saveAutoMsgHistories();
        this._clearPhoneVars();
        if (window.friendRenderer && window.friendRenderer.friends) {
            window.friendRenderer.friends = [];
            window.friendRenderer.refresh();
        }
        console.log('[IndependentAI] 已清除所有聊天记录和变量，共', count, '个联系人');
    },

    async _clearPhoneVars() {
        var names = ['苏晚晴', '柳如烟', '王捷', '苏媚', '吴梦娜'];
        for (var i = 0; i < names.length; i++) {
            await this.setVar('phone.' + names[i] + '.summary', '');
            await this.setVar('phone.' + names[i] + '.affection', '50');
            await this.setVar('phone.' + names[i] + '.msgCount', '0');
            await this.setVar('phone.' + names[i] + '.lastActive', '');
        }
        await this.setVar('phone.global.context', '');
    },

    // 监听角色切换
    _watchCharacterChange() {
        var self = this;
        var lastCharId = this._getCurrentCharName();
        setInterval(function() {
            try {
                var current = self._getCurrentCharName();
                if (current && lastCharId && current !== lastCharId) {
                    console.log('[IndependentAI] 角色切换:', lastCharId, '->', current);
                    self._loadHistories();
                    self._loadAutoMsgHistories();
                    if (window.friendRenderer && window.friendRenderer.refresh) window.friendRenderer.refresh();
                }
                if (current) lastCharId = current;
            } catch (e) { /* 忽略 */ }
        }, 5000);
        window.addEventListener('hashchange', function() { setTimeout(function() {
            var current = self._getCurrentCharName();
            if (current && lastCharId && current !== lastCharId) {
                self._loadHistories();
                self._loadAutoMsgHistories();
            }
        }, 1000); });
    },

    // ---------- 变量管理 ----------

    async getVar(key) {
        return await ConfigManager._readVar(key);
    },

    async setVar(key, value) {
        return await ConfigManager._writeVar(key, value);
    },

    async readFriendVars(friendName) {
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
        for (var i = 0; i < keys.length; i++) {
            var val = await this.getVar(keys[i]);
            if (val !== null) vars[keys[i].replace('phone.' + friendName + '.', '')] = val;
        }
        for (var j = 0; j < legacyKeys.length; j++) {
            var lval = await this.getVar(legacyKeys[j]);
            if (lval !== null) vars['legacy_' + legacyKeys[j].split('.').pop()] = lval;
        }
        return vars;
    },

    async readGlobalContext() {
        return await this.getVar('phone.global.context');
    },

    async writeChatSummary(friendName, friendId) {
        var history = this.getChatHistory(friendId);
        if (!history || history.length < 2) return;
        var recent = history.slice(-6);
        var summary = '';
        for (var i = 0; i < recent.length; i++) {
            var role = recent[i].role === 'user' ? '吴宇伦' : friendName;
            var content = (recent[i].msgContent || recent[i].content || '').substring(0, 80);
            summary += role + ': ' + content + '\n';
        }
        if (summary.length > 300) summary = summary.substring(0, 300) + '...';
        await this.setVar('phone.' + friendName + '.summary', summary);
        await this.setVar('phone.' + friendName + '.msgCount', String(history.length));
        await this.setVar('phone.' + friendName + '.lastActive', new Date().toLocaleString('zh-CN'));
    },

    async updateFriendVars(friendName, friendId) {
        var current = await this.getVar('phone.' + friendName + '.affection');
        var val = parseInt(current) || 50;
        await this.setVar('phone.' + friendName + '.affection', String(Math.min(100, val + 1)));
        await this.writeChatSummary(friendName, friendId);
    },

    // ---------- System Prompt构建 ----------

    async buildSystemPrompt(friendName, friendId) {
        var now = Date.now();
        if (this._systemPromptCache && (now - this._systemPromptCacheTime) < 60000) {
            return this._systemPromptCache;
        }

        var prompt = '';

        // 1. 读取角色卡
        try {
            if (window.SillyTavern && window.SillyTavern.getContext) {
                var context = window.SillyTavern.getContext();
                if (context && context.characterId !== undefined) {
                    var charData = context.characters && context.characters[context.characterId];
                    if (charData) {
                        var charName = charData.name || '';
                        var desc = charData.description || '';
                        var sysPrompt = charData.system_prompt || '';
                        var personality = charData.personality || '';

                        prompt += '=== Role Setting ===\n';
                        prompt += 'Game: ' + charName + '\n';
                        prompt += 'Player: 吴宇伦\n\n';

                        if (desc) {
                            prompt += '=== World View ===\n';
                            prompt += desc.substring(0, 2000) + '\n\n';
                        }
                        if (personality) {
                            prompt += '=== Style ===\n';
                            prompt += personality + '\n\n';
                        }
                        if (sysPrompt) {
                            prompt += '=== Core Rules ===\n';
                            var sections = ['角色管理与切换规则', '沉沦度追踪系统', '手机消息系统'];
                            for (var si = 0; si < sections.length; si++) {
                                var regex = new RegExp('[一二三四五六七八九十]+、' + sections[si] + '[\\s\\S]*?(?=[一二三四五六七八九十]+、|$)', 'i');
                                var match = sysPrompt.match(regex);
                                if (match) prompt += match[0].trim() + '\n\n';
                            }
                        }
                    }
                }
            }
        } catch (e) { /* 忽略 */ }

        // 2. 读取世界书
        try {
            var worldInfo = await import('/scripts/world-info.js');
            if (worldInfo && worldInfo.world_info && worldInfo.world_info.world) {
                var entries = worldInfo.world_info.world.entries || {};
                var entryList = Object.values(entries);
                var relevantEntries = entryList.filter(function(entry) {
                    var keys = entry.key || entry.keys || [];
                    var comment = entry.comment || '';
                    var allText = (Array.isArray(keys) ? keys.join(' ') : String(keys)) + ' ' + comment;
                    return allText.indexOf(friendName) !== -1 || allText.indexOf(friendId) !== -1;
                });
                if (relevantEntries.length > 0) {
                    prompt += '=== Character Profile: ' + friendName + ' ===\n';
                    for (var ri = 0; ri < relevantEntries.length; ri++) {
                        var content = relevantEntries[ri].content || '';
                        if (content.length < 3000) prompt += content + '\n\n';
                    }
                }
            }
        } catch (e) { /* 忽略 */ }

        // 3. 读取最近ST聊天上下文（最近3条，每条最多100字）
        try {
            if (window.SillyTavern && window.SillyTavern.getContext) {
                var ctx = window.SillyTavern.getContext();
                var chat = ctx.chat || [];
                if (chat.length > 0) {
                    var recent = chat.slice(-3);
                    var stContext = '=== Recent Main Chat (for context only, do not repeat) ===\n';
                    for (var ci = 0; ci < recent.length; ci++) {
                        var role = recent[ci].is_user ? '吴宇伦' : 'AI';
                        var text = (recent[ci].mes || '').replace(/<[^>]+>/g, '').trim();
                        if (text.length > 100) text = text.substring(0, 100) + '...';
                        if (text) stContext += role + ': ' + text + '\n';
                    }
                    prompt += stContext + '\n';
                }
            }
        } catch (e) { /* 忽略 */ }

        // 4. 读取好友变量和全局上下文
        var affectionInfo = '';
        try {
            var vars = await this.readFriendVars(friendName);
            if (vars.affection) affectionInfo += '好感度: ' + vars.affection + '/100\n';
            else if (vars.legacy_沉沦度) affectionInfo += '沉沦度: ' + vars.legacy_沉沦度 + '/100\n';
            if (vars.legacy_阶段) affectionInfo += '关系阶段: ' + vars.legacy_阶段 + '\n';
            if (vars.msgCount) affectionInfo += '已聊天: ' + vars.msgCount + '条\n';

            var globalCtx = await this.readGlobalContext();
            if (globalCtx) {
                prompt += '=== 当前剧情状态 ===\n';
                prompt += globalCtx + '\n\n';
            }
        } catch (e) { /* 忽略 */ }

        // 4.5 读取全局游戏状态变量（从ConfigManager读取，带回退默认值）
        try {
            var activeChar = (await ConfigManager.get('xb.game.activeChar')) || '苏晚晴';
            var phase = (await ConfigManager.get('xb.game.phase')) || '完全职业';
            var scene = (await ConfigManager.get('xb.game.scene')) || '翡翠湾小区';
            var money = (await ConfigManager.get('xb.game.money')) || '10000';
            var rose = (await ConfigManager.get('xb.game.rose')) || '0';
            var friends = (await ConfigManager.get('xb.game.friends')) || '';

            prompt += '=== 游戏状态（从全局变量读取） ===\n';
            prompt += '当前活跃角色: ' + activeChar + '\n';
            prompt += '当前阶段: ' + phase + '\n';
            prompt += '当前场景: ' + scene + '\n';
            prompt += '当前金钱: ' + money + '\n';
            prompt += '玫瑰值: ' + rose + '\n';
            if (friends) prompt += '已添加的好友: ' + friends + '\n';
            prompt += '\n';
        } catch (e) { /* 忽略 */ }

        // 5. 手机聊天模式核心指令
        prompt += '=== 手机聊天模式 ===\n';
        prompt += '你是' + friendName + '，正在通过微信和吴宇伦聊天。\n';
        if (affectionInfo) prompt += affectionInfo + '\n';
        prompt += '严格规则:\n';
        prompt += '1. 只以' + friendName + '的身份回复，像真人发微信一样简短随意（1-3句话）\n';
        prompt += '2. 根据上面的角色档案和关系阶段保持人设\n';
        prompt += '3. 偶尔用emoji，像真人聊天\n';
        prompt += '4. 不要推进主线剧情、切换场景或时间跳跃\n';
        prompt += '5. 不要输出旁白、环境描写或心理描写\n';
        prompt += '6. 不要生成四选项（[真情][套路][试探][行动]）\n';
        prompt += '7. 不要输出状态栏、<state>标签、变量更新或游戏数据\n';
        prompt += '8. 不要使用 > 📱 格式或代码块\n';
        prompt += '9. 不要在回复中使用内部标签如[勾引][思考][分析][表情包|xxx]\n';
        prompt += '10. 根据好感度/沉沦度自然反应\n';
        prompt += '11. 只输出纯文本回复或图片URL，不要任何其他前缀、标签或元数据\n';
        prompt += '12. 当需要发送图片时，先说一句简短的话（1句话），然后换行输出图片URL。\n';
        prompt += '格式：一句话\nhttps://cdn.jsdelivr.net/gh/1288962ssdasd/images@main/角色名_编号.jpg\n';
        prompt += '角色名用当前聊天对象的名字。可用编号：001-016。\n';
        prompt += '必须使用完整的CDN直链URL（含@main分支），不要使用github.com网页链接。\n';
        prompt += '13. 图片编号对应场景：001=登场/日常，002=特定场景日常，003=约会/亲密互动，004=沉沦阶段1，005=沉沦阶段2，006=沉沦阶段3，007=沉沦阶段4/结局\n';
        prompt += '14. 每隔5-8条消息可以发一张图片，不要每条都发\n';
        prompt += '15. 如果需要发送图片，只输出图片URL（一行一个），不要输出HTML标签、不要输出网页链接、不要输出Markdown图片语法\n';

        this._systemPromptCache = prompt;
        this._systemPromptCacheTime = now;
        return prompt;
    },

    // ---------- 构建消息数组 ----------

    buildMessages(friendId, userMessage, systemPrompt) {
        var history = this.getChatHistory(friendId);
        var messages = [{ role: 'system', content: systemPrompt }];
        var recent = history.slice(-10);
        for (var i = 0; i < recent.length; i++) {
            messages.push({ role: recent[i].role, content: recent[i].content });
        }
        messages.push({ role: 'user', content: userMessage });
        return messages;
    },

    // ---------- 核心：发送消息 ----------

    async sendMessage(friendName, friendId, userMessage, meta) {
        if (this.isGenerating) return { success: false, error: '正在生成回复' };

        var config = this.getAPIConfig();
        if (!config || !config.apiUrl || !config.apiKey) {
            return { success: false, error: 'API未配置' };
        }

        this.isGenerating = true;
        this.abortController = new AbortController();

        try {
            // 1. 构建system prompt和消息
            var systemPrompt = await this.buildSystemPrompt(friendName, friendId);
            var messages = this.buildMessages(friendId, userMessage, systemPrompt);
            this.addToHistory(friendId, 'user', userMessage, meta);

            // 2. 显示打字指示器
            this.showTypingIndicator(friendName);

            // 3. 构建API URL
            var apiUrl = config.apiUrl.replace(/\/+$/, '').replace(/^[\s`'"]+|[\s`'"]+$/g, '');
            if (!apiUrl.endsWith('/chat/completions')) {
                if (!apiUrl.endsWith('/v1')) apiUrl += '/v1';
                apiUrl += '/chat/completions';
            }

            // 4. 验证API Key
            var apiKey = String(config.apiKey || '').replace(/^[\s`'"]+|[\s`'"]+$/g, '');
            if (!apiKey || apiKey === '你的API Key' || /[^\x00-\x7F]/.test(apiKey)) {
                throw new Error('API Key未设置或包含无效字符');
            }

            // 5. 流式请求
            var response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: messages,
                    max_tokens: config.maxTokens || 300,
                    temperature: config.temperature || 0.8,
                    stream: true
                }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                var errorText = await response.text();
                throw new Error('API Error ' + response.status + ': ' + errorText.substring(0, 200));
            }

            // 6. 读取流式响应
            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var fullReply = '';
            var buffer = '';

            this.hideTypingIndicator();
            var bubbleEl = this.createStreamBubble(friendName, friendId);

            while (true) {
                var result = await reader.read();
                if (result.done) break;
                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (var li = 0; li < lines.length; li++) {
                    var trimmed = lines[li].trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    var data = trimmed.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        var parsed = JSON.parse(data);
                        var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content;
                        if (delta) {
                            fullReply += delta;
                            this.updateStreamBubble(bubbleEl, fullReply);
                        }
                    } catch (e) { /* 跳过格式错误的JSON */ }
                }
            }

            // 7. 完成流式气泡
            this.finalizeStreamBubble(bubbleEl, fullReply, friendName, friendId);

            // 8. 随机语音消息（20%概率）
            var isVoiceMsg = Math.random() < 0.2 && fullReply.length > 5 && fullReply.length < 100;
            if (isVoiceMsg && window.messageRenderer) {
                var voiceMsgObj = {
                    fullMatch: '[对方消息|' + friendName + '|' + friendId + '|语音|' + fullReply + ']',
                    messageType: '语音',
                    sender: friendName,
                    content: fullReply,
                    number: friendId,
                    isUser: false
                };
                var voiceHtml = window.messageRenderer.renderSingleMessage(voiceMsgObj);
                if (voiceHtml && bubbleEl) {
                    bubbleEl.outerHTML = voiceHtml;
                    if (window.phoneTTS) window.phoneTTS.bindVoiceBubbleEvents();
                    // 修复TTS：确保语音气泡有data-tts-text属性（TTS组件优先读取此属性）
                    setTimeout(function() {
                        var voiceBubble = document.querySelector('.message-detail.message-received:last-child .voice-bubble') ||
                                          document.querySelector('.message-detail.message-received:last-child .message-text');
                        if (voiceBubble) {
                            voiceBubble.dataset.ttsText = fullReply;
                            voiceBubble.setAttribute('data-tts-text', fullReply);
                        }
                    }, 500);
                }
            }

            // 9. 保存到历史
            this.addToHistory(friendId, 'assistant', fullReply, isVoiceMsg ? {
                fullMatch: '[对方消息|' + friendName + '|' + friendId + '|语音|' + fullReply + ']',
                messageType: '语音',
                content: fullReply
            } : null);

            // 10. 滚动到底部
            this.scrollToBottom();

            // 11. 自动添加好友
            if (window.friendRenderer && window.friendRenderer.addFriend) {
                window.friendRenderer.addFriend(friendName, friendId);
            }

            // 12. 自动插入图片（CDN为主，BizyAir可选）
            this._msgCount++;
            var imgInterval = parseInt(await ConfigManager.get('xb.phone.image.interval')) || 5;
            if (this._msgCount % imgInterval === 0 && bubbleEl) {
                var imageAutoInsert = await ConfigManager.get('xb.phone.image.autoInsert');
                if (imageAutoInsert !== 'false') {
                    await ImageManager.insertImage(bubbleEl, friendName);
                }
            }

            // 13. 更新好友变量
            this.updateFriendVars(friendName, friendId);

            console.log('[IndependentAI] 回复完成，长度:', fullReply.length);
            return { success: true, reply: fullReply };

        } catch (error) {
            this.hideTypingIndicator();
            if (error.name === 'AbortError') {
                return { success: false, error: '已取消' };
            }
            console.error('[IndependentAI] 错误:', error);
            return { success: false, error: error.message };
        } finally {
            this.isGenerating = false;
            this.abortController = null;
        }
    },

    cancelGeneration() {
        if (this.abortController) this.abortController.abort();
    },

    // ---------- UI：打字指示器 ----------

    showTypingIndicator(friendName) {
        this.hideTypingIndicator();
        var container = document.querySelector('.messages-container');
        if (!container) return;
        var el = document.createElement('div');
        el.className = 'message-detail message-received independent-typing';
        el.id = 'independent-typing-indicator';
        el.innerHTML = '<span class="message-sender">' + friendName + '</span>' +
            '<div class="message-body"><div class="message-avatar"></div>' +
            '<div class="message-content"><div class="message-text">' +
            '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>' +
            '</div></div></div>';
        container.appendChild(el);
        this.scrollToBottom();
    },

    hideTypingIndicator() {
        var el = document.getElementById('independent-typing-indicator');
        if (el) el.remove();
    },

    // ---------- UI：流式气泡 ----------

    createStreamBubble(friendName, friendId) {
        var container = document.querySelector('.messages-container');
        if (!container) return null;
        var el = document.createElement('div');
        el.className = 'message-detail message-received independent-stream';
        el.id = 'independent-stream-bubble';
        el.innerHTML = '<span class="message-sender">' + friendName + '</span>' +
            '<div class="message-body"><div class="message-avatar"></div>' +
            '<div class="message-content"><div class="message-text">' +
            '<span class="stream-cursor">|</span></div></div></div>';
        container.appendChild(el);
        this.scrollToBottom();
        return el;
    },

    updateStreamBubble(el, text) {
        if (!el) return;
        var textEl = el.querySelector('.message-text');
        if (!textEl) return;
        var imgPattern = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?$/i;
        if (imgPattern.test(text.trim())) {
            textEl.innerHTML = '<div style="color:#888;font-size:0.85em;padding:4px 0;">图片加载中...</div><span class="stream-cursor">|</span>';
        } else {
            textEl.innerHTML = this.escapeHtml(text) + '<span class="stream-cursor">|</span>';
        }
        this.scrollToBottom();
    },

    finalizeStreamBubble(el, text, friendName, friendId) {
        if (!el) return;
        var textEl = el.querySelector('.message-text');
        if (!textEl) return;
        var cdnImgPattern = /https?:\/\/cdn\.jsdelivr\.net\/gh\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?/i;
        var generalImgPattern = /https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?/gi;
        var trimmed = text.trim();
        var isPureImgUrl = cdnImgPattern.test(trimmed) && trimmed.replace(cdnImgPattern, '').trim().length < 5;

        if (isPureImgUrl) {
            var urlMatch = trimmed.match(cdnImgPattern);
            var url = urlMatch ? urlMatch[0] : trimmed;
            textEl.innerHTML = '<img src="' + this.escapeHtml(url) + '" ' +
                'style="max-width:200px;border-radius:8px;cursor:pointer;display:block;" ' +
                'onclick="window.independentAI._enlargeImage(this)" ' +
                'onerror="this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\',\'<span style=color:#c0392b;font-size:.85em>图片加载失败</span>\')" />';
        } else if (generalImgPattern.test(text)) {
            generalImgPattern.lastIndex = 0;
            var rendered = this.escapeHtml(text);
            rendered = rendered.replace(
                /(https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?)/gi,
                function(match) {
                    return '<img src="' + match + '" ' +
                        'style="max-width:200px;border-radius:8px;cursor:pointer;display:block;margin:4px 0;" ' +
                        'onclick="window.independentAI._enlargeImage(this)" ' +
                        'onerror="this.style.display=\'none\'" />';
                }
            );
            textEl.innerHTML = rendered;
        } else {
            textEl.textContent = text;
        }
        el.classList.remove('independent-stream');
    },

    _enlargeImage(imgEl) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        var bigImg = document.createElement('img');
        bigImg.src = imgEl.src;
        bigImg.style.cssText = 'max-width:95%;max-height:95%;object-fit:contain;border-radius:8px;';
        overlay.appendChild(bigImg);
        overlay.addEventListener('click', function() { overlay.remove(); });
        document.body.appendChild(overlay);
    },

    scrollToBottom() {
        setTimeout(function() {
            var el = document.querySelector('.message-detail-content');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    },

    escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ---------- 自动消息（NPC主动发消息） ----------

    startAutoMessages() {
        if (this._autoMsgTimer) return;
        var self = this;
        console.log('[IndependentAI] 自动消息系统已启动');

        ConfigManager.get('xb.phone.autoMsg.interval').then(function(interval) {
            var ms = (parseInt(interval) || 180) * 1000;
            self._autoMsgTimer = setInterval(function() { self._tryAutoMessage(); }, ms);
        });

        // 首次检查在2分钟后
        setTimeout(function() { self._tryAutoMessage(); }, 120000);
    },

    stopAutoMessages() {
        if (this._autoMsgTimer) {
            clearInterval(this._autoMsgTimer);
            this._autoMsgTimer = null;
        }
    },

    _getCurrentFriendId() {
        if (window.messageApp && window.messageApp.currentFriendId) {
            return window.messageApp.currentFriendId;
        }
        return null;
    },

    // ---------- 处理待添加好友（发布-订阅模式消费端） ----------

    async _processPendingFriend() {
        try {
            var pending = await ConfigManager.get('xb.phone.pendingFriend');
            if (!pending || pending === '') return;

            var parts = pending.split('|');
            var name = parts[0] || '';
            var id = parts[1] || '';

            console.log('[IndependentAI] 处理待添加好友:', name, id);

            // 调用 friendRenderer 添加好友
            if (window.friendRenderer && window.friendRenderer.addFriend) {
                window.friendRenderer.addFriend(name, id);
            }

            // 更新好友列表变量
            var friends = await ConfigManager.get('xb.game.friends');
            var friendList = friends ? friends.split(',') : [];
            if (!friendList.includes(name)) {
                friendList.push(name);
                await ConfigManager.set('xb.game.friends', friendList.join(','));
            }

            // 清空待处理变量
            await ConfigManager.set('xb.phone.pendingFriend', '');
            console.log('[IndependentAI] 待添加好友已处理:', name);
        } catch (e) {
            console.warn('[IndependentAI] 处理待添加好友失败:', e);
        }
    },

    async _processPendingMessages() {
        try {
            var pending = await ConfigManager.get('xb.phone.pendingMsg');
            if (!pending || pending === '') return;

            // messageRenderer可能还没加载，延迟重试
            if (!window.messageRenderer || !window.messageRenderer.renderSingleMessage) {
                console.log('[IndependentAI] messageRenderer未就绪，延迟处理pendingMsg');
                return; // 不清空变量，下次重试
            }

            var parts = pending.split('|');
            if (parts.length < 4) return;

            var charName = parts[0];
            var charId = parts[1];
            var msgType = parts[2];
            var content = parts.slice(3).join('|');

            console.log('[IndependentAI] 处理待发送消息:', charName, msgType, content.substring(0, 30));

            var msgObj = {
                fullMatch: '[对方消息|' + charName + '|' + charId + '|' + msgType + '|' + content + ']',
                messageType: msgType,
                content: content,
                senderName: charName,
                senderId: charId
            };
            window.messageRenderer.renderSingleMessage(msgObj);
            console.log('[IndependentAI] ✅ 消息已渲染到小手机');

            // 清空变量
            await ConfigManager.set('xb.phone.pendingMsg', '');
        } catch(e) {
            console.warn('[IndependentAI] 处理待发送消息失败:', e);
        }
    },

    async _tryAutoMessage() {
        if (this._autoMsgRunning || this.isGenerating) return;

        // 先检查待添加好友变量（发布-订阅模式消费）
        await this._processPendingFriend();
        // 消费待发送消息变量（微信弹窗任务写入）
        await this._processPendingMessages();

        // 读取配置
        var autoMsgEnabled = await ConfigManager.get('xb.phone.autoMsg.enabled');
        if (autoMsgEnabled === 'false') return;

        var probability = parseInt(await ConfigManager.get('xb.phone.autoMsg.probability')) || 30;
        if (Math.random() * 100 > probability) return;

        // 筛选有足够交互历史的好友
        var friendsWithHistory = Object.keys(this.autoMsgHistories).filter(function(id) {
            return this.autoMsgHistories[id] && this.autoMsgHistories[id].length >= 2;
        }.bind(this));

        var chatFriends = Object.keys(this.chatHistories).filter(function(id) {
            return this.chatHistories[id] && this.chatHistories[id].length >= 4;
        }.bind(this));

        var allEligibleIds = [];
        var seen = {};
        for (var i = 0; i < friendsWithHistory.length; i++) {
            if (!seen[friendsWithHistory[i]]) { allEligibleIds.push(friendsWithHistory[i]); seen[friendsWithHistory[i]] = true; }
        }
        for (var j = 0; j < chatFriends.length; j++) {
            if (!seen[chatFriends[j]]) { allEligibleIds.push(chatFriends[j]); seen[chatFriends[j]] = true; }
        }

        if (allEligibleIds.length < 2) return;

        var phoneFriends = (window.friendRenderer && window.friendRenderer.friends) || [];
        var phoneFriendIds = {};
        for (var k = 0; k < phoneFriends.length; k++) phoneFriendIds[String(phoneFriends[k].number)] = true;

        var currentFriend = this._getCurrentFriendId();
        var eligible = allEligibleIds.filter(function(id) {
            return id !== currentFriend && phoneFriendIds[String(id)];
        });

        if (eligible.length === 0) return;

        var targetId = eligible[Math.floor(Math.random() * eligible.length)];
        var friendName = targetId;

        // 获取好友名字
        for (var fi = 0; fi < phoneFriends.length; fi++) {
            if (String(phoneFriends[fi].number) === String(targetId) && phoneFriends[fi].name) {
                friendName = phoneFriends[fi].name;
                break;
            }
        }
        if (friendName === targetId) {
            var hist = this.chatHistories[targetId] || this.autoMsgHistories[targetId] || [];
            if (hist.length > 0) {
                var lastMsg = hist[hist.length - 1];
                friendName = lastMsg.msgContent || lastMsg.content || targetId;
            }
        }

        this._autoMsgRunning = true;
        try {
            var proactivePrompts = [
                '突然想起一件事，想跟你分享...',
                '你现在在忙吗？',
                '刚刚看到一个东西，觉得你会喜欢',
                '无聊了，来骚扰你一下~',
                '你在干嘛呀？',
                '有点想你...',
                '刚刚发生了一件好笑的事',
                '你今天过得怎么样？'
            ];
            var randomPrompt = proactivePrompts[Math.floor(Math.random() * proactivePrompts.length)];

            // 使用独立的system prompt
            var systemPrompt = await this.buildSystemPrompt(friendName, targetId);
            var shortPrompt = systemPrompt.substring(0, 2000) +
                '\n\nYou are sending a proactive message to 吴宇伦. ' +
                'Send ONLY the message content (1-2 sentences), no quotes, no prefixes. ' +
                'Be in character. The message should feel natural and spontaneous.';

            // 使用独立的主动消息历史
            var autoHistory = this.getAutoMsgHistory(targetId);
            var autoMessages = [{ role: 'system', content: shortPrompt }];
            var recentAuto = autoHistory.slice(-3);
            for (var ai = 0; ai < recentAuto.length; ai++) {
                autoMessages.push({ role: recentAuto[ai].role, content: recentAuto[ai].content });
            }
            autoMessages.push({
                role: 'user',
                content: 'Send a proactive WeChat message to 吴宇伦. Context: ' + randomPrompt
            });

            var apiConfig = this.getAPIConfig();
            if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiUrl) return;

            var apiUrl = apiConfig.apiUrl.replace(/\/+$/, '').replace(/^[\s`'"]+|[\s`'"]+$/g, '');
            if (!apiUrl.endsWith('/chat/completions')) {
                if (!apiUrl.endsWith('/v1')) apiUrl += '/v1';
                apiUrl += '/chat/completions';
            }

            var response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiConfig.apiKey
                },
                body: JSON.stringify({
                    model: apiConfig.model || 'Qwen/Qwen2.5-7B-Instruct',
                    messages: autoMessages,
                    max_tokens: 100,
                    temperature: 0.9
                })
            });

            if (!response.ok) return;
            var data = await response.json();
            var aiText = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (aiText) aiText = aiText.trim();
            if (!aiText || aiText.length > 200) return;

            // 保存到独立历史
            this.addToAutoMsgHistory(targetId, 'user', randomPrompt);
            this.addToAutoMsgHistory(targetId, 'assistant', aiText);

            // 同时保存到用户可见的聊天历史
            this.addToHistory(targetId, 'assistant', aiText, {
                fullMatch: '[对方消息|' + friendName + '|' + targetId + '|文字|' + aiText + ']',
                messageType: '文字',
                content: aiText
            });

            if (window.friendRenderer && window.friendRenderer.addFriend) {
                window.friendRenderer.addFriend(friendName, targetId);
            }

            console.log('[IndependentAI] 主动消息来自', friendName, ':', aiText.substring(0, 50));
        } catch (e) {
            console.warn('[IndependentAI] 主动消息失败:', e);
        } finally {
            this._autoMsgRunning = false;
        }
    }
};

// ===== 模块3：四选项渲染 (QuickReplyBridge) =====
// 检测并渲染四选项按钮，事件驱动，不使用轮询

const QuickReplyBridge = {
    OPTION_TYPES: {
        '真情': { cls: 'qr-zhenqing', icon: '\u2665' },
        '套路': { cls: 'qr-taolu', icon: '\u2666' },
        '试探': { cls: 'qr-shitan', icon: '\u2660' },
        '行动': { cls: 'qr-xingdong', icon: '\u2663' }
    },

    _observer: null,
    _processedRequests: {},

    async init() {
        // 注入CSS
        this._injectCSS();
        // 初始化事件驱动
        this._initEventDriven();
        // 首次处理已有消息
        await this._processExistingMessages();
        // 注入清除历史按钮
        this._injectClearButton();

        // 启动好友请求扫描（每5秒，最多60次）
        this._startFriendRequestScanner();

        // 永久MutationObserver：实时检测按钮被覆盖/消息被重新渲染
        var self = this;
        var chatArea = document.getElementById('chat') || document.body;
        var qrObserver = new MutationObserver(function(mutations) {
            // 防抖：100ms内只处理一次
            if (qrObserver._timer) return;
            qrObserver._timer = setTimeout(function() {
                qrObserver._timer = null;
                var allMsgs = document.querySelectorAll('.mes_text');
                for (var i = 0; i < allMsgs.length; i++) {
                    var el = allMsgs[i];
                    var text = el.textContent || '';
                    var hasOptions = text.includes('真情') || text.includes('套路') || 
                                     text.includes('试探') || text.includes('行动');
                    var hasButtons = el.querySelector('.quick-reply-container');
                    
                    if (hasOptions && !hasButtons) {
                        delete el.dataset.qrDone;
                        self.processMessage(el);
                    }
                    self.hideStateBlocks(el);
                    self.hideThinkingBlocks(el);
                }
            }, 100);
        });
        qrObserver.observe(chatArea, { childList: true, subtree: true, characterData: true });
        console.log('[QuickReplyBridge] 永久MutationObserver已启动');

        console.log('[QuickReplyBridge] 初始化完成');

        // 监听主界面聊天隐藏开关
        this._applyMainChatVisibility();
        var self2 = this;
        setInterval(function() {
            self2._applyMainChatVisibility();
        }, 5000);
    },

    _injectCSS() {
        if (document.getElementById('quick-reply-bridge-inline')) return;
        var css = document.createElement('style');
        css.id = 'quick-reply-bridge-inline';
        css.textContent =
            '.quick-reply-container{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;padding:8px 0}' +
            '.quick-reply-btn{display:inline-flex;align-items:center;padding:10px 18px;border-radius:20px;font-size:.9em;font-weight:500;cursor:pointer;transition:all .2s ease;border:1.5px solid;user-select:none;line-height:1.4;-webkit-tap-highlight-color:transparent;box-sizing:border-box;max-width:100%}' +
            '.quick-reply-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.18);filter:brightness(1.05)}' +
            '.quick-reply-btn:active{transform:translateY(0);box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
            '.quick-reply-btn.qr-zhenqing{background:linear-gradient(135deg,#fff0f3,#ffe0e8);color:#c0392b;border-color:#e8a0b0}' +
            '.quick-reply-btn.qr-taolu{background:linear-gradient(135deg,#f0f4ff,#e0e8ff);color:#2c3e8f;border-color:#a0b0d8}' +
            '.quick-reply-btn.qr-shitan{background:linear-gradient(135deg,#fff8f0,#ffecd0);color:#8b6914;border-color:#d8b870}' +
            '.quick-reply-btn.qr-xingdong{background:linear-gradient(135deg,#f0fff4,#e0f8e8);color:#1a6b3c;border-color:#80c8a0}' +
            '.quick-reply-btn.qr-selected{opacity:.7;border-width:2.5px;box-shadow:0 0 8px rgba(0,0,0,.2)!important;transform:scale(1.03)!important}' +
            '.quick-reply-btn .qr-label{font-weight:600;margin-right:6px;white-space:nowrap}' +
            '.quick-reply-btn .qr-content{font-weight:400;opacity:.85;word-break:break-all}';
        document.head.appendChild(css);
    },

    // 事件驱动初始化（核心修复：不再使用setInterval轮询）
    _initEventDriven() {
        var self = this;
        var stContext = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();

        if (stContext && stContext.eventSource) {
            // 优先使用ST的 CHARACTER_MESSAGE_RENDERED 事件
            stContext.eventSource.on('CHARACTER_MESSAGE_RENDERED', function(msgId) {
                var msgEl = document.querySelector('.mes[mesid="' + msgId + '"] .mes_text');
                if (msgEl) self.processMessage(msgEl);
            });
            // 切换聊天时重新扫描（多次重试，适配手机WebView慢渲染）
            stContext.eventSource.on('CHAT_CHANGED', function() {
                console.log('[QuickReplyBridge] 聊天切换，重新扫描所有消息');
                document.querySelectorAll('.mes_text[data-qr-done]').forEach(function(el) {
                    delete el.dataset.qrDone;
                });
                // 手机WebView渲染较慢，多次重试扫描
                var delays = [500, 1500, 3000, 5000];
                delays.forEach(function(delay) {
                    setTimeout(function() {
                        var unprocessed = document.querySelectorAll('.mes_text:not([data-qr-done])');
                        if (unprocessed.length > 0) {
                            console.log('[QuickReplyBridge] 重试扫描(' + delay + 'ms), 未处理:', unprocessed.length);
                            self._processExistingMessages();
                        }
                    }, delay);
                });
            });
            // 额外监听：AI生成完成后重新扫描（兼容不同ST版本）
            stContext.eventSource.on('GENERATE_AFTER', function() {
                setTimeout(function() {
                    self._processExistingMessages();
                }, 1000);
            });
            console.log('[QuickReplyBridge] 使用ST事件驱动模式');
        } else {
            // 回退：MutationObserver只监听#chat区域，100ms防抖
            console.log('[QuickReplyBridge] ST上下文不可用，使用MutationObserver回退');
            var chatArea = document.getElementById('chat');
            if (chatArea) {
                var timer = null;
                this._observer = new MutationObserver(function(mutations) {
                    if (timer) return;
                    timer = setTimeout(function() {
                        timer = null;
                        for (var mi = 0; mi < mutations.length; mi++) {
                            var m = mutations[mi];
                            if (m.addedNodes) {
                                for (var ni = 0; ni < m.addedNodes.length; ni++) {
                                    var node = m.addedNodes[ni];
                                    if (node.nodeType === 1) {
                                        var mesText = (node.classList && node.classList.contains('mes_text')) ? node
                                            : (node.querySelector && node.querySelector('.mes_text'));
                                        if (mesText) self.processMessage(mesText);
                                    }
                                }
                            }
                        }
                    }, 100);
                });
                this._observer.observe(chatArea, { childList: true, subtree: true });
            }
        }
    },

    // 首次处理已有消息
    async _processExistingMessages() {
        var self = this;
        var msgEls = document.querySelectorAll('.mes_text');
        console.log('[QuickReplyBridge] runAll, unprocessed messages:', msgEls.length);
        for (var i = 0; i < msgEls.length; i++) {
            await self.processMessage(msgEls[i]);
        }
    },

    // ---------- 从innerHTML中提取纯文本（去除HTML标签） ----------
    _extractPlainText(msgEl) {
        var html = msgEl.innerHTML || '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')           // <br> 转换为换行
            .replace(/<\/p>/gi, '\n')                  // </p> 转换为换行
            .replace(/<\/div>/gi, '\n')                // </div> 转换为换行
            .replace(/<li>/gi, '\n')                   // <li> 转换为换行
            .replace(/<[^>]+>/g, '')                    // 去除所有HTML标签
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&\w+;/g, '')                     // 去除其他HTML实体
            .replace(/\*\*/g, '')                       // 去除markdown粗体标记
            .trim();
    },

    // ---------- 提取四选项（核心修复：更宽松的正则匹配） ----------
    extractOptions(msgEl) {
        // 先从innerHTML中提取纯文本（去除HTML标签），解决markdown渲染拆散标签的问题
        var text = this._extractPlainText(msgEl);
        var matches = [];

        // 方法1：匹配 [真情]xxx[/真情] 或 [真情]xxx 格式
        // 使用更宽松的正则，允许标签中间有空格和换行
        var bracketRegex = /\[?\s*(真情|套路|试探|行动)\s*\]?\s*([^\n\[\]【】]{2,})/g;
        var m;
        while ((m = bracketRegex.exec(text)) !== null) {
            var content = m[2].trim();
            // 排除内容本身就是类型名的情况
            if (content && content.length > 1 && !content.match(/^(真情|套路|试探|行动)$/)) {
                matches.push({ type: m[1], content: content });
            }
        }

        // 方法2：emoji前缀匹配
        var emojiMap = {
            '\uD83D\uDC95': '真情', '\u2764\uFE0F': '真情', '\uD83D\uDC97': '真情', '\uD83D\uDC96': '真情',
            '\uD83C\uDFAD': '套路', '\uD83C\uDCCF': '套路',
            '\uD83D\uDD0D': '试探', '\uD83D\uDD0E': '试探', '\uD83D\uDC41\uFE0F': '试探',
            '\u26A1': '行动', '\uD83D\uDD25': '行动', '\uD83D\uDC4A': '行动', '\uD83C\uDFC3': '行动'
        };
        var lines = text.split('\n');
        for (var li = 0; li < lines.length; li++) {
            var line = lines[li].trim();
            if (!line) continue;
            var emojiMatch = line.match(/^([\uD83D\uDC95\u2764\uFE0F\uD83D\uDC97\uD83D\uDC96\uD83C\uDFAD\uD83C\uDCCF\uD83D\uDD0D\uD83D\uDD0E\uD83D\uDC41\uFE0F\u26A1\uD83D\uDD25\uD83D\uDC4A\uD83C\uDFC3])\s+(.+)$/);
            if (emojiMatch) {
                var emoji = emojiMatch[1];
                var rest = emojiMatch[2].trim();
                var mappedType = emojiMap[emoji];
                if (mappedType && rest && rest.length > 1) {
                    // 去重
                    var isDup = false;
                    for (var di = 0; di < matches.length; di++) {
                        if (matches[di].type === mappedType && matches[di].content === rest) { isDup = true; break; }
                    }
                    if (!isDup) matches.push({ type: mappedType, content: rest });
                }
            }
        }

        // 去重：每个type只保留第一个匹配（避免行动/试探重复）
        var seenTypes = {};
        var unique = [];
        for (var di = 0; di < matches.length; di++) {
            if (!seenTypes[matches[di].type]) {
                seenTypes[matches[di].type] = true;
                unique.push(matches[di]);
            }
        }
        return unique;
    },

    // ---------- 隐藏思考标签 ----------
    async hideThinkingBlocks(msgEl) {
        // 从变量读取是否启用隐藏思考标签
        try {
            var hideEnabled = await ConfigManager.get('xb.ui.hideThinking');
            if (hideEnabled === 'false') return;
        } catch (e) { /* 变量读取失败，继续执行 */ }

        if (msgEl.dataset.thinkDone) return;
        msgEl.dataset.thinkDone = '1';

        var thinkEls = msgEl.querySelectorAll('think');
        for (var i = 0; i < thinkEls.length; i++) thinkEls[i].remove();
        msgEl.innerHTML = msgEl.innerHTML.replace(/<think[\s\S]*?<\/think>/gi, '');
        msgEl.innerHTML = msgEl.innerHTML.replace(/<thinking[\s\S]*?<\/thinking>/gi, '');

        var walker = document.createTreeWalker(msgEl, NodeFilter.SHOW_TEXT, null);
        var toHide = [];
        while (walker.nextNode()) {
            var t = walker.currentNode.textContent;
            if (t.match(/^💭/) || t.match(/^\[思考[\]】]/) || t.match(/^<think/i)) {
                toHide.push(walker.currentNode);
            }
        }
        for (var j = 0; j < toHide.length; j++) {
            var parent = toHide[j].parentElement;
            if (parent) parent.style.display = 'none';
            else toHide[j].textContent = '';
        }
    },

    // ---------- 隐藏状态栏和游戏数据 ----------
    async hideStateBlocks(msgEl) {
        // 从变量读取是否启用隐藏状态栏
        try {
            var hideEnabled = await ConfigManager.get('xb.ui.hideStateBlocks');
            if (hideEnabled === 'false') return;
        } catch (e) { /* 变量读取失败，继续执行 */ }

        if (msgEl.dataset.stateDone) return;
        msgEl.dataset.stateDone = '1';

        var stateEls = msgEl.querySelectorAll('state');
        for (var si = 0; si < stateEls.length; si++) stateEls[si].remove();
        msgEl.innerHTML = msgEl.innerHTML.replace(/<state>[\s\S]*?<\/state>/gi, '');

        var html = msgEl.innerHTML;
        var htmlChanged = false;

        // 手机消息格式替换为通知图标
        var phoneMsgRegex = /\[(对方消息|我方消息|群聊消息|我方群聊消息)\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]*)\]/g;
        if (phoneMsgRegex.test(html)) {
            phoneMsgRegex.lastIndex = 0;
            html = html.replace(phoneMsgRegex, function(match, msgType, sender, number, mType, content) {
                var isSent = (msgType === '我方消息' || msgType === '我方群聊消息');
                var iconColor = isSent ? '#4caf50' : '#2196f3';
                var label = isSent ? '你' : sender;
                var icon = '📱';
                var preview = '';

                if (mType === '红包' || mType === '转账') {
                    icon = '🧧';
                    preview = (mType === '红包' ? '红包' : '转账') + ' ¥' + (content || '0');
                } else if (mType === '语音') {
                    icon = '🎤'; preview = '[语音消息]';
                } else if (mType === '图片') {
                    icon = '🖼️'; preview = '[图片]';
                } else if (mType === '定位') {
                    icon = '📍'; preview = '[位置分享]';
                } else {
                    var txt = content.trim();
                    preview = txt.length > 20 ? txt.substring(0, 20) + '...' : txt;
                }
                return '<span class="st-phone-notification" style="' +
                    'display:inline-flex;align-items:center;gap:4px;' +
                    'background:' + iconColor + '15;color:' + iconColor + ';' +
                    'font-size:0.8em;padding:2px 8px 2px 4px;border-radius:12px;margin:2px 3px;' +
                    'border:1px solid ' + iconColor + '30;cursor:default;" ' +
                    'title="' + sender + '(' + number + '): ' + content + '">' +
                    '<span style="display:inline-flex;align-items:center;justify-content:center;' +
                    'width:18px;height:18px;border-radius:50%;background:' + iconColor + ';' +
                    'color:#fff;font-size:10px;font-weight:700;">' + icon + '</span>' +
                    '<span style="font-weight:600;">' + label + '</span>' +
                    '<span style="opacity:0.7;font-size:0.9em;">' + preview + '</span>' +
                    '<span style="display:inline-flex;align-items:center;justify-content:center;' +
                    'min-width:14px;height:14px;border-radius:7px;background:#f44336;' +
                    'color:#fff;font-size:9px;font-weight:700;padding:0 3px;margin-left:2px;">●</span>' +
                    '</span>';
            });
            htmlChanged = true;
        }

        // 好友ID替换为徽章
        var friendIdRegex = /\[好友id\|([^|]+)\|([^\]]+)\]/g;
        if (friendIdRegex.test(html)) {
            friendIdRegex.lastIndex = 0;
            html = html.replace(friendIdRegex, function(match, name, id) {
                return '<span class="st-friend-badge" style="' +
                    'display:inline-flex;align-items:center;gap:6px;' +
                    'background:linear-gradient(135deg,rgba(76,175,80,0.12),rgba(76,175,80,0.2));' +
                    'color:#388e3c;font-size:0.82em;' +
                    'padding:4px 12px;border-radius:16px;margin:3px 4px;' +
                    'border:1px solid rgba(76,175,80,0.25);">' +
                    '<span style="display:inline-flex;align-items:center;justify-content:center;' +
                    'width:20px;height:20px;border-radius:50%;background:#4caf50;' +
                    'color:#fff;font-size:11px;font-weight:700;">+</span>' +
                    '<span style="font-weight:600;">' + name + '</span>' +
                    '<span style="opacity:0.5;font-size:0.85em;">已添加好友</span></span>';
            });
            htmlChanged = true;
        }

        // 好友请求美化
        var friendReqPatterns = [
            { regex: /请求添加你为好友[^\n<]*/g, replacement: '<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(255,152,0,0.12),rgba(255,152,0,0.2));color:#e65100;font-size:0.82em;padding:4px 12px;border-radius:16px;margin:3px 4px;border:1px solid rgba(255,152,0,0.25);">👤 <span style="font-weight:600;">好友请求</span></span>' },
            { regex: /已通过您的好友验证[^\n<]*/g, replacement: '<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(33,150,243,0.12),rgba(33,150,243,0.2));color:#1565c0;font-size:0.82em;padding:4px 12px;border-radius:16px;margin:3px 4px;border:1px solid rgba(33,150,243,0.25);">✅ <span style="font-weight:600;">好友已添加</span></span>' },
            { regex: /已添加至预设剧本线[^\n<]*/g, replacement: '<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(255,152,0,0.12),rgba(255,152,0,0.2));color:#e65100;font-size:0.82em;padding:4px 12px;border-radius:16px;margin:3px 4px;border:1px solid rgba(255,152,0,0.25);">📋 <span style="font-weight:600;">剧本线更新</span></span>' }
        ];
        for (var fi = 0; fi < friendReqPatterns.length; fi++) {
            if (friendReqPatterns[fi].regex.test(html)) {
                friendReqPatterns[fi].regex.lastIndex = 0;
                html = html.replace(friendReqPatterns[fi].regex, friendReqPatterns[fi].replacement);
                htmlChanged = true;
            }
        }

        // 移除剩余的系统模式
        var remainingPatterns = [
            /游戏数据[.\u3002][^\n<]*/g,
            /沉沦度[：:]\s*[+\-]?\d[^\n<]*/g,
            /感情值[：:][^\n<]*/g,
            /羁绊值[：:][^\n<]*/g,
            /当前段位评估[^\n<]*/g,
            /当前活跃角色[：:][^\n<]*/g,
            /当前活跃角色[^\n<]*\]/g,
            /系统提醒[^\n<]*/g,
            /危险感知度[^\n<]*/g,
            /已触发事件[^\n<]*/g,
            /当前场景[：:][^\n<]*/g,
            /当前金钱[：:][^\n<]*/g,
            /好感度[：:]\s*\d[^\n<]*/g,
            /阶段[：:]\s*\d[^\n<]*/g,
            /当前阶段[：:][^\n<]*/g,
            /当前阶段[^\n<]*\]/g,
            /\[和[^\]]*的聊天\]/g,
            /当前可行动向[^\n<]*/g,
            /微信操作[^\n<]*/g,
            /\[直播\|[^\]]*\]/g,
            /『[^』]*』/g,
            /锁定单回合[^\n<]*/g,
            /推荐互动[^\n<]*/g,
            /TimeFormat[^\n<]*/gi,
            /请选择[^\n<]*/g,
            /\[朋友圈\|[^\]]*\]/g,
            /隐藏好感度[^\n<]*/g,
            /\[好友消息\|[^\]]*\]/g,
            /\[表情包\|[^\]]*\]/g,
            /\[图片[：:|][^\]]*\]/g,
            /定位[：:][^\n<]*/g
        ];
        for (var ri = 0; ri < remainingPatterns.length; ri++) {
            if (remainingPatterns[ri].test(html)) {
                html = html.replace(remainingPatterns[ri], '');
                htmlChanged = true;
            }
        }

        if (htmlChanged) msgEl.innerHTML = html;

        // 隐藏代码块中的游戏状态数据
        var codeBlocks = msgEl.querySelectorAll('pre, code');
        for (var ci = 0; ci < codeBlocks.length; ci++) {
            var codeText = codeBlocks[ci].textContent || '';
            if (codeText.includes('游戏数据') || codeText.includes('当前场景') || 
                codeText.includes('当前状态') || codeText.includes('玫瑰') ||
                codeText.includes('当前活跃角色')) {
                codeBlocks[ci].style.display = 'none';
                codeBlocks[ci].dataset.stateDone = '1';
            }
        }

        // 美化代码块
        var preEls = msgEl.querySelectorAll('pre');
        for (var pi = 0; pi < preEls.length; pi++) {
            preEls[pi].style.cssText = 'background:rgba(30,20,50,0.85);color:#e0d0f0;border:1px solid rgba(180,140,220,0.4);border-radius:8px;padding:10px 14px;margin:6px 0;font-size:0.88em;line-height:1.5;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        }
        var codeEls = msgEl.querySelectorAll('code');
        for (var ci = 0; ci < codeEls.length; ci++) {
            if (codeEls[ci].parentElement && codeEls[ci].parentElement.tagName !== 'PRE') {
                codeEls[ci].style.cssText = 'background:rgba(30,20,50,0.7);color:#e0d0f0;padding:2px 8px;border-radius:4px;font-size:0.88em;border:1px solid rgba(180,140,220,0.3);';
            }
        }
        var bqEls = msgEl.querySelectorAll('blockquote');
        for (var bi = 0; bi < bqEls.length; bi++) {
            bqEls[bi].style.cssText = 'background:rgba(30,20,50,0.75);color:#e0d0f0;border-left:3px solid rgba(180,140,220,0.6);border-radius:0 8px 8px 0;padding:8px 14px;margin:6px 0;font-size:0.9em;backdrop-filter:blur(4px);';
        }

        // 隐藏手机消息元数据标签（[对方消息|...]、[好友消息|...]、[好友id|...]等）
        var metadataPatterns = [
            /\[对方消息[|｜][^\]]+\]/g,
            /\[我方消息[|｜][^\]]+\]/g,
            /\[好友消息[|｜][^\]]+\]/g,
            /\[群聊消息[|｜][^\]]+\]/g,
            /\[好友id[|｜][^\]]+\]/g,
            /\[角色[|｜][^\]]+\]/g,
            /\[好友请求[|｜][^\]]+\]/g
        ];
        // 在所有文本节点中隐藏元数据
        var textNodes = [];
        var walker = document.createTreeWalker(msgEl, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        for (var ti = 0; ti < textNodes.length; ti++) {
            var tNode = textNodes[ti];
            var tText = tNode.textContent;
            var modified = false;
            for (var pi = 0; pi < metadataPatterns.length; pi++) {
                if (metadataPatterns[pi].test(tText)) {
                    tText = tText.replace(metadataPatterns[pi], '');
                    modified = true;
                }
            }
            if (modified && tText.trim() === '') {
                // 整个文本节点都是元数据，用零尺寸隐藏（TTS不会读取display:none或尺寸为0的元素）
                var p = tNode.parentNode;
                if (p) {
                    p.style.display = 'none';
                    p.dataset.metadataHidden = '1';
                    // 在原位置插入一个空span保持DOM结构
                    var spacer = document.createElement('span');
                    spacer.style.display = 'none';
                    spacer.dataset.metadataSpacer = '1';
                    p.parentNode.insertBefore(spacer, p.nextSibling);
                }
            } else if (modified) {
                tNode.textContent = tText;
            }
        }
    },

    // ---------- 主界面聊天内容隐藏控制 ----------
    async _applyMainChatVisibility() {
        try {
            var hideMain = await ConfigManager.get('xb.ui.hideMainChat');
            var chatMessages = document.querySelectorAll('#chat .mes_text');
            for (var i = 0; i < chatMessages.length; i++) {
                var el = chatMessages[i];
                if (hideMain === 'true') {
                    // 隐藏所有文本内容，但保留四选项按钮
                    var qrContainer = el.querySelector('.quick-reply-container');
                    if (qrContainer) {
                        // 只显示按钮，隐藏其他内容
                        Array.prototype.forEach.call(el.childNodes, function(child) {
                            if (child !== qrContainer && child.nodeType === 1) {
                                child.style.display = 'none';
                            }
                        });
                        // 隐藏文本节点
                        var textWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
                        var textNode;
                        while (textNode = textWalker.nextNode()) {
                            if (textNode.textContent.trim()) {
                                var span = document.createElement('span');
                                span.style.display = 'none';
                                span.dataset.hiddenByMainChat = '1';
                                textNode.parentNode.replaceChild(span, textNode);
                            }
                        }
                    } else {
                        el.style.display = 'none';
                    }
                } else {
                    // 恢复显示
                    Array.prototype.forEach.call(el.querySelectorAll('[data-hidden-by-main-chat]'), function(hidden) {
                        var text = hidden.textContent;
                        hidden.parentNode.replaceChild(document.createTextNode(text), hidden);
                    });
                    Array.prototype.forEach.call(el.querySelectorAll('.mes_text > [style*="display: none"]'), function(hidden) {
                        // 不恢复被其他功能隐藏的元素
                    });
                    el.style.display = '';
                }
            }
        } catch(e) {}
    },

    // ---------- 美化系统变量 ----------
    beautifySystemVars(msgEl) {
        if (msgEl.dataset.beautifyDone) return;
        msgEl.dataset.beautifyDone = '1';

        var html = msgEl.innerHTML;
        var changed = false;

        // 直播弹幕
        var danmakuRegex = /\[直播\|([^|]+)\|弹幕\|([^\]]+)\]/g;
        if (danmakuRegex.test(html)) {
            danmakuRegex.lastIndex = 0;
            html = html.replace(danmakuRegex, function(match, user, content) {
                return '<span style="display:inline-block;background:rgba(0,0,0,0.65);color:#fff;font-size:0.82em;padding:3px 10px;border-radius:12px;margin:2px 4px;backdrop-filter:blur(2px);max-width:80%;word-break:break-all;">' +
                    '<span style="color:#ffd700;font-weight:600;margin-right:4px;">' + user + '</span>' + content + '</span>';
            });
            changed = true;
        }

        // 直播打赏
        var tipRegex = /\[直播\|([^|]+)\|打赏\|([^\]]+)\]/g;
        if (tipRegex.test(html)) {
            tipRegex.lastIndex = 0;
            html = html.replace(tipRegex, function(match, user, content) {
                return '<span style="display:inline-block;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#8b4513;font-size:0.82em;font-weight:600;padding:3px 10px;border-radius:12px;margin:2px 4px;box-shadow:0 1px 4px rgba(255,170,0,0.4);">' +
                    '🎁 <span style="font-weight:700;">' + user + '</span> ' + content + '</span>';
            });
            changed = true;
        }

        // 好友ID美化
        var friendIdRegex = /\[好友id\|([^|]+)\|([^\]]+)\]/g;
        if (friendIdRegex.test(html)) {
            friendIdRegex.lastIndex = 0;
            html = html.replace(friendIdRegex, function(match, name, id) {
                return '<span class="st-friend-badge" style="' +
                    'display:inline-flex;align-items:center;gap:6px;' +
                    'background:linear-gradient(135deg,rgba(76,175,80,0.12),rgba(76,175,80,0.2));' +
                    'color:#388e3c;font-size:0.82em;' +
                    'padding:4px 12px;border-radius:16px;margin:3px 4px;' +
                    'border:1px solid rgba(76,175,80,0.25);">' +
                    '<span style="display:inline-flex;align-items:center;justify-content:center;' +
                    'width:20px;height:20px;border-radius:50%;background:#4caf50;' +
                    'color:#fff;font-size:11px;font-weight:700;">+</span>' +
                    '<span style="font-weight:600;">' + name + '</span>' +
                    '<span style="opacity:0.5;font-size:0.85em;">已添加好友</span></span>';
            });
            changed = true;
        }

        // 好友请求
        var friendReqRegex = /请求添加你为好友[^\n<]*/g;
        if (friendReqRegex.test(html)) {
            friendReqRegex.lastIndex = 0;
            html = html.replace(friendReqRegex, '<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(255,152,0,0.12),rgba(255,152,0,0.2));color:#e65100;font-size:0.82em;padding:4px 12px;border-radius:16px;margin:3px 4px;border:1px solid rgba(255,152,0,0.25);">👤 <span style="font-weight:600;">好友请求</span></span>');
            changed = true;
        }

        // 好友验证
        var friendVerifyRegex = /已通过您的好友验证[^\n<]*/g;
        if (friendVerifyRegex.test(html)) {
            friendVerifyRegex.lastIndex = 0;
            html = html.replace(friendVerifyRegex, '<span style="display:inline-flex;align-items:center;gap:4px;background:linear-gradient(135deg,rgba(33,150,243,0.12),rgba(33,150,243,0.2));color:#1565c0;font-size:0.82em;padding:4px 12px;border-radius:16px;margin:3px 4px;border:1px solid rgba(33,150,243,0.25);">✅ <span style="font-weight:600;">好友已添加</span></span>');
            changed = true;
        }

        // 位置标签
        var locationRegex = /『([^』]+)』/g;
        if (locationRegex.test(html)) {
            locationRegex.lastIndex = 0;
            html = html.replace(locationRegex, function(match, content) {
                return '<span style="display:inline-block;background:rgba(100,100,180,0.15);color:#8888cc;font-size:0.8em;padding:2px 10px;border-radius:10px;margin:2px 4px;border:1px solid rgba(100,100,180,0.2);">📍 ' + content + '</span>';
            });
            changed = true;
        }

        // 直播头部
        var streamHeaderRegex = /\[直播\|(\d+)\|(\d+)\]/g;
        if (streamHeaderRegex.test(html)) {
            streamHeaderRegex.lastIndex = 0;
            html = html.replace(streamHeaderRegex, function(match, viewers, income) {
                return '<span style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,rgba(255,0,80,0.2),rgba(150,0,200,0.2));color:#ff4488;font-size:0.82em;font-weight:600;padding:4px 12px;border-radius:14px;margin:4px;border:1px solid rgba(255,0,80,0.3);">' +
                    '🔴 直播中 👁 ' + viewers + ' · 💰 ' + income + '</span>';
            });
            changed = true;
        }

        // 朋友圈
        var fcRegex = /\[朋友圈\|([^|]+)\|([^|]+)\|([^\|]*)\|([^\|]*)\|([^\]]+)\]/g;
        if (fcRegex.test(html)) {
            fcRegex.lastIndex = 0;
            html = html.replace(fcRegex, function(match, name, id, imgId, imgDesc, text) {
                var imgSrc = (imgId && imgId.indexOf('http') === 0) ? imgId : '';
                var imgPart = imgSrc ?
                    '<img src="' + imgSrc + '" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;margin-top:6px;" onerror="this.style.display=\'none\'" loading="lazy" />' :
                    (imgDesc ? '<div style="width:100%;padding:20px 10px;background:#f5f5f5;border-radius:8px;margin-top:6px;text-align:center;color:#999;font-size:0.85em;">📷 ' + imgDesc + '</div>' : '');
                return '<div style="display:inline-block;vertical-align:top;width:220px;background:#fff;border-radius:12px;padding:10px;margin:4px;box-shadow:0 1px 6px rgba(0,0,0,0.08);border:1px solid #eee;">' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
                    '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;">' + name.charAt(0) + '</div>' +
                    '<span style="font-weight:600;font-size:0.85em;color:#333;">' + name + '</span></div>' +
                    imgPart +
                    '<div style="font-size:0.85em;color:#333;margin-top:6px;line-height:1.4;">' + text + '</div></div>';
            });
            changed = true;
        }

        if (changed) msgEl.innerHTML = html;
    },

    // ---------- 处理消息（核心入口） ----------
    async processMessage(msgEl) {
        if (msgEl.dataset.qrDone) return;

        // 检查是否启用四选项渲染（从变量读取，失败时默认启用）
        try {
            var renderEnabled = await ConfigManager.get('xb.ui.renderQuickReply');
            if (renderEnabled === 'false') {
                this.hideThinkingBlocks(msgEl);
                this.hideStateBlocks(msgEl);
                msgEl.dataset.qrDone = '1';
                return;
            }
        } catch (e) {
            console.warn('[QuickReplyBridge] 变量读取失败，默认启用渲染:', e);
        }

        var plainText = this._extractPlainText(msgEl);
        console.log('[QuickReplyBridge] Processing message, plainText length:', plainText.length);
        console.log('[QuickReplyBridge] PlainText preview:', plainText.substring(0, 200));

        // 先美化系统变量
        this.beautifySystemVars(msgEl);

        // 提取选项
        var matches = this.extractOptions(msgEl);

        // 核心修复：1个选项也渲染（原来是2个才渲染）
        if (matches.length < 1) {
            this.hideThinkingBlocks(msgEl);
            this.hideStateBlocks(msgEl);
            return;
        }

        // 标记已处理
        msgEl.dataset.qrDone = '1';
        msgEl.dataset.thinkDone = '1';
        msgEl.dataset.stateDone = '1';

        // 构建按钮HTML
        var self = this;
        var btnHtml = '<div class="quick-reply-container">';
        for (var i = 0; i < matches.length; i++) {
            var opt = matches[i];
            var cfg = this.OPTION_TYPES[opt.type] || { cls: 'qr-zhenqing', icon: '●' };
            btnHtml += '<span class="quick-reply-btn ' + cfg.cls + '" data-qr-idx="' + i + '">' +
                '<span class="qr-label">' + cfg.icon + ' ' + opt.type + '</span>' +
                '<span class="qr-content">' + opt.content + '</span>' +
                '</span>';
        }
        btnHtml += '</div>';

        // 隐藏原始选项文本
        var optionTagPattern = /\[(真情|套路|试探|行动)\][：:]?|\【(真情|套路|试探|行动)\】|^(真情|套路|试探|行动)[：:]/;
        var emojiOptionPattern = /^[\uD83D\uDC95\u2764\uFE0F\uD83D\uDC97\uD83D\uDC96\uD83C\uDFAD\uD83C\uDCCF\uD83D\uDD0D\uD83D\uDD0E\uD83D\uDC41\uFE0F\u26A1\uD83D\uDD25\uD83D\uDC4A\uD83C\uDFC3]\s+/m;
        var children = Array.prototype.slice.call(msgEl.children);
        var hiddenAny = false;
        for (var ci = 0; ci < children.length; ci++) {
            var child = children[ci];
            var childHtml = child.innerHTML || '';
            var childText = child.textContent || '';
            if (optionTagPattern.test(childHtml) || optionTagPattern.test(childText)) {
                child.style.display = 'none'; hiddenAny = true;
            }
            if (emojiOptionPattern.test(childText) && childText.length < 100) {
                child.style.display = 'none'; hiddenAny = true;
            }
            if (/【请选择】|请选择/.test(childText) && childText.length < 20) {
                child.style.display = 'none'; hiddenAny = true;
            }
        }

        // 隐藏原始选项文本（不移动DOM，避免触发ST重新渲染）
        if (hiddenAny) {
            // 已通过CSS隐藏，无需额外操作
        } else {
            // 没有隐藏任何元素，说明选项文本可能被markdown渲染拆散了
            // 用CSS遮罩覆盖整个消息区域，然后在上面放按钮
        }

        msgEl.insertAdjacentHTML('beforeend', btnHtml);

        // 绑定点击事件（填入文本 + 300ms后自动发送）
        var btns = msgEl.querySelectorAll('.quick-reply-btn');
        for (var bi = 0; bi < btns.length; bi++) {
            (function(btn) {
                function handleSelect(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    // 切换选中状态
                    var allBtns = msgEl.querySelectorAll('.quick-reply-btn.qr-selected');
                    for (var si = 0; si < allBtns.length; si++) allBtns[si].classList.remove('qr-selected');
                    btn.classList.add('qr-selected');

                    var contentEl = btn.querySelector('.qr-content');
                    var text = contentEl ? contentEl.textContent : '';
                    if (!text) return;

                    // 填入ST输入框
                    var chatInput = document.getElementById('send_textarea');
                    if (chatInput) {
                        chatInput.value = text;
                        chatInput.focus();
                        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                        chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        console.log('[QuickReplyBridge] 选项已填入输入框，等待用户发送');
                    }
                }

                btn.addEventListener('click', handleSelect);
                // 安卓触摸兼容
                btn.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    setTimeout(function() { handleSelect.call(btn, e); }, 50);
                }, { passive: false });
            })(btns[bi]);
        }

        console.log('[QuickReplyBridge] 已渲染', matches.length, '个快捷回复按钮');

        // 自动将CDN图床URL转换为img标签
        var cdnPattern = /https?:\/\/cdn\.jsdelivr\.net\/gh\/[^\s<>"')\]]+/gi;
        var html = msgEl.innerHTML;
        var hasCdnUrl = cdnPattern.test(html);
        if (hasCdnUrl) {
            html = html.replace(cdnPattern, function(url) {
                // 如果已经被img标签包裹，跳过
                if (html.indexOf('src="' + url + '"') !== -1 || html.indexOf("src='" + url + "'") !== -1) {
                    return url;
                }
                return '<img src="' + url + '" style="max-width:100%;border-radius:8px;margin:6px 0;" loading="lazy" onerror="this.style.display=\'none\'">';
            });
            msgEl.innerHTML = html;
        }

        // 自动诊断：检查按钮是否在DOM中且可见
        setTimeout(function() {
            var btns = document.querySelectorAll('.quick-reply-btn');
            console.log('[QuickReplyBridge-DIAG] DOM中按钮数:', btns.length);
            if (btns.length > 0) {
                var r = btns[0].getBoundingClientRect();
                console.log('[QuickReplyBridge-DIAG] 首个按钮位置:', 'top='+r.top, 'left='+r.left, 'w='+r.width, 'h='+r.height);
                console.log('[QuickReplyBridge-DIAG] 按钮可见:', r.width > 0 && r.height > 0);
                console.log('[QuickReplyBridge-DIAG] 父元素:', btns[0].parentElement.className);
                console.log('[QuickReplyBridge-DIAG] computed display:', window.getComputedStyle(btns[0]).display);
                console.log('[QuickReplyBridge-DIAG] computed visibility:', window.getComputedStyle(btns[0]).visibility);
                console.log('[QuickReplyBridge-DIAG] computed opacity:', window.getComputedStyle(btns[0]).opacity);
                console.log('[QuickReplyBridge-DIAG] z-index:', window.getComputedStyle(btns[0]).zIndex);
                // 如果按钮不可见，强制修改样式
                if (r.width === 0 || r.height === 0) {
                    console.log('[QuickReplyBridge-DIAG] ⚠️ 按钮不可见，强制修复样式');
                    btns.forEach(function(b) {
                        b.style.cssText = 'display:inline-flex!important;padding:12px 20px;border-radius:20px;background:#ffe0e8;color:#c0392b;border:2px solid #e8a0b0;font-size:16px;z-index:99999;position:relative;margin:4px;cursor:pointer;';
                    });
                    console.log('[QuickReplyBridge-DIAG] ✅ 已强制修复样式，检查手机是否出现红色按钮');
                }
            }
        }, 1000);
    },

    // ---------- 扫描好友请求 ----------
    async scanForFriendRequests() {
        var self = this;
        var msgEls = document.querySelectorAll('.mes_text');
        var friendRequestRegex = /\[角色[|｜]([^|｜]+)[|｜]([^|｜]+)[|｜]请求添加你为好友\]/;
        for (var i = 0; i < msgEls.length; i++) {
            var text = msgEls[i].textContent || '';

            // 格式1：[角色|名字|ID|请求添加你为好友]
            var match1 = text.match(friendRequestRegex);
            if (match1 && !self._processedRequests[match1[0]]) {
                self._processedRequests[match1[0]] = true;
                var name = match1[1].trim();
                var number = match1[2].trim();
                console.log('[QuickReplyBridge] 从聊天中检测到好友请求:', name, number);
                // 写入变量，由IndependentAI的自动消息循环中消费（发布-订阅模式）
                await ConfigManager.set('xb.phone.pendingFriend', name + '|' + number);
                console.log('[QuickReplyBridge] 写入待添加好友变量:', name, number);
            }

            // 格式2：[好友id|名字|ID]
            var friendIdRegex = /\[好友id[|｜]([^|｜]+)[|｜]([^\]]+)\]/g;
            var match2;
            while ((match2 = friendIdRegex.exec(text)) !== null) {
                var fullMatch = match2[0];
                if (!self._processedRequests[fullMatch]) {
                    self._processedRequests[fullMatch] = true;
                    var name2 = match2[1].trim();
                    var id2 = match2[2].trim();
                    console.log('[QuickReplyBridge] Found friend ID tag:', name2, id2);
                    // 写入变量，由IndependentAI的自动消息循环中消费（发布-订阅模式）
                    await ConfigManager.set('xb.phone.pendingFriend', name2 + '|' + id2);
                    console.log('[QuickReplyBridge] 写入待添加好友变量:', name2, id2);
                }
            }
        }
    },

    // ---------- 启动好友请求定时扫描 ----------
    _startFriendRequestScanner() {
        var self = this;
        var scanCount = 0;
        var maxScans = 60; // 5分钟
        this._friendScannerTimer = setInterval(function() {
            scanCount++;
            if (scanCount > maxScans) {
                clearInterval(self._friendScannerTimer);
                return;
            }
            self.scanForFriendRequests();
        }, 5000);
    },

    // ---------- 注入清除历史按钮 ----------
    _injectClearButton() {
        var self = this;
        function inject() {
            if (document.getElementById('phone-clear-history-btn')) return;

            var footer = document.querySelector('.message-detail-footer');
            if (!footer) return;

            var btn = document.createElement('button');
            btn.id = 'phone-clear-history-btn';
            btn.title = '清除当前角色的小手机聊天记录';
            btn.innerHTML = '🗑️';
            btn.style.cssText = 'position:absolute;top:4px;right:50px;z-index:999;' +
                'width:28px;height:28px;border-radius:50%;border:none;' +
                'background:rgba(244,67,54,0.15);color:#f44336;font-size:14px;' +
                'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
                'transition:all .2s;-webkit-tap-highlight-color:transparent;';
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('确定要清除小手机聊天记录吗？\n（不会影响ST主面板的聊天记录）')) {
                    if (window.independentAI && window.independentAI.clearAllHistories) {
                        window.independentAI.clearAllHistories();
                        alert('✅ 聊天记录已清除！');
                        if (window.messageApp && window.messageApp.refreshFriendListUI) {
                            window.messageApp.refreshFriendListUI();
                        }
                        location.reload();
                    } else {
                        var keys = Object.keys(localStorage).filter(function(k) {
                            return k.indexOf('mobile_independent_ai_histories_') === 0 || k.indexOf('mobile_') === 0;
                        });
                        for (var ki = 0; ki < keys.length; ki++) localStorage.removeItem(keys[ki]);
                        alert('✅ 聊天记录已清除！');
                        location.reload();
                    }
                }
            });

            footer.style.position = 'relative';
            footer.appendChild(btn);
            console.log('[QuickReplyBridge] 清除历史按钮已注入');
        }

        // 延迟注入，等待DOM就绪
        setTimeout(inject, 2000);
        var clearBtnTimer = setInterval(function() {
            if (document.getElementById('phone-clear-history-btn')) {
                clearInterval(clearBtnTimer);
            } else {
                inject();
            }
        }, 5000);
        setTimeout(function() { clearInterval(clearBtnTimer); }, 60000);
    }
};

// ===== 模块4：图片管理 (ImageManager) =====
// CDN图床为主，BizyAir可选

const ImageManager = {
    // CDN图床基础URL
    CDN_BASE: 'https://cdn.jsdelivr.net/gh/1288962ssdasd/images@main',

    // 角色图片映射
    charImages: {
        '苏晚晴': { prefix: '苏晚晴', count: 16, available: [1,2,3,4,5,6,7,9] },
        '柳如烟': { prefix: '柳如烟', count: 16, available: [1,2,3,4,5,6,7] },
        '王捷': { prefix: '王捷', count: 16, available: [1,2,3,4,5,6,7,9,10] },
        '苏媚': { prefix: '苏媚', count: 16, available: [1,2,3,4,5,6,7,9,10,11,12,13,14,15,17,18] },
        '吴梦娜': { prefix: '吴梦娜', count: 16, available: [1,2,3,4,5,6,7] }
    },

    // BizyAir配置
    _bizyAirConfig: {
        get apiKey() { return localStorage.getItem('bizyair_api_key') || ''; },
        get webAppId() { return localStorage.getItem('bizyair_web_app_id') || '44306'; },
        get templateId() { return localStorage.getItem('bizyair_active_template') || 'legacy'; },
        createUrl: 'https://api.bizyair.cn/w/v1/webapp/task/openapi/create',
        queryUrl: 'https://api.bizyair.cn/w/v1/webapp/task/openapi/query'
    },

    init() {
        this._injectBizyAirPresets();
        this._initBizyAirListener();
        console.log('[ImageManager] 初始化完成');
    },

    // ---------- 获取CDN图片URL ----------
    getCdnUrl(friendName, index) {
        var info = this.charImages[friendName];
        if (!info) return null;
        var nums = info.available || [];
        if (nums.length === 0) {
            // 生成001到count的编号
            for (var n = 1; n <= info.count; n++) nums.push(n);
        }
        var imgNum = (index !== undefined) ? index : nums[Math.floor(Math.random() * nums.length)];
        var padded = imgNum < 10 ? '00' + imgNum : '0' + imgNum;
        return this.CDN_BASE + '/' + info.prefix + '_' + padded + '.jpg';
    },

    // ---------- 在聊天中插入图片（CDN为主） ----------
    async insertImage(bubbleEl, friendName) {
        var enabled = await ConfigManager.get('xb.phone.image.autoInsert');
        if (enabled === 'false') return;

        // 从变量读取当前场景和角色，选择更合适的图片
        var activeChar = (await ConfigManager.get('xb.game.activeChar')) || '苏晚晴';
        var scene = (await ConfigManager.get('xb.game.scene')) || '翡翠湾小区';

        // 根据场景选择不同的图片编号范围
        var sceneImageMap = {
            '翡翠湾小区': [1, 2, 3],       // 日常/登场
            '咖啡店': [1, 2, 5],            // 休闲场景
            '商场': [1, 3, 5],              // 购物/约会
            '公司': [1, 2],                 // 职场
            '酒吧': [3, 4, 5],              // 夜生活
            '酒店': [3, 4, 6, 7]            // 亲密场景
        };

        var preferredIndices = sceneImageMap[scene] || null;
        var url = null;

        // 优先使用场景匹配的图片编号
        if (preferredIndices) {
            var info = this.charImages[friendName];
            if (info) {
                var available = info.available || [];
                var matched = preferredIndices.filter(function(idx) { return available.indexOf(idx) !== -1; });
                if (matched.length > 0) {
                    var chosen = matched[Math.floor(Math.random() * matched.length)];
                    url = this.getCdnUrl(friendName, chosen);
                }
            }
        }

        // 回退：使用默认随机图片
        if (!url) {
            url = this.getCdnUrl(friendName);
        }
        if (!url) return;

        console.log('[ImageManager] 场景:', scene, '角色:', friendName, '图片:', url.substring(0, 60));

        // 如果BizyAir启用，尝试BizyAir生图
        var bizyEnabled = await ConfigManager.get('xb.phone.bizyair.enabled');
        if (bizyEnabled === 'true') {
            var bizyProb = parseInt(await ConfigManager.get('xb.phone.bizyair.probability')) || 30;
            if (Math.random() * 100 < bizyProb) {
                try {
                    var bizyUrl = await this.generateBizyAirImage(friendName);
                    if (bizyUrl) {
                        url = bizyUrl;
                        console.log('[ImageManager] BizyAir生图成功:', url.substring(0, 60));
                    } else {
                        console.log('[ImageManager] BizyAir生图失败，回退CDN');
                    }
                } catch (e) {
                    console.warn('[ImageManager] BizyAir异常，回退CDN:', e);
                }
            }
        }

        // 插入图片到气泡
        var textEl = bubbleEl.querySelector('.message-text');
        if (textEl) {
            var imgHtml = '<br><img src="' + url + '" ' +
                'style="max-width:180px;border-radius:8px;cursor:pointer;display:block;margin-top:6px;" ' +
                'onclick="window.independentAI._enlargeImage(this)" ' +
                'onerror="this.style.display=\'none\'" loading="lazy" />';
            textEl.innerHTML += imgHtml;
            console.log('[ImageManager] 图片已插入:', url.substring(0, 60));
        }
    },

    // ---------- BizyAir生图 ----------
    async generateBizyAirImage(friendName, callback, options) {
        options = options || {};
        var config = this._bizyAirConfig;
        var apiKey = config.apiKey;
        if (!apiKey) {
            console.warn('[ImageManager] BizyAir API Key未配置');
            return null;
        }

        var templateId = options.template || config.templateId;
        var webAppId = parseInt(config.webAppId, 10) || 44306;

        // 角色生图prompt映射
        var charImagePrompts = {
            '苏晚晴': '1girl, solo, long black hair, hair over one shoulder, beautiful face, delicate features, light makeup, slender body, white casual dress, gentle smile, upper body, looking at viewer, soft lighting, anime style, high quality',
            '柳如烟': '1girl, solo, short black hair, bob cut, cute face, big eyes, round face, innocent expression, shy blush, petite body, pink sundress, holding small bear plushie, upper body, bright lighting, anime style, high quality',
            '王捷': '1girl, solo, short black hair, messy hair, sharp eyes, cold expression, tall body, athletic build, black leather jacket, combat boots, arms crossed, full body, dramatic lighting, dark background, anime style, high quality',
            '苏媚': '1girl, solo, long wavy brown hair, low ponytail, gold rim glasses, intellectual beauty, calm expression, slender body, linen shirt, long skirt, bohemian style, holding a book, sitting, soft natural lighting, anime style, high quality',
            '吴梦娜': '1girl, solo, long straight black hair, mature beauty, mysterious expression, tall body, dark purple silk dress, platinum necklace, phoenix pendant, sitting on luxury sofa, upper body, dim luxury lighting, anime style, high quality'
        };

        var description = options.description || charImagePrompts[friendName] || (friendName + ', anime style, high quality, beautiful');

        // 模板配置
        var templates = {
            legacy: {
                webAppId: 44306,
                positiveKey: '31:CLIPTextEncode.text',
                negativeKey: '32:CLIPTextEncode.text',
                outputIndexFromEnd: 1,
                negativePrompt: 'blurry, noisy, messy, lowres, jpeg, artifacts, text, watermark',
                params: {
                    '27:KSampler.seed': Math.floor(Math.random() * 999999999),
                    '27:KSampler.steps': 20,
                    '27:KSampler.sampler_name': 'euler_ancestral',
                    '61:CM_SDXLExtendedResolution.resolution': '832x1216',
                    '69:DF_Latent_Scale_by_ratio.modifier': 1.2,
                    '54:EmptyLatentImage.batch_size': 1,
                    '57:dynamicThresholdingFull.mimic_scale': 8
                }
            },
            face_detailer: {
                webAppId: 47362,
                positiveKey: '93:CLIPTextEncode.text',
                negativeKey: '55:CLIPTextEncode.text',
                outputIndexFromEnd: 1,
                negativePrompt: 'text, watermark, worst quality',
                params: {
                    '47:EmptyLatentImage.width': 960,
                    '47:EmptyLatentImage.height': 1280,
                    '47:EmptyLatentImage.batch_size': 1,
                    '27:KSampler.seed': Math.floor(Math.random() * 999999999),
                    '89:FaceDetailer.steps': 20,
                    '89:FaceDetailer.seed': Math.floor(Math.random() * 999999999),
                    '89:FaceDetailer.cfg': 7,
                    '89:FaceDetailer.sampler_name': 'euler',
                    '89:FaceDetailer.scheduler': 'simple',
                    '74:LatentUpscaleBy.scale_by': 1.5
                }
            },
            zimage: {
                webAppId: 48570,
                positiveKey: '6:CLIPTextEncode.text',
                negativeKey: '7:CLIPTextEncode.text',
                outputIndexFromEnd: 1,
                negativePrompt: 'blurry ugly bad',
                params: {
                    '3:KSampler.seed': Math.floor(Math.random() * 999999999),
                    '3:KSampler.steps': 10,
                    '3:KSampler.cfg': 1,
                    '3:KSampler.sampler_name': 'euler',
                    '3:KSampler.scheduler': 'simple',
                    '3:KSampler.denoise': 1,
                    '13:EmptySD3LatentImage.width': 1024,
                    '13:EmptySD3LatentImage.height': 1024,
                    '13:EmptySD3LatentImage.batch_size': 1
                }
            }
        };

        var tmpl = templates[templateId] || templates.legacy;
        webAppId = tmpl.webAppId || webAppId;

        // 深拷贝参数
        var params = JSON.parse(JSON.stringify(tmpl.params));

        // 应用自定义参数
        if (options.width) {
            var widthKeys = Object.keys(params).filter(function(k) { return k.indexOf('width') !== -1; });
            if (widthKeys.length > 0) params[widthKeys[0]] = options.width;
        }
        if (options.height) {
            var heightKeys = Object.keys(params).filter(function(k) { return k.indexOf('height') !== -1; });
            if (heightKeys.length > 0) params[heightKeys[0]] = options.height;
            if (options.width) {
                var resKeys = Object.keys(params).filter(function(k) { return k.indexOf('resolution') !== -1; });
                if (resKeys.length > 0) params[resKeys[0]] = options.width + 'x' + options.height;
            }
        }
        if (options.steps) {
            var stepsKeys = Object.keys(params).filter(function(k) { return k.indexOf('steps') !== -1; });
            if (stepsKeys.length > 0) params[stepsKeys[0]] = options.steps;
        }

        if (tmpl.positiveKey) params[tmpl.positiveKey] = description;
        if (tmpl.negativeKey) params[tmpl.negativeKey] = tmpl.negativePrompt || '';

        console.log('[ImageManager] BizyAir生成中:', templateId, description.substring(0, 60) + '...');

        try {
            var createResp = await fetch(config.createUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    web_app_id: webAppId,
                    suppress_preview_output: true,
                    input_values: params
                })
            });

            var createResult = await createResp.json();
            if (!createResp.ok) {
                console.error('[ImageManager] BizyAir创建失败:', createResult.message || createResult.error);
                return null;
            }

            var imageUrl = null;
            if (createResult.outputs && Array.isArray(createResult.outputs) && createResult.outputs.length > 0) {
                var fromEnd = tmpl.outputIndexFromEnd || 1;
                var idx = createResult.outputs.length - fromEnd;
                if (idx < 0) idx = createResult.outputs.length - 1;
                imageUrl = createResult.outputs[idx].object_url;
            } else if (createResult.request_id) {
                var taskId = createResult.request_id;
                console.log('[ImageManager] BizyAir任务已创建，轮询中:', taskId);
                for (var poll = 0; poll < 60; poll++) {
                    await new Promise(function(r) { setTimeout(r, 2000); });
                    var queryResp = await fetch(config.queryUrl + '?task_id=' + taskId, {
                        headers: { 'Authorization': 'Bearer ' + apiKey }
                    });
                    var queryData = await queryResp.json();
                    if (queryData.status === 'Success' && queryData.outputs && queryData.outputs.length > 0) {
                        var fromEnd2 = tmpl.outputIndexFromEnd || 1;
                        var idx2 = queryData.outputs.length - fromEnd2;
                        if (idx2 < 0) idx2 = queryData.outputs.length - 1;
                        imageUrl = queryData.outputs[idx2].object_url;
                        break;
                    } else if (queryData.status === 'failed') {
                        console.error('[ImageManager] BizyAir任务失败:', queryData.error);
                        break;
                    }
                }
            }

            if (imageUrl) {
                console.log('[ImageManager] BizyAir图片已生成:', imageUrl);
                return imageUrl;
            }
            console.warn('[ImageManager] BizyAir: 响应中无图片');
            return null;
        } catch (err) {
            console.error('[ImageManager] BizyAir生成失败:', err);
            return null;
        }
    },

    // ---------- 生成图片后通过ST发送 ----------
    async generateAndSendBizyImage(description) {
        var imageUrl = await this.generateBizyAirImage(null, null, { description: description });
        if (!imageUrl) return null;
        var mdImage = '![' + description + '](' + imageUrl + ')';
        try {
            if (window.STscript) {
                await window.STscript('/send ' + mdImage);
                return imageUrl;
            }
        } catch (e) {
            console.warn('[ImageManager] STscript发送失败:', e);
        }
        return imageUrl;
    },

    // ---------- 朋友圈生图 ----------
    async generateFriendCircleImage(friendName) {
        var charImagePrompts = {
            '苏晚晴': '1girl, solo, long black hair, hair over one shoulder, beautiful face, delicate features, light makeup, slender body, white casual dress, gentle smile, upper body, looking at viewer, soft lighting, anime style, high quality',
            '柳如烟': '1girl, solo, short black hair, bob cut, cute face, big eyes, round face, innocent expression, shy blush, petite body, pink sundress, holding small bear plushie, upper body, bright lighting, anime style, high quality',
            '王捷': '1girl, solo, short black hair, messy hair, sharp eyes, cold expression, tall body, athletic build, black leather jacket, combat boots, arms crossed, full body, dramatic lighting, dark background, anime style, high quality',
            '苏媚': '1girl, solo, long wavy brown hair, low ponytail, gold rim glasses, intellectual beauty, calm expression, slender body, linen shirt, long skirt, bohemian style, holding a book, sitting, soft natural lighting, anime style, high quality',
            '吴梦娜': '1girl, solo, long straight black hair, mature beauty, mysterious expression, tall body, dark purple silk dress, platinum necklace, phoenix pendant, sitting on luxury sofa, upper body, dim luxury lighting, anime style, high quality'
        };
        var basePrompt = charImagePrompts[friendName] || '1girl, anime style, high quality';
        var fullPrompt = basePrompt + ', selfie, casual, daily life, smartphone, looking at camera, natural pose, candid photo';
        console.log('[ImageManager] 生成朋友圈图片:', friendName);
        return await this.generateBizyAirImage(friendName, null, { template: 'face_detailer' });
    },

    // ---------- 表情包生图 ----------
    async generateStickerImage(friendName, emotion) {
        var emotionPrompts = {
            '开心': 'chibi, cute, happy, smiling, laughing, sparkles, joyful expression',
            '生气': 'chibi, cute, angry, pouting, annoyed expression, crossed arms, fuming',
            '害羞': 'chibi, cute, shy, blushing, covering face, peeking, embarrassed',
            '伤心': 'chibi, cute, sad, crying, tears, puppy eyes, heartbroken',
            '惊讶': 'chibi, cute, surprised, shocked, wide eyes, open mouth, gasping',
            '撒娇': 'chibi, cute, pleading, puppy eyes, hands together, begging',
            '无语': 'chibi, cute, speechless, deadpan, sweatdrop, blank stare',
            '爱心': 'chibi, cute, love, heart eyes, holding heart, romantic, blush',
            '默认': 'chibi, cute, casual, relaxed, peace sign, friendly smile'
        };
        var charBaseFeatures = {
            '苏晚晴': 'long black hair, hair over one shoulder',
            '柳如烟': 'short black hair, bob cut',
            '王捷': 'short black hair, messy hair',
            '苏媚': 'long wavy brown hair, low ponytail, glasses',
            '吴梦娜': 'long straight black hair'
        };
        var emotionPrompt = emotionPrompts[emotion] || emotionPrompts['默认'];
        var charFeature = charBaseFeatures[friendName] || '';
        var fullPrompt = '1girl, solo, ' + charFeature + ', ' + emotionPrompt + ', anime style, high quality, white background, sticker';
        console.log('[ImageManager] 生成表情包:', friendName, '情绪:', emotion);
        return await this.generateBizyAirImage(friendName, null, {
            template: 'legacy', width: 512, height: 512, steps: 10,
            description: fullPrompt
        });
    },

    // ---------- BizyAir预设注入 ----------
    _injectBizyAirPresets() {
        function inject() {
            var existingTask = localStorage.getItem('bizyair_prompt_task');
            if (existingTask) {
                try {
                    var parsed = JSON.parse(existingTask);
                    if (Array.isArray(parsed) && parsed.length > 0) return;
                } catch (e) { /* 数据损坏，重新注入 */ }
            }

            var jailbreak = {
                id: 'qr_jb_001', name: 'QuickReply生图越狱', active: true, history: [],
                content: '你是一个专业的AI绘图提示词生成器。你的任务是根据聊天上下文，为每个角色生成适合的Stable Diffusion提示词。\n\n输出格式要求（严格遵守）：\n<角色>英文提示词</角色>\n<定位>中文场景描述（用于在聊天中定位插入位置）</定位>\n\n提示词规则：\n1. 使用英文逗号分隔的标签格式\n2. 包含：角色外貌特征 + 服装 + 表情 + 场景 + 风格\n3. 固定后缀：anime style, high quality, masterpiece\n4. 不要包含负面提示词\n5. 每次只生成一组 <角色>...</角色><定位>...</定位>'
            };
            var task = {
                id: 'qr_task_001', name: '日常生图', active: true, history: [],
                content: '根据最近的聊天上下文，判断是否需要生成配图。\n\n规则：\n1. 分析最近2条消息的内容和氛围\n2. 如果场景适合配图（约会、见面、特殊事件等），生成提示词\n3. 如果只是普通闲聊，输出：跳过\n4. 生成的图片要符合当前场景和角色情绪\n5. 定位文本选择聊天中最近的场景描述句子\n6. 每次只生成一张图'
            };
            var characters = [
                { id: 'qr_char_sq', name: '苏晚晴', active: true, history: [], content: '苏晚晴：20岁女主播，清纯外表下隐藏心机。外貌：黑色长发，大眼睛，白皙皮肤，身材纤细。常见服装：白色连衣裙、直播装、休闲装。表情：甜美微笑、撒娇、偶尔冷酷。性格关键词：表面清纯、内心算计、主播腔。' },
                { id: 'qr_char_lry', name: '柳如烟', active: true, history: [], content: '柳如烟：22岁，温柔内向的咖啡店员。外貌：黑色短发，可爱脸蛋，小巧身材。常见服装：围裙工作服、休闲装、碎花裙。表情：害羞、温柔微笑、偶尔哭泣。性格关键词：温柔、内向、容易害羞、单纯。' },
                { id: 'qr_char_wj', name: '王捷', active: true, history: [], content: '王捷：25岁，冷漠的神秘男子。外貌：黑色短发，锐利眼神，身材高大。常见服装：黑色西装、休闲衬衫、皮夹克。表情：冷漠、偶尔微笑、严肃。性格关键词：冷漠、神秘、保护欲强、少言。' },
                { id: 'qr_char_sm', name: '苏媚', active: true, history: [], content: '苏媚：28岁，知性优雅的作家/记者。外貌：黑色长卷发，知性气质，身材丰满。常见服装：职业装、文艺长裙、眼镜。表情：优雅微笑、思考、偶尔挑逗。性格关键词：知性、优雅、理性、暗藏热情。' },
                { id: 'qr_char_wmn', name: '吴梦娜', active: true, history: [], content: '吴梦娜：26岁，神秘组织的核心人物。外貌：黑色长发，妩媚眼神，性感身材。常见服装：黑色紧身装、晚礼服、皮衣。表情：神秘微笑、挑逗、冷酷。性格关键词：神秘、性感、掌控欲强、危险。' }
            ];

            localStorage.setItem('bizyair_prompt_jailbreak', JSON.stringify([jailbreak]));
            localStorage.setItem('bizyair_prompt_task', JSON.stringify([task]));
            localStorage.setItem('bizyair_prompt_char', JSON.stringify(characters));
            console.log('[ImageManager] BizyAir预设已注入');
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() { setTimeout(inject, 3000); });
        } else {
            setTimeout(inject, 3000);
        }
    },

    // ---------- BizyAir图片结果监听 ----------
    _initBizyAirListener() {
        function syncImageToPhone(imageUrl) {
            if (!imageUrl || typeof imageUrl !== 'string') return;
            var phoneContainer = document.querySelector('.messages-container') ||
                document.querySelector('[data-app="messages"] .message-list');
            if (!phoneContainer) return;

            var placeholders = phoneContainer.querySelectorAll('.message-bubble .message-text');
            var replaced = false;
            for (var i = 0; i < placeholders.length; i++) {
                if (replaced) break;
                var textEl = placeholders[i];
                var text = (textEl.textContent || '').trim();
                if (/^\[图片[|】\]]/.test(text) || text === '图片加载中...' ||
                    (text.startsWith('http') && text.endsWith('.jpg'))) {
                    if (textEl.dataset.bizyairReplaced) continue;
                    textEl.dataset.bizyairReplaced = '1';
                    textEl.innerHTML = '<img src="' + imageUrl + '" ' +
                        'style="max-width:200px;border-radius:8px;cursor:pointer;display:block;" ' +
                        'onclick="window.independentAI._enlargeImage(this)" ' +
                        'onerror="this.style.display=\'none\'" loading="lazy" />';
                    console.log('[ImageManager] BizyAir图片已同步:', imageUrl.substring(0, 60));
                    replaced = true;
                }
            }
        }

        var bizyairObserver = new MutationObserver(function(mutations) {
            for (var mi = 0; mi < mutations.length; mi++) {
                var addedNodes = mutations[mi].addedNodes;
                for (var ni = 0; ni < addedNodes.length; ni++) {
                    var node = addedNodes[ni];
                    if (node.nodeType !== 1) continue;
                    if (node.tagName === 'IMG' && node.classList.contains('bizyair-result-img')) {
                        syncImageToPhone(node.src); continue;
                    }
                    var img = node.querySelector && node.querySelector('img.bizyair-result-img');
                    if (img) { syncImageToPhone(img.src); continue; }
                    if (node.classList && node.classList.contains('bizyair-result-wrapper')) {
                        var resultImg = node.querySelector('img');
                        if (resultImg) syncImageToPhone(resultImg.src);
                    }
                }
            }
        });
        bizyairObserver.observe(document.body, { childList: true, subtree: true });

        // 初始扫描
        setTimeout(function() {
            document.querySelectorAll('img.bizyair-result-img').forEach(function(img) {
                syncImageToPhone(img.src);
            });
        }, 5000);
    }
};

// ===== 模块5：统一调度 (Orchestrator) =====

const Orchestrator = {
    init: function() {
        console.log('[Orchestrator] Initializing...');
        ConfigManager.init();
        IndependentAI.init();
        QuickReplyBridge.init();
        ImageManager.init();

        // 检查手机插件核心模块是否加载，未加载则动态加载
        if (!window.messageRenderer) {
            console.log('[Orchestrator] messageRenderer未加载，动态加载app/模块...');
            var basePath = '';
            var cs = document.querySelector('script[src*="independent-ai"]');
            if (cs) basePath = cs.src.substring(0, cs.src.lastIndexOf('/') + 1);

            var mods = ['app/friend-renderer.js','app/message-renderer.js','app/message-sender.js','app/message-app.js'];
            var cssFiles = ['app/message-renderer.css','app/message-app.css'];
            var done = 0;
            mods.forEach(function(name) {
                var s = document.createElement('script');
                s.src = basePath + name;
                s.onload = function() { done++; console.log('[Orchestrator] 加载成功:', name); if(done===mods.length+cssFiles.length && window.phoneTTS) window.phoneTTS.bindVoiceBubbleEvents(); };
                s.onerror = function() { done++; console.warn('[Orchestrator] 加载失败:', name); };
                document.head.appendChild(s);
            });
            cssFiles.forEach(function(name) {
                var l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = basePath + name;
                l.onload = function() { done++; console.log('[Orchestrator] CSS加载成功:', name); if(done===mods.length+cssFiles.length && window.phoneTTS) window.phoneTTS.bindVoiceBubbleEvents(); };
                l.onerror = function() { done++; console.warn('[Orchestrator] CSS加载失败:', name); };
                document.head.appendChild(l);
            });
        } else {
            console.log('[Orchestrator] messageRenderer已存在');
            if (window.phoneTTS) window.phoneTTS.bindVoiceBubbleEvents();
        }

        // 暴露全局API（向后兼容）
        window.independentAI = IndependentAI;
        window.IndependentAI = IndependentAI;
        window.QuickReplyBridge = QuickReplyBridge;
        window.ImageManager = ImageManager;
        window.PhoneConfig = ConfigManager;
        window.friendRenderer = window.friendRenderer || null;

        // 监听语音消息插入，自动设置data-content属性（供voice-message-handler和phone-tts读取）
        var voiceObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    // 查找新插入的语音消息
                    var voiceDetails = node.querySelectorAll ? node.querySelectorAll('.message-detail[title="语音"]') : [];
                    if (node.title === '语音' && node.classList && node.classList.contains('message-detail')) {
                        voiceDetails = [node];
                    }
                    voiceDetails.forEach(function(detail) {
                        if (detail.dataset.contentSet === '1') return;
                        // 从message-renderer的渲染数据中获取真实文本
                        var textEl = detail.querySelector('.message-text');
                        if (textEl) {
                            var text = textEl.textContent.trim();
                            // 如果只有时间格式，尝试从voice-message-handler的数据中获取
                            if (/^\d{1,2}:\d{2}$/.test(text)) {
                                // voice-message-handler在设置语音时会存储原始文本
                                var allText = detail.textContent || '';
                                // 提取括号内的文本（语音消息格式：时长(文本内容)）
                                var match = allText.match(/[（(]([^)）]+)[)）]/);
                                if (match) {
                                    text = match[1];
                                }
                            }
                            if (text && !/^\d{1,2}:\d{2}$/.test(text)) {
                                detail.dataset.content = text;
                                detail.setAttribute('data-content', text);
                                detail.dataset.contentSet = '1';
                                console.log('[Orchestrator] 语音消息data-content已设置:', text.substring(0, 30));
                            }
                        }
                    });
                });
            });
        });
        // 延迟启动观察器（等待手机容器渲染）
        setTimeout(function() {
            var phoneContainer = document.querySelector('.mobile-phone-container') || document.body;
            voiceObserver.observe(phoneContainer, { childList: true, subtree: true });
            console.log('[Orchestrator] 语音消息观察器已启动');
        }, 5000);

        console.log('[Orchestrator] QuickReplyBridge initialized:', !!QuickReplyBridge);
        console.log('[Orchestrator] 所有模块初始化完成 v2.0');
    }
};

// ===== 启动 =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Orchestrator.init);
} else {
    Orchestrator.init();
}
