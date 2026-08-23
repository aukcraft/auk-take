import { describe, expect, it, vi } from "vitest";
import {
  EventBus,
  PluginManager,
  type AukPlugin,
  type PluginContext,
  type PluginInstance,
} from "../src/index.js";

/** In-memory ConnectionStore for tests. */
class MemConnectionStore {
  readonly map = new Map<string, unknown>();
  async save(id: string, s: unknown) {
    this.map.set(id, s);
  }
  async load(id: string) {
    return this.map.get(id);
  }
  async remove(id: string) {
    this.map.delete(id);
  }
}

const ctx = (id: string): PluginContext => ({ pluginId: id, events: undefined as never });

function makePlugin(overrides: Partial<AukPlugin> = {}): AukPlugin {
  return {
    id: "test-plugin",
    tier: "optional",
    permissions: [],
    connect: async () => ({ state: { token: "opaque" } }),
    create: (_c, conn) => ({ token: (conn.state as { token: string }).token }),
    ...overrides,
  };
}

describe("PluginManager lifecycle", () => {
  it("connect runs once and persists opaque state", async () => {
    const store = new MemConnectionStore();
    const connect = vi.fn(async () => ({ state: { a: 1 } }));
    const plugin = makePlugin({ connect });
    const mgr = new PluginManager({ connectionStore: store });
    mgr.register(plugin);
    await mgr.connect("test-plugin", ctx("test-plugin"));
    await mgr.connect("test-plugin", ctx("test-plugin")); // second call: no-op
    expect(connect).toHaveBeenCalledTimes(1);
    expect(store.map.get("test-plugin")).toEqual({ a: 1 });
  });

  it("startup rebuilds via create without re-connecting", async () => {
    const store = new MemConnectionStore();
    const connect = vi.fn(async () => ({ state: { token: "t" } }));
    const create = vi.fn(
      (_c, conn): PluginInstance => ({ token: (conn.state as { token: string }).token }),
    );
    const mgr = new PluginManager({ connectionStore: store });
    mgr.register(makePlugin({ connect, create }));
    await mgr.connect("test-plugin", ctx("test-plugin"));
    await mgr.startup("test-plugin", ctx("test-plugin"));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(mgr.instance("test-plugin")).toEqual({ token: "t" });
  });

  it("connect failure is loud (rethrown, plugin not loaded)", async () => {
    const mgr = new PluginManager({ connectionStore: new MemConnectionStore() });
    mgr.register(makePlugin({ connect: async () => { throw new Error("bad credentials"); } }));
    await expect(mgr.connect("test-plugin", ctx("test-plugin"))).rejects.toThrow(
      "bad credentials",
    );
    expect(mgr.instance("test-plugin")).toBeUndefined();
  });

  it("runtime failure in create is isolated and reported", async () => {
    const onError = vi.fn();
    const store = new MemConnectionStore();
    const mgr = new PluginManager({ connectionStore: store, onInstanceError: onError });
    mgr.register(
      makePlugin({
        create: () => {
          throw new Error("boom at runtime");
        },
      }),
    );
    await mgr.connect("test-plugin", ctx("test-plugin"));
    await expect(mgr.startup("test-plugin", ctx("test-plugin"))).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith("test-plugin", expect.any(Error));
  });

  it("refuses to unload a locked plugin", async () => {
    const mgr = new PluginManager({ connectionStore: new MemConnectionStore() });
    mgr.register(makePlugin({ tier: "locked" }));
    await expect(mgr.unload("test-plugin")).rejects.toThrow(/locked/);
    expect(mgr.get("test-plugin")).toBeDefined();
  });

  it("unload disposes instance and removes persisted state", async () => {
    const store = new MemConnectionStore();
    const dispose = vi.fn();
    const mgr = new PluginManager({ connectionStore: store });
    mgr.register(makePlugin({ create: () => ({ dispose }) }));
    await mgr.connect("test-plugin", ctx("test-plugin"));
    await mgr.startup("test-plugin", ctx("test-plugin"));
    await mgr.unload("test-plugin");
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(store.map.has("test-plugin")).toBe(false);
    expect(mgr.get("test-plugin")).toBeUndefined();
  });
});

describe("EventBus", () => {
  it("delivers payloads and isolates listener errors", () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.on("record:created", () => {
      throw new Error("listener explodes");
    });
    bus.on("record:created", good);
    expect(() => bus.emit("record:created", { id: "1" })).not.toThrow();
    expect(good).toHaveBeenCalledWith({ id: "1" });
  });

  it("off stops delivery; unsubscribe token works", () => {
    const bus = new EventBus();
    const h = vi.fn();
    const off = bus.on("sync:completed", h);
    bus.off("sync:completed", h);
    bus.emit("sync:completed", null);
    expect(h).not.toHaveBeenCalled();
    expect(() => off()).not.toThrow(); // double-off via token is a no-op
  });
});
