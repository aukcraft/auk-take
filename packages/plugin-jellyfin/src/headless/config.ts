/**
 * Jellyfin config store: syncMeta {id:"jellyfin-config"} — baseUrl
 * plaintext (shown in UI), apiKey ENCRYPTED at rest (secret-crypto v1,
 * same channel pattern as the TMDB config). Legacy plaintext tolerated.
 */
import { COLLECTIONS, type EventBus, type Storage } from "@auktake/core";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@auktake/ui-contracts";

export interface JellyfinConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
}

interface StoredConfig {
  readonly id: string;
  readonly schemaVersion: number;
  readonly baseUrl?: string;
  readonly apiKey?: string;
}

const CONFIG_ID = "jellyfin-config";
const CURSOR_ID = "jellyfin-sync-cursor";

interface StoredCursor {
  readonly id: string;
  readonly schemaVersion: number;
  readonly baseUrl?: string;
  readonly skip?: number;
}

export class JellyfinConfigStore {
  constructor(
    private readonly storage: Storage,
    private readonly events: EventBus,
  ) {}

  async load(): Promise<JellyfinConfig> {
    const rows = await this.storage.loadAll<StoredConfig>(COLLECTIONS.syncMeta);
    const stored = rows.find((r) => r.id === CONFIG_ID);
    const key = stored?.apiKey ?? "";
    return {
      baseUrl: (stored?.baseUrl ?? "").replace(/\/+$/, ""),
      apiKey: key && isEncryptedSecret(key) ? decryptSecret(key) : key,
    };
  }

  async save(config: JellyfinConfig): Promise<void> {
    const rows = await this.storage.loadAll<StoredConfig>(COLLECTIONS.syncMeta);
    const next = rows.filter((r) => r.id !== CONFIG_ID);
    next.push({
      id: CONFIG_ID,
      schemaVersion: 1,
      baseUrl: config.baseUrl.replace(/\/+$/, ""),
      apiKey: encryptSecret(config.apiKey),
    });
    await this.storage.persistAll(COLLECTIONS.syncMeta, next);
  }

  /**
   * Batched-sync resume cursor: the skip offset of the oldest-first walk.
   * Bound to baseUrl — pointing at a different server silently resets to 0.
   */
  async loadCursor(baseUrl: string): Promise<number> {
    const rows = await this.storage.loadAll<StoredCursor>(COLLECTIONS.syncMeta);
    const stored = rows.find((r) => r.id === CURSOR_ID);
    if (!stored || stored.baseUrl !== baseUrl.replace(/\/+$/, "")) return 0;
    // schemaVersion 2: v1 cursors were written by the buggy Skip/Take-era
    // walk (and the clamp-to-total healing) and cannot be trusted to mean
    // "everything before this offset is imported" — reset to 0 exactly
    // once; identity dedup makes the rewalk safe.
    if (stored.schemaVersion !== 2) return 0;
    return stored.skip ?? 0;
  }

  async saveCursor(baseUrl: string, skip: number): Promise<void> {
    const rows = await this.storage.loadAll<StoredCursor>(COLLECTIONS.syncMeta);
    const next = rows.filter((r) => r.id !== CURSOR_ID);
    next.push({ id: CURSOR_ID, schemaVersion: 2, baseUrl: baseUrl.replace(/\/+$/, ""), skip });
    await this.storage.persistAll(COLLECTIONS.syncMeta, next);
  }

  notifyChanged(): void {
    this.events.emit("jellyfin:config-changed", {});
  }
}
