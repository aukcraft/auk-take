/**
 * plugin-display factory: records tab content provider + read-only
 * detail command/overlay. Owns a PRIVATE records projection (design
 * D3) — no shared mutable service, no other plugin's instance.
 */
import { COLLECTIONS, type AukPlugin, type MovieRecord, type Storage } from "@auktake/core";
import { TAB_CAPABILITY_KEYS } from "@auktake/ui-nav";
import {
  CAPABILITY_KEYS,
  RECORD_EVENT_NAMES,
  STORAGE_SERVICE,
  createCollectionProjection,
  type PluginRuntimeDeps,
  type RecordDetailCommand,
} from "@auktake/ui-contracts";
import { createRecordsTab } from "./components/RecordsTab";
import { DetailStore, createDetailOverlay } from "./components/DetailOverlay";

export function createDisplayPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "display",
    tier: "locked",
    permissions: ["storage:read"],

    async connect() {
      return { state: {} };
    },

    create() {
      const storage = deps.services.require<Storage>(STORAGE_SERVICE);
      const projection = createCollectionProjection<MovieRecord>({
        storage,
        events: deps.events,
        collection: COLLECTIONS.records,
        invalidationEvents: RECORD_EVENT_NAMES,
      });
      const detail = new DetailStore();

      const openDetail: RecordDetailCommand = (recordId) => detail.open(recordId);

      deps.capabilities.register(CAPABILITY_KEYS.recordDetail, openDetail);
      deps.capabilities.register(
        CAPABILITY_KEYS.overlayRecordDetail,
        createDetailOverlay(detail, projection, deps.capabilities),
      );
      deps.capabilities.register(
        TAB_CAPABILITY_KEYS.records,
        createRecordsTab(projection, deps.capabilities, deps.dev === true),
      );

      return {
        projection,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.recordDetail);
          deps.capabilities.unregister(CAPABILITY_KEYS.overlayRecordDetail);
          deps.capabilities.unregister(TAB_CAPABILITY_KEYS.records);
          projection.dispose();
        },
      };
    },
  };
}
