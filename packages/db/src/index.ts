import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';

export type OpentraderDb = BetterSQLite3Database<typeof schema>;

export interface OpenDbOptions {
  /** Filesystem path to the SQLite file. */
  url: string;
  /** Run PRAGMA tweaks for write-heavy workloads. */
  wal?: boolean;
}

export function openDb({ url, wal = true }: OpenDbOptions): OpentraderDb {
  const sqlite = new Database(url);
  if (wal) {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('foreign_keys = ON');
  }
  return drizzle(sqlite, { schema });
}

export { schema };
export * from './schema';
