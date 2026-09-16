## Context

Phase 1–4 完成录入-浏览-元数据-检索-回顾-同步闭环。Phase 0 的 record-schema 已定义 `MoodEntry`（独立历史实体，mood-entries 集合，同一记录 N 次心情 → N 条 entry 的时间线语义），但无任何插件消费；ui-nav 规格预留「read tab 由 mood 插件供给能力，未注册则隐藏」；0b/Phase 1 将转场动画与手势记账到 Phase 5；Phase 2 将分享海报与 backdrop/stills 缓存记账到 Phase 5。双端约束：裸 RN（Metro）+ Tauri（RNW），新增原生依赖成本高（Phase 7 才有打包管线）。

## Goals / Non-Goals

**Goals:**
- mood 心情：详情页录入（心情 + 可选短评）、心情时间线、「读」tab（时间线 + 观后感阅读）
- 分享海报：headless 生成海报标记，双端导出（桌面 PNG 下载 / 移动系统分享）
- 转场与手势：tab 切换转场、横滑切 tab、卡片图片淡入、弹层开合转场、reduced-motion 降级
- 全部 headless 逻辑纯 Node 可测；零新增原生依赖

**Non-Goals:**
- i18n/主题体系（Phase 6）、移动端打包（Phase 7）
- mood 的统计聚合/图表（Phase 6 一并评估）
- 分享海报多模板/自定义排版（v1 单一模板）
- Reanimated/GestureHandler 引入（性能优化空间记账，v1 用 RN 内置 Animated/PanResponder）

## Decisions

### D1. mood 数据模型与归属
直接消费 Phase 0 既有 `MoodEntry` schema（id/recordId/mood/note?/createdAt，mood-entries 集合），无迁移。`mood` 字段为开放字符串（v1 UI 提供固定 emoji 档：😍🙂😐😴😢，存语义 key 如 `love|ok|meh|bored|sad`，为 Phase 6 i18n/主题留余地）。plugin-mood 是 mood-entries 唯一写入方（与 edit 对 records 的关系同构），变更发布 `mood:created` 事件（payload `{id}`）。删除 v1 不提供（时间线只增，误录容忍）。

### D2. 「读」tab 内容供给
mood 插件注册 `ui:tab:read` 内容组件：两条流——**心情时间线**（MoodEntry join records，倒序，条目=心情 emoji + 记录标题 + 日期 + note）与**观后感阅读**（records 中 review 非空的记录，卡片式阅读视图）。未加载时 read tab 隐藏（ui-nav 既有语义，零改动壳代码）。详情页「记心情」按钮经 `cmd:mood-add (recordId)` 触发 mood 弹层（`ui:overlay:mood` 注册进 OVERLAY_KEYS 宿主机制，与 tmdb/jellyfin overlay 同构）。

### D3. 分享海报：SVG 标记 + 平台导出端口
headless 纯函数 `renderShareCard(record, imageDataUrl?) => string` 产出 SVG 标记字符串（固定模板 1080×1350：海报图/色卡 + 标题 + 评分 + 观看日期 + 观后感摘录 + SxxExx badge），纯 Node 可断言。导出经平台端口：
- **桌面**：SVG 注入 `<img>` → canvas rasterize → PNG Blob → 下载（无新依赖）
- **移动**：SVG 写缓存文件（platform-rn 二进制 fs 端口既有）→ RN 内置 `Share.share({url})` 系统分享（SVG 文件；不支持 SVG 的目标应用退回纯文本摘要——v1 接受）
海报素材：poster 优先取 image-cache 本地路径转 dataURL（避免 CSP/文件协议问题），未命中用色卡占位——分享海报 MUST NOT 因图片下载失败而失败。backdrop/stills 入缓存档位（D4）为后续模板留素材，v1 模板仅用 poster。

### D4. image-cache 档位扩展
`resolve` 语义不变；内部按 URL 形态（`/t/p/w500` poster vs `/t/p/w780` backdrop vs stills）分档 LRU 计数，容量上限按比例分配（poster 优先）。对外 API 不变，消费方无感。

### D5. motion 令牌与转场实现
ui-contracts 新增 motion 令牌（`MOTION = { duration: { fast:150, base:250, slow:400 }, easing: {...} }`，JS 对象双端同源，与色板同构）。实现仅 RN 内置 **Animated API**（RN/RNW 同源支持）+ **PanResponder**（横滑手势）：
- tab 切换：内容区淡入 + 8px 位移（base 250ms）；tab 容器挂 PanResponder，横向位移 >60px 且速度达标 → 切相邻 tab（与垂直滚动经 dx>dy 判定隔离）
- display 卡片：图片解析完成 0→1 淡入（fast 150ms）
- 详情/编辑弹层：Modal 既有 slide 保留，overlay 背景淡入
- **reduced-motion**：`AccessibilityInfo.isReduceMotionEnabled()`（RN 内置，双端同 API）为 true 时全部动画瞬时完成
- Reanimated/GestureHandler 的引入评估记账到 Phase 6/7（原生依赖 + babel 配置成本 vs 收益）

### D6. 能力 key 与装配
新增：`cmd:mood-add`、`ui:overlay:mood`、`ui:tab:read`、`cmd:share-poster`（`(recordId) => Promise<ShareResult>`）、`mood:created` 事件；类型 `MoodAddCommand`/`SharePosterCommand`/`ShareResult`/MOTION 令牌。装配顺序：mood/share 为 recommended，display 经 `capabilities.get` 取用入口（缺失隐藏按钮）。dep-guard 白名单：plugin-mood/plugin-share = core + ui-contracts。

## Risks / Trade-offs

- [Animated API 在 RNW 的性能上限] → 转场均短时长小规模（淡入/位移），useNativeDriver 可用的属性（opacity/transform）优先；性能不足再记账升级 Reanimated
- [移动端分享 SVG 兼容性] → 部分目标应用不识别 SVG；v1 退回文本摘要可接受，PNG 栅格化需原生库（react-native-view-shot / react-native-svg）记账 Phase 7
- [横滑手势与水平内容冲突] → 手势判定要求纯横向（|dx|>2|dy| 且起始区不在横向滚动组件上）；冲突个案出现后加排除区
- [心情语义 key 的展示文案硬编码中文] → 与全站 0b 决策一致，Phase 6 i18n 统一处理
