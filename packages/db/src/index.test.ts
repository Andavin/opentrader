import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { layouts, openDb, prefs } from './index';

const SCHEMA_SQL = `
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
`;

let tmpDir = '';

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opentrader-db-'));
});

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe('openDb', () => {
  it('creates a sqlite handle that supports drizzle queries', () => {
    const db = openDb({ url: join(tmpDir, 'opentrader.db') });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as unknown as { $client: { exec: (sql: string) => void } }).$client.exec(SCHEMA_SQL);
    db.insert(layouts)
      .values({
        id: 'a',
        name: 'A',
        position: 0,
        dockviewState: { v: 1 },
      })
      .run();
    const rows = db.select().from(layouts).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('A');
    expect(rows[0]?.dockviewState).toEqual({ v: 1 });
  });

  it('round-trips JSON values through prefs', () => {
    const db = openDb({ url: join(tmpDir, 'prefs.db') });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as unknown as { $client: { exec: (sql: string) => void } }).$client.exec(SCHEMA_SQL);
    db.insert(prefs)
      .values({ key: 'theme', value: { aura: 'profit', density: 'compact' } })
      .run();
    const row = db.select().from(prefs).all();
    expect(row[0]?.value).toEqual({ aura: 'profit', density: 'compact' });
  });
});
