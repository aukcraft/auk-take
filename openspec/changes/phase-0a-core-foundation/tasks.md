## 1. Monorepo 骨架

- [x] 1.1 初始化 pnpm workspace（`pnpm-workspace.yaml`、根 `package.json`、`.gitignore`、`tsconfig.base.json`）
- [x] 1.2 配置 turbo（`turbo.json`：lint/typecheck/test/build 任务及依赖关系）
- [x] 1.3 根级脚本：lint / typecheck / test 可一键运行

## 2. Core 契约层（packages/core/src）

- [x] 2.1 包骨架：`packages/core/package.json`（零平台依赖）、tsconfig、vitest 配置
- [x] 2.2 插件契约 `plugin/types.ts`：`AukPlugin`（id/tier/permissions/connect/create）、`PluginContext`、`PluginConnection`（opaque state）、`PluginInstance`
- [x] 2.3 `PluginManager`：注册、connect/create 两阶段初始化、opaque 状态持久化、卸载（拒绝 locked）
- [x] 2.4 `EventBus`：on/off/emit，监听器抛错隔离发布方
- [x] 2.5 `ServiceRegistry` 与 `CapabilityRegistry`（泛型，不引 React）
- [x] 2.6 `PermissionManager`：权限声明读取 + `assertPermission` 校验
- [x] 2.7 失败语义：配置期 connect 错误上抛；运行期逐插件 try/catch 隔离

## 3. 数据 Schema（packages/core/src/schema）

- [x] 3.1 `record.ts`：`MovieRecord`（TMDB 快照含 mediaType/season/episode、user 字段、source、mediaCache、share、schemaVersion）+ 注释明确"多次观看多条记录"语义
- [x] 3.2 `tag.ts`、`mood.ts`（MoodEntry 独立实体）、`sync.ts`（SyncMeta）
- [x] 3.3 集合名常量导出：`records` / `tags` / `mood-entries` / `sync-meta`

## 4. Storage 端口（packages/core/src/storage）

- [x] 4.1 `interface.ts`：`Storage` 接口（loadAll/persistAll/delete，全量内存模型，文档注明架构决策）
- [x] 4.2 `in-memory.ts`：`InMemoryStorage` mock 实现

## 5. 测试（packages/core/__tests__）

- [x] 5.1 PluginManager：connect 一次 / create 重建 / connect 抛错上抛 / 运行期失败隔离 / 拒绝卸载 locked
- [x] 5.2 EventBus / ServiceRegistry / CapabilityRegistry / PermissionManager 单测（用 fake plugin，不依赖真实插件）
- [x] 5.3 InMemoryStorage 契约测试（可复用于未来平台实现的契约验证）
- [x] 5.4 schema 类型级测试：电影/剧集/重复观看/MoodEntry 多条构造样例

## 6. CI

- [x] 6.1 `.github/workflows/ci.yml`：PR + push 主分支跑 lint/typecheck/test
- [x] 6.2 依赖守卫步骤：校验 `packages/core/package.json` 无 react-native/react/@tauri-apps 平台依赖
