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
