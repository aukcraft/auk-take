/**
 * Sync metadata: one entry per record, maintained by the sync engine
 * ("sync-meta" collection). Deliberately stored SEPARATELY from
 * MovieRecord so sync bookkeeping never pollutes business data.
 */
export interface SyncMeta {
  readonly id: string;
  readonly schemaVersion: number;
  readonly recordId: string;
  /** Local version vector. */
  readonly version: number;
  /** Content hash of the record payload. */
  readonly checksum: string;
  readonly lastSyncedAt?: string;
  readonly conflict?: "local" | "remote" | null;
}

export const SYNC_META_SCHEMA_VERSION = 1;
