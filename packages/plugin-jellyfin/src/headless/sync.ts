/**
 * Sync orchestration (design D3): config -> fetch -> dedup -> import.
 * All effects injected; pure Node testable.
 */
import { COLLECTIONS, type MovieRecord, type Storage } from "@auktake/core";
import type { JellyfinSyncResult, RecordApplyJellyfinCommand } from "@auktake/ui-contracts";
import type { JellyfinClient, JellyfinItem } from "./jellyfin-client";
import { jellyfinIdentity, mapItems } from "./mapping";

export interface SyncDeps {
  readonly client: JellyfinClient;
  readonly storage: Storage;
  readonly apply: RecordApplyJellyfinCommand;
  readonly generateId: () => string;
  readonly now: () => string;
}

export async function syncJellyfin(
  deps: SyncDeps,
  configured: boolean,
): Promise<JellyfinSyncResult> {
  if (!configured) return { status: "error", message: "未配置 Jellyfin 服务器" };
  try {
    const user = await deps.client.currentUser();
    if (!user) return { status: "error", message: "服务器无可见用户" };
    const items: readonly JellyfinItem[] = await deps.client.playedItems(user.Id);

    const existing = await deps.storage.loadAll<MovieRecord>(COLLECTIONS.records);
    const seen = new Set(
      existing.map(jellyfinIdentity).filter((k): k is string => k !== null),
    );

    const fresh = mapItems(items, deps.generateId, deps.now()).filter(
      (record) => {
        const identity = jellyfinIdentity(record);
        return identity === null || !seen.has(identity);
      },
    );
    if (fresh.length === 0) return { status: "noop" };

    await deps.apply(fresh);
    return { status: "imported", count: fresh.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}
