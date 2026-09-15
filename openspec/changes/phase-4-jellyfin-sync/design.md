## Context

Phase 1–3 交付了手动录入、TMDB 元数据、标签/搜索/统计的完整闭环；架构上留有一张支票：网络请求出现第二个消费者时抽取 `svc:http`（Phase 2 design D6/对话决策）。Phase 4 = Jellyfin 手动同步（增量去重）+ 网络插件抽取兑现。用户已拍板：手动拉取触发、API Key 鉴权、增量去重。

## Goals / Non-Goals

**Goals:**

- `svc:http`：注入式 HTTP 封装（超时/GET 重试/统一 HttpError/dev 日志），tmdb 与 jellyfin 双消费者，缺失回退裸 fetch
- Jellyfin：URL+Key 加密配置（保存即 /System/Info 验证）、分页观看历史拉取、itemId+playedAt 身份去重、经 edit 通道批量导入、结果反馈
- 全部行为纯 Node 可测（stub fetch/timer/abort）；recommended tier 卸载零影响

**Non-Goals:**

- 自动调度、双向回写、多用户多服务器、Jellyfin 图片、账号密码登录（见 proposal）

## Decisions

### D1. plugin-network：locked 服务插件，零业务语义

`createNetworkPlugin(deps, { timeoutMs?, retries? })` → create 时 `services.register("svc:http", httpService)`。**无 permissions**：它不替消费者声明网络权限；tmdb/jellyfin 各自持有 `network:fetch`。装配顺序上 network 排在消费者前（消费者在 create 期 `services.get`，后注册则该次拿不到——但消费者按"缺失回退裸 fetch"设计，顺序错乱只是丢失重试，不崩）。HTTP 封装 headless：

- `createHttpService({ fetchImpl, timeoutMs=15000, retries=2, timer? })`
- 超时：`AbortController`（`globalThis.AbortController` 存在性探测，缺失环境注入 abort 工厂；纯 Node 18+ 有）
- 重试：仅 method GET/undefined；`HttpError{kind:'network'}` 或 status>=500 时退避 `base * 2^n`（base 500ms，timer 注入）；4xx 即抛 `{kind:'status',status}`
- dev 日志：`[http] GET <url> → 200 (123ms)`，不含 header/body

### D2. jellyfin 客户端口与映射

`JellyfinClient({ http, baseUrl, apiKey })`（http 即 svc:http 签名）：
- 头：`Authorization: MediaBrowser Token="<key>"`（buildUrl/headers 纯函数）
- `systemInfo()` → `/System/Info`；`currentUser()` → `/Users`（API Key 权限下取首位用户；多用户后续 need）
- `playedItems(userId)` → `/Users/{id}/Items?Filters=IsPlayed&Recursive=true&Fields=ProviderIds,Overview,Genres,RuntimeTicks,PremiereDate,SeriesName,ParentIndexNumber,IndexNumber&IncludeItemTypes=Movie,Episode`，`Skip/Take` 分页（Take=500 循环至 `Items.length < Take`）

`mapItemToRecord(item, now, generateId)`（纯函数）：MovieRecord 完整构造——
- `tmdb.id = Number(ProviderIds.Tmdb ?? 0)`；title：电影=Name，剧集=SeriesName（S/E=ParentIndexNumber/IndexNumber）
- runtime = RuntimeTicks / 10_000_000（分钟取整）；releaseDate = PremiereDate 前 10 位
- `user.watchedAt = LastPlayedDate 前 10 位`（无则 UserData?.LastPlayedDate ?? 空→跳过该条）；rating=0（未评分）；tags=[]
- `source = {type:'jellyfin', jellyfin:{itemId: item.Id, playedAt, playCount: UserData?.PlayCount ?? 1}}`
- 身份键函数 `jellyfinIdentity(record)` = `${itemId}@${playedAt}`

### D3. 增量同步流程（headless `syncJellyfin`，分批游标式）

> 修订（冒烟反馈）：原「一次性全量拉取再写入」在大库（1.6 万+ 条观看历史）上会被服务器/反代在深分页处断连（`http:network`）。改为**分批渐进**：升序（从远到近）逐页拉取、按批提交、游标持久化、批间停顿、进度事件。

1. 读配置（解密）→ 未配置 `{status:'error', message:'未配置'}`
2. `currentUser()` 确认用户
3. 读本地 records（storage:read 投影快照），构造身份集合；从 syncMeta 读**同步游标**（`{id:'jellyfin-sync-cursor', baseUrl, skip}`，baseUrl 不一致即归 0——换服务器自动重扫）
4. 升序（`SortBy=DatePlayed&SortOrder=Ascending`）从 `skip=cursor` 逐页拉取（Take=500）：每页映射去重（无 playedAt 跳过）累积新条目；**攒满 batchSize（默认 1000 条新记录）即经 `applyJellyfin` 提交一批**、停顿 `interBatchDelayMs`（默认 150ms）；**每页拉取后发布 `jellyfin:sync-progress` 事件（`{page, fetched, imported}`，页码为本次运行内序号）**，UI 逐页可见进度；每页结束即持久化游标（skip 按原始抓取数推进，含被跳过的条目）
5. 短页（<Take）收尾：提交残余批次，游标停在尾部——新增观看记录在升序列表尾部追加，下次同步从游标续拉即增量
6. 返回 `{status:'imported', count}` / `{status:'noop'}` / `{status:'error', message}`；**中途失败保留已提交批次与游标，重试从断点续传**（身份去重幂等）

edit 侧通道：`writer.importJellyfin(records)`——校验 `source.type==='jellyfin'`（防御，原子拒绝：任一非法整批不写）、loadAll→合并→persistAll→逐条 emit `record:created`，返回写入数。

### D4. 配置与 UI

- 配置存 syncMeta `{id:'jellyfin-config', baseUrl, apiKeyEnc}`（baseUrl 明文便于显示；Key 复用 secret-crypto）
- 设置弹层：plugin-jellyfin 自有 overlay（`ui:overlay:jellyfin` 加入 OVERLAY_KEYS）——URL + Key 输入、保存即 systemInfo 验证（成功显示 ServerName/Version）、失败显示 HttpError 具体化
- 同步入口：「我的」stats 视图底部「从 Jellyfin 导入」按钮（`cmd:jellyfin-sync` 注册时显示）→ 执行 → 结果 toast 式 Text 反馈（导入 N 条/无新条目/错误）；`cmd:jellyfin-configure` 打开设置
- 同步按钮 loading 态（进行中禁用）

### D5. tmdb 消费迁移

plugin-tmdb 的 `defaultFetch` 改为：组合根或 create 期 `services.get(HTTP_SERVICE)`，命中用之、否则裸 fetch。**单测不动**（测试注入 stub fetch 直接进 TmdbClient，svc:http 是运行时默认值）。ImageCache 同样经注入保持不动（其 fetchImpl 由 plugin.ts 传入——统一改为经 svc:http 解析的包装）。

### D6. 装配与守卫

- 双壳：network（locked）→ …现有顺序… → jellyfin（recommended，晚于 edit/network）
- dep-guard：+plugin-network（仅 core+ui-contracts）、+plugin-jellyfin（core+ui-contracts）；plugin-network 无 ulid 类额外 lib
- OVERLAY_KEYS 增 `ui:overlay:jellyfin`

## Risks / Trade-offs

- [API Key 权限范围大（等同管理员）] → 文档提示可创建受限用户专用 Key；v1 接受
- [LastPlayedDate 语义 = 最后播放时间，非首次] → 重看场景 playedAt 取最近值；与 AukTake「一次观看一条记录」语义的完全对齐需 Jellyfin ActivityLog（v2 评估），v1 以 IsPlayed+LastPlayedDate 为准并在 design 记账
- [超大库分页耗时] → ~~Take=500 + 手动触发可接受~~ 冒烟实测 1.6 万条库在深分页处被断连 → 已改分批游标同步（D3 修订）；进度经 `jellyfin:sync-progress` 事件实时反馈
- [游标漂移：服务器删除旧历史会移动 skip 偏移] → 身份去重防重复导入；漏导条目可通过换绑/重置游标重扫（v1 接受，重置入口后续按需）
- [svc:http 与消费者装配顺序耦合] → 消费者按缺失回退设计，顺序错乱仅损失重试，不崩

## Migration Plan

绿地增量。落地顺序（每步独立 PR/可回滚）：

1. ui-contracts：keys/types（HttpService/HttpError/Jellyfin 结果类型）
2. plugin-network：createHttpService headless + 全行为单测 + 工厂注册
3. plugin-jellyfin headless：client（stub 测 URL/头/分页）+ mapItemToRecord 矩阵 + syncJellyfin 增量单测
4. plugin-edit：importJellyfin 通道 + 防御校验单测
5. jellyfin UI：配置弹层（保存验证）+ 同步入口与结果反馈
6. tmdb 迁移 svc:http 消费（回退保留）
7. 壳装配 + dep-guard + 全仓验证 + 双端冒烟

## Open Questions

- 多用户 Jellyfin 服务器（API Key 可见全部用户）→ v1 取首位用户，家庭多账号后续选用户 UI
- ActivityLog 精细化观看时间 → v2 评估
- 同步冲突（本地删了又同步到）→ 按"本地删除即不再导入"语义（身份集合来自现存 records），v1 不做回收站
