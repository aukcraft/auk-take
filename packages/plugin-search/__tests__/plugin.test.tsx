import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  CapabilityRegistry,
  EventBus,
  InMemoryStorage,
  ServiceRegistry,
  type MovieRecord,
} from "@auktake/core";
import { CAPABILITY_KEYS, type SearchCommand } from "@auktake/ui-contracts";
import { vi } from "vitest";

// headless-only test convention: stub the headed toolbar factory
vi.mock("../src/components/SearchToolbar", () => ({
  createSearchToolbar: () => () => null,
}));

import { createSearchPlugin } from "../src/plugin";

function record(id: string, title: string): MovieRecord {
  return {
    id,
    schemaVersion: 1,
    tmdb: { id: 0, mediaType: "movie", title, originalTitle: title, overview: "", posterPath: "", backdropPath: "", releaseDate: "", genres: [], runtime: 0 },
    user: { watchedAt: "2026-05-01", rating: 0, review: "", tags: [] },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("createSearchPlugin", () => {
  it("registers cmd:search + toolbar and disposes cleanly", async () => {
    const storage = new InMemoryStorage();
    await storage.persistAll<MovieRecord>(COLLECTIONS.records, [
      record("a", "沙丘"),
      record("b", "深海"),
    ]);
    const capabilities = new CapabilityRegistry();
    const services = new ServiceRegistry();
    services.register("storage", storage);
    const events = new EventBus();

    const plugin = createSearchPlugin({ events, capabilities, services });
    const ctx = { pluginId: "search", events: {} as never };
    await plugin.connect(ctx);
    plugin.create(ctx, { state: {} });

    const search = capabilities.get<SearchCommand>(CAPABILITY_KEYS.search);
    expect(search).toBeDefined();
    expect(capabilities.has(CAPABILITY_KEYS.searchToolbar)).toBe(true);

    await new Promise((r) => setTimeout(r, 0)); // projection initial load
    const hits = await search!({ text: "沙" });
    expect(hits.map((r) => r.id)).toEqual(["a"]);
    // empty query fast path: engine returns the projection snapshot
    expect((await search!({})).length).toBe(2);
  });
});
