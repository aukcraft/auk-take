## Why

Phase 0 交付了可运行的双端壳与纯 TS 插件核心，但四个 tab 仍是壳自带的占位组件——AukTake 至今无法记录一次观影。Phase 1 落地第一批四个真正的业务插件（edit / display / record / timeline），让核心契约（CapabilityRegistry、EventBus、Storage 端口、PluginManager 生命周期）第一次被真实消费者验证，并交付最小可用的闭环：手动录入 → 海报墙/时间线浏览 → 日历回顾。

## What Changes

- 新增 `packages/plugin-edit`（观影记录编辑，tier: locked）：全屏编辑弹层，创建/编辑/删除 `MovieRecord`；元数据**纯手动录入**（TMDB 搜索与图片缓存是 Phase 2），posterPath 留空但快照结构完整兼容；注册**函数型命令能力**（打开编辑器、删除记录）供任意插件调用；作为 records 集合的**唯一写入方**，变更后发布 `record:created/updated/deleted` 事件
- 新增 `packages/plugin-display`（海报墙，tier: locked）：注册 `ui:tab:records` 内容；网格海报墙，无图记录渲染**确定性标题色卡**；空态引导 CTA；轻量只读详情（动作转发给 edit 命令）；「海报墙/时间线」视图切换（时间线能力未注册时切换按钮隐藏）
- 新增 `packages/plugin-record`（日历图，tier: locked）：注册 `ui:tab:calendar` 内容；年度热力图（7×53 网格，按 `user.watchedAt` 日粒度聚合当日观看数分级着色）；年份切换；点选日期查看当日记录并可直接发起编辑
- 新增 `packages/plugin-timeline`（时间线，tier: optional）：注册 `ui:view:timeline` 组件能力，由 display 的记录 tab 消费；按月分组、组内按观看日期倒序的纵向时间线
- 新增 `packages/ui-contracts`（中立共享契约）：跨插件能力 key 常量、命令/组件 props 契约类型、最小设计令牌（含海报占位色板）——在不违反「插件禁止互 import」规则的前提下共享 UI 契约
- 双壳（apps/mobile、apps/desktop）接线：bootstrap 注册并启动四个插件；壳新增**通用 overlay 根**（渲染插件注册的全局弹层）；移除 records/calendar 两个 tab 的占位内容（profile 仍占位）
- 每个插件按 headless（纯 TS 控制器：状态机/校验/派生选择器，纯 Node 可测）+ headed（纯 RN 语法组件，经 RNW 别名双端渲染）分层
- CI 依赖方向守卫扩展：plugin-* → 仅 core + ui-contracts（+ ui-nav）；插件间禁止互相依赖、禁止直接依赖 platform-*

### Non-goals（本 change 明确不做）

- TMDB 元数据搜索、海报图片加载与缓存（Phase 2；编辑器表单与色卡占位已为其预留解析顺序）
- 标签管理 UI 与表单标签输入（tag 插件属后续 Phase；schema 的 `user.tags` 保持空数组）
- 搜索、筛选、统计（search/stats 插件，后续 Phase）
- mood 心情与「读」tab（Phase 5）、「我的」tab 内容、分享海报
- 转场动画与手势（Phase 5）；i18n 与主题体系（Phase 6，沿用 0b 硬编码中文）
- 共享 RecordStore 数据服务（见 design D3：单写多读 + 事件失效已足够，不引入跨插件服务依赖）

## Capabilities

### New Capabilities

- `plugin-edit`: 观影记录编辑插件——手动录入的创建/编辑/删除、字段校验（标题必填、ISO 日期、评分 0–10 步进 0.5、剧集 S/E 必填）、records 集合单一写入方、变更事件发布、函数型编辑命令能力
- `plugin-display`: 「记录」tab 海报墙——网格布局与确定性无图色卡、空态 CTA、只读详情、视图切换（消费 `ui:view:timeline`）、自有数据投影（loadAll + 事件失效）
- `plugin-record`: 「日历」tab 年度热力图——按日聚合与强度分级、年份切换、点选日期的当日记录查看与编辑入口、布局平台适配（移动横滚/桌面整年）
- `plugin-timeline`: 时间线视图组件——按月分组倒序、剧集 SxxExx 徽标、评分摘要（0 显示为未评分）、组件能力注册与数据自持
- `ui-contracts`: 跨插件共享契约——能力 key 单一来源、零渲染器依赖的契约类型、最小设计令牌双端同源、依赖方向约束

### Modified Capabilities

- `host-shell`: 引导序列从「启动零插件 + 四个壳内置占位 tab」更新为「注册并启动 Phase 1 业务插件，tab 内容来自插件能力」；新增通用 overlay 根（渲染插件注册的全局弹层组件，壳不感知具体插件）

## Impact

- 新增代码：`packages/ui-contracts`、`packages/plugin-edit`、`packages/plugin-display`、`packages/plugin-record`、`packages/plugin-timeline`
- 修改代码：`apps/mobile`、`apps/desktop` 的 bootstrap 与 AppShell（插件注册、overlay 根、移除占位）；CI 依赖守卫脚本
- 新依赖：`ulid`（仅 plugin-edit，记录 id 生成）；react / react-native 作为全部 plugin 包与 ui-contracts 的 peer 依赖——全部禁止进入 `@auktake/core`（0a 守卫保留）
- **不改** `@auktake/core`、record schema、Storage 端口与 ui-nav 的既有 requirement（宪法不动；跨插件契约缺口经 ui-contracts 补足）
- 里程碑对应：Phase 1（GitHub Issue/PR 流程同 Phase 0）
