## ADDED Requirements

### Requirement: 分享海报生成（headless）
plugin-share SHALL 实现 `AukPlugin` 契约（id `share`，tier `recommended`），提供纯函数 `renderShareCard(record, posterDataUrl?) => string`：产出固定模板（1080×1350）的 SVG 标记——海报图（dataURL 内嵌）或确定性色卡占位 + 标题 + 评分（未评分显式呈现）+ 观看日期 + 观后感摘录 + 剧集 SxxExx badge。SVG 生成 SHALL 为纯函数，纯 Node 断言标记内容；海报素材缺失或下载失败 MUST 回退色卡，分享流程 MUST NOT 因图片失败而失败。

#### Scenario: 带海报生成
- **WHEN** 记录有 poster 且 image-cache 命中（转 dataURL）
- **THEN** SVG 内嵌该图，含标题/评分/日期/观后感摘录

#### Scenario: 无海报回退色卡
- **WHEN** posterPath 为空或缓存未命中
- **THEN** SVG 使用与海报墙一致的确定性色卡占位，流程不中断

### Requirement: 双端导出端口
plugin-share SHALL 注册 `cmd:share-poster`（`(recordId: string) => Promise<ShareResult>`），导出经平台端口：**桌面**以结构化卡片模型在 canvas 直接绘制为 PNG（SVG 经 `<img>` 栅格化在 WebKit 下污染 canvas），经 fs 端口写入导出目录并在详情页展示写入路径（Tauri webview 无下载管理器，`<a download>` 无效）；**移动**经 RN 内置 Share 分享纯文本摘要（标题+评分+日期+摘录；mobile 无 fs 端口，文件分享记账 Phase 7）。`ShareResult` SHALL 区分 `{status:"shared"|"downloaded"|"cancelled"|"error"}`，downloaded 可携带写入路径；错误与取消 SHALL 在详情页给出可见反馈。详情页「分享」按钮在该命令未注册时隐藏。

#### Scenario: 桌面导出 PNG
- **WHEN** 桌面端对某记录执行分享
- **THEN** canvas 直绘生成 PNG，经 fs 端口写入导出目录，结果 downloaded 且携带路径，详情页显示路径

#### Scenario: 移动系统分享
- **WHEN** 移动端执行分享且系统分享面板被接受
- **THEN** SVG 文件经 Share 分享，结果 shared；用户取消则 cancelled

#### Scenario: 命令缺失降级
- **WHEN** plugin-share 未加载
- **THEN** 详情页无「分享」按钮
