## ADDED Requirements

### Requirement: 记录 tab 内容提供者
plugin-display SHALL 实现 `AukPlugin` 契约（id `display`，tier `locked`，permissions `storage:read`），在 `create` 时注册 `ui:tab:records` 内容组件（即 ui-nav TabDefinition 中 records tab 的 capabilityKey），使「记录」tab 从壳占位替换为插件内容。壳移除 records 占位后，该 tab 的可见性 SHALL 完全由本插件的能力注册状态决定。

#### Scenario: tab 内容来自插件
- **WHEN** 双壳启动且 display 插件已加载
- **THEN** 「记录」tab 渲染海报墙内容，不再显示壳占位

### Requirement: 海报墙网格
海报墙 SHALL 以网格渲染全部记录，按 `user.watchedAt` 倒序排列。卡片图片解析顺序 SHALL 为 `mediaCache.poster` → `tmdb.posterPath` → 确定性标题色卡；Phase 1 无图片数据时 MUST 全部走色卡分支，但解析管线结构 SHALL 保持 Phase 2 图片能力零结构改动接入。网格列数 SHALL 按平台自适应：移动端 3 列，桌面端按窗口宽度断点增列。

#### Scenario: 无图记录渲染色卡
- **WHEN** 记录无 mediaCache 与 posterPath（Phase 1 全量如此）
- **THEN** 卡片渲染确定性色卡（基于 record id 映射色板）叠加标题文字，同 id 双端颜色一致

#### Scenario: 倒序排列
- **WHEN** 集合含多条不同 watchedAt 的记录
- **THEN** 最新观看的记录排在网格最前

#### Scenario: 桌面端增列
- **WHEN** 桌面端窗口宽度超过断点
- **THEN** 网格列数多于移动端基准（3 列）

### Requirement: 空态引导
记录集合为空时海报墙 SHALL 渲染空态视图，含引导文案与「记录第一部影片」CTA；CTA 调用 `cmd:record-edit` 命令（经 ui-contracts 常量拉取）。编辑命令未注册时 CTA 隐藏。

#### Scenario: 空态 CTA 打开编辑器
- **WHEN** 无任何记录且用户点击 CTA
- **THEN** edit 插件的编辑弹层以新建模式打开

#### Scenario: 命令缺失降级
- **WHEN** edit 插件未加载导致 `cmd:record-edit` 未注册
- **THEN** CTA 不渲染，空态仅展示文案

### Requirement: 只读详情
plugin-display SHALL 注册 `cmd:record-detail` 命令（`(recordId: string) => void`），打开只读详情视图（移动端底部弹层、桌面端居中卡片，同组件内分支）：展示记录全部字段（标题、原题、类型与 SxxExx、观看日期、评分或未评分、观后感）。详情视图的动作按钮 SHALL 仅转发 `cmd:record-edit` 与 `cmd:record-delete` 命令，不自持变更逻辑。相关命令未注册时对应动作按钮隐藏。

#### Scenario: 查看详情
- **WHEN** 从海报墙卡片调用 `cmd:record-detail`
- **THEN** 详情视图展示该记录全部字段，无编辑态

#### Scenario: 未评分展示
- **WHEN** 记录 `rating === 0`
- **THEN** 详情与卡片评分位显示「未评分」而非 0 分

#### Scenario: 动作命令缺失降级
- **WHEN** edit 插件未加载
- **THEN** 详情的编辑/删除按钮隐藏，浏览不受影响

### Requirement: 视图切换消费时间线能力
海报墙顶部 SHALL 提供「海报墙 / 时间线」segmented 切换；时间线视图组件 SHALL 经 `capabilities.get(ui:view:timeline)` 拉取，未注册时切换控件隐藏（dev 模式输出含 key 的 console.warn）。本地视图偏好（当前选中视图）SHALL 仅存内存，不持久化。

#### Scenario: 切换到时间线
- **WHEN** timeline 插件已加载且用户点选「时间线」
- **THEN** 记录 tab 内容区渲染时间线组件

#### Scenario: 时间线插件卸载
- **WHEN** timeline 插件未注册 `ui:view:timeline`
- **THEN** 切换控件消失，海报墙正常使用，dev 模式有警告

### Requirement: 自有数据投影
plugin-display SHALL 经 ui-contracts 的 `createCollectionProjection` 持有 records 集合私有投影：启动 loadAll 全量、`record:*` 事件失效重载；排序等派生数据 SHALL 为纯函数 selector，MUST NOT 依赖其他插件实例或共享可变服务。

#### Scenario: 事件驱动刷新
- **WHEN** edit 插件发布 `record:created`
- **THEN** display 投影失效并重载，海报墙出现新卡片，无需手动刷新
