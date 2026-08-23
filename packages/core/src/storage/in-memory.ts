import type { CollectionName, Storage, StoredEntity } from "./interface.js";

/** In-memory mock implementing the full Storage contract. */
export class InMemoryStorage implements Storage {
  private readonly data = new Map<CollectionName, Map<string, StoredEntity>>();

  async loadAll<T extends StoredEntity>(collection: CollectionName): Promise<T[]> {
    const bucket = this.data.get(collection);
    if (!bucket) return [];
    return [...bucket.values()] as T[];
  }

  async persistAll<T extends StoredEntity>(
    collection: CollectionName,
    items: T[],
  ): Promise<void> {
    const bucket = this.data.get(collection) ?? new Map<string, StoredEntity>();
    bucket.clear();
    for (const item of items) {
      bucket.set(item.id, item);
    }
    this.data.set(collection, bucket);
  }

  async delete(collection: CollectionName, id: string): Promise<void> {
    this.data.get(collection)?.delete(id);
  }
}
