import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { getDb } from './db';
import { env } from './env';
import { createLogger } from './logger';
import brokerRoutes from './routes/broker';
import layoutRoutes from './routes/layouts';
import { listBrokerIds } from './registry';

const log = createLogger('sidecar');
const app = new Hono();

// CORS first — must run BEFORE the bearer-auth check below. Browser
// CORS preflights are OPTIONS requests with no Authorization header,
// so if auth ran first the preflight would 401 and the browser would
// abort the real request with "Failed to fetch" before ever sending
// it. Always-set the headers + short-circuit OPTIONS with 204.
//
// Threat model on the wide-open allow-origin:
//   - sidecar binds to 127.0.0.1 (HOST default) so only loopback peers
//     can reach it at all
//   - every non-/health route still requires the bearer token (set
//     below) so only same-machine processes that know the secret can
//     do anything beyond preflight
// Tauri prod loads the UI from tauri:// (outside browser CORS).
app.use('*', async (c, next) => {
  c.res.headers.set('access-control-allow-origin', '*');
  c.res.headers.set('access-control-allow-headers', 'authorization, content-type');
  c.res.headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  return next();
});

// Bearer-token auth on every route except /health.
app.use('*', async (c, next) => {
  if (c.req.path === '/health') return next();
  const auth = c.req.header('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (token !== env.OPENTRADER_SIDECAR_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

app.get('/health', (c) => c.json({ ok: true, brokers: listBrokerIds() }));

app.route('/broker', brokerRoutes);
app.route('/layouts', layoutRoutes);

// Open the SQLite db eagerly so the CREATE-IF-NOT-EXISTS migration runs
// on startup instead of on first layout save.
getDb();

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT });

log.info(`opentrader sidecar listening`, {
  url: `http://${env.HOST}:${env.PORT}`,
  brokers: listBrokerIds(),
});

const shutdown = (signal: NodeJS.Signals) => {
  log.info(`received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
