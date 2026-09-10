import { describe, expect, it } from "vitest";
import type { MovieRecord } from "@auktake/core";
import {
  bucketByDay,
  buildYearGrid,
  recordsOnDay,
  yearRange,
} from "../src/headless/heatmap";

function record(id: string, watchedAt: string): MovieRecord {
  return {
    id,
    schemaVersion: 1,
    tmdb: {
      id: 0,
      mediaType: "movie",
      title: `t-${id}`,
      originalTitle: `t-${id}`,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: [],
      runtime: 0,
    },
    user: { watchedAt, rating: 0, review: "", tags: [] },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: watchedAt + "T00:00:00.000Z",
    updatedAt: watchedAt + "T00:00:00.000Z",
  };
}

describe("bucketByDay", () => {
  it("aggregates multiple records on the same day", () => {
    const buckets = bucketByDay([
      record("a", "2026-05-01"),
      record("b", "2026-05-01"),
      record("c", "2026-05-01"),
      record("d", "2026-05-02"),
    ]);
    expect(buckets.get("2026-05-01")).toBe(3);
    expect(buckets.get("2026-05-02")).toBe(1);
  });

  it("filters by year when given", () => {
    const buckets = bucketByDay([record("a", "2025-05-01"), record("b", "2026-05-01")], 2026);
    expect(buckets.has("2025-05-01")).toBe(false);
    expect(buckets.get("2026-05-01")).toBe(1);
  });
});

describe("buildYearGrid", () => {
  it("leap year: Feb 29 lands in the grid, full coverage", () => {
    const buckets = bucketByDay([record("leap", "2024-02-29")]);
    const grid = buildYearGrid(2024, buckets);
    const all = grid.weeks.flat().filter((c) => c.date !== "");
    expect(all).toHaveLength(366);
    const feb29 = all.find((c) => c.date === "2024-02-29");
    expect(feb29?.count).toBe(1);
    expect(feb29?.level).toBe(1);
  });

  it("non-leap year covers 365 days", () => {
    const all = buildYearGrid(2025, new Map()).weeks.flat().filter((c) => c.date !== "");
    expect(all).toHaveLength(365);
    expect(all.some((c) => c.date === "2025-02-29")).toBe(false);
  });

  it("Monday-first columns with padded incomplete first/last weeks", () => {
    // 2026-01-01 is a Thursday -> first week has 3 pad cells (Mon-Wed)
    const grid = buildYearGrid(2026, new Map());
    const first = grid.weeks[0] ?? [];
    expect(first.slice(0, 3).every((c) => c.date === "")).toBe(true);
    expect(first[3]?.date).toBe("2026-01-01");
    // every week column has exactly 7 cells
    for (const week of grid.weeks) expect(week).toHaveLength(7);
  });

  it("intensity grading: 0 / 1 / 2 / 3 / >=5", () => {
    const buckets = new Map<string, number>([
      ["2026-01-01", 1],
      ["2026-01-02", 2],
      ["2026-01-03", 3],
      ["2026-01-04", 4],
      ["2026-01-05", 5],
      ["2026-01-06", 7],
    ]);
    const cells = buildYearGrid(2026, buckets)
      .weeks.flat()
      .filter((c) => (buckets.get(c.date) ?? -1) >= 0 && c.date !== "");
    const byDate = new Map(cells.map((c) => [c.date, c.level] as const));
    expect(byDate.get("2026-01-01")).toBe(1);
    expect(byDate.get("2026-01-02")).toBe(2);
    expect(byDate.get("2026-01-03")).toBe(3);
    expect(byDate.get("2026-01-04")).toBe(3);
    expect(byDate.get("2026-01-05")).toBe(4);
    expect(byDate.get("2026-01-06")).toBe(4);
  });

  it("empty year renders all-zero without error", () => {
    const grid = buildYearGrid(2026, new Map());
    const all = grid.weeks.flat().filter((c) => c.date !== "");
    expect(all).toHaveLength(365);
    expect(all.every((c) => c.level === 0 && c.count === 0)).toBe(true);
  });
});

describe("yearRange", () => {
  it("covers earliest record year..current, defaults to current when empty", () => {
    expect(yearRange([record("a", "2023-03-01"), record("b", "2025-01-01")], 2026)).toEqual([
      2023, 2024, 2025, 2026,
    ]);
    expect(yearRange([], 2026)).toEqual([2026]);
  });

  it("clamps future-dated typos to current year only", () => {
    expect(yearRange([record("f", "2099-01-01")], 2026)).toEqual([2026]);
  });
});

describe("recordsOnDay", () => {
  it("returns only that day's records, newest first", () => {
    const day = recordsOnDay(
      [record("a", "2026-05-01"), record("b", "2026-05-03"), record("c", "2026-05-02")],
      "2026-05-02",
    );
    expect(day.map((r) => r.id)).toEqual(["c"]);
  });
});
