import { layouts, type LayoutRow } from '@opentrader/db';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { getDb } from '../db';

const app = new Hono();

// Mirror the error mapping from broker.ts so validation failures don't
// fall through as 500.
app.onError((err, c) => {
  if (err instanceof z.ZodError) {
    return c.json({ error: 'validation', issues: err.issues }, 400);
  }
  return c.json({ error: err.message ?? 'internal' }, 500);
});

const upsertSchema = z.object({
  name: z.string().min(1).max(64),
  position: z.number().int().min(0).default(0),
  iconName: z.string().optional(),
  dockviewState: z.record(z.string(), z.unknown()),
});

function rowToDto(r: LayoutRow) {
  return {
    id: r.id,
    name: r.name,
    position: r.position,
    iconName: r.iconName,
    dockviewState: r.dockviewState,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  };
}

app.get('/', (c) => {
  const db = getDb();
  const rows = db.select().from(layouts).orderBy(layouts.position).all();
  return c.json(rows.map(rowToDto));
});

app.get('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const row = db.select().from(layouts).where(eq(layouts.id, id)).get();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(rowToDto(row));
});

app.put('/:id', async (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const body = upsertSchema.parse(await c.req.json());
  const now = Date.now();
  // Atomic upsert via on-conflict.
  db.insert(layouts)
    .values({
      id,
      name: body.name,
      position: body.position,
      iconName: body.iconName,
      dockviewState: body.dockviewState,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
    .onConflictDoUpdate({
      target: layouts.id,
      set: {
        name: body.name,
        position: body.position,
        iconName: body.iconName,
        dockviewState: body.dockviewState,
        updatedAt: sql`(unixepoch() * 1000)`,
      },
    })
    .run();
  const row = db.select().from(layouts).where(eq(layouts.id, id)).get();
  return c.json(rowToDto(row!));
});

app.delete('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');
  db.delete(layouts).where(eq(layouts.id, id)).run();
  return c.json({ deleted: true });
});

export default app;
