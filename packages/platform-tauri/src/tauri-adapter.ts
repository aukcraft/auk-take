import { rename, writeTextFile } from "@tauri-apps/plugin-fs";
import type { FsPort } from "./fs-port.js";
import { TauriFileStorage } from "./storage.js";

/**
 * Relative storage paths are resolved against the Tauri app-data dir
 * VIA THE API at call time. Injecting the dir from Rust with
 * webview.eval at setup proved unreliable on Windows (WebView2 drops
 * the script when it runs before navigation completes), which made
 * saves silently fail; async resolution has no such race.
 */
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;

async function resolvePath(path: string): Promise<string> {
  if (path.startsWith("/") || path.startsWith("\\") || WINDOWS_ABSOLUTE.test(path)) {
    return path;
  }
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  return join(await appDataDir(), path);
}

/** FsPort adapter bound to @tauri-apps/plugin-fs. Exists only inside the Tauri runtime. */
export const tauriFs: FsPort = {
  async readTextFile(path) {
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      return await readTextFile(await resolvePath(path));
    } catch {
      return null; // not found (or unreadable) treated as empty store
    }
  },
  async writeTextFile(path, contents) {
    await writeTextFile(await resolvePath(path), contents);
  },
  async rename(oldPath, newPath) {
    // plugin-fs rename fails when destination exists on some platforms;
    // remove first, then rename (temp-file pattern keeps this safe).
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(await resolvePath(newPath));
    } catch {
      // destination absent: fine
    }
    await rename(await resolvePath(oldPath), await resolvePath(newPath));
  },
  async remove(path) {
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(await resolvePath(path));
    } catch {
      // missing file: no-op
    }
  },
};

/** Factory the desktop shell passes to ServiceRegistry.register('storage', ...). */
export function createTauriStorage(dataPath: string): TauriFileStorage {
  // Plain-browser dev/preview (no Tauri runtime): persist to
  // localStorage so the snapshot stays testable outside the window.
  // Typed via structural probe: this package keeps a DOM-free lib.
  const browser =
    typeof globalThis === "object" &&
    globalThis !== null &&
    (globalThis as { window?: unknown }).window !== undefined;
  if (browser) {
    const w = globalThis as unknown as {
      __TAURI_INTERNALS__?: unknown;
      localStorage: Storage;
    };
    if (!("__TAURI_INTERNALS__" in w)) {
      return new TauriFileStorage(
        createLocalStorageFs(() => w.localStorage),
        dataPath,
      );
    }
  }
  return new TauriFileStorage(tauriFs, dataPath);
}

/** localStorage-backed FsPort (dev fallback outside the Tauri runtime). */
export function createLocalStorageFs(getStorage: () => Storage): FsPort {
  const key = (path: string) => `auktake:fs:${path}`;
  return {
    async readTextFile(path) {
      return getStorage().getItem(key(path));
    },
    async writeTextFile(path, contents) {
      getStorage().setItem(key(path), contents);
    },
    async rename(oldPath, newPath) {
      const store = getStorage();
      const contents = store.getItem(key(oldPath));
      if (contents === null) throw new Error(`rename: missing ${oldPath}`);
      store.setItem(key(newPath), contents);
      store.removeItem(key(oldPath));
    },
    async remove(path) {
      getStorage().removeItem(key(path));
    },
  };
}
