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

  notifyChanged(): void {
    this.events.emit("jellyfin:config-changed", {});
  }
}
