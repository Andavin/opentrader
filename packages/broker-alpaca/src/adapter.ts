import type {
  Account,
  AccountBalances,
  AccountRef,
  Broker,
  BrokerCapabilities,
  BrokerConnectOptions,
  BrokerDeps,
  Candle,
  CandleInterval,
  Order,
  OrderRequest,
  OrderStatus,
  Position,
  Quote,
  TimeInForce,
} from '@opentrader/broker-core';
import { z } from 'zod';

import { AlpacaRest, type AlpacaCredentials, type AlpacaTimeframe } from './rest';
import type { AlpacaOrder } from './schemas';

const credentialsSchema = z.object({
  key: z.string().min(8),
  secret: z.string().min(8),
  paper: z.boolean().default(true),
});

const ALPACA_CAPS: BrokerCapabilities = {
  options: true,
  multiLegOptions: true,
  extendedHours: true,
  level2: false,
  paperTrading: true,
  bracketOrders: true,
  streamingQuotes: true,
  interactiveLogin: false,
};

const INTERVAL_MAP: Record<CandleInterval, AlpacaTimeframe> = {
  '1m': '1Min',
  '2m': '2Min',
  '5m': '5Min',
  '15m': '15Min',
  '30m': '30Min',
  '1h': '1Hour',
  '2h': '2Hour',
  '4h': '4Hour',
  '1d': '1Day',
  '1w': '1Week',
  '1M': '1Month',
};

const ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  new: 'open',
  accepted: 'open',
  pending_new: 'pending',
  partially_filled: 'partial',
  filled: 'filled',
  done_for_day: 'expired',
  canceled: 'cancelled',
  expired: 'expired',
  rejected: 'rejected',
  replaced: 'open',
  pending_cancel: 'open',
  pending_replace: 'open',
  stopped: 'open',
  suspended: 'open',
  calculated: 'open',
  held: 'open',
};

class AlpacaBroker implements Broker {
  readonly id = 'alpaca' as const;
  readonly label = 'Alpaca';
  readonly capabilities = ALPACA_CAPS;

  private rest: AlpacaRest | null = null;
  private creds: AlpacaCredentials | null = null;

  constructor(private readonly deps: BrokerDeps) {}

  isConnected(): boolean {
    return this.rest !== null;
  }

  async connect(opts?: BrokerConnectOptions & Partial<AlpacaCredentials>): Promise<void> {
    const parsed = credentialsSchema.parse(opts);
    const rest = new AlpacaRest(parsed);
    // Validate by fetching the account; throws AlpacaApiError on bad creds.
    await rest.getAccount();
    this.creds = parsed;
    this.rest = rest;
    this.deps.log('info', 'alpaca connected', { paper: parsed.paper });
  }

  async disconnect(): Promise<void> {
    this.rest = null;
    this.creds = null;
  }

  private requireRest(): AlpacaRest {
    if (!this.rest) throw new Error('alpaca not connected');
    return this.rest;
  }

  async listAccounts(): Promise<Account[]> {
    if (!this.rest || !this.creds) return [];
    const a = await this.rest.getAccount();
    return [
      {
        brokerId: this.id,
        accountId: a.id,
        name: a.account_number,
        // Alpaca exposes a single brokerage account per key; extending later
        // when sub-account API is wired in.
        type: 'individual',
        mode: this.creds.paper ? 'paper' : 'live',
        currency: a.currency,
      },
    ];
  }

  async getBalances(_account: AccountRef): Promise<AccountBalances> {
    const a = await this.requireRest().getAccount();
    const equity = a.equity;
    const lastEquity = a.last_equity;
    const dayPnL = equity - lastEquity;
    const dayPnLPct = lastEquity ? dayPnL / lastEquity : 0;
    return {
      equity,
      cash: a.cash,
      buyingPower: a.buying_power,
      optionBuyingPower: a.options_buying_power,
      marketValue: a.portfolio_value,
      dayPnL,
      dayPnLPct,
      asOf: new Date().toISOString(),
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const rest = this.requireRest();
    const [q, t] = await Promise.all([rest.getLatestQuote(symbol), rest.getLatestTrade(symbol)]);
    return {
      symbol,
      bid: q.bid,
      ask: q.ask,
      last: t.price,
      lastSize: t.size,
      asOf: t.asOf,
    };
  }

  async getCandles(req: {
    symbol: string;
    interval: CandleInterval;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    const rest = this.requireRest();
    const bars = await rest.getBars({
      symbol: req.symbol,
      timeframe: INTERVAL_MAP[req.interval],
      start: new Date(req.from).toISOString(),
      end: new Date(req.to).toISOString(),
    });
    return bars.map((b) => ({
      time: new Date(b.t).getTime(),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }));
  }

  async listPositions(_account: AccountRef): Promise<Position[]> {
    const positions = await this.requireRest().listPositions();
    return positions.map((p) => ({
      symbol: p.symbol,
      assetClass: (p.asset_class === 'us_equity' ? 'equity' : (p.asset_class as Position['assetClass'])),
      qty: p.qty,
      avgEntryPrice: p.avg_entry_price,
      marketValue: p.market_value,
      currentPrice: p.current_price,
      unrealizedPnL: p.unrealized_pl,
      unrealizedPnLPct: p.unrealized_plpc,
      dayPnL: p.unrealized_intraday_pl,
      dayPnLPct: p.unrealized_intraday_plpc,
    }));
  }

  async listOrders(_account: AccountRef): Promise<Order[]> {
    const orders = await this.requireRest().listOrders({ status: 'all' });
    return orders.map((o) => this.toCoreOrder(o));
  }

  async placeOrder(req: OrderRequest): Promise<Order> {
    if (req.legs.length !== 1) {
      throw new Error('multi-leg orders land in phase 3');
    }
    const leg = req.legs[0]!;
    if (leg.assetClass !== 'equity') {
      throw new Error('only equities supported in phase 1');
    }
    const side = leg.side === 'buy' ? 'buy' : leg.side === 'sell' ? 'sell' : null;
    if (!side) throw new Error(`unsupported side ${leg.side} for alpaca`);
    const tifMap: Record<TimeInForce, 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls'> = {
      day: 'day',
      gtc: 'gtc',
      ioc: 'ioc',
      fok: 'fok',
      opg: 'opg',
      cls: 'cls',
    };
    const placed = await this.requireRest().placeOrder({
      symbol: leg.symbol,
      qty: req.qty,
      side,
      type: req.orderType,
      time_in_force: tifMap[req.timeInForce],
      limit_price: req.limitPrice,
      stop_price: req.stopPrice,
      extended_hours: req.extendedHours,
      client_order_id: req.clientOrderId,
    });
    return this.toCoreOrder(placed);
  }

  async cancelOrder(_account: AccountRef, orderId: string): Promise<void> {
    await this.requireRest().cancelOrder(orderId);
  }

  private toCoreOrder(o: AlpacaOrder): Order {
    return {
      id: o.id,
      account: { brokerId: this.id, accountId: 'self' },
      legs: [
        {
          symbol: o.symbol,
          assetClass: 'equity',
          side: o.side,
          ratio: 1,
        },
      ],
      orderType: (o.order_type as Order['orderType']) ?? 'market',
      qty: o.qty,
      filledQty: o.filled_qty,
      avgFillPrice: o.filled_avg_price ?? undefined,
      limitPrice: o.limit_price ?? undefined,
      stopPrice: o.stop_price ?? undefined,
      status: ORDER_STATUS_MAP[o.status] ?? 'open',
      timeInForce: (o.time_in_force as TimeInForce) ?? 'day',
      extendedHours: o.extended_hours,
      submittedAt: o.submitted_at,
      updatedAt: o.updated_at,
    };
  }
}

export function createAlpacaBroker(deps: BrokerDeps): Broker {
  return new AlpacaBroker(deps);
}
