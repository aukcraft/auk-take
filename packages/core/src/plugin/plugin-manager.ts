import type {
  AukPlugin,
  PluginConnection,
  PluginContext,
  PluginInstance,
} from "./types.js";

/** Raised when attempting to unload a plugin of tier "locked". */
export class LockedPluginError extends Error {
  constructor(readonly pluginId: string) {
    super(`Plugin "${pluginId}" is locked and cannot be unloaded`);
    this.name = "LockedPluginError";
  }
}

/** Internal record per registered plugin. */
interface PluginRecord {
  readonly plugin: AukPlugin;
  instance: PluginInstance | undefined;
}

/**
 * Opaque connection-state persistence. The core stores and retrieves
 * blobs without interpreting them (design decision D2). The host wires
 * this to real storage; this interface keeps the core platform-free.
 */
export interface ConnectionStore {
  save(pluginId: string, state: unknown): Promise<void>;
  load(pluginId: string): Promise<unknown>;
  remove(pluginId: string): Promise<void>;
}

export interface PluginManagerOptions {
  connectionStore: ConnectionStore;
  /** Invoked for each plugin after its instance is (re)created. */
  onInstanceError?: (pluginId: string, error: unknown) => void;
}

/**
 * Plugin registry with two-phase lifecycle:
 * - connect once at configuration time (errors bubble up: user present)
 * - create on every startup from persisted opaque state (no handshake)
 *
 * Runtime failures are isolated per plugin (try/catch, skip and continue).
 */
export class PluginManager {
  private readonly plugins = new Map<string, PluginRecord>();
  private readonly options: PluginManagerOptions;

  constructor(options: PluginManagerOptions) {
    this.options = options;
  }

  /** All registered plugin ids. */
  list(): string[] {
    return [...this.plugins.keys()];
  }

  get(pluginId: string): AukPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  instance(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId)?.instance;
  }

  /**
   * Register a plugin definition (does not connect yet). Duplicate ids
   * replace the previous definition.
   */
  register(plugin: AukPlugin): void {
    this.plugins.set(plugin.id, { plugin, instance: undefined });
  }

  /**
   * One-time configuration-phase handshake. Persisted state wins when
   * present: an already-connected plugin is not re-connected.
   * Errors are loud: rethrown to the caller (host/settings UI).
   */
  async connect(pluginId: string, ctx: PluginContext): Promise<void> {
    const record = this.requireRecord(pluginId);
    const existing = await this.options.connectionStore.load(pluginId);
    if (existing !== undefined) return; // already configured
    const conn = await record.plugin.connect(ctx);
    await this.options.connectionStore.save(pluginId, conn.state);
  }

  /**
   * Startup-phase rebuild. Loads persisted opaque state (when any) and
   * calls create. A plugin without persisted state was never connected:
   * it is skipped silently (the host drives connect first).
   */
  async startup(pluginId: string, ctx: PluginContext): Promise<void> {
    const record = this.requireRecord(pluginId);
    const state = await this.options.connectionStore.load(pluginId);
    if (state === undefined) return;
    try {
      const conn: PluginConnection = { state };
      record.instance = record.plugin.create(ctx, conn);
    } catch (error) {
      // Runtime-phase failure: isolated, non-blocking.
      this.options.onInstanceError?.(pluginId, error);
    }
  }

  /** Convenience: startup all registered plugins in registration order. */
  async startupAll(ctxFactory: (pluginId: string) => PluginContext): Promise<void> {
    for (const id of this.list()) {
      await this.startup(id, ctxFactory(id));
    }
  }

  /**
   * Unload a plugin. Locked plugins are refused. Disposes the live
   * instance (dispose errors isolated) and removes persisted state.
   */
  async unload(pluginId: string): Promise<void> {
    const record = this.requireRecord(pluginId);
    if (record.plugin.tier === "locked") {
      throw new LockedPluginError(pluginId);
    }
    if (record.instance?.dispose) {
      try {
        await record.instance.dispose();
      } catch {
        // isolated: unload proceeds
      }
    }
    record.instance = undefined;
    this.plugins.delete(pluginId);
    await this.options.connectionStore.remove(pluginId);
  }

  private requireRecord(pluginId: string): PluginRecord {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw new Error(`Plugin not registered: "${pluginId}"`);
    }
    return record;
  }
}
