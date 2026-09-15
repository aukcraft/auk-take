## 1. 契约先行（ui-contracts）

- [x] 1.1 Phase 3 key 常量（`cmd:tag-list/create/rename/delete/filter`、`ui:tag-picker`、`cmd:search`、`cmd:record-remove-tag`、`tag:created/renamed/deleted`）+ 契约类型（TagPickerComponent、RecordQuery、各命令签名）+ 全局 key 唯一性单测

## 2. plugin-tag

- [x] 2.1 包骨架（core + ui-contracts，peer react/react-native；dep-guard allow-list）
- [x] 2.2 headless：TagStore——tags 集合 CRUD（名称 trim、大小写/空白不敏感重名拒绝、重命名保 id）、事件发布（created/renamed/deleted）+ 纯 Node 单测
- [x] 2.3 headless：删除/重命名的引用清洗编排（经 `cmd:record-remove-tag`，命令缺失时拒绝破坏性操作）+ 单测
- [x] 2.4 headed：`ui:tag-picker` 组件（多选 chips + 新建 + 移除；闭包持命令族）+ 工厂注册命令族与组件
- [x] 2.5 双壳装配（locked 常驻）+ 手工验证创建/重命名/删除清洗

## 3. plugin-edit 标签集成

- [x] 3.1 草稿扩展 `tagIds`（draftFromRecord 预填、setTagIds 转换、保存写入 user.tags 并过滤失效 id）+ 单测
- [x] 3.2 `cmd:record-remove-tag` 批量清洗通道（移除引用 + 逐条 record:updated）+ 单测
- [x] 3.3 弹层标签区 UI（`ui:tag-picker` 未注册整块隐藏）+ 手工验证保存携带标签

## 4. plugin-search

- [x] 4.1 包骨架（同 2.1 模式，recommended tier）
- [x] 4.2 headless：queryRecords 纯函数（text 子串标题/原题、tagIds AND、评分区间含 0 语义、类型精确、日期闭区间、空查询零拷贝快路径）+ 全矩阵单测
- [x] 4.3 headed：搜索套件工厂 `createSearchSuite` → [SearchButton（图标 + 激活条件可删 pills，× 即删即时过滤）, SearchCard（条件弹窗：关键词/日期/标签/评分/类型，仅 AND）]
- [x] 4.4 `cmd:search` + 套件工厂注册；display 记录 tab 接入（Button 入头部、Card 弹窗、过滤态自持、空结果空态 + 清除；search 缺失隐藏 + dev warn）
- [x] 4.5 手工验证：即时过滤、组合筛选、清空恢复、卸载降级

## 5. plugin-stats

- [x] 5.1 包骨架（recommended tier；依赖 ui-nav 取 `ui:tab:profile` key）
- [x] 5.2 headless：aggregateYear 纯函数（总览数字、月度分布、类型分布、标签 TOP、topDay 并列取早、空年份）+ 全矩阵单测
- [x] 5.3 headed：回顾视图（年度选择器 + View 比例柱状 + 分布 chips + 下钻经 cmd:search 不可点降级）+ 注册 `ui:tab:profile` 覆盖壳占位（装配顺序单测钉住）
- [x] 5.4 手工验证：「我的」展示统计、下钻、卸载回退占位

## 6. 壳收尾与 CI

- [x] 6.1 dep-guard allow-list 三包 + 全仓 lint/typecheck/test 通过（预计 130+ 测试）
- [x] 6.2 详情视图标签 chips 展示（cmd:tag-list 解析，缺失降级隐藏）
- [x] 6.3 双端冒烟：建标签 → 打标保存 → 搜索/筛选 → 清洗删除 → 统计回顾下钻 → 卸载降级 → Phase 1/2 回归
