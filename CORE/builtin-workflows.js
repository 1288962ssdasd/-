/**
 * builtin-workflows.js - 内置工作流注册
 * 铁则十八: index.js 不得内联实现模块功能
 *
 * 从 index.js 提取（Task 7.3）
 */
(function () {
  'use strict';

  /**
   * 注册内置工作流到 WorkflowEngine
   * @param {WorkflowEngine} engine - 工作流引擎实例
   */
  function register(engine) {
    if (!engine) return;

    engine.register({
      id: 'wf.pending_msg',
      name: '消息到达处理',
      trigger: { type: 'variable_changed', pattern: 'xb.phone.pendingMsg' },
      actions: [
        {
          type: 'module_call',
          target: 'message',
          method: 'handlePendingMessage',
          args: [],
        },
      ],
      options: { dedup: true, dedupWindow: 3000 },
    });

    engine.register({
      id: 'wf.pending_friend',
      name: '好友请求处理',
      trigger: { type: 'variable_changed', pattern: 'xb.phone.pendingFriend' },
      actions: [
        {
          type: 'module_call',
          target: 'message',
          method: 'handlePendingFriend',
          args: [],
        },
      ],
      options: { dedup: true, dedupWindow: 3000 },
    });

    engine.register({
      id: 'wf.director',
      name: 'AI导演决策处理',
      priority: 100,
      trigger: { type: 'variable_changed', pattern: 'xb.director.plan' },
      actions: [
        {
          type: 'module_call',
          target: 'director',
          method: 'handleDirectorPlan',
          args: [],
        },
      ],
      options: { dedup: true, dedupWindow: 1000 },
    });

    engine.register({
      id: 'wf.quest_notify',
      name: '任务通知处理',
      trigger: { type: 'variable_changed', pattern: 'xb.quest.pendingNotify' },
      actions: [
        {
          type: 'module_call',
          target: 'quest',
          method: 'handleDirectorNotify',
          args: [],
        },
      ],
      options: { dedup: true, dedupWindow: 3000 },
    });

    // ========== Task 5.2 新增工作流 ==========

    /**
     * 任务完成奖励流程
     * 触发：任务完成事件
     * 流程：发放奖励 → 发送通知消息
     */
    engine.register({
      id: 'wf.quest_reward',
      name: '任务奖励流程',
      priority: 80,
      trigger: { type: 'event', pattern: 'quest:completed' },
      actions: [
        {
          type: 'service_call',
          target: 'questService',
          method: 'grantReward',
          args: ['${payload.questId}'],
        },
        {
          type: 'service_call',
          target: 'messageService',
          method: 'sendSystemNotification',
          args: ['${payload.rewardMessage}'],
        },
      ],
      options: { dedup: true, dedupWindow: 5000 },
    });

    /**
     * NPC 行动流程
     * 触发：导演决策事件
     * 流程：意图生成 → 内容生成 → 事件派发
     */
    engine.register({
      id: 'wf.npc_action',
      name: 'NPC行动流程',
      priority: 90,
      trigger: { type: 'event', pattern: 'director:npcAction' },
      actions: [
        {
          type: 'service_call',
          target: 'npcGeneratorService',
          method: 'generateIntent',
          args: ['${payload.npcId}', '${payload.context}'],
        },
        {
          type: 'service_call',
          target: 'npcGeneratorService',
          method: 'generateContent',
          args: ['${payload.npcId}', '${result.intent}'],
        },
        {
          type: 'emit',
          event: 'npc:actionDispatched',
          args: ['${payload.npcId}', '${result.content}'],
        },
      ],
      options: { dedup: true, dedupWindow: 2000 },
    });

    /**
     * 世界事件流程
     * 触发：世界事件触发
     * 流程：内容生成 → 多模块通知
     */
    engine.register({
      id: 'wf.world_event',
      name: '世界事件流程',
      priority: 70,
      trigger: { type: 'event', pattern: 'world:eventTriggered' },
      actions: [
        {
          type: 'service_call',
          target: 'worldService',
          method: 'generateEventContent',
          args: ['${payload.eventId}', '${payload.context}'],
        },
        {
          type: 'emit',
          event: 'world:eventContentReady',
          args: ['${payload.eventId}', '${result.content}'],
        },
        {
          type: 'module_call',
          target: 'status',
          method: 'handleWorldEvent',
          args: ['${payload.eventId}'],
        },
        {
          type: 'module_call',
          target: 'diary',
          method: 'handleWorldEvent',
          args: ['${payload.eventId}'],
        },
      ],
      options: { dedup: true, dedupWindow: 3000 },
    });

    console.info('[Phone Init] 内置工作流已注册（含 Task 5.2 新增 3 个）');

    // ========== V2 导演任务触发工作流 ==========
    // 订阅 director:quest_trigger 事件，调用 QuestService 创建任务
    // 使用 engine_event 触发器监听 EventBus 上的 director:quest_trigger 事件
    // 使用 function_call 动作通过回调调用 questService（引擎不支持 service_call 类型）
    // [v4.31.0-fix] 修复事件数据路径：eventBus.emit 格式为 { id, type, data: { actionType, charId, quest } }
    engine.register({
      id: 'wf.director_quest_trigger',
      name: 'V2导演任务触发',
      priority: 85,
      trigger: { type: 'engine_event', pattern: 'director:quest_trigger' },
      actions: [
        {
          type: 'function_call',
          handler: function (context) {
            // [v4.31.0-fix] WorkflowEngine 包装了一层：
            // context.event = { type, data: eventData, source, timestamp }
            // eventData = EventBus.emit 传递的完整对象 { id, type, data: { actionType, charId, quest }, timestamp, source }
            // 所以 payload 在 context.event.data.data 中
            var wrapperEvent = context.event || {};
            var eventBusEvent = wrapperEvent.data || {};  // 这是 EventBus 传递的完整事件
            var payload = eventBusEvent.data || {};  // 这才是 { actionType, charId, quest }
            var charId = payload.charId;
            var questData = payload.quest;
            if (!charId || !questData) {
              console.warn('[wf.director_quest_trigger] 缺少 charId 或 questData:', {
                charId: charId,
                questData: questData,
                wrapperEvent: wrapperEvent,
                eventBusEvent: eventBusEvent
              });
              return Promise.resolve();
            }
            // 通过全局服务获取 questService 并调用 createQuest
            var QuestClass = window.PhoneServices && window.PhoneServices.Quest;
            if (!QuestClass) {
              console.warn('[wf.director_quest_trigger] QuestService 不可用，跳过');
              return Promise.resolve();
            }
            // [v4.31.0-fix] createQuest 是实例方法（在原型上），不是静态方法
            // 先实例化再检查方法
            var instance = new QuestClass(window.Platform);
            if (typeof instance.createQuest !== 'function') {
              console.warn('[wf.director_quest_trigger] QuestService.createQuest 方法不存在，跳过');
              return Promise.resolve();
            }
            console.log('[wf.director_quest_trigger] 调用 createQuest:', charId, questData.name || questData.id);
            return instance.createQuest(charId, questData).catch(function (e) {
              console.warn('[wf.director_quest_trigger] createQuest 调用失败:', e);
            });
          }
        }
      ],
      options: { dedup: true, dedupWindow: 5000 },
    });
  }

  window.PhoneBuiltinWorkflows = {
    register: register,
  };

})();
