import { describe, expect, it, vi } from "vitest";
import { MemoryFs } from "../src/headless/fs-port";
import { ImageCache, cacheKeyFor, evictPlan, tierForUrl, tieredEvictPlan, type CacheIndexEntry } from "../src/headless/image-cache";
import { listSentinelRecords } from "../src/headless/tmdb-service";

function fetchOk(bytes: Uint8Array) {
  return async (): Promise<Response> => new Response(bytes.buffer as ArrayBuffer, { status: 200 });
}

describe("cacheKeyFor", () => {
  it("same URL -> same key, different URLs -> different keys", () => {
    expect(cacheKeyFor("https://image.tmdb.org/t/p/w500/a.jpg")).toBe(
      cacheKeyFor("https://image.tmdb.org/t/p/w500/a.jpg"),
    );
    expect(cacheKeyFor("https://image.tmdb.org/t/p/w500/a.jpg")).not.toBe(
      cacheKeyFor("https://image.tmdb.org/t/p/w500/b.jpg"),
    );
    expect(cacheKeyFor("x")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("evictPlan", () => {
  it("returns nothing under capacity, oldest-first victims over", () => {
    const entries: CacheIndexEntry[] = [
      { key: "a", size: 60, usedAt: 1 },
      { key: "b", size: 60, usedAt: 2 },
    ];
    expect(evictPlan(entries, 200, 50)).toEqual([]);
    expect(evictPlan(entries, 150, 50)).toEqual(["a"]); // 170-150=20 excess, a frees 60
    expect(evictPlan(entries, 100, 50)).toEqual(["a", "b"]); // excess 70 needs both
  });
});

describe("ImageCache (memory fs)", () => {
  it("downloads on miss, hits cache without network on second call", async () => {
    const fs = new MemoryFs();
    const fetchImpl = vi.fn(fetchOk(new Uint8Array([1, 2, 3])));
    const cache = new ImageCache({ fs, fetchImpl: fetchImpl as never, cacheDir: "/c" });

    const p1 = await cache.resolve("https://x/1.jpg");
    expect(p1).toBe("/c/" + cacheKeyFor("https://x/1.jpg") + ".img");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await cache.resolve("https://x/1.jpg");
    expect(fetchImpl).toHaveBeenCalledTimes(1); // cache hit, no download
  });

  it("write is atomic (no .tmp left behind)", async () => {
    const fs = new MemoryFs();
    const cache = new ImageCache({ fs, fetchImpl: fetchOk(new Uint8Array([9])) as never, cacheDir: "/c" });
    await cache.resolve("https://x/a.jpg");
    expect([...fs.files.keys()].some((p) => p.endsWith(".tmp"))).toBe(false);
    expect(fs.files.has("/c/index.json")).toBe(true);
  });

  it("network failure returns null silently", async () => {
    const cache = new ImageCache({
      fs: new MemoryFs(),
      fetchImpl: (async () => new Response("nope", { status: 404 })) as never,
      cacheDir: "/c",
    });
    expect(await cache.resolve("https://x/missing.jpg")).toBeNull();
  });

  it("corrupt index rebuilds from directory without crashing", async () => {
    const fs = new MemoryFs();
    fs.files.set("/c/index.json", new TextEncoder().encode("{not json"));
    fs.files.set("/c/" + cacheKeyFor("https://x/k.jpg") + ".img", new Uint8Array([7]));
    const fetchImpl = vi.fn(fetchOk(new Uint8Array([8])));
    const cache = new ImageCache({ fs, fetchImpl: fetchImpl as never, cacheDir: "/c" });
    // existing file is kept via rebuild; a NEW url downloads fine
    const p = await cache.resolve("https://x/new.jpg");
    expect(p).toContain("/c/");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("capacity eviction removes oldest files", async () => {
    const fs = new MemoryFs();
    const cache = new ImageCache({
      fs,
      fetchImpl: fetchOk(new Uint8Array([1])) as never,
      cacheDir: "/c",
      capacityBytes: 2,
    });
    await cache.resolve("https://x/1.jpg");
    await cache.resolve("https://x/2.jpg");
    await cache.resolve("https://x/3.jpg");
    const remaining = [...fs.files.keys()].filter((p) => p.endsWith(".img"));
    expect(remaining.length).toBeLessThanOrEqual(2);
  });

  it("clear removes everything", async () => {
    const fs = new MemoryFs();
    const cache = new ImageCache({ fs, fetchImpl: fetchOk(new Uint8Array([1])) as never, cacheDir: "/c" });
    await cache.resolve("https://x/1.jpg");
    await cache.clear();
    expect([...fs.files.keys()].filter((p) => p.endsWith(".img"))).toEqual([]);
  });
});

describe("listSentinelRecords", () => {
  it("selects only tmdb.id === 0 records", () => {
    const ids = listSentinelRecords([
      { id: "a", tmdb: { id: 0 } },
      { id: "b", tmdb: { id: 123 } },
      { id: "c", tmdb: { id: 0 } },
    ]);
    expect(ids).toEqual(["a", "c"]);
  });
});

describe("Phase 5 tiered LRU", () => {
  it("tierForUrl classifies by TMDB size segment", () => {
    expect(tierForUrl("https://image.tmdb.org/t/p/w500/a.jpg")).toBe("poster");
    expect(tierForUrl("https://image.tmdb.org/t/p/w185/b.jpg")).toBe("poster");
    expect(tierForUrl("https://image.tmdb.org/t/p/w780/c.jpg")).toBe("backdrop");
    expect(tierForUrl("https://image.tmdb.org/t/p/original/d.jpg")).toBe("backdrop");
    expect(tierForUrl("https://image.tmdb.org/t/p/w300/e.jpg")).toBe("still");
    expect(tierForUrl("https://other.example/x.jpg")).toBe("poster"); // unknown -> poster lane
  });

  it("a lane evicts within itself — posters never eaten by backdrops", () => {
    const entries: CacheIndexEntry[] = [
      { key: "p-old", size: 60, usedAt: 1, tier: "poster" },
      { key: "p-new", size: 60, usedAt: 2, tier: "poster" },
      { key: "b-old", size: 60, usedAt: 3, tier: "backdrop" },
    ];
    // backdrop lane: 20% of 500 = 100; existing 60 + incoming 60 > 100 -> evict b-old
    const victims = tieredEvictPlan(entries, "backdrop", 60, 500);
    expect(victims).toEqual(["b-old"]);
    // poster lane untouched
    expect(victims).not.toContain("p-old");
  });

  it("legacy index entries without tier land in the poster lane", () => {
    const entries: CacheIndexEntry[] = [{ key: "legacy", size: 100, usedAt: 1 }];
    // poster lane: 70% of 100 = 70; 100 + 1 > 70 -> legacy evicted
    expect(tieredEvictPlan(entries, "poster", 1, 100)).toEqual(["legacy"]);
    expect(tieredEvictPlan(entries, "backdrop", 1, 100)).toEqual([]);
  });

  it("under-share writes evict nothing", () => {
    expect(tieredEvictPlan([], "poster", 10, 500)).toEqual([]);
  });
});
