import { describe, expect, it } from "vitest";
import type { MovieRecord } from "@auktake/core";
import {
  episodeBadge,
  groupByMonth,
  monthTitle,
  ratingLabel,
} from "../src/headless/selectors";

function record(
  id: string,
  watchedAt: string,
  overrides: {
    rating?: number;
    mediaType?: "movie" | "episode";
    seasonNumber?: number;
    episodeNumber?: number;
  } = {},
): MovieRecord {
  return {
    id,
    schemaVersion: 1,
    tmdb: {
      id: 0,
      mediaType: overrides.mediaType ?? "movie",
      title: `t-${id}`,
      originalTitle: `t-${id}`,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: [],
      runtime: 0,
      ...(overrides.mediaType === "episode"
        ? { seasonNumber: overrides.seasonNumber, episodeNumber: overrides.episodeNumber }
        : {}),
    },
    user: { watchedAt, rating: overrides.rating ?? 0, review: "", tags: [] },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("groupByMonth", () => {
  it("groups by month, groups newest first, in-group newest first", () => {
    const groups = groupByMonth([
      record("a", "2026-03-02"),
      record("b", "2026-05-21"),
      record("c", "2026-05-03"),
      record("d", "2026-03-28"),
    ]);
    expect(groups.map((g) => g.month)).toEqual(["2026-05", "2026-03"]);
    expect(groups[0]?.records.map((r) => r.id)).toEqual(["b", "c"]);
    expect(groups[1]?.records.map((r) => r.id)).toEqual(["d", "a"]);
  });

  it("month titles are zh-CN style", () => {
    expect(monthTitle("2026-05")).toBe("2026年5月");
    expect(monthTitle("2026-11")).toBe("2026年11月");
  });

  it("empty input yields no groups", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("badges and rating summary", () => {
  it("S02E05 badge for episodes only", () => {
    expect(
      episodeBadge(record("e", "2026-01-01", { mediaType: "episode", seasonNumber: 2, episodeNumber: 5 })),
    ).toBe("S02E05");
    expect(episodeBadge(record("m", "2026-01-01"))).toBe("");
  });

  it("rating 0 renders as 未评分", () => {
    expect(ratingLabel(record("u", "2026-01-01"))).toBe("未评分");
    expect(ratingLabel(record("r", "2026-01-01", { rating: 9 }))).toBe("9 分");
  });
});
