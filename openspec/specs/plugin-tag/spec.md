# plugin-tag Specification

## Purpose

标签插件：tags 集合唯一写入方（重名拒绝/重命名保 id/删除清洗引用）、命令族与选择器组件、编辑器集成。

## Requirements

### Requirement: tags 集合唯一写入方
plugin-tag SHALL 实现 `AukPlugin` 契约（id `tag`，tier `locked`，permissions `storage:read` + `storage:write`），是 `tags` 集合的唯一写入方：创建（名称必填、去首尾空白、**重名拒绝**——名称大小写与空白不敏感）、重命名（保持 id 不变、同步清洗引用该标签的记录）、删除（**必须同步从全部记录的 `user.tags` 中移除该 id**，经 edit 暴露的内部更新通道批量执行，保持 edit 为 records 唯一写入方）。变更后 SHALL 发布 `tag:created/renamed/deleted` 事件（payload `{id}`）。

#### Scenario: 重名拒绝
- **WHEN** 已存在标签「科幻」时创建「 科科 」以外的新标签「科幻 」
- **THEN** 创建被拒绝并报错，集合不变

#### Scenario: 删除清洗引用
- **WHEN** 删除被 3 条记录引用的标签
- **THEN** 标签移除且 3 条记录的 `user.tags` 不再含该 id，记录其余字段不变

#### Scenario: 重命名保持 id
- **WHEN** 重命名标签
- **THEN** 该标签 id 不变，引用记录无需变更（引用按 id）

### Requirement: 命令族与选择器组件
plugin-tag SHALL 注册命令族：`cmd:tag-list`（返回全部标签快照，按名称排序）、`cmd:tag-create`（名称 → Tag，重名报错）、`cmd:tag-rename`、`cmd:tag-delete`；注册 `ui:tag-picker` 组件能力（props 契约：当前已选 id 列表 + 变更回调 + 可选的创建入口）。命令/组件未注册时消费方 SHALL 隐藏入口降级，不抛错。

#### Scenario: 列表按名排序
- **WHEN** 调用 `cmd:tag-list`
- **THEN** 返回按名称 locale 排序的不可变标签数组

#### Scenario: 选择器组件被编辑器消费
- **WHEN** 编辑器加载且 `ui:tag-picker` 已注册
- **THEN** 标签区渲染选择器（多选 chips + 新建），变更实时反映到草稿

### Requirement: 编辑器标签集成
编辑表单 SHALL 经 `ui:tag-picker` 展示标签选择区，选中集实时写入草稿的 `user.tags`（仅合法存在的 id）；保存时随记录持久化并照常发布 `record:*` 事件。tag 插件未加载时标签区整体隐藏，手动录入不受影响。详情视图 SHALL 展示记录标签（chips，点击转发 `cmd:tag-filter` 若已注册）。

#### Scenario: 保存携带标签
- **WHEN** 用户选中「科幻」「动画」两个标签后保存
- **THEN** 记录 `user.tags` 含这两个 id

#### Scenario: 标签插件缺失降级
- **WHEN** plugin-tag 未加载
- **THEN** 编辑器无标签区，其余表单与保存完全正常
