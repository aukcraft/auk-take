# AukTake

观影记录应用：插件化核心（`packages/core`）+ 双壳（`apps/mobile` 裸 RN / `apps/desktop` Tauri+RNW），业务能力全部由插件经能力注册表供给。

## 插件清单

| 包 | tier | 能力 |
|---|---|---|
| plugin-edit | locked | records 唯一写入方、编辑弹层、删除确认、批量导入/快照合并内部通道 |
| plugin-display | locked | 「记录」tab 海报墙、只读详情、图片三档解析 |
| plugin-record | locked | （记录领域服务） |
| plugin-timeline | locked | 「日历」热力图、时间线视图能力 |
| plugin-tag | locked | 标签 CRUD + 引用清洗 |
| plugin-search | recommended | 搜索/筛选 |
| plugin-stats | recommended | 「我的」统计回顾、Jellyfin 同步与元数据补全入口 |
| plugin-tmdb | recommended | TMDB 搜索绑定/补全、图片缓存（svc:image-cache） |
| plugin-network | locked | svc:http（超时/重试/统一错误） |
| plugin-jellyfin | recommended | Jellyfin 观看历史增量同步（分批游标 + 进度事件） |
| plugin-mood | recommended | 心情录入（mood-entries 时间线）、「读」tab |
| plugin-share | recommended | 分享海报（SVG 生成 → 桌面 PNG 下载 / 移动系统分享） |

## 开发

```bash
export COREPACK_HOME=/tmp/corepack   # 本机 home 只读
pnpm install
pnpm run typecheck && pnpm run lint && pnpm run test
node scripts/dep-guard.cjs           # 依赖方向守卫
```

阶段规划与决策记录在 `openspec/`（`specs/` 为主规格事实源，`changes/archive/` 为已归档变更）。
