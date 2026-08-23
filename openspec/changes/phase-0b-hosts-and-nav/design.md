## Context

Phase 0a 已交付 `@auktake/core`（纯 TS：PluginManager/EventBus/ServiceRegistry/CapabilityRegistry/PermissionManager、Storage 端口全量内存模型、record schema），22 个单测通过，CI 含平台依赖守卫。0a 明确将壳与平台适配留给 0b。

探索阶段已达成三项决策（D1–D3）与两项收敛（storage 选型、导航实现），本设计将其固化。

## Goals / Non-Goals

**Goals:**

- 双端可编译运行：移动端裸 RN + Metro、桌面端 Tauri + Vite + RNW
- 插件化导航的第一个范本：ui-nav 供 tab 数据、壳渲染骨架、内容经 CapabilityRegistry
- platform-rn / platform-tauri 两个平台能力包落地 Storage 实现，复用 0a 契约测试
- monorepo 源码直连（改包无需预构建），类型检查与运行时解析一致

**Non-Goals:**

- 业务 tab 内容、TMDB、图片缓存、同步、动画手势、打包流水线（见 proposal Non-goals）

## Decisions

### D1. 裸 React Native（不用 Expo）

移动端 `apps/mobile` 基于裸 RN + `@react-native-community/cli` 模板。不引入 expo-router/expo-sqlite/expo-dev-client。
- SQLite 选型：**op-sqlite**（JSI、维护活跃；quick-sqlite 已建议迁移至它；sqlite-storage 基于 bridge 排除）
- **已知代价（记账，Phase 7 不再重吵）**：无 EAS，GitHub Actions 需自养双平台打包（Android: gradle + keystore Secrets；iOS: xcodebuild + 证书，macOS runner 费率为 Linux 10 倍）
- *替代方案* Expo + CNG：打包省力，但 expo-router 与插件化导航打架、依赖面更重。用户明确选择裸 RN。

### D2. ui-nav 采用"X 变体"：壳渲染骨架，插件供数据

- `packages/ui-nav` 定义 `TabDefinition { id, capabilityKey, iconKey, titleKey, order, required? }` 与导航状态（当前 tab、tab 列表）
- 壳渲染平台骨架：移动端自绘底部 TabBar，桌面端自绘左侧 Sidebar（同文件 Platform/尺寸分支属于壳的平台分叉，允许）
- tab 内容组件经 `CapabilityRegistry.get(capabilityKey)` 拉取；未注册的 key → tab 隐藏（数据模型天然支持"读"tab 随 mood 插件关闭而消失，壳零逻辑）
- 不用 react-navigation：4 个 tab + useState 切换足够；navigator 树与插件化 tab 数据冲突
- 0b 中四个 tab 均为占位组件（由壳自带 Placeholder，Phase 1+ 由插件注册替换）

### D3. 桌面端 Tauri + Vite + RNW，手动 alias

- Vite 配 `resolve.alias`：`react-native` → `react-native-web`
- React 18.3 + RNW 0.19 对齐（spike 任务首先验证版本矩阵）
- 平台指纹：`'__TAURI_INTERNALS__' in window`，模块顶层计算一次
- Tauri 侧仅用 fs plugin 读写数据文件；HTTP/CORS 逃逸舱留给 Phase 2（TMDB）

### D4. Storage 实现选型（收敛 0a 的"SQLite/OPFS"措辞）

- `platform-rn`：op-sqlite，每集合一张表 `(id TEXT PK, json TEXT)`，三条裸 SQL（SELECT all / 事务化全量 REPLACE / DELETE），无 ORM
- `platform-tauri`：**单 JSON 文件**（`{ collection: { id: entity } }`），写入 = 临时文件 + rename 原子替换。**OPFS 显式不做**——桌面端有真文件系统；OPFS 仅为假想的纯浏览器 PWA 预留
- 两实现均通过 0a InMemoryStorage 的同一套契约测试（契约测试抽为可复用模块）
- 全量内存模型不变：启动 loadAll 进内存，写时 persistAll 落盘

### D5. 包结构与依赖方向

```
packages/{core, ui-nav, platform-rn, platform-tauri}
apps/{mobile, desktop}
```

依赖方向（CI 守卫，JavaScript 脚本校验各包 package.json）：
- core 不依赖任何 ui-*/platform-*/react-native/react/@tauri-apps（0a 守卫保留）
- platform-rn / platform-tauri / ui-nav 只依赖 core（peer）+ 自身平台库
- apps 依赖 core + 对应 platform 包 + ui-nav
- monorepo 源码直连：包入口指向 TS 源（main: src/index.ts），Metro watchFolders + symlink 解析；类型检查配 moduleSuffixes 与运行时一致

## Risks / Trade-offs

- [RNW/Vite 版本矩阵不对齐（最大机械风险）] → tasks 第一个任务即 spike：产出能渲染 RNW `<View>` 的 Tauri 窗口，版本矩阵锁定后再铺开
- [裸 RN monorepo 的 Metro symlink 陷阱] → watchFolders 指向 packages/，node-linker=hoisted 或 metro-config 的 symlink 支持；spike 覆盖
- [op-sqlite codegen/autolinking 在 CI Linux runner 无 iOS 工具链] → 0b CI 只跑 JS 侧（typecheck/lint/契约测试用 mock），原生构建验证留本地/Phase 7
- [JSON 单文件随数据增长读写放大] → 个人日志量级可接受；集合粒度分文件是后备优化（不改接口）
- [TabDefinition 的 capabilityKey 未注册时静默隐藏] → 壳在 dev 模式打 console.warn，避免"tab 消失了没人知道为什么"

## Migration Plan

绿地增量，无迁移。落地顺序：desktop spike → platform-tauri（可 Node 内测）→ ui-nav 数据模型 → mobile 壳 → platform-rn（op-sqlite）→ CI 守卫扩展。回滚 = revert 对应 PR。

## Open Questions

- i18n key（titleKey）0b 先硬编码中文文案，i18n 体系 Phase 6 再定（不阻塞）
- 图标经 registry 解析（iconKey）还是直接 fork 两套图标组件？倾向前者，ui-nav spec 只约束 key 语义，实现自由
