# ui-contracts Specification

## Purpose

Phase 3 契约：tag/search/stats 能力 key 与事件名、TagPickerProps/RecordQuery 等类型、查询引擎共享工具。

## Requirements

### Requirement: Phase 3 契约常量与类型
ui-contracts SHALL 以常量导出 Phase 3 的跨插件能力 key：`cmd:tag-list` / `cmd:tag-create` / `cmd:tag-rename` / `cmd:tag-delete` / `cmd:tag-filter`、`ui:tag-picker`、`cmd:search`、`cmd:record-remove-tag`（edit 暴露的标签引用清洗内部通道）与事件名 `tag:created/renamed/deleted`（payload `{id}`）。SHALL 导出对应契约类型：`TagListCommand`、`TagCreateCommand`、`TagPickerComponent`（props：已选 id 列表 + 变更回调 + 可选创建入口）、`SearchCommand`、`RecordQuery`（text/tagIds/ratingRange/mediaType/dateRange）、`RecordRemoveTagCommand`。供需双方 SHALL 引用常量而非字面量；全部 key SHALL 全局唯一（含既有 Phase 1/2 key）。

#### Scenario: 常量唯一性
- **WHEN** 校验全部能力 key 与事件名
- **THEN** 新增 key 与 Phase 1/2 既有 key 无任何重复

#### Scenario: 查询对象类型约束
- **WHEN** display 调用 `cmd:search` 传入 RecordQuery
- **THEN** 类型在编译期约束字段形态，key 漂移不可表示

### Requirement: Phase 4 契约常量与类型
ui-contracts SHALL 以常量导出 Phase 4 的跨插件 key：服务名 `svc:http`（HTTP_SERVICE）、`cmd:jellyfin-sync`、`cmd:jellyfin-configure`、`cmd:record-apply-jellyfin`、事件名 `jellyfin:sync-progress`（JELLYFIN_EVENTS）、`cmd:tmdb-backfill-known`、`tmdb:backfill-progress`（TMDB_EVENTS）。SHALL 导出契约类型：`HttpService`（fetch 兼容签名 + HttpError 错误类型 `{kind: "timeout"|"network"|"status", status?: number, url: string}`）、`JellyfinSyncCommand`（`() => Promise<JellyfinSyncResult>`，结果 `{status:"imported", count} | {status:"noop"} | {status:"error", message}`）、`JellyfinSyncProgress`（`{page, fetched, imported}`，sync-progress 事件负载）、`TmdbBackfillKnownCommand`/`TmdbBackfillKnownResult`、`TmdbBackfillProgress`（`{done, total, updated}`）、`RecordApplyJellyfinCommand`。供需双方 SHALL 引用常量；新增 key 与既有全部 key 全局唯一。

#### Scenario: 常量唯一性
- **WHEN** 校验 Phase 4 新增 key
- **THEN** 与 Phase 1–3 既有 key 无重复

#### Scenario: HttpError 类型约束
- **WHEN** 消费方捕获 svc:http 错误
- **THEN** kind/status/url 字段在编译期受约束，错误处理可穷举分支
