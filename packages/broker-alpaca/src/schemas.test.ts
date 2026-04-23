import { describe, expect, it } from 'vitest';

import {
  accountSchema,
  barSchema,
  barsResponseSchema,
  latestQuoteSchema,
  latestTradeSchema,
  orderSchema,
  positionSchema,
} from './schemas';

describe('alpaca schemas', () => {
  it('parses an account response, coercing string-encoded numerics', () => {
    const raw = {
      id: 'acct-1',
      account_number: 'PA1234',
      status: 'ACTIVE',
      currency: 'USD',
      cash: '12345.67',
      portfolio_value: '50000.00',
      buying_power: '24691.34',
      equity: '50000.00',
      last_equity: '49000.00',
      trading_blocked: false,
      account_blocked: false,
    };
    const parsed = accountSchema.parse(raw);
    expect(parsed.cash).toBe(12345.67);
    expect(parsed.portfolio_value).toBe(50000);
    expect(parsed.buying_power).toBe(24691.34);
  });

  it('parses a position response with intraday P&L', () => {
    const raw = {
      symbol: 'AAPL',
      asset_class: 'us_equity',
      qty: '10',
      avg_entry_price: '150.00',
      current_price: '160.50',
      market_value: '1605.00',
      cost_basis: '1500.00',
      unrealized_pl: '105.00',
      unrealized_plpc: '0.07',
      unrealized_intraday_pl: '15.00',
      unrealized_intraday_plpc: '0.0094',
      side: 'long',
    };
    const parsed = positionSchema.parse(raw);
    expect(parsed.qty).toBe(10);
    expect(parsed.unrealized_pl).toBe(105);
    expect(parsed.unrealized_plpc).toBeCloseTo(0.07);
  });

  it('parses an order with nullable price fields', () => {
    const raw = {
      id: 'ord-1',
      client_order_id: 'cli-1',
      symbol: 'AAPL',
      asset_class: 'us_equity',
      qty: '5',
      filled_qty: '0',
      filled_avg_price: null,
      limit_price: '149.00',
      stop_price: null,
      side: 'buy',
      order_type: 'limit',
      time_in_force: 'day',
      status: 'new',
      extended_hours: false,
      submitted_at: '2026-04-23T15:00:00Z',
      updated_at: '2026-04-23T15:00:00Z',
    };
    const parsed = orderSchema.parse(raw);
    expect(parsed.qty).toBe(5);
    expect(parsed.limit_price).toBe(149);
    expect(parsed.filled_avg_price).toBeNull();
  });

  it('parses latest quote and latest trade responses', () => {
    const q = latestQuoteSchema.parse({
      symbol: 'AAPL',
      quote: { t: '2026-04-23T15:00:00Z', bp: 160.0, ap: 160.05, bs: 100, as: 200 },
    });
    expect(q.quote.bp).toBe(160);
    const t = latestTradeSchema.parse({
      symbol: 'AAPL',
      trade: { t: '2026-04-23T15:00:00Z', p: 160.02, s: 50 },
    });
    expect(t.trade.p).toBe(160.02);
  });

  it('parses bars response and accepts null bars (no data window)', () => {
    const empty = barsResponseSchema.parse({ symbol: 'AAPL', bars: null });
    expect(empty.bars).toEqual([]);
    const populated = barsResponseSchema.parse({
      symbol: 'AAPL',
      bars: [{ t: '2026-04-22T13:30:00Z', o: 158, h: 161, l: 157.5, c: 160, v: 100000 }],
      next_page_token: null,
    });
    expect(populated.bars).toHaveLength(1);
    expect(populated.bars[0]).toEqual(
      barSchema.parse({ t: '2026-04-22T13:30:00Z', o: 158, h: 161, l: 157.5, c: 160, v: 100000 }),
    );
  });
});
