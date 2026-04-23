import { z } from 'zod';

import {
  accountSchema,
  barsResponseSchema,
  latestQuoteSchema,
  latestTradeSchema,
  orderSchema,
  positionSchema,
  type AlpacaAccount,
  type AlpacaBar,
  type AlpacaOrder,
  type AlpacaPosition,
} from './schemas';

export interface AlpacaCredentials {
  key: string;
  secret: string;
  paper: boolean;
}

export type AlpacaTimeframe =
  | '1Min'
  | '2Min'
  | '5Min'
  | '15Min'
  | '30Min'
  | '1Hour'
  | '2Hour'
  | '4Hour'
  | '1Day'
  | '1Week'
  | '1Month';

export type AlpacaFeedName = 'sip' | 'delayed_sip' | 'iex' | 'boats' | 'overnight';

const TRADING_BASE = {
  paper: 'https://paper-api.alpaca.markets',
  live: 'https://api.alpaca.markets',
} as const;

const DATA_BASE = 'https://data.alpaca.markets';

export class AlpacaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(message);
  }
}

/** Thin REST client. No external SDK — see memory note for rationale. */
export class AlpacaRest {
  constructor(private readonly creds: AlpacaCredentials) {}

  get tradingBase(): string {
    return this.creds.paper ? TRADING_BASE.paper : TRADING_BASE.live;
  }

  private headers(): HeadersInit {
    return {
      'APCA-API-KEY-ID': this.creds.key,
      'APCA-API-SECRET-KEY': this.creds.secret,
      'content-type': 'application/json',
    };
  }

  private async req<T>(
    base: string,
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
  ): Promise<T> {
    const url = new URL(path, base);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, { ...init, headers: { ...this.headers(), ...init.headers } });
    const text = await res.text();
    if (!res.ok) {
      throw new AlpacaApiError(`alpaca ${init.method ?? 'GET'} ${path} ${res.status}`, res.status, text);
    }
    const json: unknown = text.length ? JSON.parse(text) : {};
    return schema.parse(json);
  }

  // ---- trading API ----

  getAccount(): Promise<AlpacaAccount> {
    return this.req(this.tradingBase, '/v2/account', accountSchema);
  }

  listPositions(): Promise<AlpacaPosition[]> {
    return this.req(this.tradingBase, '/v2/positions', z.array(positionSchema));
  }

  listOrders(opts: { status?: 'open' | 'closed' | 'all'; limit?: number } = {}): Promise<AlpacaOrder[]> {
    return this.req(this.tradingBase, '/v2/orders', z.array(orderSchema), {
      query: {
        status: opts.status ?? 'all',
        limit: opts.limit ?? 100,
        nested: 'true',
      },
    });
  }

  placeOrder(body: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
    time_in_force: 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls';
    limit_price?: number;
    stop_price?: number;
    extended_hours?: boolean;
    client_order_id?: string;
  }): Promise<AlpacaOrder> {
    return this.req(this.tradingBase, '/v2/orders', orderSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  cancelOrder(orderId: string): Promise<void> {
    return this.req(this.tradingBase, `/v2/orders/${orderId}`, z.unknown(), {
      method: 'DELETE',
    }).then(() => undefined);
  }

  // ---- market data API ----

  async getLatestQuote(
    symbol: string,
    feed: AlpacaFeedName,
  ): Promise<{ bid: number; ask: number; asOf: string }> {
    const path = `/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`;
    const res = await this.req(DATA_BASE, path, latestQuoteSchema, { query: { feed } });
    return { bid: res.quote.bp, ask: res.quote.ap, asOf: res.quote.t };
  }

  async getLatestTrade(
    symbol: string,
    feed: AlpacaFeedName,
  ): Promise<{ price: number; size?: number; asOf: string }> {
    const path = `/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`;
    const res = await this.req(DATA_BASE, path, latestTradeSchema, { query: { feed } });
    return { price: res.trade.p, size: res.trade.s, asOf: res.trade.t };
  }

  async getBars(opts: {
    symbol: string;
    timeframe: AlpacaTimeframe;
    start: string;
    end: string;
    limit?: number;
    feed: AlpacaFeedName;
  }): Promise<AlpacaBar[]> {
    const path = `/v2/stocks/${encodeURIComponent(opts.symbol)}/bars`;
    const all: AlpacaBar[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.req(DATA_BASE, path, barsResponseSchema, {
        query: {
          timeframe: opts.timeframe,
          start: opts.start,
          end: opts.end,
          limit: opts.limit ?? 10000,
          adjustment: 'raw',
          feed: opts.feed,
          page_token: pageToken,
        },
      });
      if (res.bars) all.push(...res.bars);
      pageToken = res.next_page_token ?? undefined;
    } while (pageToken && all.length < (opts.limit ?? Number.POSITIVE_INFINITY));
    return all;
  }
}
