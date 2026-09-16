## MODIFIED Requirements

### Requirement: 壳引导流程
移动壳（apps/mobile，裸 RN + Metro）与桌面壳（apps/desktop，Tauri + Vite + RNW）SHALL 共享同一引导序列：初始化 core → 通过 ServiceRegistry 注入对应平台 Storage 实现 → 注册并连接/启动业务插件（Phase 4 累积：edit / display / record / timeline / tmdb / tag / search / stats / **network / jellyfin**；network 为 locked 且**注册顺序先于其消费者**（tmdb/jellyfin 经 services.get 消费其服务，创建期取用），jellyfin 为 recommended 可卸载）→ 渲染 AppShell。两壳 SHALL 不包含业务逻辑，业务数据与 UI 能力全部经 core 契约流转。tab 内容 SHALL 来自插件能力注册：records/calendar 由对应插件提供；「我的」tab 由 stats 供给（未注册回退占位）；read tab 依 ui-nav 既有语义隐藏。Jellyfin 同步入口 SHALL 位于「我的」tab 统计视图（`cmd:jellyfin-sync` 未注册时隐藏）；「补全元数据」入口 SHALL 位于同视图（`cmd:tmdb-backfill-known` 未注册时隐藏）。

桌面壳网络与本地资源策略沿既有决策：CSP 保持 null、assetProtocol（scope `$APPDATA/**`）；移动端原生 fetch 无 CORS 限制。

#### Scenario: 移动端引导
- **WHEN** apps/mobile 启动
- **THEN** core 完成初始化，业务插件按序启动（network 先于 tmdb/jellyfin），各 tab 内容正常

#### Scenario: 桌面端引导
- **WHEN** apps/desktop（Tauri 窗口）启动
- **THEN** 同一组插件启动渲染相同业务内容，「我的」含 Jellyfin 同步入口

#### Scenario: jellyfin 卸载降级
- **WHEN** plugin-jellyfin 未加载
- **THEN** 「我的」无同步入口，其余功能不受影响；network 缺失时消费者裸 fetch 回退

#### Scenario: stats 供给我的 tab
- **WHEN** stats 插件注册其内容能力
- **THEN** 「我的」tab 展示统计回顾（含同步入口），而非壳占位
