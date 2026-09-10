import {
  CapabilityRegistry,
  EventBus,
  PluginManager,
  ServiceRegistry,
  type ConnectionStore,
  type PluginContext,
} from "@auktake/core";
import { createTauriStorage } from "@auktake/platform-tauri";
import { createDisplayPlugin } from "@auktake/plugin-display";
import { createEditPlugin } from "@auktake/plugin-edit";
import { createRecordPlugin } from "@auktake/plugin-record";
import { createTimelinePlugin } from "@auktake/plugin-timeline";
import type { PluginRuntimeDeps } from "@auktake/ui-contracts";

/**
 * Desktop composition root (design D1): init core -> inject Tauri
 * storage -> assemble the SAME Phase 1 plugins as mobile -> connect +
 * startup. The shell holds no business logic.
 */

/** Default data file location inside the Tauri app data dir. */
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
  services.register("storage", createTauriStorage(appDataPath(DATA_FILE)));

  const events = new EventBus();
  const capabilities = new CapabilityRegistry();
  const deps: PluginRuntimeDeps = { events, capabilities, services, dev };

  const manager = new PluginManager({ connectionStore: memoryConnectionStore() });
  manager.register(createEditPlugin(deps));
  manager.register(createDisplayPlugin(deps));
  manager.register(createRecordPlugin(deps));
  manager.register(createTimelinePlugin(deps));

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

/**
 * Resolves the absolute data path. Tauri exposes app paths via
 * @tauri-apps/api/path at runtime; outside Tauri (vite dev in plain
 * browser) fall back to a relative path for development.
 */
function appDataPath(file: string): string {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    // Resolved lazily inside tauri-adapter reads; constructed path is
    // resolved via @tauri-apps/api/path in production shell entry.
    return `${(window as unknown as { __APP_DATA_DIR__?: string }).__APP_DATA_DIR__ ?? "."}/${file}`;
  }
  return file;
}
