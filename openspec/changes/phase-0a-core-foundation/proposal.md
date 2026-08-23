## Why

AukTake 是一个极简、跨端（RN 移动 + Tauri/RNW 桌面）的观影记录日志。项目从零开始，需要先钉死插件化核心层与数据模型，使后续所有 Phase（edit/search/poster/sync 等 18 个插件）建立在稳定契约之上，而不是平台耦合的实现上。Phase 0a 只做"可单测的纯 TS 基座"，不触碰任何平台差异。

## What Changes

- 搭建 pnpm workspace + turbo monorepo，CI 跑单元测试
- 新建 `@auktake/core` 纯 TS 包（零平台依赖，纯 Node 可测）：
  - `PluginManager`：插件加载/卸载/生命周期（connect/create 分离）
  - `EventBus`：通知类通信（`record:created` 等）
  - `ServiceRegistry`：核心服务注入（storage 等接口的运行时绑定）
  - `CapabilityRegistry`：UI 组件能力注册（`ui:rating-input` 等）
  - `PermissionManager`：插件权限声明与校验
- 定义观影记录数据 schema（`MovieRecord` + `Tag` + `MoodEntry` + `SyncMeta`），支持电影与剧集（`mediaType` + season/episode）
- 定义 `Storage` 端口接口：**全量内存模型**（`loadAll/persistAll`），并附带内存 mock 实现
- 定义插件生命周期契约与三层通信规则（事件总线 / 能力注册表 / 服务注入）

### Non-goals（本 change 明确不做）

- host-rn / host-tauri 壳（Phase 0b）
- SQLite / OPFS 平台适配（Phase 0b）
- 任何 UI 插件实现（Phase 1+）
- 剧集的复杂观看语义（仅 schema 预留字段）

## Capabilities

### New Capabilities

- `plugin-core`: 插件管理器、生命周期契约（connect/create 分离、opaque 持久化状态）、权限模型、三层通信（EventBus / CapabilityRegistry / ServiceRegistry）
- `storage-port`: Storage 端口接口（全量内存模型 loadAll/persistAll/delete/transaction）与内存 mock 实现
- `record-schema`: 观影记录核心实体 —— MovieRecord（含电影/剧集）、Tag、MoodEntry（心情历史，独立实体）、SyncMeta
- `monorepo-infra`: pnpm workspace + turbo 任务编排 + CI（lint/typecheck/test）

### Modified Capabilities

（无 —— 首份 change，无既有 spec）

## Impact

- 新增 `packages/core/`（全部代码）、根 `pnpm-workspace.yaml`、`turbo.json`、`.github/workflows/ci.yml`
- 依赖：typescript、vitest、turbo、pnpm；核心包**禁止**依赖 react-native / @tauri-apps / react
- 契约一经合即为宪法：后续 18 个插件只依赖此包的接口定义，禁止 import 其他插件内部实现
