## ADDED Requirements

### Requirement: platform-rn 的 SQLite Storage
`packages/platform-rn` SHALL 提供 `createRnStorage()` 工厂，基于 op-sqlite 实现 0a 的 Storage 接口：每集合一张表 `(id TEXT PRIMARY KEY, json TEXT)`，loadAll 全量 SELECT、persistAll 在单个事务内完成全量替换、delete 单条删除。实现 SHALL NOT 引入 ORM。

#### Scenario: persistAll 事务原子性
- **WHEN** persistAll 执行过程中发生错误
- **THEN** 事务回滚，集合内容保持写入前状态

#### Scenario: 契约一致性
- **WHEN** 对 createRnStorage() 产出的实例运行 0a InMemoryStorage 同一套契约测试（以 mock op-sqlite 驱动运行）
- **THEN** 全部契约断言通过

### Requirement: platform-tauri 的 JSON 文件 Storage
`packages/platform-tauri` SHALL 提供 `createTauriStorage()` 工厂，基于 Tauri fs plugin 以单 JSON 文件持久化全部集合（结构 `{ [collection]: { [id]: entity } }`）。写入 SHALL 采用"写临时文件 + rename 原子替换"。SHALL NOT 使用 OPFS。

#### Scenario: 原子写入
- **WHEN** 持久化过程中进程中断
- **THEN** 数据文件要么为旧完整内容、要么为新完整内容，不存在半写状态

#### Scenario: 契约一致性
- **WHEN** 对 createTauriStorage() 产出的实例运行契约测试（以内存 FS 模拟 Tauri fs）
- **THEN** 全部契约断言通过

### Requirement: 契约测试可复用
Storage 契约测试 SHALL 抽为可复用模块，InMemoryStorage（0a）、RnStorage、TauriStorage 三个实现共用同一套断言；任何新实现（如未来 PWA 的 OPFS）接入时直接复用。

#### Scenario: 新实现零成本接入契约验证
- **WHEN** 未来新增一个 Storage 实现
- **THEN** 复用契约测试模块即可完成行为验证，无需重写断言

### Requirement: 平台包依赖约束
`packages/platform-rn` 与 `packages/platform-tauri` SHALL 仅依赖 `@auktake/core`（peer）与自身平台库（op-sqlite / @tauri-apps/plugin-fs），SHALL NOT 互相依赖、SHALL NOT 依赖 ui-nav 或 apps。platform-tauri 的纯逻辑部分（文件合并/原子写编排）SHALL 可在纯 Node 环境测试（Tauri API 经注入的 fs 适配器隔离）。

#### Scenario: platform-tauri 逻辑在 Node 可测
- **WHEN** 在纯 Node 测试中以内存 fs 适配器构造 createTauriStorage 的内部逻辑
- **THEN** 不启动 Tauri 运行时即可完成单测
