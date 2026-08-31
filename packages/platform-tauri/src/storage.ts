import type { CollectionName, Storage, StoredEntity } from "@auktake/core";
import type { DataFile, FsPort } from "./fs-port.js";

/**
 * JSON-file Storage for the Tauri desktop shell.
 *
 * Layout: a single JSON file `{ [collection]: { [id]: entity } }`.
 * Writes go to a temp file first, then rename() atomically replaces the
 * data file — a crash leaves either the old or the new complete content,
 * never a half-written state. OPFS is deliberately out of scope.
 */
export class TauriFileStorage implements Storage {
  private cache: DataFile | null = null;

  constructor(
    private readonly fs: FsPort,
    private readonly dataPath: string,
  ) {}

  private tempPath(): string {
    return `${this.dataPath}.tmp`;
  }

  private async load(): Promise<DataFile> {
    if (this.cache) return this.cache;
    const raw = await this.fs.readTextFile(this.dataPath);
    this.cache = raw === null ? {} : (JSON.parse(raw) as DataFile);
    return this.cache;
  }

  private async flush(): Promise<void> {
    if (!this.cache) return;
    const tmp = this.tempPath();
    await this.fs.writeTextFile(tmp, JSON.stringify(this.cache));
    await this.fs.rename(tmp, this.dataPath); // atomic replace
  }

  async loadAll<T extends StoredEntity>(collection: CollectionName): Promise<T[]> {
    const data = await this.load();
    const bucket = data[collection] ?? {};
    return Object.values(bucket) as T[];
  }

  async persistAll<T extends StoredEntity>(
    collection: CollectionName,
    items: T[],
  ): Promise<void> {
    const data = await this.load();
    data[collection] = Object.fromEntries(items.map((i) => [i.id, i]));
    await this.flush();
  }

  async delete(collection: CollectionName, id: string): Promise<void> {
    const data = await this.load();
    const bucket = data[collection];
    if (bucket && id in bucket) {
      delete bucket[id];
      await this.flush();
    }
  }
}
