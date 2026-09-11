## 1. 契约先行（ui-contracts）

- [x] 1.1 新增 key 常量（`cmd:tmdb-search`、`cmd:tmdb-backfill`、`cmd:record-apply-tmdb`、`svc:image-cache`）与契约类型（`TmdbCandidate`、`ImageCacheService`、`RecordApplyTmdbCommand`）+ 常量无重复单测
- [x] 1.2 内置默认 Key 的构建期注入通道（不进 git，README 记账）

## 2. plugin-tmdb headless：客户端口

- [x] 2.1 包骨架（依赖 core/ui-contracts，peer react/react-native，vitest；守卫 allow-list 更新）
- [x] 2.2 `TmdbClient`：注入 fetch/baseUrl/apiKey/language；searchMovie/searchTv/movieDetail/tvSeason 的 URL 拼装纯函数 + stub fetch 单测（URL/query/错误映射 401→InvalidKey、网络→NetworkError）
- [x] 2.3 `TmdbService`：候选映射（TMDB JSON→TmdbCandidate，含海报缩略 URL 拼装）、凭证/语言配置解析（用户配置→内置默认 Key）、配置经 connect state 持久化单测
- [x] 2.4 工厂 `createTmdbPlugin(deps)`：connect 持配置；create 注册 `cmd:tmdb-search`；recommended tier；dispose 清理

## 3. plugin-edit：搜索绑定写路径与 UI

- [x] 3.1 会话草稿扩展 `pendingTmdb` 槽（选中候选/清除/解绑语义）+ 单测
- [x] 3.2 写路径 `applyTmdbSnapshot`：新建/更新合并 TMDB 快照、哨兵替换、绑定记录仅更新 user 字段、解绑回退哨兵 + 单测矩阵
- [x] 3.3 edit 暴露 `cmd:record-apply-tmdb` 内部通道（校验 + 合并写 + record:updated）+ 单测
- [x] 3.4 弹层搜索区 UI：搜索框 + 候选列表 + 「跳过，纯手动」+ 已绑定记录的快照只读展示与解绑按钮；`cmd:tmdb-search` 未注册整块隐藏
- [x] 3.5 episode 搜索路径：searchTv → 选剧 → 季集（S/E）绑定

## 4. plugin-tmdb：图片缓存服务

- [x] 4.1 `fsPort` 最小接口定义（platform 无关）+ platform-rn/platform-tauri 的 `fs` 服务实现注入（Tauri 复用 plugin-fs；RN 端实现期决策 RNFS vs 降级远端直连，README 记账）
- [x] 4.2 `ImageCacheService`：确定性 key（URL SHA-256 前 16 位 + 扩展名）、原子写（tmp+rename）、LRU index 持久化与淘汰纯函数、失败返回 null + 纯 Node 单测（mem fs）
- [x] 4.3 注册 `svc:image-cache`；LRU index 损坏重建（目录扫描 + 孤儿清理）单测

## 5. 海报渲染管线激活

- [x] 5.1 display：`resolveCardSource` 三档异步解析（local → remote-via-cache → palette）selector + 单测（含 image-cache 缺失跳档）
- [x] 5.2 display：卡片先渲色卡占位、解析成功替换；缓存服务未注册 dev warn；详情视图追加 genres/runtime/releaseDate/overview 元数据区
- [x] 5.3 timeline：缩略位同解析顺序对齐 display + 回归单测

## 6. 存量补全

- [x] 6.1 `listSentinelRecords` selector（tmdb.id===0）+ 高置信判定纯函数（归一化标题相等 / 标题+年份吻合）+ 单测矩阵
- [x] 6.2 `cmd:tmdb-backfill`：唯一高置信自动绑定（经 `cmd:record-apply-tmdb`）；多/零候选返回 needs-review + 候选 + 单测
- [x] 6.3 补全入口 UI（位置实现期定）：哨兵记录列表 + 逐条补全/人工选候选；命令缺失降级提示

## 7. 壳接线与网络配置

- [x] 7.1 双壳装配 plugin-tmdb（recommended tier 启动语义验证：未连接配置时能力缺失、应用回退 Phase 1 形态）
- [x] 7.2 Tauri CSP 收敛：api.themoviedb.org（connect-src）+ image.tmdb.org（img-src）+ 保留 dev/data/blob；双端验证 TMDB 请求与图片加载
- [x] 7.3 CI：dep-guard allow-list 增 plugin-tmdb；全仓 lint/typecheck/test 通过
- [ ] 7.4 双端冒烟：搜索绑定新建 → 真图海报墙 → 详情元数据 → 存量补全（含转人工）→ 断网降级色卡 → 解绑回哨兵 → Phase 1 手动闭环回归 → 重启数据仍在
