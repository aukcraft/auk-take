import { describe, expect, it, vi } from "vitest";
import type { MovieRecord } from "@auktake/core";
import { activeFilterCount, debounce, queryRecords } from "../src/query";

function record(overrides: {
  id: string;
  title?: string;
  originalTitle?: string;
  tags?: string[];
  rating?: number;
  mediaType?: "movie" | "episode";
  watchedAt?: string;
}): MovieRecord {
  const mediaType = overrides.mediaType ?? "movie";
  return {
    id: overrides.id,
    schemaVersion: 1,
    tmdb: {
      id: 0,
      mediaType,
      title: overrides.title ?? `t-${overrides.id}`,
      originalTitle: overrides.originalTitle ?? overrides.title ?? `t-${overrides.id}`,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: [],
      runtime: 0,
    },
    user: {
      watchedAt: overrides.watchedAt ?? "2026-05-01",
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
  record({ id: "a", title: "沙丘", originalTitle: "Dune: Part Two", tags: ["sci", "epic"], rating: 8.5, watchedAt: "2026-03-10" }),
  record({ id: "b", title: "深海", originalTitle: "深海 Seven", tags: ["anim"], rating: 0, watchedAt: "2026-05-02" }),
  record({ id: "c", title: "Dune", originalTitle: "Dune", tags: ["sci"], rating: 9, mediaType: "episode", watchedAt: "2026-01-15" }),
];

describe("queryRecords", () => {
  it("empty query returns the SAME array reference (zero copy)", () => {
    const out = queryRecords(DATA, {});
    expect(out).toBe(DATA);
  });

  it("text matches title OR originalTitle, case-insensitive", () => {
    expect(queryRecords(DATA, { text: "dune" }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(queryRecords(DATA, { text: "沙" }).map((r) => r.id)).toEqual(["a"]);
    expect(queryRecords(DATA, { text: "海" }).map((r) => r.id)).toEqual(["b"]);
    expect(queryRecords(DATA, { text: "seven" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("tagIds are AND semantics", () => {
    expect(queryRecords(DATA, { tagIds: ["sci"] }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(queryRecords(DATA, { tagIds: ["sci", "epic"] }).map((r) => r.id)).toEqual(["a"]);
    expect(queryRecords(DATA, { tagIds: ["sci", "anim"] })).toEqual([]);
  });

  it("rating range is inclusive; unrated (0) matches when range includes 0", () => {
    expect(queryRecords(DATA, { ratingRange: { min: 8, max: 10 } }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(queryRecords(DATA, { ratingRange: { min: 0, max: 5 } }).map((r) => r.id)).toEqual(["b"]);
  });

  it("mediaType is exact", () => {
    expect(queryRecords(DATA, { mediaType: "episode" }).map((r) => r.id)).toEqual(["c"]);
  });

  it("dateRange is an inclusive ISO string range", () => {
    expect(queryRecords(DATA, { dateRange: { from: "2026-02-01", to: "2026-05-31" } }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("combines all dimensions conjunctively", () => {
    expect(
      queryRecords(DATA, { text: "dune", tagIds: ["epic"], ratingRange: { min: 8, max: 9 } }).map((r) => r.id),
    ).toEqual(["a"]);
  });
});

describe("activeFilterCount", () => {
  it("counts active dimensions", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ text: "x" })).toBe(1);
    expect(activeFilterCount({ text: "x", tagIds: ["a"], mediaType: "movie" })).toBe(3);
    expect(activeFilterCount({ ratingRange: { min: 0, max: 10 }, dateRange: { from: "a", to: "b" } })).toBe(2);
  });
});

describe("debounce", () => {
  it("collapses bursts into one trailing call (injectable timer)", () => {
    const fn = vi.fn();
    let slot: (() => void) | null = null;
    const run = () => {
      const cb = slot;
      slot = null;
      cb?.();
    };
    const d = debounce(fn, 300, (cb) => {
      slot = cb;
      return () => {
        if (slot === cb) slot = null;
      };
    });
    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();
    run();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });
});
