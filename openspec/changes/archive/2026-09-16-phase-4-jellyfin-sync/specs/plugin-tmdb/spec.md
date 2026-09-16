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

### Requirement: 已知 id 批量自动补全
Phase 4 起，plugin-tmdb SHALL 暴露 `cmd:tmdb-backfill-known` 批量补全能力：对全部 `tmdb.id > 0` 且 `posterPath` 为空的记录按 id 直接拉取详情（电影 `/movie/{id}`；剧集按 series id + 季/集号，无法解析的记录计为 skipped 不写错误数据），经 `cmd:record-apply-tmdb` 写入（edit 保持唯一写入方）。处理 SHALL 节流（默认 250ms/条）、单条失败不中断整批（skipped/failed 分类计数）、具备重入保护，并逐条发布 `tmdb:backfill-progress` 事件（`{done, total, updated}`）。tmdb.id=0 的哨兵记录 SHALL NOT 被该通道处理（仍走人工搜索补全）。

#### Scenario: 按 id 直拉无歧义
- **WHEN** jellyfin 同步导入 N 条带 ProviderIds.Tmdb 的记录
- **THEN** 同步完成后自动触发批量补全，海报/简介等元数据按 id 拉齐并逐条发布 record:updated

#### Scenario: 剧集 id 无法解析
- **WHEN** 剧集记录的 tmdb.id 为剧集级 id（非 series id）
- **THEN** 该条计为 skipped 跳过，不绑定错误元数据，整批继续

#### Scenario: 重入保护
- **WHEN** 批量补全进行中再次调用命令
- **THEN** 返回 already-running，不并发执行
