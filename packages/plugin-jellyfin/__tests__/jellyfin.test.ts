import { describe, expect, it, vi } from "vitest";
import { COLLECTIONS, EventBus, InMemoryStorage } from "@auktake/core";
import type { MovieRecord } from "@auktake/core";
import { JellyfinClient, authHeader, type JellyfinItem } from "../src/headless/jellyfin-client";
import { jellyfinIdentity, mapItemToRecord, mapItems } from "../src/headless/mapping";
import { JellyfinConfigStore } from "../src/headless/config";
import { syncJellyfin } from "../src/headless/sync";
import { isEncryptedSecret } from "@auktake/ui-contracts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status }) as unknown as Response;
}

function stubHttp(responder: (url: string) => unknown) {
  const impl = async (url: string): Promise<Response> => {
    const body = responder(url);
    return jsonResponse(body) as unknown as Response;
  };
  const mock = vi.fn(impl);
  return mock as unknown as ReturnType<typeof vi.fn> & ((url: string) => Promise<Response>);
}

const NOW = "2026-09-14T00:00:00.000Z";

describe("JellyfinClient", () => {
  it("auth header format", () => {
    expect(authHeader("KEY123")).toEqual({ Authorization: 'MediaBrowser Token="KEY123"' });
  });

  it("requests carry auth header and full query", async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const impl = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push({ url, headers: init?.headers as Record<string, string> });
      return jsonResponse({ ServerName: "srv", Version: "10.9" });
    };
    const client = new JellyfinClient({ http: impl, baseUrl: "http://jf.example/", apiKey: "K" });
    await client.systemInfo();
    expect(calls[0]!.url).toBe("http://jf.example/System/Info");
    expect(calls[0]!.headers?.Authorization).toBe('MediaBrowser Token="K"');
  });

  it("playedItems pages until a short page", async () => {
    let calls = 0;
    const http = stubHttp(() => {
      calls += 1;
      return { Items: Array.from({ length: calls === 1 ? 500 : 3 }, (_, i) => ({ Id: `i${i}` })) };
    });
    const client = new JellyfinClient({ http, baseUrl: "http://jf", apiKey: "K" });
    const items = await client.playedItems("u1");
    expect(items.length).toBe(503);
    expect(calls).toBe(2);
  });
});

const movieItem: JellyfinItem = {
  Id: "m1",
  Name: "Dune: Part Two",
  Type: "Movie",
  ProviderIds: { Tmdb: "693134" },
  Overview: "o",
  Genres: ["Sci-Fi", "Adventure"],
  RuntimeTicks: 178 * 600_000_000, // 178 min
  PremiereDate: "2024-02-27T00:00:00.000Z",
  UserData: { LastPlayedDate: "2026-05-01T20:00:00.000Z", PlayCount: 2, Played: true },
};

const episodeItem: JellyfinItem = {
  Id: "e1",
  Name: "Episode 5",
  SeriesName: "Shōgun",
  Type: "Episode",
  ParentIndexNumber: 1,
  IndexNumber: 5,
  RuntimeTicks: 60 * 600_000_000,
  PremiereDate: "2024-03-05T00:00:00.000Z",
  UserData: { LastPlayedDate: "2026-05-02T21:00:00.000Z", PlayCount: 1, Played: true },
};

describe("mapping", () => {
  it("movie maps with tmdb id, runtime minutes, source identity", () => {
    const r = mapItemToRecord(movieItem, () => "id1", NOW)!;
    expect(r.tmdb.id).toBe(693134);
    expect(r.tmdb.mediaType).toBe("movie");
    expect(r.tmdb.title).toBe("Dune: Part Two");
    expect(r.tmdb.runtime).toBe(178);
    expect(r.tmdb.releaseDate).toBe("2024-02-27");
    expect(r.user.watchedAt).toBe("2026-05-01");
    expect(r.source).toEqual({
      type: "jellyfin",
      jellyfin: { itemId: "m1", playedAt: "2026-05-01", playCount: 2 },
    });
    expect(r.tmdb.genres.map((g) => g.name)).toEqual(["Sci-Fi", "Adventure"]);
  });

  it("episode maps title from series + S/E", () => {
    const r = mapItemToRecord(episodeItem, () => "id2", NOW)!;
    expect(r.tmdb.title).toBe("Shōgun");
    expect(r.tmdb.seasonNumber).toBe(1);
    expect(r.tmdb.episodeNumber).toBe(5);
    expect(r.tmdb.mediaType).toBe("episode");
    expect(r.tmdb.id).toBe(0); // no ProviderIds.Tmdb -> sentinel
  });

  it("items without LastPlayedDate are skipped (null)", () => {
    expect(mapItemToRecord({ ...movieItem, UserData: undefined }, () => "x", NOW)).toBeNull();
    expect(
      mapItemToRecord(
        { ...movieItem, UserData: { LastPlayedDate: undefined } },
        () => "x",
        NOW,
      ),
    ).toBeNull();
  });

  it("identity = itemId@playedAt; non-jellyfin records null", () => {
    const r = mapItemToRecord(movieItem, () => "id1", NOW)!;
    expect(jellyfinIdentity(r)).toBe("m1@2026-05-01");
    expect(jellyfinIdentity({ ...r, source: { type: "manual" } })).toBeNull();
  });
});

describe("JellyfinConfigStore", () => {
  it("round-trips with the apiKey encrypted at rest", async () => {
    const storage = new InMemoryStorage();
    const store = new JellyfinConfigStore(storage, new EventBus());
    await store.save({ baseUrl: "http://jf.example/", apiKey: "SECRET" });
    const rows = await storage.loadAll(COLLECTIONS.syncMeta);
    const stored = rows.find((r) => r.id === "jellyfin-config");
    expect((stored as { apiKey?: string }).apiKey).toMatch(/^v1:/);
    expect(isEncryptedSecret((stored as { apiKey?: string }).apiKey ?? "")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("SECRET");
    const loaded = await store.load();
    expect(loaded).toEqual({ baseUrl: "http://jf.example", apiKey: "SECRET" });
  });

  it("tolerates legacy plaintext apiKey rows", async () => {
    const storage = new InMemoryStorage();
    await storage.persistAll(COLLECTIONS.syncMeta, [
      { id: "jellyfin-config", schemaVersion: 1, baseUrl: "http://jf.example", apiKey: "PLAIN" },
    ]);
    const store = new JellyfinConfigStore(storage, new EventBus());
    const loaded = await store.load();
    expect(loaded).toEqual({ baseUrl: "http://jf.example", apiKey: "PLAIN" });
  });

  it("cursor round-trips and resets when the server URL changes", async () => {
    const storage = new InMemoryStorage();
    const store = new JellyfinConfigStore(storage, new EventBus());
    expect(await store.loadCursor("http://jf")).toBe(0);
    await store.saveCursor("http://jf/", 1500);
    expect(await store.loadCursor("http://jf")).toBe(1500);
    expect(await store.loadCursor("http://other-server")).toBe(0);
  });
});

describe("syncJellyfin", () => {
  async function setup(items: readonly JellyfinItem[], existing: readonly MovieRecord[] = []) {
    const storage = new InMemoryStorage();
    await storage.persistAll(COLLECTIONS.records, [...existing]);
    const http = stubHttp((url) => {
      if (url.endsWith("/Users")) return [{ Id: "u1", Name: "alice" }];
      if (url.includes("/Users/") && url.includes("/Items")) return { Items: items };
      if (url === "http://jf/System/Info") return { ServerName: "srv" };
      return {};
    });
    const client = new JellyfinClient({ http, baseUrl: "http://jf", apiKey: "K" });
    const configStore = new JellyfinConfigStore(storage, new EventBus());
    const apply = vi.fn(async (records: readonly MovieRecord[]) => records.length);
    const progress: { fetched: number; imported: number }[] = [];
    let seq = 0;
    const deps = {
      client,
      storage,
      apply,
      generateId: () => `jf-${++seq}`,
      now: () => NOW,
      cursor: {
        load: () => configStore.loadCursor("http://jf"),
        save: (skip: number) => configStore.saveCursor("http://jf", skip),
      },
      onProgress: (p: { fetched: number; imported: number }) => progress.push(p),
      sleep: async () => {},
    };
    return { deps, apply, storage, configStore, progress };
  }

  it("unconfigured -> explicit error", async () => {
    const { deps } = await setup([]);
    const result = await syncJellyfin(deps, false);
    expect(result).toEqual({ status: "error", message: "未配置 Jellyfin 服务器" });
  });

  it("first sync imports everything via the apply channel", async () => {
    const { deps, apply } = await setup([movieItem, episodeItem]);
    const result = await syncJellyfin(deps, true);
    expect(result).toEqual({ status: "imported", count: 2 });
    expect(apply).toHaveBeenCalledTimes(1);
    const imported = apply.mock.calls[0]![0] as readonly MovieRecord[];
    expect(imported.map((r) => r.source.jellyfin?.itemId).sort()).toEqual(["e1", "m1"]);
  });

  it("re-sync is incremental: existing identities skipped, edits untouched", async () => {
    const existing = mapItems([movieItem], () => "local-1", "2026-06-01T00:00:00.000Z").map(
      (r) => ({ ...r, user: { ...r.user, rating: 9, review: "我的批注" } }),
    );
    const { deps, apply } = await setup([movieItem, episodeItem], existing);
    const result = await syncJellyfin(deps, true);
    expect(result).toEqual({ status: "imported", count: 1 });
    const imported = apply.mock.calls[0]![0] as readonly MovieRecord[];
    expect(imported.map((r) => r.source.jellyfin?.itemId)).toEqual(["e1"]);
  });

  it("all-known -> noop without touching the apply channel", async () => {
    const existing = mapItems([movieItem], () => "local-1", NOW);
    const { deps, apply } = await setup([movieItem], existing);
    expect(await syncJellyfin(deps, true)).toEqual({ status: "noop" });
    expect(apply).not.toHaveBeenCalled();
  });

  it("channel errors surface as {status:'error'}", async () => {
    const { deps } = await setup([movieItem]);
    deps.apply = vi.fn(async () => {
      throw new Error("boom");
    });
    const result = await syncJellyfin(deps, true);
    expect(result).toMatchObject({ status: "error", message: "boom" });
  });
});

describe("syncJellyfin batched walk", () => {
  const makeItems = (n: number, offset = 0): JellyfinItem[] =>
    Array.from({ length: n }, (_, i) => ({
      ...movieItem,
      Id: `m${offset + i}`,
      UserData: {
        LastPlayedDate: `2020-01-01T00:00:${String((offset + i) % 60).padStart(2, "0")}Z`,
        PlayCount: 1,
        Played: true,
      },
    }));

  /** Paged stub honoring Skip/Take; can fail once at a chosen skip. */
  function pagedHttp(all: readonly JellyfinItem[], failAtSkip?: number) {
    const requests: string[] = [];
    const http = vi.fn(async (url: string): Promise<Response> => {
      requests.push(url);
      if (url.endsWith("/Users")) return jsonResponse([{ Id: "u1" }]);
      const u = new URL(url);
      const skip = Number(u.searchParams.get("Skip") ?? 0);
      const take = Number(u.searchParams.get("Take") ?? 500);
      if (failAtSkip !== undefined && skip === failAtSkip) {
        throw new Error("connection reset");
      }
      return jsonResponse({ Items: all.slice(skip, skip + take) });
    });
    return { http: http as unknown as (url: string) => Promise<Response>, requests };
  }

  async function pagedSetup(
    all: readonly JellyfinItem[],
    opts: { failAtSkip?: number; batchSize?: number; existing?: readonly MovieRecord[] } = {},
  ) {
    const storage = new InMemoryStorage();
    await storage.persistAll(COLLECTIONS.records, [...(opts.existing ?? [])]);
    const { http, requests } = pagedHttp(all, opts.failAtSkip);
    const client = new JellyfinClient({ http, baseUrl: "http://jf", apiKey: "K" });
    const configStore = new JellyfinConfigStore(storage, new EventBus());
    const apply = vi.fn(async (records: readonly MovieRecord[]) => records.length);
    const progress: { fetched: number; imported: number }[] = [];
    let seq = 0;
    const deps = {
      client,
      storage,
      apply,
      generateId: () => `jf-${++seq}`,
      now: () => NOW,
      cursor: {
        load: () => configStore.loadCursor("http://jf"),
        save: (skip: number) => configStore.saveCursor("http://jf", skip),
      },
      onProgress: (p: { fetched: number; imported: number }) => progress.push(p),
      sleep: async () => {},
      batchSize: opts.batchSize ?? 1000,
    };
    return { deps, apply, storage, configStore, progress, requests };
  }

  it("commits in batches with progress events and lands the cursor at the end", async () => {
    const { deps, apply, configStore, progress } = await pagedSetup(makeItems(1200), {
      batchSize: 500,
    });
    const result = await syncJellyfin(deps, true);
    expect(result).toEqual({ status: "imported", count: 1200 });
    // 500 + 500 + 200 -> three commits
    expect(apply).toHaveBeenCalledTimes(3);
    expect(apply.mock.calls.map((c) => (c[0] as readonly MovieRecord[]).length)).toEqual([
      500, 500, 200,
    ]);
    expect(progress).toEqual([
      { fetched: 500, imported: 500 },
      { fetched: 1000, imported: 1000 },
      { fetched: 1200, imported: 1200 },
    ]);
    expect(await configStore.loadCursor("http://jf")).toBe(1200);
  });

  it("resumes from the persisted cursor and only fetches the delta", async () => {
    const first = await pagedSetup(makeItems(600));
    expect(await syncJellyfin(first.deps, true)).toEqual({ status: "imported", count: 600 });

    // two new plays append at the tail of the oldest-first listing
    const second = await pagedSetup(makeItems(602), {
      existing: mapItems(makeItems(600), () => "x", NOW),
    });
    await second.configStore.saveCursor("http://jf", 600);
    const result = await syncJellyfin(second.deps, true);
    expect(result).toEqual({ status: "imported", count: 2 });
    const firstItemsRequest = second.requests.find((u) => u.includes("/Items"));
    expect(new URL(firstItemsRequest!).searchParams.get("Skip")).toBe("600");
  });

  it("mid-walk failure keeps committed batches; retry resumes from the cursor", async () => {
    const failing = await pagedSetup(makeItems(1200), { failAtSkip: 500, batchSize: 500 });
    const result = await syncJellyfin(failing.deps, true);
    expect(result.status).toBe("error");
    expect(failing.apply).toHaveBeenCalledTimes(1); // first batch committed
    expect(await failing.configStore.loadCursor("http://jf")).toBe(500);

    const retried = await pagedSetup(makeItems(1200), {
      batchSize: 500,
      existing: mapItems(makeItems(500), () => "x", NOW),
    });
    await retried.configStore.saveCursor("http://jf", 500);
    const result2 = await syncJellyfin(retried.deps, true);
    expect(result2).toEqual({ status: "imported", count: 700 });
    const skips = retried.requests
      .filter((u) => u.includes("/Items"))
      .map((u) => new URL(u).searchParams.get("Skip"));
    expect(skips[0]).toBe("500");
  });
});
