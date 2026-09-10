/**
 * Calendar heatmap pure functions (design D6): day bucketing, 5-level
 * intensity grading, Monday-first year grid, year-range selection.
 * All leap-year / incomplete-week handling lives here, Node-testable.
 */
import type { MovieRecord } from "@auktake/core";
import { heatmapLevel } from "@auktake/ui-contracts";

/** day "YYYY-MM-DD" -> record count. */
export function bucketByDay(
  records: readonly MovieRecord[],
  year?: number,
): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const record of records) {
    const day = record.user.watchedAt.slice(0, 10);
    if (year !== undefined && Number(day.slice(0, 4)) !== year) continue;
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return buckets;
}

export interface DayCell {
  /** "YYYY-MM-DD"; empty string for padding cells. */
  readonly date: string;
  /** Record count on that day. */
  readonly count: number;
  /** 0–4 intensity level (drives the 5-level token colors). */
  readonly level: 0 | 1 | 2 | 3 | 4;
}

export interface YearGrid {
  readonly year: number;
  /** Week columns, Monday first; 52 or 53 columns. */
  readonly weeks: readonly (readonly DayCell[])[];
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year %  400 === 0;
}

function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365;
}

/** 0=Mon..6=Sun (JS getDay: 0=Sun..6=Sat). */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function buildYearGrid(year: number, buckets: Map<string, number>): YearGrid {
  const pad = (n: number) => String(n).padStart(2, "0");
  const weeks: DayCell[][] = [];
  let week: DayCell[] = new Array(mondayIndex(new Date(year, 0, 1))).fill(null).map(() => ({
    date: "",
    count: 0,
    level: 0 as const,
  }));

  for (let dayOfYear = 1; dayOfYear <= daysInYear(year); dayOfYear++) {
    const date = new Date(year, 0, dayOfYear);
    const key = `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const count = buckets.get(key) ?? 0;
    week.push({ date: key, count, level: heatmapLevel(count) });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    // trailing incomplete week padded to 7 rows
    while (week.length < 7) week.push({ date: "", count: 0, level: 0 });
    weeks.push(week);
  }
  return { year, weeks };
}

/** Selectable years: earliest watchedAt year..currentYear; empty → only current. */
export function yearRange(
  records: readonly MovieRecord[],
  currentYear: number,
): number[] {
  let min = currentYear;
  for (const record of records) {
    const year = Number(record.user.watchedAt.slice(0, 4));
    if (Number.isFinite(year) && year > 0 && year < min) min = year;
  }
  const years: number[] = [];
  for (let y = min; y <= currentYear; y++) years.push(y);
  return years;
}

/** Records on a given day, newest first (panel content). */
export function recordsOnDay(
  records: readonly MovieRecord[],
  day: string,
): MovieRecord[] {
  return records
    .filter((r) => r.user.watchedAt.slice(0, 10) === day)
    .sort(
      (a, b) =>
        b.user.watchedAt.localeCompare(a.user.watchedAt) || b.id.localeCompare(a.id),
    );
}
