import {
  CapabilityRegistry,
  EventBus,
  PluginManager,
  ServiceRegistry,
  type ConnectionStore,
  type PluginContext,
} from "@auktake/core";
import { createRnStorage } from "@auktake/platform-rn";
import { createDisplayPlugin } from "@auktake/plugin-display";
import { createEditPlugin } from "@auktake/plugin-edit";
import { createRecordPlugin } from "@auktake/plugin-record";
import { createTimelinePlugin } from "@auktake/plugin-timeline";
import type { PluginRuntimeDeps } from "@auktake/ui-contracts";

/**
 * Mobile composition root (design D1): init core -> inject platform
 * storage (op-sqlite) -> assemble Phase 1 plugins with explicitly
 * injected deps -> connect + startup. The shell holds no business
 * logic; everything flows through core contracts.
 */

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

export function createRuntime(): AppRuntime {
  const services = new ServiceRegistry();
  services.register("storage", createRnStorage("auktake.db"));

  const events = new EventBus();
  const capabilities = new CapabilityRegistry();
  const deps: PluginRuntimeDeps = { events, capabilities, services, dev: true };

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
