import { describe, expect, it } from "vitest";
import { COLLECTIONS, EventBus, InMemoryStorage, type MovieRecord } from "@auktake/core";
import { RECORD_EVENTS } from "@auktake/ui-contracts";
import { createCollectionProjection } from "@auktake/ui-contracts";
import {
  episodeBadge,
  ratingLabel,
  releaseYear,
  resolvePosterSource,
  sortByWatchedAtDesc,
} from "../src/headless/selectors";

function record(overrides: Partial<MovieRecord> & { id: string }): MovieRecord {
  return {
    schemaVersion: 1,
    tmdb: {
      id: 0,
      mediaType: "movie",
      title: `t-${overrides.id}`,
      originalTitle: `t-${overrides.id}`,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: [],
      runtime: 0,
    },
    user: { watchedAt: "2026-01-01", rating: 0, review: "", tags: [] },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectors", () => {
  it("sorts by watchedAt descending (newest first)", () => {
    const sorted = sortByWatchedAtDesc([
      record({ id: "a", user: { watchedAt: "2026-01-01", rating: 0, review: "", tags: [] } }),
      record({ id: "b", user: { watchedAt: "2026-05-02", rating: 0, review: "", tags: [] } }),
      record({ id: "c", user: { watchedAt: "2026-03-10", rating: 0, review: "", tags: [] } }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("poster resolution order: mediaCache → posterPath → palette", () => {
    expect(resolvePosterSource(record({ id: "a" })).kind).toBe("palette");
    expect(
      resolvePosterSource(
        record({ id: "b", tmdb: { ...record({ id: "b" }).tmdb, posterPath: "/x.jpg" } }),
      ).kind,
    ).toBe("path");
    expect(
      resolvePosterSource(record({ id: "c", mediaCache: { poster: "cache.png" } })).kind,
    ).toBe("cache");
    // cache wins over posterPath
    expect(
      resolvePosterSource(
        record({
          id: "d",
          mediaCache: { poster: "cache.png" },
          tmdb: { ...record({ id: "d" }).tmdb, posterPath: "/x.jpg" },
        }),
      ).kind,
    ).toBe("cache");
  });

  it("rating 0 renders as 未评分", () => {
    expect(ratingLabel(record({ id: "a" }))).toBe("未评分");
    expect(
      ratingLabel(
        record({ id: "b", user: { watchedAt: "2026-01-01", rating: 8.5, review: "", tags: [] } }),
      ),
    ).toBe("8.5 分");
  });

  it("episode badge and movie absence", () => {
    const ep = record({
      id: "e",
      tmdb: {
        id: 0,
        mediaType: "episode",
        title: "t",
        originalTitle: "t",
        overview: "",
        posterPath: "",
        backdropPath: "",
        releaseDate: "",
        genres: [],
        runtime: 0,
        seasonNumber: 2,
        episodeNumber: 5,
      },
    });
    expect(episodeBadge(ep)).toBe("S02E05");
    expect(episodeBadge(record({ id: "m" }))).toBe("");
  });

  it("releaseYear parses releaseDate, empty when unknown", () => {
    expect(
      releaseYear(
        record({
          id: "y",
          tmdb: { ...record({ id: "y" }).tmdb, releaseDate: "2023-01-19" },
        }),
      ),
    ).toBe("2023");
    expect(releaseYear(record({ id: "n" }))).toBe("");
  });
});

describe("display projection integration", () => {
  it("record:created invalidates and reloads the snapshot", async () => {
    const storage = new InMemoryStorage();
    const events = new EventBus();
    const projection = createCollectionProjection<MovieRecord>({
      storage,
      events,
      collection: COLLECTIONS.records,
      invalidationEvents: Object.values(RECORD_EVENTS),
    });
    await storage.persistAll(COLLECTIONS.records, [record({ id: "new-1" })]);
    events.emit(RECORD_EVENTS.created, { id: "new-1" });
    await Promise.resolve();
    await Promise.resolve();
    expect(projection.getState().map((r) => r.id)).toEqual(["new-1"]);
    projection.dispose();
  });
});
