import {
  CapabilityRegistry,
  EventBus,
  PluginManager,
  ServiceRegistry,
  type ConnectionStore,
  type PluginContext,
} from "@auktake/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { createTauriBinaryFs, createTauriStorage } from "@auktake/platform-tauri";
import { createDisplayPlugin } from "@auktake/plugin-display";
import { createEditPlugin } from "@auktake/plugin-edit";
import { createRecordPlugin } from "@auktake/plugin-record";
import { createTimelinePlugin } from "@auktake/plugin-timeline";
import { createTmdbPlugin } from "@auktake/plugin-tmdb";
import { createTagPlugin } from "@auktake/plugin-tag";
import { createSearchPlugin } from "@auktake/plugin-search";
import { createStatsPlugin } from "@auktake/plugin-stats";
import { FS_SERVICE, type PluginRuntimeDeps } from "@auktake/ui-contracts";

/**
 * Desktop composition root (design D1): init core -> inject Tauri
 * storage -> assemble the SAME Phase 1 plugins as mobile -> connect +
 * startup. The shell holds no business logic.
 *
 * The data file name is RELATIVE: the platform-tauri adapter resolves
 * it against the Tauri app-data dir via @tauri-apps/api/path at call
 * time (no injected global — see tauri-adapter.ts), or against
 * localStorage in a plain browser.
 */
const DATA_FILE = "auktake.json";

function memoryConnectionStore(): ConnectionStore {
  const state = new Map<string, unknown>();
  return {
    async save(id, s) {
      state.set(id, s);
    },
    async load(id) {
      return state.get(id);
    },
    async remove(id) {
      state.delete(id);
    },
  };
}

export interface AppRuntime {
  readonly capabilities: CapabilityRegistry;
  start(): Promise<void>;
}

export function createRuntime(dev: boolean): AppRuntime {
  const services = new ServiceRegistry();
  services.register("storage", createTauriStorage(DATA_FILE));
  // Binary fs for the poster image cache (mobile registers none).
  services.register(FS_SERVICE, createTauriBinaryFs());

  const events = new EventBus();
  const capabilities = new CapabilityRegistry();
  const deps: PluginRuntimeDeps = { events, capabilities, services, dev };

  const manager = new PluginManager({ connectionStore: memoryConnectionStore() });
  manager.register(createEditPlugin(deps));
  manager.register(createDisplayPlugin(deps));
  manager.register(createRecordPlugin(deps));
  manager.register(createTimelinePlugin(deps));
  // recommended tier: TMDB metadata (built-in key + user override).
  manager.register(
    createTmdbPlugin(deps, {
      cacheDir: "poster-cache",
      // local cache files render via the Tauri asset protocol
      toRenderUri: (path) => convertFileSrc(path),
    }),
  );
  // Phase 3: tags (locked, needs edit's cleanup channel), search + stats (recommended).
  manager.register(createTagPlugin(deps));
  manager.register(createSearchPlugin(deps));
  manager.register(createStatsPlugin(deps));

  const pluginContext = (pluginId: string): PluginContext => ({
    pluginId,
    events: {} as never, // registries flow via injected deps (design D1)
  });

  return {
    capabilities,
    async start() {
      for (const id of manager.list()) {
        await manager.connect(id, pluginContext(id));
      }
      await manager.startupAll(pluginContext);
    },
  };
}
