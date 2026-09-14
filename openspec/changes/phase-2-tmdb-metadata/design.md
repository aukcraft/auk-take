## Context

Phase 1 交付了四个业务插件 + ui-contracts 契约包与双端可运行闭环；所有记录均为 manual 来源，TMDB 快照字段为哨兵值（`tmdb.id=0`、空串/空数组/0），海报墙/时间线渲染确定性色卡，图片解析管线结构已就位但恒走色卡分支。Phase 1 已约定：哨兵值是 Phase 2 补全作业的无歧义识别依据；`mediaCache.poster` → `tmdb.posterPath` → 色卡的解析顺序零结构改动接入图片。

用户已拍板：三大能力全做（编辑时搜索绑定 + 存量补全 + 海报图片缓存）；API 凭证**内置默认 Key、用户可配置覆盖**；语言偏好可设置（默认 zh-CN）。

## Goals / Non-Goals

**Goals:**

- TMDB 元数据接入全链路双端可运行：搜索绑定 / 存量补全 / 图片缓存三能力
- 保持 Phase 1 契约零破坏：core 不动；edit 仍是 records 唯一写入方；补全写入复用 edit 内部通道
- 网络与平台能力全部注入（fetch / fs / 目录路径），plugin-tmdb headless 层纯 Node 可测
- 全功能在无 Key / 无网络 / 插件卸载（recommended tier）时优雅降级回 Phase 1 形态

**Non-Goals:**

- 演职人员、整季追踪、TMDB 帐号同步、自动后台调度补全（见 proposal Non-goals）
- 完整设置界面体系；backdrop/stills 缓存；离线重试队列

## Decisions

### D1. plugin-tmdb 分层：注入式客户端口 + 能力注册

`createTmdbPlugin(deps: PluginRuntimeDeps & { fetchImpl?, config? })`。headless 层：

- `TmdbClient`：构造注入 `{ fetchImpl, apiKey, language, baseUrl }`；方法 `searchMovie(q)` / `searchTv(q)` / `tvSeason(tvId, season)` / `movieDetail(id)` / `tvEpisodeDetail(...)`。URL/query 拼装为纯函数（可测：断言注入 fetch 收到的 URL）
- `TmdbService`（会话层）：持凭证/语言偏好、候选映射（TMDB JSON → `TmdbCandidate`）、错误归一（401 → `InvalidKey`、网络 → `NetworkError`、其他 → `UpstreamError`）
- 凭证解析顺序：用户配置（connect state）→ 内置默认 Key（环境打包常量，`.env`/构建期注入，不进 git）；语言同理由配置驱动，默认 `zh-CN`；TMDB 无中文时 API 自动回退原文，客户端不再二次处理

fetch 注入：双端原生 `fetch`（RN Hermes / Tauri WebView）均可直连 TMDB；桌面端 CSP 放行两域（见 D6），不引 Tauri http 插件，少一个 Rust 依赖。

### D2. 搜索绑定的编辑器集成：候选合并发生在 edit，不发生第二写入方

`cmd:tmdb-search` 只做搜索返回候选（纯读，无写）。用户在编辑弹层选中候选时，edit 的 `EditSessionController` 扩展 `pendingTmdb: TmdbSnapshot | null` 草稿槽：选中即把候选快照放入草稿槽，保存时由 `RecordsWriter.create/update` 合并——**快照合并逻辑长在 edit 的写路径里**（`applyTmdbSnapshot(record, snapshot)`），edit 仍是唯一写入方，tmdb 插件不触碰 Storage 的 records 集合（其 storage:write 权限仅用于图片缓存目录记账）。

编辑语义（Phase 1 开放问题的落地）：

- 已绑定记录（`tmdb.id > 0`）：标题/评分/观后感/观看日期可改；TMDB 快照字段编辑器只读展示；「解绑」按钮显式回退哨兵
- episode 搜索路径：按剧集标题 `searchTv` → 选剧 → 选季集（S/E 来自表单或候选季集列表）；movie 直接 `searchMovie`

*替代方案*：tmdb 插件自己写 records（双写方）——违反 Phase 1 单写方 invariant，弃。

### D3. 存量补全：扫描 + 单条补全命令 + 置信度规则

- `listSentinelRecords()`：读方投影过滤 `tmdb.id === 0`（纯 selector，可测）
- `cmd:tmdb-backfill(recordId)`：搜索 → **高置信判定**（归一化标题精确相等，或标题相等忽略空白/大小写/标点 + 年份吻合 releaseDate）→ 唯一高置信候选自动经 edit 内部更新通道绑定；多/零候选返回 `needs-review` + 候选列表，由补全面板（display 的记录 tab 顶部入口或详情动作）人工选择
- edit 暴露内部通道：能力 key `cmd:record-apply-tmdb`（`recordId + snapshot` → 校验后合并写 + 发事件）。该 key 属于内部协作面，进 ui-contracts 常量；命令未注册时补全降级提示
- 补全仅替换 tmdb 快照，id/createdAt/user 全保留（spec 场景钉死）

### D4. 图片缓存：svc:image-cache 服务 + 确定性 key + LRU

`ImageCacheService`（headless，构造注入 `{ fetchImpl, fsPort, cacheDir, capacityBytes }`）：

- key = URL 的 SHA-256 十六进制前 16 位 + 保留原扩展名——同 URL 双端同 key（spec 场景）
- `resolve(url)`：存在即返回路径（并刷新 LRU 记分）；不存在则下载到 `*.tmp` → rename（原子）；任一步失败返回 null（调用方降级），LRU 记账由 index JSON 持久化（容量淘汰纯函数可测）
- fsPort：与 platform-tauri 的 `FsPort` 同构的最小接口（read/write/rename/remove/exists + mkdir），RN 端经 RNFS 形态适配（Phase 2 新增 `platform-rn` 的 fs 能力导出；桌面复用 Tauri plugin-fs）——**平台实现经 ServiceRegistry 注入 `fs` 服务，plugin-tmdb 零平台依赖**
- 消费侧：display/timeline 各自调 `services.get("image-cache")`（经 deps 注入的引用），未注册 → 跳档位 + dev warn

*替代方案*：图片直链远端不做本地缓存——离线/流量/加载闪烁三输，弃；OPFS——Tauri 桌面有真 fs，不需要。

### D5. 海报渲染管线激活与失败回退

display 卡片解析升级为三档异步：`resolveCardSource(record, imageCache)` 返回 `{ kind: "local" | "remote-via-cache" | "palette", source?: string }`；组件层先渲色卡占位（立即）、图片解析成功后替换（无动画，Phase 5 再加）。远端直连档在 image-cache 未注册时启用（RN 端 `<Image source={{uri: posterUrl}}>`；桌面端 CSP 已放行 image.tmdb.org）。

### D6. 桌面端网络与本地资源（实现期修订）

原计划显式收敛 CSP 放行 TMDB 域；实测发现 Tauri 生产构建的 CSP 注入追
加 nonce 后浏览器忽略 'unsafe-inline'，RNW 运行时动态样式全被拦截（样式
崩坏）。故 **CSP 保持 null**（null 下网络请求不受限，无需白名单），仅启用
assetProtocol（scope `$APPDATA/**`）承载本地缓存图。移动端无额外配置。

### D7. tier 与启动语义

tmdb = recommended：PluginManager 连接顺序上它排在 locked 插件之后；未连接配置时 `startup` 跳过（既有语义：无 connect state 则不 create），搜索区/补全入口/图片缓存全部缺失降级——正是 recommended tier 的第一个活例。卸载（unload）需同时清理其注册的 3 个能力 key（dispose 已是 Phase 1 模式）。

### D8. ui-contracts 新增常量

`cmd:tmdb-search`、`cmd:tmdb-backfill`、`cmd:record-apply-tmdb`（edit 内部通道）、`svc:image-cache` 进 `CAPABILITY_KEYS`/`SERVICE_KEYS`；契约类型 `TmdbCandidate`、`ImageCacheService`、`RecordApplyTmdbCommand`。ui-contracts 仍零平台依赖（类型 + key 而已）。

## Risks / Trade-offs

- [内置默认 Key 被滥用/限额] → Key 经构建期注入不进 git；用户可覆盖；请求带会话级最小频控（同 tick 搜索去抖）。若限额影响体验，引导用户配置自有 Key
- [RN 端图片缓存需要原生 fs 模块（RNFS）] → 若打包成本超预期，RN 端降级「远端直连 + 系统 HTTP 缓存」，桌面端保留完整本地缓存（分端能力差异，接口不变）
- [TMDB 中文标题与用户手输标题差异大导致补全低置信] → 高置信规则保守（宁转人工不静默绑错）；多候选面板人工兜底
- [CSP 收敛可能破坏 Phase 1 已有行为] → 白名单同时保留 dev server（localhost/ws）与 data:/blob:，冒烟覆盖 Phase 1 全闭环回归
- [LRU index JSON 与缓存文件不一致（崩溃窗口）] → index 损坏时全量重建（目录扫描 + 丢弃孤儿文件），代价可接受

## Migration Plan

绿地增量，无数据迁移（哨兵记录即补全对象）。落地顺序（每步可独立 PR/回滚）：

1. ui-contracts：新 key/类型 + 单测
2. plugin-tmdb headless：TmdbClient（stub fetch 测试）+ TmdbService + 配置持久化
3. plugin-edit：会话草稿 pendingTmdb 槽 + applyTmdbSnapshot 写路径 + 弹层搜索区 UI（tmdb 缺失隐藏）
4. plugin-tmdb：svc:image-cache（fsPort 注入 + LRU 纯函数测试）
5. plugin-display / timeline：三档解析 + 失败回退 + 详情元数据区
6. 存量补全：selector + backfill 命令 + 补全面板
7. 壳：装配 tmdb 插件、Tauri CSP、双端冒烟（含 Phase 1 回归）

回滚 = revert 对应 PR；tmdb 卸载后应用完整回退 Phase 1 形态（recommended tier 语义验证）。

## Open Questions

- RN 端 RNFS 引入与否（打包成本 vs 缓存完整性）→ 步骤 4 实现期决策，降级路径已定
- 桌面本地缓存图的加载通道（asset 协议 vs blob URL）→ 步骤 5 实现期以 RNW 行为定
- 补全入口的最终位置（记录 tab 顶部 vs 详情动作 vs 我的）→ 步骤 6 以信息架构评审定


## Implementation Appendix（实现期补充决策）

- **A1 凭证持久化**：双壳 ConnectionStore 均为内存实现，connect state 无法跨
  重启；配置（Key/语言）持久化于 syncMeta 集合 `{id:"tmdb-config"}`，走
  plugin-tmdb 已被授予的 storage:write 权限。配置 UI（`cmd:tmdb-configure`
  + 记录 tab 头部 TMDB 按钮）注册于 `ui:overlay:tmdb-backfill` 同一 overlay
  组件内。
- **A2 缓存 key**：D4 的「SHA-256 前 16 位」改为 64 位 FNV×2 双哈希（避免
  引入异步 Web Crypto 注入面）；确定性语义不变，单测覆盖。
- **A3 补全入口**：详情弹层对 `tmdb.id===0` 记录显示「补全元数据」动作
  （`cmd:tmdb-backfill` 缺失时隐藏）；needs-review 候选选择经 tmdb 插件的
  overlay（`ui:overlay:tmdb-backfill`，已加入 ui-contracts OVERLAY_KEYS）。
- **A4 移动端图片**：裸 RN 壳无原生工程，RNFS 不可引；移动端不注册 fs
  服务，卡片走远端直连 + 系统 HTTP 缓存（接口不变，后续接入原生工程后
  零结构改动启用本地缓存）。
- **A6 凭证加密（用户追加需求）**：凭证支持 v4 Read Access Token（Bearer 头，
  优先）与 v3 key（query）双形态；内置通道可由 CI secret
  `TMDB_V4_READ_ACCESS_TOKEN` 构建期注入 builtin-key.json。用户配置的秘密
  字段落盘前经纯 TS 流加密（`v1:<iv>:<cipher>`，随机 IV + pepper 种子
  keystream XOR），读取时解密；遗留明文兼容读取。诚实边界：应用内含
  pepper，这是**防 casual 读取/误泄漏的混淆级加密**，等价于本地明文的
  攻击者可还原；OS keystore 需原生模块（后续 Phase 评估）。
- **A5 桌面缓存图渲染**：经 `convertFileSrc`（Tauri asset 协议）转换本地
  路径；tauri.conf 启用 assetProtocol（scope `$APPDATA/**`）。
  **CSP 保持 null**（D6 修订）：Tauri 生产构建的 CSP 注入会追加 nonce，
  依 CSP 规范浏览器随即忽略 'unsafe-inline'，RNW 运行时插入的 <style>
  被全部拦截——34576261816 安装包样式全崩即此因。null CSP 下外联请求
  本不受限，TMDB 域无需显式放行；如未来需要收紧 CSP，须配合
  `dangerousDisableAssetCspModification` 或改用文件级样式方案再审。
