import { describe, expect, it } from "vitest";
import { COLLECTIONS, InMemoryStorage, type StoredEntity } from "../src/index.js";

interface Item extends StoredEntity {
  id: string;
  schemaVersion: number;
  value: number;
}

const item = (id: string, value: number): Item => ({ id, schemaVersion: 1, value });

describe("InMemoryStorage contract", () => {
  it("loadAll returns empty for unknown collections", async () => {
    const s = new InMemoryStorage();
    expect(await s.loadAll(COLLECTIONS.records)).toEqual([]);
  });

  it("persistAll replaces the whole collection", async () => {
    const s = new InMemoryStorage();
    await s.persistAll<Item>(COLLECTIONS.records, [item("a", 1), item("b", 2)]);
    await s.persistAll<Item>(COLLECTIONS.records, [item("c", 3)]);
    expect(await s.loadAll<Item>(COLLECTIONS.records)).toEqual([item("c", 3)]);
  });

  it("delete removes only the targeted entity", async () => {
    const s = new InMemoryStorage();
    await s.persistAll<Item>(COLLECTIONS.records, [item("a", 1), item("b", 2)]);
    await s.delete(COLLECTIONS.records, "a");
    expect(await s.loadAll<Item>(COLLECTIONS.records)).toEqual([item("b", 2)]);
  });

  it("delete of a missing id is a no-op", async () => {
    const s = new InMemoryStorage();
    await s.persistAll<Item>(COLLECTIONS.records, [item("a", 1)]);
    await expect(s.delete(COLLECTIONS.records, "zzz")).resolves.toBeUndefined();
    expect(await s.loadAll<Item>(COLLECTIONS.records)).toHaveLength(1);
  });
});
