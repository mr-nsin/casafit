/**
 * Test-only SqlDriver backed by Node's built-in node:sqlite, so migrations and
 * repositories run against real SQLite in Jest with no extra dependency.
 * Never import this from app code.
 */
import type { SqlDriver, SqlValue } from '../driver';
import { runMigrations } from '../migrations';
import { createSqlRepositories } from '../sqlRepositories';
import type { Repositories } from '../repositories';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => NodeDb;
};

// No @types/node in this package, so describe the few members we use.
interface NodeDb {
  prepare(sql: string): { run(...p: SqlValue[]): unknown; all(...p: SqlValue[]): unknown[] };
  exec(sql: string): void;
  close(): void;
}

export function createNodeSqliteDriver(): SqlDriver & { close(): void } {
  const db = new DatabaseSync(':memory:');
  return {
    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async transaction<T>(fn: () => Promise<T>) {
      db.exec('BEGIN');
      try {
        const out = await fn();
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
}

export async function createTestDb(): Promise<{
  driver: ReturnType<typeof createNodeSqliteDriver>;
  repos: Repositories;
}> {
  const driver = createNodeSqliteDriver();
  await runMigrations(driver);
  return { driver, repos: createSqlRepositories(driver) };
}
