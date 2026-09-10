/**
 * plugin-timeline factory: optional-tier view plugin. Registers the
 * `ui:view:timeline` component (data-carrying, prop-free) consumed by
 * display's records tab. Zero dependencies on display's implementation.
 */
import { COLLECTIONS, type AukPlugin, type MovieRecord, type Storage } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  RECORD_EVENT_NAMES,
  STORAGE_SERVICE,
  createCollectionProjection,
  type PluginRuntimeDeps,
} from "@auktake/ui-contracts";
import { createTimelineView } from "./components/TimelineView";

export function createTimelinePlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "timeline",
    tier: "optional",
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
        CAPABILITY_KEYS.viewTimeline,
        createTimelineView(projection, deps.capabilities, deps.dev === true),
      );

      return {
        projection,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.viewTimeline);
          projection.dispose();
        },
      };
    },
  };
}
