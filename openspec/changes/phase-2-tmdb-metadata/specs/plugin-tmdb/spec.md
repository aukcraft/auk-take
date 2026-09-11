## ADDED Requirements

### Requirement: 插件契约与凭证配置
plugin-tmdb SHALL 实现 `AukPlugin` 契约（id `tmdb`，tier `recommended`，permissions `network:fetch` + `storage:read` + `storage:write`）。TMDB API 凭证 SHALL 内置默认 Key 并允许用户配置覆盖；语言偏好 SHALL 可设置（默认 `zh-CN`）。凭证与语言偏好 SHALL 持久化于 Storage（syncMeta 集合 `{id:"tmdb-config"}`，经插件自身 storage:write 权限）——双壳 ConnectionStore 为内存实现，connect state 无法跨重启。凭证无效或未配置时插件 SHALL 优雅降级：搜索/补全命令返回空结果并提示，不阻塞 Phase 1 手动录入闭环。

#### Scenario: 默认 Key 开箱即用
- **WHEN** 用户未做任何配置即触发 TMDB 搜索
- **THEN** 插件使用内置默认 Key 请求，正常返回候选列表

#### Scenario: 用户覆盖凭证
- **WHEN** 用户配置了自定义 API Key
- **THEN** 后续请求使用用户 Key；配置持久化于 syncMeta 集合，重启后仍生效

#### Scenario: 凭证失效降级
- **WHEN** TMDB 返回 401/无效 Key
- **THEN** 搜索命令返回空结果与明确错误提示，应用其余功能不受影响

### Requirement: TMDB 客户端口（headless）
plugin-tmdb SHALL 提供纯 TS 客户端口：HTTP fetch 函数注入（RN 原生 fetch / Tauri fetch）、baseURL/语言/凭证可参数化、搜索（标题 + mediaType 约束 movie/episode 所属剧集）、详情拉取。客户端口 MUST 在纯 Node 测试中以 stub fetch 验证（URL 拼装、query 参数、错误映射），不发起真实网络。

#### Scenario: 搜索请求拼装
- **WHEN** 以标题「深海」调用搜索且语言偏好为 zh-CN
- **THEN** 注入的 fetch 收到 `/search/movie` 请求，query 含 `query=深海`、`language=zh-CN`、`api_key=<凭证>`

#### Scenario: stub 注入可测
- **WHEN** 在纯 Node vitest 中以 stub fetch 构造客户端口
- **THEN** 响应被映射为内部候选类型，网络错误被映射为统一错误对象

### Requirement: 编辑器搜索绑定命令
plugin-tmdb SHALL 注册 `cmd:tmdb-search` 函数能力（`(query: string, options?: { mediaType?: "movie" | "episode" }) => Promise<TmdbCandidate[]>`），候选含 TMDB id、标题、原题、年份、海报缩略 URL 与 mediaType。编辑弹层选中候选后，TMDB 快照字段（tmdb.id/title/originalTitle/overview/posterPath/backdropPath/releaseDate/genres/runtime/S-E）SHALL 合并进保存的记录；哨兵字段全部被真实值替换。绑定后的记录再次编辑时，标题/评分/观后感/观看日期可改，TMDB 快照字段 SHALL 以 TMDB 为准，除非用户显式解绑（解绑后回退 manual 快照语义）。

#### Scenario: 搜索返回候选
- **WHEN** 编辑弹层输入标题并触发搜索
- **THEN** 弹层展示候选列表（标题/年份/缩略图），用户可选中或「跳过，纯手动」

#### Scenario: 绑定替换哨兵
- **WHEN** 用户在编辑器选中某候选并保存
- **THEN** 记录的 `tmdb.id` 为该候选真实 TMDB id，overview/genres/runtime/posterPath 为真实快照值

#### Scenario: 绑定记录的编辑语义
- **WHEN** 编辑一条已绑定 TMDB 的记录并仅修改评分
- **THEN** TMDB 快照字段不变，评分更新，`record:updated` 照常发布

### Requirement: 存量哨兵补全
plugin-tmdb SHALL 提供 `cmd:tmdb-backfill` 命令（单条 recordId：搜索 → 唯一高置信匹配自动绑定；多/零候选标记待人工）与扫描入口（列出全部 `tmdb.id === 0` 的记录）。补全写入 SHALL 复用 edit 插件的 records 唯一写路径（不产生第二写入方），保持记录 id/createdAt/user 字段不变，仅替换 tmdb 快照，并发布 `record:updated`。

#### Scenario: 唯一高置信匹配自动绑定
- **WHEN** 对某哨兵记录执行补全且首个候选与标题高度匹配（归一化标题相等或年份吻合）
- **THEN** 记录被静默补全，海报墙该卡片后续渲染真实海报路径

#### Scenario: 多候选转人工
- **WHEN** 补全搜索返回多个低区分度候选
- **THEN** 记录标记待人工，补全面板列出候选供用户选择，不静默绑定错误条目

#### Scenario: 补全不改变用户数据
- **WHEN** 补全写入完成
- **THEN** 该记录 id、createdAt、watchedAt、rating、review、tags 与补全前一致

### Requirement: 图片缓存服务
plugin-tmdb SHALL 注册 `svc:image-cache` 服务：输入远端图片 URL 输出本地缓存路径（未缓存则下载后返回）。缓存 SHALL 有 LRU 容量上限、写入原子性（临时文件 + rename），下载/读写失败 MUST 静默降级（返回 null，调用方回退色卡或远端直连）。缓存实现 MUST 平台无关（fs 能力经注入），纯 Node 可测。

#### Scenario: 首次请求缓存落盘
- **WHEN** 海报墙请求某 poster URL 的缓存路径
- **THEN** 服务下载图片写入缓存目录并返回本地路径，再次请求命中不再下载

#### Scenario: 失败降级
- **WHEN** 图片下载抛错（断网/404）
- **THEN** 服务返回 null，卡片回退下一解析档位，无崩溃无裸抛
