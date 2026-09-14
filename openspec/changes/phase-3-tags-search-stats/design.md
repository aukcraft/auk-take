## Context

Phase 1/2 交付了录入-浏览-元数据闭环（TMDB 绑定、图片缓存、双端安装包）。记录库已有结构化元数据（genres/runtime/年份/user.tags 字段与 tags 集合 schema 均为 Phase 0 既有），但检索与回顾能力为零。Phase 3 按原 roadmap 落地纯本地三件套：标签管理、搜索/筛选、年度统计——全部无网络（Jellyfin/svc:http 属 Phase 4）。

## Goals / Non-Goals

**Goals:**

- 标签：创建/重命名/删除 + 引用清洗（tag 为 tags 集合唯一写入方，records 仍唯经 edit 写）
- 搜索/筛选：纯函数 query engine + 记录 tab 搜索框/筛选面板，防抖即时过滤，状态仅内存
- 统计：年度聚合纯函数 + 「我的」tab 回顾视图 + cmd:search 下钻
- 全部行为纯 Node 可测；recommended tier（search/stats）卸载零影响验证

**Non-Goals:**

- 标签层级/合并/自动打标、观后感全文搜索、智能筛选持久化、跨年对比、导出（见 proposal）
- mood、动画、i18n、网络相关一切

## Decisions

### D1. tag=locked 常驻，search/stats=recommended

tags 数据一旦被记录引用即不可孤立（编辑器标签区、筛选、统计 TOP 都依赖），tag 插件 locked 且双壳常驻装配。search/stats 是增强视图，recommended tier——卸载后海报墙照常、「我的」回退占位，与 timeline 同语义。

### D2. 引用清洗走 edit 内部通道，tag 永不直写 records

删除/重命名标签需改记录的 `user.tags`——records 唯一写入方 invariant 不破：edit 暴露 `cmd:record-remove-tag`（`(tagId) => 批量移除引用 + 逐条 emit record:updated`）。tag 插件持有该命令引用并在 delete/rename 时调用；命令未注册（edit 未加载）时 tag 插件拒绝执行破坏性操作并提示。重命名不改记录（引用按 id），仅需事件通知读方刷新名称缓存。

### D3. 搜索结果供给：display 消费 cmd:search + 自持过滤态

记录 tab 的过滤状态（text/筛选对象）由 **display 的 RecordsTab 自持**（useState，仅内存），经 `cmd:search`（search 插件注册）取过滤结果数组，喂给既有 PosterWall/Timeline 渲染——display 不 import search，search 不 import display；两侧未注册互相隐藏。*替代方案*：search 注册 `ui:records-toolbar` 组件能力让 display 拉取渲染——多一层组件契约，v1 不必要，弃。

### D4. query engine 纯函数（search 包内）

`queryRecords(records, q): MovieRecord[]`：text 子串（title/originalTitle，大小写不敏感）、tagIds AND、ratingRange 闭区间（0 视为未评分、区间含 0 时可命中）、mediaType 精确、dateRange ISO 字符串闭区间。空查询返回原数组引用（零拷贝快路径）。防抖 300ms 在组件层（setTimeout 注入可测）。

### D5. stats 聚合纯函数 + 「我的」tab 能力优先

`aggregateYear(records, year, tagIndex)` 纯函数输出全部统计字段（spec 所列）。视图自持投影 + `cmd:tag-list` 建 id→名称索引。月度柱状用 RN View 高度比例（无图表库——不引第三方是宪法级约束）；下钻经 `cmd:search`（tagIds + dateRange 组合查询）。壳的 profile 占位与 stats 内容能力的关系：**stats 注册 `ui:tab:profile` 即替换占位**（CapabilityRegistry 后注册覆盖前者——装配顺序 stats 在壳占位注册之前 create，天然覆盖；壳不感知）。

### D6. ui-contracts 新增面

keys：`cmd:tag-list/create/rename/delete/filter`、`ui:tag-picker`、`cmd:search`、`cmd:record-remove-tag`；events：`tag:created/renamed/deleted`。类型：`TagPickerComponent`（props 契约：`selectedIds` + `onChange` + `onCreate?`）、`RecordQuery`、各命令签名。`cmd:tag-filter`（从标签 chips 发起筛选）供 detail/stats 复用——转发到 display 的过滤态？display 无法被命令直达（无 cmd:record-filter 注册面）……**简化**：v1 的 `cmd:tag-filter` 仅 stats 下钻用（构造 RecordQuery 调 cmd:search 展示结果面板于 stats 内），detail 的标签 chips 不可点（去除此场景，spec 已同步）。实现期若需要全局过滤入口再演进。

### D7. 编辑器标签区与草稿

EditSessionController 草稿新增 `tagIds: string[]`（draftFromRecord 预填 user.tags）；`setTagIds` 转换。保存时写入 user.tags（过滤掉不存在的 id——防标签已删）。UI 渲染 `ui:tag-picker` 组件能力（tag 插件注册，闭包持命令族）。

### D8. 依赖方向与守卫

plugin-tag → core + ui-contracts；plugin-search → core + ui-contracts（读 records 投影 + cmd:tag-list 经 capabilities）；plugin-stats → core + ui-contracts（+ ui-nav 仅当需要 tab key：是——`ui:tab:profile`，加 ui-nav 依赖）。dep-guard allow-list 增三行；插件间互依赖依旧禁止。

## Risks / Trade-offs

- [批量清洗的 N 次写放大] → 全量内存模型下 N 条 persistAll 一次 + 逐条 emit；千条级无感
- [搜索防抖与投影刷新竞争] → 过滤在渲染层基于最新快照重算（查询幂等），无脏结果窗口
- [stats 覆盖 profile 占位依赖注册顺序] → 装配顺序固定（壳占位注册先于 startupAll 的插件 create），加单测钉住；乱序时表现为占位回归，无崩溃
- [无图表库的柱状/分布表现力] → View 比例柱 + chips 足够 v1；图表库属 Phase 6 主题化一并评估

## Migration Plan

绿地增量，无迁移。落地顺序（每步独立 PR/可回滚）：

1. ui-contracts：keys/types + 单测
2. plugin-tag：headless（CRUD/重名/清洗编排）+ picker 组件 + 单测
3. plugin-edit：草稿 tagIds + 标签区 UI + remove-tag 通道 + 单测
4. plugin-search：query engine + 工具栏 UI + display 接入 + 单测
5. plugin-stats：聚合 + 回顾视图 + 下钻 + 单测
6. 壳装配 + dep-guard + 全仓验证 + 双端冒烟

## Open Questions

- 筛选面板的交互形态（底部弹层 vs 头部展开）→ 步骤 4 实现期定（移动底部/桌面展开，同文件分支）
- 标签颜色/emoji → v1 纯文本 chips，Phase 6 主题化再评估
- stats 是否在「记录」tab 顶部放年度摘要卡 → 反馈后定，v1 不做
