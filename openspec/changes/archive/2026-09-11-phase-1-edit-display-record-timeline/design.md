## Context

Phase 0a 交付了 `@auktake/core`（PluginManager connect/create、EventBus、ServiceRegistry、CapabilityRegistry、Storage 全量内存端口、record schema），Phase 0b 交付了双端壳（apps/mobile 裸 RN + Metro、apps/desktop Tauri + Vite + RNW）、ui-nav（TabDefinition，内容经 `ui:tab:*` 能力拉取）与 platform-rn/platform-tauri 存储。四个 tab 目前渲染壳自带占位组件。

Phase 1 是插件契约的第一次真实消费：四个业务插件（edit / display / record / timeline）+ 一个中立契约包（ui-contracts），全部按「headless 纯 TS 控制器（纯 Node 可测）+ headed 纯 RN 组件（RNW 别名双端渲染）」分层，遵循双端桥接方法论：默认单源，布局形状差异同文件分支，无原生库依赖故预期零 `.native/.web` fork。

已确认的范围决策（提案期用户拍板）：四插件按顺序对应——edit=全局编辑器、display=「记录」tab 海报墙、record=「日历」tab 日历热力图、timeline=「记录」tab 内可切换的第二视图；元数据**纯手动录入**（TMDB/图片缓存是 Phase 2）。

## Goals / Non-Goals

**Goals:**

- 手动录入 → 海报墙/时间线浏览 → 日历回顾的最小闭环，双端可运行
- 核心契约（宪法）零改动：不改 `@auktake/core`、schema、Storage 端口、ui-nav 的 requirement
- 跨插件协作范式定型：函数型命令能力 + 中立契约包 + 事件失效，给后续 14 个插件当范本
- 全部业务行为纯 Node 可测（headless 层），CI 仍只跑 JS 侧

**Non-Goals:**

- TMDB、图片加载/缓存、标签管理、搜索/统计、mood、分享、动画、i18n/主题体系（见 proposal Non-goals）
- 插件动态装卸 UI（tier 语义已由核心定义，管理界面属后续 Phase）
- 共享可视 RecordStore 服务（D3 论证不需要）

## Decisions

### D1. 插件工厂显式注入 deps，PluginContext 只承载生命周期信号（core 零改动）

每个插件包导出普通工厂：`createEditPlugin(deps: PluginRuntimeDeps): AukPlugin`，`PluginRuntimeDeps = { events, capabilities, services, dev? }`（类型定义在 ui-contracts）。`connect()` 返回 `{ state: {} }`（四插件皆无配置态）；`create()` 用闭包 deps 注册能力/订阅事件。壳 bootstrap 是组合根：建 core 实例 → 工厂装配 → PluginManager register/connect/startupAll → 渲染。
*替代方案*：扩展 core 的 `PluginContext` 类型塞入 registries——改宪法类型面，且闭包注入在纯 Node 测试里更好替换（headless 方法论：要替换的就注入）。0a 注释「replaced by core facade at runtime」的意图由组合根兑现，不动 core。

### D2. 跨插件契约进 ui-contracts（中立包），命令用函数型能力

「插件禁止互 import」下，跨插件协作需要中立契约层。`packages/ui-contracts`（peer: react 仅用于组件 props 类型；零平台 API）：

- **能力 key 常量**（单一来源）：`cmd:record-edit`、`cmd:record-delete`（edit 注册）、`cmd:record-detail`（display 注册）、`ui:view:timeline`（timeline 注册）、`ui:overlay:root`（edit 注册）
- **命令/组件契约类型**：`RecordEditCommand(options?: { recordId?: string }): void`、`RecordDeleteCommand(recordId): void`、`RecordDetailCommand(recordId): void`、`TimelineComponent = React.ComponentType`（时间线数据自持，无 props）
- **事件名常量**：`record:created/updated/deleted`，payload 均为 `{ id }`
- **最小设计令牌**：色板/间距/圆角/字重 + 海报占位色板（8 色）+ 热力图 5 级强度色——双端同源（RN 与 RNW 同消费 JS 对象，无需代码生成；Phase 6 主题化再评估）
- **共享 headless 工具**：`createCollectionProjection`（见 D3）

调用方 `capabilities.get<RecordEditCommand>(KEYS.recordEdit)?.(...)`，未注册则降级（隐藏入口或 dev warn）——与「能力缺失 tab 隐藏」同一哲学。CapabilityRegistry 本就泛型持有任意值，函数也是值，core 无需改动。

### D3. 数据流：单写多读 + 事件失效，不建共享 RecordStore 服务

- **唯一写入方**：edit 插件独占 records 集合写路径（loadAll → 变异 → persistAll → emit `record:*`），全量内存模型下天然无并发写冲突
- **读方私有投影**：display / record / timeline 各持 `createCollectionProjection(deps, 'records', [record:created/updated/deleted])`——启动 loadAll，事件触发失效，microtask 合并去抖后重载；getState 不可变快照 + subscribe
- **派生数据是 selector**：排序/分组/日历分桶全部纯函数，不进组件

*替代方案*：某插件注册 RecordStore 服务供他插件 `services.get`——引入跨插件运行时依赖与启动顺序耦合，且事件总线已提供失效信号；Phase 1 规模（千条级）下重载整集合成本可忽略。未来若需要，再以新契约演进。

### D4. 编辑器：headless 状态机 + 声明式校验，手动录入的快照默认值

`EditorController`（纯 TS）：字段 draft（title/originalTitle/mediaType/seasonNumber/episodeNumber/watchedAt/rating/review）、互斥 status（idle/dirty/submitting/saved/error）、`now()` 注入（默认观看日=今天）。校验纯函数：标题非空；watchedAt 匹配 `\d{4}-\d{2}-\d{2}` 且为真实日历日；rating ∈ 0–10 步进 0.5（0=未评分，UI 显式呈现「未评分」而非 0 分）；episode 时 S≥1/E≥1 必填，movie 时禁止携带。

手动记录的快照默认值（Phase 2 补全的兼容约定，写入 schema 注释级文档）：`tmdb.id = 0`（哨兵=无 TMDB 绑定）、`overview = ""`、`genres = []`、`runtime = 0`、`posterPath = backdropPath = ""`、`releaseDate = ""`（未知）、`originalTitle` 默认=title、`mediaCache = {}`、`source = { type: 'manual' }`。id 用 `ulid` 包生成（仅 edit 依赖），时间戳 ISO。删除/编辑均经 edit 命令，确认对话框与错误提示由 edit 的 overlay 自持（单写方拥有全部变更 UX）。

### D5. 海报墙无图渲染：确定性色卡 + 图片解析顺序预留

卡片渲染顺序：`mediaCache.poster`（Phase 2 图片缓存写入）→ `tmdb.posterPath`（Phase 2 TMDB 提供）→ **确定性标题色卡**：`colorHash(record.id)` 从 ui-contracts 8 色板取色 + 标题/年份文字。Phase 1 恒走色卡分支但解析管线已就位，图片能力落地零改结构。网格：移动端 FlatList `numColumns=3`，桌面端按 `useWindowDimensions` 断点增列（布局形状差异，同文件分支）。排序 watchedAt 倒序。空态：CTA「记录第一部影片」调 `cmd:record-edit`。轻量只读详情（display 内部组件，移动端底部弹层/桌面端居中卡片）：展示全部字段 + 编辑/删除动作转发命令。

### D6. 日历热力图：年度 7×53 网格，纯函数布局计算

`heatmap.ts` 纯函数：`bucketByDay(records, year)` 按 `user.watchedAt` 日粒度聚合计数；强度分级 0/1/2/3–4/5+ → 5 级色（tokens）；`buildYearGrid(year)` 生成周一为首的周列网格（含闰年、首尾不完整周）。点选日期 → 当日记录列表面板（条目可调 `cmd:record-detail`）。年份切换器（范围=记录年份min..当前年）。移动端横向 ScrollView、桌面端整年平铺（同文件分支）。

### D7. 时间线：视图能力插件，display 消费

timeline 注册 `ui:view:timeline` 组件（数据自持：私有投影 + 按月分组倒序 selector）。display 的记录 tab 内容顶部持「海报墙/时间线」segmented 切换；`capabilities.get(KEYS.viewTimeline)` 为空则切换隐藏 + dev warn。行内容：色卡缩略、标题、episode 徽标（SxxExx，电影无徽标）、观看日期、评分摘要（0 渲染「未评分」）。timeline 为 optional tier——卸载后其余功能完好，正是插件分级的第一个活例。

### D8. 壳 overlay 根：通用、插件无关

双壳渲染 `<OverlayRoot>`：拉取 `ui:overlay:root` 能力组件（Phase 1 仅 edit 的编辑弹层），未注册则空。壳不感知任何具体插件。编辑弹层用 RN `<Modal>` + `KeyboardAvoidingView`（RNW 上 no-op）单源实现；若 RNW Modal 出问题，降级为 absolute View 遮罩（fork 风险记账，不预期）。占位收敛：移除 records/calendar/read 占位，仅 profile 保留；read tab 因无能力提供者自动隐藏（ui-nav 既有语义），dev 模式警告照常。

### D9. tier 与权限声明

edit=locked（`storage:read/write`）、display=locked（`storage:read`）、record=locked（`storage:read`）、timeline=optional（`storage:read`）。records/calendar 两 tab 在 TabDefinition 中 required:true，其内容提供者必须常驻，故三读插件 locked；timeline 是增强视图故自由开关。

### D10. 依赖方向与 CI 守卫扩展

```
packages/{ui-contracts, plugin-edit, plugin-display, plugin-record, plugin-timeline}
```

- plugin-* → 仅 `@auktake/core` + `@auktake/ui-contracts`（+ ui-nav 仅当需要 tab key 常量）；peer: react/react-native；**禁止**互相依赖、禁止依赖 platform-*/apps（storage 经 ServiceRegistry 注入）
- ui-contracts → 仅 core 类型（peer），零平台 API；plugin-edit 另加 `ulid` 运行时依赖
- 守卫脚本扩展上述规则；全部新增 react 系依赖**禁止**进 core（0a 守卫不变）

## Risks / Trade-offs

- [RNW 对 FlatList numColumns/Modal/KeyboardAvoidingView 的子集差异（不报错但渲染空是最坑模式）] → 落地首个任务做 RNW 渲染 spike（FlatList 网格 + Modal + 文本输入），锁定行为后再铺开；降级路径已定（ScrollView 手工列 / absolute 遮罩）
- [三视图各自全量 reload 的放大] → 投影层 microtask 合并去抖 + 个人日志量级；写方唯一，无数据竞争
- [`tmdb.id=0` / `releaseDate=""` 哨兵与 Phase 2 撞车] → 本 design 明文约定 0/空=「待 TMDB 补全」；Phase 2 补全作业按此识别，不静默
- [手动录入 TMDB 字段（genres/runtime 全空）削弱未来筛选/统计] → 已知代价，schema 兼容优先；Phase 2 一键补全收回
- [移动端无日期选择器（不引原生库，裸 RN 打包成本已记账）] → 文本输入 YYYY-MM-DD + 即时校验反馈；体验升级留给后续 Phase 评估
- [色卡色板与热力图色的可访问性（对比度）] → tokens 落地时按深浅两档文字色配对验收
- [时间线/日历条目点击跳详情依赖 display 注册的命令] → 命令缺失时条目降级为不可点 + dev warn，不崩不裸抛

## Migration Plan

绿地增量，无数据迁移。落地顺序（每步可独立 PR/回滚）：

1. ui-contracts（keys/types/tokens/projection 工具 + 单测）
2. RNW 渲染 spike（网格/Modal/输入，风险前置）
3. plugin-edit（headless 校验与命令 → overlay UI → 双壳接线后即可录数据）
4. plugin-display（投影 + 色卡墙 + 详情 + 切换骨架）
5. plugin-timeline（接入切换）
6. plugin-record（日历 tab）
7. 壳占位移除 + read tab 隐藏验证 + CI 守卫扩展

回滚 = revert 对应 PR；插件可单独移除（壳自动降级为占位/隐藏），即插件化架构的第一次真实演练。

## Open Questions

- TMDB 来源记录的标题编辑语义（锁定快照 or 编辑时重搜索）→ Phase 2 复审，本 Phase 全部记录皆为 manual
- 热力图分级阈值与色板最终值 → tokens 落地时以深浅双档验收微调（不阻塞结构）
- 时间线是否展示观后感摘要 → v1 不做，反馈后加
- 桌面端网格列数断点（预计 ≥3/≥5）→ 实现期以 2:3 卡片实测定

## Implementation Appendix（实现期补充决策）

- **详情弹层全局挂载（用户拍板）**：D8 的单一 `ui:overlay:root` 无法承载
  日历 tab 发起的详情（display 的 tab 组件在日历 tab 时已卸载）。新增
  ui-contracts 常量 `ui:overlay:record-detail`，并导出 `OVERLAY_KEYS`
  列表；双壳 OverlayHost 迭代该列表渲染，仍对具体插件零感知。display
  将只读详情 Modal 注册到该 key，任意 tab 可达。
- **tab key 常量**：ui-nav 新增 `TAB_CAPABILITY_KEYS` 导出（DEFAULT_TABS
  改引用之），display/record 经 ui-nav 引用而非硬编码（符合 D10「ui-nav
  仅当需要 tab key 常量」的许可）。
- **RNW spike**：结论与证据见 `docs/rnw-spike.md`（FlatList numColumns /
  Modal / TextInput multiline 支持；KeyboardAvoidingView 为有效 no-op；
  降级路径无需启用；运行时复核并入 7.4 冒烟）。
- **构建环境修复**：vite 别名改为 react-native-web 绝对路径（插件包内
  import 的解析需要）；Metro 关闭 disableHierarchicalLookup 并增加
  `.js` 后缀剥离的 fallback resolver（pnpm 真实路径兄弟依赖解析 + TS
  ESM 风格后缀）；apps/mobile 显式依赖 `@babel/runtime`（RN 模板标准
  依赖，此前依赖被清空的 hoist 布局）。两端均完成 bundle 冒烟（vite
  build / react-native bundle 成功）。
