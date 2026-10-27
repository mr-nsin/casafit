import type { SqlDriver, SqlValue } from './driver';
import { runMigrations } from './migrations';
import { createSqlRepositories } from './sqlRepositories';
import type { Repositories } from './repositories';

/** The part of op-sqlite's DB we use. */
interface OpDb {
  execute(query: string, params?: SqlValue[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export function createOpSqliteDriver(db: OpDb): SqlDriver {
  // One connection and one open transaction at a time: serialise transactions so
  // two callers cannot interleave BEGIN/COMMIT.
  let lock: Promise<unknown> = Promise.resolve();
  return {
    async run(sql, params) {
      await db.execute(sql, params);
    },
    async all<T>(sql: string, params?: SqlValue[]) {
      return (await db.execute(sql, params)).rows as T[];
    },
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      const next = lock.then(async () => {
        await db.execute('BEGIN');
        try {
          const out = await fn();
          await db.execute('COMMIT');
          return out;
        } catch (e) {
          await db.execute('ROLLBACK');
          throw e;
        }
      });
      lock = next.catch(() => undefined);
      return next;
    },
  };
}

/**
 * Opens the on-device database, migrates it and returns the repositories.
 * The native module is required lazily so Jest never loads it.
 * Not exercised in Jest: verify on a dev build (see report).
 */
export async function openAppDatabase(name = 'casafit.db'): Promise<{ driver: SqlDriver; repos: Repositories }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
  const db = open({ name });
  const driver = createOpSqliteDriver(db as unknown as OpDb);
  await driver.run('PRAGMA journal_mode = WAL');
  await driver.run('PRAGMA foreign_keys = ON');
  await runMigrations(driver);
  return { driver, repos: createSqlRepositories(driver) };
}
