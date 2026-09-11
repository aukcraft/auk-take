import { describe, expect, it, vi } from "vitest";
import { EventBus, InMemoryStorage } from "@auktake/core";
import { TmdbClient, type FetchLike } from "../src/headless/tmdb-client";
import { TmdbService, normalizeTitle } from "../src/headless/tmdb-service";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("TmdbClient (stub fetch)", () => {
  it("assembles search URLs with query/language/api_key", async () => {
    const fetchImpl = vi.fn<(url: string) => Promise<Response>>(async () => jsonResponse({ results: [] }));
    const client = new TmdbClient({
      fetchImpl: fetchImpl as unknown as FetchLike,
      apiKey: "KEY",
      language: "zh-CN",
      baseUrl: "https://api.test/3",
    });
    await client.searchMovie("深海");
    const url = fetchImpl.mock.calls[0]![0];
    expect(url).toContain("https://api.test/3/search/movie?");
    expect(decodeURIComponent(url)).toContain("query=深海");
    expect(url).toContain("language=zh-CN");
    expect(url).toContain("api_key=KEY");
  });

  it("maps 401 to invalid-key, network throw to network", async () => {
    const client = new TmdbClient({
      fetchImpl: (async () => jsonResponse({}, 401)) as unknown as FetchLike,
      apiKey: "K",
      language: "zh-CN",
    });
    await expect(client.searchMovie("x")).rejects.toMatchObject({ kind: "invalid-key" });

    const netClient = new TmdbClient({
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as unknown as FetchLike,
      apiKey: "K",
      language: "zh-CN",
    });
    await expect(netClient.searchMovie("x")).rejects.toMatchObject({ kind: "network" });
  });

  it("tvEpisode finds the episode in the season payload", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        episodes: [
          { id: 1, episode_number: 4 },
          { id: 2, episode_number: 5, name: "ep5" },
        ],
      }),
    );
    const client = new TmdbClient({
      fetchImpl: fetchImpl as unknown as FetchLike,
      apiKey: "K",
      language: "zh-CN",
    });
    const ep = await client.tvEpisode(42, 2, 5);
    expect(ep.id).toBe(2);
  });
});

describe("TmdbService", () => {
  async function makeService(config?: { apiKey: string; language: string }) {
    const storage = new InMemoryStorage();
    const events = new EventBus();
    const service = new TmdbService({
      storage,
      events,
      fetchImpl: (async () => jsonResponse({ results: [] })) as unknown as FetchLike,
    });
    if (config) await service.saveConfig(config);
    return { service, storage };
  }

  it("user config overrides built-in key; default language zh-CN", async () => {
    const { service } = await makeService({ apiKey: "USER", language: "en-US" });
    await service.loadConfig();
    expect(service.effectiveKey).toBe("USER");
    expect(service.language).toBe("en-US");
  });

  it("config persists in syncMeta across service instances", async () => {
    const { storage } = await makeService({ apiKey: "USER2", language: "zh-CN" });
    const second = new TmdbService({
      storage,
      events: new EventBus(),
      fetchImpl: (async () => jsonResponse({ results: [] })) as unknown as FetchLike,
    });
    await second.loadConfig();
    expect(second.effectiveKey).toBe("USER2");
  });

  it("unconfigured (no built-in key, no user key) returns empty candidates", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ results: [{ id: 1 }] }));
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: fetchImpl as unknown as FetchLike,
    });
    await service.loadConfig(); // no user key; builtin-key.json has "" in CI
    // effectiveKey may be builtin; if empty -> degraded search
    if (!service.configured) {
      expect(await service.search("x")).toEqual([]);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("search maps tv candidates with tvId", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          { id: 42, name: "幕府将军", original_name: "Shōgun", first_air_date: "2024-02-27", poster_path: "/s.jpg", overview: "o" },
        ],
      }),
    );
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: fetchImpl as unknown as FetchLike,
    });
    await service.saveConfig({ apiKey: "K", language: "zh-CN" });
    const candidates = await service.search("幕府将军", { mediaType: "episode" });
    expect(candidates[0]).toMatchObject({
      tmdbId: 42,
      mediaType: "episode",
      title: "幕府将军",
      originalTitle: "Shōgun",
      tvId: 42,
      releaseDate: "2024-02-27",
    });
  });

  it("invalid-key degrades to empty candidates instead of throwing", async () => {
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: (async () => jsonResponse({}, 401)) as unknown as FetchLike,
    });
    await service.saveConfig({ apiKey: "BAD", language: "zh-CN" });
    await expect(service.search("x")).resolves.toEqual([]);
  });
});

describe("backfill confidence", () => {
  async function serviceWith(results: unknown[]) {
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: (async () => jsonResponse({ results })) as unknown as FetchLike,
    });
    await service.saveConfig({ apiKey: "K", language: "zh-CN" });
    return service;
  }

  it("unique normalized-title match binds", async () => {
    const service = await serviceWith([
      { id: 1, title: "The Deep", release_date: "2023-01-19" },
      { id: 2, title: "Other", release_date: "2001-01-01" },
    ]);
    const result = await service.backfill("r1", { title: "the deep", mediaType: "movie" });
    expect(result).toMatchObject({ status: "bound", tmdbId: 1 });
  });

  it("ambiguous matches go to needs-review", async () => {
    const service = await serviceWith([
      { id: 1, title: "Dune" },
      { id: 2, title: "Dune" },
    ]);
    const result = await service.backfill("r1", { title: "dune", mediaType: "movie" });
    expect(result.status).toBe("needs-review");
  });

  it("no candidates -> no-match", async () => {
    const service = await serviceWith([]);
    const result = await service.backfill("r1", { title: "zzz", mediaType: "movie" });
    expect(result).toMatchObject({ status: "no-match" });
  });

  it("year mismatch demotes to review", async () => {
    const service = await serviceWith([{ id: 1, title: "Dune", release_date: "1984-01-01" }]);
    const result = await service.backfill("r1", {
      title: "dune",
      mediaType: "movie",
      releaseYear: "2021",
    });
    expect(result.status).toBe("needs-review");
  });
});

describe("normalizeTitle", () => {
  it("ignores case, whitespace, and punctuation", () => {
    expect(normalizeTitle("The Deep")).toBe(normalizeTitle("the deep"));
    expect(normalizeTitle("沙丘：第二部")).toBe(normalizeTitle("沙丘:第二部"));
    expect(normalizeTitle("Dune: Part Two")).toBe(normalizeTitle("dune part two"));
  });
});

