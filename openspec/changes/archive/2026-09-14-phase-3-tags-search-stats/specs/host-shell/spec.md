## MODIFIED Requirements

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
