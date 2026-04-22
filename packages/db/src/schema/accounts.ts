import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * One row per (broker, accountId) pair the user has connected.
 * Credentials live in the OS keychain — only references and metadata here.
 */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(), // `${brokerId}:${accountId}`
  brokerId: text('broker_id').notNull(), // 'alpaca' | 'robinhood' | 'fidelity'
  accountId: text('account_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  mode: text('mode', { enum: ['paper', 'live'] }).notNull(),
  currency: text('currency').notNull().default('USD'),
  /** Keychain ref for the encrypted session/credential blob. */
  keychainKey: text('keychain_key').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastConnectedAt: integer('last_connected_at', { mode: 'timestamp_ms' }),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
