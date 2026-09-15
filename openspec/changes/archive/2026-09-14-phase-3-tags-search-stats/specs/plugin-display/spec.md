## MODIFIED Requirements

### Requirement: 记录 tab 内容提供者
plugin-display SHALL 实现 `AukPlugin` 契约（id `display`，tier `locked`，permissions `storage:read`），在 `create` 时注册 `ui:tab:records` 内容组件（即 ui-nav TabDefinition 中 records tab 的 capabilityKey），使「记录」tab 从壳占位替换为插件内容。壳移除 records 占位后，该 tab 的可见性 SHALL 完全由本插件的能力注册状态决定。

Phase 3 起，记录 tab 头部 SHALL 接入搜索框与筛选入口（由 plugin-search 提供的组件能力/命令驱动；`cmd:search` 或其 UI 能力未注册时入口整体隐藏 + dev warn）。过滤后的结果 SHALL 经既有海报墙/时间线渲染链路展示（数据源切换为过滤结果，空结果显示「无匹配记录」空态）。

#### Scenario: tab 内容来自插件
- **WHEN** 双壳启动且 display 插件已加载
- **THEN** 「记录」tab 渲染海报墙内容，不再显示壳占位

#### Scenario: 搜索入口接入
- **WHEN** plugin-search 已加载
- **THEN** 记录 tab 头部出现搜索框与筛选按钮

#### Scenario: 搜索插件缺失
- **WHEN** plugin-search 未注册其能力
- **THEN** 记录 tab 头部无搜索/筛选入口，海报墙正常，dev 模式警告

#### Scenario: 过滤空结果
- **WHEN** 当前筛选无任何匹配记录
- **THEN** 内容区显示「无匹配记录」空态与「清除筛选」动作

### Requirement: 只读详情
plugin-display SHALL 注册 `cmd:record-detail` 命令（`(recordId: string) => void`），打开只读详情视图（移动端底部弹层、桌面端居中卡片，同组件内分支）：展示记录全部字段（标题、原题、类型与 SxxExx、观看日期、评分或未评分、观后感），在 `tmdb.id > 0` 时追加元数据区（genres、runtime、releaseDate、overview 摘要），并在 `user.tags` 非空时展示标签 chips（`cmd:tag-list` 未注册时仅显示 id 降级）。详情视图的动作按钮 SHALL 仅转发 `cmd:record-edit` 与 `cmd:record-delete` 命令，不自持变更逻辑。相关命令未注册时对应动作按钮隐藏。

#### Scenario: 查看详情
- **WHEN** 从海报墙卡片调用 `cmd:record-detail`
- **THEN** 详情视图展示该记录全部字段，无编辑态

#### Scenario: 标签展示
- **WHEN** 记录含 2 个标签引用
- **THEN** 详情以 chips 展示标签名称（经 `cmd:tag-list` 解析）

#### Scenario: 动作命令缺失降级
- **WHEN** edit 插件未加载
- **THEN** 详情的编辑/删除按钮隐藏，浏览不受影响
