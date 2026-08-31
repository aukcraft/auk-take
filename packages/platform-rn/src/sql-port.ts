/**
 * Narrow port over @op-engineering/op-sqlite. Only what RnStorage needs;
 * tests inject an in-memory driver so the whole implementation runs in
 * pure Node without native code.
 *
 * Mirrors the real op-sqlite API shape: async execute, transaction with
 * an async callback that commits when the callback resolves.
 */
export interface SqlPort {
  /** Execute SQL with params; SELECT returns rows. */
  execute(sql: string, params?: unknown[]): Promise<{ rows?: unknown[][] } | void>;
  /** Run statements inside a transaction; rolls back on rejection. */
  transaction(fn: () => Promise<void>): Promise<void>;
}
