import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Saved dockview layouts. Each row is a "tab" / workspace in the top-level
 * tab strip; `dockviewState` holds the serialized layout JSON returned by
 * `api.toJSON()`.
 */
export const layouts = sqliteTable('layouts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Display order in the top tab strip. */
  position: integer('position').notNull().default(0),
  iconName: text('icon_name'),
  dockviewState: text('dockview_state', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type LayoutRow = typeof layouts.$inferSelect;
export type NewLayoutRow = typeof layouts.$inferInsert;
