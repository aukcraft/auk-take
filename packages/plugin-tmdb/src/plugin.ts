/**
 * plugin-tmdb factory (design D1/D7): recommended tier. Registers the
 * search command, candidate-snapshot resolver, backfill command,
 * config command, the backfill/config overlay, and (when the platform
 * provides an fs port + cache dir) the poster image cache service.
 */
import { COLLECTIONS, type AukPlugin, type MovieRecord, type Storage, type TmdbSnapshot } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  FS_SERVICE,
  HTTP_SERVICE,
  IMAGE_CACHE_SERVICE,
  TMDB_EVENTS,
  type ImageCacheService,
  type PluginRuntimeDeps,
  type TmdbBackfillCommand,
  type TmdbBackfillKnownCommand,
  type TmdbBackfillResult,
  type TmdbCandidate,
  type TmdbCandidateSnapshotCommand,
  type TmdbConfig,
} from "@auktake/ui-contracts";
import { ImageCache } from "./headless/image-cache";
import type { BinaryFsPort } from "./headless/fs-port";
import { TmdbService } from "./headless/tmdb-service";
import { TmdbUiStore } from "./headless/ui-store";
import { createTmdbOverlay } from "./components/TmdbOverlay";

export interface TmdbPluginOptions {
  /** Cache directory for the poster image cache (desktop only). */
  readonly cacheDir?: string;
  /**
   * Convert a local cache file path into a RENDERABLE URI (e.g. the
   * Tauri asset protocol on desktop). Identity when not provided.
   * resolve() returns renderable URIs, so mediaCache.poster values are
   * directly usable by <Image> on every platform.
   */
  readonly toRenderUri?: (path: string) => string;
}

import { defaultFetch } from "./headless/default-fetch";

export function createTmdbPlugin(
  deps: PluginRuntimeDeps,
  options: TmdbPluginOptions = {},
): AukPlugin {
  return {
    id: "tmdb",
    tier: "recommended",
    permissions: ["network:fetch", "storage:read", "storage:write"],

    async connect() {
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>("storage");
      // Phase 4: prefer svc:http (timeout/retry/logging); bare fetch fallback.
      const http = deps.services.get<import("@auktake/ui-contracts").HttpService>(HTTP_SERVICE);
      if (http === undefined && deps.dev) {
        console.warn("[tmdb] svc:http absent — using bare fetch (no timeout/retry)");
      }
      const service = new TmdbService({
        storage,
        events: deps.events,
        fetchImpl: http ?? defaultFetch,
      });
      const ui = new TmdbUiStore();
      void service.loadConfig();

      const keys = [
        CAPABILITY_KEYS.tmdbSearch,
        CAPABILITY_KEYS.tmdbStatus,
        CAPABILITY_KEYS.tmdbCandidateSnapshot,
        CAPABILITY_KEYS.tmdbBackfill,
        CAPABILITY_KEYS.tmdbBackfillKnown,
        CAPABILITY_KEYS.tmdbConfigure,
        CAPABILITY_KEYS.overlayTmdbBackfill,
      ];

      const search = (query: string, options?: { mediaType?: "movie" | "episode" }) =>
        service.search(query, options);
      deps.capabilities.register(CAPABILITY_KEYS.tmdbSearch, search);
      deps.capabilities.register(CAPABILITY_KEYS.tmdbStatus, () => ({
        configured: service.configured,
        language: service.language,
      }));

      const candidateSnapshot: TmdbCandidateSnapshotCommand = (candidate, episode) =>
        service.snapshotForCandidate(candidate, episode);
      deps.capabilities.register(CAPABILITY_KEYS.tmdbCandidateSnapshot, candidateSnapshot);

      const recordApplyTmdb = deps.capabilities.get<
        (recordId: string, snapshot: TmdbSnapshot) => Promise<void>
      >(CAPABILITY_KEYS.recordApplyTmdb);
      if (recordApplyTmdb === undefined && deps.dev) {
        console.warn(
          `[tmdb] backfill binding unavailable: "${CAPABILITY_KEYS.recordApplyTmdb}" not registered (edit plugin not loaded)`,
        );
      }

      const bind = async (
        recordId: string,
        candidate: TmdbCandidate,
        record?: MovieRecord,
      ): Promise<void> => {
        const episode =
          candidate.mediaType === "episode" && record?.tmdb.mediaType === "episode"
            ? {
                season: record.tmdb.seasonNumber ?? 1,
                episode: record.tmdb.episodeNumber ?? 1,
              }
            : undefined;
        const snapshot = await service.snapshotForCandidate(candidate, episode);
        await recordApplyTmdb?.(recordId, snapshot);
      };

      const backfill: TmdbBackfillCommand = async (
        recordId: string,
      ): Promise<TmdbBackfillResult> => {
        const records = await storage.loadAll<MovieRecord>(COLLECTIONS.records);
        const record = records.find((r) => r.id === recordId);
        if (!record) return { status: "error", message: `record "${recordId}" not found` };
        if (record.tmdb.mediaType !== "movie" && record.tmdb.mediaType !== "episode") {
          return { status: "error", message: "unsupported media type" };
        }
        try {
          const result = await service.backfill(recordId, {
            title: record.tmdb.title,
            mediaType: record.tmdb.mediaType,
          });
          if (result.status === "bound") {
            const candidate = (await service.search(record.tmdb.title, {
              mediaType: record.tmdb.mediaType,
            })).find((c) => c.tmdbId === result.tmdbId);
            if (candidate) await bind(recordId, candidate, record);
            else return { status: "error", message: "candidate vanished between calls" };
          } else if (result.status === "needs-review") {
            ui.openReview(recordId, result.candidates);
          }
          return result;
        } catch (error) {
          return { status: "error", message: String(error) };
        }
      };
      deps.capabilities.register(CAPABILITY_KEYS.tmdbBackfill, backfill);

      // Phase 4: batch auto-backfill for records with a known tmdb.id
      // (jellyfin imports auto-trigger this after a sync; the stats view
      // exposes a manual button). Reentrancy-guarded; progress via event.
      let backfillKnownRunning = false;
      const backfillKnown: TmdbBackfillKnownCommand = async () => {
        if (backfillKnownRunning) return { status: "already-running" };
        backfillKnownRunning = true;
        try {
          const records = await storage.loadAll<MovieRecord>(COLLECTIONS.records);
          return await service.backfillKnown(records, {
            apply: recordApplyTmdb,
            onProgress: (progress) =>
              deps.events.emit(TMDB_EVENTS.backfillProgress, progress),
          });
        } catch (error) {
          return { status: "error", message: error instanceof Error ? error.message : String(error) };
        } finally {
          backfillKnownRunning = false;
        }
      };
      deps.capabilities.register(CAPABILITY_KEYS.tmdbBackfillKnown, backfillKnown);

      deps.capabilities.register(CAPABILITY_KEYS.tmdbConfigure, () => ui.openConfig());

      deps.capabilities.register(
        CAPABILITY_KEYS.overlayTmdbBackfill,
        createTmdbOverlay(
          ui,
          async (recordId, candidate) => {
            const records = await storage.loadAll<MovieRecord>(COLLECTIONS.records);
            await bind(recordId, candidate, records.find((r) => r.id === recordId));
            ui.closeReview();
          },
          () => ({ apiKey: service.configApiKey, v4Token: service.configV4Token, language: service.language }),
          async (next) => {
            const config: TmdbConfig = {
              apiKey: next.apiKey,
              v4Token: next.v4Token ?? "",
              language: next.language,
            };
            await service.saveConfig(config);
          },
        ),
      );

      // Poster image cache: only when the platform registered an fs port.
      let imageCache: ImageCacheService | undefined;
      const fs = deps.services.get<BinaryFsPort>(FS_SERVICE);
      if (fs && options.cacheDir) {
        const raw = new ImageCache({
          fs,
          fetchImpl: http ?? defaultFetch,
          cacheDir: options.cacheDir,
        });
        const toUri = options.toRenderUri ?? ((p: string) => p);
        imageCache = {
          resolve: async (url) => {
            const path = await raw.resolve(url);
            return path === null ? null : toUri(path);
          },
          clear: () => raw.clear(),
        };
        deps.services.register(IMAGE_CACHE_SERVICE, imageCache);
      } else if (deps.dev) {
        console.warn("[tmdb] image cache disabled: no fs service/cacheDir (remote-direct fallback)");
      }

      return {
        service,
        ui,
        imageCache,
        dispose() {
          for (const key of keys) deps.capabilities.unregister(key);
          if (imageCache) deps.services.unregister(IMAGE_CACHE_SERVICE);
        },
      };
    },
  };
}
