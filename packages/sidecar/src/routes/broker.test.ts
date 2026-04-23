import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Broker, BrokerCapabilities, DataFeed } from '@opentrader/broker-core';

// Module-level mockable broker, swapped per test via vi.doMock so the
// route module's static import of registry resolves to ours.
let currentBroker: Broker | null = null;

vi.mock('../registry', () => ({
  getBroker: (id: string) => (id === 'alpaca' ? currentBroker : null),
  listBrokerIds: () => ['alpaca'],
}));

const { default: brokerRoutes } = await import('./broker');

const CAPS: BrokerCapabilities = {
  options: true,
  multiLegOptions: true,
  extendedHours: true,
  level2: false,
  paperTrading: true,
  bracketOrders: true,
  streamingQuotes: true,
  interactiveLogin: false,
};

function makeBroker(over: Partial<Broker> = {}): Broker {
  return {
    id: 'alpaca',
    label: 'Alpaca',
    capabilities: CAPS,
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    isConnected: vi.fn(() => true),
    listAccounts: vi.fn(async () => []),
    getBalances: vi.fn(async () => ({}) as never),
    getQuote: vi.fn(async () => ({ symbol: 'AAPL', bid: 1, ask: 2, last: 1.5, asOf: 'now' })),
    getCandles: vi.fn(async () => []),
    listPositions: vi.fn(async () => []),
    listOrders: vi.fn(async () => []),
    placeOrder: vi.fn(async () => ({}) as never),
    cancelOrder: vi.fn(async () => undefined),
    ...over,
  };
}

function buildApp() {
  const app = new Hono();
  app.route('/broker', brokerRoutes);
  return app;
}

describe('broker routes', () => {
  beforeEach(() => {
    currentBroker = makeBroker();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /:brokerId/status returns id, label, capabilities, connected', async () => {
    const app = buildApp();
    const res = await app.request('/broker/alpaca/status');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: 'alpaca',
      label: 'Alpaca',
      connected: true,
      capabilities: { options: true, paperTrading: true },
    });
  });

  it('returns 404 for unknown brokers', async () => {
    const app = buildApp();
    const res = await app.request('/broker/unknown/status');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.stringContaining('unknown broker') });
  });

  it('POST /:brokerId/connect forwards body to broker.connect', async () => {
    const app = buildApp();
    const res = await app.request('/broker/alpaca/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'k', secret: 's', paper: true }),
    });
    expect(res.status).toBe(200);
    expect(currentBroker?.connect).toHaveBeenCalledWith({ key: 'k', secret: 's', paper: true });
  });

  it('GET /:brokerId/quote/:symbol calls broker.getQuote', async () => {
    const app = buildApp();
    const res = await app.request('/broker/alpaca/quote/AAPL');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ symbol: 'AAPL', bid: 1, ask: 2, last: 1.5 });
    expect(currentBroker?.getQuote).toHaveBeenCalledWith('AAPL');
  });

  it('POST /:brokerId/orders validates the request body shape', async () => {
    const app = buildApp();
    const res = await app.request('/broker/alpaca/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderType: 'market' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'validation' });
  });

  it('POST /:brokerId/orders calls placeOrder with a valid request', async () => {
    const placed = vi.fn(async () => ({
      id: 'o1',
      account: { brokerId: 'alpaca', accountId: 'A' },
      legs: [{ symbol: 'AAPL', assetClass: 'equity', side: 'buy' }],
      orderType: 'limit',
      qty: 1,
      filledQty: 0,
      status: 'open',
      timeInForce: 'day',
      submittedAt: 'now',
      updatedAt: 'now',
    }));
    currentBroker = makeBroker({ placeOrder: placed as never });
    const app = buildApp();
    const res = await app.request('/broker/alpaca/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        account: { brokerId: 'alpaca', accountId: 'A' },
        legs: [{ symbol: 'AAPL', assetClass: 'equity', side: 'buy' }],
        orderType: 'limit',
        qty: 1,
        limitPrice: 100,
        timeInForce: 'day',
      }),
    });
    expect(res.status).toBe(200);
    expect(placed).toHaveBeenCalled();
  });

  describe('data-feed routes', () => {
    it('400s when broker does not implement data-feed methods', async () => {
      currentBroker = makeBroker(); // no data-feed methods
      const app = buildApp();
      const res = await app.request('/broker/alpaca/data-feed');
      expect(res.status).toBe(400);
    });

    it('GET /data-feed returns the broker-reported feeds + active', async () => {
      const feeds: DataFeed[] = [
        { id: 'sip', label: 'SIP', available: true, isPreferred: true },
        { id: 'iex', label: 'IEX', available: true },
      ];
      currentBroker = makeBroker({
        listDataFeeds: () => feeds,
        getActiveDataFeed: () => 'sip',
      });
      const app = buildApp();
      const res = await app.request('/broker/alpaca/data-feed');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ feeds, active: 'sip' });
    });

    it('POST /data-feed sets the feed via setActiveDataFeed', async () => {
      const setActive = vi.fn();
      currentBroker = makeBroker({
        listDataFeeds: () => [],
        getActiveDataFeed: () => 'iex',
        setActiveDataFeed: setActive,
      });
      const app = buildApp();
      const res = await app.request('/broker/alpaca/data-feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feed: 'sip' }),
      });
      expect(res.status).toBe(200);
      expect(setActive).toHaveBeenCalledWith('sip');
    });

    it('POST /data-feed/refresh re-probes via refreshDataFeeds', async () => {
      const feeds: DataFeed[] = [{ id: 'iex', label: 'IEX', available: true, isPreferred: true }];
      const refresh = vi.fn(async () => feeds);
      currentBroker = makeBroker({
        listDataFeeds: () => feeds,
        getActiveDataFeed: () => 'iex',
        refreshDataFeeds: refresh,
      });
      const app = buildApp();
      const res = await app.request('/broker/alpaca/data-feed/refresh', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(refresh).toHaveBeenCalled();
      expect(await res.json()).toEqual({ feeds, active: 'iex' });
    });
  });
});
