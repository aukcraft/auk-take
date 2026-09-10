## 1. ui-contracts 包（契约先行）

- [x] 1.1 `packages/ui-contracts` 骨架：package.json（peer: core、react）、tsconfig（moduleSuffixes 与双端一致）、vitest 配置
- [x] 1.2 能力 key 与事件名常量（`cmd:record-edit/delete/detail`、`ui:view:timeline`、`ui:overlay:root`、`record:created/updated/deleted`）+ 契约类型（三个命令签名、`TimelineComponent`）
- [x] 1.3 最小设计令牌：色板/间距/圆角/字重、8 色海报占位板 + `colorHash(recordId)` 确定性映射、热力图 5 级强度色
- [x] 1.4 `createCollectionProjection` headless 工具：注入 Storage + 事件名列表，loadAll 全量、事件失效、microtask 合并去抖、不可变快照 + subscribe
- [x] 1.5 ui-contracts 单测（纯 Node）：colorHash 确定性、投影的启动加载/事件失效/合并去抖/退订、常量无重复
- [x] 1.6 `PluginRuntimeDeps` 类型与各插件工厂签名约定（deps 显式注入，core 零改动）

## 2. RNW 渲染 spike（风险前置）

- [x] 2.1 桌面端验证 RNW 关键子集：FlatList numColumns 网格、Modal、TextInput/多行输入、KeyboardAvoidingView（记录行为结论与降级决策于包内 README 或 design 附录）

## 3. plugin-edit（编辑器，唯一写入方）

- [x] 3.1 `packages/plugin-edit` 骨架：package.json（依赖 core/ui-contracts、ulid；peer: react/react-native）、tsconfig、vitest
- [x] 3.2 headless：`EditorController` 纯类（draft 状态、互斥 status、now() 注入、提交/重置转换）+ 校验纯函数（标题必填、真实日历日、评分 0–10 步进 0.5、episode S/E 约束、movie 禁带 S/E）
- [x] 3.3 headless：records 写路径（loadAll → 变异 → persistAll；新建默认快照 `tmdb.id=0` 等哨兵值、ULID id、schemaVersion=1）+ 事件发布（created/updated/deleted，payload `{id}`）+ 删除二次确认状态
- [x] 3.4 headless 单测（纯 Node）：校验矩阵全部场景、编辑保持 id/createdAt、删除取消/确认、快照默认快照值
- [x] 3.5 工厂 `createEditPlugin(deps)`：connect 空 state；create 注册 `cmd:record-edit`/`cmd:record-delete` 函数能力与 `ui:overlay:root` 弹层组件
- [x] 3.6 headed：编辑弹层 UI（RN Modal + 表单字段 + 逐字段错误反馈 + 未评分显式呈现），纯 RN 语法单源
- [ ] 3.7 双壳接线：bootstrap 装配 edit 插件 + overlay 根渲染，双端手工验证新建/编辑/删除落盘

## 4. plugin-display（海报墙 + 记录 tab）

- [x] 4.1 `packages/plugin-display` 骨架（同 3.1 模式，peer: react/react-native）
- [x] 4.2 headless：投影接入（`createCollectionProjection` records）+ selector 纯函数（watchedAt 倒序、色卡解析顺序 mediaCache→posterPath→色卡）
- [x] 4.3 headed：海报墙网格（移动 3 列 FlatList / 桌面按宽度断点增列，同文件分支）+ 确定性色卡卡片（colorHash + 标题/年份）
- [x] 4.4 headed：空态视图 + 「记录第一部影片」CTA（命令缺失时隐藏）
- [x] 4.5 headed：只读详情（移动底部弹层/桌面居中卡片分支），注册 `cmd:record-detail`，动作按钮转发 edit 命令（缺失隐藏）
- [x] 4.6 「海报墙/时间线」segmented 切换骨架：拉取 `ui:view:timeline`，未注册隐藏切换 + dev warn
- [ ] 4.7 headless 单测 + 双壳手工验证（空态→录入→卡片出现；事件失效刷新）

## 5. plugin-timeline（时间线视图）

- [x] 5.1 `packages/plugin-timeline` 骨架（同上模式）
- [x] 5.2 headless：投影接入 + 按月分组倒序 selector（episode 徽标文本、评分摘要含未评分语义）
- [x] 5.3 headed：时间线组件（色卡缩略、标题、SxxExx 徽标、日期、评分摘要），条目点击转发 `cmd:record-detail`（缺失降级不可点）
- [ ] 5.4 headless 单测（分组/排序/徽标/未评分）+ 接入 display 切换后双壳手工验证；验证 optional 卸载后回退海报墙

## 6. plugin-record（日历热力图）

- [x] 6.1 `packages/plugin-record` 骨架（同上模式）
- [x] 6.2 headless：`bucketByDay` 日聚合 + 强度分级（0/1/2/3–4/≥5 五档）+ `buildYearGrid`（周一首列、闰年、不完整首尾周）+ 年份范围 selector
- [x] 6.3 headless 单测（纯 Node）：闰年、当日多条聚合、空年份、年份范围边界
- [x] 6.4 headed：热力图渲染（移动横滚 ScrollView / 桌面整年平铺分支）+ 点选日期当日记录面板（条目转发 detail/edit 命令，缺失降级）+ 年份切换器
- [ ] 6.5 双壳手工验证：新增记录当日格子即时着色、跨年切换、点选日期闭环到编辑

## 7. 壳收尾与 CI 守卫

- [x] 7.1 移除壳内 records/calendar 占位内容（保留 profile 占位），确认 read tab 无提供者时隐藏且 dev 警告正常
- [x] 7.2 CI 依赖方向守卫扩展：plugin-* → 仅 core + ui-contracts（+ui-nav）；插件间/对 platform-*、apps 的依赖违规即失败；react 系仍禁入 core
- [x] 7.3 CI 接入四个插件包与 ui-contracts 的 lint/typecheck/test；全仓 typecheck 通过（moduleSuffixes 一致）
- [ ] 7.4 双端冒烟清单跑通：移动端 + 桌面端完成「新建 → 海报墙 → 详情 → 编辑 → 时间线 → 日历着色 → 删除」全闭环，数据重启后仍在
