## MODIFIED Requirements

### Requirement: 壳引导流程
移动壳（apps/mobile，裸 RN + Metro）与桌面壳（apps/desktop，Tauri + Vite + RNW）SHALL 共享同一引导序列：初始化 core → 通过 ServiceRegistry 注入对应平台 Storage 实现 → 注册并连接/启动业务插件（Phase 2：edit / display / record / timeline / tmdb，tmdb 为 recommended tier，未连接配置时跳过其能力注册且其余插件不受影响）→ 渲染 AppShell。两壳 SHALL 不包含业务逻辑，业务数据与 UI 能力全部经 core 契约流转。tab 内容 SHALL 来自插件能力注册：records 与 calendar 的内容由对应插件提供，profile 占位保留，read tab 因无能力提供者依 ui-nav 既有语义隐藏。

桌面壳 SHALL 放行 TMDB 网络访问与本地缓存图：CSP 保持 null（Tauri 生产构建的 CSP 注入会追加 nonce，令浏览器忽略 'unsafe-inline'，从而拦截 RNW 运行时动态插入的 <style> 导致样式全崩——实测回归），网络访问在 null CSP 下本不受限；本地缓存图经 assetProtocol（scope `$APPDATA/**`）渲染。移动端 RN 原生 fetch 无 CORS 限制，不额外配置。

#### Scenario: 移动端引导
- **WHEN** apps/mobile 启动
- **THEN** core 完成初始化，platform-rn 的 Storage 被注入，业务插件按序启动，「记录」tab 渲染海报墙、「日历」tab 渲染热力图

#### Scenario: 桌面端引导
- **WHEN** apps/desktop（Tauri 窗口）启动
- **THEN** core 完成初始化，platform-tauri 的 Storage 被注入，同一组插件启动并渲染相同业务内容，TMDB 搜索与图片加载可用

#### Scenario: 插件缺失时壳自动降级
- **WHEN** 某业务插件未注册其能力（如 tmdb 未连接、timeline 卸载、read 无提供者）
- **THEN** 对应入口按能力缺失语义隐藏，壳不出现插件特定分支
