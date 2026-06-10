# 更新日志 (CHANGELOG)

## v4.31.0-fix-v14 (2026-05-31)

### 架构重构：NPC 数据源合并

**问题背景**：
- `NPCData` 和 `FriendsData` 存在数据源分裂问题
- `DirectorServiceV2` 从 `NPCData` 读取 NPC，但 `NPCGeneratorService` 写入 `FriendsData`
- 导致"无法获取NPC信息，跳过任务生成"等 BUG

**解决方案**：
- 将 NPC 数据统一存储在 `FriendsData` 中
- 扩展 `FriendsData` 支持 NPC 专属方法
- 标记 `NPCData` 为废弃（@deprecated）

---

### 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `SCHEMA/friends-data.js` | 扩展 | 新增 NPC 专属方法（getNPCs, addNPC, updateRelationship 等） |
| `SERVICES/director-service-v2.js` | 修改 | 改用 `_friendsData` 获取 NPC |
| `SERVICES/npc-social-service.js` | 修改 | 优先从 `FriendsData` 获取 NPC |
| `SERVICES/quest-service.js` | 修改 | 改用 `_friendsData` |
| `SCHEMA/npc-data.js` | 标记废弃 | 添加 @deprecated 注释和迁移说明 |

---

### FriendsData 新增方法

| 方法 | 说明 |
|------|------|
| `getNPCs()` | 获取 NPC 列表（过滤 source=world-npc/auto-generated） |
| `getNPCById(npcId)` | 获取单个 NPC |
| `addNPC(npcData)` | 添加 NPC（自动设置 source、relationship 等字段） |
| `updateNPC(npcId, updates)` | 更新 NPC 信息 |
| `updateRelationship(npcId, relationship)` | 更新好感度（-100 ~ 100） |
| `getActiveNPCs(limit)` | 获取活跃 NPC（按互动时间排序） |
| `getNPCLevel(npcId)` | 获取好感度等级（-5 ~ +5） |
| `getNPCBehaviorParams(level)` | 获取 NPC 行为参数（回复延迟、概率、价格系数） |

---

### NPC 好感度等级定义

| 等级 | 名称 | relationship 范围 | 行为特征 |
|------|------|------------------|---------|
| -5 | 仇敌 | -100 ~ -80 | 不回复、拒绝交互 |
| -4 | 敌意 | -79 ~ -60 | 冷淡、高价格 |
| -3 | 厌恶 | -59 ~ -40 | 敷衍 |
| -2 | 不满 | -39 ~ -20 | 简短 |
| -1 | 陌生 | -19 ~ 0 | 礼貌疏离 |
| 0 | 中立 | 1 ~ 20 | 标准交互 |
| +1 | 友善 | 21 ~ 40 | 主动问候、折扣 |
| +2 | 亲密 | 41 ~ 60 | 分享秘密、任务加成 |
| +3 | 挚友 | 61 ~ 80 | 隐藏内容解锁 |
| +4 | 知己 | 81 ~ 95 | 独家商品、深度剧情 |
| +5 | 灵魂绑定 | 96 ~ 100 | 终极内容解锁 |

---

### 迁移指南

**旧代码**：
```javascript
const npcData = new window.PhoneData.NPC(platform);
const npcs = await npcData.getAll(charId);
const npc = await npcData.getById(charId, npcId);
await npcData.add(charId, newNpc);
await npcData.update(charId, npcId, { relationship: 50 });
```

**新代码**：
```javascript
const friendsData = new window.PhoneData.Friends(platform);
const npcs = await friendsData.getNPCs();
const npc = await friendsData.getNPCById(npcId);
await friendsData.addNPC(newNpc);
await friendsData.updateRelationship(npcId, 50);
```

---

### 铁则合规

| 铁则 | 合规说明 |
|------|---------|
| 铁则一 | NPC 数据通过 FriendsData Schema 统一读写 |
| 铁则十六 | FriendsData 是唯一实现，无重复定义 |
| 铁则十三 | 键名格式：`friends:list`（全局好友+NPC） |

---

### 后续工作

1. **数据迁移脚本**：将旧 `NPCData` 数据迁移到 `FriendsData`
2. **删除 NPCData**：在下个大版本中移除 `npc-data.js`
3. **好感度系统**：实现完整的 FavorabilityService（参考 GDD）

---

## 历史版本

### v4.31.0-fix-v13 (2026-05-31)
- 修复 DirectorServiceV2 工作流断裂问题
- 修复 _getActiveNPCs 数据源错误
- 提升 _makeDecision 事件生成概率

### v4.31.0-fix-v12 (2026-05-31)
- 修复 NPC 数据源不匹配问题
- DirectorServiceV2 改用 FriendsData 获取 NPC

### v4.31.0-fix-v11 (2026-05-31)
- 修复 _selectQuestNPCs 缺少 await 问题

### v4.31.0-fix-v10 (2026-05-31)
- 修复 trigger() 语法错误（try/catch 结构被截断）

### v4.31.0-fix-v8 (2026-05-31)
- 新增数据约束系统（CONFIG/data-constraints.js）
- 新增数据血缘追踪（CORE/data-lineage.js）
- 修复铁则六违规（llm-gateway.js）
- 新增 isMasterSwitchOn 方法
