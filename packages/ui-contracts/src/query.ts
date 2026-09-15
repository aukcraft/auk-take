/**
 * Query engine (spec: plugin-search "查询引擎（纯函数）"): all matching
 * semantics live here, fully matrix-testable in plain Node.
 */
import type { MovieRecord } from "@auktake/core";
import type { RecordQuery } from "@auktake/ui-contracts";

function textMatches(record: MovieRecord, text: string): boolean {
  const needle = text.toLowerCase();
  return (
    record.tmdb.title.toLowerCase().includes(needle) ||
    record.tmdb.originalTitle.toLowerCase().includes(needle)
  );
}

function tagsMatch(record: MovieRecord, tagIds: readonly string[]): boolean {
  // AND semantics: the record must reference EVERY selected id.
  return tagIds.every((id) => record.user.tags.includes(id));
}

function ratingMatches(
  record: MovieRecord,
  range: { min: number; max: number },
): boolean {
  return record.user.rating >= range.min && record.user.rating <= range.max;
}

function dateMatches(
  record: MovieRecord,
  range: { from: string; to: string },
): boolean {
  // ISO date strings compare lexicographically = chronologically.
  return record.user.watchedAt >= range.from && record.user.watchedAt <= range.to;
}

/**
 * Run a query. Empty query returns the input array REFERENCE (zero-copy
 * fast path — spec: 空查询返回全集).
 */
export function queryRecords(
  records: readonly MovieRecord[],
  query: RecordQuery,
): readonly MovieRecord[] {
  const hasText = (query.text ?? "").trim().length > 0;
  const hasTags = (query.tagIds ?? []).length > 0;
  const { ratingRange, mediaType, dateRange } = query;
  if (!hasText && !hasTags && !ratingRange && !mediaType && !dateRange) {
    return records;
  }
  const text = (query.text ?? "").trim();
  return records.filter(
    (record) =>
      (!hasText || textMatches(record, text)) &&
      (!hasTags || tagsMatch(record, query.tagIds!)) &&
      (!ratingRange || ratingMatches(record, ratingRange)) &&
      (!mediaType || record.tmdb.mediaType === mediaType) &&
      (!dateRange || dateMatches(record, dateRange)),
  );
}

/** Count of ACTIVE filter dimensions (for the toolbar badge). */
export function activeFilterCount(query: RecordQuery): number {
  let count = 0;
  if ((query.text ?? "").trim().length > 0) count += 1;
  if ((query.tagIds ?? []).length > 0) count += 1;
  if (query.ratingRange) count += 1;
  if (query.mediaType) count += 1;
  if (query.dateRange) count += 1;
  return count;
}

/**
 * 300ms debounce helper with an injectable scheduler (component-
 * testable; no DOM/timer globals referenced at the module level so the
 * ES2022-only lib build stays clean).
 */
type TimerCancel = () => void;
type Scheduler = (cb: () => void) => TimerCancel;

const defaultScheduler: Scheduler = (cb) => {
  const g = globalThis as {
    setTimeout?: (cb: () => void, ms: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
  };
  if (!g.setTimeout || !g.clearTimeout) return () => {};
  const handle = g.setTimeout(cb, 300);
  return () => g.clearTimeout!(handle);
};

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
  schedule: Scheduler = defaultScheduler,
): (...args: A) => void {
  let cancel: (() => void) | null = null;
  return (...args: A) => {
    cancel?.();
    cancel = schedule(() => {
      cancel = null;
      fn(...args);
    });
  };
}
