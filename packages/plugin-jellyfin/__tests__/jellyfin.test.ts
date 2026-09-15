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
    const apply = vi.fn(async (records: readonly MovieRecord[]) => records.length);
    let seq = 0;
    const deps = {
      client,
      storage,
      apply,
      generateId: () => `jf-${++seq}`,
      now: () => NOW,
    };
    return { deps, apply, storage };
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
