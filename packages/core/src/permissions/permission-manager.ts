import type { Permission } from "../plugin/types.js";

/** Error thrown when a plugin exercises a permission it never declared. */
export class PermissionError extends Error {
  constructor(
    readonly pluginId: string,
    readonly permission: Permission,
  ) {
    super(`Plugin "${pluginId}" lacks required permission: ${permission}`);
    this.name = "PermissionError";
  }
}

/**
 * Permission declaration + validation API.
 * Phase 0a scope: assertion only; runtime interception is left to the host.
 */
export class PermissionManager {
  private readonly declared = new Map<string, ReadonlySet<Permission>>();

  /** Register (or replace) the declared permissions of a plugin. */
  declare(pluginId: string, permissions: readonly Permission[]): void {
    this.declared.set(pluginId, new Set(permissions));
  }

  /** Remove a plugin's declarations (e.g. on unload). */
  forget(pluginId: string): void {
    this.declared.delete(pluginId);
  }

  /** True when the plugin declared the permission. */
  has(pluginId: string, permission: Permission): boolean {
    return this.declared.get(pluginId)?.has(permission) ?? false;
  }

  /** Assert a permission; throws PermissionError when not declared. */
  assertPermission(pluginId: string, permission: Permission): void {
    if (!this.has(pluginId, permission)) {
      throw new PermissionError(pluginId, permission);
    }
  }
}
