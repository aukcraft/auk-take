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
import { createSearchSuite } from "./components/SearchSuite";

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
      // Tuple API capability: (props) => [Button, Card]; display calls it
      // in useMemo as the query changes — component refs stay stable.
      const suite = createSearchSuite(deps.capabilities);
      deps.capabilities.register(CAPABILITY_KEYS.searchToolbar, suite);

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
