import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { env } from './env';
import { createLogger } from './logger';
import brokerRoutes from './routes/broker';
import { listBrokerIds } from './registry';

const log = createLogger('sidecar');
const app = new Hono();

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

// Permissive CORS for the dev frontend (Vite at :1420). Tauri prod builds
// load the UI from a tauri:// origin so this is only relevant in dev.
app.use('*', async (c, next) => {
  c.res.headers.set('access-control-allow-origin', '*');
  c.res.headers.set('access-control-allow-headers', 'authorization, content-type');
  c.res.headers.set('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  return next();
});

app.get('/health', (c) => c.json({ ok: true, brokers: listBrokerIds() }));

app.route('/broker', brokerRoutes);

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
