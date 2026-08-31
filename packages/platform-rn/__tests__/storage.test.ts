import { describe, expect, it } from "vitest";
import { describeStorageContract } from "@auktake/core/testing";
import { RnStorage } from "../src/storage.js";
import type { SqlPort } from "../src/sql-port.js";

/**
 * In-memory SqlPort simulating op-sqlite semantics (async API):
 * tables of rows, JSON strings in the single `json` column,
 * real transaction rollback on rejection.
 */
class MemSql implements SqlPort {
  readonly tables = new Map<string, Map<string, string>>();

  private table(name: string): Map<string, string> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  private parseName(sql: string): string {
    return sql.match(/"([^"]+)"/)![1]!;
  }

  async execute(sql: string, params: unknown[] = []) {
    const stmt = sql.trim().toUpperCase();
    if (stmt.startsWith("CREATE TABLE IF NOT EXISTS")) {
      this.table(this.parseName(sql));
      return;
    }
    if (stmt.startsWith("SELECT")) {
      const rows = [...this.table(this.parseName(sql)).entries()].map(
        ([, json]) => [json],
      );
      return { rows };
    }
    if (stmt.startsWith("DELETE FROM")) {
      const name = this.parseName(sql);
      if (sql.includes("WHERE")) {
        this.table(name).delete(params[0] as string);
      } else {
        this.table(name).clear();
      }
      return;
    }
    if (stmt.startsWith("INSERT INTO")) {
      this.table(this.parseName(sql)).set(params[0] as string, params[1] as string);
      return;
    }
    throw new Error(`unsupported sql: ${sql}`);
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    const snapshot = new Map(
      [...this.tables.entries()].map(([k, v]) => [k, new Map(v)]),
    );
    try {
      await fn();
    } catch (e) {
      this.tables.clear();
      for (const [k, v] of snapshot) this.tables.set(k, v);
      throw e;
    }
  }
}

describeStorageContract("RnStorage", () => new RnStorage(new MemSql()));

describe("RnStorage transaction atomicity", () => {
  it("persistAll rolls back fully when a row insert fails mid-transaction", async () => {
    const sql = new MemSql();
    const s = new RnStorage(sql);
    await s.persistAll("records", [{ id: "old", schemaVersion: 1, value: 0 }]);

    // Sabotage: INSERT of id 'x' throws
    const sabotaged: SqlPort = {
      transaction: (fn) => sql.transaction(fn),
      execute: async (stmt, params) => {
        if (stmt.startsWith("INSERT") && params?.[0] === "x") {
          throw new Error("insert failed");
        }
        return sql.execute(stmt, params);
      },
    };
    const s2 = new RnStorage(sabotaged);
    await expect(
      s2.persistAll("records", [
        { id: "a", schemaVersion: 1, value: 1 },
        { id: "x", schemaVersion: 1, value: 2 },
      ]),
    ).rejects.toThrow("insert failed");

    // rollback restored pre-transaction content
    const rows = await new RnStorage(sql).loadAll("records");
    expect(rows).toEqual([{ id: "old", schemaVersion: 1, value: 0 }]);
  });
});
