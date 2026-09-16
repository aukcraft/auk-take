/**
 * Mood store (headless): mood-entries collection sole writer +
 * read-tab selectors. Pure TS; Storage/EventBus injected (design D1/D2).
 */
import {
  COLLECTIONS,
  MOOD_SCHEMA_VERSION,
  type EventBus,
  type MoodEntry,
  type MovieRecord,
  type Storage,
} from "@auktake/core";
import { MOOD_EVENTS, type MoodKind } from "@auktake/ui-contracts";

export class MoodStore {
  constructor(
    private readonly storage: Storage,
    private readonly events: EventBus,
    private readonly generateId: () => string,
    private readonly now: () => string,
  ) {}

  async list(): Promise<readonly MoodEntry[]> {
    return this.storage.loadAll<MoodEntry>(COLLECTIONS.moodEntries);
  }

  /** Append a new entry — history semantics: NEVER overwrites (D1). */
  async add(recordId: string, mood: MoodKind, note?: string): Promise<MoodEntry> {
    const rows = [...(await this.list())];
    const entry: MoodEntry = {
      id: this.generateId(),
      schemaVersion: MOOD_SCHEMA_VERSION,
      recordId,
      mood,
      ...(note && note.trim().length > 0 ? { note: note.trim() } : {}),
      createdAt: this.now(),
    };
    rows.push(entry);
    await this.storage.persistAll(COLLECTIONS.moodEntries, rows);
    this.events.emit(MOOD_EVENTS.created, { id: entry.id });
    return entry;
  }
}

/** One timeline row: a mood entry joined with its record's title. */
export interface MoodTimelineItem {
  readonly entry: MoodEntry;
  /** Record title snapshot at render time; falls back when deleted. */
  readonly title: string;
  /** True when the referenced record no longer exists. */
  readonly recordMissing: boolean;
}

/** Timeline selector: newest first, joined with record titles (D2). */
export function moodTimeline(
  entries: readonly MoodEntry[],
  records: readonly MovieRecord[],
): MoodTimelineItem[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((entry) => {
      const record = byId.get(entry.recordId);
      return {
        entry,
        title: record?.tmdb.title ?? "（已删除的记录）",
        recordMissing: record === undefined,
      };
    });
}

/** Review reading cards: records with a non-empty review, newest first. */
export function reviewCards(records: readonly MovieRecord[]): MovieRecord[] {
  return records
    .filter((r) => r.user.review.trim().length > 0)
    .sort((a, b) => b.user.watchedAt.localeCompare(a.user.watchedAt));
}
