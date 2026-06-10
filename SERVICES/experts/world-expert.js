/**
 * WorldExpert - 世界生成专家
 *
 * [铁则合规]
 * - 铁则一：数据读写通过 Schema (WorldData, MapData, PromptData)
 * - 铁则三：Service层不操作DOM
 * - 铁则六：环境检测通过适配器
 * - 铁则八：不缓存数据副本
 * - 铁则九：错误降级
 * - 铁则十二：明确的数据契约
 *
 * @layer Service
 * @depends WorldData, MapData, PromptData, LLMGateway
 * @emits world:step1_completed, world:step2_completed, world:generated
 */

;(function () {
  'use strict';

  /**
   * WorldExpert 类
   * 负责世界生成的两阶段流程：
   * Step1: 生成世界大纲（真相、洋葱层级、气氛、轨迹）
   * Step2: 生成世界细节（地图、NPC、规则、势力）
   */
  class WorldExpert {
    constructor(platform) {
      this._platform = platform || window.Platform;
      this._eventBus = this._platform.get('eventBus');
      this._llmGateway = null;

      // 初始化 LLMGateway
      if (typeof window.LLMGateway !== 'undefined') {
        this._llmGateway = new window.LLMGateway(this._platform);
      }
    }

    /**
     * Step1: 生成世界大纲
     * 契约: generateStep1(charId, options) → { meta: { truth, onion_layers, atmosphere, trajectory, user_guide } }
     *
     * @param {string} charId - 角色ID
     * @param {Object} options - 生成选项
     * @param {boolean} options.useCharCard - 是否使用角色卡信息（默认true）
     * @param {boolean} options.useWorldBook - 是否使用世界书条目（默认true）
     * @returns {Promise<Object>} Step1 结果
     */
    async generateStep1(charId, options) {
      options = options || {};

      // [铁则十] 数据契约：charId 必须是非空字符串
      if (!charId || typeof charId !== 'string') {
        console.warn('[WorldExpert] charId 无效，使用默认值');
        charId = 'default';
      }

      try {
        // 收集上下文
        const context = await this._assembleContext(options);

        // 调用 LLM 生成大纲
        let outline = null;
        try {
          if (this._llmGateway) {
            outline = await this._llmGateway.generate('world-outline', {
              worldContext: context.text
            });
          }
        } catch (e) {
          console.warn('[WorldExpert] Step1 LLM调用失败:', e);
        }

        // 验证并规范化结果
        const normalizedOutline = this._normalizeStep1Result(outline);

        // 保存到 Schema
        try {
          const WorldData = window.PhoneData?.World;
          if (WorldData) {
            const wd = new WorldData(this._platform);
            await wd.saveStep1(charId, normalizedOutline);
          }
        } catch (e) {
          console.warn('[WorldExpert] Step1 保存失败:', e);
        }

        // 发射事件
        if (this._eventBus) {
          this._eventBus.emit('world:step1_completed', {
            id: 'evt_step1_' + Date.now(),
            type: 'world:step1_completed',
            data: { charId: charId, outline: normalizedOutline },
            timestamp: Date.now(),
            source: 'world-expert'
          });
        }

        console.info('[WorldExpert] ✅ Step1 世界大纲生成完成');
        return normalizedOutline;

      } catch (e) {
        console.warn('[WorldExpert] Step1 生成失败，使用默认大纲:', e);
        return this._buildDefaultStep1();
      }
    }

    /**
     * Step2: 生成世界细节
     * 契约: generateStep2(charId, options) → { world: { news }, maps: { outdoor, inside }, npcs: [...], rules: [...], factions: [...] }
     *
     * @param {string} charId - 角色ID
     * @param {Object} options - 生成选项
     * @param {Object} options.step1Data - Step1 的结果（可选，如不提供则从Schema读取）
     * @returns {Promise<Object>} Step2 结果
     */
    async generateStep2(charId, options) {
      options = options || {};

      if (!charId || typeof charId !== 'string') {
        console.warn('[WorldExpert] charId 无效，使用默认值');
        charId = 'default';
      }

      try {
        // 获取 Step1 数据
        let step1Data = options.step1Data;
        if (!step1Data) {
          try {
            const WorldData = window.PhoneData?.World;
            if (WorldData) {
              const wd = new WorldData(this._platform);
              step1Data = await wd.getStep1(charId);
            }
          } catch (e) {
            console.warn('[WorldExpert] 读取 Step1 数据失败:', e);
          }
        }

        if (!step1Data || !step1Data.meta) {
          console.warn('[WorldExpert] 无 Step1 数据，无法生成 Step2');
          return this._buildDefaultStep2();
        }

        // 收集上下文
        const context = await this._assembleContext(options);
        const outlineText = JSON.stringify(step1Data, null, 2);

        // 调用 LLM 生成细节
        let details = null;
        try {
          if (this._llmGateway) {
            // 使用 world-generator 角色生成细节
            details = await this._llmGateway.generate('world-generator', {
              worldContext: context.text + '\n\n## 世界大纲\n' + outlineText
            });
          }
        } catch (e) {
          console.warn('[WorldExpert] Step2 LLM调用失败:', e);
        }

        // 验证并规范化结果
        const normalizedDetails = this._normalizeStep2Result(details, step1Data);

        // 保存到 Schema
        try {
          const WorldData = window.PhoneData?.World;
          if (WorldData) {
            const wd = new WorldData(this._platform);
            await wd.saveStep2(charId, normalizedDetails);
          }
        } catch (e) {
          console.warn('[WorldExpert] Step2 保存失败:', e);
        }

        // 保存地图数据到 MapData
        try {
          const MapData = window.PhoneData?.Map;
          if (MapData && normalizedDetails.maps) {
            const md = new MapData(this._platform);
            await md.save(charId, {
              outdoor: normalizedDetails.maps.outdoor || {},
              inside: normalizedDetails.maps.inside || {},
              playerLocation: normalizedDetails.playerLocation || '起始点',
              visitedLocations: ['起始点'],
              deviationScore: 0
            });
          }
        } catch (e) {
          console.warn('[WorldExpert] 地图数据保存失败:', e);
        }

        // 发射事件
        if (this._eventBus) {
          this._eventBus.emit('world:step2_completed', {
            id: 'evt_step2_' + Date.now(),
            type: 'world:step2_completed',
            data: { charId: charId, details: normalizedDetails },
            timestamp: Date.now(),
            source: 'world-expert'
          });

          this._eventBus.emit('world:generated', {
            id: 'evt_world_' + Date.now(),
            type: 'world:generated',
            data: {
              charId: charId,
              worldName: (step1Data.meta?.truth?.background || '').substring(0, 20) || '未知世界',
              npcCount: (normalizedDetails.npcs || []).length
            },
            timestamp: Date.now(),
            source: 'world-expert'
          });
        }

        console.info('[WorldExpert] ✅ Step2 世界细节生成完成');
        return normalizedDetails;

      } catch (e) {
        console.warn('[WorldExpert] Step2 生成失败，使用默认细节:', e);
        return this._buildDefaultStep2();
      }
    }

    /**
     * 完整世界生成（两阶段）
     * @param {string} charId - 角色ID
     * @param {Object} options - 生成选项
     * @returns {Promise<Object>} 完整世界数据
     */
    async generateFullWorld(charId, options) {
      try {
        // Step1
        const step1Result = await this.generateStep1(charId, options);

        // Step2
        const step2Result = await this.generateStep2(charId, Object.assign({}, options, {
          step1Data: step1Result
        }));

        // [v4.3-fix] 合并结果，确保所有顶层字段都存在
        const meta = step1Result.meta || {};
        const truth = meta.truth || {};
        const atmosphere = meta.atmosphere?.current || {};
        const outdoorMap = step2Result.maps?.outdoor || {};

        // 提取世界名称 - 优先使用 LLM 返回的，否则从背景生成
        let worldName = step2Result.world?.name || outdoorMap.name;
        if (!worldName || worldName === '未知之地') {
          // 从背景第一句提取世界名称
          const background = truth.background || '';
          if (background) {
            const firstSentence = background.split(/[。！？.!?]/)[0];
            worldName = firstSentence.length > 30 ? firstSentence.substring(0, 30) + '...' : firstSentence;
          } else {
            worldName = '未知世界';
          }
        }

        // 提取时代 - 从背景或氛围推断
        let era = step2Result.world?.era || '';
        if (!era) {
          const background = truth.background || '';
          const mood = atmosphere.mood || '';
          if (/古代|王朝|帝国|江湖|武侠|仙侠/.test(background)) era = '古代';
          else if (/未来|赛博|星际|科幻/.test(background)) era = '未来';
          else if (/现代|都市|城市/.test(background)) era = '现代都市';
          else era = mood || '现代';
        }

        // 提取关键地点
        const keyLocations = outdoorMap.nodes?.map(n => n.name).filter(n => n && n !== '起始点') || [];

        // 规范化 factions - 确保是对象数组
        let factions = step2Result.factions || [];
        if (factions.length === 0 || factions.every(f => f.name === '未知势力')) {
          // 尝试从背景提取势力名称
          factions = this._extractFactionsFromBackground(truth.background || '');
        }

        return {
          charId: charId,
          generatedAt: Date.now(),
          version: 2,
          // [v4.3-fix] 添加顶层字段供 UI 和专家系统使用
          name: worldName,
          era: era,
          theme: atmosphere.mood || '神秘',
          description: truth.background || '',
          keyLocations: keyLocations,
          factions: factions,
          // 保留完整结构
          meta: meta,
          world: step2Result.world,
          maps: step2Result.maps,
          npcs: step2Result.npcs,
          rules: step2Result.rules,
          playerLocation: step2Result.playerLocation || '起始点'
        };

      } catch (e) {
        console.warn('[WorldExpert] 完整世界生成失败:', e);
        return this._buildDefaultFullWorld();
      }
    }

    /**
     * [v4.3-fix] 从背景文本中提取势力名称
     */
    _extractFactionsFromBackground(background) {
      if (!background) return [{ name: '居民', description: '普通居民', alignment: 'neutral' }];

      const factions = [];
      const patterns = [
        /[""]([^""]{2,10})[""].*?组织/g,
        /[""]([^""]{2,10})[""].*?集团/g,
        /[""]([^""]{2,10})[""].*?公司/g,
        /[""]([^""]{2,10})[""].*?势力/g,
        /地下组织[""]([^""]{2,10})[""]/g,
        /组织[""]([^""]{2,10})[""]/g
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(background)) !== null) {
          const name = match[1] || match[0];
          if (name && !factions.some(f => f.name === name)) {
            factions.push({
              name: name,
              description: `与${name}相关的势力`,
              alignment: 'neutral'
            });
          }
        }
      });

      // 如果没有提取到，返回默认
      if (factions.length === 0) {
        factions.push({ name: '居民', description: '普通居民', alignment: 'neutral' });
      }

      return factions;
    }

    // ===== 私有方法 =====

    /**
     * 装配上下文信息
     */
    async _assembleContext(options) {
      const parts = [];

      // 获取角色卡信息
      if (options.useCharCard !== false) {
        try {
          const charInfo = await this._getCharacterInfo();
          if (charInfo) {
            parts.push(this._formatCharInfo(charInfo));
          }
        } catch (e) {
          console.warn('[WorldExpert] 读取角色卡失败:', e);
        }
      }

      // 获取世界书条目
      if (options.useWorldBook !== false) {
        try {
          const entries = await this._getWorldBookEntries();
          if (entries && entries.length > 0) {
            parts.push(this._formatWorldBook(entries));
          }
        } catch (e) {
          console.warn('[WorldExpert] 读取世界书失败:', e);
        }
      }

      // [v4.3-fix] 获取小白X积累数据（与 WorldService 一致）
      if (options.useXBXVectors !== false) {
        try {
          const adapter = this._platform.get('adapter');
          if (adapter && typeof adapter.getXBXVectorData === 'function') {
            const xbxData = await adapter.getXBXVectorData();
            if (xbxData) {
              const xbxBlock = this._formatXBXData(xbxData);
              if (xbxBlock) parts.push(xbxBlock);
            }
          }
        } catch (e) {
          console.warn('[WorldExpert] 读取小白X数据失败:', e);
        }
      }

      return {
        text: parts.join('\n\n'),
        parts: parts
      };
    }

    /**
     * 获取角色卡信息
     */
    async _getCharacterInfo() {
      try {
        const adapter = this._platform.get('adapter');
        if (adapter && typeof adapter.getCharacterInfo === 'function') {
          return adapter.getCharacterInfo();
        }

        // 降级：尝试从 ST 上下文获取
        if (adapter && typeof adapter.getChatContext === 'function') {
          const stContext = adapter.getChatContext();
          if (stContext) {
            const charIdx = stContext.characterId;
            const charData = stContext.characters?.[charIdx];
            if (charData) {
              return {
                name: charData.name || '',
                description: charData.description || charData.data?.description || '',
                personality: charData.personality || charData.data?.personality || '',
                scenario: charData.scenario || charData.data?.scenario || '',
                avatar: charData.avatar || ''
              };
            }
          }
        }
      } catch (e) {
        console.warn('[WorldExpert] 获取角色卡信息失败:', e);
      }
      return null;
    }

    /**
     * 获取世界书条目
     */
    async _getWorldBookEntries() {
      try {
        const adapter = this._platform.get('adapter');
        if (adapter && typeof adapter.getWorldBookEntries === 'function') {
          return await adapter.getWorldBookEntries() || [];
        }
      } catch (e) {
        console.warn('[WorldExpert] 获取世界书条目失败:', e);
      }
      return [];
    }

    _formatCharInfo(charInfo) {
      if (!charInfo) return '';
      const parts = ['【角色卡信息】'];
      if (charInfo.name) parts.push('名称: ' + charInfo.name);
      if (charInfo.description) parts.push('描述: ' + charInfo.description);
      if (charInfo.personality) parts.push('性格: ' + charInfo.personality);
      if (charInfo.scenario) parts.push('场景: ' + charInfo.scenario);
      return parts.join('\n');
    }

    _formatWorldBook(entries) {
      if (!entries || entries.length === 0) return '';
      const parts = ['【世界书条目】'];
      entries.slice(0, 20).forEach(function (e) {
        const name = e.key || e.comment || e.name || '未知';
        const content = e.content || '';
        parts.push('- ' + name + ': ' + content.slice(0, 100));
      });
      return parts.join('\n');
    }

    /**
     * 格式化小白X积累数据
     */
    _formatXBXData(xbxData) {
      if (!xbxData) return null;
      const parts = ['【小白X积累数据】'];

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

    /**
     * 规范化 Step1 结果
     */
    _normalizeStep1Result(result) {
      if (!result || typeof result !== 'object') {
        return this._buildDefaultStep1();
      }

      const meta = result.meta || result;

      return {
        meta: {
          truth: {
            background: meta.truth?.background || meta.background || '世界起源待探索...',
            driver: {
              source: meta.truth?.driver?.source || meta.driver?.source || '未知力量',
              target_end: meta.truth?.driver?.target_end || meta.driver?.target_end || '待揭示',
              tactic: meta.truth?.driver?.tactic || meta.driver?.tactic || '暗中操控'
            }
          },
          onion_layers: {
            // [v4.3-fix] 兼容多种字段名变体（L1_TheVeil / L1_The_Veil / L1_The Veil）
            L1_TheVeil: meta.onion_layers?.L1_TheVeil || meta.onion_layers?.L1_The_Veil || meta.L1_TheVeil || meta.L1_The_Veil || [{ name: '表层叙事', desc: '世界看起来正常', logic: '维持日常假象' }],
            L2_TheDistortion: meta.onion_layers?.L2_TheDistortion || meta.onion_layers?.L2_The_Distortion || meta.L2_TheDistortion || meta.L2_The_Distortion || [{ name: '异常现象', desc: '开始出现违和感', logic: '真相的裂缝' }],
            L3_TheLaw: meta.onion_layers?.L3_TheLaw || meta.onion_layers?.L3_The_Law || meta.L3_TheLaw || meta.L3_The_Law || [{ name: '隐藏规则', desc: '世界运转的真实规则', logic: '违反会受到惩罚' }],
            L4_TheAgent: meta.onion_layers?.L4_TheAgent || meta.onion_layers?.L4_The_Agent || meta.L4_TheAgent || meta.L4_The_Agent || [{ name: '执行者', desc: '维护世界秩序的实体', logic: '规则的守护者' }],
            L5_TheAxiom: meta.onion_layers?.L5_TheAxiom || meta.onion_layers?.L5_The_Axiom || meta.L5_TheAxiom || meta.L5_The_Axiom || [{ name: '终极真相', desc: '世界的终极秘密', logic: '一切的核心' }]
          },
          atmosphere: {
            reasoning: meta.atmosphere?.reasoning || meta.atmosphere_reasoning || '基于角色卡信息推断',
            current: {
              mood: meta.atmosphere?.current?.mood || meta.mood || '神秘',
              tension_level: typeof meta.atmosphere?.current?.tension_level === 'number' ? meta.atmosphere.current.tension_level : (typeof meta.tension_level === 'number' ? meta.tension_level : 3),
              visual_style: meta.atmosphere?.current?.visual_style || meta.visual_style || '写实',
              // [v4.3-fix] 补全小白X标准字段
              environmental: meta.atmosphere?.current?.environmental || meta.environmental || '',
              npc_attitudes: meta.atmosphere?.current?.npc_attitudes || meta.npc_attitudes || ''
            }
          },
          trajectory: {
            reasoning: meta.trajectory?.reasoning || meta.trajectory_reasoning || '基于世界观设计',
            ending: meta.trajectory?.ending || meta.ending || '开放式结局'
          },
          user_guide: meta.user_guide || {
            current_state: meta.current_state || '玩家刚刚进入这个世界',
            guides: meta.guides || ['通过手机与世界互动', '探索不同地点', '与NPC建立关系', '完成日常任务']
          }
        }
      };
    }

    /**
     * 规范化 Step2 结果
     * [v4.3-fix] 改进地图数据降级逻辑，避免名称截断和节点缺失
     */
    _normalizeStep2Result(result, step1Data) {
      if (!result || typeof result !== 'object') {
        return this._buildDefaultStep2(step1Data);
      }

      const meta = step1Data?.meta || {};
      const truth = meta.truth || {};
      const atmosphere = meta.atmosphere?.current || {};

      // 确保 npcs 是数组
      let npcs = result.npcs || result.NPCs || [];
      if (!Array.isArray(npcs)) npcs = [];

      // 确保 rules 是数组
      let rules = result.rules || result.worldRules || [];
      if (typeof rules === 'string') {
        rules = rules.split(/[;\n]/).map(r => r.trim()).filter(Boolean);
      }
      if (!Array.isArray(rules)) rules = [];

      // 确保 factions 是数组
      let factions = result.factions || [];
      if (!Array.isArray(factions)) factions = [];

      // [v4.3-fix] 改进地图数据提取逻辑
      let outdoorMap = result.maps?.outdoor || result.outdoorMap || result.map;
      let insideMap = result.maps?.inside || result.insideMap;

      // 如果 LLM 返回的地图数据不完整，使用更智能的降级
      if (!outdoorMap || !outdoorMap.nodes || outdoorMap.nodes.length === 0) {
        outdoorMap = this._buildSmartOutdoorMap(truth, atmosphere);
      }

      if (!insideMap || !insideMap.nodes) {
        insideMap = this._buildSmartInsideMap();
      }

      return {
        world: {
          news: result.world?.news || result.news || [
            { title: '世界诞生', content: '一个新的世界开始了', importance: 'high' }
          ]
        },
        maps: {
          outdoor: outdoorMap,
          inside: insideMap
        },
        npcs: npcs.map((npc, idx) => ({
          id: npc.id || ('npc_' + Date.now() + '_' + idx),
          name: npc.name || ('NPC_' + (idx + 1)),
          role: npc.role || '居民',
          personality: npc.personality || '待探索',
          description: npc.description || npc.appearance || '',
          backstory: npc.backstory || npc.description || '',
          relationship: npc.relationship || npc.plotRelation || '陌生',
          emoji: npc.emoji || '👤',
          location: npc.location || '起始点',
          affinity: npc.affinity || 50,
          // [v4.3-fix] 保留更多NPC深层字段
          secrets: npc.secrets || [],
          speechStyle: npc.speechStyle || '',
          aliases: npc.aliases || [],
          appearance: npc.appearance || npc.description || ''
        })),
        rules: rules.length > 0 ? rules : [
          '世界遵循基本的物理法则',
          'NPC有自己的行为逻辑和日程',
          '玩家的选择会影响世界走向'
        ],
        // [v4.3-fix] factions 可能是字符串数组或对象数组，统一处理
        factions: factions.map(f => {
          if (typeof f === 'string') {
            return { name: f, description: '从世界设定中提取', alignment: 'neutral' };
          }
          return { name: f.name || '未知势力', description: f.description || '待探索', alignment: f.alignment || 'neutral' };
        }),
        playerLocation: result.playerLocation || '起始点'
      };
    }

    /**
     * [v4.3-fix] 构建智能室外地图 - 基于世界真相生成有意义的地点
     */
    _buildSmartOutdoorMap(truth, atmosphere) {
      const background = truth?.background || '';
      const mood = atmosphere?.mood || '神秘';

      // 提取关键地点关键词
      const locationKeywords = this._extractLocationKeywords(background);

      // 构建基础节点
      const nodes = [
        { name: '起始点', position: 'center', type: 'home', info: '你的起点，一切开始的地方', distant: 0 }
      ];

      // 根据背景添加相关地点
      if (locationKeywords.length > 0) {
        locationKeywords.slice(0, 5).forEach((keyword, idx) => {
          const positions = ['north', 'south', 'east', 'west', 'northeast'];
          const types = this._inferLocationType(keyword);
          nodes.push({
            name: keyword,
            position: positions[idx] || 'north',
            type: types[0] || 'urban',
            info: `与${keyword}相关的地点`,
            distant: idx + 1
          });
        });
      } else {
        // 默认地点
        nodes.push(
          { name: '街道', position: 'north', type: 'street', info: '通向城市各处', distant: 1 },
          { name: '广场', position: 'east', type: 'urban', info: '人群聚集的地方', distant: 2 },
          { name: '商店街', position: 'west', type: 'shop', info: '各种商铺林立', distant: 2 }
        );
      }

      // 生成地图名称 - 使用完整的世界背景第一句，而不是截断
      let mapName = '未知之地';
      if (background) {
        // 提取第一句或前50个字符（不是20个）
        const firstSentence = background.split(/[。！？.!?]/)[0];
        mapName = firstSentence.length > 50 ? firstSentence.substring(0, 50) + '...' : firstSentence;
      }

      return {
        name: mapName,
        description: background || `一个充满${mood}氛围的世界，等待探索。`,
        nodes: nodes
      };
    }

    /**
     * [v4.3-fix] 构建智能室内地图
     */
    _buildSmartInsideMap() {
      return {
        name: '居所',
        description: '你的私人空间，可以休息和整理物品。',
        nodes: [
          { name: '门口', type: 'door', info: '出入口，连接外面的世界' },
          { name: '客厅', type: 'room', info: '主要活动空间' },
          { name: '卧室', type: 'bed', info: '休息的地方' }
        ]
      };
    }

    /**
     * [v4.3-fix] 从背景文本中提取地点关键词
     */
    _extractLocationKeywords(background) {
      if (!background) return [];

      // 常见地点关键词模式
      const patterns = [
        /([\u4e00-\u9fa5]{2,6})(?:公司|集团|企业)/g,  // XX公司
        /([\u4e00-\u9fa5]{2,6})(?:小区|公寓|住宅)/g,  // XX小区
        /([\u4e00-\u9fa5]{2,6})(?:酒吧|咖啡馆|餐厅)/g, // XX酒吧
        /([\u4e00-\u9fa5]{2,6})(?:组织|帮派|团体)/g,  // XX组织
        /([\u4e00-\u9fa5]{2,6})(?:大楼|大厦|中心)/g,  // XX大楼
        /([\u4e00-\u9fa5]{2,6})(?:街|路|巷)/g,       // XX街
        /([\u4e00-\u9fa5]{2,6})(?:广场|公园)/g       // XX广场
      ];

      const keywords = new Set();
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(background)) !== null) {
          keywords.add(match[0]);
        }
      });

      // 也提取一些通用地点词
      const commonPlaces = ['公司', '学校', '医院', '警察局', '商场', '餐厅', '咖啡馆', '酒吧', '公园', '车站'];
      commonPlaces.forEach(place => {
        if (background.includes(place)) {
          keywords.add(place);
        }
      });

      return Array.from(keywords);
    }

    /**
     * [v4.3-fix] 推断地点类型
     */
    _inferLocationType(keyword) {
      const typeMap = {
        '公司': ['urban', 'work'],
        '集团': ['urban', 'work'],
        '小区': ['home', 'residential'],
        '公寓': ['home', 'residential'],
        '酒吧': ['shop', 'social'],
        '咖啡馆': ['shop', 'social'],
        '餐厅': ['shop', 'social'],
        '组织': ['special', 'faction'],
        '大楼': ['urban', 'work'],
        '街': ['street', 'urban'],
        '路': ['street', 'urban'],
        '广场': ['urban', 'social'],
        '公园': ['nature', 'recreation']
      };

      for (const [key, types] of Object.entries(typeMap)) {
        if (keyword.includes(key)) {
          return types;
        }
      }
      return ['urban'];
    }

    _buildDefaultStep1() {
      return {
        meta: {
          truth: {
            background: '这是一个等待探索的世界，真相隐藏在表面之下。',
            driver: {
              source: '未知力量',
              target_end: '待揭示',
              tactic: '暗中操控'
            }
          },
          onion_layers: {
            L1_TheVeil: [{ name: '表层叙事', desc: '世界看起来正常', logic: '维持日常假象' }],
            L2_TheDistortion: [{ name: '异常现象', desc: '开始出现违和感', logic: '真相的裂缝' }],
            L3_TheLaw: [{ name: '隐藏规则', desc: '世界运转的真实规则', logic: '违反会受到惩罚' }],
            L4_TheAgent: [{ name: '执行者', desc: '维护世界秩序的实体', logic: '规则的守护者' }],
            L5_TheAxiom: [{ name: '终极真相', desc: '世界的终极秘密', logic: '一切的核心' }]
          },
          atmosphere: {
            reasoning: '默认神秘氛围',
            current: {
              mood: '神秘',
              tension_level: 3,
              visual_style: '写实',
              environmental: '周围环境安静而神秘',
              npc_attitudes: 'NPC们保持着礼貌但疏离的态度'
            }
          },
          trajectory: {
            reasoning: '开放式叙事',
            ending: '由玩家选择决定'
          },
          user_guide: {
            current_state: '玩家刚刚进入这个世界',
            guides: ['通过手机与世界互动', '探索不同地点', '与NPC建立关系', '完成日常任务']
          }
        }
      };
    }

    _buildDefaultStep2(step1Data) {
      const meta = step1Data?.meta || {};
      const truth = meta.truth || {};
      const atmosphere = meta.atmosphere?.current || {};

      // [v4.3-fix] 使用智能地图构建方法
      const outdoorMap = this._buildSmartOutdoorMap(truth, atmosphere);
      const insideMap = this._buildSmartInsideMap();

      return {
        world: {
          news: [
            { title: '世界诞生', content: '一个新的世界开始了', importance: 'high' }
          ]
        },
        maps: {
          outdoor: outdoorMap,
          inside: insideMap
        },
        npcs: [
          { id: 'npc_default_1', name: '路人甲', role: '居民', personality: '普通', description: '看起来很普通的人', relationship: '陌生', emoji: '👤', location: '起始点', affinity: 50 }
        ],
        rules: [
          '世界遵循基本的物理法则',
          'NPC有自己的行为逻辑和日程',
          '玩家的选择会影响世界走向'
        ],
        factions: [
          { name: '居民', description: '普通居民', alignment: 'neutral' }
        ],
        playerLocation: '起始点'
      };
    }

    _buildDefaultFullWorld() {
      const step1 = this._buildDefaultStep1();
      const step2 = this._buildDefaultStep2(step1);
      const meta = step1.meta || {};
      const truth = meta.truth || {};
      const atmosphere = meta.atmosphere?.current || {};
      const outdoorMap = step2.maps?.outdoor || {};

      // [v4.3-fix] 确保默认数据也有完整的顶层字段
      return {
        charId: 'default',
        generatedAt: Date.now(),
        version: 2,
        // 顶层字段
        name: '默认世界',
        era: '现代',
        theme: atmosphere.mood || '神秘',
        description: truth.background || '一个等待探索的世界',
        keyLocations: outdoorMap.nodes?.map(n => n.name).filter(n => n && n !== '起始点') || [],
        factions: step2.factions || [{ name: '居民', description: '普通居民', alignment: 'neutral' }],
        // 完整结构
        meta: meta,
        world: step2.world,
        maps: step2.maps,
        npcs: step2.npcs,
        rules: step2.rules,
        playerLocation: step2.playerLocation
      };
    }
  }

  // 导出
  window.PhoneServices = window.PhoneServices || {};
  window.PhoneServices.WorldExpert = WorldExpert;

  console.log('[Service] WorldExpert 已加载');
})();
