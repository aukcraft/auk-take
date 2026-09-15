## 1. 契约先行（ui-contracts）

- [x] 1.1 Phase 4 key 常量（`HTTP_SERVICE`、`cmd:jellyfin-sync`、`cmd:jellyfin-configure`、`cmd:record-apply-jellyfin`、`ui:overlay:jellyfin`）+ 契约类型（HttpService/HttpError/JellyfinSyncCommand/RecordApplyJellyfinCommand）+ 全局 key 唯一性单测

## 2. plugin-network（svc:http）

- [x] 2.1 包骨架（仅 core + ui-contracts；dep-guard allow-list）
- [x] 2.2 headless `createHttpService`：超时（AbortController/abort 工厂注入）、GET 重试（指数退避、timer 注入）、HttpError 统一（timeout/network/status；4xx 不重试）、dev 日志（无 header/body）
- [x] 2.3 全行为纯 Node 单测：超时中断、5xx 重试成功/耗尽、4xx 直抛、POST 不重试、退避间隔断言
- [x] 2.4 工厂 `createNetworkPlugin`：locked、无 permissions、注册 svc:http、dispose 清理

## 3. plugin-jellyfin headless

- [x] 3.1 包骨架（core + ui-contracts + ulid；recommended tier）
- [x] 3.2 `JellyfinClient`：URL/鉴权头纯函数（MediaBrowser Token）、systemInfo/currentUser/playedItems（Skip/Take 分页拉全量）+ stub 单测（头/query/分页循环）
- [x] 3.3 `mapItemToRecord`：电影/剧集（SeriesName+S/E）/tmdb.id 取 ProviderIds/RTicks→分钟/PremiereDate/LastPlayedDate→watchedAt/playCount + 全矩阵单测；`jellyfinIdentity` 身份键
- [x] 3.4 `JellyfinConfigStore`：syncMeta 加密存取（Key 密文/URL 明文）+ 单测（round-trip、遗留明文兼容）
- [x] 3.5 `syncJellyfin` 编排：未配置报错 → 拉取 → 身份去重 → 经注入通道写入 → 结果汇总 + 单测（首次导入 N / 增量 / 无 playedAt 跳过 / 通道缺失报错）

## 4. plugin-edit 导入通道

- [x] 4.1 `importJellyfin(records)`：source.type 防御校验、批量落盘、逐条 record:created、返回写入数 + 单测（合法写入/非法拒绝不殃及/空数组）

## 5. jellyfin UI 与 tmdb 迁移

- [x] 5.1 配置弹层 overlay（URL/Key 输入、保存即 systemInfo 验证反馈、加密提示；`cmd:jellyfin-configure`）
- [x] 5.2 同步入口（「我的」stats 底部按钮 + loading + 结果反馈：导入 N 条/无新条目/错误明细；未配置提示入口去设置）
- [x] 5.3 plugin-tmdb：fetch 经 svc:http（services.get，缺失回退裸 fetch）；ImageCache 同步切换；既有单测不动（stub 注入路径不变）

## 6. 壳装配与 CI

- [x] 6.1 双壳装配 network（先于消费者）+ jellyfin；OVERLAY_KEYS 增 jellyfin overlay；dep-guard 扩展
- [x] 6.2 全仓 lint/typecheck/test 通过；desktop vite + mobile metro bundle 冒烟
- [ ] 6.3 双端手工冒烟：配置验证 → 首次导入 N 条 → 海报墙/统计即时刷新（record:created）→ 重复同步 noop → 本地编辑不回写 → 卸载降级 → Phase 1–3 回归
