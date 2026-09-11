# plugin-record Specification

## Purpose

「日历」tab 年度热力图插件：按日聚合与五档强度分级、年份切换、点选日期的当日记录面板、平台自适应布局。

## Requirements

### Requirement: 日历 tab 内容提供者
plugin-record SHALL 实现 `AukPlugin` 契约（id `record`，tier `locked`，permissions `storage:read`），在 `create` 时注册 `ui:tab:calendar` 内容组件，使「日历」tab 从壳占位替换为年度热力图。「记录」与「日历」两 tab 的内容互不依赖对方插件实例。

#### Scenario: tab 内容来自插件
- **WHEN** 双壳启动且 record 插件已加载
- **THEN** 「日历」tab 渲染年度热力图，不再显示壳占位

### Requirement: 年度热力图聚合与分级
热力图 SHALL 以 7×53 网格呈现单年视图：按 `user.watchedAt` 日粒度聚合计数；强度分级为 0 条、1 条、2 条、3–4 条、≥5 条五档，对应 ui-contracts 五级强度色令牌。同日多条观看 MUST 聚合为单格。日期桶计算与分级 SHALL 为纯函数，闰年与首尾不完整周 MUST 正确处理（周一为每周首日）。

#### Scenario: 聚合当日多条
- **WHEN** 某日存在 3 条观看记录
- **THEN** 该日格子的强度按「3–4 条」档着色，计数为 3

#### Scenario: 闰年二月
- **WHEN** 渲染 2024 年且 2 月 29 日有观看
- **THEN** 该日正确落格着色，全年网格完整

#### Scenario: 无记录年份
- **WHEN** 切换到无任何记录的年份
- **THEN** 网格全部格子为 0 档色，视图不报错

### Requirement: 年份切换
热力图 SHALL 提供年份切换器，可选范围为 records 集合中最早观看年份至当前年份；默认展示当前年份，若集合为空则仅展示当前年份。

#### Scenario: 年份范围
- **WHEN** 记录最早 watchedAt 为 2023 年且当前为 2026 年
- **THEN** 切换器可选项覆盖 2023–2026，默认 2026

### Requirement: 点选日期查看当日记录
点选热力图日期格 SHALL 展开当日记录列表面板（标题、类型与 SxxExx 徽标、评分摘要）；条目 SHALL 调用 display 插件注册的 `cmd:record-detail` 打开详情，并在面板提供直接编辑入口（调 `cmd:record-edit`）。命令未注册时条目降级为不可点，MUST NOT 抛错。

#### Scenario: 查看当日记录
- **WHEN** 点选有 2 条记录的日期格
- **THEN** 面板列出 2 条记录的摘要信息

#### Scenario: 详情命令缺失降级
- **WHEN** display 插件未加载导致 `cmd:record-detail` 未注册
- **THEN** 条目点击无效果且不抛错，dev 模式有警告

### Requirement: 布局平台适配
热力图布局 SHALL 按平台分支：移动端横向滚动（网格宽度超出视口），桌面端整年平铺。两布局 MUST 消费同一份网格计算纯函数，仅呈现容器不同。

#### Scenario: 移动端横滚
- **WHEN** 移动端渲染整年网格
- **THEN** 网格可横向滚动，格宽不压缩变形

### Requirement: 自有数据投影
plugin-record SHALL 经 `createCollectionProjection` 持有 records 私有投影（启动全量 + `record:*` 事件失效重载）；按日分桶、分级判定 SHALL 为纯函数 selector，在纯 Node 环境可测。

#### Scenario: 新记录即时反映
- **WHEN** edit 插件发布 `record:created`
- **THEN** 热力图对应日期格强度随投影重载而更新
