## Why

Phase 1–4 交付了录入-浏览-元数据-检索-回顾-同步闭环，观影库开始积累真实数据，但 roadmap 预留的四条线仍未落地：**心情**（Phase 0 schema 已备 MoodEntry，无插件消费）、**「读」tab**（ui-nav 规格写明由 mood 插件供给，一直隐藏）、**转场动画与手势**（0b/Phase 1 记账）、**分享海报**（Phase 2 记账）。Phase 5 按原 roadmap 一次收齐。

## What Changes

- 新增 `packages/plugin-mood`（recommended）：MoodEntry 独立历史实体（mood-entries 集合）的录入（心情 + 可选短评，详情页入口）、**心情时间线**（同一记录多次心情沉淀）、`ui:tab:read` 内容能力（「读」tab：时间线 + 观后感阅读视图）；未加载时 read tab 依 ui-nav 既有语义隐藏
- 新增 `packages/plugin-share`（recommended）：分享海报生成——headless 产出海报 SVG 标记（poster + 标题 + 评分 + 日期 + 观后感摘录），平台端口负责导出（桌面下载 PNG、移动走系统分享）；记录详情页「分享」入口，能力缺失隐藏
- 修改 `packages/plugin-tmdb` 图片缓存：档位扩展至 backdrop/stills（分享海报素材来源），LRU/原子写语义不变
- 修改 `packages/ui-nav`：tab 切换转场动画 + 横滑手势切 tab——仅 RN 内置 Animated/PanResponder，**零新增原生依赖**；提供 prefers-reduced-motion 降级
- 修改 `packages/plugin-display`：卡片图片解析完成淡入、详情弹层开合转场（动画令牌与 ui-nav 同源）
- 修改 `packages/ui-contracts`：Phase 5 契约 key/类型（mood 命令、`ui:tab:read`、分享命令/类型）+ **motion 设计令牌**（时长/缓动，双端同源）
- 壳：装配 plugin-mood 与 plugin-share（recommended）；dep-guard 白名单登记

## Capabilities

### New Capabilities
- `plugin-mood`: 心情历史实体的录入/时间线/「读」tab 内容供给
- `plugin-share`: 分享海报 headless 生成与双端导出端口

### Modified Capabilities
- `image-cache`: 缓存档位从 poster 扩展至 backdrop/stills
- `ui-nav`: tab 转场动画与横滑手势（预留的 Phase 5 条目落地）
- `plugin-display`: 图片淡入与弹层转场、详情页心情录入与分享入口
- `ui-contracts`: Phase 5 能力 key、契约类型与 motion 令牌

## Impact

- 代码：新增 plugin-mood/plugin-share；修改 plugin-tmdb（image-cache）、ui-nav、plugin-display、ui-contracts、双壳 bootstrap、scripts/dep-guard.cjs
- 依赖：**零新增原生依赖**（动画走 RN Animated/PanResponder；海报走 SVG 字符串 + 平台导出端口）；桌面导出用 canvas/Blob，移动用 RN 内置 Share/写文件端口
- 数据：MoodEntry 集合为 Phase 0 既有 schema，无迁移；不动 records
- 规格：ui-nav 的 Phase 5 预留条目落地；host-shell 的 tab 能力驱动语义不变
- 非目标：i18n/主题（Phase 6）、移动端打包流水线（Phase 7）、mood 的统计聚合（Phase 6 图表一并评估）、分享海报的模板体系（v1 单一模板）
