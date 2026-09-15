# plugin-stats Specification

## Purpose

统计插件：年度聚合纯函数与「我的」tab 回顾视图（含 cmd:search 下钻）。

## Requirements

### Requirement: 年度聚合（纯函数）
plugin-stats SHALL 提供纯函数聚合：输入记录快照 + 年份，输出 `{ totalCount, watchedDays, avgRating, ratedCount, monthlyCounts[12], genreCounts, tagCounts, topDay, movieCount, episodeCount }`。语义：avgRating 仅对已评分记录（rating>0）求均值（无已评分记录为 null）；monthlyCounts 按 watchedAt 月份计数；genreCounts 按 TMDB 快照 genres 聚合（manual 哨兵记录不贡献）；tagCounts 按 `user.tags` 聚合并经 `cmd:tag-list` 解析名称；topDay 为观看数最多之日（并列取更早）。全部纯 Node 可测。

#### Scenario: 均分排除未评分
- **WHEN** 年内 3 条记录评分 8、9、0
- **THEN** avgRating 为 8.5，ratedCount 为 3，totalCount 为 3

#### Scenario: 类型分布
- **WHEN** 年内 2 部电影 + 3 集剧集
- **THEN** movieCount=2、episodeCount=3

#### Scenario: 空年份
- **WHEN** 聚合无任何记录的年份
- **THEN** totalCount=0、avgRating=null、各分布为空，不报错

### Requirement: 年度回顾视图
plugin-stats SHALL 注册「我的」tab 的统计入口（能力优先于壳占位）：年度选择器（范围同日历年份 selector）+ 回顾视图（总览数字、月度柱状、类型分布、标签 TOP10、最长观影日）。视图数据自持（私有投影 + 聚合 selector）；点击月度柱/标签位 SHALL 经 `cmd:search` 下钻（未注册时不可点）。

#### Scenario: 查看 2026 回顾
- **WHEN** 用户在「我的」tab 打开统计并选择 2026
- **THEN** 展示该年聚合数字与分布图

#### Scenario: 下钻
- **WHEN** 点击「科幻」标签位
- **THEN** 经 `cmd:search` 打开该标签 2026 年的记录结果

#### Scenario: 插件缺失
- **WHEN** plugin-stats 未加载
- **THEN** 「我的」tab 回退壳占位
