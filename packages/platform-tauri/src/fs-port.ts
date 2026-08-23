/**
 * Minimal fs port the Tauri Storage depends on. The real adapter binds
 * @tauri-apps/plugin-fs; tests inject an in-memory fs. The atomic-write
 * orchestration (temp file + rename) is pure logic testable in Node.
 */
export interface FsPort {
  /** Read a text file. Returns null when it does not exist. */
  readTextFile(path: string): Promise<string | null>;
  /** Write a text file (creates or truncates). */
  writeTextFile(path: string, contents: string): Promise<void>;
  /** Rename/move a file, atomically replacing the destination when supported. */
  rename(oldPath: string, newPath: string): Promise<void>;
  /** Remove a file when present; no-op when missing. */
  remove(path: string): Promise<void>;
}

/** Data file shape: { [collection]: { [id]: entity } } */
export type DataFile = Record<string, Record<string, unknown>>;
