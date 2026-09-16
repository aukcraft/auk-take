## MODIFIED Requirements

### Requirement: 只读详情
plugin-display SHALL 注册 `cmd:record-detail` 命令（`(recordId: string) => void`），打开只读详情视图（移动端底部弹层、桌面端居中卡片，同组件内分支）：展示记录全部字段（标题、原题、类型与 SxxExx、观看日期、评分或未评分、观后感），在 `tmdb.id > 0` 时追加元数据区（genres、runtime、releaseDate、overview 摘要），并在 `user.tags` 非空时展示标签 chips（`cmd:tag-list` 未注册时仅显示 id 降级）。详情视图的动作按钮 SHALL 仅转发 `cmd:record-edit` 与 `cmd:record-delete` 命令，不自持变更逻辑。相关命令未注册时对应动作按钮隐藏。Phase 5 起，详情视图 SHALL 追加「记心情」（转发 `cmd:mood-add`）与「分享」（转发 `cmd:share-poster`）动作入口，命令未注册时各自隐藏。

#### Scenario: 查看详情
- **WHEN** 从海报墙卡片调用 `cmd:record-detail`
- **THEN** 详情视图展示该记录全部字段，无编辑态

#### Scenario: 标签展示
- **WHEN** 记录含 2 个标签引用
- **THEN** 详情以 chips 展示标签名称（经 `cmd:tag-list` 解析）

#### Scenario: 动作命令缺失降级
- **WHEN** edit 插件未加载
- **THEN** 详情的编辑/删除按钮隐藏，浏览不受影响

#### Scenario: 心情与分享入口
- **WHEN** mood/share 插件均已加载
- **THEN** 详情展示「记心情」「分享」按钮，点击分别转发 `cmd:mood-add`/`cmd:share-poster`；插件未加载时对应按钮隐藏

## ADDED Requirements

### Requirement: 图片与弹层动效
海报墙卡片 SHALL 在图片解析完成时以淡入呈现（时长取 ui-contracts motion 令牌 fast 档，RN 内置 Animated，opacity useNativeDriver）；详情弹层背景 SHALL 淡入。`AccessibilityInfo.isReduceMotionEnabled()` 为 true 时全部动效 SHALL 瞬时完成（直接呈现终态）。

#### Scenario: 图片淡入
- **WHEN** 卡片从色卡占位解析到真实图片
- **THEN** 图片以 150ms 淡入替换色卡

#### Scenario: reduced-motion 下无动效
- **WHEN** 系统开启减弱动态效果
- **THEN** 图片直接呈现，无淡入
