# 外置手机 3.0 测试用例

## 版本：3.4.0
## 日期：2026-05-14

---

## 一、跨域问题修复测试

### TC-001：AI API 代理健康检查

**前置条件：** SillyTavern 服务已启动

**测试步骤：**
1. 打开浏览器开发者工具
2. 执行以下命令：
```javascript
fetch('/api/plugins/xb-bridge-test/ai/proxy/health')
  .then(r => r.json())
  .then(console.log)
```

**预期结果：**
```json
{
  "status": "ok",
  "message": "AI Proxy 路由就绪",
  "timestamp": "2026-05-14T..."
}
```

---

### TC-002：AI API 代理调用

**前置条件：** 已配置 AI API（baseUrl、apiKey）

**测试步骤：**
1. 打开浏览器开发者工具
2. 执行以下命令：
```javascript
fetch('/api/plugins/xb-bridge-test/ai/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseUrl: 'https://api.openai.com',
    apiKey: 'YOUR_API_KEY',
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 50
  })
})
  .then(r => r.json())
  .then(console.log)
```

**预期结果：**
- 返回 AI 响应 JSON
- 无 CORS 错误

---

### TC-003：AIService 生成测试

**前置条件：** Platform 已初始化，API 已配置

**测试步骤：**
```javascript
const ai = new PhoneServices.AI(window.Platform);
ai.generate('你好，请回复"测试成功"')
  .then(console.log)
  .catch(console.error);
```

**预期结果：**
- 返回 AI 生成的文本
- 无 CORS 错误

---

## 二、EventBus 测试

### TC-010：基本事件监听

**测试步骤：**
```javascript
const bus = new EventBus();
let received = false;

bus.on('test:event', (data) => {
  received = true;
  console.log('收到事件:', data);
});

bus.emit('test:event', { message: 'hello' });
console.log('事件已触发, received:', received);
```

**预期结果：**
- 控制台输出 "收到事件: {message: 'hello'}"
- `received` 为 `true`

---

### TC-011：优先级排序

**测试步骤：**
```javascript
const bus = new EventBus();
const order = [];

bus.on('test:priority', () => order.push('low'), { priority: 0 });
bus.on('test:priority', () => order.push('high'), { priority: 100 });
bus.on('test:priority', () => order.push('medium'), { priority: 50 });

bus.emit('test:priority', {});
console.log('执行顺序:', order);
```

**预期结果：**
- 输出 `['high', 'medium', 'low']`

---

### TC-012：通配符匹配

**测试步骤：**
```javascript
const bus = new EventBus();
const results = [];

bus.on('domain:*', (data) => results.push('prefix:' + data.type));
bus.on('*', (data) => results.push('global:' + data.type));

bus.emit('domain:event', { type: 'event' });
console.log('匹配结果:', results);
```

**预期结果：**
- 输出 `['prefix:event', 'global:event']`

---

### TC-013：去重保护

**测试步骤：**
```javascript
const bus = new EventBus();
let count = 0;

bus.on('test:dedup', () => count++);

// 快速连续触发
bus.emit('test:dedup', {});
bus.emit('test:dedup', {});
bus.emit('test:dedup', {});

console.log('触发次数:', count);
```

**预期结果：**
- `count` 为 1（50ms 内只触发一次）

---

## 三、ContextMonitor 测试

### TC-020：初始化测试

**测试步骤：**
```javascript
const monitor = new ContextMonitor(window.Platform);
monitor.init();
console.log('ContextMonitor 初始化:', !!monitor.eventListeners);
```

**预期结果：**
- 输出 `true`

---

### TC-021：上下文获取

**测试步骤：**
```javascript
const monitor = new ContextMonitor(window.Platform);
const ctx = monitor.getCurrentContext();
console.log('当前上下文:', ctx);
```

**预期结果：**
- 返回包含 `chatId`、`characterId` 等字段的对象

---

## 四、WorkflowEngine 测试

### TC-030：工作流注册

**测试步骤：**
```javascript
const engine = new WorkflowEngine(window.Platform);

engine.register({
  id: 'test.workflow',
  name: '测试工作流',
  trigger: { type: 'variable_changed', pattern: 'test.trigger' },
  actions: [
    { type: 'event_emit', params: { event: 'test:executed' } }
  ]
});

console.log('已注册工作流:', engine.listWorkflows());
```

**预期结果：**
- 输出包含 `test.workflow` 的数组

---

### TC-031：手动触发工作流

**测试步骤：**
```javascript
const engine = new WorkflowEngine(window.Platform);

engine.register({
  id: 'test.manual',
  name: '手动测试',
  trigger: { type: 'engine_event', pattern: 'manual:trigger' },
  actions: [
    { type: 'event_emit', params: { event: 'test:manual:done' } }
  ]
});

window.Platform.eventBus.on('test:manual:done', () => {
  console.log('工作流执行完成');
});

engine.trigger('test.manual');
```

**预期结果：**
- 输出 "工作流执行完成"

---

## 五、DirectorService 测试

### TC-040：导演状态获取

**测试步骤：**
```javascript
const director = window.Platform?.services?.get('director');
if (director) {
  director.getStatus().then(console.log);
}
```

**预期结果：**
- 返回包含 `enabled`、`lastRun` 等字段的对象

---

### TC-041：导演启用/禁用

**测试步骤：**
```javascript
const director = window.Platform?.services?.get('director');
if (director) {
  director.setEnabled(false);
  director.getStatus().then(s => console.log('enabled:', s.enabled));
  
  director.setEnabled(true);
  director.getStatus().then(s => console.log('enabled:', s.enabled));
}
```

**预期结果：**
- 第一次输出 `enabled: false`
- 第二次输出 `enabled: true`

---

### TC-042：手动触发导演

**测试步骤：**
```javascript
const director = window.Platform?.services?.get('director');
if (director) {
  director.manualTrigger().then(() => {
    console.log('导演触发完成');
  }).catch(console.error);
}
```

**预期结果：**
- 如果 API 已配置，输出 "导演触发完成"
- 如果 API 未配置，输出错误信息

---

## 六、QuestService 测试

### TC-050：任务创建

**测试步骤：**
```javascript
const quest = new PhoneServices.Quest(window.Platform);
quest.createQuest({
  name: '测试任务',
  description: '这是一个测试任务',
  questType: 'side',
  reward: { money: 100 }
}).then(console.log);
```

**预期结果：**
- 返回包含 `id`、`name`、`status: 'available'` 的任务对象

---

### TC-051：任务接取

**测试步骤：**
```javascript
const quest = new PhoneServices.Quest(window.Platform);

// 先创建任务
quest.createQuest({ name: '接取测试' }).then(async (q) => {
  // 接取任务
  const result = await quest.acceptQuest(q.id);
  console.log('接取结果:', result);
  
  // 查看任务状态
  const task = await quest.getQuest(q.id);
  console.log('任务状态:', task.status);
});
```

**预期结果：**
- `接取结果: true`
- `任务状态: active`

---

### TC-052：任务完成

**测试步骤：**
```javascript
const quest = new PhoneServices.Quest(window.Platform);

quest.createQuest({ name: '完成测试' }).then(async (q) => {
  await quest.acceptQuest(q.id);
  await quest.completeQuest(q.id);
  
  const task = await quest.getQuest(q.id);
  console.log('任务状态:', task.status);
});
```

**预期结果：**
- `任务状态: completed`

---

## 七、集成测试

### TC-060：导演系统完整流程

**前置条件：** 
- Platform 已初始化
- AI API 已配置
- EventBus 已初始化

**测试步骤：**
```javascript
// 1. 检查所有组件
console.log('Platform:', !!window.Platform);
console.log('EventBus:', !!window.Platform?.eventBus);
console.log('ContextMonitor:', !!window.Platform?.contextMonitor);
console.log('WorkflowEngine:', !!window.Platform?.workflowEngine);
console.log('DirectorService:', !!window.Platform?.services?.get('director'));
console.log('QuestService:', !!window.PhoneServices?.Quest);

// 2. 触发导演
const director = window.Platform?.services?.get('director');
director?.manualTrigger().then(() => {
  console.log('导演触发成功');
}).catch(e => {
  console.log('导演触发失败（可能未配置API）:', e.message);
});

// 3. 检查历史
director?._directorData?.getHistory(5).then(history => {
  console.log('导演历史:', history);
});
```

**预期结果：**
- 所有组件检查输出 `true`
- 导演触发成功或显示 API 未配置错误
- 历史记录数组

---

### TC-061：工作流链式触发

**测试步骤：**
```javascript
const bus = window.Platform?.eventBus;
const engine = window.Platform?.workflowEngine;

// 监听最终事件
bus.on('chain:complete', () => {
  console.log('链式工作流完成');
});

// 注册链式工作流
engine.register({
  id: 'chain.step1',
  trigger: { type: 'engine_event', pattern: 'chain:start' },
  actions: [
    { type: 'event_emit', params: { event: 'chain:step2' } }
  ]
});

engine.register({
  id: 'chain.step2',
  trigger: { type: 'engine_event', pattern: 'chain:step2' },
  actions: [
    { type: 'event_emit', params: { event: 'chain:complete' } }
  ]
});

// 触发链式流程
bus.emit('chain:start', {});
```

**预期结果：**
- 输出 "链式工作流完成"

---

## 八、铁则合规验证

### TC-070：数据读写唯一通道验证

**测试步骤：**
```javascript
// 检查所有 Service 是否通过 Schema 读写数据
const services = ['AI', 'Director', 'Quest'];
services.forEach(name => {
  const svc = window.PhoneServices?.[name];
  if (svc) {
    const proto = Object.getPrototypeOf(svc.prototype || svc);
    const methods = Object.getOwnPropertyNames(proto);
    console.log(`${name}Service 方法:`, methods.filter(m => !m.startsWith('_')));
  }
});
```

**预期结果：**
- 所有 Service 不包含直接操作 `localStorage` 或 `Platform.setData` 的公共方法

---

### TC-071：服务层不操作 DOM 验证

**测试步骤：**
```javascript
// 检查 Service 文件是否包含 document 或 window 引用
const serviceFiles = [
  'SERVICES/ai-service.js',
  'SERVICES/director-service.js',
  'SERVICES/quest-service.js'
];

// 在浏览器中无法直接读取文件，改为检查运行时
console.log('AIService 是否引用 document:', 
  window.PhoneServices?.AI.toString().includes('document'));
console.log('DirectorService 是否引用 document:', 
  window.PhoneServices?.Director.toString().includes('document'));
```

**预期结果：**
- 所有输出为 `false`

---

### TC-072：错误处理降级验证

**测试步骤：**
```javascript
// 测试 AIService 错误处理
const ai = new PhoneServices.AI(window.Platform);

// 使用无效配置
ai.generate('test').then(() => {
  console.log('AI 调用成功');
}).catch(e => {
  console.log('AI 调用失败（预期行为）:', e.message);
  console.log('应用未崩溃 ✓');
});
```

**预期结果：**
- 输出失败信息
- 应用继续运行，未崩溃

---

## 九、性能测试

### TC-080：EventBus 高频触发

**测试步骤：**
```javascript
const bus = new EventBus();
let count = 0;

bus.on('perf:test', () => count++);

const start = performance.now();
for (let i = 0; i < 10000; i++) {
  bus.emit('perf:test', {});
}
const end = performance.now();

console.log('10000 次触发耗时:', (end - start).toFixed(2), 'ms');
console.log('实际触发次数:', count, '(去重保护)');
```

**预期结果：**
- 耗时 < 1000ms
- 触发次数远小于 10000（去重保护生效）

---

### TC-081：WorkflowEngine 并发保护

**测试步骤：**
```javascript
const engine = new WorkflowEngine(window.Platform);
let executions = 0;

engine.register({
  id: 'perf.concurrent',
  trigger: { type: 'engine_event', pattern: 'perf:concurrent' },
  actions: [
    { 
      type: 'function_call', 
      handler: async () => {
        await new Promise(r => setTimeout(r, 100));
        executions++;
      }
    }
  ],
  options: { dedup: false }
});

// 快速触发 10 次
for (let i = 0; i < 10; i++) {
  window.Platform?.eventBus?.emit('perf:concurrent', {});
}

setTimeout(() => {
  console.log('执行次数:', executions, '(并发保护)');
}, 1500);
```

**预期结果：**
- 执行次数为 1（并发保护生效）

---

## 十、测试报告模板

```
测试执行日期：____________________
测试执行人：____________________
SillyTavern 版本：____________________
插件版本：3.4.0

测试结果汇总：
| 测试类别 | 通过 | 失败 | 跳过 |
|---------|------|------|------|
| 跨域修复 |      |      |      |
| EventBus |      |      |      |
| ContextMonitor |  |    |      |
| WorkflowEngine |  |    |      |
| DirectorService | |    |      |
| QuestService |    |    |      |
| 集成测试 |      |      |      |
| 铁则合规 |      |      |      |
| 性能测试 |      |      |      |

问题记录：
1. ____________________
2. ____________________
3. ____________________

备注：
____________________
```
