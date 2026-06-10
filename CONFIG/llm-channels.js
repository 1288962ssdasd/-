/**
 * @layer CONFIG
 * @file   llm-channels.js
 * @description LLM 通道配置 - 四通道分层管理
 *
 * 通道A（大世界生成）：低频、高耗时、高质量
 * 通道B（管家规划）：高频、实时、推理密集
 * 通道C（内容生成）：高并发、快速响应
 * 通道D（备用降级）：故障转移
 *
 * 铁则合规：
 * - 铁则六：通道配置在入口处加载，业务代码无感知
 * - 铁则九：通道故障自动降级
 */

;(function () {
  'use strict';

  var DEFAULT_CHANNELS = {
    'channel-world': {
      name: '大世界生成通道',
      description: '世界构建和推演，高质量生成（DeepSeek V4 / GPT-4）',
      model: '',
      endpoint: '',
      apiKey: '',
      maxConcurrent: 1,
      timeout: 120000,
      queueStrategy: 'fifo',
      fallback: 'channel-fallback'
    },
    'channel-director': {
      name: '管家规划通道',
      description: '任务规划和偏差分析，高质量推理（DeepSeek V4 / GPT-4）',
      model: '',
      endpoint: '',
      apiKey: '',
      maxConcurrent: 2,
      timeout: 30000,
      queueStrategy: 'priority',
      fallback: 'channel-fallback'
    },
    'channel-content': {
      name: '内容生成通道',
      description: '消息、NPC、场景等内容生成，快速响应（GPT-3.5 / DeepSeek V3）',
      model: '',
      endpoint: '',
      apiKey: '',
      maxConcurrent: 5,
      timeout: 15000,
      queueStrategy: 'fifo',
      fallback: 'channel-fallback'
    },
    'channel-fallback': {
      name: '备用通道',
      description: '故障转移和降级',
      model: '',
      endpoint: '',
      apiKey: '',
      maxConcurrent: 3,
      timeout: 60000,
      queueStrategy: 'fifo',
      fallback: null
    }
  };

  // 通道预设模板
  var CHANNEL_PRESETS = {
    'default': {
      label: '默认配置',
      description: '所有通道使用同一模型',
      config: {
        'channel-world': { model: '', endpoint: '' },
        'channel-director': { model: '', endpoint: '' },
        'channel-content': { model: '', endpoint: '' },
        'channel-fallback': { model: '', endpoint: '' }
      }
    },
    'high-performance': {
      label: '高性能配置',
      description: '大世界和管家使用大模型，内容使用小模型',
      config: {
        'channel-world': { model: 'deepseek-v4' },
        'channel-director': { model: 'deepseek-v4' },
        'channel-content': { model: 'gpt-3.5-turbo' },
        'channel-fallback': { model: 'gpt-3.5-turbo' }
      }
    },
    'cost-saving': {
      label: '低成本配置',
      description: '所有通道使用小模型',
      config: {
        'channel-world': { model: 'gpt-3.5-turbo' },
        'channel-director': { model: 'gpt-3.5-turbo' },
        'channel-content': { model: 'gpt-3.5-turbo' },
        'channel-fallback': { model: 'gpt-3.5-turbo' }
      }
    }
  };

  window.LLMChannelConfig = {
    DEFAULT_CHANNELS: DEFAULT_CHANNELS,
    CHANNEL_PRESETS: CHANNEL_PRESETS,
    getDefaults: function () {
      return JSON.parse(JSON.stringify(DEFAULT_CHANNELS));
    },
    getPreset: function (presetName) {
      return CHANNEL_PRESETS[presetName] || null;
    }
  };
})();
