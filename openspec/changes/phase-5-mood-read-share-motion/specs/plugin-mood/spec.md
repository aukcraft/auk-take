## ADDED Requirements

### Requirement: 心情录入
plugin-mood SHALL 实现 `AukPlugin` 契约（id `mood`，tier `recommended`，permissions `storage:read` + `storage:write`），注册 `cmd:mood-add` 命令（`(recordId: string) => void`，打开心情录入弹层）与 `ui:overlay:mood` 全局弹层组件（经 OVERLAY_KEYS 宿主渲染）。录入项为心情档（固定 emoji 档：love/ok/meh/bored/sad 语义 key）+ 可选短评 note；保存 SHALL 生成 `MoodEntry`（Phase 0 既有 schema：id/recordId/mood/note?/createdAt，mood-entries 集合）并发布 `mood:created` 事件（payload `{id}`）。同一记录多次录入 SHALL 产生多条独立 MoodEntry（心情时间线语义），MUST NOT 覆盖历史。能力未注册时详情页「记心情」入口隐藏。

#### Scenario: 录入一条心情
- **WHEN** 详情页点击「记心情」，选择 🙂 并填写短评后保存
- **THEN** mood-entries 新增一条 MoodEntry（mood="ok"，note 为短评），发布 `mood:created`

#### Scenario: 重复心情不覆盖
- **WHEN** 同一记录第二次录入心情
- **THEN** 集合新增第二条 entry，首条保持不变（时间线语义）

#### Scenario: 命令缺失降级
- **WHEN** plugin-mood 未加载
- **THEN** 详情页无「记心情」按钮，其余功能不受影响

### Requirement: 心情时间线与「读」tab
plugin-mood SHALL 注册 `ui:tab:read` 内容组件（ui-nav TabDefinition 中 read tab 的 capabilityKey）：**心情时间线**——MoodEntry join records 按 createdAt 倒序，条目展示心情 emoji + 记录标题 + 日期 + note；**观后感阅读**——records 中 `user.review` 非空的记录以卡片式阅读视图呈现（标题 + 观看日期 + 观后感全文）。两数据源均经私有投影派生（loadAll + `record:*`/`mood:*` 事件失效重载），排序/聚合 SHALL 为纯函数 selector，纯 Node 可测。

#### Scenario: read tab 出现
- **WHEN** plugin-mood 加载并注册 `ui:tab:read`
- **THEN** 「读」tab 出现在导航中，展示心情时间线与观后感阅读

#### Scenario: 心情联动记录标题
- **WHEN** 某记录的 MoodEntry 进入时间线
- **THEN** 条目展示该记录标题（经投影 join），记录删除后条目以标题快照降级展示

#### Scenario: mood 卸载 read tab 隐藏
- **WHEN** plugin-mood 未加载
- **THEN** 「读」tab 依 ui-nav 能力驱动语义隐藏，壳无 mood 分支
