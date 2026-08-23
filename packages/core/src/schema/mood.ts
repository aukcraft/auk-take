/**
 * Mood entry: an independent HISTORY entity, NOT a single-valued field
 * on the record. Revisiting the same record N times yields N entries,
 * forming a mood timeline ("found it average three months ago, cried
 * yesterday"). Owned by the mood plugin ("mood-entries" collection).
 */
export interface MoodEntry {
  readonly id: string;
  readonly schemaVersion: number;
  /** References MovieRecord.id. */
  readonly recordId: string;
  readonly mood: string;
  readonly note?: string;
  readonly createdAt: string;
}

export const MOOD_SCHEMA_VERSION = 1;
