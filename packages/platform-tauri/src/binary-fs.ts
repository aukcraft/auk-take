/**
 * Binary fs port for the poster image cache (desktop). Structurally
 * compatible with plugin-tmdb's BinaryFsPort; relative paths resolve
 * against the Tauri app-data dir at call time (same pattern as the
 * storage adapter — no injected globals). Mobile registers no fs
 * service: the cache stays disabled there (remote-direct fallback).
 */
import {
  mkdir,
  readFile,
  readDir,
  rename,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";

const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;

async function resolvePath(path: string): Promise<string> {
  if (path.startsWith("/") || path.startsWith("\\") || WINDOWS_ABSOLUTE.test(path)) {
    return path;
  }
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  return join(await appDataDir(), path);
}

export interface BinaryFsPortLike {
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  list?(dir: string): Promise<string[]>;
}

export function createTauriBinaryFs(): BinaryFsPortLike {
  return {
    async readFile(path) {
      try {
        const bytes = await readFile(await resolvePath(path));
        return new Uint8Array(bytes);
      } catch {
        return null; // missing/unreadable -> cache miss
      }
    },
    async writeFile(path, data) {
      await writeFile(await resolvePath(path), data);
    },
    async rename(oldPath, newPath) {
      const target = await resolvePath(newPath);
      try {
        await remove(target);
      } catch {
        // destination absent: fine
      }
      await rename(await resolvePath(oldPath), target);
    },
    async remove(path) {
      try {
        await remove(await resolvePath(path));
      } catch {
        // missing: no-op
      }
    },
    async mkdir(path) {
      await mkdir(await resolvePath(path), { recursive: true });
    },
    async list(dir) {
      try {
        const entries = await readDir(await resolvePath(dir));
        return entries.map((e) => e.name);
      } catch {
        return [];
      }
    },
  };
}
