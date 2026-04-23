import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrokerDeps, OrderRequest } from '@opentrader/broker-core';

import { createAlpacaBroker } from './adapter';
import { AlpacaApiError } from './rest';

const VALID_CREDS = { key: 'PKKEYKEYKEY', secret: 'SECRETSECRET', paper: true } as const;

const ACCOUNT_FIXTURE = {
  id: 'acct-uuid',
  account_number: 'PA12345',
  status: 'ACTIVE',
  currency: 'USD',
  cash: '10000',
  portfolio_value: '12000',
  buying_power: '20000',
  options_buying_power: '15000',
  equity: '12000',
  last_equity: '11800',
  trading_blocked: false,
  account_blocked: false,
};

const POSITION_FIXTURE = {
  symbol: 'AAPL',
  asset_class: 'us_equity',
  qty: '10',
  avg_entry_price: '150',
  current_price: '160',
  market_value: '1600',
  cost_basis: '1500',
  unrealized_pl: '100',
  unrealized_plpc: '0.0667',
  unrealized_intraday_pl: '20',
  unrealized_intraday_plpc: '0.0125',
  side: 'long',
};

const ORDER_FIXTURE = {
  id: 'order-1',
  client_order_id: 'cli-1',
  symbol: 'AAPL',
  asset_class: 'us_equity',
  qty: '5',
  filled_qty: '5',
  filled_avg_price: '160.10',
  limit_price: '160',
  stop_price: null,
  side: 'buy' as const,
  order_type: 'limit',
  time_in_force: 'day',
  status: 'filled',
  extended_hours: false,
  submitted_at: '2026-04-23T15:00:00Z',
  updated_at: '2026-04-23T15:00:01Z',
};

function makeDeps(): BrokerDeps {
  return {
    secrets: {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    dataDir: '/tmp/opentrader-test',
    log: vi.fn(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Fetch stub that pattern-matches request URL → response. */
function makeFetch(matchers: Array<{ test: (u: URL) => boolean; respond: (u: URL) => Response }>) {
  return vi.fn(async (input: URL | RequestInfo) => {
    const u = new URL(typeof input === 'string' ? input : (input as URL | Request).toString());
    const m = matchers.find((x) => x.test(u));
    if (!m) throw new Error(`unmocked fetch: ${u.toString()}`);
    return m.respond(u);
  }) as unknown as typeof fetch;
}

describe('AlpacaBroker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('rejects credentials that fail validation', async () => {
      const broker = createAlpacaBroker(makeDeps());
      await expect(
        broker.connect({ key: 'short', secret: 'short', paper: true }),
      ).rejects.toThrow();
      expect(broker.isConnected()).toBe(false);
    });

    it('validates credentials by calling /v2/account and probes feeds on success', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetch([
          {
            test: (u) => u.pathname === '/v2/account',
            respond: () => jsonResponse(ACCOUNT_FIXTURE),
          },
          {
            test: (u) => u.pathname.includes('/bars'),
            respond: () =>
              jsonResponse({
                symbol: 'AAPL',
                bars: [{ t: '2026-04-22T13:30:00Z', o: 1, h: 1, l: 1, c: 1, v: 1 }],
              }),
          },
        ]),
      );
      const broker = createAlpacaBroker(makeDeps());
      await broker.connect(VALID_CREDS);
      expect(broker.isConnected()).toBe(true);
      expect(broker.listDataFeeds?.()).toBeDefined();
      // sip is preferred when all three return 200
      expect(broker.getActiveDataFeed?.()).toBe('sip');
    });

    it('propagates the AlpacaApiError when the account check 401s', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetch([
          {
            test: (u) => u.pathname === '/v2/account',
            respond: () => new Response('forbidden', { status: 401 }),
          },
        ]),
      );
      const broker = createAlpacaBroker(makeDeps());
      await expect(broker.connect(VALID_CREDS)).rejects.toBeInstanceOf(AlpacaApiError);
      expect(broker.isConnected()).toBe(false);
    });

    it('still finishes connect when refreshDataFeeds throws — broker stays connected on iex default', async () => {
      // Account succeeds; the bars probe always 500s. connect() should
      // log the warn but stay connected — partial connection is worse
      // than no feeds.
      vi.stubGlobal(
        'fetch',
        makeFetch([
          {
            test: (u) => u.pathname === '/v2/account',
            respond: () => jsonResponse(ACCOUNT_FIXTURE),
          },
          {
            test: (u) => u.pathname.includes('/bars'),
            respond: () => new Response('boom', { status: 500 }),
          },
        ]),
      );
      const broker = createAlpacaBroker(makeDeps());
      await broker.connect(VALID_CREDS);
      expect(broker.isConnected()).toBe(true);
      expect(broker.getActiveDataFeed?.()).toBe('iex');
    });
  });

  describe('after connect', () => {
    async function connected() {
      vi.stubGlobal(
        'fetch',
        makeFetch([
          {
            test: (u) => u.pathname === '/v2/account',
            respond: () => jsonResponse(ACCOUNT_FIXTURE),
          },
          {
            test: (u) => u.pathname.includes('/bars'),
            respond: () =>
              jsonResponse({
                symbol: 'AAPL',
                bars: [{ t: '2026-04-22T13:30:00Z', o: 1, h: 1, l: 1, c: 1, v: 1 }],
              }),
          },
          {
            test: (u) => u.pathname === '/v2/positions',
            respond: () => jsonResponse([POSITION_FIXTURE]),
          },
          {
            test: (u) => u.pathname === '/v2/orders' && u.searchParams.get('status') !== null,
            respond: () => jsonResponse([ORDER_FIXTURE]),
          },
          { test: (u) => u.pathname === '/v2/orders', respond: () => jsonResponse(ORDER_FIXTURE) },
          {
            test: (u) => u.pathname.includes('/quotes/latest'),
            respond: () =>
              jsonResponse({ symbol: 'AAPL', quote: { t: 'now', bp: 160, ap: 160.05 } }),
          },
          {
            test: (u) => u.pathname.includes('/trades/latest'),
            respond: () => jsonResponse({ symbol: 'AAPL', trade: { t: 'now', p: 160.02, s: 100 } }),
          },
        ]),
      );
      const broker = createAlpacaBroker(makeDeps());
      await broker.connect(VALID_CREDS);
      return broker;
    }

    it('listAccounts maps to the canonical Account shape (one per key)', async () => {
      const broker = await connected();
      const accounts = await broker.listAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        brokerId: 'alpaca',
        accountId: 'acct-uuid',
        name: 'PA12345',
        type: 'individual',
        mode: 'paper',
      });
    });

    it('getBalances derives day P&L from equity vs last_equity', async () => {
      const broker = await connected();
      const b = await broker.getBalances({ brokerId: 'alpaca', accountId: 'acct-uuid' });
      expect(b.equity).toBe(12000);
      expect(b.dayPnL).toBeCloseTo(200);
      expect(b.dayPnLPct).toBeCloseTo(200 / 11800);
    });

    it('listPositions maps us_equity → equity and surfaces P&L fields', async () => {
      const broker = await connected();
      const positions = await broker.listPositions({ brokerId: 'alpaca', accountId: 'acct-uuid' });
      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        symbol: 'AAPL',
        assetClass: 'equity',
        qty: 10,
        avgEntryPrice: 150,
        currentPrice: 160,
      });
      expect(positions[0]?.unrealizedPnL).toBe(100);
      expect(positions[0]?.dayPnL).toBe(20);
    });

    it('listOrders normalizes empty side ("") to "buy" and us_option → option', async () => {
      // Alpaca occasionally returns side="" and asset_class="us_option"
      // on system orders. Adapter must normalize without dropping.
      const SYSTEM_ORDER = {
        ...ORDER_FIXTURE,
        id: 'sys-1',
        side: '',
        asset_class: 'us_option',
        symbol: 'NVDA251219P00181000',
        status: 'filled',
      };
      vi.stubGlobal(
        'fetch',
        makeFetch([
          {
            test: (u) => u.pathname === '/v2/account',
            respond: () => jsonResponse(ACCOUNT_FIXTURE),
          },
          {
            test: (u) => u.pathname.includes('/bars'),
            respond: () =>
              jsonResponse({
                symbol: 'AAPL',
                bars: [{ t: '2026-04-22T13:30:00Z', o: 1, h: 1, l: 1, c: 1, v: 1 }],
              }),
          },
          { test: (u) => u.pathname === '/v2/orders', respond: () => jsonResponse([SYSTEM_ORDER]) },
        ]),
      );
      const broker = createAlpacaBroker(makeDeps());
      await broker.connect(VALID_CREDS);
      const orders = await broker.listOrders({ brokerId: 'alpaca', accountId: 'A' });
      expect(orders).toHaveLength(1);
      expect(orders[0]?.legs[0]?.side).toBe('buy'); // normalized from ""
      expect(orders[0]?.legs[0]?.assetClass).toBe('option'); // mapped from us_option
    });

    it('listOrders maps the Alpaca order to the canonical Order with mapped status', async () => {
      const broker = await connected();
      const orders = await broker.listOrders({ brokerId: 'alpaca', accountId: 'acct-uuid' });
      expect(orders).toHaveLength(1);
      expect(orders[0]).toMatchObject({
        id: 'order-1',
        status: 'filled',
        qty: 5,
        filledQty: 5,
        avgFillPrice: 160.1,
      });
      expect(orders[0]?.legs[0]).toMatchObject({
        symbol: 'AAPL',
        side: 'buy',
        assetClass: 'equity',
      });
    });

    it('getQuote combines latest quote + latest trade', async () => {
      const broker = await connected();
      const q = await broker.getQuote('AAPL');
      expect(q).toMatchObject({ symbol: 'AAPL', bid: 160, ask: 160.05, last: 160.02 });
    });

    it('placeOrder rejects multi-leg with non-option legs', async () => {
      const broker = await connected();
      const ref = { brokerId: 'alpaca' as const, accountId: 'acct-uuid' };
      const mixedLegs: OrderRequest = {
        account: ref,
        legs: [
          { symbol: 'AAPL', assetClass: 'equity', side: 'buy' },
          { symbol: 'AAPL', assetClass: 'equity', side: 'sell' },
        ],
        orderType: 'market',
        qty: 1,
        timeInForce: 'day',
      };
      await expect(broker.placeOrder(mixedLegs)).rejects.toThrow(/multi-leg.*option/i);
    });

    it('placeOrder rejects single-leg with unsupported asset class (e.g. crypto)', async () => {
      const broker = await connected();
      const cryptoLeg: OrderRequest = {
        account: { brokerId: 'alpaca', accountId: 'acct-uuid' },
        legs: [{ symbol: 'BTCUSD', assetClass: 'crypto', side: 'buy' }],
        orderType: 'market',
        qty: 0.01,
        timeInForce: 'day',
      };
      await expect(broker.placeOrder(cryptoLeg)).rejects.toThrow(/unsupported asset class/);
    });

    it('placeOrder accepts a single-leg option order (phase 3)', async () => {
      const broker = await connected();
      const order = await broker.placeOrder({
        account: { brokerId: 'alpaca', accountId: 'acct-uuid' },
        legs: [{ symbol: 'AAPL241220C00150000', assetClass: 'option', side: 'buy' }],
        orderType: 'limit',
        qty: 1,
        limitPrice: 1.5,
        timeInForce: 'day',
      });
      expect(order.id).toBe('order-1');
    });

    it('placeOrder rejects multi-leg market+stop order types', async () => {
      const broker = await connected();
      const stopMultileg: OrderRequest = {
        account: { brokerId: 'alpaca', accountId: 'acct-uuid' },
        legs: [
          { symbol: 'AAPL241220C00150000', assetClass: 'option', side: 'buy' },
          { symbol: 'AAPL241220C00160000', assetClass: 'option', side: 'sell' },
        ],
        orderType: 'stop',
        qty: 1,
        stopPrice: 1.0,
        timeInForce: 'day',
      };
      await expect(broker.placeOrder(stopMultileg)).rejects.toThrow(/market or limit/);
    });

    it('placeOrder builds the Alpaca payload and round-trips through toCoreOrder', async () => {
      const broker = await connected();
      const placed = await broker.placeOrder({
        account: { brokerId: 'alpaca', accountId: 'acct-uuid' },
        legs: [{ symbol: 'AAPL', assetClass: 'equity', side: 'buy' }],
        orderType: 'limit',
        qty: 5,
        limitPrice: 160,
        timeInForce: 'day',
      });
      expect(placed).toMatchObject({ id: 'order-1', status: 'filled' });
    });

    it('disconnect clears credentials and feed state', async () => {
      const broker = await connected();
      await broker.disconnect();
      expect(broker.isConnected()).toBe(false);
      expect(broker.getActiveDataFeed?.()).toBe('iex');
      expect(broker.listDataFeeds?.()).toEqual([]);
    });
  });
});
