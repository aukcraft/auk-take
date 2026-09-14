import { describe, expect, it } from "vitest";
import {
  draftFromRecord,
  emptyDraft,
  isRealCalendarDate,
  parseDraft,
  validateDraft,
} from "../src/headless/validation";

const OK_DATE = "2026-05-20";

function base(overrides: Partial<ReturnType<typeof emptyDraft>> = {}) {
  return { ...emptyDraft(OK_DATE), title: "深海", ...overrides };
}

describe("isRealCalendarDate", () => {
  it("accepts real days and rejects format drift", () => {
    expect(isRealCalendarDate("2026-05-20")).toBe(true);
    expect(isRealCalendarDate("2024-02-29")).toBe(true); // leap year
    expect(isRealCalendarDate("2025-02-29")).toBe(false);
    expect(isRealCalendarDate("2025-02-30")).toBe(false);
    expect(isRealCalendarDate("2025-13-01")).toBe(false);
    expect(isRealCalendarDate("20250501")).toBe(false);
    expect(isRealCalendarDate("2025-05-1")).toBe(false);
    expect(isRealCalendarDate("2025-04-31")).toBe(false);
  });
});

describe("validateDraft matrix", () => {
  it("accepts a minimal valid movie draft", () => {
    expect(validateDraft(base())).toEqual({});
  });

  it("rejects empty/whitespace title", () => {
    const errors = validateDraft(base({ title: "   " }));
    expect(errors.title).toBeDefined();
  });

  it("rejects non-calendar watchedAt", () => {
    expect(validateDraft(base({ watchedAt: "2025-02-30" })).watchedAt).toBeDefined();
  });

  it("rating: range and 0.5 steps", () => {
    expect(validateDraft(base({ rating: "7.3" })).rating).toBeDefined();
    expect(validateDraft(base({ rating: "10.5" })).rating).toBeDefined();
    expect(validateDraft(base({ rating: "-1" })).rating).toBeDefined();
    expect(validateDraft(base({ rating: "abc" })).rating).toBeDefined();
    expect(validateDraft(base({ rating: "" })).rating).toBeUndefined();
    expect(validateDraft(base({ rating: "0" })).rating).toBeUndefined();
    expect(validateDraft(base({ rating: "8.5" })).rating).toBeUndefined();
    expect(validateDraft(base({ rating: "10" })).rating).toBeUndefined();
  });

  it("episode requires season/episode >= 1", () => {
    const episode = base({ mediaType: "episode" });
    expect(validateDraft(episode).seasonNumber).toBeDefined();
    expect(validateDraft(episode).episodeNumber).toBeDefined();
    expect(validateDraft(base({ mediaType: "episode", seasonNumber: "2", episodeNumber: "5" }))).toEqual({});
    expect(validateDraft(base({ mediaType: "episode", seasonNumber: "0", episodeNumber: "1" })).seasonNumber).toBeDefined();
  });

  it("movie forbids season/episode values", () => {
    const errors = validateDraft(base({ seasonNumber: "1" }));
    expect(errors.seasonNumber).toBeDefined();
  });

  it("setField keeps other fields untouched (errors are per-field)", () => {
    const errors = validateDraft(base({ title: "", watchedAt: "nope" }));
    expect(Object.keys(errors).sort()).toEqual(["title", "watchedAt"]);
  });
});

describe("parseDraft", () => {
  it("empty rating parses to 0 (unrated), originalTitle defaults to title", () => {
    const parsed = parseDraft(base());
    expect(parsed.rating).toBe(0);
    expect(parsed.originalTitle).toBe("深海");
    expect(parsed.seasonNumber).toBeUndefined();
  });

  it("episode parses S/E numbers", () => {
    const parsed = parseDraft(base({ mediaType: "episode", seasonNumber: "2", episodeNumber: "5", rating: "9" }));
    expect(parsed.seasonNumber).toBe(2);
    expect(parsed.episodeNumber).toBe(5);
    expect(parsed.rating).toBe(9);
  });

  it("draftFromRecord round-trips fields, rating 0 -> empty input", () => {
    const draft = draftFromRecord({
      id: "r1",
      schemaVersion: 1,
      tmdb: { id: 0, mediaType: "episode", title: "幕府将军", originalTitle: "Shōgun", overview: "", posterPath: "", backdropPath: "", releaseDate: "", genres: [], runtime: 60, seasonNumber: 1, episodeNumber: 3 },
      user: { watchedAt: "2026-03-01", rating: 0, review: "hi", tags: [] },
      source: { type: "manual" },
      mediaCache: {},
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(draft.title).toBe("幕府将军");
    expect(draft.seasonNumber).toBe("1");
    expect(draft.rating).toBe("");
    expect(draft.mediaType).toBe("episode");
  });
});
