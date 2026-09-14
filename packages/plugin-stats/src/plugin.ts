/**
 * plugin-stats factory (design D5): recommended tier. Registers the
 * profile-tab content; registration REPLACES the shell placeholder
 * (CapabilityRegistry last-write-wins; plugin create() runs after the
 * shell registered its placeholder — pinned by an assembly test).
 */
import { COLLECTIONS, type AukPlugin, type MovieRecord, type Storage } from "@auktake/core";
import { TAB_CAPABILITY_KEYS } from "@auktake/ui-nav";
import {
  RECORD_EVENT_NAMES,
  STORAGE_SERVICE,
  createCollectionProjection,
  type PluginRuntimeDeps,
} from "@auktake/ui-contracts";
import { createStatsView } from "./components/StatsView";

export function createStatsPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "stats",
    tier: "recommended",
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
        TAB_CAPABILITY_KEYS.profile,
        createStatsView(projection, deps.capabilities, deps.dev === true),
      );

      return {
        projection,
        dispose() {
          deps.capabilities.unregister(TAB_CAPABILITY_KEYS.profile);
          projection.dispose();
        },
      };
    },
  };
}
