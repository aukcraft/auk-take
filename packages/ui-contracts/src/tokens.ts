/**
 * Minimal design tokens, shared verbatim by mobile (RN) and desktop
 * (RNW) — both consume the same plain JS objects (spec: "设计令牌双端
 * 同源"). Themed generation is deliberately deferred to Phase 6.
 */

export const colors = {
  bg: "#101014",
  surface: "#1A1A21",
  surfaceElevated: "#23232C",
  text: "#EDEDF2",
  textMuted: "#9A9AA6",
  accent: "#7C6CF0",
  danger: "#E0566B",
  border: "rgba(154,154,166,0.25)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Motion tokens (Phase 5): durations in ms + named easing curves, one JS
 * object consumed by both platforms (ui-nav tab transitions, display
 * fades). Implementations use RN's built-in Animated API; when the
 * platform reports reduced motion, all animation MUST complete
 * instantly regardless of these values.
 */
export const MOTION = {
  duration: { fast: 150, base: 250, slow: 400 },
  /** RN Easing names resolved at the call site (easing module lives in RN). */
  easing: { standard: "easeOut", emphasized: "easeInOut" },
} as const;

export type MotionDuration = keyof typeof MOTION.duration;

/**
 * Poster placeholder palette (8 slots). Each slot pairs a background
 * color with a readable foreground text color (contrast-checked
 * light-on-dark pairs; risk note in design.md accepted).
 */
export interface PaletteSlot {
  readonly bg: string;
  readonly fg: string;
}

export const POSTER_PALETTE: readonly PaletteSlot[] = [
  { bg: "#5B4B8A", fg: "#F2EEFF" },
  { bg: "#2E5E4E", fg: "#E6FFF4" },
  { bg: "#7A3B4F", fg: "#FFEEF2" },
  { bg: "#31567F", fg: "#EAF4FF" },
  { bg: "#7A5A2E", fg: "#FFF6E6" },
  { bg: "#3F5F6E", fg: "#EAF7FF" },
  { bg: "#6E4A5A", fg: "#FDEFF6" },
  { bg: "#44543A", fg: "#F2FFE9" },
];

/** Heatmap intensity levels: 0, 1, 2, 3–4, ≥5 records/day (design D6). */
export const HEATMAP_LEVEL_COLORS: readonly string[] = [
  "#1D1D24", // level 0: no viewing
  "#4C3FA0", // level 1
  "#6A55D0", // level 2
  "#8A74F0", // level 3 (3–4)
  "#B39DFF", // level 4 (≥5)
];

/** Heatmap intensity level for a day's record count (pure function). */
export function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * Deterministic text → palette slot mapping. Callers hash the record
 * TITLE (same movie = same color across rewatches and platforms, spec
 * scenario "占色确定性"); any stable string works. FNV-1a style fold
 * keeps the distribution stable and cheap.
 */
export function colorHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % POSTER_PALETTE.length;
}
