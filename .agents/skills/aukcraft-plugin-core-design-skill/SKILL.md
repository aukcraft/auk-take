---
name: aukcraft-plugin-core-design-skill
description: >-
  设计插件化核心层（plugin core）的通用方法论：如何定义契约、注册表、能力注入接口，
  使核心零平台依赖、零具体实现。当任务涉及从零设计或重构一个可扩展系统的核心架构、
  定义插件契约（connect/create 式生命周期）、决定"什么进核心什么做插件"、审查依赖方向、
  或编写架构决策记录（ADR）时使用。触发词：插件化架构、核心设计、扩展点、契约设计、
  依赖注入、端口适配器、注册表模式、ADR、如何设计 core。
license: MIT
activation: /aukcraft-plugin-core-design-skill
provenance:
  maintainer: Eagle
  version: 1.0.0
  created: 2026-02-14
  source_references:
    - distilled from Eagle monorepo practice (docs/adr.md, packages/core)
metadata:
  author: Eagle
  version: 1.0.0
  created: 2026-02-14
---

# /aukcraft-plugin-core-design-skill

设计插件化系统的核心层。回答一个问题：**什么应该进核心，什么应该留给变化**。

## 触发

- 从零设计可扩展系统（"我要做个支持 N 种 X 的客户端/平台"）
- 重构：核心被具体实现污染、加一个实现要改核心
- 定义插件契约 / 扩展点接口
- 写 ADR 或做架构评审

## 方法论五步

### 第 1 步：找变化轴

问：这个系统**最频繁变化的维度**是什么？（Eagle：直播源；编辑器：文件格式；CI：运行器……）
→ 变化轴做成插件；其余稳定职责进核心。**一个系统通常只有一个主变化轴**——找错轴，插件化就成了过度设计。

### 第 2 步：核心只留三样东西

```
核心 = 契约（接口） + 注册表（编排） + 零其他
```

| 组件 | 内容 | 禁止 |
|---|---|---|
| 契约层 | 插件接口、能力注入接口（Port）、数据模型 | 任何具体实现的 import |
| 注册表层 | use/plugin 注册、路由分发、合并、持久化恢复 | 业务逻辑 |
| 平台能力 | 一律抽象为注入接口（HTTP/时钟/哈希/存储） | 直接调用平台 API |

判据（必须全部成立）：
1. **删掉任何一个插件，核心照常编译测试通过**
2. **新增一个插件，核心零改动**（只在组合根注册）
3. **核心在纯 Node/最小环境可测**（测试替身能替换所有注入能力）

### 第 3 步：设计插件契约（生命周期分离是关键）

```ts
interface Plugin {
  readonly kind: string;          // 唯一 id，注册表按此分发
  readonly keyPrefix: string;     // 实体 id 前缀，注册表按此路由
  connect(port, input): Promise<Connection>;   // 一次性：校验+握手 → 可持久化状态
  create(port, connection): Instance;          // 每次启动：从持久化状态重建，不再握手
}
```

- **connect/create 分离**：用户配置时握手一次，重启时纯重建——避免每次启动都要凭证/网络
- **持久化状态是 opaque**：核心只存取不解释（`connection.state` 属于插件私有），这样插件演进不改核心存储结构
- **能力只能经 port 进来**：插件禁止直接 fetch/读文件——可测性与安全性的来源
- **id 由内容哈希派生**（`kind:<hash(config)>`）：同配置重复添加天然去重，多实例不冲突

### 第 4 步：定义失败语义

- **配置期失败要响**：connect 抛错直接给用户看（这时用户在场）
- **运行期失败要静默隔离**：核心合并多插件结果时逐个 try/catch，单点失败跳过不阻塞整体（用户不在场，可用性优先）
- 两条都要有回归测试

### 第 5 步：用 ADR 固化决策

每条架构约束写成四问：**决策 / 动机 / 代价 / 验证方式**。代价一栏最重要——没有代价的决策是空话。ADR 是核心层的"宪法"，后来者先读 ADR 再改核心。

## 常见错误 → 纠正

| 错误 | 后果 | 纠正 |
|---|---|---|
| 核心里出现 `if (kind === 'x')` | 每加实现改核心 | 分发逻辑泛化为注册表查表 |
| 插件 id 用随机数/固定字符串 | 重复添加覆盖或爆炸 | 内容哈希派生 |
| connect 里做核心关心的持久化格式 | 插件演进绑死核心 | state opaque 化 |
| 平台 API 散落在插件里 | 无法脱离真机测试 | 全部收敛到 Port 接口 |
| 把"将来可能变"的维度插件化 | 过度设计，抽象泄漏 | 只插件化"现在就在变"的轴 |

## 案例（Eagle core，~1k 行）

契约：`SourcePlugin`（kind/channelIdPrefix/connect/create）+ `Port`（getText/getJson/postJson/now/hash）+ `SettingsStore`（get/set/remove）。
注册表：`EagleCore`——use/listPlugins/hydrate/addSource/listChannels（跨源合并，单源失败跳过）/resolveStream（前缀路由）/subscribe。
3 个直播源插件 + 1 个 VOD 插件互不知晓；核心 8 个单测用 fake plugin 泛化验证（不依赖任何真实源）。

## Gotchas

- 组合根（谁调用 `core.use(...)`）在应用壳，不在核心——核心不知道有哪些插件
- 契约一旦有消费者就不要改签名，只加可选字段；破坏性变更要给迁移路径
- 测试经 alias 直连核心源码（无需先构建产物），类型检查走构建产物——两条路径各取所需

## 参考文件（按需 Read）

Read `references/contract-checklist.md` when you need: 契约字段逐一检查清单与反模式
Read `references/port-adapter.md` when you need: Port/适配器模式设计细节与测试替身实现
Read `references/adr-template.md` when you need: ADR 四问模板与示例
