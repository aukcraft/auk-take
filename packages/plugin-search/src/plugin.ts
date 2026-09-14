/**
 * plugin-search factory (design D3/D4): recommended tier. Owns a
 * records projection and the pure query engine; registers cmd:search
 * and a toolbar component consumed by display's records tab.
 */
import { COLLECTIONS, type AukPlugin, type MovieRecord, type Storage } from "@auktake/core";
import {
  CAPABILITY_KEYS,
  RECORD_EVENT_NAMES,
  STORAGE_SERVICE,
  createCollectionProjection,
  type PluginRuntimeDeps,
  type SearchCommand,
} from "@auktake/ui-contracts";
import { queryRecords } from "@auktake/ui-contracts";
import { createSearchToolbar } from "./components/SearchToolbar";

/**
 * Toolbar props contract (display consumes): the component holds no
 * query state itself — display passes the current query down and
 * receives updates. This keeps the filter state in display (D3) while
 * search owns the engine.
 */
export interface SearchToolbarProps {
  readonly query: import("@auktake/ui-contracts").RecordQuery;
  readonly onChange: (next: import("@auktake/ui-contracts").RecordQuery) => void;
}

export function createSearchPlugin(deps: PluginRuntimeDeps): AukPlugin {
  return {
    id: "search",
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

      const search: SearchCommand = async (query) =>
        queryRecords(projection.getState(), query);
      deps.capabilities.register(CAPABILITY_KEYS.search, search);
      deps.capabilities.register(
        CAPABILITY_KEYS.searchToolbar,
        createSearchToolbar(deps.capabilities),
      );

      return {
        projection,
        dispose() {
          deps.capabilities.unregister(CAPABILITY_KEYS.search);
          deps.capabilities.unregister(CAPABILITY_KEYS.searchToolbar);
          projection.dispose();
        },
      };
    },
  };
}
