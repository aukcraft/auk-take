# 外设（播放器/传感器）双端桥接契约

## 原则

平台外设只出现在 fork 文件里；行为语义在共享控制器。外设头组件只做三件事：

1. **订阅**：`usePlayerController()` 读状态渲染
2. **转发**：外设事件 → 控制器方法（`onProgress/onError/onEnd`）
3. **自绘控件**：不用平台自带 chrome（如 `<video controls>`），保证两端交互一致

## 事件映射表（以视频播放器为例）

| 外设事件（native / web） | 转发到控制器 |
|---|---|
| onProgress / timeupdate | `player.onProgress(currentTime)` |
| onError / error 事件 | `player.onStreamError(detail)` → error 态 + 可重试 |
| 播放结束 / ended | `player.onEnded()` |
| 用户点暂停（自绘按钮） | `controls.togglePlay()` |

## 行为语义住在控制器（示例：LIVE vs VOD）

- 控制器状态携带 `seekable: boolean`（LIVE=false）
- 两端头**必须**据此渲染/隐藏 seek 条——语义不一致在构造上不可能（都读同一状态）
- 判定哪个屏幕（Player vs VodPlayer）是路由/频道元数据职责，不归播放器

## web 端 HLS 处理

```
Hls.isSupported() → MSE 喂 <video>（hls.js）
否则（Safari）→ 原生 HLS：直接 video.src = url
```

## 自绘控件最小集

顶栏（返回 + 标题）、中央播放/暂停、LIVE 徽标、（VOD）seek 条 + ±10s。
图标走双端图标包（如 lucide-react / lucide-react-native），经结构化类型（`ComponentType<IconProps>`）注入，禁止交叉 import 平台图标库。
