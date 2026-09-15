/**
 * Yearly aggregation (spec: plugin-stats "年度聚合（纯函数）").
 * All semantics live here, Node-testable.
 */
import type { MovieRecord } from "@auktake/core";
import type { Tag } from "@auktake/ui-contracts";

export interface YearStats {
  readonly year: number;
  readonly totalCount: number;
  readonly movieCount: number;
  readonly episodeCount: number;
  readonly watchedDays: number;
  /** Mean over rated records only; null when none rated. */
  readonly avgRating: number | null;
  readonly ratedCount: number;
  readonly monthlyCounts: readonly number[]; // length 12
  readonly genreCounts: readonly { readonly name: string; readonly count: number }[];
  readonly tagCounts: readonly { readonly id: string; readonly name: string; readonly count: number }[];
  /** Day with the most viewings; ties -> earliest. null when no records. */
  readonly topDay: { readonly date: string; readonly count: number } | null;
}

export function aggregateYear(
  records: readonly MovieRecord[],
  year: number,
  tags: readonly Tag[] = [],
): YearStats {
  const inYear = records.filter((r) => r.user.watchedAt.slice(0, 4) === String(year));

  const monthly = new Array<number>(12).fill(0);
  const days = new Map<string, number>();
  const genres = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  let ratedSum = 0;
  let ratedCount = 0;
  let movieCount = 0;
  let episodeCount = 0;

  for (const record of inYear) {
    const watchedAt = record.user.watchedAt;
    const month = Number(watchedAt.slice(5, 7));
    if (month >= 1 && month <= 12) monthly[month - 1] = monthly[month - 1]! + 1;
    days.set(watchedAt, (days.get(watchedAt) ?? 0) + 1);

    if (record.user.rating > 0) {
      ratedSum += record.user.rating;
      ratedCount += 1;
    }
    if (record.tmdb.mediaType === "movie") movieCount += 1;
    else episodeCount += 1;

    for (const genre of record.tmdb.genres) {
      genres.set(genre.name, (genres.get(genre.name) ?? 0) + 1);
    }
    for (const tagId of record.user.tags) {
      tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
    }
  }

  let topDay: YearStats["topDay"] = null;
  for (const [date, count] of [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (topDay === null || count > topDay.count) topDay = { date, count };
  }

  const tagIndex = new Map(tags.map((t) => [t.id, t.name] as const));

  return {
    year,
    totalCount: inYear.length,
    movieCount,
    episodeCount,
    watchedDays: days.size,
    avgRating: ratedCount === 0 ? null : Math.round((ratedSum / ratedCount) * 100) / 100,
    ratedCount,
    monthlyCounts: monthly,
    genreCounts: [...genres.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    tagCounts: [...tagCounts.entries()]
      .map(([id, count]) => ({ id, name: tagIndex.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    topDay,
  };
}
