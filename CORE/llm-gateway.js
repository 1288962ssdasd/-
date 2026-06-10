/**
 * @layer CORE       — 基础设施层
 * @file   llm-gateway.js
 * @depends AIService (PhoneServices.AI), Platform
 * @emits  (无，通过回调/AIService返回)
 *
 * 职责: LLM统一调用网关，四通道独立角色配置
 * 禁止: 包含业务逻辑、直接操作业务数据、持有业务状态
 *
 * [修复记录]
 * - v3.0.1-fix: 修复通道配置未应用到AIService的问题
 * - v3.0.1-fix: 添加详细的日志输出便于调试
 * - v3.0.1-fix: 修复generate方法正确使用通道配置
 */

;(function () {
  'use strict';

  // ==================== 默认角色配置 ====================
  var DEFAULT_ROLES = {
    'chat-reply': {
      name: '聊天回复生成器',
      description: '模拟角色进行聊天回复',
      channel: 'channel-content',
      model: '',
      temperature: 0.8,
      maxTokens: 100,
      timeout: 30000,
      systemPrompt: '你是一个聊天回复生成器，正在模拟 {{characterName}} 进行回复。\n\n请根据以下信息生成回复：\n- 角色设定：{{characterInfo}}\n- 最近聊天：{{chatHistory}}\n- 关系状态：{{relationship}}\n\n规则：\n1. 以角色的语气和风格回复\n2. 回复要简短自然，不超过50字\n3. 只输出回复内容，不要加引号或其他格式',
      contextSources: ['characterName', 'characterInfo', 'chatHistory', 'relationship']
    },

    'world-director': {
      name: '世界事件导演',
      description: '分析剧情，决定是否触发手机事件',
      channel: 'channel-director',
      model: '',
      temperature: 0.5,
      maxTokens: 800,
      timeout: 20000,
      systemPrompt: '你是一个游戏事件导演。基于当前世界状态和剧情变量，决定是否触发手机事件。\n\n## 世界状态\n- 世界：{{world.name}}（{{world.era}}，{{world.theme}}）\n- 氛围：{{world.atmosphere}}\n- 当前层级：Stage {{world.currentStage}}\n- 已揭示真相：{{world.revealedTruth}}\n- 活跃NPC：{{world.activeNPCs}}\n- 最近资讯：{{world.recentNews}}\n\n## 剧情变量\n- 玩家位置：{{story.playerLocation}}\n- 最新行为：{{story.playerAction}}\n- 最近事件：{{story.lastEvent}}\n- 活跃任务：{{story.activeQuests}}\n- 偏差分数：{{story.deviationScore}}\n- 关键关系：{{story.keyRelationships}}\n\n## 系统状态\n- 待执行任务：{{sys.pendingTasks}}\n- 今日已触发：{{sys.triggerCount}}次\n\n## 重要规则\n1. 如果世界状态显示"无"或"未知"，说明尚未生成大世界数据。此时你应**仅基于剧情变量和 assembledContext 中的 ST 上下文**来决策，不要因为缺少世界数据就拒绝生成事件\n2. 基于可用信息分析是否需要触发手机事件\n3. 如果变量信息严重不足（连 ST 上下文也没有），返回 {"events":[], "needDeepAnalysis":true}\n4. 宁可多触发也不要漏掉\n5. 朋友圈(moment)必须由NPC发布：author/authorId 填 NPC 名称，禁止用「我」或玩家口吻\n6. 消息(message)的 fromId 必须是 NPC ID，系统会自动将其加为好友\n\n## 事件格式（严格JSON）\n{"events":[{"type":"message","fromId":"发送者ID","from":"发送者名","content":"消息内容"},{"type":"friend","friendId":"陌生ID或角色ID","name":"角色名","avatar":"头像标识","message":"认识原因"},{"type":"quest","name":"任务名","description":"描述","questType":"主线/支线/日常","friendId":"发布者ID","reward":{"gold":100,"exp":50},"steps":[{"type":"open_app","app":"live","label":"进入直播间"},{"type":"send_gift","giftType":"rocket","amount":50,"label":"送出火箭"},{"type":"shop_checkout","label":"商城购物一次"}]},{"type":"hotSearch","items":[{"title":"热搜标题","heat":999,"tag":"沸"}]},{"type":"news","author":"头条新闻","content":"世界要闻正文"},{"type":"status","target":"gold","change":-50},{"type":"moment","authorId":"发布者ID","author":"发布者名","content":"朋友圈内容","images":[]},{"type":"live","streamerId":"主播ID","streamer":"主播名","title":"直播标题","category":"直播分类"}],"needDeepAnalysis":false}\n\n步骤类型说明: open_app(app=live|shop|message|weibo|forum), spend_gold(amount), send_gift(giftType=flower|rocket|heart...), shop_checkout, add_friend, custom',
      contextSources: [],
      outputFormat: 'json'
    },

    'content-creator': {
      name: '内容创作助手',
      description: '生成微博、朋友圈等社交内容',
      channel: 'channel-content',
      model: '',
      temperature: 0.9,
      maxTokens: 150,
      timeout: 30000,
      systemPrompt: '你是一个社交媒体内容创作助手。\n\n当前角色心情：{{mood}}\n内容类型：{{contentType}}\n\n请生成一条简短、真实、生活化的内容（不超过100字）。\n只输出内容，不要加引号或其他格式。',
      contextSources: ['mood', 'contentType']
    },

    'npc-generator': {
      name: 'NPC生成器',
      description: '根据上下文生成NPC角色信息',
      channel: 'channel-content',
      model: '',
      temperature: 0.8,
      maxTokens: 500,
      timeout: 30000,
      systemPrompt: '你是一个NPC角色生成器。根据提供的上下文信息，生成一个符合世界观的NPC角色。\n\n上下文信息：\n{{worldContext}}\n\n请严格返回以下JSON格式，不要包含任何其他文字或markdown标记：\n{"name":"NPC名称","avatar":"头像描述(用于生成头像的提示词)","personality":"性格特点(50字内)","description":"外貌和背景描述(100字内)","relationship":"与主角的初始关系","emoji":"代表该角色的单个emoji表情"}',
      contextSources: ['worldContext'],
      outputFormat: 'json'
    },

    'world-generator': {
      name: '大世界生成器',
      description: '根据角色卡和世界书生成大世界设定',
      channel: 'channel-world',
      model: '',
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 120000,
      systemPrompt: '你是一个游戏世界数据提取器。你的任务是根据提供的角色卡和世界大纲，提取并生成结构化的世界设定数据。\n\n## 输入内容\n你将收到两部分内容：\n1. 【角色卡信息】——包含世界观、角色、系统设定\n2. 【世界大纲】——包含世界真相、洋葱层级、气氛、轨迹等深度叙事内容\n\n## 你的任务\n从上述内容中，提取以下字段并生成简洁准确的值：\n\n### name（世界名称）\n- 必须是一个简短的专有名词，4-10个字\n- 示例："星城"、"霓虹猎心"、"双面都市"\n- 禁止使用完整句子或超过15个字\n\n### era（时代背景）\n- 2-6个字的简短描述\n- 示例："现代都市"、"近未来"、"赛博朋克"\n- 禁止填入背景故事文本\n\n### theme（主题风格）\n- 一句话概括核心冲突，15字以内\n- 示例："情感博弈与反诈暗战"、"甜蜜陷阱与生死逃亡"\n\n### keyLocations（关键地点）\n- 从角色卡和世界大纲中提取所有提到的具体地点名称\n- 每个地点2-6个字，必须是专有名词\n- 示例：["翡翠湾高档小区", "凤凰大厦", "夜色酒吧", "苏晚晴直播间"]\n- 必须至少有3个地点\n- 禁止使用"起始点"、"某个地方"等占位符\n\n### factions（势力）- 强制提取规则\n- 必须从【角色卡信息】和【世界大纲】中提取所有组织、团体、派系\n- 每个势力必须是一个简短的专有名词（2-8字），不能是泛称\n- 从你收到的输入中，你一定能找到至少2个势力。常见的势力类型：\n  * 组织/帮派名称（如角色卡中的核心组织）\n  * 主角所属的阵营或委托方\n  * 世界大纲中出现的任何有名称的执行机构、执法部门、秘密结社\n- 如果你发现自己想写"未知势力"或"居民"，说明你没有认真提取——请重新阅读输入，找到那些已经存在的、有具体名称的势力\n- 输出格式：["势力名1", "势力名2", ...] （字符串数组，不要用对象）\n\n### rules（规则）\n- 从角色卡和世界大纲中提取所有可执行的世界规则\n- 每条规则必须具体，说明违反后果\n- 至少2条\n\n### atmosphere（氛围）\n- 一句话描述世界氛围，20字以内\n- 示例："表面甜蜜下的暗流涌动，每一次对话都可能是陷阱或救赎"\n- 禁止填入超过30字的文本\n\n### maps（地图）\n- outdoor.name: 城市/地区的简短名称\n- outdoor.description: 城市全景的简短描述（100字内），必须包含具体地标\n- outdoor.nodes: 至少5个地点节点，每个节点的info必须回答"玩家在这里能做什么/发现什么"\n- 禁止将背景故事文本填入map的name或description\n\n### npcs（NPC）\n- 从角色卡中提取，每人必须有具体的personality（用行为描述，如"习惯在对话中试探对方底线"而非"狡猾"）\n\n## 参考信息\n{{worldContext}}\n\n## 输出格式（严格JSON，禁止markdown包裹）\n{"name":"简短的世界名称","era":"简短的时代","theme":"核心冲突","description":"世界简介(150字内)","keyLocations":["地点1","地点2","地点3","地点4","地点5"],"factions":["势力1","势力2"],"rules":["具体规则1及违反后果","具体规则2及违反后果"],"atmosphere":"一句话氛围","npcs":[{"name":"NPC名","role":"职业/身份","personality":"具体行为描述","description":"外貌描述","relationship":"与主角关系","emoji":"🎭"}],"maps":{"outdoor":{"name":"城市名","description":"城市全景描述(100字内)","nodes":[{"id":"loc_1","name":"地点名","type":"home|main|sub|special","position":"center|north|south|east|west","distant":0,"info":"玩家在此能做什么/发现什么的30字描述","npcs":[],"quests":[]}]},"inside":{"name":"初始室内","description":"室内描述(80字)","nodes":[]}}}\n\n## 质量自检（输出前必须确认）\n✓ name是否在10字以内？\n✓ keyLocations是否至少有3个具体地点？\n✓ factions是否不是"未知势力"？\n✓ era是否不是一段长文本？\n✓ maps.outdoor.name是否是一个城市名而非背景故事？\n✓ 每个NPC的personality是否是具体行为而非形容词？\n\n只输出JSON，不要任何解释。',
      contextSources: [],
      outputFormat: 'json'
    },

    'world-outline': {
      name: '世界大纲架构师',
      description: '生成世界核心架构（真相、洋葱层级、气氛、轨迹、用户指南）',
      channel: 'channel-world',
      model: '',
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 120000,
      outputFormat: 'json',
      systemPrompt: '你是一位资深的世界观架构师，擅长构建具有深度叙事层次的RPG游戏世界。\n\n## 输入信息\n{{worldContext}}\n\n## 任务\n根据角色卡和世界信息，生成世界的核心架构。每一层都必须有实质内容，禁止空泛描述。\n\n### 1. 世界真相 (truth)\n- background: 起源→动机→手段→现状（150-200字，具体而非空泛）\n- driver: { source: "幕后推手的身份", target_end: "最终目标（具体可测量）", tactic: "当前正在执行的具体手段" }\n\n### 2. 洋葱层级 (onion_layers)\n每一层2-3条，每条包含 desc（现象描述）和 logic（内在逻辑解释）：\n- L1_TheVeil（表层叙事）：玩家初始看到的正常世界假象\n- L2_TheDistortion（异常现象）：开始出现的违和感和不合理之处\n- L3_TheLaw（隐藏规则）：世界运转的真实法则，违反会受惩罚\n- L4_TheAgent（执行者）：维护世界秩序的超自然/隐秘实体\n- L5_TheAxiom（终极真相）：揭示一切的终极秘密\n\n### 3. 气氛基调 (atmosphere)\n- reasoning: 用COT思维链解释为什么当前气氛应该是这样的（100字）\n- current: { mood: "当前情绪基调", tension_level: 1-5的数字, environmental: "环境描写50字", npc_attitudes: "NPC普遍态度50字" }\n\n### 4. 主线轨迹 (trajectory)\n- reasoning: 用COT思维链推演剧情走向（100字）\n- ending: 预期的结局方向和分歧点（100字）\n\n### 5. 玩家指南 (user_guide)\n- current_state: 玩家当前处境的具体描述（50字）\n- guides: 3-4条具体的行动建议\n\n## 输出格式（严格JSON，禁止markdown）\n{"meta":{"truth":{"background":"","driver":{"source":"","target_end":"","tactic":""}},"onion_layers":{"L1_TheVeil":[{"desc":"","logic":""}],"L2_TheDistortion":[{"desc":"","logic":""}],"L3_TheLaw":[{"desc":"","logic":""}],"L4_TheAgent":[{"desc":"","logic":""}],"L5_TheAxiom":[{"desc":"","logic":""}]},"atmosphere":{"reasoning":"","current":{"mood":"","tension_level":3,"environmental":"","npc_attitudes":""}},"trajectory":{"reasoning":"","ending":""},"user_guide":{"current_state":"","guides":["建议1","建议2","建议3"]}}}',
      contextSources: ['worldContext']
    },

    // ==================== 专家系统角色配置 ====================

    'news-generator': {
      name: '世界新闻生成器',
      description: '根据世界上下文生成新闻头条和内容',
      channel: 'channel-content',
      model: '',
      temperature: 0.8,
      maxTokens: 800,
      timeout: 30000,
      systemPrompt: '你是一个游戏世界新闻编辑。根据当前世界状态生成新闻。\n\n## 世界信息\n- 世界：{{worldName}}（{{worldTheme}}）\n- 时代：{{era}}\n- 氛围：{{atmosphere}}\n- 关键地点：{{keyLocations}}\n- 势力：{{factions}}\n- 活跃NPC：{{npcList}}\n\n## 最近事件\n{{recentEvents}}\n\n## 任务\n生成{{newsCount}}条新闻。新闻必须与世界观一致，涉及NPC或势力动态。\n\n严格返回JSON，禁止markdown：\n{"news":[{"title":"新闻标题","content":"新闻正文(30-80字)","category":"world|local|gossip|business|emergency","relatedNPC":"相关NPC名"}]}\n\n注意：只返回JSON，不要任何其他文字。',
      contextSources: ['worldName', 'worldTheme', 'era', 'atmosphere', 'keyLocations', 'factions', 'npcList', 'recentEvents', 'newsCount'],
      outputFormat: 'json'
    },

    'social-interaction-generator': {
      name: 'NPC社交互动生成器',
      description: '生成NPC的社交互动内容（朋友圈、微博等）',
      channel: 'channel-content',
      model: '',
      temperature: 0.9,
      maxTokens: 600,
      timeout: 30000,
      systemPrompt: '你是一个NPC社交行为模拟器。根据NPC性格和当前世界状态生成社交互动。\n\n## NPC信息\n- 名称：{{npcName}}（{{npcEmoji}}）\n- 性格：{{npcPersonality}}\n- 描述：{{npcDescription}}\n- 关系：{{relationship}}\n\n## 世界信息\n- 世界：{{worldName}}（{{worldTheme}}）\n- 氛围：{{atmosphere}}\n\n## 互动类型\n{{interactionTypes}}\n\n## 最近社交动态\n{{recentSocial}}\n\n## 热门事件\n{{hotEvents}}\n\n## 任务\n根据NPC性格和当前情境，生成一个社交互动。\n\n严格返回JSON，禁止markdown：\n{"interactions":[{"npcId":"{{npcId}}","npcName":"{{npcName}}","type":"moment|weibo|comment|like","content":"互动内容(20-100字，符合NPC性格)","emotion":"happy|sad|angry|neutral|excited","images":["可选图片描述"]}]}\n\n注意：\n1. 必须返回包含interactions数组的JSON\n2. 内容必须符合NPC性格特点\n3. 朋友圈用第一人称，像真人发的朋友圈\n4. 微博用第三人称或话题式\n5. 只返回JSON，不要任何其他文字。',
      contextSources: ['npcId', 'npcName', 'npcEmoji', 'npcPersonality', 'npcDescription', 'relationship', 'worldName', 'worldTheme', 'atmosphere', 'interactionTypes', 'recentSocial', 'hotEvents'],
      outputFormat: 'json'
    },

    'npc-message-generator': {
      name: 'NPC消息生成器',
      description: '根据NPC性格生成聊天消息',
      channel: 'channel-content',
      model: '',
      temperature: 0.9,
      maxTokens: 300,
      timeout: 30000,
      systemPrompt: '你是一个NPC对话生成器。根据NPC的性格和与玩家的关系生成一条消息。\n\n## NPC信息\n- 名称：{{npcName}}（{{npcEmoji}}）\n- 性格：{{npcPersonality}}\n- 描述：{{npcDescription}}\n- 与玩家关系：{{relationship}}\n\n## 世界信息\n- 世界：{{worldName}}\n- 氛围：{{atmosphere}}\n\n## 任务\n生成NPC发给玩家的一条消息。消息要自然、符合NPC性格。\n\n严格返回JSON，禁止markdown：\n{"messages":[{"fromId":"{{npcId}}","from":"{{npcName}}","content":"消息内容(10-80字)","emotion":"happy|sad|angry|worried|neutral|excited|shy"}]}\n\n注意：必须返回包含messages数组的JSON，不要任何其他文字。',
      contextSources: ['npcId', 'npcName', 'npcEmoji', 'npcPersonality', 'npcDescription', 'relationship', 'worldName', 'atmosphere'],
      outputFormat: 'json'
    },

    'quest-generator': {
      name: '任务生成器',
      description: '根据世界上下文和剧情生成游戏任务',
      channel: 'channel-content',
      model: '',
      temperature: 0.7,
      maxTokens: 1500,
      timeout: 60000,
      systemPrompt: '你是一个游戏任务设计师。根据当前世界状态、剧情和玩家情况生成任务。\n\n## 世界信息\n- 世界：{{worldName}}（{{worldTheme}}）\n- 时代：{{era}}\n- 氛围：{{atmosphere}}\n- 关键地点：{{keyLocations}}\n- 势力：{{factions}}\n- 世界规则：{{worldRules}}\n\n## 玩家状态\n{{gameState}}\n\n## 活跃任务（避免重复）\n- 当前活跃任务数：{{activeQuestCount}}\n- 活跃任务：{{activeQuestNames}}\n\n## 可用NPC\n{{npcList}}\n\n## 触发事件\n{{triggerEvent}}\n\n## 任务配置\n- 任务类型：{{questTypes}}\n- 重要性级别：{{importanceLevels}}\n- 步骤类型：{{stepTypes}}\n- 任务链配置：{{chainConfig}}\n- 生成数量：{{questCount}}\n\n## 任务\n根据以上信息生成{{questCount}}个与当前情境相关、符合世界观的任务。\n\n规则：\n1. 任务名称要生动有趣，符合世界观（如古代世界不能用"发朋友圈"）\n2. 任务描述要具体，包含明确的剧情动机\n3. 步骤要多样化，使用不同的步骤类型组合\n4. 奖励要合理，与任务难度匹配\n5. 惩罚要有趣，增加游戏紧张感\n6. 不要生成与活跃任务重复的任务\n7. relatedNPC 必须从可用NPC列表中选择\n8. worldTag 要与世界观标签一致\n\n严格返回JSON，禁止markdown：\n{"quests":[{"id":"quest_自动生成","name":"任务名称","type":"main|side|daily|event","description":"任务描述(30-100字)","importance":"critical|high|medium|low","issuer":"发布者ID","issuerName":"发布者名称","steps":[{"type":"travel|dialogue|shopping|gift|investigate|wait|open_app|send_message|visit_location|interact_npc|complete_task|spend_gold|send_gift|shop_checkout|custom","label":"步骤显示名","description":"步骤详细描述","app":"","giftType":"","amount":0,"with":"","params":{}}],"rewards":{"gold":100,"exp":50,"items":["道具名"],"relationship":0},"penalty":{"type":"gold","value":50,"description":"失败惩罚描述"},"relatedNPC":"发布者NPC名","worldTag":"世界观标签","chainTo":null,"chainDelay":null,"chainConditions":null}],"meta":{"generatedAt":0,"questType":"mixed","expertId":"quest-expert"}}\n\n注意：只返回JSON，不要任何其他文字。',
      contextSources: ['worldName', 'worldTheme', 'era', 'atmosphere', 'keyLocations', 'factions', 'worldRules', 'triggerEvent', 'gameState', 'activeQuestNames', 'activeQuestIds', 'activeQuestCount', 'npcList', 'questTypes', 'importanceLevels', 'stepTypes', 'chainConfig', 'questCount'],
      outputFormat: 'json'
    },

    'shop-generator': {
      name: '商店商品生成器',
      description: '根据世界设定和剧情生成符合主题的商品',
      channel: 'channel-content',
      model: '',
      temperature: 0.8,
      maxTokens: 1500,
      timeout: 30000,
      systemPrompt: '你是一个游戏商店策划师。根据世界设定、当前剧情和玩家状态生成商品列表。\n\n## 世界信息\n- 世界：{{worldName}}（{{worldTheme}}）\n- 时代：{{era}}\n- 氛围：{{atmosphere}}\n- 关键地点：{{keyLocations}}\n- 势力：{{factions}}\n\n## 玩家状态\n{{gameState}}\n\n## 触发上下文\n{{triggerEvent}}\n\n## 任务\n生成5-8个符合世界观的商品。商品必须与世界设定一致（如古代世界不能有手机）。根据玩家当前状态调整商品类型和价格。\n\n严格返回JSON，禁止markdown：\n{"items":[{"id":"item_自动生成","name":"商品名称","category":"consumable|equipment|material|collectible|special","price":100,"currency":"gold","description":"商品描述(20-50字，符合世界观)","worldTag":"世界观标签","effects":[{"type":"attr|buff|heal|luck|relationship","attr":"属性名","value":10,"description":"效果描述"}],"usableIn":["场景列表"],"icon":"商品图标emoji","stock":99}]}\n\n注意：\n1. 价格要合理，消耗品便宜(10-100)，装备贵(500-5000)，特殊物品(1000-10000)\n2. 商品描述要有趣且符合世界观和时代背景\n3. 根据玩家金钱调整商品价格区间\n4. icon 使用单个emoji表示商品\n5. 只返回JSON，不要任何其他文字。',
      contextSources: ['worldName', 'worldTheme', 'era', 'atmosphere', 'keyLocations', 'factions', 'gameState', 'triggerEvent'],
      outputFormat: 'json'
    },

    'world-simulator': {
      name: '世界推演引擎',
      description: '基于当前世界状态和玩家行为推演世界变化',
      channel: 'channel-world',
      model: '',
      temperature: 0.6,
      maxTokens: 2000,
      timeout: 60000,
      outputFormat: 'json',
      systemPrompt: '你是一个世界推演引擎。基于当前世界状态和最近的玩家行为，推演世界可能发生的变化。\n\n## 当前世界状态\n世界名：{{worldName}}\n当前阶段：{{currentStage}}\n偏差分数：{{deviationScore}}\n\n## 世界真相（已揭示）\n{{worldTruth}}\n\n## 最近事件\n{{recentEvents}}\n\n## 玩家最近行为\n{{recentPlayerActions}}\n\n## 任务\n推演以下变化（严格JSON输出）：\n1. 世界资讯更新（1-3条）\n2. NPC关系变化\n3. 洋葱层级揭示（如果偏差分数达到阈值）\n\n## 输出格式\n{"world_news":[{"title":"资讯标题","content":"资讯内容","importance":"high/medium/low"}],"npc_changes":[{"name":"NPC名","change":"变化描述","reason":"原因"}],"layer_reveal":{"should_reveal":false,"layer":"L2_TheDistortion","trigger_event":"触发事件描述"}}',
      contextSources: ['worldName', 'currentStage', 'deviationScore', 'worldTruth', 'recentEvents', 'recentPlayerActions']
    },

    'world-director-deep': {
      name: '世界事件导演（深度分析）',
      description: '变量不足时注入完整上下文的深度分析模式',
      channel: 'channel-director',
      model: '',
      temperature: 0.5,
      maxTokens: 1500,
      timeout: 45000,
      outputFormat: 'json',
      systemPrompt: '你是一个游戏事件导演（深度分析模式）。你有完整的上下文信息。\n\n## 世界状态\n{{worldContext}}\n\n## 剧情上下文（完整）\n{{fullContext}}\n\n## 规则\n1. 这是深度分析模式，你有完整的上下文信息\n2. 仔细分析后生成事件\n3. 深度分析后不再请求 needDeepAnalysis\n\n## 事件格式（严格JSON）\n{"events":[{"type":"message","fromId":"发送者ID","from":"发送者名","content":"消息内容"},{"type":"friend","friendId":"好友ID","name":"角色名","avatar":"头像标识","message":"认识原因"},{"type":"quest","name":"任务名","description":"描述","questType":"主线/支线/日常","reward":{"gold":100},"steps":[{"type":"open_app","app":"shop","label":"去商城购物"},{"type":"shop_checkout","label":"完成结算"}]},{"type":"hotSearch","items":[{"title":"热搜","heat":500}]},{"type":"news","author":"新闻","content":"要闻"},{"type":"status","target":"gold","change":+20},{"type":"moment","author":"名","content":"朋友圈"},{"type":"live","streamer":"主播","title":"直播标题"}]}',
      contextSources: ['worldContext', 'fullContext']
    },

    'deviation-analyzer': {
      name: '偏差分析器',
      description: '分析玩家行为与当前世界规则的偏离程度',
      channel: 'channel-director',
      model: '',
      temperature: 0.2,
      maxTokens: 300,
      timeout: 15000,
      outputFormat: 'json',
      systemPrompt: '你是一个偏差分析器。评估玩家的最新行为对当前世界规则的偏离程度。\n\n## 当前世界规则（已揭示层级）\n{{currentWorldRules}}\n\n## 玩家行为\n{{playerAction}}\n\n## 评分标准\n- -10~-5: 完全符合世界规则\n- -4~4: 中性行为\n- 5~10: 轻微偏离\n- 11~20: 明显偏离\n- 21~30: 严重偏离\n\n## 输出格式（严格JSON）\n{"score_delta":5,"reasoning":"分析过程（50字内）","affected_layer":"L2_TheDistortion","trigger_hint":"如果分数达到揭示阈值，描述触发事件"}',
      contextSources: ['currentWorldRules', 'playerAction']
    },

    'stranger-extractor': {
      name: '陌路人提取器',
      description: '从聊天文本中提取尚未记录的新角色',
      channel: 'channel-content',
      model: '',
      temperature: 0.3,
      maxTokens: 500,
      timeout: 20000,
      outputFormat: 'json',
      systemPrompt: '你是一个角色提取器。分析以下聊天记录，找出其中提到但尚未被记录为新角色/联系人的人物。\n\n## 聊天记录\n{{recentMessages}}\n\n## 已知角色（排除这些）\n{{existingCharacters}}\n\n## 规则\n1. 只提取有明确名字或称呼的角色\n2. 排除已存在于已知角色列表中的人物\n3. 排除仅被泛泛提及的公众人物\n\n## 输出格式（严格JSON数组）\n[{"name":"角色全名","location":"最后提到的位置","info":"从聊天中推断的角色信息","confidence":"high/medium/low"}]\n\n如果没有新角色，返回空数组 []',
      contextSources: ['recentMessages', 'existingCharacters']
    },

    'scene-switch': {
      name: '场景切换引擎',
      description: '处理玩家位置切换时的历史结算和新场景生成',
      channel: 'channel-content',
      model: '',
      temperature: 0.6,
      maxTokens: 2000,
      timeout: 40000,
      outputFormat: 'json',
      systemPrompt: '你是一个场景切换引擎。玩家从 "{{prevLocation}}" 移动到 "{{targetLocation}}"。\n\n## 世界背景\n{{worldContext}}\n\n## 当前状态\n偏差分数：{{deviationScore}}\n当前洋葱层级：{{currentStage}}\n\n## 最近剧情摘要\n{{recentSummary}}\n\n## 任务\n1. 评估离开当前场景的影响（偏差计算）\n2. 描述到达新场景的体验\n\n## 输出格式（严格JSON）\n{"review":{"departure_impact":"离开当前场景的影响描述","deviation":{"cot_analysis":"偏差分析过程","score_delta":0}},"arrival":{"description":"到达新场景的沉浸式描写（100字内）","atmosphere":"场景氛围","notable_elements":["可注意的元素1","可注意的元素2"]},"layer_reveal":{"should_reveal":false,"layer":"","content":""}}',
      contextSources: ['worldContext', 'prevLocation', 'targetLocation', 'deviationScore', 'currentStage', 'recentSummary']
    },

    'local-map-gen': {
      name: '局部地图生成器',
      description: '根据当前位置生成详细室内/局部场景',
      channel: 'channel-content',
      model: '',
      temperature: 0.7,
      maxTokens: 1500,
      timeout: 30000,
      outputFormat: 'json',
      systemPrompt: '你是一个场景细节生成器。根据世界设定和当前位置，生成详细的局部场景。\n\n## 世界设定\n{{worldContext}}\n\n## 当前位置\n{{currentLocation}}\n\n## 已知信息\n{{locationHints}}\n\n## 任务\n生成当前位置的详细场景，包含多个可交互节点。节点名称用 **加粗** 标记。\n\n## 输出格式（严格JSON）\n{"review":{"deviation":{"cot_analysis":"场景分析","score_delta":0}},"inside":{"name":"位置名称","description":"全景描写（包含 **节点名**，150字内）","nodes":[{"name":"节点名","info":"微观细节描述","interactable":true}]}}',
      contextSources: ['worldContext', 'currentLocation', 'locationHints']
    },

    'summary-generator': {
      name: '对话总结器',
      description: '将多条聊天记录压缩为简洁摘要',
      channel: 'channel-content',
      model: '',
      temperature: 0.2,
      maxTokens: 200,
      timeout: 15000,
      outputFormat: 'json',
      systemPrompt: '你是一个对话总结器。将以下聊天记录压缩为简洁的摘要。\n\n## 聊天记录\n{{chatHistory}}\n\n## 规则\n1. 保留关键剧情信息（事件、地点、人物关系变化）\n2. 保留关键对话内容（重要承诺、秘密揭露、任务信息）\n3. 省略日常闲聊和重复内容\n4. 使用第三人称叙述\n5. 控制在100字以内\n\n## 输出格式（严格JSON）\n{"summary":"摘要内容"}',
      contextSources: ['chatHistory']
    },

    'npc-behavior': {
      name: 'NPC行为决策器',
      description: '基于NPC性格和世界状态决定行为并生成内容',
      channel: 'channel-director',
      model: '',
      temperature: 0.7,
      maxTokens: 500,
      timeout: 30000,
      outputFormat: 'json',
      systemPrompt: '你是一个NPC行为决策器。基于NPC的性格、关系和当前世界状态，决定该NPC接下来应该做什么，并生成相应的内容。\n\n## NPC信息\n- 名称：{{npcName}}\n- 性格：{{npcPersonality}}\n- 与主角关系：{{npcRelationship}}\n\n## 世界状态\n{{worldContext}}\n\n## 行为类型\n{{actionType}}\n\n## 规则\n1. 行为必须符合NPC性格特征\n2. 行为应与当前世界状态和关系相协调\n3. 生成的内容要自然、有沉浸感\n4. 不要做与NPC性格完全矛盾的事情\n\n## 输出格式（严格JSON）\n{"action":"行为描述","content":"生成的内容（消息/朋友圈/微博等）","reason":"决策原因（30字内）","mood":"NPC当前心情"}',
      contextSources: ['npcName', 'npcPersonality', 'npcRelationship', 'worldContext', 'actionType']
    }
  };

  // ==================== LLMGateway 类 ====================
  function LLMGateway(platform) {
    this._platform = platform;
    this._roleConfigs = null;
    this._contextCache = {};
    this._channels = {};
    this._queues = {};
    this._running = {};
    this._initialized = false;
    
    // [修复] 立即初始化通道
    this._initChannelsInternal();
  }

  // [修复] 内部初始化通道方法
  LLMGateway.prototype._initChannelsInternal = async function() {
    if (this._initialized) return;
    
    try {
      // 尝试从 ApiConfigData 读取已保存的通道配置
      var apiConfig = null;
      if (window.PhoneData?.ApiConfig) {
        apiConfig = new window.PhoneData.ApiConfig(this._platform);
      }
      
      var savedChannels = null;
      if (apiConfig && typeof apiConfig.getChannelConfig === 'function') {
        savedChannels = await apiConfig.getChannelConfig();
        console.log('[LLMGateway] 从存储读取通道配置:', savedChannels ? '成功' : '无配置');
      }

      // 使用保存的配置或默认配置
      if (savedChannels && Object.keys(savedChannels).length > 0) {
        this._channels = savedChannels;
      } else if (window.LLMChannelConfig) {
        this._channels = window.LLMChannelConfig.getDefaults();
        console.log('[LLMGateway] 使用默认通道配置');
      } else {
        // 最后的fallback
        this._channels = {
          'channel-world': { name: '大世界生成通道', model: '', maxConcurrent: 1, timeout: 120000, fallback: 'channel-fallback' },
          'channel-director': { name: '管家规划通道', model: '', maxConcurrent: 2, timeout: 30000, fallback: 'channel-fallback' },
          'channel-content': { name: '内容生成通道', model: '', maxConcurrent: 5, timeout: 15000, fallback: 'channel-fallback' },
          'channel-fallback': { name: '备用通道', model: '', maxConcurrent: 3, timeout: 60000, fallback: null }
        };
      }

      // 初始化每个通道的队列和计数器
      for (var channelId in this._channels) {
        this._queues[channelId] = [];
        this._running[channelId] = 0;
      }

      this._initialized = true;
      console.log('[LLMGateway] 通道初始化完成，共', Object.keys(this._channels).length, '个通道');
      console.log('[LLMGateway] 通道详情:', JSON.stringify(this._channels, null, 2));
    } catch (e) {
      console.warn('[LLMGateway] 通道初始化失败:', e);
      // 使用最低限度的默认配置
      this._channels = {
        'channel-content': { name: '默认通道', model: '', maxConcurrent: 3, timeout: 30000, fallback: null }
      };
      this._queues['channel-content'] = [];
      this._running['channel-content'] = 0;
      this._initialized = true;
    }
  };

  // ==================== 统一生成入口（修复版）====================

  /**
   * [修复版] 统一LLM生成入口
   * 关键修复：正确使用通道配置传递给AIService
   */
  LLMGateway.prototype.generate = async function (role, context, options) {
    options = options || {};
    
    console.log('[LLMGateway] ========== 开始生成 ==========');
    console.log('[LLMGateway] 角色:', role);
    console.log('[LLMGateway] 上下文键:', Object.keys(context || {}));

    try {
      // 1. 确保通道已初始化
      if (!this._initialized) {
        await this._initChannelsInternal();
      }

      // 2. 获取角色配置
      var roleConfig = await this.getRoleConfig(role);
      console.log('[LLMGateway] 角色配置:', {
        name: roleConfig.name,
        channel: roleConfig.channel,
        model: roleConfig.model,
        temperature: roleConfig.temperature,
        maxTokens: roleConfig.maxTokens,
        timeout: roleConfig.timeout
      });

      // 3. 获取通道配置
      var channelConfig = this._getChannel(roleConfig, options);
      console.log('[LLMGateway] 通道配置:', channelConfig ? {
        name: channelConfig.name,
        model: channelConfig.model,
        timeout: channelConfig.timeout
      } : '使用默认');

      // 4. 构建完整上下文
      var fullContext = await this.buildContext(role, context || {});
      console.log('[LLMGateway] 构建的上下文键:', Object.keys(fullContext));

      // 5. 构建 Prompt（systemPrompt + user prompt 分离）
      var systemPrompt = roleConfig.systemPrompt || '';
      var userPrompt = '';

      // 将 context 变量注入到 systemPrompt 中
      for (var key in fullContext) {
        if (!fullContext.hasOwnProperty(key)) continue;
        var placeholder = '{{' + key + '}}';
        var value = fullContext[key];

        if (Array.isArray(value)) {
          value = value.map(function (item) {
            return typeof item === 'object' ? JSON.stringify(item) : item;
          }).join('\n');
        } else if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value, null, 2);
        } else if (value == null) {
          value = '无';
        }

        // 使用 split().join() 一次性替换
        systemPrompt = systemPrompt.split(placeholder).join(String(value));
      }

      // [v3.3.2-fix] 处理特殊格式占位符 {{xbgetvar_yaml_idx::变量名}}
      // 这种格式可能来自外部变量系统，需要特殊处理
      var specialPlaceholderRegex = /\{\{xbgetvar_yaml_idx::([^}]+)\}\}/g;
      var match;
      while ((match = specialPlaceholderRegex.exec(systemPrompt)) !== null) {
        var varName = match[1];
        console.log('[LLMGateway] 发现特殊占位符:', varName);

        // 尝试从上下文中获取变量值
        var varValue = fullContext[varName] || fullContext['var_' + varName] || '';

        // 如果上下文中没有，尝试从 SILLYTAVERN 世界书中获取
        if (!varValue) {
          try {
            varValue = await this._getVariableFromST(varName);
          } catch (e) {
            console.warn('[LLMGateway] 获取变量失败:', varName, e);
          }
        }

        if (varValue) {
          systemPrompt = systemPrompt.split(match[0]).join(String(varValue));
          console.log('[LLMGateway] 特殊占位符已替换:', varName);
        }
      }

      // 检查是否还有未替换的占位符
      var unmatchedPlaceholders = systemPrompt.match(/\{\{[^}]+\}\}/g);
      if (unmatchedPlaceholders) {
        console.warn('[LLMGateway] 未替换的占位符:', unmatchedPlaceholders);
      }

      // assembledContext 作为 user prompt 附加
      if (fullContext.assembledContext) {
        userPrompt = fullContext.assembledContext;
      }

      // 如果没有分离出 user prompt，把整个 systemPrompt 当 prompt
      var prompt = userPrompt || systemPrompt;
      
      // [v3.3.2-fix] 完整输出组装后的提示词，便于排查超时/空回
      console.log('[LLMGateway] ========== 提示词详情 ==========');
      console.log('[LLMGateway] 角色:', role);
      console.log('[LLMGateway] 通道:', roleConfig.channel);
      console.log('[LLMGateway] 模型:', options.model || channelConfig?.model || roleConfig.model || '(API默认)');
      console.log('[LLMGateway] Prompt总长度:', prompt.length, '字符');
      if (systemPrompt && systemPrompt !== prompt) {
        console.log('[LLMGateway] SystemPrompt长度:', systemPrompt.length, '字符');
        console.log('[LLMGateway] UserPrompt长度:', userPrompt.length, '字符');
      }
      console.log('[LLMGateway] --- SystemPrompt 完整内容 START ---');
      console.log(systemPrompt);
      console.log('[LLMGateway] --- SystemPrompt 完整内容 END ---');
      if (userPrompt) {
        console.log('[LLMGateway] --- UserPrompt 完整内容 START ---');
        console.log(userPrompt);
        console.log('[LLMGateway] --- UserPrompt 完整内容 END ---');
      }

      // 6. [关键修复] 调用 AIService，传递通道配置
      var AIServiceClass = this._platform.get('AI') || window.PhoneServices?.AI;
      var aiService = null;
      if (typeof AIServiceClass === 'function') {
        aiService = new AIServiceClass(this._platform);
      } else if (AIServiceClass && typeof AIServiceClass.generate === 'function') {
        aiService = AIServiceClass;
      }
      
      if (!aiService) {
        console.warn('[LLMGateway] AIService 不可用');
        return roleConfig.outputFormat === 'json' ? { events: [] } : '';
      }

      // [关键修复] 构建 AIService 选项，使用通道配置
      var aiOptions = {
        // [修复] 使用通道的model配置，优先级：options > channel > role > default
        model: options.model || channelConfig?.model || roleConfig.model || '',
        temperature: options.temperature != null ? options.temperature : roleConfig.temperature,
        maxTokens: options.maxTokens || roleConfig.maxTokens,
        // [修复] 使用通道的timeout
        timeout: options.timeout || channelConfig?.timeout || roleConfig.timeout || 30000,
        cache: false
      };

      // 如果有 systemPrompt 且有 user prompt，分离传参
      if (userPrompt && systemPrompt) {
        aiOptions.systemPrompt = systemPrompt;
      }
      
      console.log('[LLMGateway] AIService选项:', {
        model: aiOptions.model || '(使用API配置默认)',
        temperature: aiOptions.temperature,
        maxTokens: aiOptions.maxTokens,
        timeout: aiOptions.timeout,
        hasSystemPrompt: !!aiOptions.systemPrompt
      });

      // [修复] 添加加载状态事件
      this._emitLoadingEvent(role, 'start');
      
      var result = await aiService.generate(prompt, aiOptions);
      
      this._emitLoadingEvent(role, 'complete');
      
      console.log('[LLMGateway] AIService返回类型:', typeof result);
      console.log('[LLMGateway] AIService返回长度:', typeof result === 'string' ? result.length : 'N/A');

      // 7. JSON 输出格式解析（JsonRepair 容错）
      if (roleConfig.outputFormat === 'json' && typeof result === 'string') {
        var fallback = role === 'world-generator' || role === 'world-outline' || role === 'world-simulator'
          ? { name: '默认世界', era: '现代', theme: '都市', description: '', npcs: [] }
          : { events: [] };
        if (window.JsonRepair) {
          var repaired = window.JsonRepair.parse(result, fallback);
          console.log('[LLMGateway] JSON解析成功(JsonRepair)');
          return repaired;
        }
        try {
          var jsonMatch = result.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          return JSON.parse(result);
        } catch (e) {
          console.warn('[LLMGateway] JSON 解析失败:', e.message);
          console.warn('[LLMGateway] 原始结果前200字:', result.substring(0, 200));
          return fallback;
        }
      }

      return result;
    } catch (e) {
      this._emitLoadingEvent(role, 'error', e.message);
      console.warn('[LLMGateway] generate 失败:', e);
      return roleConfig.outputFormat === 'json' ? { events: [] } : '';
    }
  };

  // [新增] 发送加载状态事件
  LLMGateway.prototype._emitLoadingEvent = function(role, status, error) {
    if (this._platform?.eventBus) {
      this._platform.eventBus.emit('llm:loading', {
        role: role,
        status: status, // 'start' | 'complete' | 'error'
        error: error,
        timestamp: Date.now()
      });
    }
    // 同时发送全局事件便于UI监听
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('llm:loading', {
        detail: { role, status, error, timestamp: Date.now() }
      }));
    }
  };

  // ==================== 角色配置管理 ====================

  LLMGateway.prototype.getRoleConfig = async function (role) {
    if (!this._roleConfigs) {
      await this._loadRoleConfigs();
    }
    return this._roleConfigs[role] || DEFAULT_ROLES[role] || DEFAULT_ROLES['content-creator'];
  };

  LLMGateway.prototype.updateRoleConfig = async function (role, config) {
    if (!this._roleConfigs) {
      await this._loadRoleConfigs();
    }
    this._roleConfigs[role] = Object.assign({}, this._roleConfigs[role], config);
    await this._saveRoleConfigs();
    delete this._contextCache[role];
  };

  LLMGateway.prototype.resetRoleConfig = async function (role) {
    if (!this._roleConfigs) {
      await this._loadRoleConfigs();
    }
    this._roleConfigs[role] = Object.assign({}, DEFAULT_ROLES[role] || {});
    await this._saveRoleConfigs();
    delete this._contextCache[role];
  };

  LLMGateway.prototype.getAllRoleConfigs = async function () {
    if (!this._roleConfigs) {
      await this._loadRoleConfigs();
    }
    return this._roleConfigs;
  };

  // ==================== 上下文构建 ====================

  LLMGateway.prototype.buildContext = async function (role, userContext) {
    var self = this;

    // 缓存检查
    var dataHash = await this._computeContextHash(role, userContext);
    var cached = this._contextCache[role];

    if (cached && cached.hash === dataHash && Date.now() - cached.timestamp < 30000) {
      console.log('[LLMGateway] 上下文缓存命中');
      return cached.context;
    }

    // 未命中，重新构建
    var roleConfig = DEFAULT_ROLES[role] || {};
    var sources = roleConfig.contextSources || [];
    var context = Object.assign({}, userContext);

    console.log('[LLMGateway] 构建上下文，数据源:', sources);

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      try {
        switch (source) {
          case 'characterName':
            if (!context.characterName) {
              context.characterName = await self._getCharacterName();
            }
            break;
          case 'characterInfo':
            context.characterInfo = await self._getCharacterInfo();
            break;
          case 'chatHistory':
            if (!context.chatHistory) {
              context.chatHistory = await self._getChatHistory(userContext.friendId);
            }
            break;
          case 'relationship':
            context.relationship = await self._getRelationship(userContext.friendId);
            break;
          case 'recentMessages':
            context.recentMessages = await self._getSTRecentMessages();
            break;
          case 'gameState':
            context.gameState = await self._getGameState();
            break;
          case 'activeQuests':
            context.activeQuests = await self._getActiveQuests();
            break;
          case 'assembledContext':
            if (!context.assembledContext) {
              context.assembledContext = userContext.assembledContext || '';
            }
            break;
          case 'mood':
            if (!context.mood) {
              context.mood = userContext.mood || '平静';
            }
            break;
          case 'contentType':
            if (!context.contentType) {
              context.contentType = userContext.contentType || '朋友圈';
            }
            break;
          case 'worldContext':
            if (!context.worldContext) {
              context.worldContext = userContext.worldContext || '';
            }
            break;
        }
      } catch (e) {
        console.warn('[LLMGateway] 获取上下文数据源失败:', source, e);
      }
    }

    // 更新缓存
    this._contextCache[role] = { hash: dataHash, context: context, timestamp: Date.now() };
    return context;
  };

  // ==================== 上下文获取方法 ====================

  LLMGateway.prototype._getCharacterName = async function () {
    try {
      var adapter = this._platform.adapter;
      if (adapter && typeof adapter.getCurrentCharacter === 'function') {
        var char = adapter.getCurrentCharacter();
        if (char && char.name) {
          return char.name;
        }
      }
      return '未知角色';
    } catch (e) {
      return '未知角色';
    }
  };

  LLMGateway.prototype._getCharacterInfo = async function () {
    try {
      var adapter = this._platform.adapter;
      if (adapter && typeof adapter.getCurrentCharacter === 'function') {
        var char = adapter.getCurrentCharacter();
        if (char) {
          var info = '名称: ' + (char.name || '未知') + '\n';
          if (char.description) info += '描述: ' + char.description + '\n';
          if (char.personality) info += '性格: ' + char.personality + '\n';
          if (char.scenario) info += '场景: ' + char.scenario + '\n';
          return info;
        }
      }
      return '未知角色';
    } catch (e) {
      return '未知角色';
    }
  };

  LLMGateway.prototype._getChatHistory = async function (friendId) {
    if (!friendId) return '无';
    try {
      var messages = await this._platform.data('message', 'byFriend', friendId);
      if (!messages || messages.length === 0) return '无';

      var recent = messages.slice(-10);
      return recent.map(function (m) {
        var sender = m.senderId === 'me' ? '我' : (m.senderName || '对方');
        return sender + ': ' + (m.content || '[非文本消息]');
      }).join('\n');
    } catch (e) {
      return '无';
    }
  };

  LLMGateway.prototype._getRelationship = async function (friendId) {
    if (!friendId) return '普通朋友';
    try {
      var friend = await this._platform.data('friend', 'byId', friendId);
      if (friend) {
        var rel = '关系: ' + (friend.relationship || friend.remark || '普通朋友');
        if (friend.unread > 0) rel += ' (未读' + friend.unread + '条)';
        return rel;
      }
      return '普通朋友';
    } catch (e) {
      return '普通朋友';
    }
  };

  LLMGateway.prototype._getSTRecentMessages = async function () {
    try {
      var adapter = this._platform.adapter;
      if (adapter && typeof adapter.getChatContext === 'function') {
        var ctx = adapter.getChatContext();
        if (ctx && ctx.chat && ctx.chat.length > 0) {
          var recent = ctx.chat.slice(-6);
          return recent.map(function (msg) {
            var role = msg.is_user ? '用户' : (msg.name || 'AI');
            var content = (msg.mes || '').substring(0, 300);
            return role + ': ' + content;
          }).join('\n');
        }
      }
      return '无';
    } catch (e) {
      return '无';
    }
  };

  LLMGateway.prototype._getGameState = async function () {
    try {
      var money = await this._platform.data('status', 'currency', null);
      var scene = await this._platform.data('status', 'currentScene', null);
      var state = '';
      if (money) state += '金钱: ' + JSON.stringify(money) + '\n';
      if (scene) state += '场景: ' + scene;
      return state || '未知';
    } catch (e) {
      return '未知';
    }
  };

  LLMGateway.prototype._getActiveQuests = async function () {
    try {
      var quests = await this._platform.data('quest', 'registry', null);
      if (!quests) return '无活跃任务';

      var parsed = typeof quests === 'string' ? JSON.parse(quests) : quests;
      var active = [];

      if (Array.isArray(parsed)) {
        active = parsed.filter(function (q) { return q.status === 'active'; });
      } else if (parsed && parsed.quests) {
        active = parsed.quests.filter(function (q) { return q.status === 'active'; });
      }

      return active.length > 0
        ? active.map(function (q) { return '- ' + (q.name || q.title || '未命名任务'); }).join('\n')
        : '无活跃任务';
    } catch (e) {
      return '无活跃任务';
    }
  };

  // [v3.3.2-fix] 从 SillyTavern 世界书获取变量值
  // [v4.31.0-fix] 铁则六修复：通过 adapter 接口获取，不直接访问 window.SillyTavern
  LLMGateway.prototype._getVariableFromST = async function (varName) {
    try {
      console.log('[LLMGateway] 尝试从ST获取变量:', varName);

      // 尝试从适配器获取世界书条目（优先）
      var adapter = this._platform?.adapter;
      if (adapter) {
        // 尝试通过 getWorldBookEntryByName 获取（铁则六合规）
        if (typeof adapter.getWorldBookEntryByName === 'function') {
          var content = adapter.getWorldBookEntryByName(varName);
          if (content) {
            console.log('[LLMGateway] 从适配器获取到变量:', varName);
            return content;
          }
        }
        
        // 尝试通过 getWorldBookEntries 获取
        if (typeof adapter.getWorldBookEntries === 'function') {
          var entries = adapter.getWorldBookEntries();
          if (entries) {
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].name === varName || entries[i].id == varName || entries[i].comment === varName) {
                console.log('[LLMGateway] 从世界书条目获取到变量:', varName);
                return entries[i].content || entries[i].text || '';
              }
            }
          }
        }
        
        // 兼容旧方法
        if (typeof adapter.getWorldBookEntry === 'function') {
          var entry = await adapter.getWorldBookEntry(varName);
          if (entry) {
            console.log('[LLMGateway] 从世界书获取到变量:', varName);
            return entry.content || entry.text || JSON.stringify(entry);
          }
        }
      }

      // 尝试从 DataStore 获取
      if (this._platform?.data) {
        var worldEntries = await this._platform.data('world', 'entries', null);
        if (worldEntries && worldEntries[varName]) {
          console.log('[LLMGateway] 从DataStore获取到变量:', varName);
          return worldEntries[varName];
        }
      }

      console.log('[LLMGateway] 无法获取变量（变量不存在）:', varName);
      return '';
    } catch (e) {
      console.warn('[LLMGateway] 获取ST变量失败:', varName, e);
      return '';
    }
  };

  // ==================== 缓存哈希 ====================

  LLMGateway.prototype._computeContextHash = async function (role, userContext) {
    try {
      var msgCount = 0;
      if (userContext.friendId) {
        var messagesData = window.PhoneData?.Messages;
        if (messagesData) {
          var msgs = await messagesData.getByFriendId(userContext.friendId);
          msgCount = msgs ? msgs.length : 0;
        }
      }
      var contextKeys = Object.keys(userContext).sort().join(',');
      return role + ':' + (userContext.friendId || '_') + ':' + msgCount + ':' + contextKeys;
    } catch (e) {
      return role + ':' + (userContext.friendId || '_');
    }
  };

  // ==================== 配置存储 ====================

  LLMGateway.prototype._loadRoleConfigs = async function () {
    try {
      var ApiConfigClass = window.PhoneData?.ApiConfig;
      var apiConfig = null;
      if (typeof ApiConfigClass === 'function') {
        apiConfig = new ApiConfigClass(this._platform);
      }
      if (apiConfig && typeof apiConfig.getPrompt === 'function') {
        var stored = await apiConfig.getPrompt('llm_roles');
        if (stored) {
          if (typeof stored === 'object' && stored !== null) {
            this._roleConfigs = stored;
          } else if (typeof stored === 'string') {
            try {
              this._roleConfigs = JSON.parse(stored);
            } catch (parseErr) {
              this._roleConfigs = {};
              for (var rk in DEFAULT_ROLES) {
                this._roleConfigs[rk] = Object.assign({}, DEFAULT_ROLES[rk]);
              }
              if (this._roleConfigs['default']) {
                this._roleConfigs['default'].systemPrompt = stored;
              }
            }
          }
          // 确保每个角色都有配置
          for (var roleKey in DEFAULT_ROLES) {
            if (!this._roleConfigs[roleKey]) {
              this._roleConfigs[roleKey] = Object.assign({}, DEFAULT_ROLES[roleKey]);
            }
          }
          return;
        }
      }
    } catch (e) {
      console.error('[LLMGateway] 加载配置失败:', e);
    }
    // 无存储数据时，用 DEFAULT_ROLES 填充
    this._roleConfigs = {};
    for (var key in DEFAULT_ROLES) {
      this._roleConfigs[key] = Object.assign({}, DEFAULT_ROLES[key]);
    }
  };

  LLMGateway.prototype._saveRoleConfigs = async function () {
    try {
      var ApiConfigClass = window.PhoneData?.ApiConfig;
      var apiConfig = null;
      if (typeof ApiConfigClass === 'function') {
        apiConfig = new ApiConfigClass(this._platform);
      }
      if (apiConfig && typeof apiConfig.updatePrompt === 'function') {
        const jsonStr = JSON.stringify(this._roleConfigs);
        await apiConfig.updatePrompt('llm_roles', jsonStr);
      }
    } catch (e) {
      console.error('[LLMGateway] 保存配置失败:', e);
    }
  };

  // ==================== 通道管理方法 ====================

  LLMGateway.prototype.initChannels = async function () {
    return this._initChannelsInternal();
  };

  LLMGateway.prototype._getChannel = function (roleConfig, options) {
    var channelId = (options && options.channel) || roleConfig.channel || 'channel-content';
    return this._channels[channelId] || this._channels['channel-fallback'] || null;
  };

  LLMGateway.prototype.updateChannel = function (channelId, config) {
    if (this._channels[channelId]) {
      for (var key in config) {
        this._channels[channelId][key] = config[key];
      }
      console.log('[LLMGateway] 通道 ' + channelId + ' 已更新');
    }
  };

  LLMGateway.prototype.getChannelStatus = function () {
    var status = {};
    for (var id in this._channels) {
      status[id] = {
        name: this._channels[id].name,
        queueLength: (this._queues[id] || []).length,
        running: this._running[id] || 0,
        maxConcurrent: this._channels[id].maxConcurrent
      };
    }
    return status;
  };

  // ==================== 导出 ====================
  window.LLMGateway = LLMGateway;
  window.LLMGateway.DEFAULT_ROLES = DEFAULT_ROLES;
  window.LLMGateway.ROLE_NAMES = {
    'chat-reply': '聊天回复生成器',
    'world-director': '世界事件导演',
    'content-creator': '内容创作助手',
    'npc-generator': 'NPC生成器',
    'world-generator': '大世界生成器',
    'world-outline': '世界大纲架构师',
    'world-simulator': '世界推演引擎',
    'world-director-deep': '世界事件导演（深度分析）',
    'deviation-analyzer': '偏差分析器',
    'stranger-extractor': '陌路人提取器',
    'scene-switch': '场景切换引擎',
    'local-map-gen': '局部地图生成器',
    'summary-generator': '对话总结器',
    'npc-behavior': 'NPC行为决策器'
  };
})();
