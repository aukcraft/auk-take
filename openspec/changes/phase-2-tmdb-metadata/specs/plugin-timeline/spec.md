## MODIFIED Requirements

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
