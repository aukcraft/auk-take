## 1. Spike（风险前置）

- [x] 1.1 桌面端 spike：Vite + RNW + Tauri 版本矩阵（React 18.3 x RNW 0.19 x @vitejs/plugin-react），产出能渲染 RNW `<View>` 的 Tauri 窗口，锁定版本写入 design 附录
- [x] 1.2 移动端 spike：裸 RN 模板 + Metro watchFolders 源码直连 monorepo 包（symlink 解析验证），修改 packages/* 即时生效

## 2. ui-nav 包

- [x] 2.1 `packages/ui-nav` 骨架：package.json（peer 依赖 core）、tsconfig、moduleSuffixes 配置
- [x] 2.2 TabDefinition 数据模型 + 默认四 tab 定义（records/calendar/read/profile，capabilityKey/iconKey/titleKey/order）
- [x] 2.3 导航状态（当前 tab、切换）+ 基于能力注册状态的可见性计算（含 dev 模式未注册警告）
- [x] 2.4 ui-nav 单测：tab 排序、可见性（注册/未注册）、切换状态

## 3. platform-tauri 包

- [x] 3.1 `packages/platform-tauri` 骨架 + fs 适配器注入接口（Tauri fs API 经适配器隔离）
- [x] 3.2 单 JSON 文件 Storage：loadAll/persistAll（临时文件 + rename 原子替换）/delete
- [x] 3.3 契约测试模块抽取（0a InMemoryStorage 断言复用）+ TauriStorage 契约测试（内存 fs）

## 4. platform-rn 包

- [x] 4.1 `packages/platform-rn` 骨架（op-sqlite 依赖声明）
- [x] 4.2 op-sqlite Storage：建表、loadAll/persistAll（事务全量替换）/delete，无 ORM
- [x] 4.3 RnStorage 契约测试（mock op-sqlite 驱动，纯 Node 运行）

## 5. apps/desktop（Tauri + Vite + RNW）

- [x] 5.1 Vite 配置：react-native → react-native-web alias、@vitejs/plugin-react
- [x] 5.2 Tauri 壳工程（tauri.conf、fs plugin 权限）+ 平台指纹顶层判定
- [x] 5.3 引导流程：core 初始化 → 注入 createTauriStorage() → 渲染 AppShell
- [x] 5.4 AppShell 桌面骨架：自绘左侧 Sidebar，TabDefinition 驱动，四个占位 tab 内容

## 6. apps/mobile（裸 RN + Metro）

- [x] 6.1 裸 RN 壳工程（@react-native-community/cli 模板 + monorepo 化）
- [x] 6.2 Metro 配置：watchFolders、symlink 解析、平台扩展名优先级与 moduleSuffixes 一致
- [x] 6.3 引导流程：core 初始化 → 注入 createRnStorage() → 渲染 AppShell
- [x] 6.4 AppShell 移动骨架：自绘底部 TabBar，TabDefinition 驱动，四个占位 tab 内容

## 7. CI 扩展

- [x] 7.1 依赖方向守卫脚本：core/platform-*/ui-nav/apps 的依赖方向校验（复用并扩展 0a 守卫）
- [x] 7.2 CI 接入新包与双壳的 lint/typecheck/test（JS 侧；原生构建不在 CI 范围）
- [x] 7.3 双端 moduleSuffixes 一致性验证纳入 typecheck
