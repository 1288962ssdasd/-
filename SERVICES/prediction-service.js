/**
 * @layer Service
 * @file   prediction-service.js
 * @depends PredictionData, QuestData, LLMGateway, Platform
 * @emits  prediction:created, prediction:updated, prediction:branchSelected
 *
 * 职责: 任务推演服务 - 预测任务成功率、风险、分支
 * 禁止: 操作DOM、直接调用SillyTavern API
 * [v1.0] 符合16项铁则架构
 */

;(function () {
  'use strict';

  class PredictionService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._predictionData = new (window.PhoneData?.Prediction || function () {})(this._platform);
      this._questData = new (window.PhoneData?.Quest || function () {})(this._platform);
      this._llmGateway = null;
    }

    /**
     * 初始化服务
     */
    async init() {
      console.log('[PredictionService] 初始化...');

      // 获取LLMGateway
      if (window.LLMGateway) {
        this._llmGateway = new window.LLMGateway(this._platform);
      }

      console.log('[PredictionService] 初始化完成');
    }

    /**
     * 生成任务推演
     * [铁则十二] Service是唯一数据加工厂
     */
    async generatePrediction(charId, questId, context = {}) {
      try {
        // 获取任务信息
        const quest = await this._questData.getById(charId, questId);
        if (!quest) {
          console.warn('[PredictionService] 任务不存在:', questId);
          return null;
        }

        // 构建推演提示词
        const prompt = this._buildPredictionPrompt(quest, context);

        // 调用LLM生成推演
        let prediction = null;
        if (this._llmGateway) {
          const response = await this._llmGateway.complete({
            prompt,
            temperature: 0.7,
            maxTokens: 800
          });
          prediction = this._parsePredictionResponse(response, questId);
        } else {
          // 降级方案：使用默认推演
          prediction = this._generateDefaultPrediction(quest);
        }

        // 保存推演结果
        await this._predictionData.create(charId, questId, prediction);

        // 发射事件
        this._emitEvent('prediction:created', {
          questId,
          prediction
        });

        console.log('[PredictionService] 推演已生成:', questId);
        return prediction;
      } catch (e) {
        console.warn('[PredictionService] 生成推演失败:', e);
        return null;
      }
    }

    /**
     * 获取任务推演
     */
    async getPrediction(charId, questId) {
      try {
        return await this._predictionData.get(charId, questId);
      } catch (e) {
        console.warn('[PredictionService] 获取推演失败:', e);
        return null;
      }
    }

    /**
     * 更新推演结果
     */
    async updatePrediction(charId, questId, updates) {
      try {
        const prediction = await this._predictionData.update(charId, questId, updates);
        if (prediction) {
          this._emitEvent('prediction:updated', {
            questId,
            updates
          });
        }
        return prediction;
      } catch (e) {
        console.warn('[PredictionService] 更新推演失败:', e);
        return null;
      }
    }

    /**
     * 选择分支
     */
    async selectBranch(charId, questId, branchIndex) {
      try {
        const branch = await this._predictionData.selectBranch(charId, questId, branchIndex);
        if (branch) {
          this._emitEvent('prediction:branchSelected', {
            questId,
            branchIndex,
            branch
          });
        }
        return branch;
      } catch (e) {
        console.warn('[PredictionService] 选择分支失败:', e);
        return null;
      }
    }

    /**
     * 标记风险已实现
     */
    async markRiskRealized(charId, questId, riskIndex) {
      try {
        return await this._predictionData.markRiskRealized(charId, questId, riskIndex);
      } catch (e) {
        console.warn('[PredictionService] 标记风险失败:', e);
        return null;
      }
    }

    /**
     * 记录实际结果
     */
    async recordActualResult(charId, questId, actualResult) {
      try {
        return await this._predictionData.updateActualResult(charId, questId, actualResult);
      } catch (e) {
        console.warn('[PredictionService] 记录结果失败:', e);
        return null;
      }
    }

    /**
     * 获取推演摘要
     */
    async getSummary(charId, questId) {
      try {
        return await this._predictionData.generateSummary(charId, questId);
      } catch (e) {
        console.warn('[PredictionService] 生成摘要失败:', e);
        return '暂无推演数据';
      }
    }

    /**
     * 格式化推演为AI上下文
     */
    async formatForAI(charId, questId, options = {}) {
      try {
        return await this._predictionData.formatForAI(charId, questId, options);
      } catch (e) {
        console.warn('[PredictionService] 格式化失败:', e);
        return null;
      }
    }

    /**
     * 删除推演
     */
    async deletePrediction(charId, questId) {
      try {
        await this._predictionData.delete(charId, questId);
        return true;
      } catch (e) {
        console.warn('[PredictionService] 删除推演失败:', e);
        return false;
      }
    }

    /**
     * 清理旧推演
     */
    async clearOldPredictions(charId, olderThan) {
      try {
        return await this._predictionData.clearOld(charId, olderThan);
      } catch (e) {
        console.warn('[PredictionService] 清理推演失败:', e);
        return 0;
      }
    }

    // ==================== 私有方法 ====================

    /**
     * 构建推演提示词
     */
    _buildPredictionPrompt(quest, context) {
      const steps = quest.steps?.map((s, i) => `${i + 1}. ${s.description || s.type}`).join('\n') || '暂无步骤';

      return `作为任务推演专家，请分析以下任务并预测可能的结果。

任务名称: ${quest.name || '未命名任务'}
任务描述: ${quest.description || '暂无描述'}
任务步骤:
${steps}

当前世界状态:
- 世界氛围: ${context.atmosphere || '正常'}
- 玩家与发布者关系: ${context.relationship || '一般'}

请输出JSON格式:
{
  "successProbability": 0.7,  // 0-1之间的成功率
  "risks": [
    {"description": "风险描述", "severity": "high/medium/low"}
  ],
  "branches": [
    {"name": "分支名称", "probability": 0.5, "consequence": "后果描述"}
  ],
  "npcReactions": {
    "npcId": "NPC可能的反应"
  },
  "timeEstimate": "预计耗时",
  "costEstimate": "预计花费"
}`;
    }

    /**
     * 解析LLM响应
     */
    _parsePredictionResponse(response, questId) {
      try {
        // 尝试提取JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return {
            questId,
            successProbability: data.successProbability || 0.5,
            risks: data.risks || [],
            branches: data.branches || [],
            npcReactions: data.npcReactions || {},
            timeEstimate: data.timeEstimate || null,
            costEstimate: data.costEstimate || null
          };
        }
      } catch (e) {
        console.warn('[PredictionService] 解析响应失败:', e);
      }

      // 返回默认推演
      return {
        questId,
        successProbability: 0.5,
        risks: [{ description: '无法解析推演结果', severity: 'medium' }],
        branches: [],
        npcReactions: {},
        timeEstimate: null,
        costEstimate: null
      };
    }

    /**
     * 生成默认推演
     */
    _generateDefaultPrediction(quest) {
      return {
        questId: quest.id,
        successProbability: 0.6,
        risks: [
          { description: '任务可能比预期困难', severity: 'medium' },
          { description: 'NPC可能改变态度', severity: 'low' }
        ],
        branches: [
          { name: '直接完成', probability: 0.5, consequence: '正常奖励' },
          { name: '寻求帮助', probability: 0.3, consequence: '奖励减少但成功率提高' }
        ],
        npcReactions: {},
        timeEstimate: '30分钟-1小时',
        costEstimate: '少量金币'
      };
    }

    /**
     * 发射事件
     */
    _emitEvent(eventName, data) {
      try {
        const eventBus = this._platform?.eventBus;
        if (eventBus?.emit) {
          eventBus.emit(eventName, {
            id: this._generateId(),
            type: eventName,
            data,
            timestamp: Date.now(),
            source: 'prediction-service'
          });
        }
      } catch (e) {
        console.warn('[PredictionService] 发射事件失败:', e);
      }
    }

    _generateId() {
      return 'pred_svc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // 挂载到全局
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Prediction = PredictionService;

  console.log('[Service] PredictionService 已加载');
})();
