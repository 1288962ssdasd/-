/**
 * WorldService - 大世界生成与管理服务
 *
 * [铁则合规]
 * - 铁则一：数据读写通过 Schema (WorldData, MapData, NPCData)
 * - 铁则三：Service层不操作DOM
 * - 铁则六：环境检测通过适配器
 * - 铁则八：不缓存数据副本
 * - 铁则九：错误降级
 * - 铁则十二：明确的数据契约
 * - 铁则十三：数据隔离 {charId}:{domain}:{key}
 *
 * @layer Service
 * @depends WorldData, MapData, NPCData, LLMGateway, ContextAssembler
 * @emits world:generated, world:reset
 */

;(function () {
  'use strict';

  class WorldService {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._eventBus = platform.get('eventBus');
      // [v3.0] 预创建 LLMGateway 实例，避免每次调用时重复创建
      if (typeof window.LLMGateway !== 'undefined') {
        this._llmGateway = new window.LLMGateway(this._platform);
      }
    }

    /**
     * 生成大世界（手动触发）
     * 契约: generateWorld(charId, options) → { world, worldMap, npcs, profile }
     */
    async generateWorld(charId, options) {
      // [铁则十] 数据契约：charId 必须是非空字符串
      // [修复] 如果未提供charId，通过适配器获取当前角色ID
      if (!charId || typeof charId !== 'string') {
        console.warn('[WorldService] charId 无效，尝试从适配器获取');
        try {
          const adapter = this._platform?.get?.('adapter') || this._platform?.adapter;
          if (adapter && typeof adapter.getCurrentCharacterId === 'function') {
            charId = await adapter.getCurrentCharacterId();
          }
        } catch (e) {
          console.warn('[WorldService] 从适配器获取charId失败:', e);
        }
        if (!charId) charId = 'default';
      }
      options = options || {};
      var useXBXVectors = options.useXBXVectors !== false;
      var useWorldBook = options.useWorldBook !== false;
      var useCharCard = options.useCharCard !== false;

      try {
        // 第一步：收集数据源
        var xbxData = null;
        if (useXBXVectors) {
          xbxData = await this._tryGetXBXData();
        }

        // 获取ST上下文
        var stContext = null;
        try {
          var adapter = this._platform.get('adapter');
          if (adapter && typeof adapter.getChatContext === 'function') {
            stContext = adapter.getChatContext();
          }
        } catch (_) {}

        var worldBookEntries = [];
        if (useWorldBook) {
          try {
            if (stContext) {
              // [修复] ST世界书获取：
              // 1. 先从角色卡的 data.character_book 获取角色专属世界书
              // 2. 再尝试 loadWorldInfo() 获取全局世界书
              var charIdx = stContext.characterId;
              var localChar = (stContext.characters && stContext.characters[charIdx]) || null;

              // 路径1：角色卡内嵌世界书
              if (localChar && localChar.data && localChar.data.character_book) {
                var book = localChar.data.character_book;
                if (book.entries && Array.isArray(book.entries)) {
                  worldBookEntries = book.entries;
                }
              }

              // 路径2：ST全局世界书（通过 getWorldInfoPrompt 不需要参数）
              if (worldBookEntries.length === 0 && typeof stContext.getWorldInfoPrompt === 'function') {
                try {
                  // getWorldInfoPrompt 返回的是拼好的文本，不适合结构化读取
                  // 改用 reloadWorldInfoEditor 或直接访问内部
                } catch (_) {}
              }

              // 路径3：尝试 loadWorldInfo 不传参数（全局）
              if (worldBookEntries.length === 0 && typeof stContext.loadWorldInfo === 'function') {
                try {
                  var worldInfoData = await stContext.loadWorldInfo();
                  if (worldInfoData && worldInfoData.entries && worldInfoData.entries.length > 0) {
                    worldBookEntries = worldInfoData.entries;
                  }
                } catch (_) {}
              }

              if (worldBookEntries.length > 0) {
                worldBookEntries = worldBookEntries.map(function(e) {
                  return {
                    key: e.comment || (Array.isArray(e.key) ? e.key.join(',') : e.key) || '',
                    content: e.content || ''
                  };
                });
                console.log('[WorldService] 读取世界书条目:', worldBookEntries.length);
              } else {
                console.warn('[WorldService] 未找到世界书数据（角色卡和全局均无）');
              }
            }
          } catch (e) {
            console.warn('[WorldService] 读取世界书失败:', e);
          }
        }

        var charInfo = null;
        if (useCharCard) {
          try {
            if (stContext) {
              // [修复] characterId 是数组索引，characters 是数组
              // getOneCharacter() 会发API请求可能404，直接从本地数组取
              var charIdx = stContext.characterId;
              var charData = null;
              if (stContext.characters && Array.isArray(stContext.characters)) {
                charData = stContext.characters[charIdx] || null;
              }
              if (charData) {
                charInfo = {
                  name: charData.name || '',
                  description: charData.description || charData.data?.description || '',
                  personality: charData.personality || charData.data?.personality || '',
                  scenario: charData.scenario || charData.data?.scenario || '',
                  avatar: charData.avatar || ''
                };
                console.log('[WorldService] 角色卡:', charInfo.name);
              }
              // 降级：尝试适配器标准方法
              if (!charInfo) {
                charInfo = this._platform.get('adapter').getCharacterInfo();
              }
            }
            if (charInfo) {
              console.log('[WorldService] 角色卡:', charInfo.name);
            } else {
              console.warn('[WorldService] 角色卡未获取到');
            }
          } catch (e) {
            console.warn('[WorldService] 读取角色卡失败:', e);
          }
        }

        // 第二步：装配上下文
        var contextParts = [];
        if (charInfo) {
          contextParts.push(this._formatCharInfo(charInfo));
        }
        if (xbxData) {
          var xbxBlock = this._formatXBXData(xbxData);
          if (xbxBlock) contextParts.push(xbxBlock);
        }
        if (worldBookEntries && worldBookEntries.length > 0) {
          contextParts.push(this._formatWorldBook(worldBookEntries));
        }

        var contextText = contextParts.join('\n\n');
        console.log('[WorldService] 世界生成上下文长度:', contextText.length, '字符');

        // 第三步：调用LLM生成
        // [铁则十一] CheckList：事前校验 LLMGateway 可用性
        // [修复] 传对象给LLMGateway，key对应prompt模板中的占位符
        var llmResult = null;
        if (this._llmGateway) {
          try {
            llmResult = await this._llmGateway.generate('world-generator', {
              worldContext: contextText
            });
          } catch (e) {
            console.warn('[WorldService] LLM调用失败，使用默认世界:', e);
          }
        } else {
          console.warn('[WorldService] LLMGateway 不可用，使用默认世界');
        }

        var world = null;
        if (llmResult && typeof llmResult === 'object') {
          world = llmResult;
        } else if (llmResult && typeof llmResult === 'string') {
          world = window.JsonRepair
            ? window.JsonRepair.parse(llmResult, null)
            : null;
          if (!world) {
            var cleaned = this._cleanLLMResponse(llmResult);
            try {
              world = JSON.parse(cleaned);
            } catch (e) {
              console.warn('[WorldService] LLM返回JSON解析失败');
            }
          }
        }

        world = this._normalizeWorld(world, llmResult);

        // [修复] LLM调用失败时，增加基于角色卡信息的 fallback 规则生成逻辑
        // 如果 world 没有 rules 或 rules 全部是占位符，使用角色卡信息生成
        if (world && world.rules && world.rules.length > 0) {
          var hasPlaceholder = world.rules.every(function (r) {
            return /待生成|待完善|placeholder/i.test(r);
          });
          if (hasPlaceholder && charInfo) {
            console.warn('[WorldService] LLM生成的规则为占位符，使用角色卡信息生成fallback规则');
            world.rules = this._generateFallbackRules(charInfo);
          }
        }

        if (!world || !world.name) {
          world = this._buildDefaultWorld(charInfo);
        }

        world.charId = charId;
        world.generatedAt = Date.now();
        world.version = 1;

        // 第四步：生成附属数据
        // [v4.1修复] 优先使用LLM返回的npcs，否则用默认方法
        var worldMap = this._buildDefaultMap(world);
        var npcs;
        if (world.npcs && Array.isArray(world.npcs) && world.npcs.length > 0) {
          console.log('[WorldService] 使用LLM生成的NPC:', world.npcs.length, '个');
          npcs = world.npcs.map(function(npc, idx) {
            return {
              id: npc.id || ('npc_llm_' + Date.now() + '_' + idx),
              name: npc.name || ('NPC_' + (idx + 1)),
              role: npc.role || '待补充',
              occupation: npc.role || '',
              personality: npc.personality || '待生成',
              description: npc.description || '',
              backstory: npc.description || '',
              appearance: npc.description || '',
              plotRelation: npc.relationship || '',
              affinity: 50,
              isContact: npc.isContact || false,
              emoji: npc.emoji || '👤',
              location: (world.locations && world.locations[0] && world.locations[0].id) || 'loc_default',
              createdAt: Date.now()
            };
          });
        } else {
          npcs = this._buildDefaultNPCs(world, xbxData, 6);
        }
        var profile = this._buildDefaultProfile(world);

        // 第五步：写入Schema
        var WorldData = window.PhoneData && window.PhoneData.World;
        var MapData = window.PhoneData && window.PhoneData.Map;
        var NPCData = window.PhoneData && window.PhoneData.NPC;

        if (WorldData) {
          var wd = new WorldData(this._platform);
          await wd.save(charId, world);
        }
        if (MapData) {
          var md = new MapData(this._platform);
          await md.saveWorldMap(charId, worldMap);
        }
        if (NPCData) {
          var nd = new NPCData(this._platform);
          await nd.saveAll(charId, npcs);
        }

        // 第六步：发射事件
        if (this._eventBus) {
          this._eventBus.emit('world:generated', {
            id: 'evt_world_' + Date.now(),
            type: 'world:generated',
            data: { charId: charId, worldName: world.name, npcCount: npcs.length },
            timestamp: Date.now(),
            source: 'world-service'
          });
        }

        try {
          var mediaSvc = window.PhoneServices?.MediaLocal && new window.PhoneServices.MediaLocal(this._platform);
          if (mediaSvc) await mediaSvc.assignRandomNPCAvatars(charId);
        } catch (me) {
          console.warn('[WorldService] NPC 本地头像匹配跳过:', me);
        }

        try {
          var eco = this._platform?.get?.('economyService');
          var startGold = world.economy?.startingBalance || world.startingGold || 300;
          if (eco) {
            var bal = await eco.getBalance('gold');
            if (bal < 50) await eco.add(startGold, 'gold', 'world_start');
          }
        } catch (ee) {
          console.warn('[WorldService] 初始金币发放跳过:', ee);
        }

        console.info('[WorldService] ✅ 大世界生成完成:', world.name, '(' + npcs.length + '个NPC)');
        return { world: world, worldMap: worldMap, npcs: npcs, profile: profile };

      } catch (e) {
        console.warn('[WorldService] 世界生成失败，使用默认世界:', e);
        return this._generateFallbackWorld(charId);
      }
    }

    /**
     * 获取世界数据
     */
    async getWorld(charId) {
      var WorldData = window.PhoneData && window.PhoneData.World;
      if (!WorldData) return null;
      var wd = new WorldData(this._platform);
      return await wd.get(charId);
    }

    /**
     * 检查世界是否已生成
     */
    async isWorldGenerated(charId) {
      var WorldData = window.PhoneData && window.PhoneData.World;
      if (!WorldData) return false;
      var wd = new WorldData(this._platform);
      return await wd.exists(charId);
    }

    /**
     * 重置世界
     */
    async resetWorld(charId) {
      var WorldData = window.PhoneData && window.PhoneData.World;
      var MapData = window.PhoneData && window.PhoneData.Map;
      var NPCData = window.PhoneData && window.PhoneData.NPC;

      if (WorldData) { var wd = new WorldData(this._platform); await wd.delete(charId); }
      if (MapData) { var md = new MapData(this._platform); await md.saveWorldMap(charId, null); }
      if (NPCData) { var nd = new NPCData(this._platform); await nd.saveAll(charId, []); }

      if (this._eventBus) {
        this._eventBus.emit('world:reset', {
          id: 'evt_world_reset_' + Date.now(),
          type: 'world:reset',
          data: { charId: charId },
          timestamp: Date.now(),
          source: 'world-service'
        });
      }
      console.info('[WorldService] ✅ 世界已重置');
    }

    // ===== 私有方法 =====

    async _tryGetXBXData() {
      try {
        var adapter = this._platform.get('adapter');
        if (adapter && typeof adapter.getXBXVectorData === 'function') {
          return await adapter.getXBXVectorData();
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    _formatCharInfo(charInfo) {
      if (!charInfo) return '';
      var parts = ['【角色卡信息】'];
      if (charInfo.name) parts.push('名称: ' + charInfo.name);
      if (charInfo.description) parts.push('描述: ' + charInfo.description);
      if (charInfo.personality) parts.push('性格: ' + charInfo.personality);
      if (charInfo.scenario) parts.push('场景: ' + charInfo.scenario);
      return parts.join('\n');
    }

    _formatXBXData(xbxData) {
      if (!xbxData) return null;
      var parts = ['【小白X积累数据】'];

      if (xbxData.facts && xbxData.facts.length > 0) {
        parts.push('已知世界规则:');
        xbxData.facts.slice(0, 15).forEach(function (f) {
          parts.push('- ' + (f.s || '') + ' ' + (f.p || '') + ' ' + (f.o || ''));
        });
      }

      if (xbxData.events && xbxData.events.length > 0) {
        parts.push('已知剧情事件:');
        xbxData.events.slice(0, 10).forEach(function (e) {
          parts.push('- [' + (e.weight || '') + '] ' + (e.title || '') + ': ' + (e.summary || ''));
        });
      }

      if (xbxData.stateAtoms && xbxData.stateAtoms.length > 0) {
        parts.push('已知场景:');
        xbxData.stateAtoms.slice(0, 8).forEach(function (a) {
          parts.push('- ' + (a.semantic || '') + (a.where ? ' (地点: ' + a.where + ')' : ''));
        });
      }

      return parts.join('\n');
    }

    _formatWorldBook(entries) {
      var parts = ['【世界书条目】'];
      entries.slice(0, 20).forEach(function (e) {
        var name = e.key || e.comment || e.name || '未知';
        var content = e.content || '';
        parts.push('- ' + name + ': ' + content.slice(0, 100));
      });
      return parts.join('\n');
    }

    _buildWorldGenPrompt(contextText) {
      return '根据以下信息生成一个大世界设定。\n\n' +
        contextText + '\n\n' +
        '请生成以下内容（JSON格式）：\n' +
        '{\n' +
        '  "name": "世界名称",\n' +
        '  "background": "世界背景描述（200字以内）",\n' +
        '  "rules": ["世界规则1", "世界规则2", "世界规则3"],\n' +
        '  "factions": [\n' +
        '    {"name": "势力名", "description": "势力描述"}\n' +
        '  ],\n' +
        '  "locations": [\n' +
        '    {"id": "loc_1", "name": "地点名", "description": "地点描述", "type": "urban|suburban|rural|special"}\n' +
        '  ],\n' +
        '  "economy": {\n' +
        '    "currency": "货币名称",\n' +
        '    "startingBalance": 1000\n' +
        '  },\n' +
        '  "themes": ["主题标签1", "主题标签2"]\n' +
        '}';
    }

    /**
     * 规范化世界数据，补充缺失字段
     * [修复] 增加 rules 字段的解析逻辑：
     * - 如果 world.rules 不存在但 world.worldRules 存在，用 world.worldRules
     * - 如果 world.rules 是字符串，转为数组
     * - 确保 rules 至少有3条
     */
    _normalizeWorld(world, raw) {
      if (!world || typeof world !== 'object') {
        if (typeof raw === 'string' && window.JsonRepair?.salvageWorldFromText) {
          world = window.JsonRepair.salvageWorldFromText(raw);
        }
        world = world || {};
      }

      if (!world.name) world.name = world.worldName || world.title || '';
      if (!world.era && world.period) world.era = world.period;
      if (!world.theme && world.genre) world.theme = world.genre;
      if (!world.description) {
        world.description = world.background || world.summary || world.atmosphere || '';
      }
      if (!world.keyLocations && world.locations) {
        world.keyLocations = world.locations.map(function (loc) {
          return typeof loc === 'string' ? loc : (loc.name || loc.id || '');
        }).filter(Boolean);
      }
      if (!world.npcs && world.NPCs) world.npcs = world.NPCs;
      if (!world.economy && world.startingBalance) {
        world.economy = { currency: '金币', startingBalance: world.startingBalance };
      }
      if (!world.name && (world.description || (world.npcs && world.npcs.length))) {
        world.name = (world.theme || world.era || '生成') + '世界';
      }

      // [修复] rules 字段解析逻辑
      // 1. 如果 world.rules 不存在但 world.worldRules 存在，用 world.worldRules
      if (!world.rules && world.worldRules) {
        world.rules = world.worldRules;
      }
      // 2. 如果 world.rules 是字符串，转为数组
      if (typeof world.rules === 'string') {
        world.rules = world.rules.split(/[;\n]/).map(function (r) { return r.trim(); }).filter(Boolean);
      }
      // 3. 确保 rules 是数组
      if (!Array.isArray(world.rules)) {
        world.rules = [];
      }
      // 4. 确保 rules 至少有3条
      while (world.rules.length < 3) {
        world.rules.push('世界规则第' + (world.rules.length + 1) + '条待完善');
      }

      return world;
    }

    /**
     * 构建默认世界（LLM生成失败时的降级方案）
     * [修复] 根据 charInfo 的 scenario 和 personality 生成2-3条有意义的默认规则
     * 而不是硬编码 "世界规则待生成"
     */
    _buildDefaultWorld(charInfo) {
      // 根据角色卡信息生成有意义的默认规则
      var defaultRules = this._generateFallbackRules(charInfo);

      return {
        name: (charInfo && charInfo.name ? charInfo.name + '的世界' : '默认世界'),
        era: this._inferEra(charInfo),
        theme: this._inferTheme(charInfo),
        background: this._inferBackground(charInfo),
        description: this._inferBackground(charInfo),
        rules: defaultRules,
        factions: [],
        locations: [
          { id: 'loc_default', name: '默认区域', description: '初始区域', type: 'urban' }
        ],
        economy: { currency: '金币', startingBalance: 1000 },
        themes: [this._inferTheme(charInfo)]
      };
    }

    /**
     * 根据角色卡信息推断时代
     */
    _inferEra(charInfo) {
      if (!charInfo) return '现代';
      var text = ((charInfo.scenario || '') + ' ' + (charInfo.description || '')).toLowerCase();
      if (/古代|王朝|帝国|王国|江湖|武侠|仙侠|修真|封建|皇朝|唐朝|宋朝|明朝|清朝|战国|三国/.test(text)) return '古代';
      if (/未来|赛博|星际|太空|机甲|末日|废土|后启示录/.test(text)) return '未来';
      if (/中世纪|魔法|骑士|城堡|龙|精灵|矮人|奇幻/.test(text)) return '中世纪';
      if (/现代|都市|学校|公司|大学|城市|都市/.test(text)) return '现代';
      return '现代';
    }

    /**
     * 根据角色卡信息推断主题
     */
    _inferTheme(charInfo) {
      if (!charInfo) return '都市';
      var text = ((charInfo.scenario || '') + ' ' + (charInfo.description || '') + ' ' + (charInfo.personality || '')).toLowerCase();
      if (/魔法|仙侠|修真|玄幻|灵气/.test(text)) return '奇幻';
      if (/武侠|江湖|功夫|武术/.test(text)) return '武侠';
      if (/科幻|赛博|机甲|星际/.test(text)) return '科幻';
      if (/恐怖|惊悚|丧尸|鬼/.test(text)) return '恐怖';
      if (/恋爱|浪漫|甜宠|校园/.test(text)) return '恋爱';
      if (/冒险|探险|寻宝/.test(text)) return '冒险';
      if (/校园|学校|大学|学院/.test(text)) return '校园';
      return '都市';
    }

    /**
     * 根据角色卡信息推断背景描述
     */
    _inferBackground(charInfo) {
      if (!charInfo) return '一个等待探索的世界。';
      var parts = [];
      if (charInfo.name) parts.push('以' + charInfo.name + '为中心的世界');
      if (charInfo.scenario) parts.push(charInfo.scenario);
      else if (charInfo.description) parts.push(charInfo.description.substring(0, 100));
      return parts.join('，') + '。';
    }

    /**
     * LLM调用失败时，基于角色卡信息生成 fallback 规则
     * 根据角色卡的 scenario 和 personality 生成2-3条有意义的默认规则
     */
    _generateFallbackRules(charInfo) {
      var rules = [];
      var name = (charInfo && charInfo.name) || '角色';
      var scenario = (charInfo && charInfo.scenario) || '';
      var personality = (charInfo && charInfo.personality) || '';
      var desc = (charInfo && charInfo.description) || '';
      var combinedText = (scenario + ' ' + personality + ' ' + desc).toLowerCase();

      // 规则1：基于场景生成
      if (/学校|校园|学院|大学/.test(combinedText)) {
        rules.push('学校是日常生活的主要场所，上课、社团活动和校园事件是互动的核心');
      } else if (/公司|职场|办公室|企业/.test(combinedText)) {
        rules.push('职场是主要社交场所，工作关系和同事互动是故事的核心');
      } else if (/江湖|武侠|门派|武林/.test(combinedText)) {
        rules.push('江湖以武功和义气为尊，各门派之间既有合作也有纷争');
      } else if (/魔法|奇幻|精灵|龙/.test(combinedText)) {
        rules.push('魔法是世界运行的基础力量，不同种族和势力围绕魔法资源展开互动');
      } else if (/赛博|科幻|未来|星际/.test(combinedText)) {
        rules.push('科技高度发达，人工智能和虚拟现实深刻影响着每个人的生活');
      } else {
        rules.push('这个世界围绕' + name + '的日常展开，各种事件和邂逅推动故事发展');
      }

      // 规则2：基于性格生成
      if (/温柔|善良|体贴|温暖/.test(combinedText)) {
        rules.push(name + '以温柔和善意对待身边的人，善举会积累好感，恶行会降低信任');
      } else if (/冷酷|高冷|冷漠|傲娇/.test(combinedText)) {
        rules.push(name + '外表冷淡但内心细腻，需要通过耐心和真诚来打开心扉');
      } else if (/活泼|开朗|热情|元气/.test(combinedText)) {
        rules.push(name + '充满活力和热情，积极的态度会感染周围的人，带来更多机遇');
      } else {
        rules.push('角色的性格和选择会影响周围人对' + name + '的态度和关系发展');
      }

      // 规则3：通用规则
      if (scenario) {
        rules.push('当前场景：' + scenario.substring(0, 50) + (scenario.length > 50 ? '...' : ''));
      } else {
        rules.push('世界中的每个NPC都有自己的背景故事和性格，互动方式会影响关系走向');
      }

      // 确保至少有3条规则
      while (rules.length < 3) {
        rules.push('世界规则第' + (rules.length + 1) + '条待完善');
      }

      return rules;
    }

    _buildDefaultMap(world) {
      var locations = (world.locations || []).map(function (loc) {
        return {
          id: loc.id,
          name: loc.name,
          description: loc.description,
          type: loc.type || 'urban',
          markers: [],
          connections: []
        };
      });

      return {
        currentLocation: (locations[0] && locations[0].id) || 'loc_default',
        locations: locations,
        unlockedLocations: locations.map(function (l) { return l.id; })
      };
    }

    _buildDefaultNPCs(world, xbxData, count) {
      var npcs = [];
      var characters = (xbxData && xbxData.characters) || [];
      var events = (xbxData && xbxData.events) || [];

      // 从小白X数据中提取角色名
      var namePool = characters.map(function (c) { return c.name; }).filter(Boolean);
      events.forEach(function (e) {
        if (e.participants) {
          e.participants.forEach(function (p) {
            if (namePool.indexOf(p) === -1) namePool.push(p);
          });
        }
      });

      for (var i = 0; i < count; i++) {
        npcs.push({
          id: 'npc_' + Date.now() + '_' + i,
          name: namePool[i] || ('NPC_' + (i + 1)),
          appearance: '待生成',
          personality: '待生成',
          backstory: '待生成',
          plotRelation: '待生成',
          affinity: 50,
          isContact: false,
          location: (world.locations && world.locations[0] && world.locations[0].id) || 'loc_default',
          createdAt: Date.now()
        });
      }

      return npcs;
    }

    _buildDefaultProfile(world) {
      var economy = (world && world.economy) || {};
      return {
        currency: economy.currency || '金币',
        balance: economy.startingBalance || 1000,
        totalEarned: 0,
        totalSpent: 0,
        questRewards: 0,
        shopPurchases: 0
      };
    }

    _generateFallbackWorld(charId) {
      var world = this._buildDefaultWorld(null);
      var worldMap = this._buildDefaultMap(world);
      var npcs = this._buildDefaultNPCs(world, null, 3);
      var profile = this._buildDefaultProfile(world);

      return { world: world, worldMap: worldMap, npcs: npcs, profile: profile };
    }

    /**
     * [修复] 清洗LLM返回的文本，去除markdown代码块、HTML标签等
     * @param {string} raw
     * @returns {string}
     */
    _cleanLLMResponse(raw) {
      if (!raw || typeof raw !== 'string') return '';
      var cleaned = raw;
      // 1. 去除markdown代码块标记
      cleaned = cleaned.replace(/```json\n?/gi, '');
      cleaned = cleaned.replace(/```\n?/g, '');
      // 2. 去除HTML标签
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      // 3. 去除首尾空白
      cleaned = cleaned.trim();
      // 4. 去除BOM和零宽字符
      cleaned = cleaned.replace(/^\uFEFF/, '');
      cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
      return cleaned;
    }
  }

  /**
   * [Phase 3] Step1: 生成世界大纲
   * 契约: generateStep1(charId, options) → { meta: { truth, onion_layers, atmosphere, trajectory, user_guide } }
   *
   * @param {string} charId - 角色ID
   * @param {Object} options - 生成选项
   * @param {boolean} options.useCharCard - 是否使用角色卡信息（默认true）
   * @param {boolean} options.useWorldBook - 是否使用世界书条目（默认true）
   * @returns {Promise<Object>} Step1 结果
   */
  WorldService.prototype.generateStep1 = async function (charId, options) {
    options = options || {};

    // [铁则十] 数据契约：charId 必须是非空字符串
    if (!charId || typeof charId !== 'string') {
      console.warn('[WorldService] charId 无效，使用默认值');
      charId = 'default';
    }

    try {
      // 使用 WorldExpert 生成 Step1
      var WorldExpert = window.PhoneServices?.WorldExpert;
      if (!WorldExpert) {
        console.warn('[WorldService] WorldExpert 不可用');
        return this._buildDefaultStep1();
      }

      var expert = new WorldExpert(this._platform);
      var result = await expert.generateStep1(charId, options);

      console.info('[WorldService] ✅ Step1 世界大纲生成完成');
      return result;

    } catch (e) {
      console.warn('[WorldService] Step1 生成失败:', e);
      return this._buildDefaultStep1();
    }
  };

  /**
   * [Phase 3] Step2: 生成世界细节
   * 契约: generateStep2(charId, options) → { world: { news }, maps: { outdoor, inside }, npcs: [...], rules: [...], factions: [...] }
   *
   * @param {string} charId - 角色ID
   * @param {Object} options - 生成选项
   * @param {Object} options.step1Data - Step1 的结果（可选，如不提供则从Schema读取）
   * @returns {Promise<Object>} Step2 结果
   */
  WorldService.prototype.generateStep2 = async function (charId, options) {
    options = options || {};

    if (!charId || typeof charId !== 'string') {
      console.warn('[WorldService] charId 无效，使用默认值');
      charId = 'default';
    }

    try {
      // 使用 WorldExpert 生成 Step2
      var WorldExpert = window.PhoneServices?.WorldExpert;
      if (!WorldExpert) {
        console.warn('[WorldService] WorldExpert 不可用');
        return this._buildDefaultStep2();
      }

      var expert = new WorldExpert(this._platform);
      var result = await expert.generateStep2(charId, options);

      console.info('[WorldService] ✅ Step2 世界细节生成完成');
      return result;

    } catch (e) {
      console.warn('[WorldService] Step2 生成失败:', e);
      return this._buildDefaultStep2();
    }
  };

  /**
   * [v3.0] 两步世界生成（Step1大纲 + Step2细节）
   * 铁则一：通过 Schema 写入
   * 铁则三：Service 层处理业务逻辑
   * 铁则九：Step1 失败降级为单步生成
   * @deprecated 请使用 generateStep1 + generateStep2 或 generateFullWorldV2
   */
  WorldService.prototype.generateWorldV2 = async function (charId, options) {
    var self = this;
    options = options || {};

    try {
      // 使用新的两步生成方法
      var step1Result = await self.generateStep1(charId, options);

      if (!step1Result || !step1Result.meta) {
        console.warn('[WorldService] Step1 大纲生成失败，降级为单步生成');
        return self.generateWorld(charId, options);
      }

      var step2Result = await self.generateStep2(charId, Object.assign({}, options, {
        step1Data: step1Result
      }));

      // 合并结果
      var world = self._mergeWorldDataFromSteps(step1Result, step2Result);
      world.charId = charId;
      world.generatedAt = Date.now();
      world.version = 2;

      // 写入 Schema
      var WorldData = window.PhoneData?.World;
      if (WorldData) {
        var wd = new WorldData(this._platform);
        await wd.save(charId, world);
      }

      // 保存地图数据
      var MapData = window.PhoneData?.Map;
      if (MapData && step2Result.maps) {
        var md = new MapData(this._platform);
        await md.save(charId, {
          outdoor: step2Result.maps.outdoor || {},
          inside: step2Result.maps.inside || {},
          playerLocation: step2Result.playerLocation || '起始点',
          visitedLocations: ['起始点'],
          deviationScore: 0
        });
      }

      // 发射事件
      if (self._eventBus) {
        self._eventBus.emit('world:generated', {
          id: 'evt_' + Date.now(),
          type: 'world:generated',
          data: { charId: charId, worldName: world.name, npcCount: (world.npcs || []).length },
          timestamp: Date.now(),
          source: 'world-service'
        });
      }

      console.log('[WorldService] 两步世界生成完成:', world.name);
      return world;

    } catch (e) {
      console.warn('[WorldService] 两步世界生成失败:', e);
      return self.generateWorld(charId, options);
    }
  };

  /**
   * [Phase 3] 完整世界生成 V2（两阶段）
   * @param {string} charId - 角色ID
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 完整世界数据
   */
  WorldService.prototype.generateFullWorldV2 = async function (charId, options) {
    try {
      var WorldExpert = window.PhoneServices?.WorldExpert;
      if (!WorldExpert) {
        console.warn('[WorldService] WorldExpert 不可用，降级为 V1 生成');
        return this.generateWorld(charId, options);
      }

      var expert = new WorldExpert(this._platform);
      var result = await expert.generateFullWorld(charId, options);

      // 保存到 Schema
      var WorldData = window.PhoneData?.World;
      if (WorldData) {
        var wd = new WorldData(this._platform);
        await wd.save(charId, result);
      }

      // 保存地图数据
      if (result.maps) {
        var MapData = window.PhoneData?.Map;
        if (MapData) {
          var md = new MapData(this._platform);
          await md.save(charId, {
            outdoor: result.maps.outdoor || {},
            inside: result.maps.inside || {},
            playerLocation: result.playerLocation || '起始点',
            visitedLocations: ['起始点'],
            deviationScore: 0
          });
        }
      }

      // 发射事件
      if (this._eventBus) {
        this._eventBus.emit('world:generated', {
          id: 'evt_world_' + Date.now(),
          type: 'world:generated',
          data: { charId: charId, worldName: result.meta?.truth?.background?.substring(0, 20) || '未知世界', npcCount: (result.npcs || []).length },
          timestamp: Date.now(),
          source: 'world-service'
        });
      }

      console.info('[WorldService] ✅ 完整世界生成 V2 完成');
      return result;

    } catch (e) {
      console.warn('[WorldService] 完整世界生成 V2 失败，降级为 V1:', e);
      return this.generateWorld(charId, options);
    }
  };

  /**
   * [Phase 3] 合并 Step1 和 Step2 的结果
   * [v4.3-fix] 确保所有顶层字段正确映射
   */
  WorldService.prototype._mergeWorldDataFromSteps = function (step1, step2) {
    var meta = step1.meta || {};
    var truth = meta.truth || {};
    var atmosphere = meta.atmosphere?.current || {};
    var outdoorMap = step2.maps?.outdoor || {};

    // [v4.3-fix] 提取世界名称 - 优先使用 Step2 返回的 world.name 或 map.name
    var worldName = step2.world?.name || outdoorMap.name;
    if (!worldName || worldName === '未知之地' || worldName === '未知世界') {
      // 从背景第一句提取
      var background = truth.background || '';
      if (background) {
        var firstSentence = background.split(/[。！？.!?]/)[0];
        worldName = firstSentence.length > 30 ? firstSentence.substring(0, 30) + '...' : firstSentence;
      } else {
        worldName = '未知世界';
      }
    }

    // [v4.3-fix] 提取时代
    var era = step2.world?.era || '';
    if (!era) {
      var bg = truth.background || '';
      if (/古代|王朝|帝国|江湖|武侠|仙侠/.test(bg)) era = '古代';
      else if (/未来|赛博|星际|科幻/.test(bg)) era = '未来';
      else if (/现代|都市|城市/.test(bg)) era = '现代都市';
      else era = atmosphere.mood || '现代';
    }

    // [v4.3-fix] 提取关键地点（排除起始点）
    var keyLocations = (outdoorMap.nodes || [])
      .map(function (n) { return n.name; })
      .filter(function (n) { return n && n !== '起始点'; });

    // [v4.3-fix] 规范化 factions
    var factions = step2.factions || [];
    if (factions.length === 0 || factions.every(function(f) { return f.name === '未知势力'; })) {
      // 尝试从背景提取
      factions = this._extractFactionsFromBackground(truth.background || '');
    }

    return {
      // [v4.3-fix] 顶层字段
      name: worldName,
      era: era,
      theme: atmosphere.mood || '神秘',
      description: truth.background || '',
      keyLocations: keyLocations,
      factions: factions,
      // 其他字段
      atmosphere: atmosphere,
      trajectory: meta.trajectory?.ending || '',
      rules: step2.rules || [],
      npcs: step2.npcs || [],
      news: step2.world?.news || [],
      maps: step2.maps || {},
      playerLocation: step2.playerLocation || '起始点',
      meta: meta
    };
  };

  /**
   * [v4.3-fix] 从背景文本中提取势力名称
   */
  WorldService.prototype._extractFactionsFromBackground = function (background) {
    if (!background) return [{ name: '居民', description: '普通居民', alignment: 'neutral' }];

    var factions = [];
    var patterns = [
      /[""]([^""]{2,10})[""].*?组织/g,
      /[""]([^""]{2,10})[""].*?集团/g,
      /[""]([^""]{2,10})[""].*?公司/g,
      /地下组织[""]([^""]{2,10})[""]/g
    ];

    patterns.forEach(function(pattern) {
      var match;
      while ((match = pattern.exec(background)) !== null) {
        var name = match[1];
        if (name && !factions.some(function(f) { return f.name === name; })) {
          factions.push({ name: name, description: '与' + name + '相关的势力', alignment: 'neutral' });
        }
      }
    });

    if (factions.length === 0) {
      factions.push({ name: '居民', description: '普通居民', alignment: 'neutral' });
    }

    return factions;
  };

  /**
   * [Phase 3] 构建默认 Step1 结果
   */
  WorldService.prototype._buildDefaultStep1 = function () {
    return {
      meta: {
        truth: {
          background: '这是一个等待探索的世界，真相隐藏在表面之下。',
          driver: { source: '未知力量', target_end: '待揭示', tactic: '暗中操控' }
        },
        onion_layers: {
          L1_TheVeil: [{ name: '表层叙事', description: '世界看起来正常', logic: '维持日常假象' }],
          L2_TheDistortion: [{ name: '异常现象', description: '开始出现违和感', logic: '真相的裂缝' }],
          L3_TheLaw: [{ name: '隐藏规则', description: '世界运转的真实规则', logic: '违反会受到惩罚' }],
          L4_TheAgent: [{ name: '执行者', description: '维护世界秩序的实体', logic: '规则的守护者' }],
          L5_TheAxiom: [{ name: '终极真相', description: '世界的终极秘密', logic: '一切的核心' }]
        },
        atmosphere: {
          reasoning: '默认神秘氛围',
          current: { mood: '神秘', tension_level: 3, visual_style: '写实' }
        },
        trajectory: {
          reasoning: '开放式叙事',
          ending: '由玩家选择决定'
        },
        user_guide: {
          how_to_play: '通过手机与世界互动，探索真相',
          key_mechanics: ['消息聊天', '世界探索', '任务完成'],
          tips: ['多与NPC交流', '注意世界细节', '完成日常任务']
        }
      }
    };
  };

  /**
   * [Phase 3] 构建默认 Step2 结果
   */
  WorldService.prototype._buildDefaultStep2 = function () {
    return {
      world: {
        news: [{ title: '世界诞生', content: '一个新的世界开始了', importance: 'high' }]
      },
      maps: {
        outdoor: {
          name: '未知之地',
          description: '世界刚刚诞生，一切等待探索。',
          nodes: [{ name: '起始点', position: 'center', type: 'home', info: '你的起点', distant: 0 }]
        },
        inside: {
          name: '初始位置',
          description: '一个简陋的起点。',
          nodes: []
        }
      },
      npcs: [],
      rules: ['世界遵循基本的物理法则', 'NPC有自己的行为逻辑和日程', '玩家的选择会影响世界走向'],
      factions: [{ name: '居民', description: '普通居民', alignment: 'neutral' }],
      playerLocation: '起始点'
    };
  };

  /**
   * [v3.0] 将大纲转换为细节（Step2 失败时的降级）
   */
  WorldService.prototype._outlineToDetails = function (outline) {
    var meta = outline.meta || {};
    var truth = meta.truth || {};
    var layers = meta.onion_layers || {};
    var atmosphere = meta.atmosphere?.current || {};

    // [v4.3-fix] 使用更智能的地图名称生成
    var background = truth.background || '';
    var mapName = '未知之地';
    if (background) {
      var firstSentence = background.split(/[。！？.!?]/)[0];
      mapName = firstSentence.length > 50 ? firstSentence.substring(0, 50) + '...' : firstSentence;
    }

    return {
      world: {
        news: [
          { title: '世界诞生', content: '一个新的世界开始了' }
        ]
      },
      maps: {
        outdoor: {
          name: mapName,
          description: background || '世界刚刚诞生，一切等待探索。',
          nodes: [
            { name: '起始点', position: 'center', type: 'home', info: '你的起点', distant: 0 },
            { name: '街道', position: 'north', type: 'street', info: '通向城市各处', distant: 1 },
            { name: '广场', position: 'east', type: 'urban', info: '人群聚集的地方', distant: 2 }
          ]
        },
        inside: {
          name: '居所',
          description: '你的私人空间。',
          nodes: [
            { name: '门口', type: 'door', info: '出入口' },
            { name: '客厅', type: 'room', info: '主要活动空间' }
          ]
        }
      },
      playerLocation: '起始点',
      npcs: []
    };
  };

  /**
   * [v3.0] 合并大纲和细节
   */
  WorldService.prototype._mergeWorldData = function (outline, details) {
    var meta = outline.meta || {};
    var world = details || {};

    return {
      name: world.name || (meta.truth || {}).background || '未知世界',
      era: world.era || '',
      theme: world.theme || '',
      description: world.description || '',
      atmosphere: (meta.atmosphere || {}).current || {},
      trajectory: (meta.trajectory || {}).ending || '',
      keyLocations: (world.maps && world.maps.outdoor && world.maps.outdoor.nodes) ?
        world.maps.outdoor.nodes.map(function (n) { return n.name; }) : [],
      factions: [],
      rules: [],
      npcs: world.npcs || [],
      news: (world.world && world.world.news) ? world.world.news : [],
      maps: world.maps || {},
      playerLocation: world.playerLocation || '起始点',
      meta: meta
    };
  };

  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.World = WorldService;

  console.log('[Service] WorldService 已加载');
})();
