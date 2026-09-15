## MODIFIED Requirements

### Requirement: 插件契约与命令能力
plugin-edit SHALL 实现 `AukPlugin` 契约（id `edit`，tier `locked`，permissions `storage:read` + `storage:write`）：`connect` 一次性返回空 connection state；`create` 注册 `cmd:record-edit`（签名 `(options?: { recordId?: string }) => void`，无 recordId 为新建、有 recordId 为编辑既有记录）与 `cmd:record-delete`（`(recordId: string) => void`）两个函数型能力，并注册 `ui:overlay:root` 全局编辑弹层组件。命令能力在插件未加载时 SHALL 为 undefined，调用方据此降级。

Phase 2 起，编辑弹层 SHALL 在标题输入区提供 TMDB 搜索绑定入口（`cmd:tmdb-search` 未注册时整块隐藏）：搜索框 + 候选列表 + 「跳过，纯手动」。编辑器 SHALL 新增内部绑定语义：已绑定记录（`tmdb.id > 0`）保存时保留既有 TMDB 快照字段、仅更新 user 字段与标题呈现名；用户显式解绑后记录回退 manual 快照（`tmdb.id = 0` 哨兵 + 空元数据）。补全命令（`cmd:tmdb-backfill`）写入经 edit 暴露的记录更新内部通道进行，保持 edit 为 records 唯一写入方。

Phase 3 起，编辑弹层 SHALL 提供标签选择区（经 `ui:tag-picker` 组件能力，未注册时整块隐藏）：多选 chips + 新建入口，选中集实时进入草稿 `user.tags`，保存随记录持久化并照常发布 `record:*` 事件；标签重命名/删除引发的引用清洗 SHALL 经 edit 暴露的批量记录更新内部通道执行（edit 仍为唯一写入方，通道经 ui-contracts key 约定）。

Phase 4 起，edit SHALL 暴露 `cmd:record-apply-jellyfin` 批量导入内部通道：`(records: MovieRecord[]) => Promise<number>`——jellyfin 同步产出的完整记录（含 source/user 快照）经此一次性写入并逐条发布 `record:created`；该通道**仅接受带 `source.type='jellyfin'` 的记录**（防御性校验），保持 edit 为 records 唯一写入方。

#### Scenario: 新建命令
- **WHEN** 任一插件调用 `cmd:record-edit()`（无参数）
- **THEN** 编辑弹层以空白表单（默认观看日=当天）打开

#### Scenario: 编辑命令
- **WHEN** 调用 `cmd:record-edit({ recordId })` 且该记录存在
- **THEN** 编辑弹层打开并预填该记录既有字段（含已选标签）

#### Scenario: 命令未注册时降级
- **WHEN** edit 插件未加载，调用方 `capabilities.get` 拉取编辑命令
- **THEN** 返回 undefined，调用方隐藏入口或提示，不抛错

#### Scenario: jellyfin 批量导入
- **WHEN** jellyfin 同步产出 5 条新记录并调用 `cmd:record-apply-jellyfin`
- **THEN** 5 条全部落盘、逐条发布 `record:created`，返回写入数 5

#### Scenario: 导入通道防御
- **WHEN** 通道收到 `source.type` 非 'jellyfin' 的记录
- **THEN** 该记录被拒绝写入并报错，其余合法记录不受影响
