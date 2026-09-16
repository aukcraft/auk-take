# Tasks: Phase 5 — mood 心情 + 「读」tab + 分享海报 + 转场手势

规格源：proposal.md / design.md / specs/*（delta）。命令与工作流遵循 CLAUDE.md（`export COREPACK_HOME=/tmp/corepack`；pnpm 9 经 corepack shim）。

## 1. 契约层（先行）

- [ ] 1.1 ui-contracts：Phase 5 key（`cmd:mood-add`/`ui:overlay:mood`/`ui:tab:read`/`cmd:share-poster`）+ `mood:created`（MOOD_EVENTS）+ OVERLAY_KEYS 加入 `ui:overlay:mood`；类型 `MoodKind`/`MoodAddCommand`/`SharePosterCommand`/`ShareResult`；motion 令牌 `MOTION`（duration fast 150/base 250/slow 400 + easing）
- [ ] 1.2 契约测试：新 key 与 Phase 1–4 全部 key 唯一性断言；MOTION 形状断言

## 2. plugin-mood

- [ ] 2.1 包骨架（AukPlugin id=mood，recommended，storage:read+write）+ headless：mood-entries 写入（MoodEntry schema 直用）+ `mood:created` 发布 + 时间线/观后感 selector（纯函数：join records、倒序、review 非空过滤）
- [ ] 2.2 心情录入弹层（`ui:overlay:mood` + `cmd:mood-add(recordId)`）：emoji 档（love/ok/meh/bored/sad）+ note 输入 + 保存/取消
- [ ] 2.3 「读」tab 内容组件（`ui:tab:read`）：心情时间线 + 观后感阅读两区；空态文案
- [ ] 2.4 单测：录入不覆盖（时间线语义）、事件发布、selector join/排序、记录删除后标题快照降级

## 3. plugin-share

- [ ] 3.1 包骨架（id=share，recommended）+ headless `renderShareCard(record, posterDataUrl?) => string`：1080×1350 SVG 模板（海报/色卡 + 标题 + 评分 + 日期 + 观后感摘录 + SxxExx badge），纯函数单测断言标记
- [ ] 3.2 导出端口：桌面 SVG→canvas→PNG 下载；移动 SVG 写缓存文件 → RN Share（取消/失败映射 cancelled/error；SVG 不支持回退文本摘要）
- [ ] 3.3 `cmd:share-poster(recordId)`：取 record → image-cache 解析 poster 转 dataURL（未命中色卡回退，不阻塞）→ renderShareCard → 平台导出；单测 stub 端口

## 4. image-cache 档位扩展

- [ ] 4.1 plugin-tmdb ImageCache：URL 形态分档（poster/backdrop/stills）LRU 计数与容量分配（poster 优先）；`resolve` 签名不变；单测：backdrop 入缓存、分档淘汰不挤占 poster

## 5. 转场与手势（ui-nav / plugin-display）

- [ ] 5.1 ui-nav：tab 切换转场（Animated 淡入+位移，MOTION.base；reduced-motion 瞬时）；移动端 PanResponder 横滑切 tab（|dx|>2|dy| + 60px 阈值）
- [ ] 5.2 plugin-display：卡片图片解析淡入（MOTION.fast，useNativeDriver）+ 详情弹层背景淡入；reduced-motion 降级
- [ ] 5.3 手势/动效判定的纯函数部分（阈值判定、reduced-motion 开关读取注入）单测

## 6. 接线与收尾

- [ ] 6.1 plugin-display 详情视图：「记心情」「分享」入口（`cmd:mood-add`/`cmd:share-poster` 未注册各自隐藏）
- [ ] 6.2 双壳 bootstrap 装配 mood/share（recommended，display 之后）；app package.json + dep-guard 白名单登记
- [ ] 6.3 双端冒烟：记心情→读 tab 时间线出现；分享海报桌面 PNG 下载/移动分享面板；tab 转场与横滑；reduced-motion 降级；卸载 mood/share 后入口消失、read tab 隐藏
- [ ] 6.4 README/CLAUDE.md 能力清单更新
