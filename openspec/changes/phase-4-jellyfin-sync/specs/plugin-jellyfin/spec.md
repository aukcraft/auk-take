## ADDED Requirements

### Requirement: 凭证配置与降级
plugin-jellyfin SHALL 实现 `AukPlugin` 契约（id `jellyfin`，tier `recommended`，permissions: `network:fetch` + `storage:read` + `storage:write`）。凭证为服务器 URL + API Key，经设置弹层配置、**加密落盘**（复用 secret-crypto v1 格式，存 syncMeta `{id:"jellyfin-config"}`，URL 明文/Key 密文）。未配置或配置错误时同步命令 SHALL 返回明确错误提示，不阻塞其余功能；连通性可经 `/System/Info` 探测（保存时自动验证并反馈）。

#### Scenario: 保存即验证
- **WHEN** 用户填入 URL + Key 并保存
- **THEN** 探测 `/System/Info`，成功提示服务器名、失败提示具体原因（网络/401）

#### Scenario: Key 加密落盘
- **WHEN** 配置持久化
- **THEN** syncMeta 中 Key 为 `v1:<iv>:<cipher>` 形态，重启解密可用

#### Scenario: 未配置降级
- **WHEN** 从未配置凭证
- **THEN** 同步入口提示「未配置」，应用其余功能不受影响

### Requirement: 客户端口（headless）
plugin-jellyfin SHALL 提供纯 TS 客户端口（fetch 经 `svc:http`，可 stub 注入）：`systemInfo()`（连通/版本）、`currentUser()`（API Key 对应用户）、`playedItems(userId)`（观看历史：Played=true，Fields 含 ProviderIds/ProductionYear/Overview/Genres/RuntimeTicks/PremiereDate/SeriesName/ParentIndexNumber/IndexNumber）。URL 拼装与鉴权头（`Authorization: MediaBrowser Token="<key>"`）为纯函数可断言；错误经 HttpError 透传。

#### Scenario: 鉴权头拼装
- **WHEN** 以 stub fetch 调用任一接口
- **THEN** 请求携带 `Authorization: MediaBrowser Token="<key>"` 与完整 query

#### Scenario: 分页拉全量
- **WHEN** 观看历史超过单页上限
- **THEN** 客户端口按 Skip/Take 循环拉取至无更多条目

### Requirement: 增量同步与去重
`cmd:jellyfin-sync` SHALL 手动拉取观看历史并**增量导入**：身份 = `source.jellyfin.itemId + playedAt`（schema Phase 0 预留字段），已在本地存在同身份的记录跳过；新条目经 `cmd:record-apply-jellyfin`（edit 内部通道，唯一写入方）批量写入，`source={type:'jellyfin', jellyfin:{itemId, playedAt, playCount}}`。同步结果 SHALL 汇总反馈（新增 N 条 / 无新条目 / 失败明细）。已导入记录不回写、不覆盖本地编辑。

同步 SHALL 采用**分批渐进**策略（大库容错）：按 `DatePlayed` 升序（从远到近）逐页拉取；新条目攒满批次阈值（默认 1000 条）即提交落盘一批并短暂停顿（默认 150ms）；**每页拉取后**发布 `jellyfin:sync-progress` 事件（`{page, fetched, imported}`，页码逐页递增，纯翻页无新增时同样发布，UI 进度逐步可见）；同步游标（skip 偏移，绑定 baseUrl）SHALL 持久化于 syncMeta 并按页推进。中途失败 SHALL 保留已提交批次与游标，重试从断点续传；游标到达列表尾部后，后续同步仅从尾部拉取新增。

#### Scenario: 首次导入
- **WHEN** 服务器有 10 条观看历史且本地无 jellyfin 记录
- **THEN** 导入 10 条，反馈「新增 10 条」

#### Scenario: 重复同步增量
- **WHEN** 再次同步且服务器仅多 2 条
- **THEN** 仅从游标位置拉取尾部新增，导入 2 条，其余 10 条因身份重复跳过，本地对其的编辑不受影响

#### Scenario: 写入经唯一通道
- **WHEN** 导入执行
- **THEN** 全部新记录经 `cmd:record-apply-jellyfin` 写入（edit 为 records 唯一写入方），每条发布 `record:created`

#### Scenario: 分批提交与进度
- **WHEN** 一次同步产生 1200 条新记录（批次阈值 500）
- **THEN** 分 3 批（500/500/200）提交落盘，每批后发布进度事件，游标最终停在 1200

#### Scenario: 断点续传
- **WHEN** 同步在第二页网络失败
- **THEN** 第一批已落盘记录保留、游标停在失败页起点；重试从该位置继续且不重复导入

#### Scenario: 换服务器重置游标
- **WHEN** 配置指向另一台服务器（baseUrl 变化）
- **THEN** 游标归 0，从头全量扫描

### Requirement: 元数据映射
Jellyfin item SHALL 映射为记录快照：`tmdb.id` = ProviderIds.Tmdb（缺失为 0，仍可后续 TMDB 补全）；title = Name（剧集条目 = `SeriesName + SxxExx` 语义：title 取 SeriesName、S/E 取 ParentIndexNumber/IndexNumber）；originalTitle 同 title；overview/genres/runtime（RuntimeTicks→分钟）/releaseDate（PremiereDate→日期）直映；posterPath 留空（色卡/补全管线）。映射为纯函数可测。

#### Scenario: 电影条目映射
- **WHEN** item 为电影且 ProviderIds.Tmdb=123
- **THEN** 快照 tmdb.id=123、runtime 为分钟数、type='jellyfin'

#### Scenario: 剧集条目映射
- **WHEN** item 为 S02E05
- **THEN** title=剧集名、seasonNumber=2、episodeNumber=5、badge 渲染 S02E05

#### Scenario: 无 TMDB id
- **WHEN** ProviderIds 无 Tmdb
- **THEN** tmdb.id=0（哨兵），详情出现「补全元数据」入口
