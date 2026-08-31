/**
 * Reusable Storage contract test suite (design D4 / spec platform-storage).
 *
 * Every Storage implementation — InMemoryStorage (core), RnStorage
 * (platform-rn), TauriFileStorage (platform-tauri), and any future
 * implementation (e.g. an OPFS-backed PWA store) — runs the SAME
 * assertions, pinning behavior equivalence across engines.
 *
 * Usage in a package's vitest setup:
 *
 *   import { describeStorageContract } from "@auktake/core/testing";
 *   describeStorageContract("TauriFileStorage", () => new TauriFileStorage(memFs, "/data.json"));
 */
import { describe, expect, it } from "vitest";
import { COLLECTIONS, type Storage, type StoredEntity } from "../index.js";

export interface TestEntity extends StoredEntity {
  id: string;
  schemaVersion: number;
  value: number;
}

export const entity = (id: string, value: number): TestEntity => ({
  id,
  schemaVersion: 1,
  value,
});

export function describeStorageContract(
  name: string,
  make: () => Storage | Promise<Storage>,
): void {
  describe(`Storage contract: ${name}`, () => {
    it("loadAll returns empty for unknown collections", async () => {
      const s = await makeStorage(make);
      expect(await s.loadAll<TestEntity>(COLLECTIONS.records)).toEqual([]);
    });

    it("persistAll replaces the whole collection", async () => {
      const s = await makeStorage(make);
      await s.persistAll<TestEntity>(COLLECTIONS.records, [entity("a", 1), entity("b", 2)]);
      await s.persistAll<TestEntity>(COLLECTIONS.records, [entity("c", 3)]);
      expect(await s.loadAll<TestEntity>(COLLECTIONS.records)).toEqual([entity("c", 3)]);
    });

    it("persistAll does not touch other collections", async () => {
      const s = await makeStorage(make);
      await s.persistAll<TestEntity>(COLLECTIONS.records, [entity("a", 1)]);
      await s.persistAll<TestEntity>(COLLECTIONS.tags, [entity("t1", 9)]);
      expect(await s.loadAll<TestEntity>(COLLECTIONS.records)).toEqual([entity("a", 1)]);
      expect(await s.loadAll<TestEntity>(COLLECTIONS.tags)).toEqual([entity("t1", 9)]);
    });

    it("delete removes only the targeted entity", async () => {
      const s = await makeStorage(make);
      await s.persistAll<TestEntity>(COLLECTIONS.records, [entity("a", 1), entity("b", 2)]);
      await s.delete(COLLECTIONS.records, "a");
      expect(await s.loadAll<TestEntity>(COLLECTIONS.records)).toEqual([entity("b", 2)]);
    });

    it("delete of a missing id is a no-op", async () => {
      const s = await makeStorage(make);
      await s.persistAll<TestEntity>(COLLECTIONS.records, [entity("a", 1)]);
      await expect(s.delete(COLLECTIONS.records, "zzz")).resolves.toBeUndefined();
      expect(await s.loadAll<TestEntity>(COLLECTIONS.records)).toHaveLength(1);
    });
  });
}

/** Allows factories that are fresh-per-suite or fresh-per-test. */
function makeStorage(make: () => Storage | Promise<Storage>): Promise<Storage> {
  return Promise.resolve(make());
}
