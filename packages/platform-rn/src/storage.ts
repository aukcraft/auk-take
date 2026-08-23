import type { CollectionName, Storage, StoredEntity } from "@auktake/core";
import type { SqlPort } from "./sql-port.js";

/**
 * op-sqlite backed Storage. One table per collection
 * `(id TEXT PRIMARY KEY, json TEXT)`; three bare statements, no ORM.
 *
 - loadAll: full SELECT (whole-collection in-memory model)
 - persistAll: transactional full replace (DELETE + INSERT per row)
 - delete: single-row DELETE
 */
export class RnStorage implements Storage {
  constructor(private readonly db: SqlPort) {}

  private async ensureTable(collection: string): Promise<void> {
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS "${collection}" (id TEXT PRIMARY KEY, json TEXT NOT NULL)`,
    );
  }

  async loadAll<T extends StoredEntity>(collection: CollectionName): Promise<T[]> {
    await this.ensureTable(collection);
    const result = await this.db.execute(`SELECT json FROM "${collection}"`);
    const rows = (result?.rows ?? []) as string[][];
    return rows.map((r) => JSON.parse(r[0] as string) as T);
  }

  async persistAll<T extends StoredEntity>(
    collection: CollectionName,
    items: T[],
  ): Promise<void> {
    await this.ensureTable(collection);
    await this.db.transaction(async () => {
      await this.db.execute(`DELETE FROM "${collection}"`);
      for (const item of items) {
        await this.db.execute(
          `INSERT INTO "${collection}" (id, json) VALUES (?, ?)`,
          [item.id, JSON.stringify(item)],
        );
      }
    });
  }

  async delete(collection: CollectionName, id: string): Promise<void> {
    await this.ensureTable(collection);
    await this.db.execute(`DELETE FROM "${collection}" WHERE id = ?`, [id]);
  }
}

/**
 * Factory binding a real op-sqlite DB (mobile shell only — the import
 * only resolves inside the RN runtime).
 */
export async function createRnStorage(dbPath: string): Promise<RnStorage> {
  const { open } = await import("@op-engineering/op-sqlite");
  const db = open({ name: dbPath });
  return new RnStorage({
    execute: async (sql, params) => {
      const res = await db.execute(sql, params as never[]);
      return { rows: res.rows as unknown as string[][] | undefined };
    },
    transaction: (fn) =>
      db.transaction(async () => {
        await fn();
      }),
  });
}
