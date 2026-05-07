// ==SillyTavern Forum Auto Listener==
// @name         Forum Auto Listener for Mobile Extension
// @version      1.0.1
// @description  论坛自动监听器，监听聊天变化并自动触发论坛生成
// @author       Assistant

/**
 * 论坛自动监听器类
 * 监听聊天变化，在满足条件时自动生成论坛内容
 *
 * 配置说明：
 * - checkIntervalMs: 检查间隔时间（毫秒，默认5000）
 * - debounceMs: 防抖延迟时间（毫秒，默认500）
 * - immediateOnThreshold: 达到阈值时是否立即执行（默认true）
 * - enabled: 是否启用监听（默认true）
 * - maxRetries: 最大重试次数（默认3）
 * - autoStartWithUI: 是否随界面自动启停（默认true）
 */
class ForumAutoListener {
  constructor() {
    this.isListening = false;
    this.lastMessageCount = 0;
    this.lastCheckTime = Date.now();
    this.checkInterval = null; // 初始化为null，不自动创建定时器
    this.debounceTimer = null;
    this.isProcessingRequest = false; // 新增：请求处理锁
    this.lastProcessedMessageCount = 0; // 新增：最后处理的消息数量
    this.currentStatus = '待机中'; // 新增：当前状态
    this.statusElement = null; // 新增：状态显示元素
    this.lastGenerationTime = null; // 新增：最后生成时间
    this.generationCount = 0; // 新增：生成次数统计
    this.uiObserver = null; // 新增：界面观察器
    this.settings = {
      enabled: true,
      checkIntervalMs: 5000, // 5秒检查一次
      debounceMs: 500, // 防抖0.5秒（从2秒减少到0.5秒）
      immediateOnThreshold: true, // 新增：达到阈值时立即执行
      maxRetries: 3,
      autoStartWithUI: true, // 新增：是否随界面自动启停
    };

    // 绑定方法
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.checkForChanges = this.checkForChanges.bind(this);
    this.safeDebounceAutoGenerate = this.safeDebounceAutoGenerate.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.initStatusDisplay = this.initStatusDisplay.bind(this);
    this.setupUIObserver = this.setupUIObserver.bind(this); // 新增：设置界面观察器
    this.checkForumAppState = this.checkForumAppState.bind(this); // 新增：检查论坛应用状态
  }

  /**
   * 开始监听
   */
  start() {
    if (this.isListening) {
      console.log('[Forum Auto Listener] 已在监听中');
      return;
    }

    try {
      console.log('[Forum Auto Listener] 开始监听聊天变化...');

      // 初始化状态显示
      this.initStatusDisplay();

      // 更新状态
      this.updateStatus('启动中', 'info');

      // 初始化当前消息数量
      this.initializeMessageCount();

      // 设置定时检查
      this.checkInterval = setInterval(this.checkForChanges, this.settings.checkIntervalMs);

      // 监听SillyTavern事件（如果可用）
      this.setupEventListeners();

      this.isListening = true;
      this.updateStatus('监听中', 'success');
      console.log('[Forum Auto Listener] ✅ 监听已启动');
    } catch (error) {
      console.error('[Forum Auto Listener] 启动监听失败:', error);
      this.updateStatus('启动失败', 'error');
    }
  }

  /**
   * 停止监听
   */
  stop() {
    if (!this.isListening) {
      console.log('[Forum Auto Listener] 未在监听中');
      return;
    }

    try {
      console.log('[Forum Auto Listener] 停止监听...');
      this.updateStatus('停止中', 'warning');

      // 清除定时器
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      // 清除防抖定时器
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      // 移除事件监听器
      this.removeEventListeners();

      // 重置状态
      this.isProcessingRequest = false;

      this.isListening = false;
      this.updateStatus('已停止', 'offline');
      console.log('[Forum Auto Listener] ✅ 监听已停止');
    } catch (error) {
      console.error('[Forum Auto Listener] 停止监听失败:', error);
      this.updateStatus('停止失败', 'error');
    }
  }

  /**
   * 初始化当前消息数量
   */
  async initializeMessageCount() {
    try {
      if (window.forumManager) {
        const chatData = await window.forumManager.getCurrentChatData();
        if (chatData && chatData.messages) {
          this.lastMessageCount = chatData.messages.length;
          // 修复：移除lastProcessedMessageCount的初始化，避免干扰消息检测
          // this.lastProcessedMessageCount = chatData.messages.length;
          console.log(`[Forum Auto Listener] 初始消息数量: ${this.lastMessageCount}`);
        }
      } else {
        // 备用方案：直接从SillyTavern获取
        const chatData = this.getCurrentChatDataDirect();
        if (chatData && chatData.messages) {
          this.lastMessageCount = chatData.messages.length;
          console.log(`[Forum Auto Listener] 初始消息数量(备用): ${this.lastMessageCount}`);
        }
      }
    } catch (error) {
      console.warn('[Forum Auto Listener] 初始化消息数量失败:', error);
    }
  }

  /**
   * 检查聊天变化 - 仅通过定时器触发
   */
  async checkForChanges() {
    // 如果未启动监听，直接返回
    if (!this.isListening || !this.settings.enabled) {
      return;
    }

    // 检查SillyTavern是否正在生成消息，如果是则等待
    if (this.isSillyTavernBusy()) {
      console.log('[Forum Auto Listener] SillyTavern正在生成消息，等待完成...');
      return;
    }

    // 如果我们正在处理请求，也跳过这次检查
    if (this.isProcessingRequest) {
      console.log('[Forum Auto Listener] 正在处理请求中，跳过本次检查');
      return;
    }

    try {
      // 获取当前聊天数据 - 使用备用方案
      let chatData = null;
      if (window.forumManager && window.forumManager.getCurrentChatData) {
        chatData = await window.forumManager.getCurrentChatData();
      } else {
        // 备用方案：直接从SillyTavern获取
        chatData = this.getCurrentChatDataDirect();
      }

      if (!chatData || !chatData.messages) {
        return;
      }

      const currentMessageCount = chatData.messages.length;

      // 检查消息数量是否发生变化（修复：使用lastMessageCount而不是lastProcessedMessageCount）
      const messageIncrement = currentMessageCount - this.lastMessageCount;

      if (messageIncrement > 0) {
        console.log(
          `[Forum Auto Listener] 检测到新消息: +${messageIncrement} (${this.lastMessageCount} -> ${currentMessageCount})`,
        );

        // 获取阈值（优先从论坛管理器，否则使用默认值）
        const threshold =
          window.forumManager && window.forumManager.currentSettings
            ? window.forumManager.currentSettings.threshold
            : 1; // 默认阈值为1

        console.log(`[Forum Auto Listener] 当前阈值: ${threshold}`);

        // 更新计数（修复：立即更新lastMessageCount）
        this.lastMessageCount = currentMessageCount;
        this.lastCheckTime = Date.now();

        // 检查是否达到阈值
        if (messageIncrement >= threshold) {
          console.log(`[Forum Auto Listener] 达到阈值，触发立即自动生成`);
          this.updateStatus(`生成中 (阈值:${threshold})`, 'processing');

          // 调试：检查forumManager状态
          console.log(`[Forum Auto Listener] 调试 - forumManager存在: ${!!window.forumManager}`);
          console.log(
            `[Forum Auto Listener] 调试 - checkAutoGenerate存在: ${!!(
              window.forumManager && window.forumManager.checkAutoGenerate
            )}`,
          );
          console.log(`[Forum Auto Listener] 调试 - isProcessingRequest: ${this.isProcessingRequest}`);

          // 通知论坛管理器检查是否需要自动生成
          if (window.forumManager && window.forumManager.checkAutoGenerate) {
            console.log(`[Forum Auto Listener] 开始调用safeDebounceAutoGenerate(true)`);
            try {
              // 达到阈值时立即执行，不使用防抖
              this.safeDebounceAutoGenerate(true);
              console.log(`[Forum Auto Listener] safeDebounceAutoGenerate调用完成`);
            } catch (error) {
              console.error(`[Forum Auto Listener] safeDebounceAutoGenerate调用失败:`, error);
              this.updateStatus('生成失败', 'error');
            }
          } else {
            console.warn(
              `[Forum Auto Listener] 无法调用自动生成 - forumManager: ${!!window.forumManager}, checkAutoGenerate: ${!!(
                window.forumManager && window.forumManager.checkAutoGenerate
              )}`,
            );
            this.updateStatus('论坛管理器不可用', 'warning');
          }
        } else {
          console.log(`[Forum Auto Listener] 增量 ${messageIncrement} 未达到阈值 ${threshold}`);
          this.updateStatus(`监听中 (${messageIncrement}/${threshold})`, 'info');
        }
      } else if (messageIncrement === 0) {
        // 没有新消息
        if (window.DEBUG_FORUM_AUTO_LISTENER) {
          console.log(`[Forum Auto Listener] 无新消息 (当前: ${currentMessageCount})`);
        }
      }
    } catch (error) {
      console.error('[Forum Auto Listener] 检查变化失败:', error);
    }
  }

  /**
   * 安全的防抖自动生成 - 带请求锁
   * @param {boolean} immediate - 是否立即执行，不使用防抖
   */
  safeDebounceAutoGenerate(immediate = false) {
    // 如果正在处理请求，跳过
    if (this.isProcessingRequest) {
      console.log('[Forum Auto Listener] 正在处理请求中，跳过新的触发');
      return;
    }

    // 如果设置了立即执行，直接执行
    if (immediate || this.settings.immediateOnThreshold) {
      console.log('[Forum Auto Listener] 立即执行自动生成检查...');
      this.executeAutoGenerate();
      return;
    }

    // 清除之前的定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的定时器
    this.debounceTimer = setTimeout(async () => {
      this.executeAutoGenerate();
    }, this.settings.debounceMs);
  }

  /**
   * 执行自动生成的核心逻辑
   */
  async executeAutoGenerate() {
    if (this.isProcessingRequest) {
      console.log('[Forum Auto Listener] 请求已在处理中，跳过');
      return;
    }

    console.log('[Forum Auto Listener] 触发自动生成检查...');

    try {
      // 尝试初始化论坛管理器（如果不存在）
      if (!window.forumManager) {
        console.log('[Forum Auto Listener] 论坛管理器不存在，尝试初始化...');
        this.updateStatus('初始化论坛管理器', 'processing');
        await this.initializeForumManager();
      }

      // 检查论坛管理器状态
      if (window.forumManager && window.forumManager.isProcessing) {
        console.log('[Forum Auto Listener] 论坛管理器正在处理中，跳过');
        this.updateStatus('等待论坛管理器', 'waiting');
        return;
      }

      // 设置处理状态 - 在调用论坛管理器之前设置
      this.isProcessingRequest = true;

      // 执行自动生成 - 完全清除处理状态避免冲突
      if (window.forumManager && window.forumManager.checkAutoGenerate) {
        console.log('[Forum Auto Listener] 调用论坛管理器的checkAutoGenerate...');
        this.updateStatus('调用论坛管理器', 'processing');

        // 临时清除所有可能导致冲突的状态
        const originalProcessingState = this.isProcessingRequest;
        this.isProcessingRequest = false;

        // 设置标志告诉论坛管理器这是合法调用
        window.forumAutoListener._allowForumManagerCall = true;

        try {
          await window.forumManager.checkAutoGenerate();
          console.log('[Forum Auto Listener] 论坛管理器调用完成');
          this.generationCount++;
          this.lastGenerationTime = new Date();
          this.updateStatus(`生成完成 (#${this.generationCount})`, 'success');
        } finally {
          // 恢复状态
          this.isProcessingRequest = originalProcessingState;
          delete window.forumAutoListener._allowForumManagerCall;
        }
      } else {
        // 如果论坛管理器仍然不可用，尝试直接生成
        console.log('[Forum Auto Listener] 论坛管理器不可用，尝试直接生成论坛内容...');
        this.updateStatus('直接生成论坛内容', 'processing');
        await this.directForumGenerate();
        this.generationCount++;
        this.lastGenerationTime = new Date();
        this.updateStatus(`直接生成完成 (#${this.generationCount})`, 'success');
      }

      // 更新已处理的消息数量
      // 修复：移除这行代码，因为它会导致监听器只生效一次
      // this.lastProcessedMessageCount = this.lastMessageCount;
      console.log(`[Forum Auto Listener] 生成完成，继续监听新消息`);

      // 恢复监听状态
      setTimeout(() => {
        if (this.isListening) {
          this.updateStatus('监听中', 'success');
        }
      }, 2000);
    } catch (error) {
      console.error('[Forum Auto Listener] 自动生成检查失败:', error);
      this.updateStatus('生成检查失败', 'error');
    } finally {
      this.isProcessingRequest = false;
    }
  }

  /**
   * 初始化论坛管理器
   */
  async initializeForumManager() {
    try {
      console.log('[Forum Auto Listener] 尝试加载论坛管理器...');

      // 尝试加载论坛相关脚本
      const forumScripts = [
        '/scripts/extensions/third-party/mobile/app/forum-app/forum-manager.js',
        '/scripts/extensions/third-party/mobile/app/forum-app/forum-app.js',
      ];

      for (const scriptPath of forumScripts) {
        if (!document.querySelector(`script[src*="${scriptPath}"]`)) {
          console.log(`[Forum Auto Listener] 加载脚本: ${scriptPath}`);
          await this.loadScript(scriptPath);
        }
      }

      // 等待一下让脚本初始化
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 尝试创建论坛管理器实例
      if (window.ForumManager && !window.forumManager) {
        console.log('[Forum Auto Listener] 创建论坛管理器实例...');
        window.forumManager = new window.ForumManager();
        if (window.forumManager.initialize) {
          await window.forumManager.initialize();
        }
      }

      if (window.forumManager) {
        console.log('[Forum Auto Listener] ✅ 论坛管理器初始化成功');
      } else {
        console.warn('[Forum Auto Listener] ⚠️ 论坛管理器初始化失败');
      }
    } catch (error) {
      console.error('[Forum Auto Listener] 初始化论坛管理器失败:', error);
    }
  }

  /**
   * 加载脚本文件
   */
  async loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 直接生成论坛内容（当论坛管理器不可用时）
   */
  async directForumGenerate() {
    try {
      console.log('[Forum Auto Listener] 直接生成论坛内容...');

      // 获取当前聊天数据
      const context = window.getContext ? window.getContext() : null;
      if (!context || !context.chat) {
        console.warn('[Forum Auto Listener] 无法获取聊天上下文');
        return;
      }

      // 构建论坛生成提示
      const forumPrompt = this.buildForumPrompt(context.chat);

      // 使用静默生成
      if (window.generateQuietPrompt) {
        console.log('[Forum Auto Listener] 使用generateQuietPrompt生成论坛内容...');
        const forumContent = await window.generateQuietPrompt(forumPrompt, false, false);

        if (forumContent) {
          console.log('[Forum Auto Listener] ✅ 论坛内容生成成功');
          // 可以在这里添加保存或显示论坛内容的逻辑
          this.displayForumContent(forumContent);
        } else {
          console.warn('[Forum Auto Listener] 论坛内容生成为空');
        }
      } else {
        console.warn('[Forum Auto Listener] generateQuietPrompt不可用');
      }
    } catch (error) {
      console.error('[Forum Auto Listener] 直接生成论坛内容失败:', error);
    }
  }

  /**
   * 构建论坛生成提示
   */
  buildForumPrompt(chatMessages) {
    const recentMessages = chatMessages.slice(-10); // 取最近10条消息

    let prompt = '基于以下聊天内容，生成一个论坛讨论帖子。请包含主要观点和讨论重点：\n\n';

    recentMessages.forEach((msg, index) => {
      if (!msg.is_system) {
        prompt += `${msg.name || '用户'}: ${msg.mes}\n`;
      }
    });

    prompt += '\n请生成论坛讨论内容：';

    return prompt;
  }

  /**
   * 显示论坛内容
   */
  displayForumContent(content) {
    try {
      // 尝试将内容显示在聊天中或通知用户
      console.log('[Forum Auto Listener] 论坛内容已生成:', content);

      // 可以添加到聊天中作为系统消息
      if (window.sendSystemMessage) {
        window.sendSystemMessage('GENERIC', `🏛️ 论坛内容已生成：\n\n${content}`);
      } else {
        // 或者显示通知
        if (window.toastr) {
          window.toastr.success('论坛内容已自动生成', '论坛监听器');
        }
      }
    } catch (error) {
      console.error('[Forum Auto Listener] 显示论坛内容失败:', error);
    }
  }

  /**
   * 检查SillyTavern是否正忙（生成消息中）
   */
  isSillyTavernBusy() {
    try {
      // 检查是否正在发送消息
      if (typeof window.is_send_press !== 'undefined' && window.is_send_press) {
        return true;
      }

      // 检查是否正在生成消息
      if (typeof window.is_generating !== 'undefined' && window.is_generating) {
        return true;
      }

      // 检查流式处理器状态
      if (window.streamingProcessor && !window.streamingProcessor.isFinished) {
        return true;
      }

      // 检查群组生成状态
      if (typeof window.is_group_generating !== 'undefined' && window.is_group_generating) {
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[Forum Auto Listener] 检查SillyTavern状态失败:', error);
      return false; // 如果检查失败，假设不忙
    }
  }

  /**
   * 直接从SillyTavern获取聊天数据
   */
  getCurrentChatDataDirect() {
    try {
      // 尝试从全局chat变量获取
      if (typeof window.chat !== 'undefined' && Array.isArray(window.chat)) {
        return {
          messages: window.chat,
          characterName: window.name2 || '角色',
          chatId: window.getCurrentChatId ? window.getCurrentChatId() : 'unknown',
        };
      }

      // 尝试从context获取
      if (window.getContext) {
        const context = window.getContext();
        if (context && context.chat) {
          return {
            messages: context.chat,
            characterName: context.name2 || '角色',
            chatId: context.chatId || 'unknown',
          };
        }
      }

      console.warn('[Forum Auto Listener] 无法直接获取聊天数据');
      return null;
    } catch (error) {
      console.error('[Forum Auto Listener] 直接获取聊天数据失败:', error);
      return null;
    }
  }

  /**
   * 防抖自动生成 - 保持向后兼容
   */
  debounceAutoGenerate() {
    this.safeDebounceAutoGenerate();
  }

  /**
   * 手动触发论坛生成（无状态冲突）
   */
  async manualTrigger() {
    console.log('[Forum Auto Listener] 手动触发论坛生成...');
    this.updateStatus('手动触发生成', 'processing');

    try {
      // 尝试初始化论坛管理器（如果不存在）
      if (!window.forumManager) {
        console.log('[Forum Auto Listener] 论坛管理器不存在，尝试初始化...');
        this.updateStatus('初始化论坛管理器', 'processing');
        await this.initializeForumManager();
      }

      // 直接调用论坛管理器，清除状态避免冲突
      if (window.forumManager && window.forumManager.checkAutoGenerate) {
        console.log('[Forum Auto Listener] 直接调用论坛管理器...');
        this.updateStatus('调用论坛管理器', 'processing');

        // 设置标志告诉论坛管理器这是合法的手动调用
        window.forumAutoListener._allowForumManagerCall = true;

        try {
          await window.forumManager.checkAutoGenerate();
          console.log('[Forum Auto Listener] ✅ 论坛管理器调用完成');
          this.generationCount++;
          this.lastGenerationTime = new Date();
          this.updateStatus(`手动生成完成 (#${this.generationCount})`, 'success');
        } finally {
          delete window.forumAutoListener._allowForumManagerCall;
        }
      } else if (window.forumManager && window.forumManager.manualGenerate) {
        console.log('[Forum Auto Listener] 调用手动生成方法...');
        this.updateStatus('调用手动生成', 'processing');

        // 设置标志
        window.forumAutoListener._allowForumManagerCall = true;

        try {
          await window.forumManager.manualGenerate();
          console.log('[Forum Auto Listener] ✅ 手动生成完成');
          this.generationCount++;
          this.lastGenerationTime = new Date();
          this.updateStatus(`手动生成完成 (#${this.generationCount})`, 'success');
        } finally {
          delete window.forumAutoListener._allowForumManagerCall;
        }
      } else {
        // 如果论坛管理器不可用，尝试直接生成
        console.log('[Forum Auto Listener] 论坛管理器不可用，尝试直接生成论坛内容...');
        this.updateStatus('直接生成论坛内容', 'processing');
        await this.directForumGenerate();
        this.generationCount++;
        this.lastGenerationTime = new Date();
        this.updateStatus(`直接生成完成 (#${this.generationCount})`, 'success');
      }

      // 恢复监听状态
      setTimeout(() => {
        if (this.isListening) {
          this.updateStatus('监听中', 'success');
        }
      }, 2000);
    } catch (error) {
      console.error('[Forum Auto Listener] 手动触发失败:', error);
      this.updateStatus('手动触发失败', 'error');
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    try {
      // 监听SillyTavern的消息事件（如果可用）
      if (window.eventSource && window.event_types) {
        // 监听消息接收事件
        if (window.event_types.MESSAGE_RECEIVED) {
          this.messageReceivedHandler = this.onMessageReceived.bind(this);
          window.eventSource.on(window.event_types.MESSAGE_RECEIVED, this.messageReceivedHandler);
        }

        // 监听消息发送事件
        if (window.event_types.MESSAGE_SENT) {
          this.messageSentHandler = this.onMessageSent.bind(this);
          window.eventSource.on(window.event_types.MESSAGE_SENT, this.messageSentHandler);
        }

        console.log('[Forum Auto Listener] SillyTavern事件监听器已设置');
      } else {
        console.log('[Forum Auto Listener] SillyTavern事件系统不可用，仅使用定时器检查');
      }

      // 不再设置DOM观察器，避免重复触发
      // this.setupDOMObserver();
    } catch (error) {
      console.warn('[Forum Auto Listener] 设置事件监听器失败:', error);
    }
  }

  /**
   * 移除事件监听器
   */
  removeEventListeners() {
    try {
      // 移除SillyTavern事件监听器
      if (window.eventSource) {
        if (this.messageReceivedHandler) {
          window.eventSource.off(window.event_types.MESSAGE_RECEIVED, this.messageReceivedHandler);
        }
        if (this.messageSentHandler) {
          window.eventSource.off(window.event_types.MESSAGE_SENT, this.messageSentHandler);
        }
      }

      // 移除DOM观察器
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }

      console.log('[Forum Auto Listener] 事件监听器已移除');
    } catch (error) {
      console.warn('[Forum Auto Listener] 移除事件监听器失败:', error);
    }
  }

  /**
   * 消息接收事件处理 - 修复：不再直接增加计数
   */
  onMessageReceived(data) {
    console.log('[Forum Auto Listener] 收到消息事件:', data);
    // 不再直接增加计数，让定时器检查处理
    // this.lastMessageCount++;
    // 触发检查，但不立即增加计数
    this.safeDebounceAutoGenerate();
  }

  /**
   * 消息发送事件处理 - 修复：不再直接增加计数
   */
  onMessageSent(data) {
    console.log('[Forum Auto Listener] 发送消息事件:', data);
    // 不再直接增加计数，让定时器检查处理
    // this.lastMessageCount++;
    // 触发检查，但不立即增加计数
    this.safeDebounceAutoGenerate();
  }

  /**
   * 设置DOM观察器（暂时禁用，避免重复触发）
   */
  setupDOMObserver() {
    // 暂时禁用DOM观察器以避免重复触发
    console.log('[Forum Auto Listener] DOM观察器已禁用，避免重复触发');
    return;

    try {
      // 观察聊天容器的变化
      const chatContainer =
        document.querySelector('#chat') ||
        document.querySelector('.chat-container') ||
        document.querySelector('[data-testid="chat"]');

      if (chatContainer) {
        this.domObserver = new MutationObserver(mutations => {
          let hasNewMessage = false;

          mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              // 检查是否有新的消息节点
              mutation.addedNodes.forEach(node => {
                if (
                  node.nodeType === Node.ELEMENT_NODE &&
                  (node.classList.contains('message') ||
                    node.querySelector('.message') ||
                    node.classList.contains('mes'))
                ) {
                  hasNewMessage = true;
                }
              });
            }
          });

          if (hasNewMessage) {
            console.log('[Forum Auto Listener] DOM检测到新消息');
            this.safeDebounceAutoGenerate();
          }
        });

        this.domObserver.observe(chatContainer, {
          childList: true,
          subtree: true,
        });

        console.log('[Forum Auto Listener] DOM观察器已设置');
      } else {
        console.warn('[Forum Auto Listener] 未找到聊天容器，无法设置DOM观察器');
      }
    } catch (error) {
      console.warn('[Forum Auto Listener] 设置DOM观察器失败:', error);
    }
  }

  /**
   * 设置界面观察器 - 监听论坛界面的显示和隐藏
   */
  setupUIObserver() {
    if (!this.settings.autoStartWithUI) {
      console.log('[Forum Auto Listener] 界面自动启停已禁用');
      return;
    }

    try {
      console.log('[Forum Auto Listener] 设置界面观察器...');

      // 不再初始检查当前状态，只在点击按钮时启动

      // 移除旧的事件监听器
      document.removeEventListener('click', this._clickHandler);

      // 创建新的点击事件处理函数
      this._clickHandler = event => {
        // 检查是否点击了论坛应用按钮
        const forumAppButton = event.target.closest('[data-app="forum"]');
        if (forumAppButton) {
          console.log('[Forum Auto Listener] 检测到论坛应用按钮点击');
          // 给DOM一点时间加载后启动监听
          setTimeout(() => {
            if (!this.isListening) {
              console.log('[Forum Auto Listener] 启动监听');
              this.start();
            }
          }, 300);
        }

        // 检查是否点击了返回按钮或关闭手机界面
        const backButton = event.target.closest('.back-button');
        const closeButton = event.target.closest(
          '.mobile-phone-overlay, .close-button, .drawer-close, [data-action="close"]',
        );
        if (backButton || closeButton) {
          console.log('[Forum Auto Listener] 检测到返回按钮或关闭按钮点击');
          // 停止监听
          if (this.isListening) {
            console.log('[Forum Auto Listener] 停止监听');
            this.stop();
          }
        }
      };

      // 添加点击事件监听
      document.addEventListener('click', this._clickHandler);

      console.log('[Forum Auto Listener] 界面观察器已设置 - 仅在点击论坛按钮时启动');

      // 不再使用MutationObserver持续检查状态
      if (this.uiObserver) {
        this.uiObserver.disconnect();
        this.uiObserver = null;
      }
    } catch (error) {
      console.error('[Forum Auto Listener] 设置界面观察器失败:', error);
    }
  }

  /**
   * 检查论坛应用状态 - 判断是否显示论坛界面
   */
  checkForumAppState() {
    // 不再主动检查状态，改为只响应点击事件
    console.log('[Forum Auto Listener] 状态检查已改为仅响应点击事件');
  }

  /**
   * 设置是否随界面自动启停
   * @param {boolean} enabled - 是否启用
   */
  setAutoStartWithUI(enabled) {
    this.settings.autoStartWithUI = enabled;
    console.log(`[Forum Auto Listener] 界面自动启停设置已更新: ${enabled}`);

    if (enabled) {
      this.setupUIObserver();
      // 立即检查当前状态
      this.checkForumAppState();
    } else if (this.uiObserver) {
      // 如果禁用，断开观察器
      this.uiObserver.disconnect();
      this.uiObserver = null;
    }
  }

  /**
   * 更新设置
   */
  updateSettings(newSettings) {
    const oldAutoStartWithUI = this.settings.autoStartWithUI;

    this.settings = { ...this.settings, ...newSettings };

    // 如果更新了检查间隔，重新启动定时器
    if (newSettings.checkIntervalMs && this.isListening) {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      this.checkInterval = setInterval(this.checkForChanges, this.settings.checkIntervalMs);
    }

    // 如果更新了自动启停设置
    if (newSettings.autoStartWithUI !== undefined && newSettings.autoStartWithUI !== oldAutoStartWithUI) {
      this.setAutoStartWithUI(newSettings.autoStartWithUI);
    }
  }

  /**
   * 设置是否立即执行（达到阈值时）
   * @param {boolean} immediate - 是否立即执行
   */
  setImmediateOnThreshold(immediate) {
    this.settings.immediateOnThreshold = immediate;
    console.log(`[Forum Auto Listener] 立即执行设置已更新: ${immediate}`);
  }

  /**
   * 设置防抖延迟时间
   * @param {number} delayMs - 延迟时间（毫秒）
   */
  setDebounceDelay(delayMs) {
    this.settings.debounceMs = delayMs;
    console.log(`[Forum Auto Listener] 防抖延迟时间已更新: ${delayMs}ms`);
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isListening: this.isListening,
      isProcessingRequest: this.isProcessingRequest,
      lastMessageCount: this.lastMessageCount,
      lastProcessedMessageCount: this.lastProcessedMessageCount,
      lastCheckTime: this.lastCheckTime,
      settings: this.settings,
    };
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      ...this.getStatus(),
      hasCheckInterval: !!this.checkInterval,
      hasDebounceTimer: !!this.debounceTimer,
      hasMessageReceivedHandler: !!this.messageReceivedHandler,
      hasMessageSentHandler: !!this.messageSentHandler,
      hasDOMObserver: !!this.domObserver,
      timeSinceLastCheck: Date.now() - this.lastCheckTime,
    };
  }

  /**
   * 强制检查
   */
  async forceCheck() {
    console.log('[Forum Auto Listener] 强制检查...');
    await this.checkForChanges();
  }

  /**
   * 重置状态
   */
  reset() {
    this.lastMessageCount = 0;
    this.lastProcessedMessageCount = 0;
    this.lastCheckTime = Date.now();
    this.isProcessingRequest = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    console.log('[Forum Auto Listener] 状态已重置');
  }

  /**
   * 确保监听器持续运行 - 状态恢复机制
   */
  ensureContinuousListening() {
    // 不再自动启动监听器，只修复可能的状态问题

    // 如果处理状态卡住了，重置它
    if (this.isProcessingRequest) {
      const now = Date.now();
      const timeSinceLastCheck = now - this.lastCheckTime;

      // 如果超过30秒还在处理状态，认为卡住了
      if (timeSinceLastCheck > 30000) {
        console.warn('[Forum Auto Listener] 检测到处理状态卡住，重置状态...');
        this.isProcessingRequest = false;
        this.lastCheckTime = now;
      }
    }

    // 检查定时器是否还在运行（如果监听器已启动）
    if (this.isListening && !this.checkInterval) {
      console.warn('[Forum Auto Listener] 检测到定时器丢失，重新设置...');
      this.checkInterval = setInterval(this.checkForChanges, this.settings.checkIntervalMs);
    }
  }

  /**
   * 检查是否允许论坛管理器调用 - 供论坛管理器使用
   * @returns {boolean} 是否允许调用
   */
  isForumManagerCallAllowed() {
    // 检查是否有合法的调用标志
    if (window.forumAutoListener && window.forumAutoListener._allowForumManagerCall) {
      return true;
    }

    // 如果监听器未在处理中，也允许调用
    return !this.isProcessingRequest;
  }

  /**
   * 为论坛管理器提供的安全调用包装器
   */
  async safeForumManagerCall(callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('回调函数是必需的');
    }

    // 设置合法调用标志
    window.forumAutoListener._allowForumManagerCall = true;

    // 临时清除处理状态
    const originalState = this.isProcessingRequest;
    this.isProcessingRequest = false;

    try {
      console.log('[Forum Auto Listener] 执行安全论坛管理器调用...');
      const result = await callback();
      console.log('[Forum Auto Listener] 安全调用完成');
      return result;
    } finally {
      // 恢复状态
      this.isProcessingRequest = originalState;
      delete window.forumAutoListener._allowForumManagerCall;
    }
  }

  /**
   * 初始化状态显示
   */
  initStatusDisplay() {
    try {
      // 尝试查找现有的状态容器
      let statusContainer = document.getElementById('forum-auto-listener-status');

      if (!statusContainer) {
        // 创建状态显示容器
        statusContainer = document.createElement('div');
        statusContainer.id = 'forum-auto-listener-status';
        statusContainer.className = 'forum-status-container';

        // 创建状态内容
        statusContainer.innerHTML = `
                    <div class="forum-status-header">
                        <span class="forum-status-icon">🤖</span>
                        <span class="forum-status-title">论坛自动监听器</span>
                    </div>
                    <div class="forum-status-content">
                        <div class="forum-status-line">
                            <span class="forum-status-label">状态:</span>
                            <span class="forum-status-value" id="forum-listener-status">初始化中</span>
                            <span class="forum-status-indicator" id="forum-listener-indicator"></span>
                        </div>
                        <div class="forum-status-line">
                            <span class="forum-status-label">生成次数:</span>
                            <span class="forum-status-value" id="forum-listener-count">0</span>
                        </div>
                        <div class="forum-status-line">
                            <span class="forum-status-label">最后生成:</span>
                            <span class="forum-status-value" id="forum-listener-time">从未</span>
                        </div>
                    </div>
                `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
                    .forum-status-container {
                        background: #2d3748;
                        border: 1px solid #4a5568;
                        border-radius: 8px;
                        padding: 12px;
                        margin: 8px;
                        color: #e2e8f0;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        font-size: 12px;
                        max-width: 300px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);display: none !important;
                    }
                    .forum-status-header {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                        font-weight: bold;
                        border-bottom: 1px solid #4a5568;
                        padding-bottom: 6px;
                    }
                    .forum-status-icon {
                        margin-right: 6px;
                        font-size: 14px;
                    }
                    .forum-status-title {
                        color: #63b3ed;
                    }
                    .forum-status-line {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin: 4px 0;
                    }
                    .forum-status-label {
                        color: #a0aec0;
                        flex-shrink: 0;
                        margin-right: 8px;
                    }
                    .forum-status-value {
                        flex-grow: 1;
                        text-align: right;
                        margin-right: 6px;
                    }
                    .forum-status-indicator {
                        display: inline-block;
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        flex-shrink: 0;
                    }
                    .status-success { background-color: #48bb78; }
                    .status-error { background-color: #f56565; }
                    .status-warning { background-color: #ed8936; }
                    .status-info { background-color: #4299e1; }
                    .status-processing { background-color: #9f7aea; }
                    .status-waiting { background-color: #ecc94b; }
                    .status-offline { background-color: #718096; }
                `;

        if (!document.head.querySelector('#forum-auto-listener-styles')) {
          style.id = 'forum-auto-listener-styles';
          document.head.appendChild(style);
        }

        // 尝试添加到合适的位置
        const targetContainer =
          document.getElementById('extensions_settings') ||
          document.getElementById('floatingPrompt') ||
          document.getElementById('left-nav-panel') ||
          document.body;

        targetContainer.appendChild(statusContainer);
        console.log('[Forum Auto Listener] 状态显示已初始化');
      }

      this.statusElement = statusContainer;
    } catch (error) {
      console.warn('[Forum Auto Listener] 初始化状态显示失败:', error);
    }
  }

  /**
   * 更新状态显示
   * @param {string} status - 状态文本
   * @param {string} type - 状态类型 (success, error, warning, info, processing, waiting, offline)
   */
  updateStatus(status, type = 'info') {
    try {
      this.currentStatus = status;

      // 更新页面显示
      const statusValueElement = document.getElementById('forum-listener-status');
      const statusIndicatorElement = document.getElementById('forum-listener-indicator');
      const countElement = document.getElementById('forum-listener-count');
      const timeElement = document.getElementById('forum-listener-time');

      if (statusValueElement) {
        statusValueElement.textContent = status;
      }

      if (statusIndicatorElement) {
        // 清除所有状态类
        statusIndicatorElement.className = 'forum-status-indicator';
        // 添加新状态类
        statusIndicatorElement.classList.add(`status-${type}`);
      }

      if (countElement) {
        countElement.textContent = this.generationCount.toString();
      }

      if (timeElement && this.lastGenerationTime) {
        timeElement.textContent = this.lastGenerationTime.toLocaleTimeString();
      }

      // 控制台日志
      const statusIcon = this.getStatusIcon(type);
      console.log(`[Forum Auto Listener] ${statusIcon} ${status}`);
    } catch (error) {
      console.warn('[Forum Auto Listener] 更新状态显示失败:', error);
    }
  }

  /**
   * 获取状态图标
   * @param {string} type - 状态类型
   * @returns {string} 状态图标
   */
  getStatusIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      processing: '⏳',
      waiting: '⏸️',
      offline: '⭕',
    };
    return icons[type] || 'ℹ️';
  }

  /**
   * 获取详细状态信息
   */
  getDetailedStatus() {
    return {
      ...this.getStatus(),
      currentStatus: this.currentStatus,
      generationCount: this.generationCount,
      lastGenerationTime: this.lastGenerationTime,
      hasStatusDisplay: !!this.statusElement,
    };
  }
}

// 创建全局实例
window.ForumAutoListener = ForumAutoListener;
window.forumAutoListener = new ForumAutoListener();

// [ST适配] 添加 ST debug-core 期望的方法别名
if (window.forumAutoListener) {
    if (!window.forumAutoListener.startListening && typeof window.forumAutoListener.start === 'function') {
        window.forumAutoListener.startListening = function() {
            return window.forumAutoListener.start();
        };
    }
    if (!window.forumAutoListener.stopListening && typeof window.forumAutoListener.stop === 'function') {
        window.forumAutoListener.stopListening = function() {
            return window.forumAutoListener.stop();
        };
    }
    console.log('[ForumAutoListener] ✅ ST适配别名已添加: startListening, stopListening');
}

// 添加快捷查看状态的全局方法
window.showForumAutoListenerStatus = () => {
  const status = window.forumAutoListener.getDetailedStatus();
  console.table(status);
  return status;
};

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForumAutoListener;
}

// 设置界面观察器
setTimeout(() => {
  try {
    console.log('[Forum Auto Listener] 设置界面观察器...');
    if (window.forumAutoListener) {
      // 确保不会自动启动定时器
      if (window.forumAutoListener.checkInterval) {
        clearInterval(window.forumAutoListener.checkInterval);
        window.forumAutoListener.checkInterval = null;
        console.log('[Forum Auto Listener] 已清除可能存在的定时器');
      }

      window.forumAutoListener.setupUIObserver();

      // 自动启动监听器
      console.log('[Forum Auto Listener] 自动启动监听器...');
      if (!window.forumAutoListener.isListening) {
        window.forumAutoListener.start();
        console.log('[Forum Auto Listener] ✅ 自动启动成功');
      }
    }
  } catch (error) {
    console.error('[Forum Auto Listener] 设置界面观察器失败:', error);
  }
}, 2000); // 等待2秒让DOM加载完成

// 移除健康检查定时器，因为它可能会导致监听器自动重启
// 不再需要自动恢复监听功能，因为我们只想在用户明确点击时启动

console.log('[Forum Auto Listener] 论坛自动监听器模块加载完成');
console.log('[Forum Auto Listener] 🔧 关键改进:');
console.log('[Forum Auto Listener]   ✅ 自动启动：页面加载后自动开始监听');
console.log('[Forum Auto Listener]   ✅ 自动停止：点击返回或关闭按钮时自动停止');
console.log('[Forum Auto Listener]   ✅ 排队机制：等待SillyTavern空闲时再生成');
console.log('[Forum Auto Listener]   ✅ 立即执行：达到阈值时无延迟触发');
console.log('[Forum Auto Listener]   ✅ 状态冲突解决：避免"Auto-listener正在处理"问题');
console.log('[Forum Auto Listener]   ✅ 状态显示：实时显示监听器运行状态');
console.log('[Forum Auto Listener] 💡 测试命令: window.forumAutoListener.manualTrigger()');
console.log('[Forum Auto Listener] 📊 状态查看: window.showForumAutoListenerStatus()');
console.log('[Forum Auto Listener] 🔧 状态检查: window.forumAutoListener.isForumManagerCallAllowed()');
console.log('[Forum Auto Listener] 📊 状态面板：界面中将显示"论坛自动监听器"状态卡片');
console.log('[Forum Auto Listener] 🚀 监听器将自动启动，论坛内容会自动生成！状态可在界面中实时查看！');
