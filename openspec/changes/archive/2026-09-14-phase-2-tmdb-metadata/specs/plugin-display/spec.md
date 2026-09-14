## MODIFIED Requirements

### Requirement: 海报墙网格
海报墙 SHALL 以网格渲染全部记录，按 `user.watchedAt` 倒序排列。卡片图片解析顺序 SHALL 为 `mediaCache.poster`（本地缓存图，经 `svc:image-cache`）→ `tmdb.posterPath`（远端图，经缓存服务解析）→ 确定性标题色卡（按标题文本映射色板）。缓存服务未注册时 SHALL 跳过图片档位直接渲染色卡（dev 模式警告）。网格列数 SHALL 按平台自适应：移动端 3 列，桌面端按窗口宽度断点增列。图片加载失败（缓存与远端均不可用）MUST 回退色卡，不留空洞。

#### Scenario: 缓存图渲染
- **WHEN** 记录的 `mediaCache.poster` 指向有效本地缓存文件
- **THEN** 卡片渲染本地海报图，不发起网络请求

#### Scenario: 远端图经缓存解析
- **WHEN** 记录仅含 `tmdb.posterPath`（无本地缓存）
- **THEN** 卡片经 `svc:image-cache` 解析远端 URL 渲染；解析失败回退色卡

#### Scenario: 无图记录渲染色卡
- **WHEN** 记录无 mediaCache 与 posterPath（Phase 1 手动哨兵记录）
- **THEN** 卡片渲染确定性色卡（基于标题映射色板）叠加标题文字，同标题双端颜色一致

#### Scenario: 倒序排列
- **WHEN** 集合含多条不同 watchedAt 的记录
- **THEN** 最新观看的记录排在网格最前

#### Scenario: 桌面端增列
- **WHEN** 桌面端窗口宽度超过断点
- **THEN** 网格列数多于移动端基准（3 列）

### Requirement: 只读详情
plugin-display SHALL 注册 `cmd:record-detail` 命令（`(recordId: string) => void`），打开只读详情视图（移动端底部弹层、桌面端居中卡片，同组件内分支）：展示记录全部字段（标题、原题、类型与 SxxExx、观看日期、评分或未评分、观后感），并在 `tmdb.id > 0` 时追加元数据区（genres、runtime、releaseDate、overview 摘要）。详情视图的动作按钮 SHALL 仅转发 `cmd:record-edit` 与 `cmd:record-delete` 命令，不自持变更逻辑。相关命令未注册时对应动作按钮隐藏。

#### Scenario: 查看详情
- **WHEN** 从海报墙卡片调用 `cmd:record-detail`
- **THEN** 详情视图展示该记录全部字段，无编辑态

#### Scenario: 绑定记录展示元数据
- **WHEN** 记录 `tmdb.id > 0`
- **THEN** 详情追加展示 genres、runtime、上映日期与简介

#### Scenario: 未评分展示
- **WHEN** 记录 `rating === 0`
- **THEN** 详情与卡片评分位显示「未评分」而非 0 分

#### Scenario: 动作命令缺失降级
- **WHEN** edit 插件未加载
- **THEN** 详情的编辑/删除按钮隐藏，浏览不受影响
