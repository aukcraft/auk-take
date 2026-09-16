import { describe, expect, it } from "vitest";
import {
  CAPABILITY_KEYS,
  HEATMAP_LEVEL_COLORS,
  OVERLAY_KEYS,
  POSTER_PALETTE,
  RECORD_EVENT_NAMES,
  RECORD_EVENTS,
  colorHash,
  heatmapLevel,
} from "../src/index";

describe("constants", () => {
  it("capability keys are unique", () => {
    const keys = Object.values(CAPABILITY_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("record event names are unique and cover created/updated/deleted", () => {
    const names = Object.values(RECORD_EVENTS);
    expect(new Set(names).size).toBe(names.length);
    expect([...RECORD_EVENT_NAMES].sort()).toEqual([...names].sort());
  });

  it("capability keys and event names never collide", () => {
    const all = [...Object.values(CAPABILITY_KEYS), ...Object.values(RECORD_EVENTS)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("overlay key list contains exactly the overlay keys", () => {
    expect(OVERLAY_KEYS).toEqual([
      CAPABILITY_KEYS.overlayRoot,
      CAPABILITY_KEYS.overlayRecordDetail,
      CAPABILITY_KEYS.overlayTmdbBackfill,
      CAPABILITY_KEYS.overlayJellyfin,
      CAPABILITY_KEYS.overlayMood,
    ]);
  });
});

describe("design tokens", () => {
  it("poster palette has at least 8 slots with paired fg colors", () => {
    expect(POSTER_PALETTE.length).toBeGreaterThanOrEqual(8);
    for (const slot of POSTER_PALETTE) {
      expect(slot.bg).toMatch(/^#/);
      expect(slot.fg).toMatch(/^#/);
    }
  });

  it("heatmap has exactly 5 level colors (0..4)", () => {
    expect(HEATMAP_LEVEL_COLORS).toHaveLength(5);
  });

  it("colorHash is deterministic and stays within the palette", () => {
    const a = colorHash("01J8GRXQHHMMWZZZ");
    expect(a).toBe(colorHash("01J8GRXQHHMMWZZZ"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(POSTER_PALETTE.length);
    // distribution sanity: 32 distinct ids touch more than one slot
    const slots = new Set(
      Array.from({ length: 32 }, (_, i) => colorHash(`id-${i}`)),
    );
    expect(slots.size).toBeGreaterThan(1);
  });

  it("heatmapLevel thresholds match 0/1/2/3-4/>=5 grading", () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(2)).toBe(2);
    expect(heatmapLevel(3)).toBe(3);
    expect(heatmapLevel(4)).toBe(3);
    expect(heatmapLevel(5)).toBe(4);
    expect(heatmapLevel(99)).toBe(4);
  });
});

describe("phase-2 constants", () => {
  it("new capability keys stay unique across the whole set", () => {
    const keys = Object.values(CAPABILITY_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("overlay list covers all three overlay keys", () => {
    expect(OVERLAY_KEYS).toEqual([
      CAPABILITY_KEYS.overlayRoot,
      CAPABILITY_KEYS.overlayRecordDetail,
      CAPABILITY_KEYS.overlayTmdbBackfill,
      CAPABILITY_KEYS.overlayJellyfin,
      CAPABILITY_KEYS.overlayMood,
    ]);
  });
});

describe("tmdb helpers", () => {
  it("tmdbImageUrl builds CDN urls, null for empty path", async () => {
    const { tmdbImageUrl } = await import("../src/index");
    expect(tmdbImageUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(tmdbImageUrl("/abc.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc.jpg");
    expect(tmdbImageUrl("")).toBeNull();
  });
});

describe("phase-3 constants", () => {
  it("new keys stay unique across the whole set", () => {
    const keys = Object.values(CAPABILITY_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("tag events are unique and distinct from capability keys", async () => {
    const { TAG_EVENTS } = await import("../src/index");
    const names = Object.values(TAG_EVENTS);
    expect(new Set(names).size).toBe(3);
    const all = [...Object.values(CAPABILITY_KEYS), ...names];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("phase-4 constants", () => {
  it("new keys stay unique across the whole set", async () => {
    const keys = Object.values(CAPABILITY_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    const { OVERLAY_KEYS } = await import("../src/index");
    expect(OVERLAY_KEYS).toContain(CAPABILITY_KEYS.overlayJellyfin);
  });

  it("HttpError carries kind/url/status", async () => {
    const { HttpError } = await import("../src/index");
    const e = new HttpError("status", "https://x/y", 401);
    expect([e.kind, e.status, e.url]).toEqual(["status", 401, "https://x/y"]);
  });
});

describe("phase-5 constants", () => {
  it("new keys stay unique across the whole set and mood overlay is hosted", async () => {
    const { CAPABILITY_KEYS, OVERLAY_KEYS, MOOD_EVENTS } = await import("../src/index");
    const keys = Object.values(CAPABILITY_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    expect(OVERLAY_KEYS).toContain(CAPABILITY_KEYS.overlayMood);
    expect(keys).not.toContain(MOOD_EVENTS.created);
    // read tab capability key matches the ui-nav TabDefinition convention
    expect(CAPABILITY_KEYS.tabRead).toBe("ui:tab:read");
  });

  it("motion tokens: three duration tiers + named easings (dual-platform single source)", async () => {
    const { MOTION } = await import("../src/index");
    expect(Object.keys(MOTION.duration).sort()).toEqual(["base", "fast", "slow"]);
    expect(MOTION.duration.fast).toBe(150);
    expect(MOTION.duration.base).toBe(250);
    expect(MOTION.duration.slow).toBe(400);
    expect(MOTION.easing.standard).toBe("easeOut");
  });

  it("mood kinds carry a fixed emoji mapping", async () => {
    const { MOOD_KINDS, MOOD_EMOJI } = await import("../src/index");
    expect(MOOD_KINDS).toEqual(["love", "ok", "meh", "bored", "sad"]);
    for (const kind of MOOD_KINDS) expect(MOOD_EMOJI[kind].length).toBeGreaterThan(0);
  });
});
