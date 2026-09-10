## MODIFIED Requirements

### Requirement: 壳引导流程
移动壳（apps/mobile，裸 RN + Metro）与桌面壳（apps/desktop，Tauri + Vite + RNW）SHALL 共享同一引导序列：初始化 core → 通过 ServiceRegistry 注入对应平台 Storage 实现 → 注册并连接/启动业务插件（Phase 1：edit / display / record / timeline，deps 经组合根显式注入）→ 渲染 AppShell。两壳 SHALL 不包含业务逻辑，业务数据与 UI 能力全部经 core 契约流转。tab 内容 SHALL 来自插件能力注册：records 与 calendar 的内容由对应插件提供，壳不再内置这两个 tab 的占位组件（profile 占位保留；read tab 因无能力提供者依 ui-nav 既有语义隐藏）。

#### Scenario: 移动端引导
- **WHEN** apps/mobile 启动
- **THEN** core 完成初始化，platform-rn 的 Storage 被注入，四个业务插件按序启动，「记录」tab 渲染海报墙、「日历」tab 渲染热力图

#### Scenario: 桌面端引导
- **WHEN** apps/desktop（Tauri 窗口）启动
- **THEN** core 完成初始化，platform-tauri 的 Storage 被注入，同一组插件启动并渲染相同业务内容

#### Scenario: 插件缺失时壳自动降级
- **WHEN** 某业务插件未注册其 tab 能力（如 timeline 卸载、read 无提供者）
- **THEN** 对应 tab/视图按 ui-nav 语义隐藏，壳不出现插件特定分支

## ADDED Requirements

### Requirement: 通用 overlay 根
双壳 SHALL 在 AppShell 根部渲染通用 overlay 宿主：拉取 `ui:overlay:root` 能力组件并渲染，未注册则渲染空。overlay 宿主 MUST 对具体插件零感知（不 import 任何 plugin-* 包的内部实现），Phase 1 由 edit 插件注册编辑弹层。

#### Scenario: 编辑弹层全局可达
- **WHEN** 任一界面调用 `cmd:record-edit`
- **THEN** overlay 根渲染的编辑弹层打开，覆盖当前 tab 内容

#### Scenario: 无 overlay 时不渲染
- **WHEN** `ui:overlay:root` 未注册
- **THEN** overlay 宿主渲染空，界面无残留容器
