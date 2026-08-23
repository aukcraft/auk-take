## ADDED Requirements

### Requirement: Storage 端口接口
Storage 端口 SHALL 采用全量内存模型，仅暴露集合级操作：`loadAll<T>(collection): Promise<T[]>`、`persistAll<T>(collection, items): Promise<void>`、`delete(collection, id): Promise<void>`。接口 SHALL NOT 提供谓词查询或索引；筛选与统计由插件在内存中完成。此为架构决策：个人日志量级（~千条）下优先两端实现简单性与一致性。

#### Scenario: 全量加载集合
- **WHEN** 插件调用 `loadAll('records')` 且该集合有 N 条持久化数据
- **THEN** 返回全部 N 条记录

#### Scenario: 全量持久化覆盖写入
- **WHEN** 插件调用 `persistAll('records', items)`
- **THEN** 该集合内容被完整替换为 items

#### Scenario: 按 id 删除
- **WHEN** 插件调用 `delete('records', id)` 且该 id 存在
- **THEN** 该条目从集合中移除，其余条目不变

### Requirement: 内存 mock 实现
core SHALL 附带 `InMemoryStorage` mock 实现，实现完整 Storage 接口，用于纯 Node 单测与 Phase 0b 前的开发体验。

#### Scenario: mock 行为与契约一致
- **WHEN** 对 `InMemoryStorage` 执行 loadAll/persistAll/delete 序列
- **THEN** 行为与接口契约完全一致，可通过与其他实现的契约测试复用

### Requirement: 平台实现可注入
Storage 实现 SHALL 由 host 在引导时通过 ServiceRegistry 注入（Phase 0b 提供 SQLite/OPFS 适配），core 不内置任何平台实现。插件 SHALL 通过 `services.get<Storage>('storage')` 获取，禁止 import 具体实现类。

#### Scenario: 替换实现不影响插件
- **WHEN** host 将 storage 实现从 `InMemoryStorage` 替换为 SQLite 实现
- **THEN** 仅依赖 Storage 接口的插件无需任何代码改动

### Requirement: 集合命名约定
业务集合名 SHALL 为稳定的 kebab-case 复数标识：`records`、`tags`、`mood-entries`、`sync-meta`。新增集合属于非破坏性变更。

#### Scenario: 约定集合可互操作
- **WHEN** record 插件写入 `records` 而 stats 插件读取 `records`
- **THEN** 两者基于同一集合名互操作，无需额外协商机制
