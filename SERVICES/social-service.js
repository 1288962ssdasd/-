/**
 * SocialService - NPC 社交互动服务
 * 职责：处理NPC互动概率计算、冷却管理、调用 SocialExpert 生成互动内容
 *
 * 启动阶段：阶段 4（Service 初始化）
 * 全局挂载：window.PhoneServices.Social
 *
 * 铁则合规：
 *   - 数据读写通过 Schema（铁则一）
 *   - 调用 AI / LLM（铁则三）
 *   - 发射业务事件（铁则三）
 *   - 错误处理降级不阻断（铁则九）
 */

;(function () {
  'use strict';

  class SocialService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._friendsData = new (window.PhoneData?.Friends || function(){})(this._platform);
      this._npcData = new (window.PhoneData?.NPC || function(){})(this._platform);
      this._interactionHistory = new Map(); // NPC ID -> 最近互动时间数组
      this._cooldownMs = 60 * 60 * 1000; // 1小时冷却
      this._maxInteractionsPerCooldown = 2; // 冷却期内最大互动次数
    }

    // ==================== Phase 6: 核心互动方法 ====================

    /**
     * 检查并触发NPC互动
     * @param {string} charId - 角色ID
     * @param {string} contentType - 内容类型 (weibo/moment/forum)
     * @param {string} contentId - 内容ID
     * @returns {Promise<Array>} 触发的互动列表
     */
    async checkNPCInteraction(charId, contentType, contentId) {
      try {
        // 获取NPC好友列表
        const friends = await this._friendsData.getList();
        const npcFriends = friends.filter(f => f.isNPC || (f.id && String(f.id).startsWith('npc')));
        
        if (npcFriends.length === 0) {
          return [];
        }

        // 获取NPC详细信息
        const npcDetails = await this._getNPCDetails(npcFriends);
        
        // 筛选可能互动的NPC
        const eligibleNPCs = [];
        for (const npc of npcDetails) {
          if (await this._shouldNPCInteract(npc)) {
            eligibleNPCs.push(npc);
          }
        }

        if (eligibleNPCs.length === 0) {
          return [];
        }

        // 调用 SocialExpert 生成互动内容
        const interactions = await this._generateInteractions(eligibleNPCs, contentType, contentId);
        
        // 更新互动历史
        for (const interaction of interactions) {
          this._recordInteraction(interaction.npcId);
        }

        // 发射事件
        if (interactions.length > 0 && this._platform?.eventBus) {
          this._platform.eventBus.emit('social:npcInteractions', {
            id: 'evt_' + Date.now(),
            type: 'social:npcInteractions',
            data: { 
              contentType, 
              contentId, 
              interactions,
              count: interactions.length 
            },
            timestamp: Date.now(),
            source: 'social-service',
          });
        }

        return interactions;
      } catch (e) {
        console.warn('[SocialService] checkNPCInteraction 失败:', e);
        return [];
      }
    }

    /**
     * 获取NPC详细信息
     * @private
     */
    async _getNPCDetails(npcFriends) {
      const details = [];
      
      for (const friend of npcFriends) {
        try {
          // 从NPC数据获取更多信息
          const npcInfo = await this._npcData.getById(friend.id);
          
          // 计算关系等级
          const relationship = this._calculateRelationship(friend);
          
          details.push({
            id: friend.id,
            name: friend.name || npcInfo?.name || friend.id,
            personality: npcInfo?.personality || friend.personality || '普通',
            relationship: relationship,
            relationshipLevel: this._getRelationshipLevel(relationship),
            emoji: npcInfo?.emoji || friend.avatar || '👤',
          });
        } catch (e) {
          // 降级处理：使用基本信息
          details.push({
            id: friend.id,
            name: friend.name || friend.id,
            personality: '普通',
            relationship: 'stranger',
            relationshipLevel: 0,
            emoji: friend.avatar || '👤',
          });
        }
      }
      
      return details;
    }

    /**
     * 计算关系等级
     * @private
     */
    _calculateRelationship(friend) {
      // 基于互动频率、好友时长等计算
      const interactionCount = friend.interactionCount || 0;
      const daysSinceAdded = friend.addedAt 
        ? (Date.now() - friend.addedAt) / (1000 * 60 * 60 * 24)
        : 0;
      
      if (interactionCount > 50 || daysSinceAdded > 30) return 'intimate';
      if (interactionCount > 20 || daysSinceAdded > 14) return 'friend';
      if (interactionCount > 5 || daysSinceAdded > 3) return 'acquaintance';
      return 'stranger';
    }

    /**
     * 获取关系等级数值
     * @private
     */
    _getRelationshipLevel(relationship) {
      const levels = {
        'stranger': 0,
        'acquaintance': 1,
        'friend': 2,
        'intimate': 3,
      };
      return levels[relationship] || 0;
    }

    /**
     * 判断NPC是否应该互动
     * @private
     */
    async _shouldNPCInteract(npc) {
      // 1. 基础概率
      const baseProbabilities = {
        'stranger': 0.05,      // 陌生人 5%
        'acquaintance': 0.20,  // 熟人 20%
        'friend': 0.50,        // 好友 50%
        'intimate': 0.80,      // 亲密 80%
      };
      
      let probability = baseProbabilities[npc.relationship] || 0.05;
      
      // 2. 内容相关性加权 (+30%)
      // 这里可以根据内容类型和NPC兴趣进行加权
      probability += 0.30;
      
      // 3. 时间因素加权 (+15%)
      const hour = new Date().getHours();
      if (hour >= 18 && hour <= 22) {
        probability += 0.15; // 晚间活跃时间
      }
      
      // 4. 冷却检查
      if (!this._checkCooldown(npc.id)) {
        return false;
      }
      
      // 5. 概率判定
      return Math.random() < Math.min(probability, 0.95);
    }

    /**
     * 检查冷却状态
     * @private
     */
    _checkCooldown(npcId) {
      const history = this._interactionHistory.get(npcId) || [];
      const now = Date.now();
      
      // 清理过期记录
      const validHistory = history.filter(time => (now - time) < this._cooldownMs);
      this._interactionHistory.set(npcId, validHistory);
      
      // 检查是否超过最大互动次数
      return validHistory.length < this._maxInteractionsPerCooldown;
    }

    /**
     * 记录互动
     * @private
     */
    _recordInteraction(npcId) {
      const history = this._interactionHistory.get(npcId) || [];
      history.push(Date.now());
      this._interactionHistory.set(npcId, history);
    }

    /**
     * 生成互动内容
     * @private
     */
    async _generateInteractions(npcList, contentType, contentId) {
      try {
        if (!window.SocialExpert) {
          console.warn('[SocialService] SocialExpert 不可用');
          return this._generateFallbackInteractions(npcList, contentType);
        }

        const expert = new window.SocialExpert(this._platform);
        
        // 构建上下文
        const context = {
          interactionType: contentType === 'weibo' ? 'weibo' : 'moment',
          triggerEvent: contentId,
          interactionCount: npcList.length,
        };

        const result = await expert.generateBatch(npcList, context);
        
        if (!result || result.length === 0) {
          return this._generateFallbackInteractions(npcList, contentType);
        }

        return result.map((interaction, index) => ({
          npcId: interaction.npcId || npcList[index]?.id,
          npcName: interaction.author || npcList[index]?.name,
          type: interaction.type || 'comment',
          content: interaction.content,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('[SocialService] 生成互动失败:', e);
        return this._generateFallbackInteractions(npcList, contentType);
      }
    }

    /**
     * 生成降级互动内容
     * @private
     */
    _generateFallbackInteractions(npcList, contentType) {
      const templates = {
        'weibo': ['👍', ' interesting!', '关注了', '转发支持'],
        'moment': ['👍', '不错哦', '赞', '学习了'],
        'forum': ['有道理', '支持', '👍', '收藏了'],
      };
      
      const typeTemplates = templates[contentType] || templates['moment'];
      
      return npcList.slice(0, 3).map(npc => ({
        npcId: npc.id,
        npcName: npc.name,
        type: 'like',
        content: typeTemplates[Math.floor(Math.random() * typeTemplates.length)],
        timestamp: Date.now(),
      }));
    }

    // ==================== 互动执行方法 ====================

    /**
     * 执行NPC点赞
     * @param {string} npcId - NPC ID
     * @param {string} contentType - 内容类型
     * @param {string} contentId - 内容ID
     */
    async executeLike(npcId, contentType, contentId) {
      try {
        switch (contentType) {
          case 'weibo':
            const weiboData = new (window.PhoneData?.Weibo || function(){})(this._platform);
            await weiboData.toggleLike(contentId, npcId);
            break;
          case 'moment':
            const circleData = new (window.PhoneData?.FriendsCircle || function(){})(this._platform);
            await circleData.toggleLike(contentId, npcId);
            break;
        }
        
        this._recordInteraction(npcId);
        
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('social:npcLiked', {
            id: 'evt_' + Date.now(),
            type: 'social:npcLiked',
            data: { npcId, contentType, contentId },
            timestamp: Date.now(),
            source: 'social-service',
          });
        }
        
        return true;
      } catch (e) {
        console.warn('[SocialService] executeLike 失败:', e);
        return false;
      }
    }

    /**
     * 执行NPC评论
     * @param {string} npcId - NPC ID
     * @param {string} contentType - 内容类型
     * @param {string} contentId - 内容ID
     * @param {string} comment - 评论内容
     */
    async executeComment(npcId, contentType, contentId, comment) {
      try {
        const npc = await this._friendsData.getById(npcId);
        
        switch (contentType) {
          case 'weibo':
            const weiboData = new (window.PhoneData?.Weibo || function(){})(this._platform);
            await weiboData.addComment(contentId, {
              author: npc?.name || 'NPC',
              authorId: npcId,
              content: comment,
            });
            break;
          case 'moment':
            const circleData = new (window.PhoneData?.FriendsCircle || function(){})(this._platform);
            await circleData.addComment(contentId, {
              author: npc?.name || 'NPC',
              authorId: npcId,
              content: comment,
            });
            break;
        }
        
        this._recordInteraction(npcId);
        
        if (this._platform?.eventBus) {
          this._platform.eventBus.emit('social:npcCommented', {
            id: 'evt_' + Date.now(),
            type: 'social:npcCommented',
            data: { npcId, contentType, contentId, comment },
            timestamp: Date.now(),
            source: 'social-service',
          });
        }
        
        return true;
      } catch (e) {
        console.warn('[SocialService] executeComment 失败:', e);
        return false;
      }
    }

    // ==================== 统计与查询 ====================

    /**
     * 获取NPC互动统计
     * @param {string} npcId - NPC ID
     */
    async getNPCInteractionStats(npcId) {
      try {
        const history = this._interactionHistory.get(npcId) || [];
        const now = Date.now();
        
        // 24小时内互动次数
        const last24h = history.filter(t => (now - t) < 24 * 60 * 60 * 1000).length;
        
        // 7天内互动次数
        const last7d = history.filter(t => (now - t) < 7 * 24 * 60 * 60 * 1000).length;
        
        // 是否在冷却中
        const onCooldown = !this._checkCooldown(npcId);
        
        return {
          total: history.length,
          last24h,
          last7d,
          onCooldown,
          nextAvailable: onCooldown 
            ? history[history.length - 1] + this._cooldownMs 
            : now,
        };
      } catch (e) {
        console.warn('[SocialService] getNPCInteractionStats 失败:', e);
        return { total: 0, last24h: 0, last7d: 0, onCooldown: false, nextAvailable: Date.now() };
      }
    }

    /**
     * 重置互动历史（用于测试）
     */
    resetInteractionHistory() {
      this._interactionHistory.clear();
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.Social = SocialService;

  console.log('[Service] SocialService 已加载 (Phase 6)');
})();
