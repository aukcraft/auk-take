/**
 * Records collection SOLE WRITE PATH (spec: plugin-edit "records 集合
 * 唯一写入方"): loadAll → mutate → persistAll, then publish the
 * matching record:* event. Storage / EventBus / clock / id generator
 * are all injected — pure Node testable.
 */
import {
  COLLECTIONS,
  RECORD_SCHEMA_VERSION,
  type EventBus,
  type MovieRecord,
  type Storage,
} from "@auktake/core";
import { RECORD_EVENTS, type RecordEventPayload } from "@auktake/ui-contracts";
import type { ValidatedDraft } from "./validation";

export interface RecordsWriterDeps {
  readonly storage: Storage;
  readonly events: EventBus;
  /** ISO timestamp for createdAt/updatedAt. */
  readonly now: () => string;
  /** ULID generator. */
  readonly generateId: () => string;
}

/**
 * Manual-entry snapshot defaults (design D4). `tmdb.id = 0` etc. are
 * SENTINELS meaning "awaiting Phase 2 TMDB completion" — the Phase 2
 * backfill job identifies such records by these values, unambiguously.
 */
export function buildManualSnapshot(
  draft: ValidatedDraft,
  id: string,
  timestamp: string,
): MovieRecord {
  return {
    id,
    schemaVersion: RECORD_SCHEMA_VERSION,
    tmdb: {
      id: 0,
      mediaType: draft.mediaType,
      title: draft.title,
      originalTitle: draft.originalTitle,
      overview: "",
      posterPath: "",
      backdropPath: "",
      releaseDate: "",
      genres: [],
      runtime: 0,
      ...(draft.mediaType === "episode"
        ? { seasonNumber: draft.seasonNumber, episodeNumber: draft.episodeNumber }
        : {}),
    },
    user: {
      watchedAt: draft.watchedAt,
      rating: draft.rating,
      review: draft.review,
      tags: [],
    },
    source: { type: "manual" },
    mediaCache: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Merge an edit into an existing record: id/createdAt preserved. */
export function applyDraftToRecord(
  record: MovieRecord,
  draft: ValidatedDraft,
  timestamp: string,
): MovieRecord {
  const base = buildManualSnapshot(draft, record.id, timestamp);
  return {
    ...base,
    // identity fields MUST survive an edit (spec: 编辑保持身份)
    createdAt: record.createdAt,
    // non-manual origins keep their source; manual edits stay manual
    source: record.source.type === "manual" ? { type: "manual" } : record.source,
    mediaCache: record.mediaCache,
    share: record.share,
  };
}

export class RecordsWriter {
  private readonly deps: RecordsWriterDeps;

  constructor(deps: RecordsWriterDeps) {
    this.deps = deps;
  }

  loadAll(): Promise<MovieRecord[]> {
    return this.deps.storage.loadAll<MovieRecord>(COLLECTIONS.records);
  }

  async get(id: string): Promise<MovieRecord | undefined> {
    return (await this.loadAll()).find((r) => r.id === id);
  }

  async create(draft: ValidatedDraft): Promise<MovieRecord> {
    const records = await this.loadAll();
    const record = buildManualSnapshot(draft, this.deps.generateId(), this.deps.now());
    await this.deps.storage.persistAll(COLLECTIONS.records, [...records, record]);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.created, { id: record.id });
    return record;
  }

  async update(id: string, draft: ValidatedDraft): Promise<MovieRecord | undefined> {
    const records = await this.loadAll();
    const index = records.findIndex((r) => r.id === id);
    const existing = records[index];
    if (index < 0 || !existing) return undefined;
    const updated = applyDraftToRecord(existing, draft, this.deps.now());
    const next = [...records];
    next[index] = updated;
    await this.deps.storage.persistAll(COLLECTIONS.records, next);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.updated, { id });
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const records = await this.loadAll();
    const next = records.filter((r) => r.id !== id);
    if (next.length === records.length) return false;
    await this.deps.storage.persistAll(COLLECTIONS.records, next);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.deleted, { id });
    return true;
  }
}
