/**
 * Sync orchestration (design D3, batched): config -> resume cursor ->
 * oldest-first paged fetch -> per-batch dedup + commit -> progress event.
 * All effects injected; pure Node testable.
 *
 * Batching rationale: large libraries (10k+ played items) hammer the
 * server with dozens of rapid deep-Skip requests in the old all-or-
 * nothing loop, and proxies drop the connection mid-walk. Now each batch
 * (default 1000 fetched items) is committed and the cursor persisted
 * before a short pause, so a failure loses nothing and a retry resumes
 * where it stopped.
 */
import { COLLECTIONS, type MovieRecord, type Storage } from "@auktake/core";
import type {
  JellyfinSyncProgress,
  JellyfinSyncResult,
  RecordApplyJellyfinCommand,
} from "@auktake/ui-contracts";
import type { JellyfinClient } from "./jellyfin-client";
import { jellyfinIdentity, mapItems } from "./mapping";

export interface SyncCursor {
  load(): Promise<number>;
  save(skip: number): Promise<void>;
}

export interface SyncDeps {
  readonly client: JellyfinClient;
  readonly storage: Storage;
  readonly apply: RecordApplyJellyfinCommand;
  readonly generateId: () => string;
  readonly now: () => string;
  /** Resume offset of the oldest-first walk (persisted in syncMeta). */
  readonly cursor: SyncCursor;
  /** Progress callback after each committed batch. */
  readonly onProgress?: (progress: JellyfinSyncProgress) => void;
  /** New records committed per batch (default 1000). */
  readonly batchSize?: number;
  /** Pause between pages in ms (default 300; 0 disables). */
  readonly interPageDelayMs?: number;
  /** Injectable timer for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const PAGE_SIZE = 500;
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const g = globalThis as { setTimeout?: (cb: () => void, ms: number) => unknown };
    if (g.setTimeout && ms > 0) g.setTimeout(resolve, ms);
    else resolve();
  });

export async function syncJellyfin(
  deps: SyncDeps,
  configured: boolean,
): Promise<JellyfinSyncResult> {
  if (!configured) return { status: "error", message: "未配置 Jellyfin 服务器" };
  try {
    const user = await deps.client.currentUser();
    if (!user) return { status: "error", message: "服务器无可见用户" };

    const batchSize = deps.batchSize ?? 1000;
    const delayMs = deps.interPageDelayMs ?? 300;
    const sleep = deps.sleep ?? defaultSleep;

    const existing = await deps.storage.loadAll<MovieRecord>(COLLECTIONS.records);
    const seen = new Set(
      existing.map(jellyfinIdentity).filter((k): k is string => k !== null),
    );

    let skip = await deps.cursor.load();
    const startSkip = skip;
    let fetched = 0;
    let imported = 0;
    let pending: MovieRecord[] = [];

    const flush = async (): Promise<void> => {
      if (pending.length === 0) return;
      await deps.apply(pending);
      imported += pending.length;
      pending = [];
    };

    for (;;) {
      const page = await deps.client.playedItemsPage(user.Id, skip, PAGE_SIZE);
      fetched += page.items.length;
      skip += page.items.length;

      for (const record of mapItems(page.items, deps.generateId, deps.now())) {
        const identity = jellyfinIdentity(record);
        // identity === null: no playedAt — unmappable, skipped by design.
        if (identity === null || seen.has(identity)) continue;
        seen.add(identity);
        pending.push(record);
      }

      // Persist the walk position per page (not just per commit) so a
      // failure on dupe-heavy stretches still resumes forward. Clamp to
      // the server total when known — heals cursors left beyond the end
      // by older buggy runs or by server-side deletions.
      await deps.cursor.save(page.total !== null ? Math.min(skip, page.total) : skip);
      if (pending.length >= batchSize) await flush();
      // Per-page progress: the fetched counter ticks visibly even when a
      // page contributes no new records (dupe-heavy resume stretches).
      // `page` counts pages fetched THIS run (resume starts at page 1).
      const pageNo = Math.ceil((skip - startSkip) / PAGE_SIZE);
      deps.onProgress?.({ page: pageNo, fetched, imported });
      if (page.items.length < PAGE_SIZE) break;
      // Second termination signal: TotalRecordCount. A server that
      // ignores/mishandles StartIndex would otherwise loop forever
      // (this exact bug produced a 3M-offset walk in smoke testing).
      if (page.total !== null && skip >= page.total) break;
      // Pace EVERY page (not just batch commits): rate-limited servers
      // and proxies drop burst walks — this is what killed the original
      // all-at-once loop on large libraries.
      await sleep(delayMs);
    }
    await flush();
    deps.onProgress?.({ page: Math.ceil((skip - startSkip) / PAGE_SIZE), fetched, imported });
    // Walk reached the end: the cursor now sits at the tail, where future
    // plays append — the next run resumes there and only fetches deltas.

    if (imported === 0) return { status: "noop" };
    return { status: "imported", count: imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}
