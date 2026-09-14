## Why

Phase 1 落地了手动录入闭环，但所有记录的 TMDB 快照都是哨兵值（`tmdb.id=0`、空海报、空 genres/runtime）——海报墙只能渲染色卡、未来的筛选/统计缺乏结构化元数据。Phase 2 接入 TMDB：编辑时搜索绑定、存量哨兵记录一键补全、海报图片本地缓存，把观影记录从"纯手写日记"升级为"结构化影片档案"。

## What Changes

- 新增 `packages/plugin-tmdb`（tier: recommended，permissions: `network:fetch` + `storage:read/write`）：
  - **TMDB 客户端口**：纯 headless HTTP 适配（fetch 注入、可测），API 访问凭证**内置默认 Key + 用户可配置覆盖**（经插件 connect state 持久化）；语言偏好可设置（默认 zh-CN，无中文回退原题）；未配置/无网络时全功能优雅降级为 Phase 1 手动形态
  - **编辑器搜索绑定**：注册 `cmd:tmdb-search` 函数能力（标题 → 候选列表），编辑弹层内搜索、选中候选即把 TMDB 快照（id/title/overview/posterPath/releaseDate/genres/runtime/S-E）合并进记录草稿
  - **存量补全**：注册 `cmd:tmdb-backfill`（单条记录）+ 扫描能力（识别 `tmdb.id=0` 哨兵，逐条搜索→唯一高置信匹配自动绑定，多候选/零候选标记待人工），补全走 edit 插件的唯一写路径（经 `cmd:record-edit` 语义扩展或专用命令），每次变更后照常发布 `record:*` 事件
  - **图片缓存服务**：注册 `svc:image-cache` 服务能力（poster URL → 本地缓存路径，写入 `mediaCache.poster`），LRU 容量上限、原子写、失败静默降级色卡
- 修改 `packages/plugin-edit`：编辑弹层接入搜索绑定 UI（搜索框 + 候选列表 + 「跳过，纯手动」）；TMDB 绑定记录的标题编辑语义落地（标题/评分/观后感可改，TMDB 快照字段以 TMDB 为准除非用户显式解绑）
- 修改 `packages/plugin-display`：海报卡片解析顺序正式生效——`mediaCache.poster`（本地缓存图）→ `tmdb.posterPath`（远端图，经缓存服务）→ 确定性色卡；详情视图补全 genres/runtime/原题展示
- 修改 `packages/plugin-timeline`：缩略图同解析顺序
- CORS 策略：桌面端（Tauri）经 http 插件代理或 CSP 放行 `image.tmdb.org`/`api.themoviedb.org`；移动端 RN fetch 原生无 CORS 限制

### Non-goals（本 change 明确不做）

- 演职人员、剧集整季订阅追踪、TMDB 帐号同步（后续 Phase）
- 「我的」tab 设置界面（Key/语言配置经命令能力与最小配置 UI 入口，完整设置体系 Phase 6）
- backdrop/stills 缓存（仅 poster；分享海报是 Phase 5）
- 自动后台批量补全调度（补全由用户显式触发，逐条进行）
- 离线队列与重试体系（失败即降级，手动重试）

## Capabilities

### New Capabilities

- `plugin-tmdb`: TMDB 元数据插件——客户端口（凭证/语言/降级）、搜索绑定命令、存量哨兵补全、图片缓存服务
- `image-cache`: 海报图片缓存契约——URL→本地路径解析、LRU 容量、原子写、失败降级（作为 svc:image-cache 的契约 spec，供 display/timeline 消费）

### Modified Capabilities

- `plugin-edit`: 编辑弹层接入 TMDB 搜索绑定；绑定记录的编辑语义（快照字段保护与解绑）
- `plugin-display`: 海报卡片图片解析顺序生效（本地缓存 → 远端经缓存 → 色卡）+ 详情元数据展示
- `plugin-timeline`: 缩略图解析顺序与 display 对齐
- `host-shell`: 桌面端网络白名单（Tauri http/CSP 放行 TMDB 域）；plugin-tmdb 的装配与 recommended tier 启动语义

## Impact

- 新增代码：`packages/plugin-tmdb`（headless 客户端/搜索/补全/缓存 + headed 搜索 UI 组件）
- 修改代码：`plugin-edit`（弹层搜索区）、`plugin-display`（图片卡片 + 详情）、`plugin-timeline`（缩略图）、双壳（装配 + Tauri 网络配置）、`ui-contracts`（新增 `cmd:tmdb-search`/`cmd:tmdb-backfill`/`svc:image-cache` key 常量）
- 新依赖：plugin-tmdb 的 fetch 经注入（RN/Tauri 原生 fetch），不引 HTTP 库；图片缓存存储复用 Storage 端口目录约定 + 平台 fs 能力（经服务注入，不直依赖 platform-*）
- 里程碑：Phase 2（GitHub Issue/PR 流程同前）
