import { describe, expect, it } from "vitest";
import type { MoodEntry, MovieRecord, Tag } from "../src/index.js";

const movieRecord = (over: Partial<MovieRecord> = {}): MovieRecord => ({
  id: "01J8Z",
  schemaVersion: 1,
  tmdb: {
    id: 550,
    mediaType: "movie",
    title: "Fight Club",
    originalTitle: "Fight Club",
    overview: "...",
    posterPath: "/abc.jpg",
    backdropPath: "/def.jpg",
    releaseDate: "1999-10-15",
    genres: [{ id: 18, name: "Drama" }],
    runtime: 139,
  },
  user: { watchedAt: "2025-06-01", rating: 8.5, review: "still hits", tags: ["t1"] },
  source: { type: "manual" },
  mediaCache: {},
  createdAt: "2025-06-01T10:00:00Z",
  updatedAt: "2025-06-01T10:00:00Z",
  ...over,
});

describe("MovieRecord schema", () => {
  it("movie records carry no season/episode fields", () => {
    const r = movieRecord();
    expect(r.tmdb.mediaType).toBe("movie");
    expect(r.tmdb.seasonNumber).toBeUndefined();
    expect(r.tmdb.episodeNumber).toBeUndefined();
  });

  it("episode records carry season/episode", () => {
    const r = movieRecord({
      id: "01J90",
      tmdb: {
        ...movieRecord().tmdb,
        mediaType: "episode",
        seasonNumber: 2,
        episodeNumber: 5,
      },
      source: {
        type: "jellyfin",
        jellyfin: { itemId: "jf-1", playedAt: "2025-06-02T20:00:00Z", playCount: 1 },
      },
    });
    expect(r.tmdb.mediaType).toBe("episode");
    expect(r.tmdb.seasonNumber).toBe(2);
    expect(r.source.jellyfin?.itemId).toBe("jf-1");
  });

  it("re-watching creates a distinct record (no merge)", () => {
    const first = movieRecord();
    const second = movieRecord({
      id: "01J91",
      user: { watchedAt: "2025-12-01", rating: 9.5, review: "better on rewatch", tags: [] },
    });
    expect(first.id).not.toBe(second.id);
    expect(second.user.rating).toBe(9.5);
  });

  it("rating 0 encodes unrated, not zero score", () => {
    const r = movieRecord({
      user: { watchedAt: "2025-06-03", rating: 0, review: "", tags: [] },
    });
    expect(r.user.rating).toBe(0);
  });
});

describe("MoodEntry schema", () => {
  it("same record can hold multiple mood entries over time", () => {
    const base = { recordId: "01J8Z", schemaVersion: 1 };
    const a: MoodEntry = { ...base, id: "m1", mood: "calm", createdAt: "2025-06-01T12:00:00Z" };
    const b: MoodEntry = {
      ...base,
      id: "m2",
      mood: "moved",
      note: "second read hit harder",
      createdAt: "2025-09-01T12:00:00Z",
    };
    expect(a.id).not.toBe(b.id);
    expect([a, b]).toHaveLength(2);
  });
});

describe("Tag schema", () => {
  it("tags reference by id and tolerate unknown ids at read time", () => {
    const tags: Tag[] = [{ id: "t1", schemaVersion: 1, name: "rewatch", createdAt: "now" }];
    const recordTagIds = ["t1", "t-ghost"];
    const known = recordTagIds.filter((id) => tags.some((t) => t.id === id));
    expect(known).toEqual(["t1"]);
  });
});
