# plugin-timeline Specification

## Purpose

时间线视图插件（optional tier）：按月分组倒序、SxxExx 徽标、未评分语义、组件能力注册与数据自持。

## Requirements

### Requirement: 时间线视图能力注册
plugin-timeline SHALL 实现 `AukPlugin` 契约（id `timeline`，tier `optional`，permissions `storage:read`），在 `create` 时注册 `ui:view:timeline` 组件能力（契约类型 `TimelineComponent`，无 props，数据自持）。该能力由 display 插件的记录 tab 消费；timeline 插件 MUST NOT 依赖 display 的任何实现，反之亦然。

#### Scenario: 注册后被消费
- **WHEN** timeline 插件已加载且用户切换到时间线视图
- **THEN** display 渲染本插件注册的组件

#### Scenario: 卸载不影响主流程
- **WHEN** timeline 插件被卸载（optional tier）
- **THEN** 记录 tab 自动回退海报墙单视图，其余插件功能不受影响

### Requirement: 时间线分组与排序
时间线 SHALL 按 watchedAt 月份分组、组内按观看日期倒序（最新在前）纵向排列；每条目 SHALL 展示：海报缩略位（与海报墙一致的解析顺序：本地缓存 → 远端经缓存 → 确定性色卡，缓存服务缺失跳到色卡）、标题、剧集徽标（mediaType 为 episode 时显示 SxxExx，电影不显示徽标）、观看日期、评分摘要（rating 为 0 显示「未评分」）。分组与排序 SHALL 为纯函数 selector，在纯 Node 环境可测。

#### Scenario: 按月分组倒序
- **WHEN** 记录跨 2026-03 与 2026-05 两个月
- **THEN** 2026-05 组在上，组内最新日期条目在最前

#### Scenario: 缩略图解析对齐海报墙
- **WHEN** 某记录已有本地缓存海报
- **THEN** 时间线条目缩略位与海报墙卡片渲染同一图片来源

#### Scenario: 剧集徽标
- **WHEN** 条目为 S02E05 的剧集记录
- **THEN** 显示「S02E05」徽标，电影记录无徽标

#### Scenario: 未评分摘要
- **WHEN** 条目 rating 为 0
- **THEN** 评分位显示「未评分」而非 0 分

### Requirement: 条目交互命令消费
时间线条目点击 SHALL 调用 display 注册的 `cmd:record-detail` 打开只读详情。命令未注册时条目降级为不可点，MUST NOT 抛错。

#### Scenario: 打开详情
- **WHEN** display 插件已加载且用户点击时间线条目
- **THEN** 打开该记录的只读详情

#### Scenario: 命令缺失降级
- **WHEN** `cmd:record-detail` 未注册
- **THEN** 条目不可点，无崩溃无裸抛

### Requirement: 自有数据投影
plugin-timeline SHALL 经 `createCollectionProjection` 持有 records 私有投影（启动全量 + `record:*` 事件失效重载），不依赖任何共享可变服务或其他插件实例。

#### Scenario: 数据变更同步
- **WHEN** edit 插件发布 `record:deleted`
- **THEN** 时间线对应条目随投影重载消失
