/**
 * @layer Service
 * @file   director-constants.js
 * @description 导演系统常量定义 - F-08 配置外部化
 *
 * 铁则合规：
 * - 铁则六：常量在入口处加载
 * - 纯数据文件，无业务逻辑
 */

;(function () {
  'use strict';

  window.DirectorConstants = Object.freeze({
    // 事件类型
    EVENTS: {
      DECIDED: 'director:decided',
      INTENT_GENERATED: 'director:intentGenerated',
      CONTENT_READY: 'director:contentReady',
      SHOW_NOTIFICATION: 'director:showNotification',
      QUEST_TRIGGER: 'director:quest_trigger',
      INVITATION_TRIGGER: 'director:invitation_trigger',
      // V1 兼容事件
      MESSAGE: 'director:message',
      MOMENT: 'director:moment',
      WEIBO: 'director:weibo',
      NEWS: 'director:news',
      QUEST: 'director:quest',
      INVITATION: 'director:invitation',
    },

    // 内容类型
    CONTENT_TYPES: {
      MESSAGE: 'message',
      MOMENT: 'moment',
      QUEST: 'quest',
      NEWS: 'news',
      INVITATION: 'invitation',
      STAGE_REVEAL: 'stage_reveal',
      DEVIATION: 'deviation',
    },

    // 决策优先级
    PRIORITIES: {
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
    },

    // NPC 行为类型
    BEHAVIOR_TYPES: {
      MESSAGE: 'message',
      MOMENT: 'moment',
      INVITATION: 'invitation',
    },

    // 任务类型
    QUEST_TYPES: ['side', 'daily', 'event'],

    // 最大意图数量
    MAX_INTENTS: 5,

    // 最大历史记录数
    MAX_HISTORY: 50,
  });

  console.log('[Service] DirectorConstants 已加载');
})();
