## MODIFIED Requirements

### Requirement: TMDB 客户端口（headless）
plugin-tmdb SHALL 提供纯 TS 客户端口：HTTP fetch 函数注入（RN 原生 fetch / Tauri fetch）、baseURL/语言/凭证可参数化、搜索（标题 + mediaType 约束 movie/episode 所属剧集）、详情拉取。客户端口 MUST 在纯 Node 测试中以 stub fetch 验证（URL 拼装、query 参数、错误映射），不发起真实网络。Phase 4 起，注入的 fetch 实现 SHALL 优先取自 `svc:http` 服务（超时/重试/日志收敛）；服务未注册时回退裸 fetch，行为与 Phase 3 完全一致。

#### Scenario: 搜索请求拼装
- **WHEN** 以标题「深海」调用搜索且语言偏好为 zh-CN
- **THEN** 注入的 fetch 收到 `/search/movie` 请求，query 含 `query=深海`、`language=zh-CN`、凭证按形态（v4 Bearer 头 / v3 api_key）携带

#### Scenario: stub 注入可测
- **WHEN** 在纯 Node vitest 中以 stub fetch 构造客户端口
- **THEN** 响应被映射为内部候选类型，网络错误被映射为统一错误对象

#### Scenario: 经 svc:http 消费
- **WHEN** plugin-network 已注册 `svc:http`
- **THEN** TMDB 请求经其发出（享受超时/重试），dev 日志可见；服务缺失时裸 fetch 回退
