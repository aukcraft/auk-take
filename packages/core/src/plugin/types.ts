/**
 * Plugin lifecycle contract.
 *
 * Two-phase initialization (connect/create separation):
 * - connect: runs ONCE at configuration time (validation + handshake).
 *   Failures here are loud: they bubble up to the host/settings UI
 *   because the user is present.
 * - create: runs on EVERY startup, purely rebuilding the instance from
 *   persisted opaque state. No network or credential interaction.
 */

/** Plugin tier. Mirrors the shutdown policy (text identifiers only, no emoji). */
export type PluginTier = "locked" | "recommended" | "optional";

/**
 * Permission identifiers declared by a plugin, e.g. "storage:read",
 * "network:fetch". Checked via PermissionManager.assertPermission.
 */
export type Permission = string;

/**
 * Opaque persisted connection state. The core stores and retrieves it
 * without interpreting its content, so plugins can evolve their state
 * shape without touching core storage structures.
 */
export interface PluginConnection {
  /** Opaque, plugin-private. Core MUST NOT read or modify. */
  readonly state: unknown;
}

/**
 * Context handed to a plugin. All capabilities enter via this context;
 * plugins MUST NOT import platform APIs or other plugins' internals.
 */
export interface PluginContext {
  readonly pluginId: string;
  readonly events: { on: never; emit: never }; // replaced by core facade at runtime
}

/** A live plugin instance produced by `create`. Shape is plugin-defined. */
export interface PluginInstance {
  /** Plugin-defined payload; the core treats it opaquely. */
  readonly [key: string]: unknown;
  /** Optional cleanup on unload. */
  dispose?(): void | Promise<void>;
}

/**
 * The plugin contract. Plugins may depend on `@auktake/core` interface
 * definitions ONLY; importing another plugin's internal implementation
 * files is forbidden.
 */
export interface AukPlugin {
  /** Unique plugin id, e.g. "rating", "sync-webdav". */
  readonly id: string;

  /** Shutdown policy tier. Locked plugins cannot be unloaded. */
  readonly tier: PluginTier;

  /** Permissions this plugin requires. */
  readonly permissions: readonly Permission[];

  /**
   * One-time: validate configuration + handshake. Throws on failure
   * (the error is surfaced to the user; the plugin stays unloaded).
   */
  connect(ctx: PluginContext): Promise<PluginConnection>;

  /**
   * Every startup: rebuild instance from persisted connection state.
   * MUST be pure of network/credential interaction.
   */
  create(ctx: PluginContext, conn: PluginConnection): PluginInstance;
}
