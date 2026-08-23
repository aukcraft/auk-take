---
name: aukcraft-headless-headed-split-skill
description: >-
  行为与视觉分离（headless + headed）的通用方法论：如何把交互系统拆成纯状态机无头层、
  纯渲染纯头层、设计令牌三层，使行为可在纯 Node 测试、视觉跨端一致。当任务涉及设计
  或重构 UI 架构、控制器/状态机抽取、设计令牌体系、"逻辑写进组件里怎么拆"、
  或让同一套业务行为跑在多个渲染端时使用。触发词：无头层、headless、行为视觉分离、
  状态机抽取、设计令牌、design tokens、多端一致性、逻辑拆分。
license: MIT
activation: /aukcraft-headless-headed-split-skill
provenance:
  maintainer: Eagle
  version: 1.0.0
  created: 2026-02-14
  source_references:
    - distilled from Eagle monorepo practice (@eagle/headless-ui, @eagle/design-tokens)
metadata:
  author: Eagle
  version: 1.0.0
  created: 2026-02-14
---

# /aukcraft-headless-headed-split-skill

把"行为"与"视觉"拆成正交两层。核心命题：**业务行为不该知道渲染器的存在**。

## 触发

- 设计/重构前端或跨端应用架构
- 组件里塞满数据逻辑、换 UI 框架要重写全部
- 同一业务要跑在多个渲染端（native/web/终端/CLI）
- 建立设计令牌体系保证多端视觉一致

## 方法论四步

### 第 1 步：分三层（职责 + 禁止事项成对出现）

| 层 | 职责 | 禁止 |
|---|---|---|
| 无头层 headless | 状态机控制器：加载/校验/重试/错误转换/派生数据 | import 任何渲染器/DOM/样式 |
| 纯头层 headed | 订阅状态渲染；把用户/播放器等外设事件转发回控制器 | 数据获取、过滤、表单校验等一切业务逻辑 |
| 设计令牌 tokens | 颜色/间距/圆角/字重的唯一事实来源 | 屏幕代码出现手写字面量 |

**每层的禁止事项要写成 lint 可查或 review 可查的规则**——"职责"靠自觉，"禁止"靠检查。

### 第 2 步：控制器形状（可订阅的纯类）

```ts
class XxxController {
  constructor(deps: XxxControllerDeps) {}   // 平台能力经构造函数注入，不 import
  getState(): XxxState;                     // 不可变快照
  subscribe(listener: () => void): () => void;  // 返回退订函数
  // 行为方法：transition 状态机 + 副作用经 deps
}
// 薄桥接：useSyncExternalStore(controller.subscribe, controller.getState)
```

- 状态含**互斥 status**（idle/loading/ready/error）而非散落的布尔——非法状态不可表示
- 派生数据（过滤/分组）是控制器方法或 selector，不进组件
- 组合根函数（如 `createControllers(core)`）负责装配，依赖图集中一处

### 第 3 步：令牌单一事实来源 + 代码生成

一致性**靠构造，不靠纪律**：令牌源文件 → 构建脚本生成各端产物（RN 主题对象 / CSS 变量 / Kotlin 主题……）。两端 import 同一次生成的产物，漂移在构造上不可能。
手写映射 = 允许漂移；生成映射 = 漂移不可表示。

### 第 4 步：用测试验证分离到位

无头层测试**必须在纯 Node（无 jsdom、无渲染器）可跑**——这是分离是否成功的客观判据，不是风格偏好。派生逻辑、状态转换、错误路径全在这里测；纯头层只剩薄渲染，可少量冒烟。

## 常见错误 → 纠正

| 错误 | 纠正 |
|---|---|
| 组件里 filter/计算派生数据 | 进控制器/selector，组件只 map |
| useEffect 里做状态机 | 进控制器方法，effect 只转发事件 |
| 控制器 import react | 只允许 hooks 文件做桥接（useSyncExternalStore） |
| 主题两端手写两份 | tokens 源 + 构建脚本生成双产物 |
| 表单校验写在屏幕 | 校验进 AddFormController；表单结构做成声明式数据（fields 数组），头部泛化渲染 |

## 案例（Eagle headless-ui）

8 个控制器（ChannelList/AddSourceForm/Player/Sources/Health/PlayerControls/WatchProgress/Library），全部纯类 + deps 注入，19+ 用例纯 Node 跑完（无渲染器）。RN 与 web 两个头订阅同一批控制器；表单由 `plugin.formFields` 声明式驱动，设置页对插件种类零感知。

## Gotchas

- 控制器不持渲染相关字段（如 className）；状态是数据不是视图
- 订阅通知要合并批量（下一帧一次），高频进度事件别每帧触发全树
- deps 注入 vs 直接 import 的判据：测试时要不要替换它——要替换的就注入

## 参考文件（按需 Read）

Read `references/controller-shape.md` when you need: 控制器完整代码形状、状态机转换表、组合根装配
Read `references/tokens-pipeline.md` when you need: 令牌源文件结构与多端代码生成方案
Read `references/declarative-forms.md` when you need: 声明式表单（formFields 数据驱动）设计
