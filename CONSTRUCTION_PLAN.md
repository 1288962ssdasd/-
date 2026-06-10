# 外置手机 4.1 沙盒系统施工方案 v2

> **版本**: 2.0.0  
> **日期**: 2026-05-18  
> **状态**: 待确认  
> **变更**: 根据代码审查修订 — 合并重叠 Schema、EventDispatcher 改用 ServiceContainer、DirectorService 补充具体改造逻辑

---

## 铁则体系（最高准则）

> 以下铁则必须在所有施工任务中严格遵守，任何代码改动都需要逐条确认。

### 铁则一：数据读写唯一通道

所有业务数据，必须且只能通过 `data-schemas/` 下的 Schema 辅助函数读写。

- Schema 的真实方法名，必须通过 `Object.getOwnPropertyNames(Object.getPrototypeOf(instance))` 确认，不准猜测
- 禁止直接调用 `Platform.setData` 或 `BridgeAPI` 进行数据写入

```javascript
// ❌ 禁止
Platform.setData(`messages:${msgId}`, msgData);

// ✅ 正确
this._msgData.add(msgData);
```

### 铁则二：WebSocket 只死在适配器里

WebSocket 连接和生命周期管理必须封装在适配器内部，业务代码禁止直接操作 WebSocket。

### 铁则三：模块三层分离

| 层级 | 文件命名 | 职责 | 禁止行为 |
|------|----------|------|----------|
| **Service层** | `xxx-service.js` | 数据操作、AI调用、事件发射、返回数据对象 | 操作DOM |
| **Module层** | `xxx-module.js` | 生命周期管理、事件绑定、调用Service、订阅数据变更 | 直接写数据 |
| **Renderer层** | `xxx-renderer.js` | DOM生成、样式注入 | 包含业务逻辑 |

### 铁则四：启动时序严格串行

```
阶段1: PluginBridge 可达 → 广播 BRIDGE_READY
阶段2: Platform 初始化 → 广播 PLATFORM_READY
阶段3: Schema 注册 → 广播 SCHEMAS_READY
阶段4: Service 初始化 → 广播 SERVICES_READY
阶段5: Module 初始化 → 广播 MODULES_READY
阶段6: 广播 APP_READY
```

任何模块、服务、渲染器禁止在对应阶段事件触发前执行初始化逻辑。

### 铁则五：模块注册必须用 __phoneShell.registerModule

```javascript
// ✅ 正确
window.__phoneShell.registerModule({
  id: 'message-module',
  init() { ... },
  destroy() { ... }
});

// ❌ 错误
window.__phoneShell.registerModule(new MessageModule());
```

### 铁则六：环境适配必须在入口处完成

适配器类型通过配置或环境变量决定，不准在业务代码里写 `if (window.SillyTavern) ...` 这样的环境判断。

### 铁则七：不猜测 API，必须验证

使用任何 Schema 方法前，必须在控制台执行验证：

```javascript
Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
```

### 铁则八：状态管理禁止双写

模块内部禁止维护 `this._posts`、`this._messages` 等内存副本。数据始终通过 Service 从 DataStore 获取。

### 铁则九：错误处理必须降级，不能阻断

所有异步操作必须有 `.catch` 或 `try/catch`，失败时输出警告，不得阻断整个应用。

### 铁则十：AGENT 改代码时的检查清单

每次修改代码后，必须逐条确认：

1. 数据读写是否通过 Schema？
2. 有无在服务层之外操作 DOM？
3. 有无在渲染层里写业务逻辑？
4. 模块注册是否用了 `__phoneShell.registerModule`？
5. 启动时序是否严格按 6 阶段执行？
6. 新增 Schema 使用前是否验证过真实方法名？
7. 有无模块内部缓存数据副本？
8. 异步操作是否有错误处理？
9. 适配器是否正确选择？
10. 有无直接监听 WebSocket 的代码？

### 铁则十二：交互数据契约

- Module 层禁止拼装数据，只能调用 Service 方法
- Service 层是唯一的数据加工厂
- 最终落盘必为完整结构体，不能是零散键值对

### 铁则十三：数据隔离

```
角色卡数据: {charId}:{domain}:{key}
全局数据:   global:{domain}:{key}
```

不同角色卡的数据完全隔离，互不访问。

---

## 一、需求概述

### 1.1 核心目标

将小白X 沙盒系统核心能力移植到外置手机，实现：

1. **大世界生成** → 世界书约束 + 角色卡元数据（静态层）
2. **管家驱动引擎** → 局部任务 + 事件分发（动态层）
3. **多角色卡群组** → ST 角色卡在小手机内组建群聊（交互层）
4. **自动化工作流** → 用户无感，小手机自动响应 ST 上下文变化
5. **结果回传 ST** → 关键事件同步到 ST 世界书，小白X 可读取生成向量

### 1.2 解决的问题

| 问题 | 现状 | 目标 |
|------|------|------|
| 提示词过长超时 | `_collectContext()` 全量抓取 6 条聊天 + 游戏状态 + 任务 + 行为闭环 | `ContextAssembler` 预算控制 ≤2000 tokens |
| 无法复用 | 每次触发重新抓取全部上下文 | 静态数据缓存到 Schema，增量更新 |
| NPC 生成分散 | 无统一流程 | `NPCGeneratorService` 统一管理 |
| 多角色卡无关联 | 各角色卡独立，FriendsData 已支持 `isGroup` 字段 | 扩展 FriendsData 群组能力 |
| 手动触发 | 用户需要手动操作 | 自动化，用户无感 |
| EventDispatcher 性能 | 每次分发 `new Service()` 浪费性能 | 通过 `Platform.get('serviceName')` 获取已注册服务 |

---

## 二、现有代码审查（修订依据）

### 2.1 FriendsData 已有群组基础

`friends-data.js:55` 的 `add()` 方法已支持 `isGroup` 字段：

```javascript
async add(friend) {
  // friend: { id, name, avatar?, isGroup?, members? }
  const newFriend = {
    ...friend,
    isGroup: friend.isGroup || false,
    members: friend.members || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    unread: 0,
    lastMessage: '',
    lastTime: '',
  };
}
```

**结论**：不需要新建 `GroupData` Schema，直接扩展 `FriendsData` 增加群组管理方法。

### 2.2 DirectorService._collectContext() 是超时根因

`director-service.js:176-252` 的 `_collectContext()` 方法：

```javascript
async _collectContext() {
  const context = {
    recentMessages: [],    // 抓 6 条原始聊天，每条截断 300 字 → 可能 1800 字
    gameState: {},         // 3 个字段
    activeQuests: [],      // 最多 5 个任务
    userBehavior: {},      // 3 个闭环数据
  };
  // 全部塞进 prompt → 超时
}
```

**结论**：需要用 `ContextAssembler` 替代 `_collectContext()`，按预算装配。

### 2.3 DirectorService._dispatchEvent() 直接操作 Platform.setData

`director-service.js:318-410` 的 `_dispatchEvent()` 方法存在铁则违规：

```javascript
// ❌ 铁则一违规：直接调用 Platform.setData
await this._platform?.setData('messages', 'pending', { ... });
await this._platform?.setData('quest', 'pendingNotify', { ... });
await this._platform?.setData('friendsCircle', 'pendingMoment', { ... });
await this._platform?.setData('game', event.target, event.change);
```

**结论**：需要改为通过对应 Schema 写入（`MessagesData`、`TaskData`、`FriendsCircleData`、`StatusData`）。

### 2.4 Platform 已有 ServiceContainer

`platform.js:24` 已实现 `ServiceContainer`：

```javascript
this._serviceContainer = new ServiceContainer();
// 注册: platform.register('name', service)
// 获取: platform.get('name')
// 检查: platform.has('name')
```

**结论**：EventDispatcher 应通过 `Platform.get()` 获取已注册服务实例，而不是每次 `new Service()`。

### 2.5 WorkflowEngine 已是状态机模式

`workflow-engine.js` 已实现完整的状态机工作流引擎（v3.0），支持：
- `states` 定义（initial → processing → complete/failed）
- `actions` 动作类型（ai_call / module_call / variable_set / event_emit / function_call）
- 触发器（variable_changed / engine_event / timer）
- 去重、重试、超时

**结论**：不需要重写 WorkflowEngine，只需注册新的工作流定义即可。

---

## 三、架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户交互层                                   │
│  用户在 ST 正常对话 → 小手机自动响应（无感）                          │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         监控层                                       │
│  ContextMonitor                                                      │
│  ├── 监听 ST generation:ended 事件                                   │
│  ├── 冷却控制（10秒）                                                │
│  └── 触发 DirectorService.trigger()                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         引擎层                                       │
│  DirectorService（改造）                                             │
│  ├── ContextAssembler（替代 _collectContext，预算 2000 tokens）      │
│  │   ├── L3 世界约束（WorldFactsData）                              │
│  │   ├── 角色元数据（CharacterMetadata）                            │
│  │   ├── L2 事件时间线（StoryEventsData）                           │
│  │   └── 当前场景（WorldFactsData.location）                        │
│  │                                                                   │
│  ├── AI 分析 → 生成事件列表                                          │
│  │                                                                   │
│  └── EventDispatcher（通过 Platform.get 获取服务）                   │
│      ├── message → Platform.get('messageService')                   │
│      ├── quest → Platform.get('questService')                       │
│      ├── npc → Platform.get('npcGeneratorService')                  │
│      ├── news → Platform.get('weiboService')                        │
│      └── status → Platform.get('statusService')                     │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         工作流层                                     │
│  WorkflowEngine（已有，注册新工作流即可）                             │
│  ├── wf.watch_live（观看直播）                                       │
│  ├── wf.npc_encounter（NPC 偶遇）                                    │
│  └── wf.custom（自定义工作流）                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Service 层                                   │
│  【已有】                                                            │
│  ├── MessageService（消息）                                          │
│  ├── QuestService（任务）                                            │
│  ├── FriendService（好友）                                           │
│  ├── WeiboService（微博/世界资讯）                                    │
│  ├── StatusService（状态）                                           │
│  ├── LiveService（直播）                                             │
│  ├── WorldBookSyncService（同步到ST）                                │
│  【新增】                                                            │
│  ├── NPCGeneratorService（NPC 生成）                                 │
│  └── ContextManagerService（上下文管理）                             │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Schema 层                                    │
│  【新增】                                                            │
│  ├── WorldFactsData（世界约束 + 地点，合并 LocationData）            │
│  ├── CharacterMetadata（角色元数据）                                 │
│  └── StoryEventsData（事件时间线）                                   │
│  【扩展】                                                            │
│  └── FriendsData（增加群组管理方法）                                  │
│  【已有不变】                                                        │
│  ├── MessagesData / TaskData / StatusData / WeiboData / ...         │
│  └── DirectorData                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         存储层                                       │
│  DataStore → {charId}:{domain}:{key}                                │
│  └── 角色卡隔离，换卡即换数据                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         同步层                                       │
│  WorldBookSyncService                                                │
│  └── 关键事件 → ST 世界书 → 小白X向量库（可选）                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 与 v1.0 方案的关键变更

| 变更项 | v1.0 方案 | v2.0 修订 | 修订原因 |
|--------|----------|----------|---------|
| GroupData | 新建独立 Schema | **取消**，扩展 FriendsData | FriendsData 已有 `isGroup`/`members` 字段，功能重叠 |
| LocationData | 新建独立 Schema | **合并**到 WorldFactsData | world 领域重叠，地点数据作为世界约束的子集 |
| EventDispatcher | 每次 `new Service()` | 通过 `Platform.get()` 获取 | 避免重复实例化，利用已有 ServiceContainer |
| WorkflowEngine | 重写状态机 | **不重写**，注册新工作流 | 已有 v3.0 状态机引擎，功能完备 |
| DirectorService._dispatchEvent | 保留原逻辑 | **重写**，改用 Schema | 原代码直接 `Platform.setData` 违反铁则一 |
| DirectorService._collectContext | 保留原逻辑 | **替换**为 ContextAssembler | 原代码全量抓取导致超时 |

---

## 四、功能模块详解

### 4.1 新增 Schema

#### 4.1.1 WorldFactsData（世界约束 + 地点）

**用途**: 存储不可更改的世界事实 + 地点信息。合并了原 LocationData 的职责。

**存储**: `{charId}:world:facts`

**数据结构**:
```javascript
{
  // 世界约束（KV 对）
  facts: {
    "主角.状态": "存活",
    "主角.位置": "北京",
    "苏晚晴.关系": "好友",
    "苏晚晴.职业": "主播",
    "世界.时间": "2024年春",
    "世界.背景": "现代都市"
  },
  // 地点列表（原 LocationData 合并）
  locations: [
    {
      id: "loc_001",
      name: "市中心",
      type: "district",
      description: "繁华的商业区",
      npcs: ["苏晚晴", "服务员小美"],
      subLocations: ["loc_002"]
    }
  ],
  // 当前位置
  currentLocation: "loc_002",
  // 已访问地点
  visitedLocations: ["loc_001", "loc_002"]
}
```

**API**:
```javascript
class WorldFactsData {
  // === 世界约束 ===
  async getFact(key)              // 获取单个事实
  async setFact(key, value)       // 设置事实
  async getAllFacts()             // 获取所有事实
  async deleteFact(key)           // 删除事实
  async importFacts(obj)          // 批量导入
  async exportFacts()             // 导出为对象

  // === 地点管理（原 LocationData 合并） ===
  async getCurrentLocation()      // 获取当前位置
  async setCurrentLocation(locId) // 设置当前位置
  async getLocation(locId)        // 获取地点详情
  async addLocation(location)     // 添加地点
  async getNPCsAtLocation(locId)  // 获取地点内NPC
  async getVisitedLocations()     // 获取已访问地点
}
```

**文件**: `SCHEMA/world-facts-data.js`

#### 4.1.2 CharacterMetadata（角色元数据）

**用途**: 缓存角色卡信息，避免每次从 ST 上下文抓取。

**存储**: `{charId}:character:meta`

**数据结构**:
```javascript
{
  id: "char_001",
  name: "苏晚晴",
  description: "一位温柔善良的主播...",
  personality: "温柔、善良、有些害羞",
  scenario: "现代都市背景...",
  firstMes: "你好，我是苏晚晴...",
  avatar: "avatar_url",
  tags: ["主播", "温柔", "都市"],
  createdAt: 1716000000000,
  updatedAt: 1716000000000
}
```

**API**:
```javascript
class CharacterMetadata {
  async get(charId)              // 获取角色元数据
  async set(charId, data)        // 设置元数据
  async update(charId, partial)  // 部分更新
  async getTags(charId)          // 获取标签
  async addTag(charId, tag)      // 添加标签
}
```

**文件**: `SCHEMA/character-metadata.js`

#### 4.1.3 StoryEventsData（事件时间线）

**用途**: 结构化存储事件因果链，替代碎片化聊天抓取。

**存储**: `{charId}:story:events`

**数据结构**:
```javascript
[
  {
    id: "evt_001",
    time: 1716000000000,
    type: "quest_complete",
    summary: "完成了苏晚晴的直播任务",
    actors: ["苏晚晴", "主角"],
    location: "直播间",
    impact: "好感度+10，获得粉丝徽章",
    relatedEvents: ["evt_000"]
  }
]
```

**API**:
```javascript
class StoryEventsData {
  async add(event)                       // 添加事件
  async getRecent(count)                 // 获取最近N条
  async getByType(type)                  // 按类型筛选
  async getByActor(actorName)            // 按参与者筛选
  async linkEvents(eventId1, eventId2)   // 建立关联
  async getTimeline(start?, end?)        // 获取时间线
}
```

**文件**: `SCHEMA/story-events-data.js`

### 4.2 扩展 FriendsData（群组能力）

**不新建 GroupData**，直接在 `friends-data.js` 中增加群组管理方法。

**已有基础**:
- `add()` 已支持 `isGroup` 和 `members` 字段
- 好友列表中群组和单人好友共存

**新增方法**:
```javascript
class FriendsData {
  // ... 已有方法保持不变 ...

  // === 群组管理（新增） ===

  /**
   * 创建群组
   * @param {Object} group - { id, name, members: [{charId, name}] }
   * @returns {Promise<boolean>}
   */
  async createGroup(group) {
    return await this.add({
      id: group.id || this._generateGroupId(),
      name: group.name,
      avatar: group.avatar || null,
      isGroup: true,
      members: group.members || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      unread: 0,
      lastMessage: '',
      lastTime: '',
    });
  }

  /**
   * 添加群组成员
   * @param {string} groupId
   * @param {Object} member - { charId, name }
   */
  async addGroupMember(groupId, member) {
    const group = await this.getById(groupId);
    if (!group || !group.isGroup) return false;

    if (group.members.some(m => m.charId === member.charId)) return false;

    group.members.push({ ...member, joinedAt: Date.now() });
    return await this.update(groupId, { members: group.members });
  }

  /**
   * 移除群组成员
   */
  async removeGroupMember(groupId, charId) {
    const group = await this.getById(groupId);
    if (!group || !group.isGroup) return false;

    group.members = group.members.filter(m => m.charId !== charId);
    return await this.update(groupId, { members: group.members });
  }

  /**
   * 获取群组上下文（用于消息层构建 prompt）
   * @returns {Promise<Object|null>}
   */
  async getGroupContext(groupId) {
    const group = await this.getById(groupId);
    if (!group || !group.isGroup) return null;

    return {
      groupId: group.id,
      groupName: group.name,
      members: group.members.map(m => m.name).join('、'),
      memberCount: group.members.length,
    };
  }

  /**
   * 获取角色所在的所有群组
   */
  async getGroupsByCharId(charId) {
    const list = await this.getList();
    return list.filter(f =>
      f.isGroup && f.members && f.members.some(m => m.charId === charId)
    );
  }

  _generateGroupId() {
    return 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }
}
```

**文件**: `SCHEMA/friends-data.js`（修改已有文件）

### 4.3 引擎层改造

#### 4.3.1 ContextAssembler（新增 CORE）

**用途**: 替代 `DirectorService._collectContext()`，按预算装配上下文。

**预算分配**:
```
总预算: 2000 tokens（约 4000 中文字符）
├── L3 世界约束: 500 tokens（最高优先，从 WorldFactsData 读取）
├── 角色元数据: 300 tokens（从 CharacterMetadata 读取，缓存）
├── L2 事件时间线: 800 tokens（从 StoryEventsData 读取最近事件）
└── 当前场景: 400 tokens（从 WorldFactsData 读取当前位置）
```

**实现**:
```javascript
// CORE/context-assembler.js
class ContextAssembler {
  constructor(platform) {
    this._platform = platform;
    this._budget = { worldFacts: 500, characterMeta: 300, storyEvents: 800, currentScene: 400 };
    // 缓存（避免重复读取）
    this._cache = { facts: null, factsCharId: null, meta: null, metaCharId: null };
  }

  /**
   * 装配上下文
   * @param {Object} options - { charId, forceRefresh }
   * @returns {Promise<string>} 格式化后的上下文文本
   */
  async assemble(options = {}) {
    const { charId, forceRefresh = false } = options;
    const parts = [];

    // 1. 世界约束（最高优先，缓存）
    const facts = await this._getWorldFacts(charId, forceRefresh);
    if (facts && Object.keys(facts).length > 0) {
      parts.push(this._formatSection('定了的事', Object.entries(facts)
        .map(([k, v]) => `- ${k}: ${v}`).join('\n')));
    }

    // 2. 角色元数据（缓存）
    const meta = await this._getCharacterMeta(charId, forceRefresh);
    if (meta) {
      const metaText = [
        meta.name && `- 名称: ${meta.name}`,
        meta.personality && `- 性格: ${meta.personality}`,
        meta.scenario && `- 场景: ${meta.scenario}`,
      ].filter(Boolean).join('\n');
      if (metaText) parts.push(this._formatSection('角色信息', metaText));
    }

    // 3. 事件时间线（最近事件）
    const StoryEvents = window.PhoneData?.StoryEvents;
    if (StoryEvents) {
      const eventsData = new StoryEvents(this._platform);
      const recentEvents = await eventsData.getRecent(5);
      if (recentEvents && recentEvents.length > 0) {
        const eventsText = recentEvents
          .map(e => `- ${e.summary} (${this._formatTime(e.time)})`)
          .join('\n');
        parts.push(this._formatSection('印象深的事', eventsText));
      }
    }

    // 4. 当前场景
    const WorldFacts = window.PhoneData?.WorldFacts;
    if (WorldFacts) {
      const worldData = new WorldFacts(this._platform);
      const currentLoc = await worldData.getCurrentLocation();
      if (currentLoc) {
        const locDetail = await worldData.getLocation(currentLoc);
        if (locDetail) {
          const npcs = await worldData.getNPCsAtLocation(currentLoc);
          const sceneText = [
            `- 地点: ${locDetail.name}`,
            locDetail.description && `- 描述: ${locDetail.description}`,
            npcs && npcs.length > 0 && `- 在场人物: ${npcs.join('、')}`,
          ].filter(Boolean).join('\n');
          parts.push(this._formatSection('当前场景', sceneText));
        }
      }
    }

    return parts.join('\n\n');
  }

  async _getWorldFacts(charId, forceRefresh) {
    if (!forceRefresh && this._cache.factsCharId === charId && this._cache.facts) {
      return this._cache.facts;
    }
    const WorldFacts = window.PhoneData?.WorldFacts;
    if (!WorldFacts) return null;
    const data = new WorldFacts(this._platform);
    const facts = await data.getAllFacts();
    this._cache = { ...this._cache, facts, factsCharId: charId };
    return facts;
  }

  async _getCharacterMeta(charId, forceRefresh) {
    if (!forceRefresh && this._cache.metaCharId === charId && this._cache.meta) {
      return this._cache.meta;
    }
    const CharacterMetadata = window.PhoneData?.CharacterMetadata;
    if (!CharacterMetadata) return null;
    const data = new CharacterMetadata(this._platform);
    const meta = await data.get(charId);
    this._cache = { ...this._cache, meta, metaCharId: charId };
    return meta;
  }

  _formatSection(title, content) {
    return `[${title}]\n${content}`;
  }

  _formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this._cache = { facts: null, factsCharId: null, meta: null, metaCharId: null };
  }
}
```

**文件**: `CORE/context-assembler.js`

#### 4.3.2 EventDispatcher（新增 CORE）

**用途**: 替代 `DirectorService._dispatchEvent()`，通过 `Platform.get()` 获取服务实例。

**关键设计**: 不 `new Service()`，从 ServiceContainer 获取已注册实例。

```javascript
// CORE/event-dispatcher.js
class EventDispatcher {
  constructor(platform) {
    this._platform = platform;
    this._handlers = new Map();
    this._registerDefaultHandlers();
  }

  _registerDefaultHandlers() {
    // 消息事件 → 通过 Platform.get 获取 messageService
    this.register('message', async (event) => {
      const svc = this._platform.get('messageService');
      if (!svc) { console.warn('[EventDispatcher] messageService 未注册'); return null; }
      return await svc.sendText(event.to || event.fromId, event.content);
    });

    // 任务事件 → 通过 Platform.get 获取 questService
    this.register('quest', async (event) => {
      const svc = this._platform.get('questService');
      if (!svc) { console.warn('[EventDispatcher] questService 未注册'); return null; }
      return await svc.createAndAddTask(event);
    });

    // NPC 生成事件 → 通过 Platform.get 获取 npcGeneratorService
    this.register('npc', async (event) => {
      const svc = this._platform.get('npcGeneratorService');
      if (!svc) { console.warn('[EventDispatcher] npcGeneratorService 未注册'); return null; }
      return await svc.generate(event.npcContext);
    });

    // 状态变更事件 → 通过 Platform.get 获取 statusService
    this.register('status', async (event) => {
      const svc = this._platform.get('statusService');
      if (!svc) { console.warn('[EventDispatcher] statusService 未注册'); return null; }
      return await svc.updateField(event.target, event.change);
    });

    // 朋友圈事件 → 通过 Schema 写入
    this.register('moment', async (event) => {
      const FriendsCircle = window.PhoneData?.FriendsCircle;
      if (!FriendsCircle) return null;
      const data = new FriendsCircle(this._platform);
      return await data.publish({
        author: event.author,
        content: event.content,
        source: 'director',
      });
    });

    // 直播事件 → 通过 Platform.get 获取 liveService
    this.register('live', async (event) => {
      const svc = this._platform.get('liveService');
      if (!svc) { console.warn('[EventDispatcher] liveService 未注册'); return null; }
      return await svc.handleDirectorEvent(event);
    });
  }

  register(eventType, handler) {
    this._handlers.set(eventType, handler);
  }

  async dispatch(event) {
    const handler = this._handlers.get(event.type);
    if (!handler) {
      console.warn('[EventDispatcher] 未知事件类型:', event.type);
      return null;
    }
    try {
      return await handler(event);
    } catch (e) {
      // [铁则九] 错误降级
      console.warn('[EventDispatcher] 事件处理失败:', event.type, e);
      return null;
    }
  }

  async dispatchAll(events) {
    const results = [];
    for (const event of events) {
      results.push({ event, result: await this.dispatch(event) });
    }
    return results;
  }
}
```

**文件**: `CORE/event-dispatcher.js`

#### 4.3.3 DirectorService 具体改造逻辑

**改造文件**: `SERVICES/director-service.js`

**改造点 1: 构造函数新增依赖**

```javascript
constructor(platform) {
  this._platform = platform || window.Platform;
  this._directorData = new (window.PhoneData?.Director || function () {})(this._platform);
  this._apiConfig = new (window.PhoneData?.ApiConfig || function () {})(this._platform);
  this._friendsData = new (window.PhoneData?.Friends || function () {})(this._platform);

  // [新增] ContextAssembler + EventDispatcher
  this._contextAssembler = null;  // 延迟初始化，等待 SCHEMAS_READY
  this._eventDispatcher = null;   // 延迟初始化，等待 SERVICES_READY

  // 状态（保持不变）
  this._enabled = false;
  this._running = false;
  this._lastRun = 0;
  this._cooldown = 10000;
  this._lastPlanHash = '';
}
```

**改造点 2: init() 初始化新组件**

```javascript
async init() {
  console.log('[DirectorService] 初始化...');

  const status = await this._directorData.getStatus();
  this._enabled = status && status.enabled !== false;
  this._cooldown = (status && status.cooldown) || 10000;

  // [新增] 初始化 ContextAssembler
  if (window.ContextAssembler) {
    this._contextAssembler = new window.ContextAssembler(this._platform);
  }

  // [新增] 初始化 EventDispatcher
  if (window.EventDispatcher) {
    this._eventDispatcher = new window.EventDispatcher(this._platform);
  }

  this._setupEventListeners();
  console.log('[DirectorService] 初始化完成, 启用状态:', this._enabled,
    ', ContextAssembler:', !!this._contextAssembler,
    ', EventDispatcher:', !!this._eventDispatcher);
}
```

**改造点 3: trigger() 使用 ContextAssembler**

```javascript
async trigger() {
  // ... 冷却/启用/并发/API检查保持不变 ...

  try {
    // [改造] 使用 ContextAssembler 替代 _collectContext
    let context;
    if (this._contextAssembler) {
      const charId = this._platform?.context?.getCurrentCharId?.() || 'default';
      const assembledText = await this._contextAssembler.assemble({ charId });
      context = { assembledContext: assembledText };
    } else {
      // 降级：使用旧方法
      context = await this._collectContext();
    }

    const llmGateway = new window.LLMGateway(this._platform);
    const result = await llmGateway.generate('world-director', context);

    if (result) {
      const plan = this._parseResult(result);

      if (plan && plan.events && plan.events.length > 0) {
        await this._directorData.setPlan(plan);

        // [改造] 使用 EventDispatcher 替代 _dispatchEvents
        if (this._eventDispatcher) {
          await this._eventDispatcher.dispatchAll(plan.events);
        } else {
          // 降级：使用旧方法
          await this._dispatchEvents(plan.events);
        }

        // [新增] 记录事件到 StoryEventsData
        await this._recordEventsToTimeline(plan.events);

        await this._directorData.addHistory({
          events: plan.events,
          context: context,
          success: true,
        });

        this._emitEvent('director:plan', plan);
        console.log('[DirectorService] 生成计划:', plan.events.length, '个事件');
      }

      await this._clearFeedbackVars();
    }

    // 更新状态（保持不变）
    const status = await this._directorData.getStatus();
    await this._directorData.updateStatus({
      lastRun: now,
      runCount: (status.runCount || 0) + 1,
    });

  } catch (error) {
    // 错误处理保持不变（铁则九）
    console.error('[DirectorService] 执行失败:', error);
    // ...
  } finally {
    this._running = false;
  }
}
```

**改造点 4: 新增 _recordEventsToTimeline**

```javascript
/**
 * 将事件记录到 StoryEventsData 时间线
 * [铁则一] 通过 Schema 写入
 */
async _recordEventsToTimeline(events) {
  const StoryEvents = window.PhoneData?.StoryEvents;
  if (!StoryEvents) return;

  const eventsData = new StoryEvents(this._platform);

  for (const event of events) {
    try {
      await eventsData.add({
        id: event.id || this._generateId(),
        time: Date.now(),
        type: event.type,
        summary: this._summarizeEvent(event),
        actors: this._extractActors(event),
        location: event.location || null,
        impact: event.impact || null,
      });
    } catch (e) {
      console.warn('[DirectorService] 记录事件失败:', event.type, e);
    }
  }
}

_summarizeEvent(event) {
  switch (event.type) {
    case 'message': return `${event.from} 发来消息: ${event.content?.substring(0, 50)}`;
    case 'quest': return `新任务: ${event.name}`;
    case 'friend': return `新好友请求: ${event.name}`;
    case 'status': return `状态变更: ${event.target} → ${event.change}`;
    case 'moment': return `${event.author} 发布了朋友圈`;
    default: return `事件: ${event.type}`;
  }
}

_extractActors(event) {
  const actors = [];
  if (event.from) actors.push(event.from);
  if (event.name && event.type === 'friend') actors.push(event.name);
  return actors;
}
```

**改造点 5: 保留旧方法作为降级**

`_collectContext()` 和 `_dispatchEvent()` 方法**保留不删除**，作为 `ContextAssembler` / `EventDispatcher` 不可用时的降级方案。但新增注释标记为 deprecated。

---

### 4.4 新增 Service

#### 4.4.1 NPCGeneratorService

**文件**: `SERVICES/npc-generator-service.js`

**全局挂载**: `window.PhoneServices.NPCGenerator`

```javascript
class NPCGeneratorService {
  constructor(platform) {
    this._platform = platform || window.Platform;
    this._friendsData = new (window.PhoneData?.Friends)(this._platform);
    this._storyEvents = new (window.PhoneData?.StoryEvents || function () {})(this._platform);
  }

  /**
   * 生成 NPC 并添加到通讯录
   * [铁则十二] Service 层是唯一数据加工厂
   * @param {Object} context - { name, role, description }
   * @returns {Promise<Object>} npcData
   */
  async generate(context) {
    const { name, role, description } = context;

    // 调用 AI 生成人设
    const llmGateway = new window.LLMGateway(this._platform);
    const npcProfile = await llmGateway.generate('npc-generator', {
      name,
      role,
      description,
      existingNPCs: await this._getExistingNPCNames(),
    });

    if (!npcProfile) {
      console.warn('[NPCGeneratorService] AI 生成失败，使用默认人设');
      return null;
    }

    // [铁则一] 通过 Schema 写入
    const npcData = {
      id: 'npc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8),
      name: npcProfile.name || name,
      avatar: npcProfile.avatar || null,
      remark: role || '',
      personality: npcProfile.personality || '',
      source: 'auto-generated',
    };

    await this._friendsData.add(npcData);

    // 记录事件到时间线
    try {
      await this._storyEvents.add({
        id: 'evt_' + Date.now().toString(36),
        time: Date.now(),
        type: 'npc-generated',
        summary: `新角色「${npcData.name}」加入了通讯录`,
        actors: [npcData.name],
      });
    } catch (e) {
      console.warn('[NPCGeneratorService] 记录事件失败:', e);
    }

    return npcData;
  }

  async _getExistingNPCNames() {
    const list = await this._friendsData.getList();
    return list.map(f => f.name);
  }
}
```

#### 4.4.2 ContextManagerService

**文件**: `SERVICES/context-manager-service.js`

**全局挂载**: `window.PhoneServices.ContextManager`

```javascript
class ContextManagerService {
  constructor(platform) {
    this._platform = platform || window.Platform;
  }

  /**
   * 构建消息上下文（支持群组）
   * [铁则十二] Service 层是唯一数据加工厂
   * @param {Object} options - { charId, groupId }
   * @returns {Promise<Object>}
   */
  async buildMessageContext(options = {}) {
    const { charId, groupId } = options;
    const context = {};

    if (groupId) {
      // 群组上下文
      const Friends = window.PhoneData?.Friends;
      if (Friends) {
        const friendsData = new Friends(this._platform);
        context.groupInfo = await friendsData.getGroupContext(groupId);
      }
    }

    return context;
  }

  /**
   * 刷新角色元数据缓存
   */
  async refreshCharacterMeta(charId) {
    const CharacterMetadata = window.PhoneData?.CharacterMetadata;
    if (!CharacterMetadata) return;

    // [铁则六] 通过适配器获取角色信息
    try {
      const charInfo = await this._platform?.adapter?.getCharacterInfo?.();
      if (charInfo) {
        const meta = new CharacterMetadata(this._platform);
        await meta.set(charId, {
          ...charInfo,
          updatedAt: Date.now(),
        });
      }
    } catch (e) {
      console.warn('[ContextManagerService] 刷新角色元数据失败:', e);
    }
  }
}
```

---

### 4.5 WorldBookSyncService 增强

**改造文件**: `SERVICES/worldbook-sync-service.js`

**新增**: 事件同步到 ST 世界书的能力。

```javascript
/**
 * 同步事件到 ST 世界书
 * [铁则六] 通过适配器操作
 */
async syncEvent(event) {
  if (!this._platform?.adapter?.appendWorldInfo) {
    console.warn('[WorldBookSyncService] 适配器不支持世界书写入');
    return false;
  }

  const entry = {
    name: `phone_event_${event.type}_${event.id}`,
    content: `[手机事件] ${event.summary}\n时间: ${new Date(event.time).toLocaleString()}\n参与者: ${(event.actors || []).join(', ')}`,
    keys: this._extractKeywords(event),
    enabled: true,
    constant: false,
  };

  try {
    await this._platform.adapter.appendWorldInfo(entry);
    return true;
  } catch (e) {
    console.warn('[WorldBookSyncService] 同步失败:', e);
    return false;
  }
}

_extractKeywords(event) {
  const keywords = [];
  if (event.actors) keywords.push(...event.actors);
  if (event.type) keywords.push(event.type);
  if (event.location) keywords.push(event.location);
  return keywords.join(', ');
}
```

---

### 4.6 LLMGateway 新增角色

**改造文件**: `CORE/llm-gateway.js`

在 `DEFAULT_ROLES` 或 `llm_roles` prompt 中新增：

```javascript
'npc-generator': {
  name: 'NPC生成器',
  description: '根据剧情上下文生成完整NPC人设',
  model: '',
  temperature: 0.7,
  maxTokens: 300,
  timeout: 15000,
  systemPrompt: `你是一个角色生成器。根据以下信息生成一个完整的NPC人设：

角色名: {{name}}
角色定位: {{role}}
已知描述: {{description}}
已存在角色: {{existingNPCs}}

请生成JSON格式的人设：
{
  "name": "角色名",
  "personality": "性格特点（50字以内）",
  "background": "背景故事（100字以内）",
  "avatar": "头像描述"
}

注意：不要与已存在角色重名。`,
  contextSources: ['name', 'role', 'description', 'existingNPCs'],
  outputFormat: 'json'
}
```

---

## 五、功能映射表

### 5.1 小白X → 小手机映射

| 小白X 功能 | 小手机实现 | 数据存储 | 状态 |
|-----------|-----------|---------|------|
| 大世界生成 | WorldFactsData + CharacterMetadata | `{charId}:world:facts` | **新增 Schema** |
| 世界地图 | WorldFactsData.locations | `{charId}:world:facts` | **合并到 WorldFacts** |
| 微信通讯录 | FriendsData | `{charId}:friends:list` | ✅ 已有 |
| SMS 私聊 | MessagesData | `{charId}:messages:all` | ✅ 已有 |
| 世界资讯 | WeiboData | `{charId}:weibo:posts` | ✅ 已有 |
| 世界推演 | DirectorService + WorkflowEngine | - | **改造** |
| 局部剧情 | DirectorService + StoryEventsData | `{charId}:story:events` | **新增** |
| NPC 生成 | NPCGeneratorService → FriendsData | `{charId}:friends:list` | **新增 Service** |
| 群组通讯 | FriendsData（扩展群组方法） | `{charId}:friends:list` | **扩展已有** |
| Stage 阶段 | DirectorData | `{charId}:director:plan` | ✅ 已有 |

### 5.2 API 分层

| 层级 | 触发方式 | Service | 说明 |
|------|---------|---------|------|
| 用户层 | 用户主动输入 | MessageService.generateReply() | 用户发送消息 |
| 引擎层 | ST 上下文变化 | DirectorService.trigger() | 管家驱动 |
| 子模块层 | 引擎调用 | 各 Service 方法 | 响应生成 |

---

## 六、施工计划

### Phase 1: 新增 Schema（3 个文件）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 新增 WorldFactsData | `SCHEMA/world-facts-data.js` | 世界约束 + 地点（合并 LocationData） |
| 1.2 新增 CharacterMetadata | `SCHEMA/character-metadata.js` | 角色元数据缓存 |
| 1.3 新增 StoryEventsData | `SCHEMA/story-events-data.js` | 事件时间线 |
| 1.4 更新 index.js | `index.js` | 在阶段 1 加载新 Schema |
| 1.5 更新 API_REFERENCE.md | `API_REFERENCE.md` | 记录新增 API |

### Phase 2: 扩展 FriendsData（1 个文件）

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 增加群组方法 | `SCHEMA/friends-data.js` | createGroup / addGroupMember / getGroupContext 等 |
| 2.2 更新 API_REFERENCE.md | `API_REFERENCE.md` | 记录新增方法 |

### Phase 3: 新增 CORE 组件（2 个文件）

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 新增 ContextAssembler | `CORE/context-assembler.js` | 上下文装配器 |
| 3.2 新增 EventDispatcher | `CORE/event-dispatcher.js` | 事件分发器（Platform.get） |
| 3.3 更新 index.js | `index.js` | 在阶段 1 加载新 CORE 组件 |

### Phase 4: 改造 DirectorService（1 个文件）

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 改造构造函数 | `SERVICES/director-service.js` | 新增 ContextAssembler + EventDispatcher |
| 4.2 改造 trigger() | `SERVICES/director-service.js` | 使用 ContextAssembler + EventDispatcher |
| 4.3 新增 _recordEventsToTimeline | `SERVICES/director-service.js` | 记录事件到 StoryEventsData |
| 4.4 保留旧方法作降级 | `SERVICES/director-service.js` | 标记 deprecated |

### Phase 5: 新增 Service（2 个文件）

| 任务 | 文件 | 说明 |
|------|------|------|
| 5.1 新增 NPCGeneratorService | `SERVICES/npc-generator-service.js` | NPC 生成 |
| 5.2 新增 ContextManagerService | `SERVICES/context-manager-service.js` | 上下文管理 |
| 5.3 更新 index.js | `index.js` | 在阶段 1.5 加载新 Service + 注册到 Platform |
| 5.4 更新 API_REFERENCE.md | `API_REFERENCE.md` | 记录新增 Service API |

### Phase 6: LLMGateway + WorldBookSync 增强（2 个文件）

| 任务 | 文件 | 说明 |
|------|------|------|
| 6.1 新增 npc-generator 角色 | `CORE/llm-gateway.js` | NPC 生成 prompt |
| 6.2 增强 WorldBookSyncService | `SERVICES/worldbook-sync-service.js` | 事件同步到 ST 世界书 |

### Phase 7: 集成测试

| 任务 | 说明 |
|------|------|
| 7.1 Schema API 验证 | `Object.getOwnPropertyNames()` 验证所有新增方法 |
| 7.2 ContextAssembler 测试 | 验证输出 ≤ 2000 tokens |
| 7.3 EventDispatcher 测试 | 验证通过 Platform.get 获取服务 |
| 7.4 DirectorService 测试 | 验证新旧逻辑切换 |
| 7.5 群组功能测试 | 验证 FriendsData 群组方法 |

---

## 七、API 变更记录

### 新增 Schema API

#### WorldFactsData (`window.PhoneData.WorldFacts`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `getFact` | `(key: string) => Promise<string\|null>` | 获取单个事实 |
| `setFact` | `(key: string, value: string) => Promise<boolean>` | 设置事实 |
| `getAllFacts` | `() => Promise<Object>` | 获取所有事实 |
| `deleteFact` | `(key: string) => Promise<boolean>` | 删除事实 |
| `importFacts` | `(obj: Object) => Promise<boolean>` | 批量导入 |
| `exportFacts` | `() => Promise<Object>` | 导出为对象 |
| `getCurrentLocation` | `() => Promise<string\|null>` | 获取当前位置 |
| `setCurrentLocation` | `(locId: string) => Promise<boolean>` | 设置当前位置 |
| `getLocation` | `(locId: string) => Promise<Object\|null>` | 获取地点详情 |
| `addLocation` | `(location: Object) => Promise<boolean>` | 添加地点 |
| `getNPCsAtLocation` | `(locId: string) => Promise<Array>` | 获取地点内NPC |
| `getVisitedLocations` | `() => Promise<Array>` | 获取已访问地点 |

#### CharacterMetadata (`window.PhoneData.CharacterMetadata`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `(charId: string) => Promise<Object\|null>` | 获取角色元数据 |
| `set` | `(charId: string, data: Object) => Promise<boolean>` | 设置元数据 |
| `update` | `(charId: string, partial: Object) => Promise<boolean>` | 部分更新 |
| `getTags` | `(charId: string) => Promise<Array>` | 获取标签 |
| `addTag` | `(charId: string, tag: string) => Promise<boolean>` | 添加标签 |

#### StoryEventsData (`window.PhoneData.StoryEvents`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `add` | `(event: Object) => Promise<boolean>` | 添加事件 |
| `getRecent` | `(count: number) => Promise<Array>` | 获取最近N条 |
| `getByType` | `(type: string) => Promise<Array>` | 按类型筛选 |
| `getByActor` | `(actorName: string) => Promise<Array>` | 按参与者筛选 |
| `linkEvents` | `(id1: string, id2: string) => Promise<boolean>` | 建立关联 |
| `getTimeline` | `(start?: number, end?: number) => Promise<Array>` | 获取时间线 |

### 扩展 FriendsData API

| 方法 | 签名 | 说明 |
|------|------|------|
| `createGroup` | `(group: Object) => Promise<boolean>` | 创建群组 |
| `addGroupMember` | `(groupId: string, member: Object) => Promise<boolean>` | 添加群组成员 |
| `removeGroupMember` | `(groupId: string, charId: string) => Promise<boolean>` | 移除群组成员 |
| `getGroupContext` | `(groupId: string) => Promise<Object\|null>` | 获取群组上下文 |
| `getGroupsByCharId` | `(charId: string) => Promise<Array>` | 获取角色所在群组 |

### 新增 Service API

#### NPCGeneratorService (`window.PhoneServices.NPCGenerator`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: { name, role, description }) => Promise<Object\|null>` | 生成NPC |

#### ContextManagerService (`window.PhoneServices.ContextManager`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `buildMessageContext` | `(options: { charId?, groupId? }) => Promise<Object>` | 构建消息上下文 |
| `refreshCharacterMeta` | `(charId: string) => Promise<void>` | 刷新角色元数据缓存 |

### 新增 CORE API

#### ContextAssembler (`window.ContextAssembler`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `assemble` | `(options: { charId?, forceRefresh? }) => Promise<string>` | 装配上下文 |
| `clearCache` | `() => void` | 清除缓存 |

#### EventDispatcher (`window.EventDispatcher`)

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `(eventType: string, handler: Function) => void` | 注册事件处理器 |
| `dispatch` | `(event: Object) => Promise<any>` | 分发单个事件 |
| `dispatchAll` | `(events: Array) => Promise<Array>` | 批量分发事件 |

---

## 八、验收标准

### 8.1 功能验收

| 功能 | 验收标准 |
|------|---------|
| 上下文预算控制 | ContextAssembler 输出 ≤ 2000 tokens |
| 自动化触发 | ST 发送消息后 10 秒内管家自动分析 |
| NPC 生成 | 剧情出现新角色时自动生成 NPC 并添加到通讯录 |
| 群组创建 | 可将多个 ST 角色卡拉入群组，群组消息正常 |
| 事件时间线 | 每次管家触发后事件记录到 StoryEventsData |
| 数据隔离 | 不同角色卡数据完全隔离 |
| 降级兼容 | ContextAssembler/EventDispatcher 不可用时降级到旧逻辑 |

### 8.2 铁则验收

| 铁则 | 验收方式 |
|------|---------|
| 铁则一 | DirectorService._dispatchEvent 改为通过 Schema 写入 |
| 铁则三 | 新增文件明确属于 Service/CORE/Schema 层 |
| 铁则六 | ST 操作通过 adapter，无 `window.SillyTavern` 判断 |
| 铁则八 | ContextAssembler 缓存不等于双写，是只读缓存 |
| 铁则九 | 所有异步操作有 try/catch + console.warn |
| 铁则十二 | EventDispatcher 通过 Service 方法分发，不直接写数据 |
| 铁则十三 | 所有数据键使用 `{charId}:{domain}:{key}` |

---

## 九、风险与降级

| 风险 | 影响 | 降级方案 |
|------|------|---------|
| ContextAssembler 不可用 | 上下文装配失败 | 降级到 `_collectContext()` 旧方法 |
| EventDispatcher 不可用 | 事件分发失败 | 降级到 `_dispatchEvent()` 旧方法 |
| AI 调用超时 | 管家分析失败 | 返回空事件列表，静默跳过 |
| API 未配置 | 无法调用 AI | 静默跳过，不阻断主流程 |
| WorldFactsData 为空 | 无世界约束 | ContextAssembler 跳过该区块 |
| StoryEventsData 为空 | 无事件时间线 | ContextAssembler 跳过该区块 |

---

## 十、文件清单

**新增文件（7 个）**:
```
SCHEMA/world-facts-data.js          # 世界约束 + 地点
SCHEMA/character-metadata.js        # 角色元数据
SCHEMA/story-events-data.js         # 事件时间线
CORE/context-assembler.js           # 上下文装配器
CORE/event-dispatcher.js            # 事件分发器
SERVICES/npc-generator-service.js   # NPC 生成服务
SERVICES/context-manager-service.js # 上下文管理服务
```

**修改文件（5 个）**:
```
SCHEMA/friends-data.js              # 增加群组方法
SERVICES/director-service.js        # 集成 Assembler + Dispatcher
CORE/llm-gateway.js                 # 新增 npc-generator 角色
SERVICES/worldbook-sync-service.js  # 增强同步能力
index.js                            # 加载新文件 + 注册服务
```

**文档更新（1 个）**:
```
API_REFERENCE.md                    # 记录所有新增/变更 API
```

---

**文档结束**

> 本施工方案严格遵守外置手机 4.0 铁则体系。v2.0 修订合并了重叠 Schema、EventDispatcher 改用 ServiceContainer、DirectorService 补充了具体改造逻辑。
