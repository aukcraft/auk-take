## Why

Phase 1/2 后记录已具备完整元数据（TMDB 绑定的 genres/runtime/年份 + 手动录入），但只能按时间浏览：没有标签组织、没有查找手段、没有任何回顾统计——观影库在增长，检索与回顾能力为零。Phase 3 按原 roadmap 落地纯本地三件套：标签管理、搜索/筛选、年度统计。

## What Changes

- 新增 `packages/plugin-tag`（tier: locked，permissions: `storage:read/write`）：tags 集合唯一写入方（CRUD + 重名校验 + 删除时清洗记录引用）；注册 `cmd:tag-*` 命令族与标签选择器组件能力；编辑器标签输入区（创建/选择/移除）
- 新增 `packages/plugin-search`（tier: recommended，permissions: `storage:read`）：记录 tab 顶部搜索框与筛选面板（关键词模糊匹配标题/原题、标签多选 AND、评分区间、类型 movie/episode、日期区间）；纯函数 query engine；注册 `cmd:search` 供全局调用；筛选状态仅存内存
- 新增 `packages/plugin-stats`（tier: recommended，permissions: `storage:read`）：「我的」tab 入口的年度回顾统计视图（总观影片数、观影天数、年均分、月度柱状、类型分布、标签 TOP、最长观影日）；全部纯函数聚合
- 修改 `packages/plugin-edit`：表单新增标签选择区（消费 tag 插件命令族；未注册时隐藏），保存时写 `user.tags`
- 修改 `packages/plugin-display`：记录 tab 头部接入搜索框与筛选入口（search 插件未注册时隐藏）；时间线/海报墙数据链路不变（搜索结果经既有网格渲染）
- 修改 ui-contracts：新增 tag/search/stats 的 key 常量与契约类型；编辑器与筛选面板复用既有 tokens
- 壳：装配三个插件（tag=locked 常驻；search/stats=recommended 可卸载）；「我的」tab 仍为占位，但 stats 插件注册其内容入口后占位自动退位（能力优先）

### Non-goals（本 change 明确不做）

- 标签嵌套/层级、标签合并、自动打标（TMDB genres 映射为预设标签建议仅做只读推荐，不自动写入）
- 全文搜索观后感内容（后续评估；v1 搜索标题/原题）
- 保存的智能筛选/过滤器、搜索历史
- 跨年度对比统计、导出报表
- mood 心情（Phase 5）、网络相关一切（Jellyfin/svc:http 属 Phase 4）

## Capabilities

### New Capabilities

- `plugin-tag`: 标签插件——tags 集合唯一写入方、命令族与选择器组件、编辑器集成、删除清洗
- `plugin-search`: 搜索/筛选插件——query engine 纯函数、搜索框与筛选面板 UI、cmd:search
- `plugin-stats`: 统计插件——年度聚合纯函数与回顾视图

### Modified Capabilities

- `plugin-edit`: 表单标签选择区（user.tags 写入路径）
- `plugin-display`: 记录 tab 搜索/筛选入口与结果渲染
- `host-shell`: 三插件装配（tier 语义）、stats 对「我的」tab 的内容供给
- `ui-contracts`: 新 key/契约类型

## Impact

- 新增代码：`packages/plugin-tag`、`packages/plugin-search`、`packages/plugin-stats`
- 修改代码：`plugin-edit`、`plugin-display`、双壳 bootstrap、`ui-contracts`、dep-guard allow-list
- 无新第三方依赖（纯本地；schema 的 `user.tags` 与 `tags` 集合、Tag schema 均为 Phase 0 既有）
- 里程碑：Phase 3（GitHub Issue/PR 流程同前）
