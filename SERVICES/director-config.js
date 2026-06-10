/**
 * @layer Service
 * @file   director-config.js
 * @description 导演系统可调参数配置 - F-09 配置外部化
 *
 * 铁则合规：
 * - 铁则六：配置在入口处加载，业务代码无感知
 * - 纯数据文件，无业务逻辑
 */

;(function () {
  'use strict';

  window.DirectorConfig = {
    // 决策概率
    decision: {
      dailyEventProbability: 0.8,     // 日常事件生成概率 (L530)
      questAttachProbability: 0.4,     // 附带任务生成概率 (L539)
      questStandaloneProbability: 0.3, // 独立任务生成概率 (L1146)
      newsGenerationProbability: 0.2, // 新闻生成概率 (L1273)
    },

    // NPC 行为推导
    npcBehavior: {
      highRelationshipThreshold: 70,  // 高关系值阈值 (L1236)
      questPriorityHighThreshold: 0.5, // 任务高优先级概率 (L1150)
      maxActiveNPCs: 5,               // 最大活跃NPC数 (L1220)
      maxQuestNPCs: 2,                // 最大任务NPC数 (L1185)
    },

    // 冷却与超时
    timing: {
      defaultCooldown: 15000,         // 默认冷却时间 (ms) (L349)
      contextHashMessageCount: 3,     // 上下文哈希消息数 (L1100)
    },

    // 偏差分析
    deviation: {
      triggerThreshold: 10,          // 触发偏差分析的阈值 (L546)
      revealLayerThreshold: 10,       // 揭示洋葱层级的阈值 (L289)
      highDeviationThreshold: 15,     // 高偏差阈值 (L290)
      maxStage: 5,                    // 最大世界阶段 (L990)
    },
  };

  console.log('[Service] DirectorConfig 已加载');
})();
