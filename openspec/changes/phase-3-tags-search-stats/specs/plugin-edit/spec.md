## MODIFIED Requirements

### Requirement: 插件契约与命令能力
plugin-edit SHALL 实现 `AukPlugin` 契约（id `edit`，tier `locked`，permissions `storage:read` + `storage:write`）：`connect` 一次性返回空 connection state；`create` 注册 `cmd:record-edit`（签名 `(options?: { recordId?: string }) => void`，无 recordId 为新建、有 recordId 为编辑既有记录）与 `cmd:record-delete`（`(recordId: string) => void`）两个函数型能力，并注册 `ui:overlay:root` 全局编辑弹层组件。命令能力在插件未加载时 SHALL 为 undefined，调用方据此降级。

Phase 2 起，编辑弹层 SHALL 在标题输入区提供 TMDB 搜索绑定入口（`cmd:tmdb-search` 未注册时整块隐藏）：搜索框 + 候选列表 + 「跳过，纯手动」。编辑器 SHALL 新增内部绑定语义：已绑定记录（`tmdb.id > 0`）保存时保留既有 TMDB 快照字段、仅更新 user 字段与标题呈现名；用户显式解绑后记录回退 manual 快照（`tmdb.id = 0` 哨兵 + 空元数据）。补全命令（`cmd:tmdb-backfill`）写入经 edit 暴露的记录更新内部通道进行，保持 edit 为 records 唯一写入方。

Phase 3 起，编辑弹层 SHALL 提供标签选择区（经 `ui:tag-picker` 组件能力，未注册时整块隐藏）：多选 chips + 新建入口，选中集实时进入草稿 `user.tags`，保存随记录持久化并照常发布 `record:*` 事件；标签重命名/删除引发的引用清洗 SHALL 经 edit 暴露的批量记录更新内部通道执行（edit 仍为唯一写入方，通道经 ui-contracts key 约定）。

#### Scenario: 新建命令
- **WHEN** 任一插件调用 `cmd:record-edit()`（无参数）
- **THEN** 编辑弹层以空白表单（默认观看日=当天）打开

#### Scenario: 编辑命令
- **WHEN** 调用 `cmd:record-edit({ recordId })` 且该记录存在
- **THEN** 编辑弹层打开并预填该记录既有字段（含已选标签）

#### Scenario: 命令未注册时降级
- **WHEN** edit 插件未加载，调用方 `capabilities.get` 拉取编辑命令
- **THEN** 返回 undefined，调用方隐藏入口或提示，不抛错

#### Scenario: 搜索能力缺失时弹层完整可用
- **WHEN** plugin-tmdb 未加载（`cmd:tmdb-search` 未注册）
- **THEN** 编辑弹层不渲染搜索区，行为与手动形态一致

#### Scenario: 绑定记录保存
- **WHEN** 编辑已绑定 TMDB 的记录（改评分 + 观后感）并保存
- **THEN** TMDB 快照字段保持不变，user 字段更新，`record:updated` 发布

#### Scenario: 解绑回退哨兵
- **WHEN** 用户在编辑器对已绑定记录显式解绑并保存
- **THEN** 记录 `tmdb.id` 回到 0，元数据字段清空为哨兵值，poster 色卡渲染回归

#### Scenario: 标签区保存
- **WHEN** 编辑器选中两个标签并保存
- **THEN** 记录 `user.tags` 含两个标签 id，`record:updated` 发布

#### Scenario: 标签能力缺失降级
- **WHEN** plugin-tag 未加载（`ui:tag-picker` 未注册）
- **THEN** 编辑弹层不渲染标签区，其余功能不受影响

#### Scenario: 标签引用清洗通道
- **WHEN** tag 插件请求删除标签的引用清洗
- **THEN** edit 内部通道批量移除记录中的该标签 id，每条变更发布 `record:updated`
