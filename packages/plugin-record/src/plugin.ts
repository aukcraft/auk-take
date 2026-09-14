/**
 * plugin-record factory: calendar tab content provider (yearly
 * heatmap). Owns a PRIVATE records projection (design D3).
 */
import { COLLECTIONS, type AukPlugin, type MovieRecord, type Storage } from "@auktake/core";
import { TAB_CAPABILITY_KEYS } from "@auktake/ui-nav";
import {
  RECORD_EVENT_NAMES,
  STORAGE_SERVICE,
  createCollectionProjection,
  type PluginRuntimeDeps,
} from "@auktake/ui-contracts";
import { createCalendarView } from "./components/CalendarView";

export function createRecordPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "record",
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

      deps.capabilities.register(
        TAB_CAPABILITY_KEYS.calendar,
        createCalendarView(projection, deps.capabilities, deps.dev === true),
      );

      return {
        projection,
        dispose() {
          deps.capabilities.unregister(TAB_CAPABILITY_KEYS.calendar);
          projection.dispose();
        },
      };
    },
  };
}
