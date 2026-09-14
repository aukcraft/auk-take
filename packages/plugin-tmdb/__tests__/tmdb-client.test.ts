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
      credential: { apiKey: "KEY" },
      language: "zh-CN",
      baseUrl: "https://api.test/3",
    });
    await client.searchMovie("a minecraft movie");
    const url = fetchImpl.mock.calls[0]![0];
    expect(url).toContain("https://api.test/3/search/movie?");
    expect(url).toContain("query=a%20minecraft%20movie"); // %20, never '+'
    expect(url).not.toContain("a+minecraft");
    const zh = new TmdbClient({
      fetchImpl: vi.fn(async () => jsonResponse({ results: [] })) as unknown as FetchLike,
      credential: { apiKey: "KEY" },
      language: "zh-CN",
    });
    await zh.searchMovie("深海");
    expect(decodeURIComponent(zh.buildUrl("/search/movie", { query: "深海" }))).toContain("query=深海");
    expect(url).toContain("language=zh-CN");
    expect(url).toContain("api_key=KEY");
  });

  it("v4 token sends Authorization Bearer and omits api_key query", async () => {
    const fetchImpl = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse({ results: [] }),
    );
    const client = new TmdbClient({
      fetchImpl: fetchImpl as unknown as FetchLike,
      credential: { v4Token: "eyJhbGciOi.v4.TOKEN" },
      language: "zh-CN",
      baseUrl: "https://api.test/3",
    });
    await client.searchMovie("x");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(decodeURIComponent(url)).not.toContain("api_key=");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer eyJhbGciOi.v4.TOKEN",
    );
  });

  it("maps 401 to invalid-key, network throw to network", async () => {
    const client = new TmdbClient({
      fetchImpl: (async () => jsonResponse({}, 401)) as unknown as FetchLike,
      credential: { apiKey: "K" },
      language: "zh-CN",
    });
    await expect(client.searchMovie("x")).rejects.toMatchObject({ kind: "invalid-key" });

    const netClient = new TmdbClient({
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as unknown as FetchLike,
      credential: { apiKey: "K" },
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
      credential: { apiKey: "K" },
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
    expect(service.effectiveCredential).toMatchObject({ apiKey: "USER" });
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

  });

  it("unconfigured (no built-in key, no user key) returns empty candidates", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ results: [{ id: 1 }] }));
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: fetchImpl as unknown as FetchLike,
    });
    await service.loadConfig(); // no user key; builtin-key.json has "" in CI

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

  async function serviceWith(results: unknown[]) {
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: (async () => jsonResponse({ results })) as unknown as FetchLike,
    });
    await service.saveConfig({ apiKey: "K", language: "zh-CN" });
    return service;
  }

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


describe("normalizeConfig", () => {
  it("moves an eyJ v4 token misplaced into the v3 key field", async () => {
    const { normalizeConfig } = await import("../src/headless/tmdb-service");
    const fixed = normalizeConfig({ apiKey: "eyJhbGci.v4", v4Token: "", language: "zh-CN" });
    expect(fixed.apiKey).toBe("");
    expect(fixed.v4Token).toBe("eyJhbGci.v4");
    const kept = normalizeConfig({ apiKey: "v3key123", v4Token: "", language: "zh-CN" });
    expect(kept.apiKey).toBe("v3key123");
  });

  it("invalid-key now THROWS instead of silently returning []", async () => {
    const service = new TmdbService({
      storage: new InMemoryStorage(),
      events: new EventBus(),
      fetchImpl: (async () => jsonResponse({}, 401)) as unknown as FetchLike,
    });
    await service.saveConfig({ apiKey: "BAD", language: "zh-CN" });
    await expect(service.search("x")).rejects.toMatchObject({ kind: "invalid-key" });
  });
});
