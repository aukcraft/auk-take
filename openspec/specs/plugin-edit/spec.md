# plugin-edit Specification

## Purpose

观影记录编辑插件：records 集合唯一写入方、手动录入编辑器、字段校验、删除二次确认与 record:* 事件发布。

## Requirements

### Requirement: 插件契约与命令能力
plugin-edit SHALL 实现 `AukPlugin` 契约（id `edit`，tier `locked`，permissions `storage:read` + `storage:write`）：`connect` 一次性返回空 connection state；`create` 注册 `cmd:record-edit`（签名 `(options?: { recordId?: string }) => void`，无 recordId 为新建、有 recordId 为编辑既有记录）与 `cmd:record-delete`（`(recordId: string) => void`）两个函数型能力，并注册 `ui:overlay:root` 全局编辑弹层组件。命令能力在插件未加载时 SHALL 为 undefined，调用方据此降级。

Phase 2 起，编辑弹层 SHALL 在标题输入区提供 TMDB 搜索绑定入口（`cmd:tmdb-search` 未注册时整块隐藏）：搜索框 + 候选列表 + 「跳过，纯手动」。编辑器 SHALL 新增内部绑定语义：已绑定记录（`tmdb.id > 0`）保存时保留既有 TMDB 快照字段、仅更新 user 字段与标题呈现名；用户显式解绑后记录回退 manual 快照（`tmdb.id = 0` 哨兵 + 空元数据）。补全命令（`cmd:tmdb-backfill`）写入经 edit 暴露的记录更新内部通道进行，保持 edit 为 records 唯一写入方。

#### Scenario: 新建命令
- **WHEN** 任一插件调用 `cmd:record-edit()`（无参数）
- **THEN** 编辑弹层以空白表单（默认观看日=当天）打开

#### Scenario: 编辑命令
- **WHEN** 调用 `cmd:record-edit({ recordId })` 且该记录存在
- **THEN** 编辑弹层打开并预填该记录既有字段

#### Scenario: 命令未注册时降级
- **WHEN** edit 插件未加载，调用方 `capabilities.get` 拉取编辑命令
- **THEN** 返回 undefined，调用方隐藏入口或提示，不抛错

#### Scenario: 搜索能力缺失时弹层完整可用
- **WHEN** plugin-tmdb 未加载（`cmd:tmdb-search` 未注册）
- **THEN** 编辑弹层不渲染搜索区，行为与 Phase 1 手动形态一致

#### Scenario: 绑定记录保存
- **WHEN** 编辑已绑定 TMDB 的记录（改评分 + 观后感）并保存
- **THEN** TMDB 快照字段保持不变，user 字段更新，`record:updated` 发布

#### Scenario: 解绑回退哨兵
- **WHEN** 用户在编辑器对已绑定记录显式解绑并保存
- **THEN** 记录 `tmdb.id` 回到 0，元数据字段清空为哨兵值，poster 色卡渲染回归

### Requirement: 手动录入与快照默认值
Phase 1 编辑器 SHALL 仅支持手动录入元数据，不发起任何网络请求。手动创建的记录 MUST 满足：`tmdb.id = 0`（哨兵：无 TMDB 绑定）、`tmdb.title` 必填、`posterPath`/`backdropPath`/`overview`/`releaseDate` 为空串、`genres = []`、`runtime = 0`、`originalTitle` 默认等于 title、`source = { type: 'manual' }`、`id` 为 ULID、`schemaVersion = 1`、`mediaCache = {}`。该默认值约定 SHALL 作为 Phase 2 TMDB 补全作业的识别依据。

#### Scenario: 手动创建电影记录
- **WHEN** 用户填写标题「深海」并保存
- **THEN** 生成 MovieRecord：`tmdb.id === 0`、`posterPath === ''`、`source.type === 'manual'`、id 为合法 ULID

#### Scenario: TMDB 补全依据
- **WHEN** Phase 2 补全作业扫描记录集合
- **THEN** 可以 `tmdb.id === 0` 无歧义地识别「待补全」记录

### Requirement: 字段校验
编辑器 SHALL 在提交前执行纯函数校验并阻止无效提交：标题非空；`watchedAt` 匹配 `YYYY-MM-DD` 且为真实存在的日历日；`rating` ∈ [0, 10] 且为 0.5 的整数倍（0 语义为未评分，UI MUST 显式呈现「未评分」而非 0 分）；`mediaType === 'episode'` 时 `seasonNumber ≥ 1` 与 `episodeNumber ≥ 1` 必填，`mediaType === 'movie'` 时 MUST NOT 携带 S/E 值。校验错误 SHALL 逐字段反馈且保留用户已输入内容。

#### Scenario: 标题为空
- **WHEN** 用户清空标题后提交
- **THEN** 提交被阻止，标题字段显示必填错误，其余输入保留

#### Scenario: 非法日期
- **WHEN** watchedAt 输入 `2025-02-30`
- **THEN** 校验失败并提示日期不存在，提交被阻止

#### Scenario: 评分步进
- **WHEN** rating 值为 7.3
- **THEN** 校验失败（非 0.5 整数倍），提交被阻止

#### Scenario: 剧集缺季集号
- **WHEN** mediaType 为 episode 且未填 episodeNumber
- **THEN** 校验失败并指明缺失字段

### Requirement: records 集合唯一写入方
plugin-edit SHALL 是 `records` 集合的唯一写入方：创建/编辑走 loadAll → 变异 → persistAll 全量写；每次成功变更后 MUST 发布对应事件（创建→`record:created`、编辑→`record:updated`、删除→`record:deleted`），payload 为 `{ id }`。编辑语义 MUST 保持记录 id 与 createdAt 不变、更新 updatedAt。

#### Scenario: 编辑保持身份
- **WHEN** 用户编辑既有记录并保存
- **THEN** 该记录 id、createdAt 不变，被改字段更新，updatedAt 刷新，发布 `record:updated`

#### Scenario: 删除发布事件
- **WHEN** 删除命令成功执行
- **THEN** 记录从集合移除，发布 `record:deleted`，读方投影随后失效重载

### Requirement: 删除二次确认
`cmd:record-delete` 执行前 SHALL 向用户呈现二次确认（含记录标题），用户取消则不产生任何变更与事件。

#### Scenario: 取消删除
- **WHEN** 确认对话框中选择取消
- **THEN** 集合无任何变化，无事件发布

#### Scenario: 确认删除
- **WHEN** 确认删除
- **THEN** 记录被移除并发布 `record:deleted`
