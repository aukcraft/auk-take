import { describe, expect, it, vi } from "vitest";
import { COLLECTIONS, EventBus, InMemoryStorage } from "@auktake/core";
import { TAG_EVENTS } from "@auktake/ui-contracts";
import { TagStore, normalizeTagName } from "../src/headless/tag-store";

function makeStore() {
  const storage = new InMemoryStorage();
  const events = new EventBus();
  const published: { event: string; id: string }[] = [];
  for (const e of Object.values(TAG_EVENTS)) {
    events.on(e, (p: { id: string }) => published.push({ event: e, id: p.id }));
  }
  let seq = 0;
  const store = new TagStore({
    storage,
    events,
    now: () => "2026-09-14T00:00:00.000Z",
    generateId: () => `tag-${++seq}`,
  });
  const cleanup = vi.fn(async () => 0);
  return { store, storage, published, cleanup };
}

describe("normalizeTagName", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeTagName("  Sci   Fi ")).toBe("sci fi");
    expect(normalizeTagName("科幻")).toBe("科幻");
  });
});

describe("TagStore", () => {
  it("create trims and publishes tag:created", async () => {
    const { store, published } = makeStore();
    const tag = await store.create("  科幻 动画  ");
    expect(tag.name).toBe("科幻 动画");
    expect(published).toEqual([{ event: TAG_EVENTS.created, id: tag.id }]);
  });

  it("rejects duplicates case/space-insensitively", async () => {
    const { store } = makeStore();
    await store.create("Sci Fi");
    await expect(store.create("sci   fi")).rejects.toThrow("已存在");
    await expect(store.create("SCI FI")).rejects.toThrow("已存在");
  });

  it("rejects empty names", async () => {
    const { store } = makeStore();
    await expect(store.create("   ")).rejects.toThrow("不能为空");
  });

  it("list sorts by name", async () => {
    const { store } = makeStore();
    await store.create("动画");
    await store.create("科幻");
    await store.create("纪录");
    const names = (await store.list()).map((t) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")));
  });

  it("rename keeps id, publishes renamed, rejects name collision", async () => {
    const { store, published } = makeStore();
    const a = await store.create("科幻");
    const b = await store.create("动画");
    const renamed = await store.rename(a.id, "Sci-Fi");
    expect(renamed.id).toBe(a.id);
    expect(renamed.name).toBe("Sci-Fi");
    expect(published.at(-1)).toEqual({ event: TAG_EVENTS.renamed, id: a.id });
    await expect(store.rename(b.id, "sci-fi")).rejects.toThrow("已存在");
  });

  it("delete cleans references via the edit channel and removes the tag", async () => {
    const { store, cleanup, storage, published } = makeStore();
    cleanup.mockResolvedValue(3);
    const tag = await store.create("科幻");
    const result = await store.delete(tag.id, cleanup);
    expect(result.removedRecords).toBe(3);
    expect(cleanup).toHaveBeenCalledWith(tag.id);
    expect(await storage.loadAll(COLLECTIONS.tags)).toEqual([]);
    expect(published.at(-1)).toEqual({ event: TAG_EVENTS.deleted, id: tag.id });
  });

  it("delete of unknown id throws without touching anything", async () => {
    const { store, cleanup } = makeStore();
    await expect(store.delete("nope", cleanup)).rejects.toThrow("不存在");
    expect(cleanup).not.toHaveBeenCalled();
  });
});
