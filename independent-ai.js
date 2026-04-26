// ============================================================
// independent-ai.js v3.0 -- 轻量级协调器
// 职责：QuickReplyBridge（四选项渲染） + Orchestrator（统一调度）
// 依赖：bridge-api.js, role-api.js, social-api.js（由 phone-loader.js 预加载）
// 运行环境：SillyTavern 外置手机3.0插件（安卓Node.js封装APP）
// ============================================================

// ===== 模块1：四选项渲染 (QuickReplyBridge) =====
// 检测并渲染四选项按钮，事件驱动，不使用轮询

var QuickReplyBridge = {
    OPTION_TYPES: {
        '真情': { cls: 'qr-zhenqing', icon: '\u2665' },
        '套路': { cls: 'qr-taolu', icon: '\u2666' },
        '试探': { cls: 'qr-shitan', icon: '\u2660' },
        '行动': { cls: 'qr-xingdong', icon: '\u2663' }
    },

    _observer: null,
    _processedRequests: {},

    init: function () {
        // 注入CSS
        this._injectCSS();
        // 初始化事件驱动
        this._initEventDriven();
        // 首次处理已有消息
        this._processExistingMessages();
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
            '.quick-reply-container{display:flex;flex-wrap:wrap;margin:10px 0;padding:8px 0}' +
            '.quick-reply-container > *{margin:4px}' +
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
                var doneEls = document.querySelectorAll('.mes_text[data-qr-done]');
                for (var di = 0; di < doneEls.length; di++) {
                    delete doneEls[di].dataset.qrDone;
                }
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
    _processExistingMessages: function () {
        var self = this;
        var msgEls = document.querySelectorAll('.mes_text');
        console.log('[QuickReplyBridge] runAll, unprocessed messages:', msgEls.length);
        var chain = Promise.resolve();
        for (var i = 0; i < msgEls.length; i++) {
          (function (el) {
            chain = chain.then(function () { return self.processMessage(el); });
          })(msgEls[i]);
        }
        return chain;
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
    hideThinkingBlocks: function (msgEl) {
        // 从变量读取是否启用隐藏思考标签
        var self = this;
        var configPromise = (function () {
          try {
            var ConfigManager = window.BridgeAPI ? window.BridgeAPI.ConfigManager : null;
            if (ConfigManager) return ConfigManager.get('xb.ui.hideThinking');
          } catch (e) { /* 变量读取失败 */ }
          return Promise.resolve('true');
        })();

        return configPromise.then(function (hideEnabled) {
          if (hideEnabled === 'false') return;

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
        }); // end of configPromise.then
    },

    // ---------- 隐藏状态栏和游戏数据 ----------
    hideStateBlocks: function (msgEl) {
        // 从变量读取是否启用隐藏状态栏
        var self = this;
        var configPromise = (function () {
          try {
            var ConfigManager = window.BridgeAPI ? window.BridgeAPI.ConfigManager : null;
            if (ConfigManager) return ConfigManager.get('xb.ui.hideStateBlocks');
          } catch (e) { /* 变量读取失败 */ }
          return Promise.resolve('true');
        })();

        return configPromise.then(function (hideEnabled) {
          if (hideEnabled === 'false') return;

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
            preEls[pi].style.cssText = 'background:rgba(30,20,50,0.85);color:#e0d0f0;border:1px solid rgba(180,140,220,0.4);border-radius:8px;padding:10px 14px;margin:6px 0;font-size:0.88em;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        }
        var codeEls = msgEl.querySelectorAll('code');
        for (var ci2 = 0; ci2 < codeEls.length; ci2++) {
            if (codeEls[ci2].parentElement && codeEls[ci2].parentElement.tagName !== 'PRE') {
                codeEls[ci2].style.cssText = 'background:rgba(30,20,50,0.7);color:#e0d0f0;padding:2px 8px;border-radius:4px;font-size:0.88em;border:1px solid rgba(180,140,220,0.3);';
            }
        }
        var bqEls = msgEl.querySelectorAll('blockquote');
        for (var bi = 0; bi < bqEls.length; bi++) {
            bqEls[bi].style.cssText = 'background:rgba(30,20,50,0.75);color:#e0d0f0;border-left:3px solid rgba(180,140,220,0.6);border-radius:0 8px 8px 0;padding:8px 14px;margin:6px 0;font-size:0.9em;';
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
            for (var pi2 = 0; pi2 < metadataPatterns.length; pi2++) {
                if (metadataPatterns[pi2].test(tText)) {
                    tText = tText.replace(metadataPatterns[pi2], '');
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
        }); // end of configPromise.then
    },

    // ---------- 主界面聊天内容隐藏控制 ----------
    _applyMainChatVisibility: function () {
        var self = this;
        var configPromise = (function () {
          try {
            var ConfigManager = window.BridgeAPI ? window.BridgeAPI.ConfigManager : null;
            if (ConfigManager) return ConfigManager.get('xb.ui.hideMainChat');
          } catch (e) { /* 变量读取失败 */ }
          return Promise.resolve('false');
        })();

        return configPromise.then(function (hideMain) {
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
        }); // end of configPromise.then
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
    processMessage: function (msgEl) {
        var self = this;
        if (msgEl.dataset.qrDone) return Promise.resolve();

        // 检查是否启用四选项渲染（从变量读取，失败时默认启用）
        var configPromise = (function () {
          try {
            var ConfigManager = window.BridgeAPI ? window.BridgeAPI.ConfigManager : null;
            if (ConfigManager) return ConfigManager.get('xb.ui.renderQuickReply');
          } catch (e) { /* 变量读取失败 */ }
          return Promise.resolve('true');
        })();

        return configPromise.then(function (renderEnabled) {
          // 动态任务消息跳过四选项渲染，避免冲突
          var msgText = msgEl.textContent || msgEl.innerText || '';
          if (msgText.indexOf('[任务选择]') !== -1 || msgText.indexOf('[quest-choice]') !== -1) {
            self.hideThinkingBlocks(msgEl);
            self.hideStateBlocks(msgEl);
            return;
          }

          if (renderEnabled === 'false') {
            self.hideThinkingBlocks(msgEl);
            self.hideStateBlocks(msgEl);
            msgEl.dataset.qrDone = '1';
            return;
          }

          var plainText = self._extractPlainText(msgEl);
          console.log('[QuickReplyBridge] Processing message, plainText length:', plainText.length);
          console.log('[QuickReplyBridge] PlainText preview:', plainText.substring(0, 200));

          // 先美化系统变量
          self.beautifySystemVars(msgEl);

          // 提取选项
          var matches = self.extractOptions(msgEl);

          // 核心修复：1个选项也渲染（原来是2个才渲染）
          if (matches.length < 1) {
            self.hideThinkingBlocks(msgEl);
            self.hideStateBlocks(msgEl);
            return;
          }

        // 标记已处理
        msgEl.dataset.qrDone = '1';
        msgEl.dataset.thinkDone = '1';
        msgEl.dataset.stateDone = '1';

        // 构建按钮HTML
        var btnHtml = '<div class="quick-reply-container">';
        for (var i = 0; i < matches.length; i++) {
            var opt = matches[i];
            var cfg = self.OPTION_TYPES[opt.type] || { cls: 'qr-zhenqing', icon: '●' };
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

                function touchendHandler(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    setTimeout(function() { handleSelect.call(btn, e); }, 50);
                }
                btn.addEventListener('click', handleSelect);
                // 安卓触摸兼容
                btn.addEventListener('touchend', touchendHandler, false);
                // 兼容旧WebView：尝试使用passive:false确保preventDefault生效
                try {
                    btn.removeEventListener('touchend', touchendHandler, false);
                    btn.addEventListener('touchend', touchendHandler, { passive: false });
                } catch (ex) {
                    // 旧WebView不支持options对象，回退到上面的false绑定
                    btn.addEventListener('touchend', touchendHandler, false);
                }
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
                    console.log('[QuickReplyBridge-DIAG] 按钮不可见，强制修复样式');
                    for (var fixI = 0; fixI < btns.length; fixI++) {
                        btns[fixI].style.cssText = 'display:inline-flex!important;padding:12px 20px;border-radius:20px;background:#ffe0e8;color:#c0392b;border:2px solid #e8a0b0;font-size:16px;z-index:99999;position:relative;margin:4px;cursor:pointer;';
                    }
                    console.log('[QuickReplyBridge-DIAG] 已强制修复样式，检查手机是否出现红色按钮');
                }
            }
        }, 1000);
        }); // end of configPromise.then
    },

    // ---------- 扫描好友请求 ----------
    scanForFriendRequests: function () {
        var self = this;
        var msgEls = document.querySelectorAll('.mes_text');
        var friendRequestRegex = /\[角色[|｜]([^|｜]+)[|｜]([^|｜]+)[|｜]请求添加你为好友\]/;
        var chain = Promise.resolve();
        for (var i = 0; i < msgEls.length; i++) {
          (function (msgEl) {
            chain = chain.then(function () {
              var text = msgEl.textContent || '';

              // 格式1：[角色|名字|ID|请求添加你为好友]
              var match1 = text.match(friendRequestRegex);
              if (match1 && !self._processedRequests[match1[0]]) {
                self._processedRequests[match1[0]] = true;
                var name = match1[1].trim();
                var number = match1[2].trim();
                console.log('[QuickReplyBridge] 从聊天中检测到好友请求:', name, number);
                if (window.BridgeAPI) {
                  return window.BridgeAPI.ConfigManager.set('xb.phone.pendingFriend', name + '|' + number);
                }
              }

              // 格式2：[好友id|名字|ID]
              var friendIdRegex = /\[好友id[|｜]([^|｜]+)[|｜]([^\]]+)\]/g;
              var match2;
              var innerChain = Promise.resolve();
              while ((match2 = friendIdRegex.exec(text)) !== null) {
                (function (fullMatch, name2, id2) {
                  innerChain = innerChain.then(function () {
                    if (!self._processedRequests[fullMatch]) {
                      self._processedRequests[fullMatch] = true;
                      console.log('[QuickReplyBridge] Found friend ID tag:', name2, id2);
                      if (window.BridgeAPI) {
                        return window.BridgeAPI.ConfigManager.set('xb.phone.pendingFriend', name2 + '|' + id2);
                      }
                    }
                  });
                })(match2[0], match2[1].trim(), match2[2].trim());
              }
              return innerChain;
            });
          })(msgEls[i]);
        }
        return chain;
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
                    if (window.RoleAPI && window.RoleAPI.clearAllHistories) {
                        window.RoleAPI.clearAllHistories();
                        alert('✅ 聊天记录已清除！');
                        if (window.messageApp && window.messageApp.refreshFriendListUI) {
                            window.messageApp.refreshFriendListUI();
                        }
                        location.reload();
                    } else if (window.independentAI && window.independentAI.clearAllHistories) {
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

// ===== 模块2：统一调度 (Orchestrator) =====

var Orchestrator = {
    init: function() {
        console.log('[Orchestrator] Initializing...');

        // 1. 等待三个API模块加载完成
        if (!window.BridgeAPI) {
            console.error('[Orchestrator] BridgeAPI 未加载，初始化中止');
            return;
        }
        if (!window.RoleAPI) {
            console.error('[Orchestrator] RoleAPI 未加载，初始化中止');
            return;
        }
        if (!window.SocialAPI) {
            console.error('[Orchestrator] SocialAPI 未加载，初始化中止');
            return;
        }

        // 2. 初始化各模块
        window.BridgeAPI.init();
        window.RoleAPI.init();
        window.SocialAPI.init();
        QuickReplyBridge.init();

        // 初始化事件驱动消费补丁
        if (window.PendingMsgPatch && typeof window.PendingMsgPatch.init === 'function') {
            try {
                window.PendingMsgPatch.init();
                console.log('[Orchestrator] PendingMsgPatch 已启动');
            } catch (e) {
                console.warn('[Orchestrator] PendingMsgPatch 初始化失败:', e);
            }
        }

        // 初始化桥接客户端
        if (window.BridgeClient && typeof window.BridgeClient.init === 'function') {
            try {
                window.BridgeClient.init();
                console.log('[Orchestrator] BridgeClient 已启动');
            } catch (e) {
                console.warn('[Orchestrator] BridgeClient 初始化失败:', e);
            }
        }

        // 初始化小白X桥接（如果可用）
        if (window.XBBridge && window.XBBridge.isAvailable()) {
            console.log('[Orchestrator] 小白X桥接可用，初始化集成模块...');

            // 初始化上下文同步
            if (window.ContextSync) {
                window.ContextSync.startWatching();
                console.log('[Orchestrator] ContextSync 已启动');
            }

            // 初始化世界书联系人
            if (window.WorldbookContact) {
                window.WorldbookContact.syncContacts();
                window.WorldbookContact.startAutoSync();
                console.log('[Orchestrator] WorldbookContact 已启动');
            }

            // 初始化记忆桥接
            if (window.MemoryBridge) {
                window.MemoryBridge.startAutoSync();
                console.log('[Orchestrator] MemoryBridge 已启动');
            }
        } else {
            console.log('[Orchestrator] 小白X桥接不可用，跳过集成模块初始化');
        }

        // 3. 检查手机插件核心模块是否加载，未加载则动态加载
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

        // 4. 暴露全局API（向后兼容）
        window.independentAI = window.RoleAPI;
        window.IndependentAI = window.RoleAPI;
        window.QuickReplyBridge = QuickReplyBridge;
        window.ImageManager = window.SocialAPI;
        window.PhoneConfig = window.BridgeAPI.ConfigManager;
        window.friendRenderer = window.friendRenderer || null;

        // 暴露小白X桥接全局变量
        window.XBBridge = window.XBBridge || null;
        window.ContextSync = window.ContextSync || null;
        window.WorldbookContact = window.WorldbookContact || null;
        window.MemoryBridge = window.MemoryBridge || null;

        // 5. 监听语音消息插入，自动设置data-content属性（供voice-message-handler和phone-tts读取）
        var voiceObserver = new MutationObserver(function(mutations) {
            for (var mi = 0; mi < mutations.length; mi++) {
                var mutation = mutations[mi];
                var addedNodes = mutation.addedNodes;
                for (var ni = 0; ni < addedNodes.length; ni++) {
                    var node = addedNodes[ni];
                    if (node.nodeType !== 1) continue;
                    // 查找新插入的语音消息
                    var voiceDetails = node.querySelectorAll ? node.querySelectorAll('.message-detail[title="语音"]') : [];
                    if (node.title === '语音' && node.classList && node.classList.contains('message-detail')) {
                        voiceDetails = [node];
                    }
                    for (var vi = 0; vi < voiceDetails.length; vi++) {
                        var detail = voiceDetails[vi];
                        if (detail.dataset.contentSet === '1') continue;
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
                        }
                    }
                }
            }
        );
        // 延迟启动观察器（等待手机容器渲染）
        setTimeout(function() {
            var phoneContainer = document.querySelector('.mobile-phone-container') || document.body;
            voiceObserver.observe(phoneContainer, { childList: true, subtree: true });
            console.log('[Orchestrator] 语音消息观察器已启动');
        }, 5000);

        console.log('[Orchestrator] QuickReplyBridge initialized:', !!QuickReplyBridge);
        console.log('[Orchestrator] 所有模块初始化完成 v3.0');
    }
};

// ===== 启动 =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Orchestrator.init);
} else {
    Orchestrator.init();
}
