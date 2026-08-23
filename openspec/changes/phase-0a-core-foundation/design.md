## Context

AukTake 从零开始。已收敛的架构决策（探索阶段达成共识）：

- **分层**：Host（壳，不是插件：host-rn / host-tauri）→ Core（纯 TS，零平台依赖）→ Plugins（18 个实体，三层分级 locked/recommended/optional）
- **通信三层**：EventBus（通知）/ CapabilityRegistry（UI 组件）/ ServiceRegistry（核心服务直调）
- **依赖规则**：插件可 `import @auktake/core` 的接口定义，禁止 import 其他插件的内部实现文件
- **数据模型**：TMDB 元数据内联快照（不建 Movie 表）；同一影片多次观看 = 多条 record；MoodEntry 为独立实体（心情历史，非单值字段）；支持电影/剧集（mediaType + season/episode）
- **存储模型**：全量内存模型（loadAll/persistAll），stats/filter 在内存中计算

参考方法论：`aukcraft-plugin-core-design-skill`（connect/create 分离、opaque 状态、能力经 port 注入、失败语义、ADR 固化）。

## Goals / Non-Goals

**Goals:**

- `@auktake/core` 在纯 Node 环境可测，删除任何插件实现核心照常通过测试
- 契约（Plugin 生命周期、Storage 端口、record schema）一次定准，后续 Phase 零破坏性变更（或给出迁移路径）
- monorepo + CI 骨架，Phase 0b 的双壳可直接在其上引导

**Non-Goals:**

- host-rn / host-tauri、SQLite/OPFS 适配（0b）
- 任何插件的具体实现（Phase 1+）
- 剧集复杂观看语义（仅 schema 预留）

## Decisions

### D1. 壳是宿主，不是插件

核心层不包含"RN 壳插件 / Tauri 壳插件"。Host 负责：初始化 Core → 注入平台服务（storage 实现等）→ 加载插件 → 渲染根组件。
*替代方案*：壳作为内置插件 —— 存在鸡生蛋问题（插件管理器跑在壳里）。*代价*：host 与 core 之间需要一条明确定义的 bootstrap API。

### D2. 插件生命周期：connect/create 分离

```ts
interface AukPlugin {
  readonly id: string;              // 如 'rating'、'sync-webdav'
  readonly tier: 'locked' | 'recommended' | 'optional';
  readonly permissions: Permission[];  // 如 ['storage:read', 'network:fetch']
  connect(ctx: PluginContext): Promise<PluginConnection>;  // 一次性：校验+握手
  create(ctx: PluginContext, conn: PluginConnection): PluginInstance; // 每次启动：纯重建
}
```

- `conn.state` 为 opaque：核心只存取不解释，插件演进不改核心存储结构
- 配置期失败（connect 抛错）要响：直接呈现给用户
- 运行期失败要静默隔离：核心分发时逐插件 try/catch，单点失败跳过
*替代方案*：单一 `activate()` 生命周期 —— 每次启动都需重新握手（凭证/网络），不可接受。

### D3. 三层通信的边界

| 层 | 用途 | 示例 |
|---|---|---|
| EventBus | 通知，fire-and-forget | `record:created`、`sync:completed` |
| CapabilityRegistry | UI 组件注册/拉取 | `ui:rating-input`、`ui:search-modal` |
| ServiceRegistry | 核心服务接口调用 | `core.services.get<Storage>('storage')` |

规则："禁止直接依赖" = 禁止 import 其他插件的内部实现文件；依赖 core 接口定义合法。
*替代方案*：全部走事件总线 —— UI 组合是同步关系，事件总线传组件会痛。

### D4. Storage 端口：全量内存模型（诚实命名）

```ts
interface Storage {
  loadAll<T>(collection: string): Promise<T[]>;
  persistAll<T>(collection: string, items: T[]): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
}
```

不叫 get/set/query，不假装支持谓词查询。所有插件以 collection 为单元全量加载，筛选/统计在内存做。个人日志量级（~千条）下这是最简且两端实现成本最低的选择。架构决策记录进文档，将来若需索引化，属于破坏性变更 + 迁移路径（0a 内提供 mock 实现 + schema 版本字段 `schemaVersion` 预留）。
*替代方案*：Repository + 谓词查询 —— OPFS 端退化为内存过滤，接口复杂度先付了，收益后置。

### D5. Record schema：剧集预留 + MoodEntry 独立

- `tmdb.mediaType: 'movie' | 'episode'`，episode 附 `seasonNumber`/`episodeNumber`（可选字段，电影不填）
- `MoodEntry { id, recordId, mood, note?, createdAt }` 独立集合，mood 插件读写自己的 collection，不污染 record
- `SyncMeta` 独立集合（recordId、version、checksum、lastSyncedAt、conflict）
- TMDB 元数据内联快照；rating 0–10 step 0.5（0 = 未评分），渲染交给 rating 插件

### D6. sync 引擎不可关闭但空转零成本

无后端插件（sync-webdav 等）注册时，sync 引擎不执行任何调度、不产生 IO；契约中明确此条。

## Risks / Trade-offs

- [全量内存模型在数据量大时内存压力] → 个人日志量级可接受；schemaVersion 字段预留迁移；写入 design 文档作为已知边界
- [connect/create 契约一旦有消费者，改签名即破坏性变更] → 契约评审在 Phase 0a 内完成，0b 双壳作为第一个真实消费者验证
- [CapabilityRegistry 传 React 组件会把 React 类型引入 core 类型面] → core 只声明泛型 `register<T>(key, component: T)`，不 import React；壳层负责泛型实例化为组件类型
- [权限模型过度设计] → 0a 只做声明 + 校验 API（`assertPermission(pluginId, perm)`），不做运行时拦截；拦截留给壳

## Migration Plan

绿地项目，无迁移。合入顺序：monorepo 骨架 → core 契约 → mock 实现 + 测试 → CI。回滚 = revert 整个 PR。

## Open Questions

- ULID 生成是否进 core port（`hash`/`now` 能力注入）还是用纯 TS 库直接实现？（倾向后者：ulid 是零平台依赖的纯库）
- 事件命名规范（`domain:action`）是否需要 core 层强校验？（倾向：仅约定 + 类型导出，不强校验）
