## ADDED Requirements

### Requirement: Phase 4 契约常量与类型
ui-contracts SHALL 以常量导出 Phase 4 的跨插件 key：服务名 `svc:http`（HTTP_SERVICE）、`cmd:jellyfin-sync`、`cmd:jellyfin-configure`、`cmd:record-apply-jellyfin`。SHALL 导出契约类型：`HttpService`（fetch 兼容签名 + HttpError 错误类型 `{kind: "timeout"|"network"|"status", status?: number, url: string}`）、`JellyfinSyncCommand`（`() => Promise<JellyfinSyncResult>`，结果 `{status:"imported", count} | {status:"noop"} | {status:"error", message}`）、`RecordApplyJellyfinCommand`。供需双方 SHALL 引用常量；新增 key 与既有全部 key 全局唯一。

#### Scenario: 常量唯一性
- **WHEN** 校验 Phase 4 新增 key
- **THEN** 与 Phase 1–3 既有 key 无重复

#### Scenario: HttpError 类型约束
- **WHEN** 消费方捕获 svc:http 错误
- **THEN** kind/status/url 字段在编译期受约束，错误处理可穷举分支
