/**
 * Minimal async SQL surface the repositories depend on. Production wraps
 * op-sqlite (see opsqlite.ts); Jest uses node:sqlite (see testing/).
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Runs fn inside BEGIN/COMMIT; rolls back if fn throws. Not re-entrant. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export async function getOne<T>(
  d: SqlDriver,
  sql: string,
  params?: SqlValue[],
): Promise<T | null> {
  const rows = await d.all<T>(sql, params);
  return rows[0] ?? null;
}
