import { describe, expect, it } from "vitest";
import { describeStorageContract } from "@auktake/core/testing";
import { TauriFileStorage } from "../src/storage.js";
import type { DataFile, FsPort } from "../src/fs-port.js";

/** In-memory FsPort simulating a filesystem with atomic rename. */
class MemFs implements FsPort {
  readonly files = new Map<string, string>();

  async readTextFile(path: string) {
    return this.files.get(path) ?? null;
  }
  async writeTextFile(path: string, contents: string) {
    this.files.set(path, contents);
  }
  async rename(oldPath: string, newPath: string) {
    if (!this.files.has(oldPath)) throw new Error("ENOENT");
    this.files.set(newPath, this.files.get(oldPath)!);
    this.files.delete(oldPath);
  }
  async remove(path: string) {
    this.files.delete(path);
  }
}

const DATA = "/app-data/auktake.json";

describeStorageContract("TauriFileStorage", () => {
  const fs = new MemFs();
  return new TauriFileStorage(fs, DATA);
});

describe("TauriFileStorage atomicity", () => {
  it("write goes through temp file + rename; no .tmp residue", async () => {
    const fs = new MemFs();
    const s = new TauriFileStorage(fs, DATA);
    await s.persistAll("records", [
      { id: "a", schemaVersion: 1, value: 1 },
    ]);
    expect(fs.files.has(DATA)).toBe(true);
    expect(fs.files.has(`${DATA}.tmp`)).toBe(false);
    const parsed = JSON.parse(fs.files.get(DATA)!) as DataFile;
    expect(parsed.records?.a).toEqual({ id: "a", schemaVersion: 1, value: 1 });
  });

  it("interrupted write (rename fails) leaves old content intact", async () => {
    const fs = new MemFs();
    const s = new TauriFileStorage(fs, DATA);
    await s.persistAll("records", [{ id: "old", schemaVersion: 1, value: 0 }]);

    const broken: FsPort = {
      readTextFile: (p) => fs.readTextFile(p),
      writeTextFile: (p, c) => fs.writeTextFile(p, c),
      remove: (p) => fs.remove(p),
      rename: async () => {
        throw new Error("crash before rename");
      },
    };
    const s2 = new TauriFileStorage(broken, DATA);
    await expect(
      s2.persistAll("records", [{ id: "new", schemaVersion: 1, value: 1 }]),
    ).rejects.toThrow("crash before rename");

    const intact = JSON.parse(fs.files.get(DATA)!) as DataFile;
    expect(intact.records?.old).toBeDefined();
    expect(intact.records?.new).toBeUndefined();
  });
});
