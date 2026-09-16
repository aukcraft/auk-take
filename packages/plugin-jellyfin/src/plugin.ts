/**
 * plugin-jellyfin factory (design D2–D4): recommended tier. Registers
 * cmd:jellyfin-sync (manual incremental import), cmd:jellyfin-configure,
 * and the config overlay. HTTP via svc:http when available.
 */
import type { AukPlugin, Storage } from "@auktake/core";
import { ulid } from "ulid";
import {
  CAPABILITY_KEYS,
  HTTP_SERVICE,
  JELLYFIN_EVENTS,
  STORAGE_SERVICE,
  type HttpService,
  type JellyfinSyncCommand,
  type PluginRuntimeDeps,
  type TmdbBackfillKnownCommand,
} from "@auktake/ui-contracts";
import { JellyfinClient } from "./headless/jellyfin-client";
import { JellyfinConfigStore } from "./headless/config";
import { syncJellyfin } from "./headless/sync";
import { JellyfinUiStore, createJellyfinOverlay } from "./components/JellyfinOverlay";

const bareFetch: HttpService = (url, init) => fetch(url, init);

export function createJellyfinPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "jellyfin",
    tier: "recommended",
    permissions: ["network:fetch", "storage:read", "storage:write"],

    async connect() {
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>(STORAGE_SERVICE);
      const http = deps.services.get<HttpService>(HTTP_SERVICE) ?? bareFetch;
      if (deps.services.get(HTTP_SERVICE) === undefined && deps.dev) {
        console.warn("[jellyfin] svc:http absent — using bare fetch (no timeout/retry)");
      }

      const configStore = new JellyfinConfigStore(storage, deps.events);
      let config = { baseUrl: "", apiKey: "" };
      void configStore.load().then((loaded) => {
        config = loaded;
      });

      const apply = deps.capabilities.get<(records: readonly import("@auktake/core").MovieRecord[]) => Promise<number>>(
        CAPABILITY_KEYS.recordApplyJellyfin,
      );
      if (apply === undefined && deps.dev) {
        console.warn(
          `[jellyfin] import unavailable: "${CAPABILITY_KEYS.recordApplyJellyfin}" not registered (edit plugin not loaded)`,
        );
      }

      const sync: JellyfinSyncCommand = async () => {
        const client = new JellyfinClient({ http, baseUrl: config.baseUrl, apiKey: config.apiKey });
        const result = await syncJellyfin(
          {
            client,
            storage,
            apply:
              apply ??
              (async () => {
                throw new Error("编辑插件未加载，无法导入");
              }),
            generateId: ulid,
            now: () => new Date().toISOString(),
            cursor: {
              load: () => configStore.loadCursor(config.baseUrl),
              save: (skip) => configStore.saveCursor(config.baseUrl, skip),
            },
            onProgress: (progress) =>
              deps.events.emit(JELLYFIN_EVENTS.syncProgress, progress),
          },
          config.baseUrl.length > 0 && config.apiKey.length > 0,
        );
        // Auto-backfill metadata for imported records with a known tmdb.id
        // (fire-and-forget: the tmdb plugin paces itself and reports via
        // tmdb:backfill-progress; absent capability = degrade silently).
        if (result.status === "imported" && result.count > 0) {
          const backfill = deps.capabilities.get<TmdbBackfillKnownCommand>(
            CAPABILITY_KEYS.tmdbBackfillKnown,
          );
          if (backfill) {
            void backfill().catch((error: unknown) => {
              if (deps.dev) console.warn("[jellyfin] auto-backfill failed", error);
            });
          } else if (deps.dev) {
            console.warn(`[jellyfin] auto-backfill skipped: "${CAPABILITY_KEYS.tmdbBackfillKnown}" not registered`);
          }
        }
        return result;
      };
      deps.capabilities.register(CAPABILITY_KEYS.jellyfinSync, sync);

      const ui = new JellyfinUiStore();
      deps.capabilities.register(CAPABILITY_KEYS.jellyfinConfigure, () => ui.openDialog());
      deps.capabilities.register(
        CAPABILITY_KEYS.overlayJellyfin,
        createJellyfinOverlay(
          ui,
          () => config,
          async (next) => {
            await configStore.save(next);
            config = next;
          },
          async (candidate) => {
            const probe = new JellyfinClient({
              http,
              baseUrl: candidate.baseUrl,
              apiKey: candidate.apiKey,
            });
            return probe.systemInfo();
          },
        ),
      );

      return {
        ui,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.jellyfinSync);
          deps.capabilities.unregister(CAPABILITY_KEYS.jellyfinConfigure);
          deps.capabilities.unregister(CAPABILITY_KEYS.overlayJellyfin);
        },
      };
    },
  };
}
