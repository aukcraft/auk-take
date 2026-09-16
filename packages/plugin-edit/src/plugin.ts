/**
 * plugin-edit factory (design D1): deps explicitly injected by the
 * shell composition root; the core's PluginContext stays untouched.
 */
import type { AukPlugin, Storage } from "@auktake/core";
import { ulid } from "ulid";
import {
  CAPABILITY_KEYS,
  IMAGE_CACHE_SERVICE,
  STORAGE_SERVICE,
  tmdbImageUrl,
  type PluginRuntimeDeps,
  type RecordDeleteCommand,
  type RecordEditCommand,
} from "@auktake/ui-contracts";
import { EditSessionController } from "./headless/edit-session";
import { RecordsWriter } from "./headless/records-writer";
import { createEditOverlay } from "./components/EditOverlay";

/** Local calendar day "YYYY-MM-DD" for the default watch date. */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createEditPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "edit",
    tier: "locked",
    permissions: ["storage:read", "storage:write"],

    async connect() {
      // Phase 1 editor has no configuration state.
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>(STORAGE_SERVICE);
      const writer = new RecordsWriter({
        storage,
        events: deps.events,
        now: () => new Date().toISOString(),
        generateId: ulid,
      });
      const session = new EditSessionController();

      const openEdit: RecordEditCommand = (options) => {
        if (options?.recordId) {
          void writer.get(options.recordId).then((record) => {
            if (!record) {
              if (deps.dev) {
                console.warn(`[edit] record "${options.recordId}" not found; editor not opened`);
              }
              return;
            }
            session.openRecord(record);
          });
          return;
        }
        session.openNew(localToday());
      };

      const requestDelete: RecordDeleteCommand = (recordId) => {
        void writer.get(recordId).then((record) => {
          if (!record) {
            if (deps.dev) {
              console.warn(`[edit] record "${recordId}" not found; delete not requested`);
            }
            return;
          }
          session.requestDelete({ id: record.id, title: record.tmdb.title });
        });
      };

      deps.capabilities.register(CAPABILITY_KEYS.recordEdit, openEdit);
      deps.capabilities.register(CAPABILITY_KEYS.recordDelete, requestDelete);
      // Phase 4 internal channel: jellyfin bulk import (sole-writer guard).
      deps.capabilities.register(CAPABILITY_KEYS.recordApplyJellyfin, (records: readonly import("@auktake/core").MovieRecord[]) =>
        writer.importJellyfin(records),
      );
      // Phase 3 internal channel: tag reference cleanup (tag delete).
      deps.capabilities.register(CAPABILITY_KEYS.recordRemoveTag, (tagId: string) =>
        writer.removeTagFromAll(tagId),
      );
      // Phase 2 internal channel: snapshot-only merge for the backfill flow.
      deps.capabilities.register(CAPABILITY_KEYS.recordApplyTmdb, (recordId: string, snapshot: import("@auktake/core").TmdbSnapshot) =>
        writer.applyTmdb(recordId, snapshot).then((r) => {
          if (!r && deps.dev) console.warn(`[edit] applyTmdb: record "${recordId}" not found`);
        }),
      );
      // Poster warm-up through the image cache when available (desktop).
      const imageCache = deps.services.get<import("@auktake/ui-contracts").ImageCacheService>(IMAGE_CACHE_SERVICE);
      const warmPoster = (recordId: string, posterPath: string): void => {
        const url = tmdbImageUrl(posterPath);
        if (imageCache && url) void writer.warmMediaCache(recordId, url, (u) => imageCache.resolve(u));
      };
      // The overlay contract is prop-free: the component closes over
      // the session/writer created here (design D8).
      deps.capabilities.register(
        CAPABILITY_KEYS.overlayRoot,
        createEditOverlay(session, writer, warmPoster, deps.capabilities, imageCache),
      );

      return {
        session,
        writer,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.recordEdit);
          deps.capabilities.unregister(CAPABILITY_KEYS.recordDelete);
          deps.capabilities.unregister(CAPABILITY_KEYS.recordApplyTmdb);
          deps.capabilities.unregister(CAPABILITY_KEYS.recordRemoveTag);
          deps.capabilities.unregister(CAPABILITY_KEYS.recordApplyJellyfin);
          deps.capabilities.unregister(CAPABILITY_KEYS.overlayRoot);
        },
      };
    },
  };
}
