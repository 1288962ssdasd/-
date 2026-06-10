# 外置手机 4.0 - Mobile Phone Plugin

> 一款为 SillyTavern 设计的移动端沉浸式插件，提供完整的手机模拟体验，包括消息聊天、社交互动、世界探索等功能。

## 版本信息

- **版本号**: v4.0
- **发布日期**: 2026-05-26
- **兼容平台**: SillyTavern (ST)
- **架构版本**: Platform 架构 v3.3.2-fix

---

## 功能特性

### 核心功能

| 功能模块 | 描述 | 状态 |
|---------|------|------|
| 消息系统 | 模拟手机聊天界面，支持文字、语音、红包、转账 | ✅ 可用 |
| 微博系统 | 发布动态、浏览热搜、NPC 互动 | ✅ 可用 |
| 朋友圈 | 分享生活点滴、好友点赞评论 | ✅ 可用 |
| 地图导航 | 百度地图风格的世界探索、场景切换 | ✅ 可用 |
| 任务系统 | 主线/支线/日常任务，步骤追踪 | ✅ 可用 |
| 背包商店 | 物品管理、购买出售、使用效果 | ✅ 可用 |
| 银行系统 | 存款取款、转账汇款 | ✅ 可用 |
| 股票系统 | 模拟股市交易 | ✅ 可用 |
| 日记系统 | 沉浸式日记写作 | ✅ 可用 |
| 直播系统 | 观看直播、弹幕互动 | ✅ 可用 |
| 论坛系统 | 社区讨论、帖子发布 | ✅ 可用 |

### 高级功能

#### 世界生成系统 (v4.0 新增)
- **两阶段生成流程**: Step1 生成世界大纲，Step2 生成世界细节
- **洋葱层级系统**: L1-L5 渐进式世界真相揭示
- **动态 NPC 生成**: 基于世界观的智能 NPC 创建
- **地图自动生成**: 室内外场景自动构建

#### 专家系统 (v4.0 新增)
| 专家类型 | 功能描述 |
|---------|---------|
| BaseExpert | 专家基类，提供通用 LLM 调用接口 |
| ShopExpert | 生成符合世界观的商店商品 |
| NewsExpert | 生成世界新闻和头条 |
| NPCExpert | 生成 NPC 消息内容 |
| SocialExpert | 生成 NPC 社交互动 |
| QuestExpert | 生成游戏任务 |
| WorldExpert | 世界生成专家 |

#### AI 导演系统
- 智能剧情决策
- 上下文感知的事件触发
- 动态任务生成
- NPC 行为编排

---

## 安装说明

### 前置要求

- SillyTavern 最新版本
- 现代浏览器 (Chrome/Firefox/Edge)
- 启用 JavaScript

### 安装步骤

1. **下载插件**
   ```bash
   # 下载 mobile_plugin_v4.0_final.zip
   # 解压到 SillyTavern 的扩展目录
   ```

2. **放置文件**
   ```
   SillyTavern/
   └── public/
       └── scripts/
           └── extensions/
               └── third-party/
                   └── mobile/          <-- 解压到此目录
                       ├── index.js
                       ├── API_REFERENCE.md
                       ├── README.md
                       ├── APP/
                       ├── BRIDGE/
                       ├── CONFIG/
                       ├── CORE/
                       ├── MODULES/
                       ├── PLATFORM/
                       ├── RENDERERS/
                       ├── SCHEMA/
                       ├── SERVICES/
                       └── UTILS/
   ```

3. **启用插件**
   - 启动 SillyTavern
   - 进入扩展管理页面
   - 找到 "Mobile Phone 3.0" 并启用

4. **验证安装**
   - 页面右下角应出现手机图标
   - 点击图标可打开手机界面
   - 控制台应显示 `[Phone Init] 插件初始化完成`

---

## 使用说明

### 基础操作

#### 打开手机
- 点击页面右下角的浮动手机图标
- 或使用快捷键 (可在设置中配置)

#### 切换应用
- 点击底部 Dock 栏的应用图标
- 左右滑动屏幕切换页面

#### 返回桌面
- 点击 Home 按钮
- 从底部向上滑动

### 世界生成

#### 创建新世界
1. 打开 "设置" 应用
2. 进入 "世界生成" 选项
3. 点击 "生成新世界"
4. 等待两阶段生成完成
5. 查看生成的世界大纲和地图

#### 探索世界
1. 打开 "地图" 应用
2. 查看当前位置和周围地点
3. 点击地点查看详情
4. 点击 "前往此处" 进行场景切换
5. 探索室内场景和交互节点

### 地图导航

#### 查看地图
- 打开 "地图" 应用
- 左侧显示地点列表
- 右侧显示选中地点详情
- 底部显示探索进度和偏差值

#### 场景切换
1. 在地图中选择一个地点
2. 查看地点详情和任务标记
3. 点击 "前往此处" 按钮
4. 系统计算偏差值并更新位置
5. 触发相关任务进度检查

#### 室内探索
- 进入建筑物后显示室内节点
- 点击节点进行交互
- 发现隐藏物品和任务线索

### 任务系统

#### 查看任务
- 打开 "任务" 应用
- 查看进行中的任务列表
- 点击任务查看详情和步骤

#### 完成任务
1. 根据任务指引执行操作
2. 步骤自动追踪和完成
3. 获得任务奖励
4. 解锁新的任务和剧情

#### 任务类型
- **主线任务**: 推动剧情发展
- **支线任务**: 丰富世界内容
- **日常任务**: 每日刷新，获取资源
- **事件任务**: 限时触发，特殊奖励

---

## 架构说明

### 16项铁则体系

本插件严格遵循以下架构铁则:

| 铁则 | 描述 | 实现方式 |
|-----|------|---------|
| 铁则一 | 数据读写唯一通道 | 所有数据通过 `Schema` 辅助函数读写 |
| 铁则二 | WebSocket 只死在适配器里 | WebSocket 封装在适配器内部 |
| 铁则三 | 模块三层分离 | Service/Module/Renderer 严格分离 |
| 铁则四 | 启动时序严格串行 | BRIDGE_READY → PLATFORM_READY → SCHEMAS_READY → SERVICES_READY → MODULES_READY → APP_READY |
| 铁则五 | 模块注册必须用 `__phoneShell.registerModule` | moduleObject 为普通对象，包含 id 属性 |
| 铁则六 | 环境适配在入口处完成 | `platform-init.js` 检测环境并选择适配器 |
| 铁则七 | 不猜测 API，必须验证 | 使用 `Object.getOwnPropertyNames()` 确认方法名 |
| 铁则八 | 状态管理禁止双写 | 数据始终通过 Service 从 DataStore 获取 |
| 铁则九 | 错误处理必须降级 | 所有异步操作有 `.catch` 或 `try/catch`，失败输出 `console.warn` |
| 铁则十 | AGENT 改代码时的检查清单 | 提交前运行 `npm run arch-check` |
| 铁则十二 | 交互数据契约 | Module 只能调用 Service 方法，Service 是唯一数据加工厂 |
| 铁则十三 | 数据隔离 | 角色卡数据 `{charId}:{domain}:{key}`，全局数据 `global:{domain}:{key}` |
| 铁则十四 | API 文档与代码强制同步 | 新增 API 必须同步更新 `API_REFERENCE.md` |
| 铁则十五 | 提交前必须通过架构检查 | 执行 `npm run arch-check` |
| 铁则十六 | 基础设施唯一性 | 每种核心基础设施只有一个实现文件 |
| 铁则十七 | 入口文件行数上限 | `index.js` 不超过 800 行 |
| 铁则十八 | 模块注册零内联 | Module 定义位于独立文件，`index.js` 只进行注册 |

### 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Module 层                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Message │ │  Weibo  │ │   Map   │ │  Quest  │ ...        │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │                  │
│       └───────────┴───────────┴───────────┘                  │
│                   事件总线 (EventBus)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Service 层                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Message │ │  Weibo  │ │   Map   │ │  Quest  │ ...        │
│  │ Service │ │ Service │ │ Service │ │ Service │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │                  │
│       └───────────┴───────────┴───────────┘                  │
│                   专家系统 (Expert System)                    │
│         ShopExpert / NewsExpert / NPCExpert ...              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Schema 层                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Messages │ │  Weibo  │ │   Map   │ │  Quest  │ ...        │
│  │  Data   │ │  Data   │ │  Data   │ │  Data   │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │                  │
│       └───────────┴───────────┴───────────┘                  │
│                   Platform API                               │
│              data() / setData() / subscribeData()            │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
mobile/
├── index.js                    # 插件入口
├── API_REFERENCE.md            # API 文档
├── README.md                   # 本文件
├── APP/                        # 应用模块
│   └── debug-bridge-module.js  # 调试桥接模块
├── BRIDGE/                     # 桥接层
│   └── st-phone-bridge.js      # SillyTavern 桥接
├── CONFIG/                     # 配置文件
│   ├── llm-channels.js         # LLM 通道配置
│   └── platform-config.js      # 平台配置
├── CORE/                       # 核心组件
│   ├── phone-core.js           # 手机核心
│   ├── phone-shell.js          # 手机壳框架
│   ├── phone-renderer.js       # 渲染器
│   ├── llm-gateway.js          # LLM 网关
│   ├── workflow-engine.js      # 工作流引擎
│   └── ...                     # 其他核心组件
├── MODULES/                    # 功能模块
│   ├── msg-module.js           # 消息模块
│   ├── weibo-module.js         # 微博模块
│   ├── map-module.js           # 地图模块
│   ├── quest-module.js         # 任务模块
│   └── ...                     # 其他模块
├── PLATFORM/                   # 平台层
│   ├── platform.js             # Platform 核心
│   ├── data-store.js           # 数据存储
│   ├── event-bus.js            # 事件总线
│   ├── sillytavern-adapter.js  # ST 适配器
│   └── ...                     # 其他平台组件
├── RENDERERS/                  # 渲染器
│   ├── map-renderer.js         # 地图渲染器
│   └── ...                     # 其他渲染器
├── SCHEMA/                     # 数据 Schema
│   ├── world-data.js           # 世界数据 (V2)
│   ├── map-data.js             # 地图数据
│   ├── prompt-data.js          # Prompt 数据
│   ├── messages-data.js        # 消息数据
│   └── ...                     # 其他 Schema
├── SERVICES/                   # 业务服务
│   ├── experts/                # 专家系统
│   │   ├── base-expert.js      # 专家基类
│   │   ├── shop-expert.js      # 商店专家
│   │   ├── news-expert.js      # 新闻专家
│   │   ├── npc-expert.js       # NPC 专家
│   │   ├── social-expert.js    # 社交专家
│   │   ├── quest-expert.js     # 任务专家
│   │   └── world-expert.js     # 世界专家
│   ├── map-service.js          # 地图服务
│   ├── social-service.js       # 社交服务
│   └── ...                     # 其他服务
└── UTILS/                      # 工具函数
    └── escape.js               # HTML 转义
```

---

## 更新日志

### v4.0 (2026-05-26)

#### 新增功能
- **专家系统**: 7 个专家类 (BaseExpert, ShopExpert, NewsExpert, NPCExpert, SocialExpert, QuestExpert, WorldExpert)
- **地图系统**: 完整的地图导航和场景切换功能
- **世界生成 V2**: 两阶段世界生成流程 (Step1 + Step2)
- **SocialService**: NPC 社交互动服务
- **PromptData**: Prompt 模板数据管理

#### 架构改进
- 完善三层分离架构
- 优化启动时序
- 增强错误处理降级机制
- 统一数据键名格式

#### API 更新
- 新增专家系统 API
- 扩展 WorldData V2 API
- 新增 MapData API
- 新增 PromptData API
- 新增 MapService API
- 新增 SocialService API
- 新增 MapModule API

### v3.3.2-fix (2026-05-20)

#### 修复
- 修复服务注册时序问题（铁则四）
- 修复 AIService 未注册到 Platform 问题（铁则七）
- 修复 DirectorService 初始化异步等待问题

### v3.3.1 (2026-05-15)

#### 新增
- 银行系统
- 股票系统
- 任务系统扩展

### v3.3.0 (2026-05-10)

#### 新增
- 大世界系统
- 洋葱层级系统
- AI 导演系统

### v3.2.0 (2026-05-01)

#### 新增
- 日记沉浸模式
- 直播沉浸模式
- 背包系统

### v3.1.0 (2026-04-20)

#### 新增
- Platform 架构
- 事件总线系统
- 工作流引擎

### v3.0.0 (2026-04-01)

#### 初始版本
- 消息系统
- 微博系统
- 朋友圈系统
- 基础手机界面

---

## 开发文档

### API 参考

详见 [API_REFERENCE.md](./API_REFERENCE.md)

### 调试命令

在浏览器控制台中可用:

```javascript
// 查看模块状态
MobileContext.debugModuleStatus();

// 查看 Schema 状态
MobileContext.debugSchemaStatus();

// 查看服务状态
MobileContext.debugServiceStatus();
```

### 事件监听

```javascript
// 监听位置变更
window.Platform.eventBus.on('map:location:changed', (data) => {
  console.log('位置变更:', data);
});

// 监听任务进度
window.Platform.eventBus.on('quest:progress:updated', (data) => {
  console.log('任务进度:', data);
});
```

---

## 许可证

MIT License

---

## 贡献者

- 沉淀/夜宵宵夜

---

## 支持与反馈

如有问题或建议，请通过以下方式联系:

- GitHub Issues
- 社区论坛

---

**注意**: 本文档最后更新于 2026-05-26，对应插件版本 v4.0
