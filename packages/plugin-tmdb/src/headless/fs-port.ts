/**
 * Minimal BINARY fs port for the image cache (platform-agnostic).
 * Text-only FsPorts (platform-tauri) are not enough for images. The
 * desktop composition root registers an implementation under the
 * "fs" service name; mobile registers none (remote-direct fallback).
 */
export interface BinaryFsPort {
  /** Read a file as bytes. Returns null when it does not exist. */
  readFile(path: string): Promise<Uint8Array | null>;
  /** Write bytes (creates or truncates). */
  writeFile(path: string, data: Uint8Array): Promise<void>;
  /** Atomic replace: rename old -> new (dest removed first when present). */
  rename(oldPath: string, newPath: string): Promise<void>;
  /** Remove a file when present; no-op when missing. */
  remove(path: string): Promise<void>;
  /** Ensure a directory exists (mkdir -p). */
  mkdir(path: string): Promise<void>;
  /** List file names directly under a directory. */
  list?(dir: string): Promise<string[]>;
}

/** In-memory implementation for pure-Node tests. */
export class MemoryFs implements BinaryFsPort {
  readonly files = new Map<string, Uint8Array>();

  async readFile(path: string): Promise<Uint8Array | null> {
    return this.files.get(path) ?? null;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, data);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const data = this.files.get(oldPath);
    if (data === undefined) throw new Error(`rename: missing ${oldPath}`);
    this.files.set(newPath, data);
    this.files.delete(oldPath);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async mkdir(_path: string): Promise<void> {
    /* memory fs needs no directories */
  }

  async list(): Promise<string[]> {
    return [...this.files.keys()];
  }
}
