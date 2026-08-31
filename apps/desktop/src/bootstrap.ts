import { ServiceRegistry } from "@auktake/core";
import { createTauriStorage } from "@auktake/platform-tauri";

/**
 * Desktop bootstrap: init core -> inject platform storage -> (plugins
 * start in Phase 1+) -> render AppShell. The shell holds no business
 * logic; everything flows through core contracts.
 */

/** Default data file location inside the Tauri app data dir. */
const DATA_FILE = "auktake.json";

export function bootstrapServices(): ServiceRegistry {
  const services = new ServiceRegistry();
  services.register("storage", createTauriStorage(appDataPath(DATA_FILE)));
  return services;
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
