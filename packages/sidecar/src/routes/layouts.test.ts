import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Point the sidecar's data dir at a fresh temp dir before any module
// reads `env`. We re-import the route module under each test so the
// db instance is rebuilt against the current DATA_DIR.
let tmpDir = '';

beforeEach(() => {
  vi.resetModules();
  tmpDir = mkdtempSync(join(tmpdir(), 'opentrader-layouts-'));
  process.env.OPENTRADER_DATA_DIR = tmpDir;
  process.env.OPENTRADER_SIDECAR_TOKEN = 'test-token-12345';
});

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

async function buildApp() {
  const { default: layoutRoutes } = await import('./layouts');
  const app = new Hono();
  app.route('/layouts', layoutRoutes);
  return app;
}

describe('layouts route', () => {
  it('returns an empty list against a fresh database', async () => {
    const app = await buildApp();
    const res = await app.request('/layouts');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('PUT creates the layout, GET retrieves it', async () => {
    const app = await buildApp();
    const put = await app.request('/layouts/foo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Foo',
        position: 3,
        iconName: 'star',
        dockviewState: { panels: ['a', 'b'] },
      }),
    });
    expect(put.status).toBe(200);
    const created = await put.json();
    expect(created).toMatchObject({
      id: 'foo',
      name: 'Foo',
      position: 3,
      iconName: 'star',
      dockviewState: { panels: ['a', 'b'] },
    });

    const get = await app.request('/layouts/foo');
    expect(get.status).toBe(200);
    expect((await get.json()).dockviewState).toEqual({ panels: ['a', 'b'] });
  });

  it('PUT to an existing id is an upsert', async () => {
    const app = await buildApp();
    await app.request('/layouts/foo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', position: 0, dockviewState: { v: 1 } }),
    });
    const put2 = await app.request('/layouts/foo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'B', position: 1, dockviewState: { v: 2 } }),
    });
    expect(put2.status).toBe(200);
    const updated = await put2.json();
    expect(updated.name).toBe('B');
    expect(updated.position).toBe(1);
    expect(updated.dockviewState).toEqual({ v: 2 });
  });

  it('PUT validates body — rejects empty name with a 400', async () => {
    const app = await buildApp();
    const res = await app.request('/layouts/foo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', position: 0, dockviewState: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('GET unknown id returns 404 with structured error body', async () => {
    const app = await buildApp();
    const res = await app.request('/layouts/missing');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('DELETE drops the layout', async () => {
    const app = await buildApp();
    await app.request('/layouts/x', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X', position: 0, dockviewState: {} }),
    });
    const del = await app.request('/layouts/x', { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ deleted: true });
    const get = await app.request('/layouts/x');
    expect(get.status).toBe(404);
  });
});
