import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Cache of basic symbol metadata so search + display don't hammer the
 * broker on every keystroke. Refreshed lazily.
 */
export const symbolCache = sqliteTable('symbol_cache', {
  symbol: text('symbol').primaryKey(),
  name: text('name'),
  exchange: text('exchange'),
  assetClass: text('asset_class').notNull(),
  refreshedAt: integer('refreshed_at', { mode: 'timestamp_ms' }).notNull(),
});

export type SymbolCacheRow = typeof symbolCache.$inferSelect;
