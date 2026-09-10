import { rename, writeTextFile } from "@tauri-apps/plugin-fs";
import type { FsPort } from "./fs-port.js";
import { TauriFileStorage } from "./storage.js";

/**
 * FsPort adapter bound to @tauri-apps/plugin-fs. Exists only inside the
 * Tauri runtime; the atomic-write orchestration itself lives in
 * TauriFileStorage and is tested against an in-memory fs in pure Node.
 */
export const tauriFs: FsPort = {
  async readTextFile(path) {
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      return await readTextFile(path);
    } catch {
      return null; // not found (or unreadable) treated as empty store
    }
  },
  async writeTextFile(path, contents) {
    await writeTextFile(path, contents);
  },
  async rename(oldPath, newPath) {
    // plugin-fs rename fails when destination exists on some platforms;
    // remove first, then rename (temp-file pattern keeps this safe).
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(newPath);
    } catch {
      // destination absent: fine
    }
    await rename(oldPath, newPath);
  },
  async remove(path) {
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(path);
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
