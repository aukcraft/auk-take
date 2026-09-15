# host-shell Specification

## Purpose

Defines the dual-host bootstrap contracts (mobile bare RN + desktop Tauri+RNW), platform fingerprint detection, monorepo source-direct linking (Metro/Vite), moduleSuffixes consistency for typecheck/runtime alignment, and the dependency-direction CI guard that preserves the layering: core → platform-rn/tauri/ui-nav → apps.

## Requirements

### Requirement: 壳引导流程
移动壳（apps/mobile，裸 RN + Metro）与桌面壳（apps/desktop，Tauri + Vite + RNW）SHALL 共享同一引导序列：初始化 core → 通过 ServiceRegistry 注入对应平台 Storage 实现 → 注册并连接/启动业务插件（Phase 3 累积：edit / display / record / timeline / tmdb / **tag / search / stats**；tag 为 locked 常驻，search / stats 为 recommended 可卸载）→ 渲染 AppShell。两壳 SHALL 不包含业务逻辑，业务数据与 UI 能力全部经 core 契约流转。tab 内容 SHALL 来自插件能力注册：records/calendar 的内容由对应插件提供；「我的」tab 的内容由 stats 插件供给（**stats 注册其内容能力时壳的 profile 占位让位**——能力优先，未注册则回退占位）；read tab 因无能力提供者依 ui-nav 既有语义隐藏。

桌面壳网络与本地资源策略沿 Phase 2 决策：CSP 保持 null、assetProtocol（scope `$APPDATA/**`）承载本地缓存图；移动端原生 fetch 无 CORS 限制。

#### Scenario: 移动端引导
- **WHEN** apps/mobile 启动
- **THEN** core 完成初始化，platform-rn 的 Storage 被注入，业务插件按序启动，「记录」tab 渲染海报墙（含搜索/筛选）、「日历」tab 渲染热力图、「我的」tab 渲染统计回顾

#### Scenario: 桌面端引导
- **WHEN** apps/desktop（Tauri 窗口）启动
- **THEN** core 完成初始化，platform-tauri 的 Storage 被注入，同一组插件启动并渲染相同业务内容

#### Scenario: recommended 插件卸载降级
- **WHEN** search 或 stats 插件未加载
- **THEN** 记录 tab 无搜索/筛选入口（或「我的」回退占位），壳不出现插件特定分支

#### Scenario: stats 供给我的 tab
- **WHEN** stats 插件注册其内容能力
- **THEN** 「我的」tab 展示统计回顾而非壳占位

### Requirement: 平台指纹判定
壳 SHALL 在模块顶层以 `'__TAURI_INTERNALS__' in window` 判定 Tauri 环境，且每次进程只计算一次。业务代码 SHALL NOT 自行探测平台，平台判断收敛在壳与 platform-* 包内。

#### Scenario: 指纹只算一次
- **WHEN** 模块加载后多处代码读取平台信息
- **THEN** 判定结果来自模块顶层的单次计算，渲染期间无重复探测

### Requirement: monorepo 源码直连
packages/* 的入口 SHALL 指向 TS 源（无需预构建即可被双端消费）。Metro SHALL 配置 watchFolders 覆盖 monorepo 包；Vite SHALL 配置 resolve.alias 将 `react-native` 指向 `react-native-web`。类型检查的 moduleSuffixes MUST 与运行时的平台扩展名解析优先级一致。

#### Scenario: 改包即生效
- **WHEN** 修改 packages/ui-nav 源码后在任一壳的 dev 模式刷新
- **THEN** 变更直接生效，无需对被改包执行构建步骤

#### Scenario: 类型与运行时解析一致
- **WHEN** 存在 `Foo.native.tsx` 与 `Foo.web.tsx` fork 且两端各自加载
- **THEN** `tsc --noEmit`（配 moduleSuffixes）对两端解析到的类型与运行时实际加载的文件一致

### Requirement: 依赖方向守卫
CI SHALL 校验包依赖方向：core 不依赖 platform-*/ui-* 与任何平台库；ui-contracts 仅 peer 依赖 core（类型）与 react（类型）；platform-rn/platform-tauri/ui-nav 仅依赖 core（peer）与自身平台库；plugin-* 仅依赖 core + ui-contracts（ui-nav 仅在需要 tab key 时），react 系仅可为 peer，插件间互依与对 platform-*/apps 的依赖 MUST 拒绝；apps 依赖 core + 对应平台包 + ui-nav + ui-contracts + plugin-*。react 系依赖禁止进入 core。违规 MUST 使 CI 失败并给出明确报错。

#### Scenario: 反向依赖被 CI 拒绝
- **WHEN** PR 向 packages/core/package.json 添加对 platform-rn 的依赖
- **THEN** CI 依赖守卫步骤失败并指明违规方向

#### Scenario: 插件互相依赖被 CI 拒绝
- **WHEN** PR 向 plugin-display 添加对 plugin-edit 的依赖
- **THEN** CI 依赖守卫步骤失败并指明「插件间依赖被禁止」
### Requirement: 通用 overlay 根
双壳 SHALL 在 AppShell 根部渲染通用 overlay 宿主：拉取 `ui:overlay:root` 能力组件并渲染，未注册则渲染空。overlay 宿主 MUST 对具体插件零感知（不 import 任何 plugin-* 包的内部实现），Phase 1 由 edit 插件注册编辑弹层。

#### Scenario: 编辑弹层全局可达
- **WHEN** 任一界面调用 `cmd:record-edit`
- **THEN** overlay 根渲染的编辑弹层打开，覆盖当前 tab 内容

#### Scenario: 无 overlay 时不渲染
- **WHEN** `ui:overlay:root` 未注册
- **THEN** overlay 宿主渲染空，界面无残留容器
