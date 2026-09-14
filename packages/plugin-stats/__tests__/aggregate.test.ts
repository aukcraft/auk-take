import { describe, expect, it } from "vitest";
import type { MovieRecord } from "@auktake/core";
import { aggregateYear } from "../src/headless/aggregate";

function record(overrides: {
  id: string;
  watchedAt: string;
  rating?: number;
  mediaType?: "movie" | "episode";
  genres?: { id: number; name: string }[];
  tags?: string[];
}): MovieRecord {
  const mediaType = overrides.mediaType ?? "movie";
  return {
    id: overrides.id,
    schemaVersion: 1,
    tmdb: {
      id: 0,
      mediaType,
      title: overrides.id,
      originalTitle: overrides.id,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: overrides.genres ?? [],
      runtime: 0,
    },
    user: {
      watchedAt: overrides.watchedAt,
      rating: overrides.rating ?? 0,
      review: "",
      tags: overrides.tags ?? [],
    },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const DATA = [
  record({ id: "a", watchedAt: "2026-03-10", rating: 8, genres: [{ id: 878, name: "科幻" }], tags: ["t1"] }),
  record({ id: "b", watchedAt: "2026-03-10", rating: 9, mediaType: "episode", genres: [{ id: 878, name: "科幻" }] }),
  record({ id: "c", watchedAt: "2026-05-02", rating: 0 }),
  record({ id: "d", watchedAt: "2025-12-31", rating: 7 }),
];

describe("aggregateYear", () => {
  it("computes overview numbers, avg excludes unrated", () => {
    const stats = aggregateYear(DATA, 2026);
    expect(stats.totalCount).toBe(3);
    expect(stats.movieCount).toBe(2);
    expect(stats.episodeCount).toBe(1);
    expect(stats.avgRating).toBe(8.5); // (8+9)/2, unrated excluded
    expect(stats.ratedCount).toBe(2);
    expect(stats.watchedDays).toBe(2);
  });

  it("monthly counts land in the right buckets", () => {
    const stats = aggregateYear(DATA, 2026);
    expect(stats.monthlyCounts[2]).toBe(2); // March
    expect(stats.monthlyCounts[4]).toBe(1); // May
    expect(stats.monthlyCounts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("topDay ties resolve to the earliest date", () => {
    const tied = [
      record({ id: "x", watchedAt: "2026-05-01" }),
      record({ id: "y", watchedAt: "2026-05-01" }),
      record({ id: "z", watchedAt: "2026-01-01" }),
      record({ id: "w", watchedAt: "2026-01-01" }),
    ];
    expect(aggregateYear(tied, 2026).topDay).toEqual({ date: "2026-01-01", count: 2 });
  });

  it("genres aggregate over TMDB snapshot; manual records contribute nothing", () => {
    const stats = aggregateYear(DATA, 2026);
    expect(stats.genreCounts).toEqual([{ name: "科幻", count: 2 }]);
  });

  it("tag counts resolve names via the tag index", () => {
    const stats = aggregateYear(DATA, 2026, [
      { id: "t1", schemaVersion: 1, name: "神作" },
    ]);
    expect(stats.tagCounts).toEqual([{ id: "t1", name: "神作", count: 1 }]);
  });

  it("empty year yields zeros and null avg without error", () => {
    const stats = aggregateYear(DATA, 2020);
    expect(stats.totalCount).toBe(0);
    expect(stats.avgRating).toBeNull();
    expect(stats.genreCounts).toEqual([]);
    expect(stats.topDay).toBeNull();
  });
});

describe("profile tab registration order (design D5 pin)", () => {
  it("a later registration replaces the shell placeholder (last-write-wins)", async () => {
    const { CapabilityRegistry } = await import("@auktake/core");
    const registry = new CapabilityRegistry();
    registry.register("ui:tab:profile", { kind: "shell-placeholder" });
    registry.register("ui:tab:profile", { kind: "stats-view" }); // plugin create() runs after
    expect(registry.get<{ kind: string }>("ui:tab:profile")?.kind).toBe("stats-view");
  });
});
