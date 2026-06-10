/**
 * WorldSyncService - 大世界背景下的周期性同步（约每5条ST消息）
 * 依赖用户已手动生成大世界
 */

;(function () {
  'use strict';

  class WorldSyncService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._floorInterval = 5;
      this._messageCount = 0;
      this._lastSyncFloor = 0;
      this._busy = false;
    }

    init() {
      const bus = this._platform?.eventBus;
      if (!bus) return;

      bus.on('generation:ended', () => this._onStActivity());
      console.log('[WorldSyncService] 已监听 ST 活动（每' + this._floorInterval + '楼同步）');
    }

    async _onStActivity() {
      try {
        const adapter = this._platform?.get?.('adapter');
        let chatLen = 0;
        if (adapter?.getChatContext) {
          const ctx = adapter.getChatContext();
          if (ctx?.chat?.length) chatLen = ctx.chat.length;
        }

        const floor = Math.floor(chatLen / this._floorInterval);
        if (floor <= this._lastSyncFloor) return;

        const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
        const worldSvc = this._platform?.get?.('worldService');
        if (!worldSvc?.isWorldGenerated) return;

        const ok = await worldSvc.isWorldGenerated(charId);
        if (!ok) return;

        this._lastSyncFloor = floor;
        await this.syncWorldFeed(charId, floor);
      } catch (e) {
        console.warn('[WorldSyncService] 楼层同步失败:', e);
      }
    }

    /**
     * 基于大世界 + ST 上下文更新资讯/热搜/商店
     */
    async syncWorldFeed(charId, floor) {
      if (this._busy) return;
      this._busy = true;

      try {
        const worldSvc = this._platform?.get?.('worldService');
        const world = worldSvc ? await worldSvc.getWorld(charId) : null;
        const assembler = window.ContextAssembler ? new window.ContextAssembler(this._platform) : null;
        const stCtx = assembler ? await assembler.assemble({ charId, forceRefresh: true }) : '';

        const llm = window.LLMGateway ? new window.LLMGateway(this._platform) : null;
        if (!llm) return;

        // [修复] 组装完整的世界背景信息，而不只是description
        // [修复 v4.3] factions 是对象数组，需要正确序列化
        const formatFactions = (factions) => {
          if (!Array.isArray(factions) || factions.length === 0) return '无';
          return factions.map(f => {
            if (typeof f === 'string') return f;
            if (typeof f === 'object' && f !== null) {
              return f.name || f.title || JSON.stringify(f);
            }
            return String(f);
          }).join('、');
        };
        
        const worldTruth = world ? `
世界名称：${world.name || '未知'}
时代背景：${world.era || '未知'}
主题风格：${world.theme || '未知'}
世界描述：${world.description || ''}
氛围基调：${world.atmosphere?.mood || ''}
当前层级：Stage ${world.currentStage || 1}
已揭示真相：${(world.revealedTruth || []).join('；')}
关键地点：${(world.keyLocations || []).join('、')}
主要势力：${formatFactions(world.factions)}
世界规则：${(world.rules || []).join('；')}
        `.trim() : '';

        const sim = await llm.generate('world-simulator', {
          worldName: world?.name || '未知',
          currentStage: String(floor),
          deviationScore: String(world?.deviationScore || 0),
          worldTruth: worldTruth,
          recentEvents: `楼层 ${floor}，最近剧情：${stCtx.substring(0, 400)}`,
          recentPlayerActions: stCtx.substring(0, 800),
        });

        const parsed = window.JsonRepair
          ? window.JsonRepair.parse(sim, { world_news: [], npc_changes: [] })
          : sim;

        const weibo = this._platform?.get?.('weiboService');
        const forum = this._platform?.get?.('forumService');
        const shop = this._platform?.get?.('shopService');

        if (parsed?.world_news?.length && weibo) {
          for (const news of parsed.world_news.slice(0, 3)) {
            await weibo.addPost({
              author: news.title || '世界新闻',
              content: news.content || news.title,
              type: 'news',
            });
          }
          if (weibo.updateHotSearches) {
            await weibo.updateHotSearches(
              parsed.world_news.map((n, i) => ({
                title: n.title || n.content?.substring(0, 20),
                heat: 800 - i * 120,
                tag: i < 2 ? '沸' : '热',
              }))
            );
          }
        }

        if (parsed?.world_news?.length && forum?.publishPost) {
          const top = parsed.world_news[0];
          await forum.publishPost(top.title || '头条', top.content || '', { style: 'news' });
        }

        if (shop?.refreshCatalogFromWorld) {
          await shop.refreshCatalogFromWorld(world);
        } else if (shop?.generateEventNotice) {
          await shop.generateEventNotice();
        }

        if (this._platform?.eventBus) {
          // [铁则十一修复] 添加缺失的 id 字段
          this._platform.eventBus.emit('world:feedSynced', {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            type: 'world:feedSynced',
            data: { charId, floor, newsCount: parsed?.world_news?.length || 0 },
            timestamp: Date.now(),
            source: 'world-sync-service',
          });
        }

        console.log('[WorldSyncService] ✅ 第', floor * this._floorInterval, '楼附近已同步世界资讯');
      } catch (e) {
        console.warn('[WorldSyncService] syncWorldFeed 失败:', e);
      } finally {
        this._busy = false;
      }
    }
  }

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.WorldSync = WorldSyncService;
  console.log('[Service] WorldSyncService 已加载');
})();
