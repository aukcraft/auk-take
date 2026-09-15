# plugin-search Specification

## Purpose

搜索/筛选插件：纯函数查询引擎（AND 组合）、搜索按钮 + 条件弹窗套件（激活条件可删 pills）、cmd:search。

## Requirements

### Requirement: 查询引擎（纯函数）
plugin-search SHALL 提供纯函数 query engine：输入记录快照 + 查询对象 `{ text?, tagIds?, ratingRange?, mediaType?, dateRange? }`，输出匹配记录。匹配语义：text 对标题与原题做大小写不敏感的子串匹配；tagIds 为多选 **AND**（记录须含全部所选标签 id）；ratingRange 为闭区间（未评分 0 分记录在含 0 的区间可命中）；mediaType 精确匹配；dateRange 为 watchedAt 闭区间（ISO 日期字符串比较）。引擎 MUST 在纯 Node 环境全矩阵可测，不依赖组件。

#### Scenario: 关键词命中标题或原题
- **WHEN** text 为 "dune" 且存在标题「沙丘」原题「Dune: Part Two」的记录
- **THEN** 该记录命中（原题匹配）

#### Scenario: 标签 AND 语义
- **WHEN** tagIds 含 A、B 两个 id
- **THEN** 仅同时引用 A 与 B 的记录命中

#### Scenario: 空查询返回全集
- **WHEN** 查询对象全字段为空
- **THEN** 返回全部记录（与无筛选等价）

### Requirement: 搜索按钮与条件弹窗
plugin-search SHALL 以套件工厂形式提供搜索 UI：`createSearchSuite({ query, onChange })` 返回 **[SearchButton, SearchCard]** 两个组件。SearchButton 为记录 tab 头部的搜索图标入口，并在存在激活条件时以**可删除 pills** 展示各条件（如 `Text: 关键词`、`Time: 2026-01-01~2026-03-01`、`Tag: 科幻`，pill 点击 × 即移除该条件并即时重新过滤）；点击按钮打开 SearchCard 小弹窗，可输入/修改组合条件（关键词、日期范围、标签多选、评分、类型），v1 组合语义仅 **AND**（全部满足才展示）。查询状态 SHALL 仅存内存不持久化。结果 SHALL 经既有海报墙/时间线网格渲染。

#### Scenario: 条件 pill 快捷删除
- **WHEN** 激活条件含 `Tag: 科幻` 且用户点击该 pill 的 ×
- **THEN** 该标签条件移除，网格即时按剩余条件重新过滤

#### Scenario: 组合条件 AND
- **WHEN** 弹窗中同时设定关键词「沙」与标签「科幻」
- **THEN** 仅同时满足两条件的记录展示

#### Scenario: 清空恢复
- **WHEN** 用户在弹窗清除全部条件
- **THEN** pills 消失，网格回到未过滤全量视图

#### Scenario: 插件缺失降级
- **WHEN** plugin-search 未加载
- **THEN** 记录 tab 无搜索按钮，海报墙正常

### Requirement: 全局搜索命令
plugin-search SHALL 注册 `cmd:search`（查询对象 → 匹配记录数组），供日历点选、统计下钻等任意调用方复用同一引擎。命令未注册时调用方降级。

#### Scenario: 外部调用
- **WHEN** 任意插件调用 `cmd:search({ text: "沙丘" })`
- **THEN** 返回与 UI 搜索一致的结果集
