/**
 * Storage port: whole-collection in-memory model.
 *
 * ARCHITECTURAL DECISION (see design.md D4): the interface deliberately
 * exposes only collection-level loadAll/persistAll/delete. There are no
 * predicate queries and no indexes; filtering and statistics happen in
 * plugin memory. This is a deliberate trade-off for a personal journal
 * (~thousands of records) favoring identical, simple implementations on
 * both platforms. If indexing is ever needed, that is a breaking change
 * requiring a migration path (schemaVersion is reserved for this).
 */

/** Persistent, stable collection names (kebab-case plural). */
export const COLLECTIONS = {
  records: "records",
  tags: "tags",
  moodEntries: "mood-entries",
  syncMeta: "sync-meta",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Any entity stored via this port must carry an id and schemaVersion. */
export interface StoredEntity {
  readonly id: string;
  readonly schemaVersion: number;
}

export interface Storage {
  /** Load every entity of a collection. Empty array if none. */
  loadAll<T extends StoredEntity>(collection: CollectionName): Promise<T[]>;

  /** Replace the entire content of a collection with `items`. */
  persistAll<T extends StoredEntity>(
    collection: CollectionName,
    items: T[],
  ): Promise<void>;

  /** Remove the entity with `id` from a collection. Others unchanged. */
  delete(collection: CollectionName, id: string): Promise<void>;
}
