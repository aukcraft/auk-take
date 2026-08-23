## ADDED Requirements

### Requirement: 观影记录实体（支持电影与剧集）
`MovieRecord` SHALL 为观影记录核心实体，每次观看一条记录。字段：`id`（ULID）、内联 TMDB 元数据快照、用户数据、来源追踪、媒体缓存路径、系统时间戳。TMDB 快照 MUST 包含 `mediaType: 'movie' | 'episode'`；当 `mediaType === 'episode'` 时 SHALL 附带可选 `seasonNumber`/`episodeNumber`。同一影片（含同一集）多次观看产生多条记录，此语义 MUST 在 schema 注释中明确。

#### Scenario: 创建电影记录
- **WHEN** 用户手动记录一部电影
- **THEN** 生成 `MovieRecord`，`tmdb.mediaType` 为 `'movie'`，无 season/episode 字段

#### Scenario: Jellyfin 导入剧集
- **WHEN** `import-jellyfin` 插件导入一条 S02E05 播放记录
- **THEN** 生成 `tmdb.mediaType === 'episode'` 且 `seasonNumber: 2`、`episodeNumber: 5` 的记录，`source.type === 'jellyfin'` 并携带 itemId/playedAt/playCount

#### Scenario: 同一影片重复观看
- **WHEN** 用户对同一 TMDB id 影片创建第二条记录
- **THEN** 生成独立的新记录（新 ULID），不覆盖或合并既有记录

### Requirement: 用户数据字段
`user` 字段 SHALL 包含：`watchedAt`（ISO 8601 日期）、`rating`（0–10，步进 0.5，0 表示未评分）、`review`（纯文本观后感）、`tags`（标签 id 数组）。评分的渲染形式（5 星/10 分）由 rating 插件决定，schema 层不感知。

#### Scenario: 未评分记录
- **WHEN** 用户保存记录时未打分
- **THEN** `user.rating` 为 0，后续筛选/统计将其视为"未评分"而非 0 分

### Requirement: 心情为独立历史实体
`MoodEntry` SHALL 为独立实体：`id`、`recordId`、`mood`、`note?`、`createdAt`，存储于 `mood-entries` 集合。心情记录 MUST NOT 作为 record 的单值字段——重读同一记录多次产生多条 MoodEntry，形成心情时间线。

#### Scenario: 同一记录多次记录心情
- **WHEN** 用户在"读"Tab 对同一记录先后记录两次心情
- **THEN** 产生两条独立 MoodEntry，两者均保留并可按时间线展示

### Requirement: 标签实体
`Tag` SHALL 为独立实体：`id`、`name`、`color?`、`createdAt`，存储于 `tags` 集合，由 tag 插件管理。record 通过 `user.tags` 中的标签 id 引用。

#### Scenario: 标签引用完整性
- **WHEN** record 的 `user.tags` 包含某标签 id 且该标签存在于 `tags` 集合
- **THEN** filter/stats 可按该标签聚合；引用不存在标签 id 时该 id 被静默忽略

### Requirement: 同步元数据独立存储
`SyncMeta` SHALL 为独立实体：`recordId`、`version`、`checksum`、`lastSyncedAt?`、`conflict?`，存储于 `sync-meta` 集合，由 sync 引擎维护，MUST NOT 内嵌于 MovieRecord。

#### Scenario: 同步元数据不污染业务数据
- **WHEN** sync 引擎更新某记录的版本与校验和
- **THEN** `records` 集合中的该 MovieRecord 内容不变，仅 `sync-meta` 集合更新

### Requirement: schema 版本预留
每条持久化记录 SHALL 附带 `schemaVersion` 字段，初始为 1。未来 schema 演进 MUST 提供迁移路径而非静默变更。

#### Scenario: 未知版本被识别
- **WHEN** 读取到 `schemaVersion` 高于当前支持版本的记录
- **THEN** 系统识别为来自更新版本的数据并提示用户，而非静默丢弃或损坏数据
