# 平台限制收敛：CORS / 权限 / 明文网络

## 原则

每端独有限制收敛为**显式命名的机制**（一个常量、一个模块、一段配置），不散落 `if`。

## CORS（web 端独有）

三层环境，各自明确路径：

| 环境 | 判据 | 策略 |
|---|---|---|
| 桌面壳（WebView 直连） | `'__TAURI_INTERNALS__' in window` | 原样 URL，不受 CORS 限制 |
| 纯浏览器 dev | 非 Tauri 且 hostname 是 localhost/127/192.168.x | 走 dev server 代理前缀（如 `/eagle-proxy/`），模块顶层判定一次 |
| 生产 web（若有） | — | 反向代理/后端转发，前端不感知 |

```ts
const IS_PLAIN_BROWSER_DEV =
  typeof window !== 'undefined' &&
  !('__TAURI_INTERNALS__' in window) &&
  /^(localhost|127\.0\.0\.1|192\.168\.)/.test(window.location?.hostname ?? '');

function bridgeUrl(url: string) {
  if (!IS_PLAIN_BROWSER_DEV || !/^https?:\/\//i.test(url)) return url;
  return '/eagle-proxy/' + url;   // 裸拼接，不 encodeURIComponent
}
```

**陷阱**：代理 URL 保持裸拼接——下游库（如 hls.js）要解析相对 playlist/segment 路径，编码会破坏相对解析。

Vite 代理配置：
```ts
server: { proxy: { '/eagle-proxy': { target: 'http://placeholder', router: req => new URL(req.url.replace('/eagle-proxy/', '')) } } }
```

## 明文网络（局域网 HTTP 流常见）

- Android：`usesCleartextTraffic`（app.json / manifest）
- iOS：`NSAllowsArbitraryLoads`（Info.plist）
- 桌面：WebView 通常默认允许；必要时 CSP 调整
集中开在**壳工程配置**（可见、可审计），禁止业务代码绕。

## 权限/能力差异清单法

为每端维护一份"能力矩阵"（摄像头/存储/推送/后台音频…），缺失能力：
- 功能降级（UI 隐藏入口）而非运行时报错
- 判定收敛到一个 `platformCapabilities` 模块，组件查询而非各写各的 `Platform.OS` 判断
