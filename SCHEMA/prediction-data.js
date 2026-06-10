/**
 * PredictionData - 任务推演数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:prediction:{key}
 *
 * 用于存储任务推演结果：成功率、风险、分支、NPC反应
 */

;(function () {
  'use strict';

  const DOMAIN = 'prediction';

  class PredictionData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    // ==================== 基础CRUD ====================

    async get(charId, questId) {
      return await this._platform.data(DOMAIN, charId + ':' + questId, null);
    }

    async save(charId, questId, prediction) {
      await this._platform.setData(DOMAIN, charId + ':' + questId, prediction);
      return prediction;
    }

    async delete(charId, questId) {
      await this._platform.setData(DOMAIN, charId + ':' + questId, null);
    }

    // ==================== 创建推演结果 ====================

    async create(charId, questId, {
      successProbability = 0.5,
      risks = [],
      branches = [],
      npcReactions = {},
      timeEstimate = null,
      costEstimate = null,
      metadata = {}
    }) {
      const prediction = {
        questId,
        successProbability: Math.max(0, Math.min(1, successProbability)),
        risks: risks.map(r => typeof r === 'string' ? { description: r, severity: 'medium' } : r),
        branches: branches.map(b => ({
          name: b.name || '未命名分支',
          probability: b.probability || 0.5,
          consequence: b.consequence || '',
          steps: b.steps || []
        })),
        npcReactions,
        timeEstimate,
        costEstimate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata
      };

      await this.save(charId, questId, prediction);
      return prediction;
    }

    // ==================== 查询操作 ====================

    async getAllForChar(charId) {
      // 注意：这里需要遍历所有可能的questId，实际使用时建议按需获取
      const allData = await this._platform.data(DOMAIN, charId + ':index', {});
      return allData;
    }

    async exists(charId, questId) {
      const pred = await this.get(charId, questId);
      return !!pred;
    }

    // ==================== 更新操作 ====================

    async update(charId, questId, updates) {
      const prediction = await this.get(charId, questId);
      if (!prediction) return null;

      Object.assign(prediction, updates, { updatedAt: Date.now() });
      await this.save(charId, questId, prediction);
      return prediction;
    }

    async updateActualResult(charId, questId, actualResult) {
      return await this.update(charId, questId, {
        actualResult,
        isAccurate: this._comparePrediction(actualResult)
      });
    }

    // ==================== 分支选择 ====================

    async selectBranch(charId, questId, branchIndex) {
      const prediction = await this.get(charId, questId);
      if (!prediction || !prediction.branches[branchIndex]) return null;

      prediction.selectedBranch = branchIndex;
      prediction.branches[branchIndex].selectedAt = Date.now();
      await this.save(charId, questId, prediction);
      return prediction.branches[branchIndex];
    }

    // ==================== 风险标记 ====================

    async markRiskRealized(charId, questId, riskIndex) {
      const prediction = await this.get(charId, questId);
      if (!prediction || !prediction.risks[riskIndex]) return null;

      prediction.risks[riskIndex].realized = true;
      prediction.risks[riskIndex].realizedAt = Date.now();
      await this.save(charId, questId, prediction);
      return prediction.risks[riskIndex];
    }

    // ==================== 清理 ====================

    async clearAll(charId) {
      // 获取所有key并删除
      const allKeys = await this._platform.data(DOMAIN, charId + ':keys', []);
      for (const key of allKeys) {
        await this._platform.setData(DOMAIN, charId + ':' + key, null);
      }
      await this._platform.setData(DOMAIN, charId + ':keys', []);
      await this._platform.setData(DOMAIN, charId + ':index', {});
    }

    async clearOld(charId, olderThan) {
      const allData = await this.getAllForChar(charId);
      let cleared = 0;
      for (const [questId, prediction] of Object.entries(allData)) {
        if (prediction.createdAt < olderThan) {
          await this.delete(charId, questId);
          cleared++;
        }
      }
      return cleared;
    }

    // ==================== 工具方法 ====================

    _comparePrediction(actualResult) {
      // 简单比较逻辑，实际使用时可以根据需要扩展
      return actualResult.completed === true;
    }

    // 格式化推演结果为AI上下文
    async formatForAI(charId, questId, options = {}) {
      const {
        includeBranches = true,
        includeRisks = true,
        includeNPCReactions = true
      } = options;

      const prediction = await this.get(charId, questId);
      if (!prediction) return null;

      const lines = [];
      lines.push(`任务推演结果:`);
      lines.push(`- 成功概率: ${(prediction.successProbability * 100).toFixed(0)}%`);

      if (includeRisks && prediction.risks.length > 0) {
        lines.push(`- 潜在风险:`);
        prediction.risks.forEach((risk, i) => {
          const status = risk.realized ? '[已发生]' : '[未发生]';
          lines.push(`  ${i + 1}. ${risk.description} ${status}`);
        });
      }

      if (includeBranches && prediction.branches.length > 0) {
        lines.push(`- 可能分支:`);
        prediction.branches.forEach((branch, i) => {
          const selected = i === prediction.selectedBranch ? '[已选择]' : '';
          lines.push(`  ${i + 1}. ${branch.name} (概率: ${(branch.probability * 100).toFixed(0)}%) ${selected}`);
          if (branch.consequence) {
            lines.push(`     后果: ${branch.consequence}`);
          }
        });
      }

      if (includeNPCReactions && Object.keys(prediction.npcReactions).length > 0) {
        lines.push(`- NPC可能反应:`);
        for (const [npcId, reaction] of Object.entries(prediction.npcReactions)) {
          lines.push(`  - ${npcId}: ${reaction}`);
        }
      }

      return lines.join('\n');
    }

    // 生成简要的推演摘要
    async generateSummary(charId, questId) {
      const prediction = await this.get(charId, questId);
      if (!prediction) return '暂无推演数据';

      const riskCount = prediction.risks.length;
      const realizedRisks = prediction.risks.filter(r => r.realized).length;
      const branchCount = prediction.branches.length;

      return `成功率 ${(prediction.successProbability * 100).toFixed(0)}%，` +
             `${riskCount} 个风险(${realizedRisks} 个已发生)，` +
             `${branchCount} 个可能分支`;
    }
  }

  // 挂载到全局
  window.PhoneData = window.PhoneData || {};
  window.PhoneData.Prediction = PredictionData;

  console.log('[Schema] PredictionData 已加载');
})();
