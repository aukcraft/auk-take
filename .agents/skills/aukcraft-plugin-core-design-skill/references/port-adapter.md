# Port / 适配器模式设计细节与测试替身

## 设计流程

### 1. 盘点核心需要的能力
典型清单：HTTP（get/post）、时钟（now）、哈希（hash）、持久化（get/set/remove）、日志、随机。
判据：**核心逻辑提到但不想绑定实现的每一个环境能力**。

### 2. 收窄成最小接口
按真实用途定义方法，不照搬平台 API 全集：

```ts
interface Port {
  getText(url, init?): Promise<string>;    // 只要有"拉文本"
  getJson<T>(url, init?): Promise<T>;      // 不需要完整 fetch 的 headers/body 细节
  postJson?<T>(url, body, init?): Promise<T>; // 可选能力——实现方可以不支持
  now(): number;
  hash(input: string): string;
}
```

可选方法（`?`）让不同宿主声明能力差异；插件使用前检查或核心分发时检查。

### 3. 每个宿主一个适配器
- fetch 宿主：`FetchPort`（全局 fetch 收窄 + AbortController 超时）
- 内存/测试：`MemoryPort`（可编程响应队列/映射）
- 桌面壳：如 Tauri 的 plugin-http 包装
适配器放核心包（通用）或宿主壳（平台专属）皆可——判据：是否 import 平台 SDK。

### 4. 测试替身

```ts
class MemoryPort implements Port {
  constructor(private replies: Record<string, unknown>) {}
  now = () => FIXED_TS;        // 固定时钟 → 测 TTL/过期
  hash = (s) => `h(${s})`;     // 确定性哈希 → 测 id 派生
  // getJson/getText 查表返回；未命中抛错（测试要显式声明每个响应）
}
```

**替身能替换一切 = 架构干净**。某个能力做不出替身（如必须真机），说明它漏出了接口抽象。

## SettingsStore 同理

```ts
interface SettingsStore { get<T>(k): Promise<T|undefined>; set<T>(k,v): Promise<void>; remove(k): Promise<void>; }
```
实现：内存（测试）/ AsyncStorage（RN）/ plugin-store（Tauri）/ localStorage（web）。
核心只依赖接口；键名空间由核心分配（如 `sources:` 前缀），避免插件互相覆盖。

## 常见坑

- Port 方法不要返回平台类型（如 Response 对象）——返回 string/JSON，保持宿主无关
- 超时/重试策略放适配器还是核心？默认适配器（宿主网络特性差异大）；核心只定义 init 参数透传
- hash 归 Port 而非 utils：不同宿主有 crypto 差异（web SubtleCrypto / node crypto），注入抹平
