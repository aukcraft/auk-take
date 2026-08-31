## Why

Phase 0a 交付了纯 TS 的插件核心与契约，但没有任何壳能启动它。Phase 0b 兑现 0a 留下的平台适配支票：让 AukTake 在移动端（裸 RN）与桌面端（Tauri + RNW）真正编译运行，显示插件化导航的空壳，并落地区域 platform-* 的 Storage 实现——这是后续所有 UI 插件（Phase 1+）的运行地基。

## What Changes

- 新增 `packages/platform-rn`：op-sqlite → Storage 实现（工厂 `createRnStorage()`，供壳注入 ServiceRegistry）
- 新增 `packages/platform-tauri`：Tauri FS → 单 JSON 文件 Storage（写临时文件 + rename 原子替换；不使用 OPFS）
- 新增 `packages/ui-nav`：TabDefinition 数据模型 + 导航状态（单源、纯 RN 语法）；壳渲染导航骨架（移动端底部 TabBar / 桌面端左侧 Sidebar，自绘，不用 react-navigation）
- 新增 `apps/mobile`：裸 React Native + Metro 壳（watchFolders 源码直连 monorepo 包）
- 新增 `apps/desktop`：Tauri + Vite + RNW 壳（手动 alias react-native → react-native-web）
- 双壳共享引导流程：初始化 core → 注入平台 Storage → PluginManager 启动 → 渲染 AppShell
- CI 扩展：依赖方向守卫（platform-* 依赖 core；core 禁止反向依赖）、双端 typecheck

### Non-goals（本 change 明确不做）

- 任何业务 tab 的内容实现（记录/日历/读/我的均为占位，Phase 1+）
- TMDB、图片缓存、同步（Phase 2+ / Phase 4）
- 导航转场动画与手势（Phase 5）
- iOS/Android 打包流水线（Phase 7；裸 RN 的打包成本已作为 D1 决策代价记账）
- OPFS / 纯浏览器 PWA 支持

## Capabilities

### New Capabilities

- `host-shell`: 双端壳的引导契约——初始化 core、注入平台 Storage、启动插件、渲染 AppShell；平台指纹判定；Metro/Vite 源码直连与 moduleSuffixes 一致性
- `ui-nav`: TabDefinition 数据模型（id/capabilityKey/iconKey/titleKey/order/required）、tab 可见性由能力注册状态决定、导航状态管理；壳骨架平台分叉（底部 TabBar / 左侧 Sidebar）
- `platform-storage`: platform-rn（op-sqlite）与 platform-tauri（JSON 文件原子写入）的 Storage 实现契约；与 0a InMemoryStorage 共享同一套契约测试；依赖方向约束

### Modified Capabilities

（无——host-shell / ui-nav / platform-storage 均为新增能力，不改 0a 的既有 requirement）

## Impact

- 新增代码：`packages/platform-rn`、`packages/platform-tauri`、`packages/ui-nav`、`apps/mobile`、`apps/desktop`
- 依赖引入：react-native、react-native-web、@tauri-apps/api、op-sqlite、vite、@vitejs/plugin-react —— 全部禁止进入 `@auktake/core`（CI 守卫）
- `openspec/specs/storage-port` 中"PC: Tauri FS / OPFS"的措辞在本 change 的 design 中收敛为 Tauri FS 单 JSON 文件；OPFS 显式不做（不改 0a requirement 本身）
- 里程碑对应：Phase 0b（GitHub Issue/PR 流程同 Phase 0a）
