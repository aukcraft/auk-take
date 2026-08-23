# 控制器完整形状与状态机设计

## 骨架

```ts
export type XxxStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface XxxState {
  readonly status: XxxStatus;      // 互斥状态，替代散落布尔
  readonly items: readonly Item[]; // 数据只在 ready 有意义
  readonly error?: string;
}

export interface XxxControllerDeps {
  load(): Promise<Item[]>;         // 平台/数据能力全经 deps 注入
  // 可选: debounce, storage, logger…
}

export class XxxController {
  private state: XxxState = { status: 'idle', items: [] };
  private listeners = new Set<() => void>();

  constructor(private deps: XxxControllerDeps) {}

  getState = (): XxxState => this.state;   // 箭头属性：可直接传给 useSyncExternalStore
  subscribe = (l: () => void) => {         // 返回退订函数
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(patch: Partial<XxxState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());      // 简单版每变即通知；高频场景合并到下一帧
  }

  async load() {
    this.set({ status: 'loading', error: undefined });
    try {
      const items = await this.deps.load();
      this.set({ status: 'ready', items });
    } catch (e) {
      this.set({ status: 'error', error: String(e) });  // 错误也是状态
    }
  }

  // 派生选择器：派生数据住这里，不进组件
  visibleItems(query: string): Item[] { /* filter */ }
}
```

## 薄 hooks 桥接（唯一允许 import react 的文件）

```ts
export function useXxx(c: XxxController): XxxState {
  return useSyncExternalStore(c.subscribe, c.getState);
}
```

## 组合根

```ts
export function createControllers(core: Core, deps: PlatformDeps) {
  const channelList = new ChannelListController({ load: () => core.listChannels(), ...deps });
  const player = new PlayerController({ ... });
  return { channelList, player };   // 依赖图装配集中一处，可整体注入测试
}
```

## 状态机转换表（以 Player 为例）

| 当前 | 事件 | 下一 | 副作用 |
|---|---|---|---|
| idle | play(channel) | resolving | 请求流地址 |
| resolving | resolved | playing | 订阅进度 |
| resolving | failed | error | 记录错误 |
| playing | pause | paused | — |
| playing | streamError | error | 可重试 |
| error | retry | resolving | 重新请求 |

设计规则：先画表再写码；非法转换不可表示（类型上收窄 status 联合）。

## 外设事件回传

播放器/传感器等外设产生的事件经控制器公开方法回传：
`controller.onProgress(t)` / `controller.onDeviceError(e)` —— 外设头组件只调用，不解释。
