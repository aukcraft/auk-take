## Why

AukTake 已具备完整的手动录入与 TMDB 元数据能力，但 Jellyfin 用户观看历史仍需逐条手录。Phase 4 接入 Jellyfin：手动拉取观看历史、增量去重导入，同时兑现 Phase 2 留下的架构决策——出现第二个网络消费者时，把 HTTP 请求抽取为 `svc:http` 网络插件（超时/重试/日志收敛一处）。

## What Changes

- 新增 `packages/plugin-network`（tier: locked，permissions: 无网络权限声明——仅注册 `svc:http` 服务）：注入式 fetch 封装——超时（AbortController）、有限重试（幂等 GET、指数退避）、统一错误类型（`HttpError{kind: timeout|network|status}`）、dev 请求日志；注册为 ServiceRegistry 服务，TMDB 与 Jellyfin 两个消费者经 `services.get` 取用，fetch 本体仍注入可测
- 新增 `packages/plugin-jellyfin`（tier: recommended，permissions: `network:fetch` + `storage:read/write`）：
  - **凭证**：服务器 URL + API Key（用户配置，加密落盘复用 secret-crypto 模式；未配置时功能降级隐藏）
  - **客户端口**：Jellyfin REST API headless 封装（fetch 经 `svc:http`）：`/System/Info` 连通性探测、`/Users` + `/Items`（Played=true 过滤 + Fields 含 ProviderIds/Overview/Genres）观看历史拉取
  - **增量同步**：`cmd:jellyfin-sync`（手动拉取）：以 `source.jellyfin.itemId + playedAt` 为身份去重（schema Phase 0 已预留），仅导入新条目；写入经 edit 内部通道（`cmd:record-apply-jellyfin`，保持唯一写入方），`source.type='jellyfin'` 携带 itemId/playedAt/playCount
  - **元数据映射**：Jellyfin item → TmdbSnapshot 形态（tmdb.id 取 ProviderIds.Tmdb，缺失则 0 = 仍可 TMDB 补全；genres/overview/runtime/releaseDate 直映；posterPath 留空走色卡/TMDB 补全——Jellyfin 图片 URL 不落 snapshot）
  - **同步 UI**：设置弹层（URL/Key，加密提示）+ 同步结果反馈（新增 N 条 / 无新条目 / 错误明细）
- 修改 `packages/plugin-tmdb`：TmdbClient/ImageCache 的 fetchImpl 改经 `svc:http`（服务缺失时回退裸 fetch，行为不变）；新增 `cmd:tmdb-backfill-known` 批量自动补全（仅 tmdb.id 已知且无海报的记录，按 id 直拉无歧义；`tmdb:backfill-progress` 进度事件）
- 修改 `packages/plugin-edit`：暴露 `cmd:record-apply-jellyfin` 批量导入通道（保留 records 唯一写入方 invariant）
- 修改 ui-contracts：`svc:http`/jellyfin key 常量与契约类型（`HttpService`、`JellyfinSyncCommand`、`RecordApplyJellyfinCommand`）
- 壳：装配 plugin-network（locked，先于消费者）与 plugin-jellyfin（recommended）；「我的」tab 统计视图下加同步入口与「补全元数据」入口；jellyfin 同步成功导入后自动触发元数据补全

### Non-goals（本 change 明确不做）

- 自动定时同步/后台调度（手动拉取，后续按需加）
- 双向回写（Jellyfin 播放状态写回）、多服务器多用户
- Jellyfin 图片缓存（poster 走既有色卡/TMDB 管线）
- WebDAV/iCloud 同步（独立后续 change）
- 账号密码登录流程（仅 API Key）

## Capabilities

### New Capabilities

- `plugin-network`: 网络服务插件——`svc:http` 注入式 HTTP 封装（超时/重试/统一错误/dev 日志）
- `plugin-jellyfin`: Jellyfin 同步插件——凭证配置、客户端口、增量去重导入、同步 UI

### Modified Capabilities

- `plugin-tmdb`: fetch 消费迁移到 `svc:http`（缺失回退裸 fetch）
- `plugin-edit`: `cmd:record-apply-jellyfin` 批量导入内部通道
- `host-shell`: 两插件装配（network=locked 先行、jellyfin=recommended）、同步入口位置
- `ui-contracts`: Phase 4 key/契约类型

## Impact

- 新增代码：`packages/plugin-network`、`packages/plugin-jellyfin`
- 修改代码：`plugin-tmdb`（fetch 源切换）、`plugin-edit`（导入通道）、双壳 bootstrap、`ui-contracts`、dep-guard allow-list
- 无新第三方依赖（AbortController/Timer 为平台原生；secret-crypto 复用）
- 里程碑：Phase 4（GitHub Issue/PR 流程同前）
