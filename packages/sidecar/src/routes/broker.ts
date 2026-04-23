import { Hono } from 'hono';
import { z } from 'zod';

import { getBroker, listBrokerIds } from '../registry';

const app = new Hono();

const accountRefSchema = z.object({
  brokerId: z.enum(['alpaca', 'robinhood', 'fidelity']),
  accountId: z.string(),
});

const intervalSchema = z.enum(['1m', '2m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M']);

const candlesQuerySchema = z.object({
  symbol: z.string(),
  interval: intervalSchema,
  from: z.coerce.number().int(),
  to: z.coerce.number().int(),
});

const orderRequestSchema = z.object({
  account: accountRefSchema,
  legs: z
    .array(
      z.object({
        symbol: z.string(),
        assetClass: z.enum(['equity', 'option', 'crypto', 'future']),
        side: z.enum(['buy', 'sell', 'sell_short', 'buy_to_cover']),
        ratio: z.number().int().positive().optional(),
      }),
    )
    .min(1),
  orderType: z.enum(['market', 'limit', 'stop', 'stop_limit', 'trailing_stop']),
  qty: z.number().positive(),
  limitPrice: z.number().optional(),
  stopPrice: z.number().optional(),
  trailAmount: z.number().optional(),
  trailPercent: z.number().optional(),
  timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok', 'opg', 'cls']),
  extendedHours: z.boolean().optional(),
  bracket: z
    .object({
      takeProfitPrice: z.number().optional(),
      stopLossPrice: z.number().optional(),
      stopLossLimit: z.number().optional(),
    })
    .optional(),
  clientOrderId: z.string().optional(),
});

function brokerOr404(id: string) {
  const b = getBroker(id);
  if (!b) throw new HTTPNotFound(`unknown broker: ${id}`);
  return b;
}

class HTTPNotFound extends Error {}
class HTTPBadRequest extends Error {}

app.onError((err, c) => {
  if (err instanceof HTTPNotFound) return c.json({ error: err.message }, 404);
  if (err instanceof HTTPBadRequest) return c.json({ error: err.message }, 400);
  if (err instanceof z.ZodError) return c.json({ error: 'validation', issues: err.issues }, 400);
  return c.json({ error: err.message ?? 'internal' }, 500);
});

app.get('/', (c) => {
  // Aggregate of every registered broker's status — lets the UI render
  // the broker list (account dropdown, data-source picker) in one
  // round-trip instead of N parallel /status calls.
  const out = listBrokerIds().map((id) => {
    const b = getBroker(id);
    if (!b) return null;
    return {
      id: b.id,
      label: b.label,
      capabilities: b.capabilities,
      connected: b.isConnected(),
    };
  });
  return c.json(out.filter((x): x is NonNullable<typeof x> => x !== null));
});

app.get('/:brokerId/status', (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  return c.json({
    id: broker.id,
    label: broker.label,
    capabilities: broker.capabilities,
    connected: broker.isConnected(),
  });
});

app.post('/:brokerId/connect', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  // Adapter-specific: each broker validates its own credentials shape during connect().
  await broker.connect(body);
  return c.json({ connected: true });
});

app.post('/:brokerId/disconnect', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  await broker.disconnect();
  return c.json({ connected: false });
});

app.get('/:brokerId/accounts', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  return c.json(await broker.listAccounts());
});

app.get('/:brokerId/balances/:accountId', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const ref = { brokerId: broker.id, accountId: c.req.param('accountId') };
  return c.json(await broker.getBalances(ref));
});

app.get('/:brokerId/positions/:accountId', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const ref = { brokerId: broker.id, accountId: c.req.param('accountId') };
  return c.json(await broker.listPositions(ref));
});

app.get('/:brokerId/orders/:accountId', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const ref = { brokerId: broker.id, accountId: c.req.param('accountId') };
  return c.json(await broker.listOrders(ref));
});

app.post('/:brokerId/orders', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const req = orderRequestSchema.parse(await c.req.json());
  return c.json(await broker.placeOrder(req));
});

app.post('/:brokerId/orders/:accountId/:orderId/cancel', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const ref = { brokerId: broker.id, accountId: c.req.param('accountId') };
  await broker.cancelOrder(ref, c.req.param('orderId'));
  return c.json({ cancelled: true });
});

app.get('/:brokerId/quote/:symbol', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  return c.json(await broker.getQuote(c.req.param('symbol')));
});

app.get('/:brokerId/snapshot/:symbol', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  if (!broker.getSnapshot) throw new HTTPBadRequest('broker has no snapshot support');
  return c.json(await broker.getSnapshot(c.req.param('symbol')));
});

app.get('/:brokerId/candles', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  const q = candlesQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  return c.json(await broker.getCandles(q));
});

app.get('/:brokerId/options/:underlying', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  if (!broker.getOptionsChain) throw new HTTPBadRequest('broker has no options support');
  const underlying = c.req.param('underlying');
  const expiration = c.req.query('expiration') ?? undefined;
  return c.json(await broker.getOptionsChain({ underlying, expiration }));
});

// ---- data-feed selection (only brokers that implement the optional methods) ----

const setFeedSchema = z.object({ feed: z.string() });

app.get('/:brokerId/data-feed', (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  if (!broker.listDataFeeds || !broker.getActiveDataFeed) {
    throw new HTTPBadRequest('broker does not expose data-feed selection');
  }
  return c.json({ feeds: broker.listDataFeeds(), active: broker.getActiveDataFeed() });
});

app.post('/:brokerId/data-feed', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  if (!broker.setActiveDataFeed) {
    throw new HTTPBadRequest('broker does not expose data-feed selection');
  }
  const { feed } = setFeedSchema.parse(await c.req.json());
  broker.setActiveDataFeed(feed);
  return c.json({ active: feed });
});

app.post('/:brokerId/data-feed/refresh', async (c) => {
  const broker = brokerOr404(c.req.param('brokerId'));
  if (!broker.refreshDataFeeds || !broker.getActiveDataFeed) {
    throw new HTTPBadRequest('broker does not expose data-feed selection');
  }
  const feeds = await broker.refreshDataFeeds();
  return c.json({ feeds, active: broker.getActiveDataFeed() });
});

export default app;
