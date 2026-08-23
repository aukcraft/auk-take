---
name: aukcraft-dual-platform-bridge-skill
description: >-
  一套代码跑双端（如 React Native + Web/Tauri 桌面）的通用方法论：共享屏幕集、
  平台文件扩展名分叉、渲染器别名、构建器差异抹平、跨端播放器/外设桥接、CORS 等平台
  差异收敛。当任务涉及让同一 UI/业务跑在多个平台、决定某差异该 fork 文件还是分支判断、
  配置 Metro/Vite 双构建、或处理某端独有限制（CORS/原生模块缺失）时使用。
  触发词：双端、跨端共享、平台扩展、.native/.web、react-native-web、一份代码多端、
  平台差异收敛、桌面+移动。
license: MIT
activation: /aukcraft-dual-platform-bridge-skill
provenance:
  maintainer: Eagle
  version: 1.0.0
  created: 2026-02-14
  source_references:
    - distilled from Eagle monorepo practice (@eagle/ui-screens, rn-app, desktop-app)
metadata:
  author: Eagle
  version: 1.0.0
  created: 2026-02-14
---

# /aukcraft-dual-platform-bridge-skill

让同一套屏幕/业务行为跑在两个平台。核心命题：**差异要收敛到最少的分叉点，其余全部单源**。

## 触发

- 移动端 + 桌面端（或任一两平台）共享 UI/逻辑
- 决定"这个差异该 fork 文件还是 if 分支"
- 双构建器（Metro/Vite 等）模块解析不一致
- 某端独有限制（CORS、原生模块、安全模型）

## 方法论五步

### 第 1 步：共享面最大化（先定"单源集合"）

把系统分成三类：
- **完全共享（单源，改一处双端生效）**：屏幕、样式、导航配置、业务行为（来自 headless 层）、设计令牌
- **平台 fork（文件级分叉）**：仅"渲染元素级"差异——视频标签、图标库、原生模块包装
- **平台分支（同文件内判断）**：布局形状差异——`Platform` + 窗口尺寸分支

**默认一切进单源集合**；拿不准时先单源，出现真实不兼容再降级到 fork。

### 第 2 步：fork 用文件扩展名，不用运行时判断

```
PlayerScreen.tsx        → 不存在（或仅类型）
PlayerScreen.native.tsx → 平台 A 实现
PlayerScreen.web.tsx    → 平台 B 实现
index.ts: export { PlayerScreen } from './PlayerScreen';  // 无扩展名导出
```

- 每个构建器按自己的扩展名优先级解析（Metro：`.native` 优先；Vite：显式配 `.web` 优先）
- **类型检查必须配 moduleSuffixes** 与运行时解析一致，否则类型与实际加载错位
- fork 的两个文件必须**保持相同的外部接口**（props 一样）——fork 的是实现不是契约

### 第 3 步：渲染器别名抹平语法差异

web 端把 `react-native` alias 到 `react-native-web`：共享组件写**纯 RN 语法**，双端各自解析。代价：共享面被限制在 RNW 支持的子集内——不确定的 API 先查兼容表再用（不报错但渲染空是最坑的失败模式）。

### 第 4 步：外设差异用"事件回传"契约隔离

平台专属外设（视频播放器、传感器、文件系统）只出现在 fork 文件里，但只做三件事：
1. 订阅共享控制器状态并渲染
2. 把外设事件（进度/错误/交互）**转发回共享控制器**
3. 自绘平台控件（不用平台自带 chrome，保证两端交互一致）

行为语义（如 LIVE 不可拖动 / VOD 可 seek）定义在控制器状态里，两端头被迫一致。

### 第 5 步：平台限制收敛到明确的"逃生舱"

每端的独有限制收敛为**显式命名**的机制，不散落 if：
- CORS（web 独有）：dev 代理路径（如 `/proxy/`）+ 生产壳直连；判据用环境指纹（如 `'__TAURI_INTERNALS__' in window`）
- 明文网络/权限：壳工程的配置文件里开（集中可见），不在业务代码绕
- 细节陷阱写成注释与测试（如代理 URL 保持裸拼接，因为下游库要解析相对路径）

## 分叉决策表

| 差异类型 | 做法 | 例 |
|---|---|---|
| 渲染元素/原生库不同 | fork 文件（扩展名） | video 标签 ↔ 原生播放器；图标库 |
| 布局形状不同（尺寸/交互范式） | 同文件 Platform/尺寸分支 | 底部 tab ↔ 侧边栏 |
| 行为语义不同 | **禁止在头部分叉**——进共享控制器状态 | 直播↔点播语义 |
| 仅一端存在的功能 | 单独包装模块 + 接口降级 | web 代理、native 传感器 |
| 构建期差异 | 各构建器配置文件 | metro.config / vite.config |

## 常见错误 → 纠正

| 错误 | 纠正 |
|---|---|
| 两端各维护一套屏幕 | 收敛回单源 + 最小 fork |
| fork 文件 props 不一致 | fork 实现不 fork 契约 |
| 满屏 `Platform.OS === 'web'` | 收敛为少数 fork 文件/命名逃生舱 |
| 共享组件用了 RNW 不支持的 API | 查兼容表；必要时把该组件降级为 fork |
| 忘配 moduleSuffixes | 类型解析错位，先查这里 |

## Gotchas

- 双构建器对 monorepo 符号链接/源码直连的处理不同（Metro 需显式 watchFolders + symlink 解析）；让包的入口直接指向 TS 源（package.json 平台字段），**改包无需预构建**
- "一端好的一端坏的"问题，先确认两端解析到的是否同一文件（fork 生效了吗），再查实现
- 平台指纹判断要放模块顶层算一次，不要每次渲染重算

## 参考文件（按需 Read）

Read `references/fork-mechanics.md` when you need: 扩展名解析、moduleSuffixes、双构建器配置细节
Read `references/periphery-contract.md` when you need: 外设（播放器等）事件回传契约与自绘控件模式
Read `references/escape-hatches.md` when you need: CORS/权限/明文网络等平台限制的收敛方案
