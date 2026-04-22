import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { accounts } from './accounts';

/** Paper-trading order ledger. */
export const paperOrders = sqliteTable('paper_orders', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull(),
  side: text('side').notNull(),
  orderType: text('order_type').notNull(),
  qty: real('qty').notNull(),
  filledQty: real('filled_qty').notNull().default(0),
  limitPrice: real('limit_price'),
  stopPrice: real('stop_price'),
  avgFillPrice: real('avg_fill_price'),
  status: text('status').notNull(),
  timeInForce: text('time_in_force').notNull(),
  extendedHours: integer('extended_hours', { mode: 'boolean' }).notNull().default(false),
  /** Multi-leg payload (legs[]). Single-leg orders also use this for uniformity. */
  legs: text('legs', { mode: 'json' }).$type<unknown[]>().notNull(),
  bracket: text('bracket', { mode: 'json' }).$type<unknown>(),
  clientOrderId: text('client_order_id'),
  submittedAt: integer('submitted_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Open paper-trading positions, computed from filled paper_orders. */
export const paperPositions = sqliteTable('paper_positions', {
  id: text('id').primaryKey(), // `${accountId}:${symbol}`
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  assetClass: text('asset_class').notNull(),
  qty: real('qty').notNull(),
  avgEntryPrice: real('avg_entry_price').notNull(),
  openedAt: integer('opened_at', { mode: 'timestamp_ms' }).notNull(),
});

export type PaperOrderRow = typeof paperOrders.$inferSelect;
export type NewPaperOrderRow = typeof paperOrders.$inferInsert;
export type PaperPositionRow = typeof paperPositions.$inferSelect;
export type NewPaperPositionRow = typeof paperPositions.$inferInsert;
