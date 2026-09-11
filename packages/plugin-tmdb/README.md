# @auktake/plugin-tmdb

TMDB 元数据插件（Phase 2）：编辑器搜索绑定、存量哨兵补全、海报图片缓存。

## 内置 API Key（不进 git）

`src/builtin-key.json` 已被 .gitignore 忽略，是构建期/运行期读取内置默认
TMDB Key 的通道（Metro 与 Vite 均原生支持 JSON import，双端零配置）：

```bash
cp packages/plugin-tmdb/builtin-key.example.json packages/plugin-tmdb/src/builtin-key.json
# 填入 {"apiKey": "<TMDB API Key v3>"}
```

- `apiKey` 为空串 = 未内置：搜索/补全返回空结果并提示，应用回退 Phase 1 手动形态
- 用户可经 `cmd:tmdb-configure` 配置自定义 Key 覆盖内置值（持久化于
  Storage `sync-meta` 集合 `{id:"tmdb-config"}`——双壳 ConnectionStore 为
  内存实现，connect state 无法跨重启，见 design 附录 A1）

## 图片缓存的平台差异

- 桌面：组合根注册 `fs` 服务（Tauri plugin-fs 二进制端口）+ asset 协议转换，
  `svc:image-cache` 完整本地缓存（LRU + 原子写）
- 移动：无 fs 服务（RN 侧不引原生 fs 模块，裸 RN 壳暂无 android/ios 工程），
  卡片走远端直连 + 系统 HTTP 缓存；接口不变，后续接入原生工程后无结构改动
