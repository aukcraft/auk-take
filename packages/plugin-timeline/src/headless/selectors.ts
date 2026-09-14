/**
 * Timeline selectors: monthly grouping + in-group descending order,
 * badge and rating-summary derivation. Pure functions (spec:
 * plugin-timeline "时间线分组与排序").
 */
import type { MovieRecord } from "@auktake/core";

export interface TimelineGroup {
  /** "YYYY-MM". */
  readonly month: string;
  /** Group title, e.g. "2026年5月". */
  readonly title: string;
  /** In-group: newest watchedAt first. */
  readonly records: readonly MovieRecord[];
}

const MONTH_TITLES = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
] as const;

export function monthTitle(month: string): string {
  const [year, m] = month.split("-");
  const index = Number(m) - 1;
  const label = MONTH_TITLES[index];
  return `${year}年${label ?? `${m}月`}`;
}

/** Group by watchedAt month, groups newest-first, in-group newest-first. */
export function groupByMonth(records: readonly MovieRecord[]): TimelineGroup[] {
  const buckets = new Map<string, MovieRecord[]>();
  for (const record of records) {
    const month = record.user.watchedAt.slice(0, 7);
    const bucket = buckets.get(month) ?? [];
    bucket.push(record);
    buckets.set(month, bucket);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, items]) => ({
      month,
      title: monthTitle(month),
      records: [...items].sort((a, b) =>
        b.user.watchedAt.localeCompare(a.user.watchedAt) || b.id.localeCompare(a.id),
      ),
    }));
}

/** "S02E05" badge text; empty for movies. */
export function episodeBadge(record: MovieRecord): string {
  if (record.tmdb.mediaType !== "episode") return "";
  const s = String(record.tmdb.seasonNumber ?? 0).padStart(2, "0");
  const e = String(record.tmdb.episodeNumber ?? 0).padStart(2, "0");
  return `S${s}E${e}`;
}

/** rating 0 = unrated, displayed explicitly. */
export function ratingLabel(record: MovieRecord): string {
  return record.user.rating === 0 ? "未评分" : `${record.user.rating} 分`;
}
