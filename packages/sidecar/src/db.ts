import { resolve } from 'node:path';

import { openDb, type OpentraderDb } from '@opentrader/db';

import { env } from './env';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    broker_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    mode TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    keychain_key TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    last_connected_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    icon_name TEXT,
    dockview_state TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS paper_orders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL,
    side TEXT NOT NULL,
    order_type TEXT NOT NULL,
    qty REAL NOT NULL,
    filled_qty REAL NOT NULL DEFAULT 0,
    limit_price REAL,
    stop_price REAL,
    avg_fill_price REAL,
    status TEXT NOT NULL,
    time_in_force TEXT NOT NULL,
    extended_hours INTEGER NOT NULL DEFAULT 0,
    legs TEXT NOT NULL,
    bracket TEXT,
    client_order_id TEXT,
    submitted_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS paper_positions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL,
    qty REAL NOT NULL,
    avg_entry_price REAL NOT NULL,
    opened_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS symbol_cache (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    exchange TEXT,
    asset_class TEXT NOT NULL,
    refreshed_at INTEGER NOT NULL
  );
`;

let cached: OpentraderDb | null = null;

/**
 * Lazy-init the SQLite instance and CREATE TABLE IF NOT EXISTS for
 * every schema table. Skipping drizzle-kit migrations on purpose —
 * single-user, idempotent inits at startup are simpler than carrying
 * a migrations directory through to production.
 */
export function getDb(): OpentraderDb {
  if (cached) return cached;
  const url = resolve(env.OPENTRADER_DATA_DIR, 'opentrader.db');
  cached = openDb({ url });
  // better-sqlite3 supports executing multiple statements via .exec
  // on the underlying handle. Drizzle exposes .$client for that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cached as unknown as { $client: { exec: (sql: string) => void } }).$client.exec(SCHEMA_SQL);
  return cached;
}
