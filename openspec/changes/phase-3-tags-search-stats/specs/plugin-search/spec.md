## ADDED Requirements

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

### Requirement: 搜索框与筛选面板 UI
plugin-search SHALL 在记录 tab 头部提供搜索框（防抖 300ms 触发）与筛选入口按钮（未生效筛选时收起、生效时以角标显示激活条件数）；筛选面板含标签多选（经 `cmd:tag-list`）、评分区间、类型、日期区间。筛选/搜索状态 SHALL 仅存内存不持久化。结果 SHALL 经既有海报墙/时间线网格渲染（搜索插件提供过滤后的记录列表供给 display，或由 display 消费 `cmd:search`——实现取其一并在 design 记账）。

#### Scenario: 输入即时过滤
- **WHEN** 搜索框输入「沙」
- **THEN** 300ms 防抖后网格仅显示标题/原题含「沙」的记录

#### Scenario: 组合筛选
- **WHEN** 选择标签「科幻」+ 评分 ≥8
- **THEN** 网格仅显示同时满足两条件的记录，筛选按钮角标显示 2

#### Scenario: 清空恢复
- **WHEN** 用户清空搜索框并重置筛选
- **THEN** 网格回到未过滤全量视图

#### Scenario: 插件缺失降级
- **WHEN** plugin-search 未加载
- **THEN** 记录 tab 无搜索框/筛选入口，海报墙正常

### Requirement: 全局搜索命令
plugin-search SHALL 注册 `cmd:search`（查询对象 → 匹配记录数组），供日历点选、统计下钻等任意调用方复用同一引擎。命令未注册时调用方降级。

#### Scenario: 外部调用
- **WHEN** 任意插件调用 `cmd:search({ text: "沙丘" })`
- **THEN** 返回与 UI 搜索一致的结果集
