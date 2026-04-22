import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Generic key/value bag for app-wide preferences (theme overrides,
 * default broker, hotkey overrides, last-active layout, etc.).
 */
export const prefs = sqliteTable('prefs', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
});

export type PrefRow = typeof prefs.$inferSelect;
export type NewPrefRow = typeof prefs.$inferInsert;
