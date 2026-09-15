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
  type RecordSource,
  type MovieRecord,
  type Storage,
} from "@auktake/core";
import { RECORD_EVENTS, type RecordEventPayload } from "@auktake/ui-contracts";
import type { TmdbSnapshot } from "@auktake/core";
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
      tags: [...draft.tagIds],
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
  const merged = mergeTmdb(
    base,
    record,
    // plain edit (no staged snapshot, no explicit unbind): keep binding
    record.tmdb.id > 0 ? { keep: true } : { keep: false },
  );
  return {
    ...merged,
    // identity fields MUST survive an edit (spec: 编辑保持身份)
    createdAt: record.createdAt,
    // non-manual origins keep their source; manual edits stay manual
    source:
      record.source.type === "manual"
        ? ({ type: "manual" } as RecordSource)
        : record.source,
    mediaCache: record.mediaCache,
    share: record.share,
  };
}

interface TmdbMergeDirective {
  readonly keep: boolean;
  readonly snapshot?: TmdbSnapshot;
  readonly unbind?: boolean;
}

/**
 * TMDB snapshot merge semantics (Phase 2 spec):
 * - staged snapshot (search binding) -> fully replaces sentinel/manual tmdb
 * - keep (bound record, plain edit) -> tmdb survives untouched
 * - unbind -> falls back to manual sentinel values (tmdb.id = 0)
 */
export function mergeTmdb(
  base: MovieRecord,
  previous: Pick<MovieRecord, "tmdb">,
  directive: TmdbMergeDirective,
): MovieRecord {
  if (directive.snapshot) {
    return { ...base, tmdb: directive.snapshot };
  }
  if (directive.keep) {
    return { ...base, tmdb: previous.tmdb };
  }
  return base; // manual (sentinel or explicitly unbound)
}

/** Direct snapshot application for cmd:record-apply-tmdb (backfill). */
export function applyTmdbSnapshotToRecord(
  record: MovieRecord,
  snapshot: TmdbSnapshot,
  timestamp: string,
): MovieRecord {
  return {
    ...record,
    tmdb: snapshot,
    // mediaCache from a previous binding may reference stale art
    mediaCache: {},
    updatedAt: timestamp,
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

  async create(draft: ValidatedDraft, staged?: TmdbSnapshot): Promise<MovieRecord> {
    const records = await this.loadAll();
    const manual = buildManualSnapshot(draft, this.deps.generateId(), this.deps.now());
    const record = staged ? { ...manual, tmdb: staged } : manual;
    await this.deps.storage.persistAll(COLLECTIONS.records, [...records, record]);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.created, { id: record.id });
    return record;
  }

  async update(
    id: string,
    draft: ValidatedDraft,
    tmdbDirective?: TmdbMergeDirective,
  ): Promise<MovieRecord | undefined> {
    const records = await this.loadAll();
    const index = records.findIndex((r) => r.id === id);
    const existing = records[index];
    if (index < 0 || !existing) return undefined;
    const base = buildManualSnapshot(draft, existing.id, this.deps.now());
    const merged = mergeTmdb(base, existing, tmdbDirective ?? { keep: existing.tmdb.id > 0 });
    const updated = {
      ...merged,
      createdAt: existing.createdAt,
      source: existing.source.type === "manual" ? ({ type: "manual" } as RecordSource) : existing.source,
      mediaCache: tmdbDirective?.snapshot ? {} : existing.mediaCache,
      share: existing.share,
    };
    const next = [...records];
    next[index] = updated;
    await this.deps.storage.persistAll(COLLECTIONS.records, next);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.updated, { id });
    return updated;
  }

  /** cmd:record-apply-tmdb: replace ONLY the tmdb snapshot (backfill). */
  async applyTmdb(id: string, snapshot: TmdbSnapshot): Promise<MovieRecord | undefined> {
    const records = await this.loadAll();
    const index = records.findIndex((r) => r.id === id);
    const existing = records[index];
    if (index < 0 || !existing) return undefined;
    const next = [...records];
    next[index] = applyTmdbSnapshotToRecord(existing, snapshot, this.deps.now());
    await this.deps.storage.persistAll(COLLECTIONS.records, next);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.updated, { id });
    return next[index];
  }

  /** Warm mediaCache.poster from the image cache (desktop; fire-and-forget). */
  async warmMediaCache(
    id: string,
    posterPath: string,
    resolve: (url: string) => Promise<string | null>,
  ): Promise<void> {
    const local = await resolve(posterPath);
    if (local === null) return;
    const records = await this.loadAll();
    const index = records.findIndex((r) => r.id === id);
    const existing = records[index];
    if (index < 0 || !existing || existing.mediaCache.poster === local) return;
    const next = [...records];
    next[index] = { ...existing, mediaCache: { ...existing.mediaCache, poster: local } };
    await this.deps.storage.persistAll(COLLECTIONS.records, next);
    this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.updated, { id });
  }

  /**
   * cmd:record-remove-tag: strip a tag id from EVERY record that
   * references it (tag-delete cleanup; edit stays the sole writer).
   * Returns the number of changed records.
   */
  async removeTagFromAll(tagId: string): Promise<number> {
    const records = await this.loadAll();
    let changed = 0;
    const next = records.map((record) => {
      if (!record.user.tags.includes(tagId)) return record;
      changed += 1;
      return {
        ...record,
        user: { ...record.user, tags: record.user.tags.filter((t) => t !== tagId) },
        updatedAt: this.deps.now(),
      };
    });
    if (changed === 0) return 0;
    await this.deps.storage.persistAll(COLLECTIONS.records, next);
    for (const record of next) {
      if (!record.user.tags.includes(tagId) && records.find((r) => r.id === record.id)?.user.tags.includes(tagId)) {
        this.deps.events.emit<RecordEventPayload>(RECORD_EVENTS.updated, { id: record.id });
      }
    }
    return changed;
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
