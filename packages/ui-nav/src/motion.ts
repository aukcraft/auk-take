/**
 * Phase 5 motion/gesture pure logic (design D5): threshold decisions
 * and neighbour-tab resolution, unit-testable in plain Node. Rendering
 * (Animated/PanResponder) lives in the shells; reduced-motion gating
 * reads AccessibilityInfo at the call site.
 */
import type { TabDefinition, TabId } from "./tabs.js";

/** Swipe-to-switch horizontal displacement threshold (logical px). */
export const SWIPE_THRESHOLD_PX = 60;

/**
 * Horizontal-dominant swipe intent: past the threshold AND clearly
 * horizontal (|dx| > 2|dy|) so vertical scroll never steals it.
 */
export function shouldSwipeSwitch(
  dx: number,
  dy: number,
  threshold: number = SWIPE_THRESHOLD_PX,
): boolean {
  return Math.abs(dx) >= threshold && Math.abs(dx) > 2 * Math.abs(dy);
}

/** Neighbour tab in the swipe direction, undefined at the list edges. */
export function adjacentTabId(
  tabs: readonly TabDefinition[],
  current: TabId,
  direction: 1 | -1,
): TabId | undefined {
  const index = tabs.findIndex((t) => t.id === current);
  const next = tabs[index + direction];
  return next?.id;
}
