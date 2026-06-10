# 外置手机 3.0 - 数据层 API 清单

> 本文档列出所有可用的数据层 API，包括 Platform 层、Schema 层、Service 层和 Module 层。

---

## 目录

1. [Platform 层](#platform-层)
2. [Schema 数据层](#schema-数据层)
3. [Service 业务层](#service-业务层)
4. [Module 模块层](#module-模块层)
5. [工具函数](#工具函数)

---

## Platform 层

### Platform 核心实例

全局访问: `window.Platform`

#### 状态管理

| 方法 | 签名 | 说明 |
|------|------|------|
| `getState` | `(path: string, defaultValue?: any) => any` | 获取状态 |
| `setState` | `(path: string, value: any, options?: object) => void` | 设置状态 |
| `subscribeState` | `(path: string, callback: Function) => Function` | 订阅状态变更 |
| `batchState` | `(updates: object) => void` | 批量设置状态 |

#### 数据存储

| 方法 | 签名 | 说明 |
|------|------|------|
| `data` | `(domain: string, key: string, defaultValue?: any) => Promise<any>` | 异步读取数据 |
| `dataSync` | `(domain: string, key: string, defaultValue?: any) => any` | 同步读取（仅缓存） |
| `setData` | `(domain: string, key: string, value: any, options?: object) => Promise<void>` | 写入数据 |
| `subscribeData` | `(domain: string, key: string, callback: Function) => Function` | 订阅数据变更 |

#### 网络请求

| 方法 | 签名 | 说明 |
|------|------|------|
| `request` | `(url: string, options?: RequestInit & {timeout?: number}) => Promise<Response>` | 统一网络请求 |

**options 说明:**
- `timeout`: 超时时间（毫秒），默认 30000
- 其他标准 fetch options

#### 事件总线

| 方法 | 签名 | 说明 |
|------|------|------|
| `on` | `(event: string, handler: Function) => Function` | 订阅事件 |
| `off` | `(event: string, handler: Function) => void` | 取消订阅 |
| `emit` | `(event: string, data?: any) => void` | 触发事件 |
| `once` | `(event: string) => Promise<any>` | 一次性订阅 |

#### 服务容器

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `(name: string, service: any) => Platform` | 注册服务 |
| `get` | `(name: string) => any` | 获取服务 |
| `has` | `(name: string) => boolean` | 检查服务是否存在 |

#### 等待方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `waitForReady` | `(timeout?: number) => Promise<void>` | 等待平台就绪 |
| `waitForModule` | `(moduleName: string, timeout?: number) => Promise<any>` | 等待模块加载 |

---

## Schema 数据层

全局访问: `window.PhoneData.*`

### ApiConfig - API 配置

```javascript
const apiConfig = new window.PhoneData.ApiConfig(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getMainConfig` | `() => Promise<ApiConfig>` | 获取主配置 |
| `updateMainConfig` | `(config: object) => Promise<boolean>` | 更新主配置 |
| `getModuleConfig` | `(moduleId: string) => Promise<ApiConfig>` | 获取模块配置 |
| `updateModuleConfig` | `(moduleId: string, config: object) => Promise<boolean>` | 更新模块配置 |
| `getPrompt` | `(key: string) => Promise<string>` | 获取提示词 |
| `updatePrompt` | `(key: string, value: string) => Promise<boolean>` | 更新提示词 |
| `addHistory` | `(record: object) => Promise<boolean>` | 添加历史记录 |
| `getHistory` | `(limit?: number) => Promise<Array>` | 获取历史记录 |
| `clearHistory` | `() => Promise<boolean>` | 清空历史 |
| `subscribeMainConfig` | `(callback: Function) => Function` | 订阅主配置变更 |
| `subscribeModuleConfigs` | `(callback: Function) => Function` | 订阅模块配置变更 |

**ApiConfig 对象结构:**
```typescript
{
  provider: string;      // 'openai' | 'anthropic' | 'google' | 'deepseek'
  baseUrl: string;       // API 基础 URL
  apiKey: string;        // API 密钥（已混淆存储）
  model: string;         // 模型名称
  temperature: number;   // 温度参数 0-2
  maxTokens: number;     // 最大 token 数
  timeout: number;       // 超时时间（毫秒）
  enabled: boolean;      // 是否启用
}
```

### Messages - 消息数据

```javascript
const messagesData = new window.PhoneData.Messages(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getAll` | `() => Promise<object>` | 获取所有消息（按好友分组） |
| `getByFriendId` | `(friendId: string, limit?: number) => Promise<Array>` | 获取与某好友的消息 |
| `getPending` | `() => Promise<Array>` | 获取待发送队列 |
| `add` | `(friendId: string, message: object) => Promise<object>` | 添加消息 |
| `claimRedpacket` | `(friendId: string, messageId: string) => Promise<object>` | 领取红包 |
| `claimTransfer` | `(friendId: string, messageId: string) => Promise<object>` | 领取转账 |
| `markVoicePlayed` | `(friendId: string, messageId: string) => Promise<boolean>` | 标记语音已播放 |
| `addToPending` | `(message: object) => Promise<boolean>` | 添加到待发送队列 |
| `removeFromPending` | `(messageId: string) => Promise<boolean>` | 从待发送队列移除 |
| `subscribeAll` | `(callback: Function) => Function` | 订阅所有消息变更 |
| `subscribePending` | `(callback: Function) => Function` | 订阅待发送队列变更 |

**Message 对象结构:**
```typescript
{
  id: string;
  type: 'text' | 'voice' | 'redpacket' | 'transfer' | 'sticker' | 'image';
  senderId: string;      // 'me' 或好友 ID
  timestamp: number;
  time: string;          // 格式化时间
  read: boolean;
  // text
  content?: string;
  // voice
  duration?: number;
  played?: boolean;
  // redpacket
  amount?: number;
  remark?: string;
  status?: 'unclaimed' | 'claimed';
  // transfer
  // sticker
  stickerId?: string;
}
```

### Friends - 好友数据

```javascript
const friendsData = new window.PhoneData.Friends(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getList` | `() => Promise<Array>` | 获取好友列表 |
| `getById` | `(friendId: string) => Promise<object\|null>` | 获取单个好友 |
| `getRequests` | `() => Promise<Array>` | 获取好友请求 |
| `add` | `(friend: object) => Promise<boolean>` | 添加好友 |
| `remove` | `(friendId: string) => Promise<boolean>` | 删除好友 |
| `update` | `(friendId: string, updates: object) => Promise<boolean>` | 更新好友 |
| `updateLastMessage` | `(friendId: string, message: string) => Promise<boolean>` | 更新最后消息 |
| `clearUnread` | `(friendId: string) => Promise<boolean>` | 清空未读数 |
| `addRequest` | `(request: object) => Promise<boolean>` | 添加好友请求 |
| `handleRequest` | `(requestId: string, accept: boolean) => Promise<boolean>` | 处理好友请求 |
| `subscribeList` | `(callback: Function) => Function` | 订阅好友列表变更 |
| `subscribeRequests` | `(callback: Function) => Function` | 订阅好友请求变更 |

**Friend 对象结构:**
```typescript
{
  id: string;
  name: string;
  avatar?: string;
  isGroup?: boolean;
  members?: Array<string>;
  unread: number;
  lastMessage?: string;
  lastTime?: number;
  createdAt: number;
}
```

### Weibo - 微博数据

```javascript
const weiboData = new window.PhoneData.Weibo(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getPosts` | `() => Promise<Array>` | 获取微博列表 |
| `getMyPosts` | `() => Promise<Array>` | 获取我的微博 |
| `getById` | `(postId: string) => Promise<object\|null>` | 获取单条微博 |
| `getHotSearches` | `() => Promise<Array>` | 获取热搜列表 |
| `getUserStats` | `() => Promise<object>` | 获取用户统计 |
| `getAccount` | `() => Promise<object>` | 获取账号信息 |
| `addPost` | `(post: object) => Promise<object>` | 发布微博 |
| `likePost` | `(postId: string) => Promise<object>` | 点赞 |
| `unlikePost` | `(postId: string) => Promise<object>` | 取消点赞 |
| `togglePostLike` | `(postId: string) => Promise<object>` | 切换点赞状态 |
| `addComment` | `(postId: string, comment: object) => Promise<object>` | 添加评论 |
| `repost` | `(postId: string, reason?: string) => Promise<object>` | 转发 |
| `delete` | `(postId: string) => Promise<boolean>` | 删除微博 |
| `saveDraft` | `(content: string) => Promise<boolean>` | 保存草稿 |
| `getDraft` | `() => Promise<string>` | 获取草稿 |
| `clearDraft` | `() => Promise<boolean>` | 清空草稿 |
| `subscribePosts` | `(callback: Function) => Function` | 订阅微博列表 |
| `subscribeHotSearches` | `(callback: Function) => Function` | 订阅热搜 |
| `subscribeAccount` | `(callback: Function) => Function` | 订阅账号信息 |

**Post 对象结构:**
```typescript
{
  id: string;
  content: string;
  author: string;
  avatar?: string;
  images: Array<string>;
  type: 'normal' | 'repost';
  timestamp: number;
  time: string;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  commentList: Array<Comment>;
}
```

### FriendsCircle - 朋友圈数据

```javascript
const friendsCircleData = new window.PhoneData.FriendsCircle(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getCircles` | `() => Promise<Array>` | 获取朋友圈列表 |
| `getMyCircles` | `() => Promise<Array>` | 获取我的朋友圈 |
| `getById` | `(circleId: string) => Promise<object\|null>` | 获取单条 |
| `publish` | `(content: object) => Promise<object>` | 发布 |
| `like` | `(circleId: string) => Promise<object>` | 点赞 |
| `comment` | `(circleId: string, comment: object) => Promise<object>` | 评论 |
| `delete` | `(circleId: string) => Promise<boolean>` | 删除 |
| `deleteComment` | `(circleId: string, commentId: string) => Promise<boolean>` | 删除评论 |
| `subscribeCircles` | `(callback: Function) => Function` | 订阅列表变更 |
| `subscribeMyCircles` | `(callback: Function) => Function` | 订阅我的列表变更 |

### Sticker - 表情包数据

```javascript
const stickerData = new window.PhoneData.Sticker(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getAllStickers` | `() => Promise<Array>` | 获取所有表情 |
| `getCategories` | `() => Promise<Array>` | 获取分类 |
| `getStickersByCategory` | `(categoryId: string) => Promise<Array>` | 获取分类下表情 |
| `getRecentStickers` | `(limit?: number) => Promise<Array>` | 获取最近使用 |
| `getFavoriteStickers` | `() => Promise<Array>` | 获取收藏 |
| `getSticker` | `(stickerId: string) => Promise<object\|null>` | 获取单个表情 |
| `recordUsage` | `(stickerId: string) => Promise<boolean>` | 记录使用 |
| `addFavorite` | `(stickerId: string) => Promise<boolean>` | 添加收藏 |
| `removeFavorite` | `(stickerId: string) => Promise<boolean>` | 移除收藏 |
| `subscribeRecent` | `(callback: Function) => Function` | 订阅最近使用变更 |

### Quest - 任务数据

```javascript
const questData = new window.PhoneData.Quest(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getRegistry` | `(charId: string) => Promise<object>` | 获取任务注册表 |
| `getById` | `(charId: string, questId: string) => Promise<object\|null>` | 获取单个任务 |
| `getAll` | `(charId: string) => Promise<Array>` | 获取所有任务 |
| `getByStatus` | `(charId: string, status: string) => Promise<Array>` | 按状态获取任务 |
| `getActive` | `(charId: string) => Promise<Array>` | 获取进行中任务 |
| `getAvailable` | `(charId: string) => Promise<Array>` | 获取可接取任务 |
| `getCompleted` | `(charId: string) => Promise<Array>` | 获取已完成任务 |
| `save` | `(charId: string, quest: object) => Promise<object>` | 保存任务 |
| `updateStatus` | `(charId: string, questId: string, status: string, extra?: object) => Promise<object>` | 更新任务状态 |
| `completeStep` | `(charId: string, questId: string, stepIndex: number) => Promise<object>` | 完成任务步骤 |
| `getInvitations` | `(charId: string) => Promise<Array>` | 获取邀约任务 |
| `respondToInvitation` | `(charId: string, questId: string, accepted: boolean) => Promise<object>` | 响应邀约 |
| `savePrediction` | `(charId: string, questId: string, prediction: object) => Promise<object>` | 保存推演 |
| `delete` | `(charId: string, questId: string) => Promise<boolean>` | 删除任务 |
| `clearAll` | `(charId: string) => Promise<void>` | 清空所有任务 |

### Map - 地图数据

```javascript
const mapData = new window.PhoneData.Map(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `(charId: string) => Promise<object>` | 获取地图数据 |
| `save` | `(charId: string, data: object) => Promise<void>` | 保存地图数据 |
| `delete` | `(charId: string) => Promise<void>` | 删除地图数据 |
| `exists` | `(charId: string) => Promise<boolean>` | 检查地图是否存在 |
| `updatePlayerLocation` | `(charId: string, locationId: string) => Promise<boolean>` | 更新玩家位置 |
| `addVisitedLocation` | `(charId: string, locationId: string) => Promise<boolean>` | 添加已访问位置 |
| `calculateDeviation` | `(charId: string, newLocation: string) => Promise<object>` | 计算偏差分数 |
| `getDeviationScore` | `(charId: string) => Promise<number>` | 获取偏差分数 |
| `getPlayerLocation` | `(charId: string) => Promise<string>` | 获取玩家当前位置 |
| `getVisitedLocations` | `(charId: string) => Promise<Array>` | 获取已访问位置列表 |
| `getOutdoorMap` | `(charId: string) => Promise<object>` | 获取室外地图 |
| `getInsideMap` | `(charId: string) => Promise<object>` | 获取室内地图 |
| `updateOutdoorMap` | `(charId: string, outdoorData: object) => Promise<void>` | 更新室外地图 |
| `updateInsideMap` | `(charId: string, insideData: object) => Promise<void>` | 更新室内地图 |

**MapData 对象结构:**
```typescript
{
  outdoor: {
    name: string;
    description: string;
    nodes: Array<{
      name: string;
      type: 'home' | 'urban' | 'shop' | 'dungeon' | 'forest' | 'mountain' | 'water' | 'cave' | 'temple' | 'ruins' | 'camp' | 'port';
      info: string;
      position: string;
      distant: number;
    }>;
  };
  inside: {
    [locationName: string]: Array<{
      name: string;
      type: string;
      info: string;
      interactable: boolean;
      actions: Array<string>;
    }>;
  };
  playerLocation: string;
  visitedLocations: Array<string>;
  deviationScore: number;
  createdAt: number;
  updatedAt: number;
}
```

**Quest 状态常量:** `window.QUEST_STATUS`
- `LOCKED` - 条件未满足
- `AVAILABLE` - 可以接取
- `ACTIVE` - 正在进行
- `REWARD` - 完成待领奖
- `COMPLETED` - 已完成
- `FAILED` - 失败
- `ARCHIVED` - 已归档

### Invitation - 邀约数据

```javascript
const invitationData = new window.PhoneData.Invitation(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getList` | `(charId: string) => Promise<Array>` | 获取邀约列表 |
| `getById` | `(charId: string, invitationId: string) => Promise<object\|null>` | 获取单个邀约 |
| `create` | `(charId: string, options: object) => Promise<object>` | 创建邀约 |
| `getAll` | `(charId: string) => Promise<Array>` | 获取所有邀约 |
| `getPending` | `(charId: string) => Promise<Array>` | 获取待处理邀约 |
| `getByNPC` | `(charId: string, npcId: string) => Promise<Array>` | 获取NPC的邀约 |
| `getByType` | `(charId: string, type: string) => Promise<Array>` | 按类型获取邀约 |
| `accept` | `(charId: string, invitationId: string, extra?: object) => Promise<object>` | 接受邀约 |
| `decline` | `(charId: string, invitationId: string, reason?: string) => Promise<object>` | 拒绝邀约 |
| `cancel` | `(charId: string, invitationId: string) => Promise<object>` | 取消邀约 |
| `checkExpired` | `(charId: string) => Promise<Array>` | 检查过期邀约 |
| `delete` | `(charId: string, invitationId: string) => Promise<boolean>` | 删除邀约 |
| `clearAll` | `(charId: string) => Promise<void>` | 清空所有邀约 |
| `clearCompleted` | `(charId: string) => Promise<number>` | 清理已完成邀约 |

**Invitation 类型常量:** `window.INVITATION_TYPE`
- `SOCIAL` - 社交邀约
- `QUEST` - 任务邀约
- `LOCATION` - 地点邀约
- `SPECIAL` - 特殊邀约

**Invitation 状态常量:** `window.INVITATION_STATUS`
- `PENDING` - 待响应
- `ACCEPTED` - 已接受
- `DECLINED` - 已拒绝
- `EXPIRED` - 已过期
- `CANCELLED` - 已取消

### History - 事件时间线

```javascript
const historyData = new window.PhoneData.History(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getTimeline` | `(charId: string) => Promise<Array>` | 获取时间线 |
| `addEvent` | `(charId: string, event: object) => Promise<object>` | 添加事件 |
| `getAll` | `(charId: string) => Promise<Array>` | 获取所有事件 |
| `getRecent` | `(charId: string, count?: number) => Promise<Array>` | 获取最近事件 |
| `getByType` | `(charId: string, type: string) => Promise<Array>` | 按类型获取 |
| `getSince` | `(charId: string, timestamp: number) => Promise<Array>` | 获取某时间后的事件 |
| `getByImportance` | `(charId: string, minImportance?: number) => Promise<Array>` | 按重要性获取 |
| `formatForAI` | `(charId: string, options?: object) => Promise<Array>` | 格式化为AI上下文 |
| `clearAll` | `(charId: string) => Promise<void>` | 清空所有事件 |
| `clearOldEvents` | `(charId: string, olderThan: number) => Promise<number>` | 清理旧事件 |

**History 事件类型常量:** `window.HISTORY_EVENT_TYPE`
- `WORLD_GENERATED` - 世界生成完成
- `WORLD_EVOLVED` - 世界推演完成
- `STAGE_REVEALED` - 洋葱层级揭示
- `NPC_BEHAVIOR` - NPC行为
- `NPC_MOOD` - NPC心情变化
- `NPC_RELATIONSHIP` - NPC关系变化
- `QUEST_GENERATED` - 任务生成
- `QUEST_STARTED` - 任务开始
- `QUEST_COMPLETED` - 任务完成
- `QUEST_FAILED` - 任务失败
- `QUEST_INVITATION` - 邀约发送
- `INVITATION_ACCEPTED` - 邀约接受
- `MESSAGE_SENT` - 消息发送
- `MESSAGE_RECEIVED` - 消息接收
- `MAP_LOCATION` - 位置切换

### Prediction - 推演数据

```javascript
const predictionData = new window.PhoneData.Prediction(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `(charId: string, questId: string) => Promise<object\|null>` | 获取推演 |
| `save` | `(charId: string, questId: string, prediction: object) => Promise<object>` | 保存推演 |
| `create` | `(charId: string, questId: string, data: object) => Promise<object>` | 创建推演 |
| `exists` | `(charId: string, questId: string) => Promise<boolean>` | 检查是否存在 |
| `update` | `(charId: string, questId: string, updates: object) => Promise<object>` | 更新推演 |
| `updateActualResult` | `(charId: string, questId: string, result: object) => Promise<object>` | 更新实际结果 |
| `selectBranch` | `(charId: string, questId: string, branchIndex: number) => Promise<object>` | 选择分支 |
| `markRiskRealized` | `(charId: string, questId: string, riskIndex: number) => Promise<object>` | 标记风险实现 |
| `delete` | `(charId: string, questId: string) => Promise<void>` | 删除推演 |
| `clearAll` | `(charId: string) => Promise<void>` | 清空所有推演 |
| `clearOld` | `(charId: string, olderThan: number) => Promise<number>` | 清理旧推演 |
| `formatForAI` | `(charId: string, questId: string, options?: object) => Promise<string>` | 格式化为AI上下文 |
| `generateSummary` | `(charId: string, questId: string) => Promise<string>` | 生成摘要 |

### Economy - 经济数据

```javascript
const economyData = new window.PhoneData.Economy(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getPlayerWallet` | `(charId: string) => Promise<object>` | 获取玩家钱包 |
| `getBalance` | `(charId: string, currency?: string) => Promise<number>` | 获取余额 |
| `setBalance` | `(charId: string, currency: string, amount: number) => Promise<object>` | 设置余额 |
| `addBalance` | `(charId: string, currency: string, amount: number, reason?: string) => Promise<object>` | 增加余额 |
| `getNPCWallet` | `(charId: string, npcId: string) => Promise<object>` | 获取NPC钱包 |
| `transfer` | `(charId: string, fromNpcId: string, toNpcId: string, amount: number, reason?: string) => Promise<object>` | NPC间转账 |
| `getTransactions` | `(charId: string, options?: object) => Promise<Array>` | 获取交易记录 |
| `recordTransaction` | `(charId: string, transaction: object) => Promise<object>` | 记录交易 |
| `getStockMarket` | `(charId: string) => Promise<object>` | 获取股市数据 |
| `updateStockMarket` | `(charId: string, changes: object) => Promise<object>` | 更新股市 |
| `getStockHoldings` | `(charId: string) => Promise<object>` | 获取股票持仓 |
| `buyStock` | `(charId: string, stockCode: string, quantity: number, price: number) => Promise<object>` | 买入股票 |
| `sellStock` | `(charId: string, stockCode: string, quantity: number, price: number) => Promise<object>` | 卖出股票 |
| `clearAll` | `(charId: string) => Promise<void>` | 清空所有数据 |
| `formatForAI` | `(charId: string, options?: object) => Promise<string>` | 格式化为AI上下文 |

**Currency 类型常量:** `window.CURRENCY_TYPE`
- `GOLD` - 金币
- `DIAMOND` - 钻石
- `CREDIT` - 信用点

**Transaction 类型常量:** `window.TRANSACTION_TYPE`
- `INCOME` - 收入
- `EXPENSE` - 支出
- `TRANSFER_IN` - 转入
- `TRANSFER_OUT` - 转出
- `QUEST_REWARD` - 任务奖励
- `SHOP_PURCHASE` - 商店购买
- `STOCK_BUY` - 股票买入
- `STOCK_SELL` - 股票卖出
- `NPC_GIFT` - NPC赠送
- `NPC_RED_PACKET` - NPC红包

---

## Service 业务层

全局访问: `window.PhoneServices.*`

### AIService - AI 服务

```javascript
const aiService = new window.PhoneServices.AI(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(prompt: string, options?: object) => Promise<string>` | 通用生成 |
| `generateChatReply` | `(characterName: string, context: Array) => Promise<string>` | 生成聊天回复 |
| `generateWeibo` | `() => Promise<string>` | 生成微博内容 |
| `generateWeiboComment` | `(postContent: string) => Promise<string>` | 生成微博评论 |
| `generateFriendsCircle` | `() => Promise<string>` | 生成朋友圈内容 |

**generate options:**
```typescript
{
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  type?: string;  // 用于历史记录分类
}
```

### MessageService - 消息服务

```javascript
const messageService = new window.PhoneServices.Message(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getFriendList` | `() => Promise<Array>` | 获取好友列表（带排序） |
| `getMessages` | `(friendId: string) => Promise<Array>` | 获取消息列表 |
| `getFriend` | `(friendId: string) => Promise<object\|null>` | 获取好友信息 |
| `sendText` | `(friendId: string, content: string) => Promise<object>` | 发送文本 |
| `sendVoice` | `(friendId: string, duration: number) => Promise<object>` | 发送语音 |
| `sendRedpacket` | `(friendId: string, amount: number, remark?: string) => Promise<object>` | 发送红包 |
| `claimRedpacket` | `(friendId: string, messageId: string) => Promise<object>` | 领取红包 |
| `sendTransfer` | `(friendId: string, amount: number, remark?: string) => Promise<object>` | 发送转账 |
| `claimTransfer` | `(friendId: string, messageId: string) => Promise<object>` | 领取转账 |
| `sendSticker` | `(friendId: string, stickerId: string) => Promise<object>` | 发送表情 |
| `sendAIReply` | `(friendId: string) => Promise<object>` | AI 生成并发送回复 |
| `markVoicePlayed` | `(friendId: string, messageId: string) => Promise<boolean>` | 标记语音已播放 |
| `clearChat` | `(friendId: string) => Promise<boolean>` | 清空聊天记录 |
| `subscribeMessages` | `(friendId: string, callback: Function) => Function` | 订阅消息变更 |
| `subscribeFriends` | `(callback: Function) => Function` | 订阅好友列表变更 |

### WeiboService - 微博服务

```javascript
const weiboService = new window.PhoneServices.Weibo(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getPosts` | `(limit?: number) => Promise<Array>` | 获取微博列表 |
| `getMyPosts` | `() => Promise<Array>` | 获取我的微博 |
| `getPost` | `(postId: string) => Promise<object\|null>` | 获取单条微博 |
| `getHotSearches` | `() => Promise<Array>` | 获取热搜 |
| `getUserStats` | `() => Promise<object>` | 获取用户统计 |
| `publish` | `(content: string, options?: object) => Promise<object>` | 发布微博 |
| `publishAI` | `() => Promise<object>` | AI 生成并发布 |
| `toggleLike` | `(postId: string) => Promise<object>` | 切换点赞 |
| `comment` | `(postId: string, content: string, options?: object) => Promise<object>` | 评论 |
| `commentAI` | `(postId: string) => Promise<object>` | AI 生成评论 |
| `repost` | `(postId: string, reason?: string) => Promise<object>` | 转发 |
| `delete` | `(postId: string) => Promise<boolean>` | 删除 |
| `subscribePosts` | `(callback: Function) => Function` | 订阅微博列表 |
| `subscribeUserStats` | `(callback: Function) => Function` | 订阅用户统计 |

### FriendService - 好友服务

```javascript
const friendService = new window.PhoneServices.Friend(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getList` | `() => Promise<Array>` | 获取好友列表 |
| `getById` | `(friendId: string) => Promise<object\|null>` | 获取好友详情 |
| `getRequests` | `() => Promise<Array>` | 获取好友请求 |
| `add` | `(friend: object) => Promise<boolean>` | 添加好友 |
| `remove` | `(friendId: string) => Promise<boolean>` | 删除好友 |
| `update` | `(friendId: string, updates: object) => Promise<boolean>` | 更新好友 |
| `clearUnread` | `(friendId: string) => Promise<boolean>` | 清空未读 |
| `sendRequest` | `(request: object) => Promise<boolean>` | 发送好友请求 |
| `handleRequest` | `(requestId: string, accept: boolean) => Promise<boolean>` | 处理请求 |
| `subscribeList` | `(callback: Function) => Function` | 订阅好友列表 |
| `subscribeRequests` | `(callback: Function) => Function` | 订阅好友请求 |

---

### DirectorServiceV2 - AI导演决策服务（V2 两步生成模式）

> [v4.31-fix] V1 导演服务已移除，统一使用 V2。

全局访问: `window.PhoneServices.DirectorV2`（通过 Platform 获取: `Platform.get('directorV2Service')`）

#### 构造函数

```javascript
const director = new window.PhoneServices.DirectorV2(platform);
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `async () => Promise<void>` | 初始化，读取启用状态/冷却时间，设置事件监听 |
| `trigger` | `async () => Promise<void>` | 触发导演决策（冷却检查、防并发、上下文变化检测、意图生成、内容生成、事件分发） |
| `manualTrigger` | `async () => Promise<void>` | 手动触发，跳过冷却检查 |
| `setEnabled` | `async (enabled: boolean) => Promise<void>` | 启用/禁用导演服务 |
| `getStatus` | `async () => Promise<object>` | 获取导演当前状态 |

#### V2 两步生成流程

```
trigger() → _checkContextDelta() → _makeDecision() → _generateIntents()
  → 意图分类 → _generateContent() → QuestExpert/LLM 生成 → 事件分发
```

#### 事件

所有事件载荷格式: `{ id, type, data, timestamp, source: 'director-service-v2' }`

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `director:quest_trigger` | V2 生成任务内容后 | `{ actionType: 'create_quest', charId, quest }` |
| `director:invitation_trigger` | V2 生成任务邀约后 | `{ actionType: 'create_invitation', charId, npcId, npcName, type, message, relatedQuestId }` |
| `director:message` | 分发消息事件 | `{ from, fromId, content }` |
| `director:moment` | 分发朋友圈事件 | `{ author, content }` |
| `director:live` | 分发直播事件 | 原始 event 对象 |
| `director:friend` | 分发好友事件 | `{ name, friendId, avatar, message }` |
| `director:status` | 分发状态变更事件 | `{ target, change }` |

#### 工作流

| 工作流ID | 触发事件 | 动作 |
|----------|----------|------|
| `wf.director_quest_trigger` | `director:quest_trigger` | 调用 `questService.createQuest()` 写入 DataStore |
| `wf.quest_reward` | `quest:completed` | 发放奖励 + 系统通知 |
| `wf.director` | `variable_changed: xb.director.plan` | 处理导演计划 |

#### 使用示例

```javascript
// 通过 Platform 获取 V2 导演服务
const director = Platform.get('directorV2Service');
await director.init();

// 手动触发导演决策
await director.manualTrigger();

// 订阅任务触发事件（由工作流自动写入 DataStore）
platform.eventBus.on('director:quest_trigger', (payload) => {
  console.log('新任务生成:', payload.data.quest.name);
});

// 订阅任务创建完成事件（已写入 DataStore）
platform.eventBus.on('quest:created', (payload) => {
  console.log('任务已保存:', payload.data);
});
```

### MapService - 地图服务

全局访问: `window.PhoneServices.Map`

#### 构造函数

```javascript
const mapService = new window.PhoneServices.Map(platform);
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `async () => Promise<void>` | 初始化服务 |
| `travelTo` | `async (charId: string, locationId: string) => Promise<object>` | 场景切换，计算偏差值，更新任务进度 |
| `getLocationInfo` | `async (charId: string, locationId: string) => Promise<object\|null>` | 获取地点信息 |
| `getIndoorNodes` | `async (charId: string, locationId: string) => Promise<Array>` | 获取室内可交互节点 |
| `checkQuestProgress` | `async (charId: string, action: string, target: string) => Promise<Array>` | 检查任务进度 |
| `getFullMapData` | `async (charId: string) => Promise<object>` | 获取完整地图数据（用于渲染） |
| `getCurrentLocation` | `async (charId: string) => Promise<object\|null>` | 获取当前位置信息 |
| `getDeviationScore` | `async (charId: string) => Promise<number>` | 获取偏差分数 |
| `getVisitStats` | `async (charId: string) => Promise<object>` | 获取已访问统计 |

#### 事件

所有事件载荷格式: `{ id, type, data, timestamp, source: 'map-service' }`

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `map:location:changed` | 玩家位置变更 | `{ charId, oldLocation, newLocation, isFirstVisit, deviation, questUpdates }` |
| `map:deviation:calculated` | 偏差值计算完成 | `{ charId, location, score, delta, reason }` |
| `quest:progress:updated` | 任务进度更新 | `{ charId, questId, questName, action, target, stepIndex, completedStep }` |

#### 使用示例

```javascript
const mapService = new window.PhoneServices.Map(platform);
await mapService.init();

// 获取完整地图数据
const mapData = await mapService.getFullMapData(charId);

// 前往指定地点
const result = await mapService.travelTo(charId, '城镇广场');
if (result.success) {
  console.log(`已到达: ${result.newLocation}`);
  console.log(`偏差值变化: ${result.deviation.delta}`);
}

// 订阅位置变更事件
platform.eventBus.on('map:location:changed', (payload) => {
  console.log('位置变更:', payload.data.oldLocation, '->', payload.data.newLocation);
});
```

---

### WorkflowEngine - 工作流引擎（状态机模式）

全局访问: `window.WorkflowEngine`

#### 构造函数

```javascript
const engine = new window.WorkflowEngine(platform);
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `register` | `(workflow: object) => void` | 注册单个工作流（自动规范化旧版格式） |
| `registerAll` | `(workflows: Array<object>) => void` | 批量注册工作流 |
| `remove` | `(id: string) => void` | 移除指定工作流 |
| `listWorkflows` | `() => Array<object>` | 返回所有已注册工作流摘要 |
| `trigger` | `(workflowId: string, eventData?: object) => void` | 手动触发指定工作流 |
| `getInstances` | `() => Array<object>` | 获取所有活跃实例 |
| `getInstance` | `(instanceId: string) => object\|null` | 获取单个实例详情 |
| `cancelInstance` | `(instanceId: string) => void` | 取消指定实例 |

#### 工作流定义格式

```javascript
{
  id: 'wf.example',
  name: '示例工作流',
  version: 1,
  trigger: { type: 'engine_event', pattern: 'some:event' },
  options: { dedup: true, dedupWindow: 3000, maxRetries: 2 },
  states: {
    initial: { actions: [...], next: 'processing' },
    processing: { actions: [...], next: 'complete', error: 'failed' },
    complete: { actions: [...], terminal: true },
    failed: { actions: [...], terminal: true }
  },
  initialState: 'initial'
}
```

#### 触发器类型

| 类型 | 说明 |
|------|------|
| `variable_changed` | 监听 `variable:changed` 事件 |
| `engine_event` | 监听 EventBus 事件（支持通配符 `*`） |
| `timer` | 定时触发（`interval` 毫秒） |

#### 动作类型

| 类型 | 说明 |
|------|------|
| `ai_call` | 调用 AIService |
| `module_call` | 调用模块方法 |
| `variable_set` | 设置变量 |
| `event_emit` | 发射事件 |
| `function_call` | 调用自定义函数 |

#### 事件

所有事件载荷格式: `{ id, type, data, timestamp, source: 'WorkflowEngine' }`

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `workflow:state_changed` | 状态转移时 | `{ workflowId, state, previousState, reason }` |
| `workflow:completed` | 工作流完成 | `{ workflowId, context }` |
| `workflow:error` | 工作流失败 | `{ workflowId, error, state, status }` |
| `workflow:cancelled` | 实例被取消 | `{ state, reason: 'cancelled' }` |

#### 使用示例

```javascript
const engine = new window.WorkflowEngine(platform);

// 注册工作流
engine.register({
  id: 'wf.notify',
  name: '通知工作流',
  trigger: { type: 'engine_event', pattern: 'message:sent' },
  states: {
    initial: { actions: [{ type: 'event_emit', params: { event: 'notification:show' } }], next: 'complete', terminal: true }
  },
  initialState: 'initial'
});

// 手动触发
engine.trigger('wf.notify', { messageId: '123' });

// 查看活跃实例
engine.getInstances().forEach(inst => console.log(inst.id, inst.currentState));
```

---

### Service emit 事件汇总（阶段G）

所有 Service 在数据写入成功后通过 EventBus 发射事件，载荷格式统一为：
```javascript
{ id: string, type: string, data: object, timestamp: number, source: string }
```

#### 消息服务 (message-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `message:sent` | sendText/sendVoice/sendRedpacket/sendTransfer/sendSticker/sendAIReply | `{ friendId, messageId, type, amount?, isAI? }` |
| `message:redpacketClaimed` | claimRedpacket | `{ friendId, messageId, amount }` |
| `message:transferClaimed` | claimTransfer | `{ friendId, messageId, amount }` |
| `message:voicePlayed` | markVoicePlayed | `{ friendId, messageId }` |
| `message:chatCleared` | clearChat | `{ friendId }` |

#### 好友服务 (friend-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `friend:added` | add | `{ friendId, name }` |
| `friend:removed` | remove | `{ friendId, name }` |
| `friend:updated` | update | `{ friendId }` |
| `friend:unreadCleared` | clearUnread | `{ friendId }` |
| `friend:requestSent` | sendRequest | `{ requestId, name }` |
| `friend:requestHandled` | handleRequest | `{ requestId, accepted }` |

#### 微博服务 (weibo-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `weibo:published` | publish | `{ postId, content }` |
| `weibo:likeToggled` | toggleLike | `{ postId, liked }` |
| `weibo:commented` | comment | `{ postId, commentId }` |
| `weibo:reposted` | repost | `{ postId, originalPostId }` |
| `weibo:deleted` | delete | `{ postId }` |

#### 朋友圈服务 (friends-circle-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `friendsCircle:published` | publish | `{ circleId, content }` |
| `friendsCircle:likeToggled` | toggleLike | `{ circleId, liked }` |
| `friendsCircle:commented` | addComment | `{ circleId, commentId }` |
| `friendsCircle:commentDeleted` | deleteComment | `{ circleId, commentId }` |
| `friendsCircle:deleted` | delete | `{ circleId }` |

#### 论坛服务 (forum-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `forum:postPublished` | publishPost | `{ postId, title }` |
| `forum:replyAdded` | reply | `{ postId, replyId }` |
| `forum:postLiked` | likePost | `{ postId, liked }` |
| `forum:replyLiked` | likeReply | `{ postId, replyId, liked }` |
| `forum:postDeleted` | deletePost | `{ postId }` |
| `forum:replyDeleted` | deleteReply | `{ postId, replyId }` |

#### 任务服务 (task-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `task:accepted` | acceptTask | `{ taskId, name }` |
| `task:progressUpdated` | updateProgress | `{ taskId, progress }` |
| `task:completed` | completeTask | `{ taskId, name }` |
| `task:added` | addTask | `{ taskId, name }` |
| `task:deleted` | deleteTask | `{ taskId }` |

#### 背包服务 (inventory-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `inventory:itemUsed` | useItem | `{ itemId, name }` |
| `inventory:itemEquipped` | equipItem | `{ itemId, slot }` |
| `inventory:itemUnequipped` | unequipItem | `{ itemId, slot }` |
| `inventory:currencyUpdated` | updateCurrency | `{ currency, amount }` |

#### 商店服务 (shop-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `shop:cartUpdated` | addToCart/removeFromCart | `{ productId, cartCount? }` |
| `shop:checkoutCompleted` | checkout | `{ itemCount, totalCost }` |
| `shop:cartCleared` | clearCart | `{}` |

#### 状态服务 (status-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `status:userUpdated` | updateUserStatus | `{ field }` |
| `status:memoryAdded` | addMemory | `{ memoryId }` |
| `status:npcAdded` | addNPC | `{ npcId, name }` |
| `status:npcUpdated` | updateNPCStatus | `{ npcId }` |

#### 直播服务 (live-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `live:started` | startLive | `{ streamId, streamerName }` |
| `live:ended` | endLive | `{ streamId }` |
| `live:danmakuSent` | sendDanmaku | `{ streamId, content }` |
| `live:giftSent` | sendGift | `{ streamId, giftType, value }` |

#### 日记服务 (diary-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `diary:added` | addDiary | `{ diaryId, title }` |
| `diary:updated` | updateDiary | `{ diaryId }` |
| `diary:deleted` | deleteDiary | `{ diaryId }` |

#### 档案服务 (profile-service)

| 事件名 | 触发方法 | data 字段 |
|--------|----------|-----------|
| `profile:added` | addProfile | `{ profileId, name }` |
| `profile:updated` | updateProfile | `{ profileId }` |
| `profile:deleted` | deleteProfile | `{ profileId }` |

---

## Module 模块层

全局访问: `window.PhoneModules.*`

### 模块基类 PhoneApp

所有模块继承自 `PhoneApp` 基类。

#### 生命周期钩子

| 方法 | 签名 | 说明 |
|------|------|------|
| `onInit` | `(phone: PhoneCore, params?: object) => Promise<void>` | 初始化 |
| `onRender` | `() => HTMLElement \| string` | 渲染（返回 DOM 或 HTML） |
| `onResume` | `(params?: object) => void` | 恢复（从后台或首次启动） |
| `onPause` | `() => void` | 暂停（进入后台） |
| `onDispose` | `() => void` | 销毁 |

#### 导航方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `navigateTo` | `(pageId: string, params?: object) => void` | 导航到新页面 |
| `navigateBack` | `() => void` | 返回上一页 |
| `navigateHome` | `() => void` | 返回首页 |
| `goHome` | `() => void` | 回到桌面 |

#### 状态管理

| 方法 | 签名 | 说明 |
|------|------|------|
| `setState` | `(key: string, value: any) => void` | 设置应用状态 |
| `getState` | `(key: string, defaultValue?: any) => any` | 获取应用状态 |
| `setStates` | `(states: object) => void` | 批量设置状态 |

#### 事件系统

| 方法 | 签名 | 说明 |
|------|------|------|
| `on` | `(event: string, handler: Function) => void` | 监听事件 |
| `off` | `(event: string, handler: Function) => void` | 取消监听 |
| `emit` | `(event: string, data?: any) => void` | 触发事件 |

#### UI 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `showToast` | `(message: string, type?: string) => void` | 显示提示 |
| `setBadge` | `(count: number) => void` | 设置角标 |

### 可用模块

| 模块 | 类名 | 说明 |
|------|------|------|
| `window.PhoneModules.Message` | `MessageModule` | 消息模块 |
| `window.PhoneModules.Weibo` | `WeiboModule` | 微博模块 |
| `window.PhoneModules.ApiSettings` | `ApiSettingsModule` | API 设置模块 |

### 模块加载器

```javascript
window.PhoneModuleLoader.loadAll();  // 加载所有模块
window.PhoneModuleLoader.getClass('message');  // 获取模块类
window.PhoneModuleLoader.getAvailable();  // 获取所有可用模块
```

---

## CORE 沉浸组件层

### LiveImmersive - 直播沉浸模式

全局访问: `window.LiveImmersive`

#### 构造函数

```javascript
const liveImmersive = new window.LiveImmersive();
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(parentEl: HTMLElement) => void` | 初始化组件，创建 DOM |
| `enter` | `(streamData: object, callbacks: object) => void` | 进入沉浸模式 |
| `exit` | `() => void` | 退出沉浸模式 |
| `isActive` | `() => boolean` | 是否处于激活状态 |
| `addDanmaku` | `(danmaku: object) => void` | 添加弹幕 |
| `triggerGiftEffect` | `(gift: object) => void` | 触发礼物特效 |
| `updateViewers` | `(count: number) => void` | 更新观众数（带动画） |
| `updateTitle` | `(title: string) => void` | 更新直播标题 |

#### StreamData 结构

```typescript
{
  id: string;           // 直播间ID
  streamerId: string;   // 主播ID
  streamerName: string; // 主播名
  streamerAvatar: string; // 主播头像URL
  title: string;        // 直播标题
  viewers: number;      // 观众数
  isLive: boolean;      // 是否直播中
}
```

#### Callbacks 结构

```typescript
{
  onSendDanmaku: (text: string) => void;      // 发送弹幕回调
  onSendGift: (giftType: string) => void;     // 发送礼物回调
  onClose: () => void;                         // 关闭回调
}
```

#### Danmaku 结构

```typescript
{
  id?: string;
  content: string;      // 弹幕内容
  userId?: string;
  userName?: string;
  userAvatar?: string;
  type: 'normal' | 'gift' | 'system';  // 弹幕类型
  timestamp?: number;
  // gift 类型额外字段
  icon?: string;        // 礼物图标
  giftName?: string;    // 礼物名称
}
```

#### Gift 结构

```typescript
{
  type: 'flower' | 'heart' | 'rocket' | 'crown' | 'custom';
  name: string;
  value: number;        // 礼物价值
  userId?: string;
  userName?: string;
  userAvatar?: string;
  timestamp?: number;
}
```

#### 礼物特效配置

```javascript
window.LiveImmersive.GIFT_EFFECTS = {
  flower: { name: '鲜花', icon: '🌸', particles: 8, duration: 2000 },
  heart: { name: '爱心', icon: '❤️', particles: 12, duration: 2500 },
  rocket: { name: '火箭', icon: '🚀', particles: 20, duration: 3000 },
  crown: { name: '皇冠', icon: '👑', particles: 25, duration: 3500 },
  custom: { name: '自定义', icon: '🎁', particles: 10, duration: 2500 },
};
```

#### 使用示例

```javascript
// 初始化
const live = new window.LiveImmersive();
live.init(document.body);

// 进入直播间
live.enter({
  id: 'live_xxx',
  streamerName: '主播名',
  streamerAvatar: 'avatar.png',
  title: '直播标题',
  viewers: 1234
}, {
  onSendDanmaku: (text) => console.log('发送弹幕:', text),
  onSendGift: (type) => console.log('发送礼物:', type),
  onClose: () => console.log('关闭直播间')
});

// 添加弹幕
live.addDanmaku({
  content: '666',
  userName: '观众名',
  type: 'normal'
});

// 触发礼物特效
live.triggerGiftEffect({
  type: 'rocket',
  name: '火箭',
  value: 50,
  userName: '土豪'
});
```

---

### DiaryImmersive - 日记沉浸写作

全局访问: `window.DiaryImmersive`

#### 构造函数

```javascript
const diaryImmersive = new window.DiaryImmersive();
```

#### 实例方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(parentEl: HTMLElement) => void` | 初始化组件 |
| `enter` | `(options: object) => void` | 进入沉浸写作模式 |
| `exit` | `() => void` | 退出沉浸模式 |
| `isActive` | `() => boolean` | 是否处于激活状态 |

#### Enter Options 结构

```typescript
{
  diaryId?: string;     // 日记ID（编辑模式）
  diary?: object;       // 日记数据（编辑模式）
  onSave: (data: DiaryData, isAutoSave: boolean) => void;  // 保存回调
  onAIGenerate?: (context: object, callback: Function) => void;  // AI生成回调
  onClose?: () => void; // 关闭回调
}
```

#### DiaryData 结构

```typescript
{
  id?: string;
  title: string;
  content: string;
  mood: 'normal' | 'happy' | 'sad' | 'angry' | 'excited';
  weather: string;
  location: string;
}
```

#### 心情配置

```javascript
window.DiaryImmersive.MOOD_CONFIG = {
  normal: { name: '平静', icon: '😊', colors: ['#74B9FF', '#A3D8F4'] },
  happy: { name: '开心', icon: '😄', colors: ['#FFEAA7', '#FDCB6E'] },
  sad: { name: '难过', icon: '😢', colors: ['#74B9FF', '#0984E3'] },
  angry: { name: '生气', icon: '😠', colors: ['#FF7675', '#D63031'] },
  excited: { name: '兴奋', icon: '🤩', colors: ['#A29BFE', '#6C5CE7'] },
};
```

#### 天气选项

```javascript
window.DiaryImmersive.WEATHER_OPTIONS = [
  { value: 'sunny', icon: '☀️', name: '晴天' },
  { value: 'cloudy', icon: '☁️', name: '多云' },
  { value: 'rainy', icon: '🌧', name: '下雨' },
  { value: 'snowy', icon: '❄️', name: '下雪' },
  { value: 'windy', icon: '💨', name: '大风' },
  { value: 'foggy', icon: '🌫', name: '雾天' },
];
```

#### 静态方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `renderHeatmap` | `(diaries: Array, container: HTMLElement) => void` | 渲染心情趋势热力图 |

#### 使用示例

```javascript
// 初始化
const diary = new window.DiaryImmersive();
diary.init(document.body);

// 新建日记
diary.enter({
  onSave: (data, isAutoSave) => {
    console.log('保存日记:', data);
    if (!isAutoSave) diary.exit();
  },
  onAIGenerate: (context, callback) => {
    // 调用 AI 生成
    const generatedText = '今天天气很好...';
    callback(generatedText);
  }
});

// 编辑日记
diary.enter({
  diaryId: 'diary_xxx',
  diary: { title: '标题', content: '内容', mood: 'happy', weather: 'sunny' },
  onSave: (data) => console.log('更新日记:', data)
});

// 渲染心情热力图
window.DiaryImmersive.renderHeatmap(diaries, document.getElementById('heatmap'));
```

---

### DataCleanupService - 数据清理与销毁

全局访问: `window.PhoneServices.DataCleanup`

#### 构造函数

```javascript
const cleanupService = new window.PhoneServices.DataCleanup(platform);
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `clearCurrentCharacterData` | `async () => Promise<{success, clearedDomains, errors}>` | 清空当前角色卡的所有数据 |
| `clearCharacterData` | `async (characterId) => Promise<{success, clearedDomains, errors}>` | 清空指定角色卡的所有数据 |
| `clearAllCharacterData` | `async () => Promise<{success, clearedCount}>` | 清空所有角色卡的数据 |
| `clearGlobalSettings` | `async () => Promise<{success, clearedDomains, errors}>` | 清空全局设置 |
| `clearDomain` | `async (domain, options) => Promise<{success, cleared}>` | 清空单个领域 |
| `resetCurrentCharacter` | `async () => Promise<{success}>` | 重置当前角色卡（清空+初始化） |

#### clearDomain Options

```typescript
{
  scope: 'character' | 'global'  // 默认 'character'
}
```

#### 事件

| 事件 | 触发时机 | Payload |
|------|----------|---------|
| `data:cleared` | 数据清理完成 | `{ scope, characterId?, clearedDomains, errors? }` |
| `domain:cleared` | 单领域清理完成 | `{ domain, scope, cleared }` |
| `character:reset` | 角色卡重置完成 | `{ characterId }` |

#### 使用示例

```javascript
const cleanup = new window.PhoneServices.DataCleanup(platform);

// 清空当前角色卡
const result = await cleanup.clearCurrentCharacterData();
console.log(result.success, result.clearedDomains);

// 清空单个领域
await cleanup.clearDomain('messages');

// 重置角色卡
await cleanup.resetCurrentCharacter();

// 订阅清理事件
platform.on('data:cleared', (payload) => {
  console.log('数据已清理:', payload.data.scope);
});
```

---

### LLMGateway - LLM统一调用网关

全局访问: `window.LLMGateway`

#### [v3.0] 四通道架构

| 通道ID | 名称 | 用途 | 并发 | 超时 | 队列策略 |
|--------|------|------|------|------|----------|
| `channel-world` | 大世界生成通道 | 世界构建和推演，高质量生成 | 1 | 120s | FIFO |
| `channel-director` | 管家规划通道 | 任务规划和偏差分析，推理密集 | 2 | 30s | Priority |
| `channel-content` | 内容生成通道 | 消息、NPC、场景等内容生成 | 5 | 15s | FIFO |
| `channel-fallback` | 备用通道 | 故障转移和降级 | 3 | 60s | FIFO |

**通道配置文件**: `CONFIG/llm-channels.js` → `window.LLMChannelConfig`

```javascript
// 获取默认通道配置
window.LLMChannelConfig.getDefaults();

// 获取预设模板
window.LLMChannelConfig.getPreset('high-performance');
// 可选: 'default', 'high-performance', 'cost-saving'
```

#### 角色列表

| 角色 | 通道 | 说明 | 温度 | 最大Token | 输出格式 |
|------|------|------|------|-----------|----------|
| `chat-reply` | channel-content | 消息AI回复（高质量，需角色上下文） | 0.8 | 100 | 文本 |
| `world-director` | channel-director | 世界事件导演（变量化，需世界/剧情变量） | 0.5 | 800 | JSON |
| `world-director-deep` | channel-director | 世界事件导演（深度分析，完整上下文） | 0.5 | 1500 | JSON |
| `content-creator` | channel-content | 内容创作（高创意，需角色心情） | 0.9 | 150 | 文本 |
| `npc-generator` | channel-content | NPC生成器（需世界上下文） | 0.8 | 500 | JSON |
| `world-generator` | channel-world | 大世界生成器（需角色卡+世界书） | 0.7 | 3000 | JSON |
| `world-outline` | channel-world | 世界大纲架构师（真相+洋葱层级+气氛） | 0.7 | 4000 | JSON |
| `world-simulator` | channel-world | 世界推演引擎（世界变化推演） | 0.6 | 2000 | JSON |
| `deviation-analyzer` | channel-director | 偏差分析器（行为偏离评估） | 0.2 | 300 | JSON |
| `stranger-extractor` | channel-content | 陌路人提取器（提取未记录角色） | 0.3 | 500 | JSON |
| `scene-switch` | channel-content | 场景切换引擎（位置切换处理） | 0.6 | 2000 | JSON |
| `local-map-gen` | channel-content | 局部地图生成器（室内/局部场景） | 0.7 | 1500 | JSON |
| `summary-generator` | channel-content | 对话总结器（聊天记录压缩） | 0.2 | 200 | JSON |

#### [v3.0] world-director 变量化提示词

`world-director` 角色使用 `{{world.xxx}}` / `{{story.xxx}}` / `{{sys.xxx}}` 占位符，由 DirectorService 在调用前注入变量：

| 变量 | 来源 | 说明 |
|------|------|------|
| `{{world.name}}` | WorldData | 世界名称 |
| `{{world.era}}` | WorldData | 时代背景 |
| `{{world.theme}}` | WorldData | 主题风格 |
| `{{world.atmosphere}}` | WorldData | 氛围描述 |
| `{{world.currentStage}}` | WorldData.getStage | 当前洋葱层级 |
| `{{world.revealedTruth}}` | DirectorService._formatRevealedTruth | 已揭示真相 |
| `{{world.activeNPCs}}` | NPCData | 活跃NPC列表 |
| `{{world.recentNews}}` | DirectorService._formatRecentNews | 最近世界资讯 |
| `{{story.playerLocation}}` | WorldFactsData | 玩家当前位置 |
| `{{story.playerAction}}` | ContextMonitor | 最新玩家行为 |
| `{{story.lastEvent}}` | StoryEventsData | 最近事件 |
| `{{story.activeQuests}}` | DirectorService._formatActiveQuests | 活跃任务 |
| `{{story.deviationScore}}` | DirectorService | 偏差分数 |
| `{{story.keyRelationships}}` | DirectorService._formatKeyRelationships | 关键关系 |
| `{{sys.pendingTasks}}` | DirectorService | 待执行任务数 |
| `{{sys.triggerCount}}` | DirectorService | 今日已触发次数 |

**深度分析机制**: 当变量信息不足时，`world-director` 返回 `{"events":[], "needDeepAnalysis":true}`，DirectorService 自动切换到 `world-director-deep` 角色并注入完整上下文。

#### 构造函数

```javascript
const gateway = new window.LLMGateway(platform);
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `async (role, context, options?) => Promise<string\|object>` | 统一LLM生成入口 |
| `getRoleConfig` | `async (role) => Promise<object>` | 获取角色配置 |
| `updateRoleConfig` | `async (role, config) => Promise<void>` | 更新角色配置 |
| `resetRoleConfig` | `async (role) => Promise<void>` | 重置角色配置到默认 |
| `getAllRoleConfigs` | `async () => Promise<object>` | 获取所有角色配置 |
| `buildContext` | `async (role, userContext) => Promise<object>` | 构建完整上下文（含缓存） |
| `buildPrompt` | `(roleConfig, context) => string` | 构建Prompt（替换模板变量） |
| `initChannels` | `async () => Promise<void>` | **[v3.0]** 初始化通道配置（从 ApiConfig 或默认值） |
| `updateChannel` | `(channelId: string, config: Object) => void` | **[v3.0]** 更新指定通道配置 |
| `getChannelStatus` | `() => Object` | **[v3.0]** 获取所有通道状态（队列长度/运行数/最大并发） |

#### generate 参数

```typescript
// role: 'chat-reply' | 'world-director' | 'content-creator'
// context: { friendId?, mood?, contentType?, ... }
// options: { model?, temperature?, maxTokens?, timeout? }
```

#### generate 返回值

| 角色 | 返回类型 | 说明 |
|------|----------|------|
| `chat-reply` | `string` | 文本回复 |
| `world-director` | `object` | 已解析的 JSON 对象 `{ events: [...] }` |
| `content-creator` | `string` | 文本内容 |

**重要**：`world-director` 角色因 `outputFormat: 'json'` 配置，LLMGateway 会自动解析 JSON 并返回对象。调用方无需再次 `JSON.parse()`。

#### 上下文三层模型

| 层级 | 内容 | 预估Token |
|------|------|-----------|
| 固定层 | ST人物设定 + 关系状态 | ~800 |
| 滑动窗口 | 最近10条聊天 | ~750 |
| 摘要层 | 最近对话摘要（可选） | ~200 |

#### world-director 事件格式

```json
{
  "events": [
    { "type": "message", "from": "发送者名", "content": "消息内容" },
    { "type": "friend", "name": "角色名", "reason": "认识原因" },
    { "type": "quest", "name": "任务名", "description": "描述" },
    { "type": "status", "target": "属性名", "change": "变化" }
  ]
}
```

#### 使用示例

```javascript
const gateway = new window.LLMGateway(platform);

// 聊天回复
const reply = await gateway.generate('chat-reply', { friendId: 'friend_001' });

// 世界导演决策
const plan = await gateway.generate('world-director', {});
if (plan.events) {
  plan.events.forEach(evt => console.log(evt.type, evt));
}

// 内容创作
const post = await gateway.generate('content-creator', {
  mood: '开心',
  contentType: 'weibo'
});

// 自定义配置
await gateway.updateRoleConfig('chat-reply', { temperature: 0.9, maxTokens: 200 });
```

#### 静态属性

```javascript
window.LLMGateway.DEFAULT_ROLES  // 默认角色配置对象
window.LLMGateway.ROLE_NAMES     // 角色中文名映射
```

---

### WorldBookSyncService - 世界书同步服务

全局访问: `window.PhoneServices.WorldBookSync`

#### 构造函数

```javascript
const syncService = new window.PhoneServices.WorldBookSync(platform);
```

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `async () => Promise<void>` | 初始化，绑定事件监听 |
| `sync` | `async (entry, options?) => Promise<boolean>` | 手动同步摘要到世界书 |
| `syncFromEvent` | `async (eventType, payload) => Promise<boolean>` | 从事件生成摘要并同步 |
| `getHistory` | `async () => Promise<Array>` | 获取已同步的摘要历史 |
| `clearHistory` | `async () => Promise<boolean>` | 清空摘要历史 |
| `setEnabled` | `(enabled: boolean) => void` | 启用/禁用 |
| `setMaxEntries` | `(count: number) => void` | 设置最大保留条数 |

#### sync 参数

```typescript
{
  name?: string;       // 世界书条目名（默认 'phone_events'）
  content: string;     // 摘要内容
  priority?: number;   // 优先级 0-100
}
```

#### 事件

| 事件 | 触发时机 | Payload |
|------|----------|---------|
| `worldbook:synced` | 摘要同步完成 | `{ entryName, content, isDuplicate }` |
| `worldbook:cleared` | 历史清空 | `{}` |

#### 监听的事件源

| 事件 | 优先级 | 说明 |
|------|--------|------|
| `quest:completed` | 100 | 任务完成 |
| `friend:added` | 80 | 新好友 |
| `friend:removed` | 80 | 好友移除 |
| `director:quest` | 70 | 管家触发新任务 |
| `status:changed` | 50 | 状态变化 |

#### 使用示例

```javascript
const sync = new window.PhoneServices.WorldBookSync(platform);
await sync.init();

// 手动同步
await sync.sync({ content: '[任务完成] 玩家完成了"寻找钥匙"任务' });

// 从事件同步
await sync.syncFromEvent('quest:completed', { data: { name: '寻找钥匙' } });

// 查看历史
const history = await sync.getHistory();
```

---

## Platform 适配器层

### SillyTavernAdapter 扩展方法

全局访问: `window.Platform.adapter`（SillyTavernAdapter 实例）

#### 基础方法（已有）

| 方法 | 签名 | 说明 |
|------|------|------|
| `read` | `(key) => Promise<any>` | 读取变量 |
| `write` | `(key, value) => Promise<boolean>` | 写入变量 |
| `delete` | `(key) => Promise<boolean>` | 删除变量 |
| `list` | `(prefix?) => Promise<Array>` | 列出变量 |
| `getChatContext` | `() => object\|null` | 获取ST上下文 |
| `getCurrentCharacter` | `() => object\|null` | 获取当前角色卡 |
| `getWorldInfoEntry` | `(name) => Promise<string\|null>` | 获取世界书条目 |
| `setWorldInfoEntry` | `(name, content) => Promise<boolean>` | 设置世界书条目 |
| `getAIProxyUrl` | `() => string` | 获取AI代理URL |
| `isReady` | `() => boolean` | 适配器是否就绪 |

#### [阶段C] 扩展方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `appendWorldInfo` | `async (entry) => Promise<boolean>` | 追加世界书条目（不覆盖） |
| `getCharacterInfo` | `() => object\|null` | 获取结构化角色信息 |
| `getRecentChatMessages` | `(count?) => Array` | 获取最近N条ST聊天 |
| `getCurrentCharacterId` | `() => string\|null` | 获取当前角色ID |
| `getAllCharacterIds` | `() => Array<string>` | 获取所有角色ID列表 |

#### appendWorldInfo 参数

```typescript
{
  name: string;       // 世界书条目名
  content: string;    // 要追加的内容
  options?: object;   // 预留扩展
}
```

#### getCharacterInfo 返回值

```typescript
{
  id: string;           // 角色ID（avatar字段）
  name: string;         // 角色名
  description: string;  // 角色描述
  personality: string;  // 角色性格
  scenario: string;     // 场景设定
  firstMes: string;     // 开场白
  avatar: string;       // 头像URL
}
```

#### 使用示例

```javascript
const adapter = window.Platform.adapter;

// 追加世界书（不覆盖已有内容）
await adapter.appendWorldInfo({
  name: 'phone_events',
  content: '[任务完成] 玩家完成了"寻找钥匙"任务'
});

// 获取结构化角色信息
const charInfo = adapter.getCharacterInfo();
console.log(charInfo.name, charInfo.personality);

// 获取最近6条ST聊天
const recentMsgs = adapter.getRecentChatMessages(6);

// 获取当前角色ID（用于数据隔离）
const charId = adapter.getCurrentCharacterId();

// 获取所有角色ID
const allIds = adapter.getAllCharacterIds();
```

---

## 工具函数

全局访问: `window.PhoneUtils.*`

### escapeHtml

```javascript
window.PhoneUtils.escapeHtml(text: any): string
```

转义 HTML 特殊字符（`& < > " '`），防止 XSS。

**示例:**
```javascript
const safe = window.PhoneUtils.escapeHtml(userInput);
element.textContent = safe;  // 安全
```

---

## 数据流示例

### 发送消息完整流程

```javascript
// 1. Module 层处理用户交互
class MessageModule extends PhoneApp {
  async _handleSend() {
    const content = input.value;
    
    // 2. 调用 Service 层
    await this._service.sendText(friendId, content);
    // Service 内部会写入 Schema 数据层
  }
}

// 3. Service 层业务处理
class MessageService {
  async sendText(friendId, content) {
    // 验证输入
    if (!content?.trim()) throw new Error('不能为空');
    
    // 4. 写入 Schema 数据层
    const result = await this._messagesData.add(friendId, {
      type: 'text',
      content: content.trim(),
    });
    
    // 5. 更新好友最后消息
    await this._friendsData.updateLastMessage(friendId, content);
    
    return result;
  }
}

// 6. Schema 层写入 Platform DataStore
class MessagesData {
  async add(friendId, message) {
    // 验证数据
    if (window.PhoneSchemas) {
      window.PhoneSchemas.validate('messages', 'list', message);
    }
    
    // 写入 Platform
    await this._platform.setData('messages', friendId, messages);
    
    // 触发事件
    this._platform.emit('messages:added', { friendId, message });
  }
}

// 7. Platform DataStore 持久化
// 8. 订阅者收到通知，自动刷新 UI
```

---

## 新增 Schema 数据层（v4.1）

### WorldFactsData - 世界事实与地点

全局访问: `window.PhoneData.WorldFacts`

```javascript
const worldFacts = new window.PhoneData.WorldFacts(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getFact` | `async (key: string) => Promise<string\|null>` | 获取单个事实 |
| `setFact` | `async (key: string, value: string) => Promise<boolean>` | 设置事实 |
| `getAllFacts` | `async () => Promise<Object>` | 获取所有事实 |
| `deleteFact` | `async (key: string) => Promise<boolean>` | 删除事实 |
| `importFacts` | `async (obj: Object) => Promise<boolean>` | 批量导入事实 |
| `exportFacts` | `async () => Promise<Object>` | 导出所有事实 |
| `getCurrentLocation` | `async () => Promise<string\|null>` | 获取当前位置 |
| `setCurrentLocation` | `async (locId: string) => Promise<boolean>` | 设置当前位置 |
| `getLocation` | `async (locId: string) => Promise<Object\|null>` | 获取地点详情 |
| `addLocation` | `async (location: Object) => Promise<boolean>` | 添加地点（去重） |
| `getNPCsAtLocation` | `async (locId: string) => Promise<Array>` | 获取地点内NPC列表 |
| `addNPCToLocation` | `async (locId: string, npcId: string) => Promise<boolean>` | 添加NPC到地点 |
| `removeNPCFromLocation` | `async (locId: string, npcId: string) => Promise<boolean>` | 从地点移除NPC |
| `getVisitedLocations` | `async () => Promise<Array>` | 获取已访问地点列表 |
| `getAllLocations` | `async () => Promise<Array>` | 获取所有地点列表 |
| `subscribeFacts` | `(callback: Function) => Function` | 订阅事实变更 |
| `subscribeLocations` | `(callback: Function) => Function` | 订阅地点变更 |
| `subscribeCurrentLocation` | `(callback: Function) => Function` | 订阅当前位置变更 |

**地点对象结构:**
```typescript
{ id: string, name: string, type: 'district'|'building'|'room', description: string, npcs?: string[], subLocations?: string[], createdAt: number }
```

---

### CharacterMetadata - 角色元数据缓存

全局访问: `window.PhoneData.CharacterMetadata`

```javascript
const charMeta = new window.PhoneData.CharacterMetadata(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `async (charId: string) => Promise<Object\|null>` | 获取角色元数据 |
| `set` | `async (charId: string, data: Object) => Promise<boolean>` | 设置角色元数据（完整写入） |
| `update` | `async (charId: string, partial: Object) => Promise<boolean>` | 部分更新角色元数据 |
| `delete` | `async (charId: string) => Promise<boolean>` | 删除角色元数据 |
| `getTags` | `async (charId: string) => Promise<Array>` | 获取角色标签 |
| `addTag` | `async (charId: string, tag: string) => Promise<boolean>` | 添加标签（去重） |
| `removeTag` | `async (charId: string, tag: string) => Promise<boolean>` | 移除标签 |
| `getAll` | `async () => Promise<Array>` | 获取所有角色元数据 |
| `findByTag` | `async (tag: string) => Promise<Array>` | 按标签筛选角色 |
| `subscribeMeta` | `(charId: string, callback: Function) => Function` | 订阅角色元数据变更 |

**角色元数据结构:**
```typescript
{ id: string, name: string, description: string, personality: string, scenario: string, firstMes: string, avatar: string, tags: string[], createdAt: number, updatedAt: number }
```

---

### StoryEventsData - 事件时间线

全局访问: `window.PhoneData.StoryEvents`

```javascript
const storyEvents = new window.PhoneData.StoryEvents(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `add` | `async (event: Object) => Promise<Object>` | 添加事件（自动生成id/time，上限200条） |
| `getRecent` | `async (count?: number) => Promise<Array>` | 获取最近N条事件 |
| `getByType` | `async (type: string, limit?: number) => Promise<Array>` | 按类型筛选事件 |
| `getByActor` | `async (actorName: string, limit?: number) => Promise<Array>` | 按参与者筛选事件 |
| `getByLocation` | `async (location: string, limit?: number) => Promise<Array>` | 按地点筛选事件 |
| `getById` | `async (eventId: string) => Promise<Object\|null>` | 获取单个事件 |
| `delete` | `async (eventId: string) => Promise<boolean>` | 删除事件 |
| `linkEvents` | `async (eventId1: string, eventId2: string) => Promise<boolean>` | 建立事件双向关联 |
| `getRelated` | `async (eventId: string) => Promise<Array>` | 获取关联事件列表 |
| `getTimeline` | `async (start?: number, end?: number) => Promise<Array>` | 获取时间线（按时间范围） |
| `getStats` | `async () => Promise<Object>` | 获取事件统计 |
| `clearAll` | `async () => Promise<boolean>` | 清空所有事件 |
| `subscribeEvents` | `(callback: Function) => Function` | 订阅事件列表变更 |

**事件对象结构:**
```typescript
{ id: string, time: number, type: string, summary: string, actors: string[], location: string, impact: string, relatedEvents: string[] }
```

---

### StoryEvolutionData - 剧情演变

全局访问: `window.PhoneData.StoryEvolution`

```javascript
const storyEvo = new window.PhoneData.StoryEvolution(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getTimeline` | `async (charId: string) => Promise<{ points: Array }>` | 获取角色剧情演变时间线 |
| `saveTimeline` | `async (charId: string, timeline: Object) => Promise<void>` | 保存剧情演变时间线 |
| `addPoint` | `async (charId: string, point: Object) => Promise<Object>` | 添加演变点（上限100个） |
| `getRecent` | `async (charId: string, count: number) => Promise<Array>` | 获取最近N个演变点 |

---

### NPCData - NPC数据

全局访问: `window.PhoneData.NPC`

```javascript
const npcData = new window.PhoneData.NPC(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getAll` | `async (charId: string) => Promise<Array>` | 获取角色下所有NPC |
| `saveAll` | `async (charId: string, npcs: Array) => Promise<void>` | 保存所有NPC列表 |
| `getById` | `async (charId: string, npcId: string) => Promise<Object\|null>` | 按ID获取NPC |
| `add` | `async (charId: string, npc: Object) => Promise<Object>` | 添加NPC |
| `update` | `async (charId: string, npcId: string, updates: Object) => Promise<Object\|null>` | 更新NPC |
| `getContacts` | `async (charId: string) => Promise<Array>` | 获取联系人列表 |
| `getStrangers` | `async (charId: string) => Promise<Array>` | 获取陌生人列表 |

---

### MapData - 地图数据

全局访问: `window.PhoneData.Map`

```javascript
const mapData = new window.PhoneData.Map(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getWorldMap` | `async (charId: string) => Promise<Object\|null>` | 获取世界地图数据 |
| `saveWorldMap` | `async (charId: string, mapData: Object) => Promise<void>` | 保存世界地图数据 |
| `getLocalMap` | `async (charId: string, locationId: string) => Promise<Object\|null>` | 获取局部地图 |
| `saveLocalMap` | `async (charId: string, locationId: string, mapData: Object) => Promise<void>` | 保存局部地图 |
| `getCurrentLocation` | `async (charId: string) => Promise<string\|null>` | 获取当前位置 |
| `setCurrentLocation` | `async (charId: string, locationId: string) => Promise<void>` | 设置当前位置 |

---

### WorldData - 大世界数据

全局访问: `window.PhoneData.World`

```javascript
const worldData = new window.PhoneData.World(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `async (charId: string) => Promise<Object\|null>` | 获取大世界数据 |
| `save` | `async (charId: string, worldData: Object) => Promise<void>` | 保存大世界数据 |
| `exists` | `async (charId: string) => Promise<boolean>` | 检查大世界数据是否存在 |
| `delete` | `async (charId: string) => Promise<void>` | 删除大世界数据 |
| `updateStage` | `async (charId: string, newStage: number) => Promise<void>` | **[v3.0]** 更新洋葱层级揭示状态（1-5） |
| `getStage` | `async (charId: string) => Promise<number>` | **[v3.0]** 获取当前揭示层级（默认1） |

---

### DirectorData - 导演系统数据

全局访问: `window.PhoneData.Director`

```javascript
const directorData = new window.PhoneData.Director(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getPlan` | `async () => Promise<Object\|null>` | 获取当前导演计划 |
| `setPlan` | `async (plan: Object) => Promise<boolean>` | 设置导演计划 |
| `clearPlan` | `async () => Promise<boolean>` | 清空导演计划 |
| `getStatus` | `async () => Promise<Object>` | 获取导演状态 |
| `updateStatus` | `async (updates: Object) => Promise<boolean>` | 更新导演状态 |
| `isEnabled` | `async () => Promise<boolean>` | 检查导演是否启用 |
| `setEnabled` | `async (enabled: boolean) => Promise<boolean>` | 启用/禁用导演 |
| `recordInteraction` | `async (action: string, data?: Object) => Promise<boolean>` | 记录用户手机操作 |
| `getLastInteraction` | `async () => Promise<Object\|null>` | 获取最近用户操作 |
| `recordUserChoice` | `async (choiceId: string, choiceText: string) => Promise<boolean>` | 记录用户选择 |
| `getLastUserChoice` | `async () => Promise<Object\|null>` | 获取最近用户选择 |
| `recordTaskResult` | `async (questId: string, result: string) => Promise<boolean>` | 记录任务结果 |
| `getLastTaskResult` | `async () => Promise<Object\|null>` | 获取最近任务结果 |
| `addHistory` | `async (decision: Object) => Promise<boolean>` | 添加导演决策历史（上限50条） |
| `getHistory` | `async (limit?: number) => Promise<Array>` | 获取导演决策历史 |
| `clearHistory` | `async () => Promise<boolean>` | 清空历史记录 |
| `subscribePlan` | `(callback: Function) => Function` | 订阅导演计划变更 |
| `subscribeStatus` | `(callback: Function) => Function` | 订阅导演状态变更 |

---

### ApiClientData - API客户端数据（已废弃）

全局访问: `window.PhoneData.ApiClient`

> **@deprecated** 已废弃，请使用 `ApiConfigData`（domain: `'apiConfig'`）。此文件仅为兼容旧数据迁移保留。

```javascript
const apiClient = new window.PhoneData.ApiClient(platform);
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getConfig` | `async () => Promise<Object>` | 获取API配置 |
| `updateConfig` | `async (config: Object) => Promise<boolean>` | 更新API配置 |
| `setApiKey` | `async (apiKey: string) => Promise<boolean>` | 设置API密钥 |
| `setBaseUrl` | `async (baseUrl: string) => Promise<boolean>` | 设置基础URL |
| `setEnabled` | `async (enabled: boolean) => Promise<boolean>` | 启用/禁用API |
| `getHistory` | `async () => Promise<Array>` | 获取请求历史 |
| `addHistory` | `async (record: Object) => Promise<Object>` | 添加请求历史 |
| `clearHistory` | `async () => Promise<boolean>` | 清空历史记录 |
| `getPrompts` | `async () => Promise<Object>` | 获取预设提示词 |
| `updatePrompt` | `async (key: string, prompt: string) => Promise<boolean>` | 更新预设提示词 |
| `getCache` | `async () => Promise<Object>` | 获取缓存数据 |
| `setCache` | `async (key: string, value: any, ttl?: number) => Promise<boolean>` | 设置缓存（带TTL） |
| `getCacheValue` | `async (key: string) => Promise<any>` | 获取缓存值（自动过期检查） |
| `clearExpiredCache` | `async () => Promise<number>` | 清除过期缓存 |
| `subscribeConfig` | `(callback: Function) => Function` | 订阅配置变更 |
| `subscribeHistory` | `(callback: Function) => Function` | 订阅历史记录变更 |

---

## 新增 Service 业务层（v4.1）

### NPCGeneratorService - NPC生成服务

全局访问: `window.PhoneServices.NPCGenerator`

```javascript
const npcGen = new window.PhoneServices.NPCGenerator(platform);
```

**依赖**: `PhoneData.Friends`, `PhoneData.StoryEvents`

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `async (context: { name, role, description }) => Promise<Object\|null>` | 生成NPC并添加到通讯录。调用AI生成人设，写入Friends Schema，记录事件到时间线 |

---

### ContextManagerService - 上下文管理服务

全局访问: `window.PhoneServices.ContextManager`

```javascript
const ctxMgr = new window.PhoneServices.ContextManager(platform);
```

**依赖**: `PhoneData.Friends`, `PhoneData.CharacterMetadata`

| 方法 | 签名 | 说明 |
|------|------|------|
| `buildMessageContext` | `async (options?: { charId?, groupId? }) => Promise<Object>` | 构建消息上下文（支持群组） |
| `refreshCharacterMeta` | `async (charId: string) => Promise<void>` | 刷新角色元数据缓存 |

---

### WorldService - 大世界生成服务

全局访问: `window.PhoneServices.World`

```javascript
const worldService = new window.PhoneServices.World(platform);
```

**依赖**: `PhoneData.World`, `PhoneData.Map`, `PhoneData.NPC`, `LLMGateway`, `Platform.adapter`

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `generateWorld` | `async (charId: string, options?: Object) => Promise<{ world, worldMap, npcs, profile }>` | 生成大世界。收集角色卡/世界书/XBX数据，调用LLM生成世界设定、NPC、地图、经济档案 |
| `generateWorldV2` | `async (charId: string, options?: Object) => Promise<{ world, worldMap, npcs, profile }>` | **[v3.0]** 两步生成：Step1 world-outline 生成大纲（真相+洋葱层级+气氛）→ Step2 world-generator 填充细节。失败自动降级为单步生成 |
| `getWorld` | `async (charId: string) => Promise<Object\|null>` | 获取指定角色的世界数据 |
| `isWorldGenerated` | `async (charId: string) => Promise<boolean>` | 检查世界是否已生成 |
| `resetWorld` | `async (charId: string) => Promise<void>` | 重置世界 |

#### generateWorld options

```typescript
{
  useXBXVectors?: boolean;   // 是否使用小白X向量数据
  useWorldBook?: boolean;    // 是否使用世界书
  useCharCard?: boolean;     // 是否使用角色卡信息
}
```

#### 事件

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `world:generated` | 世界生成完成 | `{ charId, worldName, npcCount }` |
| `world:reset` | 世界重置 | `{ charId }` |

---

### DataCleanupService - 数据清理服务

全局访问: `window.PhoneServices.DataCleanup`

> 已在 API_REFERENCE.md 中记录，此处为补充说明。

**数据分层**:
- 角色卡领域: `friends`, `messages`, `quest`, `profile`, `diary`, `status`, `live`, `weibo`, `forum`, `shop`, `backpack`, `friendsCircle`
- 全局领域: `apiConfig`, `settings`, `sticker`

---

### WorldBookSyncService - 世界书同步服务

> 已在 API_REFERENCE.md 中记录，此处为补充说明。

**监听的事件源**:

| 事件 | 优先级 | 说明 |
|------|--------|------|
| `quest:completed` | 100 | 任务完成 |
| `friend:added` | 80 | 新好友 |
| `friend:removed` | 80 | 好友移除 |
| `director:quest` | 70 | 管家触发新任务 |
| `status:changed` | 50 | 状态变化 |

---

### AttachmentService - 附件发送服务

全局访问: `window.PhoneServices.Attachment`

```javascript
const attachment = new window.PhoneServices.Attachment(platform);
```

**依赖**: `PhoneServices.Message`（统一发送入口）

| 方法 | 签名 | 说明 |
|------|------|------|
| `sendImage` | `async (friendId: string, source: File\|Blob\|string, options?: Object) => Promise<Object>` | 发送图片消息。支持URL/File/Blob |
| `sendImages` | `async (friendId: string, sources: Array<File\|Blob\|string>) => Promise<Array<Object>>` | 批量发送图片 |
| `sendFile` | `async (friendId: string, file: File) => Promise<Object>` | 发送文件消息 |
| `sendVoiceWithAudio` | `async (friendId: string, audioBlob: Blob\|File, duration: number, text?: string) => Promise<Object>` | 发送语音文件 |
| `sendVideo` | `async (friendId: string, source: File\|Blob\|string, options?: Object) => Promise<Object>` | 发送视频消息 |
| `sendLocation` | `async (friendId: string, location: { latitude, longitude, name?, address? }) => Promise<Object>` | 发送位置消息 |

---

### QuestService - 任务系统服务（扩展版）

全局访问: `window.PhoneServices.Quest`

```javascript
const questService = new window.PhoneServices.Quest(platform);
```

**依赖**: `PhoneData.Task`, `PhoneData.Director`

**静态常量**:
```javascript
window.PhoneServices.Quest.STATUS = { LOCKED, AVAILABLE, ACTIVE, COMPLETED, FAILED, ARCHIVED }
window.PhoneServices.Quest.TYPE = { MAIN, SIDE, DAILY, EVENT }
```

| 方法 | 签名 | 说明 |
|------|------|------|
| `getRegistry` | `async () => Promise<Object>` | 获取任务注册表 |
| `saveRegistry` | `async (registry: Object) => Promise<void>` | 保存任务注册表 |
| `getAllQuests` | `async () => Promise<Array>` | 获取所有任务 |
| `getQuest` | `async (questId: string) => Promise<Object\|null>` | 获取指定任务 |
| `getActiveQuests` | `async () => Promise<Array>` | 获取活跃任务 |
| `getAvailableQuests` | `async () => Promise<Array>` | 获取可用任务 |
| `getQuestsByType` | `async (type: string) => Promise<Array>` | 按类型筛选任务 |
| `acceptQuest` | `async (questId: string) => Promise<boolean>` | 接取任务（检查前置条件） |
| `completeQuest` | `async (questId: string) => Promise<boolean>` | 完成任务（处理奖励、解锁链式任务） |
| `failQuest` | `async (questId: string) => Promise<boolean>` | 标记任务失败 |
| `createQuest` | `async (questDef: Object) => Promise<Object>` | 创建新任务 |
| `handleDirectorNotify` | `async (notify: Object) => Promise<Object>` | 处理导演系统任务通知 |

#### 事件

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `quest:registryUpdated` | 注册表更新 | `{}` |
| `quest:accepted` | 任务接取 | `{ questId, quest }` |
| `quest:completed` | 任务完成 | `{ questId, quest }` |
| `quest:failed` | 任务失败 | `{ questId, quest }` |
| `quest:created` | 任务创建 | `{ quest }` |
| `quest:unlocked` | 链式任务解锁 | `{ questId, quest }` |

---

### InvitationService - 邀约服务

全局访问: `window.PhoneServices.Invitation`

```javascript
const invitationService = new window.PhoneServices.Invitation(platform);
```

**依赖**: `PhoneData.Invitation`, `PhoneData.NPC`, `PhoneData.History`

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `async () => Promise<void>` | 初始化服务 |
| `createInvitation` | `async (charId: string, options: object) => Promise<object\|null>` | 创建邀约 |
| `acceptInvitation` | `async (charId: string, invitationId: string, extra?: object) => Promise<object\|null>` | 接受邀约 |
| `declineInvitation` | `async (charId: string, invitationId: string, reason?: string) => Promise<object\|null>` | 拒绝邀约 |
| `getPendingInvitations` | `async (charId: string) => Promise<Array>` | 获取待处理邀约 |
| `getAllInvitations` | `async (charId: string) => Promise<Array>` | 获取所有邀约 |
| `getInvitationsByNPC` | `async (charId: string, npcId: string) => Promise<Array>` | 获取NPC的邀约 |
| `cancelInvitation` | `async (charId: string, invitationId: string) => Promise<object\|null>` | 取消邀约 |
| `deleteInvitation` | `async (charId: string, invitationId: string) => Promise<boolean>` | 删除邀约 |
| `clearCompleted` | `async (charId: string) => Promise<number>` | 清理已完成邀约 |
| `destroy` | `() => void` | 销毁服务 |

#### 事件

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `invitation:created` | 邀约创建 | `{ invitationId, npcId, npcName, type }` |
| `invitation:accepted` | 邀约接受 | `{ invitationId, npcId, npcName, relatedQuestId }` |
| `invitation:declined` | 邀约拒绝 | `{ invitationId, npcId, npcName, reason }` |
| `invitation:expired` | 邀约过期 | `{ invitationId, npcId, npcName }` |
| `invitation:cancelled` | 邀约取消 | `{ invitationId, npcId, npcName }` |

---

### PredictionService - 推演服务

全局访问: `window.PhoneServices.Prediction`

```javascript
const predictionService = new window.PhoneServices.Prediction(platform);
```

**依赖**: `PhoneData.Prediction`, `PhoneData.Quest`, `LLMGateway`

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `async () => Promise<void>` | 初始化服务 |
| `generatePrediction` | `async (charId: string, questId: string, context?: object) => Promise<object\|null>` | 生成任务推演 |
| `getPrediction` | `async (charId: string, questId: string) => Promise<object\|null>` | 获取推演 |
| `updatePrediction` | `async (charId: string, questId: string, updates: object) => Promise<object\|null>` | 更新推演 |
| `selectBranch` | `async (charId: string, questId: string, branchIndex: number) => Promise<object\|null>` | 选择分支 |
| `markRiskRealized` | `async (charId: string, questId: string, riskIndex: number) => Promise<object\|null>` | 标记风险实现 |
| `recordActualResult` | `async (charId: string, questId: string, result: object) => Promise<object\|null>` | 记录实际结果 |
| `getSummary` | `async (charId: string, questId: string) => Promise<string>` | 获取推演摘要 |
| `formatForAI` | `async (charId: string, questId: string, options?: object) => Promise<string\|null>` | 格式化为AI上下文 |
| `deletePrediction` | `async (charId: string, questId: string) => Promise<boolean>` | 删除推演 |
| `clearOldPredictions` | `async (charId: string, olderThan: number) => Promise<number>` | 清理旧推演 |

#### 事件

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `prediction:created` | 推演创建 | `{ questId, prediction }` |
| `prediction:updated` | 推演更新 | `{ questId, updates }` |
| `prediction:branchSelected` | 分支选择 | `{ questId, branchIndex, branch }` |

---

### EconomyService - 经济服务

> [v4.31-fix] 移除了对 questService 的直接调用，改为发射 `economy:transactionCompleted` 事件。

全局访问: `window.PhoneServices.Economy`（通过 `Platform.get('economyService')`）

| 方法 | 签名 | 说明 |
|------|------|------|
| `getBalance` | `(currencyType?: string) => Promise<number>` | 获取指定货币余额 |
| `canAfford` | `(amount: number, currencyType?: string) => Promise<boolean>` | 检查是否负担得起 |
| `add` | `(amount: number, currencyType?: string, reason?: string) => Promise<object>` | 增加货币 |
| `spend` | `(amount: number, currencyType?: string, reason?: string) => Promise<object>` | 消费货币 |
| `applyReward` | `(reward: object) => Promise<void>` | 应用任务奖励 |
| `addGold` | `(amount: number) => Promise<object>` | 快捷增加金币 |
| `spendGold` | `(amount: number) => Promise<object>` | 快捷消费金币 |
| `ensureStarterWallet` | `() => Promise<void>` | 确保初始钱包存在 |

#### 事件

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `economy:credited` | 收入 | `{ amount, currencyType, reason, newBalance }` |
| `economy:spent` | 支出 | `{ amount, currencyType, reason, newBalance }` |
| `economy:transactionCompleted` | 交易完成 | `{ action, amount, currencyType, reason }` |

---

### BankService - 银行服务

> [v4.31-fix] 新增 `getWalletGold` 和 `getHistory` 方法。

全局访问: `window.PhoneServices.Bank`（通过 `Platform.get('bankService')`）

| 方法 | 签名 | 说明 |
|------|------|------|
| `getBalance` | `() => Promise<number>` | 获取银行存款余额 |
| `depositFromWallet` | `(amount: number) => Promise<object>` | 从钱包存入银行 |
| `withdrawToWallet` | `(amount: number) => Promise<object>` | 从银行提取到钱包 |
| `transferInterest` | `(rate?: number) => Promise<number>` | 计算并发放利息 |
| `getWalletGold` | `() => Promise<number>` | 获取钱包金币余额（封装 EconomyService） |
| `getHistory` | `(limit?: number) => Promise<Array>` | 获取最近交易记录（默认5条） |

---

### StockService - 股票服务

全局访问: `window.PhoneServices.Stock`（通过 `Platform.get('stockService')`）

| 方法 | 签名 | 说明 |
|------|------|------|
| `getMarket` | `() => Promise<object>` | 获取股市行情（含随机波动） |
| `getPortfolio` | `() => Promise<object>` | 获取持仓信息 |
| `buy` | `(stockCode: string, quantity: number) => Promise<object>` | 买入股票 |
| `sell` | `(stockCode: string, quantity: number) => Promise<object>` | 卖出股票 |

---

### AvatarService - 头像服务

> [v4.31-fix] avatar-settings-module 现在通过此 Service 读写头像数据。

全局访问: `window.PhoneServices.Avatar`（通过 `Platform.get('avatarService')`）

| 方法 | 签名 | 说明 |
|------|------|------|
| `getWeiboAvatar` | `() => Promise<string>` | 获取微博头像 URL |
| `getCircleAvatar` | `() => Promise<string>` | 获取朋友圈头像 URL |
| `getCurrentAvatars` | `() => Promise<object>` | 获取所有头像 |
| `setWeiboAvatar` | `(url: string) => Promise<void>` | 设置微博头像 |
| `setCircleAvatar` | `(url: string) => Promise<void>` | 设置朋友圈头像 |
| `saveAvatars` | `(avatars: object) => Promise<void>` | 保存所有头像 |
| `getAvailableAvatars` | `() => Promise<Array>` | 获取可用头像列表 |
| `addToGallery` | `(url: string) => Promise<void>` | 添加到头像库 |
| `pickLocalImage` | `() => Promise<string>` | 选择本地图片 |
| `assignRandomNPCAvatars` | `(charId: string) => Promise<void>` | 为NPC分配随机头像 |

#### 事件

| 事件名 | 触发时机 | data 内容 |
|--------|----------|-----------|
| `avatar:updated` | 头像变更 | `{ weiboAvatar, circleAvatar }` |

---

## 新增 Module 模块层（v4.1）

### ProfileModule - 档案模块

全局访问: `window.PhoneModules.Profile`

| 属性 | 值 |
|------|------|
| id | `'profile'` |
| name | `'档案'` |
| icon | `'👤'` |
| iconBg | `'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'` |
| 依赖Service | `PhoneServices.Profile` |
| 额外依赖 | `PhoneData.NPC`（世界NPC视图） |

**交互功能**: 添加档案、AI生成档案、同步世界书、世界NPC列表、查看/删除档案

---

### DiaryModule - 日记模块

全局访问: `window.PhoneModules.Diary`

| 属性 | 值 |
|------|------|
| id | `'diary'` |
| name | `'日记'` |
| icon | `'📖'` |
| iconBg | `'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)'` |
| 依赖Service | `PhoneServices.Diary` |
| 额外依赖 | `PhoneData.StoryEvolution`（剧情推演时间线） |

**交互功能**: 写日记、AI生成日记、剧情推演、搜索、统计、查看/删除日记

---

### LiveModule - 直播模块

全局访问: `window.PhoneModules.Live`

| 属性 | 值 |
|------|------|
| id | `'live'` |
| name | `'直播'` |
| icon | `'📺'` |
| iconBg | `'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)'` |
| 依赖Service | `PhoneServices.Live` |

**交互功能**: 进入直播间、发送弹幕、AI弹幕、送礼物、开始/结束直播、观看历史

**特殊行为**: 通过 `Platform.on('message:received')` 订阅消息事件解析直播消息（铁则二合规）

---

### TaskModule - 任务模块

全局访问: `window.PhoneModules.Task`

| 属性 | 值 |
|------|------|
| id | `'task'` |
| name | `'任务'` |
| icon | `'📋'` |
| iconBg | `'linear-gradient(135deg, #f5af19 0%, #f12711 100%)'` |
| 依赖Service | `PhoneServices.Task` |

**交互功能**: 筛选任务（all/active/status）、家族信息、新增任务、接受/更新进度/完成/删除任务

---

### InventoryModule - 背包模块

全局访问: `window.PhoneModules.Inventory`

| 属性 | 值 |
|------|------|
| id | `'inventory'` |
| name | `'背包'` |
| icon | `'🎁'` |
| iconBg | `'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'` |
| 依赖Service | `PhoneServices.Inventory` |

**交互功能**: Tab切换（物品/装备/货币）、类型筛选、使用/装备/卸下物品、更新货币

---

### ShopModule - 商店模块

全局访问: `window.PhoneModules.Shop`

| 属性 | 值 |
|------|------|
| id | `'shop'` |
| name | `'商店'` |
| icon | `'🏬'` |
| iconBg | `'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'` |
| 依赖Service | `PhoneServices.Shop` |
| 额外依赖 | `PhoneServices.Inventory`（AI推荐上下文） |

**交互功能**: 分类切换、购物车、加入/移除/修改数量/清空购物车、结算、AI推荐

---

### StatusModule - 状态模块

全局访问: `window.PhoneModules.Status`

| 属性 | 值 |
|------|------|
| id | `'status'` |
| name | `'状态'` |
| icon | `'📊'` |
| iconBg | `'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'` |
| 依赖Service | `PhoneServices.Status` |

**交互功能**: 编辑用户状态、穿搭、添加/查看记忆、添加/编辑NPC及NPC记忆

---

### ForumModule - 论坛模块

全局访问: `window.PhoneModules.Forum`

| 属性 | 值 |
|------|------|
| id | `'forum'` |
| name | `'论坛'` |
| icon | `'💬'` |
| iconBg | `'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'` |
| 依赖Service | `PhoneServices.Forum` |

**交互功能**: 发帖、AI生成帖子、点赞、回复、AI回复、删除帖子、设置论坛风格（normal/anonymous/roleplay）

---

### FriendModule - 好友模块

全局访问: `window.PhoneModules.Friend`

| 属性 | 值 |
|------|------|
| id | `'friend'` |
| name | `'好友'` |
| icon | `'👥'` |
| iconBg | 未设置 |
| 依赖Service | `PhoneServices.Friend` |
| 额外依赖 | `PhoneDialog`（群聊创建） |

**交互功能**: 好友列表、新的朋友、群聊、接受/拒绝好友请求、添加好友、搜索过滤

**特殊行为**: `onPause`/`onResume` 中缓存/恢复添加好友表单数据

---

## 版本信息

- **版本**: 4.1.1
- **更新日期**: 2026-05-19
- **更新内容**:
  - [4.1.1] T1修复: 启动时序对齐铁则四 - 新增6阶段事件广播（BRIDGE_READY→PLATFORM_READY→SCHEMAS_READY→SERVICES_READY→MODULES_READY→APP_READY）
  - [4.1.1] T2修复: 内联模块拆分 - 设置/头像设置/通讯录/相册模块从index.js拆分到独立文件（铁则十八）
  - [4.1.1] T3修复: 移除SillyTavern.getContext()直接调用，改为Platform.adapter.getSTContext()（铁则六）
  - [4.1.1] T4修复: DirectorService._dispatchEvent()通过Schema/适配器写入，不再直接调用Platform.setData（铁则一）
  - [4.1.1] T5修复: 删除wrapModule()，改为createModuleObject()支持toPlainObject()工厂方法（铁则五）
  - [4.1.1] T6修复: EventBus双版本统一，platform.js内置版标记为@deprecated降级备用（铁则十六）
  - [4.1.1] 新增SillyTavernAdapter.getSTContext()公开接口
  - [4.1.1] 新增MODULES/placeholders.js、settings-module.js、avatar-settings-module.js
  - [4.1.0] API文档补全 - 9个新增Schema、7个新增Service、9个新增Module
  - [4.1.0] 新增大世界系统 - WorldFacts/World/Map/NPC/StoryEvents/StoryEvolution/CharacterMetadata Schema
  - [4.1.0] 新增WorldService - 大世界生成服务（LLM驱动）
  - [4.1.0] 新增NPCGeneratorService - NPC生成服务
  - [4.1.0] 新增ContextManagerService - 上下文管理服务（预算控制）
  - [4.1.0] 新增QuestService - 任务系统服务（扩展版，支持链式任务/前置条件/奖励）
  - [4.1.0] 新增AttachmentService - 附件发送服务（图片/文件/语音/视频/位置）
  - [4.1.0] 新增DirectorData Schema - 导演系统数据层
  - [4.1.0] ApiClientData 标记为 @deprecated
  - [4.0.8] 合并 API设置 + LLM配置 为统一设置面板（删除独立 llm-config-module）
  - [4.0.8] 提示词占位符提示（动态显示可用占位符列表）
  - [4.0.7] DirectorService._parseResult 修复 - 处理 LLMGateway 返回的对象类型
  - [4.0.7] API文档 - LLMGateway.generate 返回值类型说明
  - [4.0.6] API文档补全 - DirectorService/WorkflowEngine/59个emit事件
  - [4.0.6] LLMConfigModule 重构为实例独立模式（修复 _container undefined）
  - [4.0.4] LLMConfigModule 手动注册到 index.js（修复时序问题）
  - [4.0.3] LLMGateway 默认配置填充（修复面板空白）
  - [4.0.1] LLMGateway AIService 实例化修复
  - [4.0] DirectorService 增强 / WorkflowEngine 状态机重构 / WorldBookSyncService
  - [4.0] Service emit全覆盖 - 12个Service共59个emit事件
  - [4.0] SillyTavernAdapter扩展 / 直播礼物类型修复
  - [P3] 全局主题系统 - design-tokens + animation-library
  - [P0] 消息类型注册表 - 8种消息类型渲染器
  - [P0] 通知横幅系统 - iOS风格通知
  - [P0] 嵌套壁纸系统 - 3层视差壁纸
  - [P1] 反馈引擎 - 声效 + 触觉反馈
  - [P1] 下拉刷新组件 - iOS风格
  - [P1] @提及系统 - 好友选择下拉
  - [P1] 已读回执系统 - 消息状态追踪
  - [P2] 直播沉浸模式 - 全屏直播间 + 弹幕飞入 + 礼物特效
  - [P2] 日记沉浸写作 - 心情氛围 + AI打字机 + 热力图
  - [修复] 数据持久化问题 - 刷新/重启后数据不再丢失
  - [新增] DataStore 数据恢复机制 - 启动时自动从持久化层恢复数据
  - [新增] 所有领域完整注册 - 确保数据正确持久化
  - [增强] Schema 层数据加载逻辑 - 等待 Platform 就绪后再读取
  - [增强] 数据写入后立即刷新 - 确保数据持久化到存储层
  - 新增 Service 业务层
  - 重写 Module 模块层
  - 统一 HTML 转义工具
  - 修复 XSS 安全漏洞
  - 修复 async/await bug
  - API 密钥混淆存储
  - 统一网络请求入口

---

## 数据持久化机制

### 数据流

```
写入流程:
Module → Service → Schema._set → Platform.setData → DataStore.set → _pendingWrites → flush() → Adapter.write

读取流程（修复后）:
启动 → Platform.init → DataStore.registerDomain → _loadDomainData（恢复数据）→ 缓存
Module → Service → Schema._get → Platform.data → DataStore.get（从缓存读取）
```

### 关键修复点

1. **DataStore 数据恢复**: `registerDomain()` 时自动从持久化层恢复数据
2. **完整领域注册**: 所有数据领域在启动时完整注册
3. **立即刷新**: 数据写入后立即调用 `flush()` 确保持久化
4. **Platform 就绪等待**: Schema 层读取数据前等待 Platform 就绪

---

## [v3.0] 大世界系统 - 新增 API

### LLMChannelConfig - 通道配置

全局访问: `window.LLMChannelConfig`

**文件**: `CONFIG/llm-channels.js`

| 方法/属性 | 签名 | 说明 |
|-----------|------|------|
| `DEFAULT_CHANNELS` | `Object` | 四通道默认配置（channel-world/director/content/fallback） |
| `CHANNEL_PRESETS` | `Object` | 预设模板（default/high-performance/cost-saving） |
| `getDefaults` | `() => Object` | 获取默认通道配置的深拷贝 |
| `getPreset` | `(presetName: string) => Object\|null` | 获取指定预设模板 |

---

### DirectorService - [v3.0] 变量化方法扩展

**设计原则**: 零存储、零双写。变量每次调用时实时从源头 Schema 读取，不维护内存副本（铁则八）。

以下方法由 DirectorService 内部使用，负责实时提取和格式化变量：

| 方法 | 签名 | 说明 |
|------|------|------|
| `_getVariables` | `async (charId) => Promise<Object>` | **核心方法**：实时从 WorldData/NPCData/StoryEvents/FriendsData/WorldFactsData 提取所有变量，返回 `{ world.*, story.*, sys.* }` |
| `_formatRevealedTruth` | `(world, stage) => string` | 格式化已揭示的洋葱层级真相 |
| `_formatRecentNews` | `(world) => string` | 格式化最近世界资讯 |
| `_extractLastEvent` | `async (charId) => Promise<string>` | 提取最近一条事件摘要 |
| `_formatActiveQuests` | `async (charId) => Promise<string>` | 格式化活跃任务列表 |
| `_formatKeyRelationships` | `async (charId) => Promise<string>` | 格式化关键NPC关系 |
| `_getWorldContext` | `async (charId) => Promise<string>` | 获取完整世界上下文（深度分析用） |

**管家独立运行**: 当世界数据不存在时（`world.name` 为 `'未知'`），管家自动降级为基于 ST 上下文 + 聊天记录的独立决策模式，不会停摆。

---

### ContextAssembler - [v3.0] 新增装配方法

全局访问: `window.ContextAssembler`

| 方法 | 签名 | 说明 |
|------|------|------|
| `assembleForWorldOutline` | `async (inputs) => Promise<string>` | 装配世界大纲生成上下文（角色卡+世界书） |
| `assembleForSimulation` | `async (inputs) => Promise<string>` | 装配世界推演上下文（当前状态+玩家行为） |
| `assembleForDeviation` | `async (inputs) => Promise<string>` | 装配偏差分析上下文（世界规则+玩家行为） |
| `assembleForSceneSwitch` | `async (inputs) => Promise<string>` | 装配场景切换上下文（新旧位置+世界背景） |

---

### WorldService - [v3.0] 两步生成流程

```
generateWorldV2(charId, options) 流程:

Step 1: world-outline（channel-world, DeepSeek V4）
  输入: 角色卡 + 世界书 → ContextAssembler.assembleForWorldOutline()
  输出: { meta: { truth, onion_layers, atmosphere, trajectory } }

Step 2: world-generator（channel-world, DeepSeek V4）
  输入: Step1 大纲 + 角色卡 → _outlineToDetails()
  输出: { name, era, theme, npcs, keyLocations, factions, rules, ... }

合并: _mergeWorldData(outline, details) → 完整世界数据

降级: Step1 或 Step2 失败 → 回退到 generateWorld() 单步生成
```

---

### 洋葱层级系统

| 层级 | 名称 | 说明 |
|------|------|------|
| L1 | TheVeil（表层叙事） | 玩家初始看到的正常世界 |
| L2 | TheDistortion（异常现象） | 开始出现违和感 |
| L3 | TheLaw（隐藏规则） | 世界运转的真实规则 |
| L4 | TheAgent（执行者） | 维护世界秩序的实体 |
| L5 | TheAxiom（终极真相） | 世界的终极秘密 |

**层级揭示条件**: 偏差分数（deviation score）达到阈值时，由 `world-simulator` 推演引擎决定是否揭示下一层级。

**层级管理 API**:
```javascript
const worldData = new window.PhoneData.World(platform);

// 更新层级（1-5）
await worldData.updateStage(charId, 3);

// 获取当前层级
const stage = await worldData.getStage(charId); // 默认 1
```

---

## [v4.0] Phase 8 新增 API

### 专家系统 (Expert System)

全局访问: `window.*Expert`

专家系统提供基于 LLM 的内容生成能力，所有专家继承自 `BaseExpert`。

#### BaseExpert - 专家基类

```javascript
const expert = new window.BaseExpert(platform, config);
```

**配置选项:**
```typescript
{
  expertId: string;      // 专家唯一标识
  channel: string;       // LLM 通道名称
  role: string;          // LLM 角色配置名称
}
```

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: object) => Promise<object\|null>` | 生成内容的主入口 |
| `_buildPrompt` | `(context: object) => Promise<object>` | 构建 Prompt 上下文（可重写） |
| `_callLLM` | `(context: object) => Promise<object>` | 调用 LLM（内部使用） |
| `_parseResponse` | `(response: any) => object\|null` | 解析 LLM 响应 |
| `_validateResult` | `(result: object) => boolean` | 验证结果有效性（可重写） |
| `_tryRepairJSON` | `(text: string) => object\|null` | 尝试修复并解析 JSON |
| `_generateId` | `() => string` | 生成唯一 ID |
| `_getTimestamp` | `() => number` | 获取当前时间戳 |
| `_formatDate` | `(timestamp: number) => string` | 格式化日期 |
| `_getSafe` | `(obj: object, path: string, defaultValue?: any) => any` | 安全获取嵌套属性 |
| `_truncate` | `(text: string, maxLength: number) => string` | 截断文本 |

#### ShopExpert - 商店专家

```javascript
const shopExpert = new window.ShopExpert(platform);
```

**职责:** 根据世界上下文生成商店商品列表

**输出格式:**
```typescript
{
  items: [{
    id: string;
    name: string;
    category: 'consumable' | 'equipment' | 'material' | 'collectible' | 'gift';
    price: number;
    description: string;
    worldTag: string;
    effects: [{ type: string, value: number }];
    usableIn: string[];
    icon: string;
  }],
  meta: {
    generatedAt: number;
    worldName: string;
    itemCount: number;
    expertId: string;
  }
}
```

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: ShopContext) => Promise<object\|null>` | 生成商店商品 |
| `generateFallbackItem` | `(template?: object) => object` | 生成单个商品（降级模式） |
| `generateFallbackItems` | `(count?: number) => object` | 生成默认商品列表 |

**上下文参数:**
```typescript
{
  worldName?: string;      // 世界名称
  worldTheme?: string;     // 世界主题
  era?: string;            // 时代背景
  itemCount?: number;      // 生成商品数量（默认8）
}
```

#### NewsExpert - 新闻专家

```javascript
const newsExpert = new window.NewsExpert(platform);
```

**职责:** 生成世界新闻和头条

**输出格式:**
```typescript
{
  news: [{
    title: string;
    content: string;
    category: 'world' | 'local' | 'gossip' | 'business' | 'emergency' | 'entertainment';
    relatedNPC: string;
  }],
  meta: { generatedAt, worldName, newsCount, expertId }
}
```

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: NewsContext) => Promise<object\|null>` | 生成新闻 |
| `generateFallbackNews` | `(count?: number) => object` | 生成默认新闻 |
| `generateHotSearch` | `(count?: number) => object` | 生成热搜列表 |
| `_formatHeat` | `(heat: number) => string` | 格式化热度数字 |

#### NPCExpert - NPC 专家

```javascript
const npcExpert = new window.NPCExpert(platform);
```

**职责:** 生成 NPC 消息内容

**输出格式:**
```typescript
{
  messages: [{
    fromId: string;
    from: string;
    content: string;
    emotion: 'happy' | 'sad' | 'angry' | 'worried' | 'excited' | 'neutral' | 'surprised' | 'affectionate';
    timestamp: number;
  }],
  meta: { generatedAt, npcId, npcName, expertId }
}
```

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: NPCContext) => Promise<object\|null>` | 生成 NPC 消息 |
| `generateFallbackMessages` | `(context: object) => object` | 生成默认消息 |
| `quickGenerate` | `(npcName, content?, emotion?) => object` | 快速生成单条消息 |

**上下文参数:**
```typescript
{
  npcId: string;           // NPC ID
  npcName?: string;        // NPC 名称
  npcPersonality?: string; // NPC 性格
  relationship?: string;   // 与主角关系
  messageType?: 'greeting' | 'chat' | 'quest' | 'event' | 'emotion' | 'request';
  triggerEvent?: object;   // 触发事件
  messageCount?: number;   // 生成数量（默认1）
}
```

#### SocialExpert - 社交专家

```javascript
const socialExpert = new window.SocialExpert(platform);
```

**职责:** 生成 NPC 社交互动内容（朋友圈、微博等）

**输出格式:**
```typescript
{
  interactions: [{
    npcId: string;
    type: 'moment' | 'weibo' | 'like' | 'comment' | 'share' | 'mention';
    content: string;
    author: string;
    timestamp: number;
  }],
  meta: { generatedAt, npcId, interactionType, expertId }
}
```

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: SocialContext) => Promise<object\|null>` | 生成社交互动 |
| `generateMoment` | `(context: object) => object` | 生成朋友圈内容 |
| `generateWeibo` | `(context: object) => object` | 生成微博内容 |
| `generateFallbackInteractions` | `(context: object) => object` | 生成默认互动 |
| `generateBatch` | `(npcList: Array, context: object) => Promise<Array>` | 批量生成多个 NPC 互动 |

#### QuestExpert - 任务专家

```javascript
const questExpert = new window.QuestExpert(platform);
```

**职责:** 生成游戏任务

**输出格式:**
```typescript
{
  quests: [{
    id: string;
    name: string;
    type: 'main' | 'side' | 'daily' | 'event' | 'challenge';
    description: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    steps: [{ order, type, label, target, params, completed }];
    rewards: { gold, exp, items };
    penalty: { type, value };
    expiresAt: number;
    relatedNPC: string;
    worldTag: string;
    createdAt: number;
    status: 'pending';
  }],
  meta: { generatedAt, questType, expertId }
}
```

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generate` | `(context: QuestContext) => Promise<object\|null>` | 生成任务 |
| `generateFallbackQuests` | `(context: object) => object` | 生成默认任务 |
| `quickGenerate` | `(name, description?, steps?) => object` | 快速生成简单任务 |
| `generateStarterQuests` | `() => object` | 生成新手任务 |

**步骤类型:**
```typescript
'open_app' | 'send_message' | 'visit_location' | 'interact_npc' | 
'complete_task' | 'spend_gold' | 'send_gift' | 'shop_checkout' | 'custom'
```

#### WorldExpert - 世界生成专家

```javascript
const worldExpert = new window.PhoneServices.WorldExpert(platform);
```

**职责:** 负责世界生成的两阶段流程

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `generateStep1` | `(charId: string, options?: object) => Promise<object>` | Step1: 生成世界大纲 |
| `generateStep2` | `(charId: string, options?: object) => Promise<object>` | Step2: 生成世界细节 |
| `generateFullWorld` | `(charId: string, options?: object) => Promise<object>` | 完整世界生成（两阶段） |

**Step1 输出结构:**
```typescript
{
  meta: {
    truth: { background, driver: { source, target_end, tactic } };
    onion_layers: { L1_TheVeil, L2_TheDistortion, L3_TheLaw, L4_TheAgent, L5_TheAxiom };
    atmosphere: { reasoning, current: { mood, tension_level, visual_style } };
    trajectory: { reasoning, ending };
    user_guide: { how_to_play, key_mechanics, tips };
  }
}
```

**Step2 输出结构:**
```typescript
{
  world: { news: [...] };
  maps: { outdoor: {...}, inside: {...} };
  npcs: [...];
  rules: [...];
  factions: [...];
  playerLocation: string;
}
```

---

### 新增/扩展 Schema API

#### WorldData V2 - 大世界数据（扩展）

```javascript
const worldData = new window.PhoneData.World(platform);
```

**V2 新增方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `saveStep1` | `(charId: string, data: object) => Promise<void>` | 保存 Step1 世界大纲 |
| `getStep1` | `(charId: string) => Promise<object\|null>` | 获取 Step1 数据 |
| `saveStep2` | `(charId: string, data: object) => Promise<void>` | 保存 Step2 世界细节 |
| `getStep2` | `(charId: string) => Promise<object\|null>` | 获取 Step2 数据 |
| `getTruth` | `(charId: string) => Promise<object>` | 获取世界真相 |
| `getOnionLayers` | `(charId: string) => Promise<object>` | 获取洋葱层级 |
| `getAtmosphere` | `(charId: string) => Promise<object>` | 获取气氛基调 |
| `getTrajectory` | `(charId: string) => Promise<object>` | 获取主线轨迹 |
| `getUserGuide` | `(charId: string) => Promise<object>` | 获取用户指南 |

**数据键名格式:**
- `{charId}:world:step1` - Step1 数据
- `{charId}:world:step2` - Step2 数据
- `{charId}:world:main` - V1 兼容数据

#### MapData - 地图数据（新增）

```javascript
const mapData = new window.PhoneData.Map(platform);
```

**职责:** 管理地图数据、玩家位置、偏差分数

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `get` | `(charId: string) => Promise<object>` | 获取地图数据 |
| `save` | `(charId: string, data: object) => Promise<void>` | 保存地图数据 |
| `delete` | `(charId: string) => Promise<void>` | 删除地图数据 |
| `exists` | `(charId: string) => Promise<boolean>` | 检查地图是否存在 |
| `updatePlayerLocation` | `(charId: string, locationId: string) => Promise<boolean>` | 更新玩家位置 |
| `addVisitedLocation` | `(charId: string, locationId: string) => Promise<boolean>` | 添加已访问位置 |
| `calculateDeviation` | `(charId: string, newLocation: string) => Promise<object>` | 计算位置偏差分数 |
| `getDeviationScore` | `(charId: string) => Promise<number>` | 获取偏差分数 |
| `getPlayerLocation` | `(charId: string) => Promise<string>` | 获取玩家当前位置 |
| `getVisitedLocations` | `(charId: string) => Promise<Array>` | 获取已访问位置列表 |
| `getOutdoorMap` | `(charId: string) => Promise<object>` | 获取室外地图 |
| `getInsideMap` | `(charId: string) => Promise<object>` | 获取室内地图 |
| `updateOutdoorMap` | `(charId: string, data: object) => Promise<void>` | 更新室外地图 |
| `updateInsideMap` | `(charId: string, data: object) => Promise<void>` | 更新室内地图 |

**数据键名:** `{charId}:map:main`

**数据结构:**
```typescript
{
  outdoor: {
    name: string;
    description: string;
    nodes: [{ name, position, type, info, distant }];
  };
  inside: {
    name: string;
    description: string;
    nodes: [{ name, type, info, interactable, actions }];
  };
  playerLocation: string;
  visitedLocations: string[];
  deviationScore: number;
  createdAt: number;
  updatedAt: number;
}
```

#### PromptData - Prompt 模板数据（新增）

```javascript
const promptData = new window.PhoneData.Prompt(platform);
```

**职责:** 管理专家系统的 Prompt 模板

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `getSystemTemplate` | `(expertName: string) => Promise<string>` | 获取系统模板 |
| `getUserTemplate` | `(expertName: string) => Promise<string>` | 获取用户模板 |
| `saveUserTemplate` | `(expertName: string, template: string) => Promise<void>` | 保存用户模板 |
| `setUseUserTemplate` | `(expertName: string, useUser: boolean) => Promise<void>` | 设置是否使用用户模板 |
| `isUseUserTemplate` | `(expertName: string) => Promise<boolean>` | 检查是否使用用户模板 |
| `getPromptConfig` | `(expertName: string) => Promise<object>` | 获取完整配置 |
| `savePromptConfig` | `(expertName: string, config: object) => Promise<void>` | 保存完整配置 |
| `deletePromptConfig` | `(expertName: string) => Promise<void>` | 删除配置 |
| `resetToDefault` | `(expertName: string, defaultTemplate?: string) => Promise<void>` | 重置为默认 |
| `getAllPromptNames` | `() => Promise<Array>` | 获取所有 Prompt 名称 |
| `getEffectiveTemplate` | `(expertName: string, defaultTemplate?: string) => Promise<string>` | 获取最终使用的模板 |

**数据键名:** `global:prompt:{expertName}`

---

### 新增 Service API

#### MapService - 地图服务

```javascript
const mapService = window.Platform.get('mapService');
// 或
const mapService = new window.PhoneServices.Map(platform);
```

**职责:** 地图业务逻辑 - 场景切换、偏差计算、任务进度检查

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `() => Promise<void>` | 初始化服务 |
| `travelTo` | `(charId: string, locationId: string) => Promise<object>` | 场景切换 - 前往指定地点 |
| `getLocationInfo` | `(charId: string, locationId: string) => Promise<object\|null>` | 获取地点信息 |
| `getIndoorNodes` | `(charId: string, locationId: string) => Promise<Array>` | 获取室内可交互节点 |
| `checkQuestProgress` | `(charId: string, action: string, target: string) => Promise<Array>` | 检查任务进度 |
| `getFullMapData` | `(charId: string) => Promise<object>` | 获取完整地图数据（用于渲染） |
| `getCurrentLocation` | `(charId: string) => Promise<object\|null>` | 获取当前位置信息 |
| `getDeviationScore` | `(charId: string) => Promise<number>` | 获取偏差分数 |
| `getVisitStats` | `(charId: string) => Promise<object>` | 获取已访问统计 |

**发射事件:**
- `map:location:changed` - 位置变更
- `map:deviation:calculated` - 偏差计算完成
- `quest:progress:updated` - 任务进度更新

#### SocialService - NPC 社交服务

```javascript
const socialService = window.Platform.get('socialService');
// 或
const socialService = new window.PhoneServices.Social(platform);
```

**职责:** 处理 NPC 互动概率计算、冷却管理、调用 SocialExpert 生成互动内容

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `checkNPCInteraction` | `(charId: string, contentType: string, contentId: string) => Promise<Array>` | 检查并触发 NPC 互动 |
| `executeLike` | `(npcId: string, contentType: string, contentId: string) => Promise<boolean>` | 执行 NPC 点赞 |
| `executeComment` | `(npcId: string, contentType: string, contentId: string, comment: string) => Promise<boolean>` | 执行 NPC 评论 |
| `getNPCInteractionStats` | `(npcId: string) => Promise<object>` | 获取 NPC 互动统计 |
| `resetInteractionHistory` | `() => void` | 重置互动历史（用于测试） |

**发射事件:**
- `social:npcInteractions` - NPC 互动生成
- `social:npcLiked` - NPC 点赞
- `social:npcCommented` - NPC 评论

**关系等级:**
```typescript
{
  stranger: 0,      // 陌生人 5% 互动概率
  acquaintance: 1,  // 熟人 20% 互动概率
  friend: 2,        // 好友 50% 互动概率
  intimate: 3       // 亲密 80% 互动概率
}
```

---

### 新增 Module API

#### MapModule - 地图模块

```javascript
// 通过 PhoneShell 注册
shell.registerModule(window.PhoneModules.Map.toPlainObject());
```

**模块信息:**
```typescript
{
  id: 'map';
  name: '地图';
  icon: '🗺️';
  iconBg: 'linear-gradient(135deg, #3385ff 0%, #4a9eff 100%)';
}
```

**职责:** 管理地图 UI、用户交互、场景切换

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(platform: Platform) => Promise<void>` | 初始化模块 |
| `render` | `() => Promise<HTMLElement>` | 渲染模块 UI |
| `handleLocationClick` | `(locationId: string) => Promise<void>` | 处理地点点击 |
| `handleTravelClick` | `(locationId: string) => Promise<void>` | 处理前往按钮点击 |
| `handleIndoorNodeClick` | `(nodeName: string) => Promise<void>` | 处理室内节点点击 |
| `refreshUI` | `() => Promise<void>` | 刷新 UI |
| `resume` | `(params?: object) => void` | 模块恢复 |
| `pause` | `() => void` | 模块暂停 |
| `destroy` | `() => void` | 销毁模块 |

**订阅事件:**
- `map:location:changed` - 位置变更
- `map:deviation:calculated` - 偏差计算
- `quest:progress:updated` - 任务进度更新

---

### MapRenderer - 地图渲染器

```javascript
const mapRenderer = new window.PhoneRenderers.Map();
```

**职责:** 地图 UI 渲染 - 百度地图风格设计

**方法:**

| 方法 | 签名 | 说明 |
|------|------|------|
| `injectStyles` | `() => void` | 注入样式 |
| `renderMapPanel` | `(data: object, callbacks: object) => HTMLElement` | 渲染整个地图面板 |
| `renderLocationList` | `(locations, playerLocation, onClick) => HTMLElement` | 渲染左侧地点列表 |
| `renderLocationDetail` | `(locationData, indoorNodes, questMarkers, callbacks) => HTMLElement` | 渲染右侧地点详情 |
| `renderIndoorScene` | `(insideData, onNodeClick) => HTMLElement` | 渲染室内场景节点 |
| `renderIndoorPanel` | `(data, callbacks) => HTMLElement` | 渲染室内场景面板 |

**样式类名:**
- `.map-panel` - 地图面板容器
- `.map-header` - 头部区域
- `.map-body` - 主体区域
- `.map-location-list` - 地点列表
- `.map-detail-panel` - 详情面板
- `.map-indoor-grid` - 室内节点网格
- `.map-quest-marker` - 任务标记
- `.map-footer` - 底部状态栏

---

*本文档由自动化工具生成，如有疑问请参考源码注释。*
