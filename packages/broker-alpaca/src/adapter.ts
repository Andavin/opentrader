import type {
  Account,
  AccountBalances,
  AccountRef,
  AssetClass,
  Broker,
  BrokerCapabilities,
  BrokerConnectOptions,
  BrokerDeps,
  Candle,
  CandleInterval,
  DataFeed,
  OptionContract,
  OptionsChain,
  Order,
  OrderRequest,
  OrderStatus,
  Position,
  Quote,
  SymbolSnapshot,
  TimeInForce,
} from '@opentrader/broker-core';
import { z } from 'zod';

import { probeAlpacaFeeds, type AlpacaFeed } from './feeds';
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

/** Alpaca asset_class string → canonical AssetClass. Unknown values
 *  fall back to 'equity' (with a debug-time log) so we never surface
 *  a non-canonical string to widget code. */
const ASSET_CLASS_MAP: Record<string, AssetClass> = {
  us_equity: 'equity',
  us_option: 'option',
  crypto: 'crypto',
};

function mapAssetClass(raw: string): AssetClass {
  return ASSET_CLASS_MAP[raw] ?? 'equity';
}

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
  private feeds: DataFeed[] = [];
  private activeFeed: AlpacaFeed = 'iex';
  /** True once the user has explicitly picked a feed via setActiveDataFeed. */
  private userPickedFeed = false;

  constructor(private readonly deps: BrokerDeps) {}

  isConnected(): boolean {
    return this.rest !== null;
  }

  async connect(opts?: BrokerConnectOptions & Partial<AlpacaCredentials>): Promise<void> {
    const parsed = credentialsSchema.parse(opts);
    const rest = new AlpacaRest(parsed);
    await rest.getAccount(); // throws on bad creds
    this.creds = parsed;
    this.rest = rest;
    // refreshDataFeeds is best-effort — a probe failure shouldn't fail
    // the whole connect (the user is logged in either way), and we
    // don't want to leave the broker in a half-connected state where
    // isConnected() is true but feeds is empty.
    try {
      await this.refreshDataFeeds();
    } catch (e) {
      this.deps.log('warn', 'alpaca feed probe failed; defaulting to iex', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    this.deps.log('info', 'alpaca connected', { paper: parsed.paper, feed: this.activeFeed });
  }

  async disconnect(): Promise<void> {
    this.rest = null;
    this.creds = null;
    this.feeds = [];
    this.activeFeed = 'iex';
    this.userPickedFeed = false;
  }

  // ---- data-feed management ----

  listDataFeeds(): DataFeed[] {
    return this.feeds;
  }

  getActiveDataFeed(): string {
    return this.activeFeed;
  }

  setActiveDataFeed(feedId: string): void {
    const found = this.feeds.find((f) => f.id === feedId);
    if (!found) throw new Error(`unknown alpaca feed: ${feedId}`);
    if (!found.available) throw new Error(`feed ${feedId} not available on this subscription`);
    this.activeFeed = feedId as AlpacaFeed;
    this.userPickedFeed = true;
    this.deps.log('info', 'alpaca data feed changed', { feed: this.activeFeed });
  }

  async refreshDataFeeds(): Promise<DataFeed[]> {
    const rest = this.requireRest();
    const feeds = await probeAlpacaFeeds(rest);
    this.feeds = feeds;
    // Pick the active feed:
    //   1. If the current is no longer available, fall back to preferred.
    //   2. Else if the user has never explicitly chosen, upgrade to preferred
    //      (so initial connect picks SIP for paying users instead of leaving
    //      them on the default IEX).
    //   3. Else respect the user's explicit choice.
    const stillAvailable = feeds.find((f) => f.id === this.activeFeed && f.available);
    if (!stillAvailable || !this.userPickedFeed) {
      const fallback = feeds.find((f) => f.isPreferred) ?? feeds.find((f) => f.available);
      if (fallback) this.activeFeed = fallback.id as AlpacaFeed;
    }
    this.deps.log('info', 'alpaca feeds refreshed', {
      active: this.activeFeed,
      available: feeds.filter((f) => f.available).map((f) => f.id),
    });
    return feeds;
  }

  // ---- core broker methods ----

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
        type: 'individual',
        mode: this.creds.paper ? 'paper' : 'live',
        currency: a.currency,
      },
    ];
  }

  async getBalances(_account: AccountRef): Promise<AccountBalances> {
    const a = await this.requireRest().getAccount();
    const dayPnL = a.equity - a.last_equity;
    const dayPnLPct = a.last_equity ? dayPnL / a.last_equity : 0;
    return {
      equity: a.equity,
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
    const [q, t] = await Promise.all([
      rest.getLatestQuote(symbol, this.activeFeed),
      rest.getLatestTrade(symbol, this.activeFeed),
    ]);
    return {
      symbol,
      bid: q.bid,
      ask: q.ask,
      last: t.price,
      lastSize: t.size,
      asOf: t.asOf,
    };
  }

  async getSnapshot(symbol: string): Promise<SymbolSnapshot> {
    const rest = this.requireRest();
    const snap = await rest.getStockSnapshot(symbol, this.activeFeed);
    const last = snap.latestTrade?.p ?? snap.minuteBar?.c ?? snap.dailyBar?.c;
    const prevClose = snap.prevDailyBar?.c;
    const change = last != null && prevClose != null ? last - prevClose : undefined;
    const changePct = change != null && prevClose ? change / prevClose : undefined;
    return {
      symbol,
      last,
      change,
      changePct,
      bid: snap.latestQuote?.bp,
      ask: snap.latestQuote?.ap,
      open: snap.dailyBar?.o,
      high: snap.dailyBar?.h,
      low: snap.dailyBar?.l,
      prevClose,
      volume: snap.dailyBar?.v,
      prevVolume: snap.prevDailyBar?.v,
      asOf: snap.latestTrade?.t ?? snap.dailyBar?.t ?? new Date().toISOString(),
    };
  }

  async getOptionsChain(req: { underlying: string; expiration?: string }): Promise<OptionsChain> {
    const rest = this.requireRest();
    const contracts = await rest.listOptionContracts({
      underlying_symbol: req.underlying,
      expiration_date: req.expiration,
    });
    const snapshots = await rest.getOptionSnapshots(contracts.map((c) => c.symbol));
    const expirations = [...new Set(contracts.map((c) => c.expiration_date))].sort();
    const merged: OptionContract[] = contracts.map((c) => {
      const snap = snapshots[c.symbol];
      return {
        symbol: c.symbol,
        underlying: c.underlying_symbol,
        expiration: c.expiration_date,
        strike: c.strike_price,
        type: c.type,
        bid: snap?.latestQuote?.bp,
        ask: snap?.latestQuote?.ap,
        last: snap?.latestTrade?.p,
        mark:
          snap?.latestQuote?.bp != null && snap?.latestQuote?.ap != null
            ? (snap.latestQuote.bp + snap.latestQuote.ap) / 2
            : snap?.latestTrade?.p,
        openInterest: c.open_interest,
        iv: snap?.impliedVolatility,
        delta: snap?.greeks?.delta,
        gamma: snap?.greeks?.gamma,
        theta: snap?.greeks?.theta,
        vega: snap?.greeks?.vega,
        rho: snap?.greeks?.rho,
      };
    });
    return { underlying: req.underlying, expirations, contracts: merged };
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
      feed: this.activeFeed,
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
      assetClass: mapAssetClass(p.asset_class),
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
    const rest = this.requireRest();
    const tifMap: Record<TimeInForce, 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls'> = {
      day: 'day',
      gtc: 'gtc',
      ioc: 'ioc',
      fok: 'fok',
      opg: 'opg',
      cls: 'cls',
    };

    if (req.legs.length === 1) {
      const leg = req.legs[0]!;
      if (leg.assetClass !== 'equity' && leg.assetClass !== 'option') {
        throw new Error(`unsupported asset class for alpaca: ${leg.assetClass}`);
      }
      const side = leg.side === 'buy' ? 'buy' : leg.side === 'sell' ? 'sell' : null;
      if (!side) throw new Error(`unsupported side ${leg.side} for alpaca`);
      const placed = await rest.placeOrder({
        symbol: leg.symbol,
        qty: req.qty,
        side,
        type: req.orderType,
        time_in_force: tifMap[req.timeInForce],
        limit_price: req.limitPrice,
        stop_price: req.stopPrice,
        extended_hours: req.extendedHours,
        client_order_id: req.clientOrderId,
        order_class: req.bracket ? 'bracket' : undefined,
        take_profit: req.bracket?.takeProfitPrice
          ? { limit_price: req.bracket.takeProfitPrice }
          : undefined,
        stop_loss: req.bracket?.stopLossPrice
          ? {
              stop_price: req.bracket.stopLossPrice,
              limit_price: req.bracket.stopLossLimit,
            }
          : undefined,
      });
      return this.toCoreOrder(placed);
    }

    // Multi-leg: must all be options, market or limit, no bracket
    if (req.legs.some((l) => l.assetClass !== 'option')) {
      throw new Error('alpaca multi-leg orders must all be option legs');
    }
    if (req.orderType !== 'market' && req.orderType !== 'limit') {
      throw new Error('alpaca multi-leg orders only support market or limit type');
    }
    if (req.bracket) {
      throw new Error('bracket orders are not supported on multi-leg in alpaca');
    }
    const placed = await rest.placeMlegOrder({
      qty: req.qty,
      type: req.orderType,
      time_in_force: tifMap[req.timeInForce],
      limit_price: req.limitPrice,
      legs: req.legs.map((l) => {
        const side = l.side === 'buy' ? 'buy' : 'sell';
        // Default to opening intent — UI can override later.
        const intent = side === 'buy' ? 'buy_to_open' : 'sell_to_open';
        return {
          symbol: l.symbol,
          ratio_qty: l.ratio ?? 1,
          side,
          position_intent: intent,
        };
      }),
      client_order_id: req.clientOrderId,
    });
    return this.toCoreOrder(placed);
  }

  async cancelOrder(_account: AccountRef, orderId: string): Promise<void> {
    await this.requireRest().cancelOrder(orderId);
  }

  private toCoreOrder(o: AlpacaOrder): Order {
    // Alpaca occasionally returns side="" on system-generated orders
    // (auto-liquidations, expirations, broker-side cleanups). Normalize
    // unknown sides to 'buy' so the UI doesn't render an empty cell.
    const side: Order['legs'][number]['side'] =
      o.side === 'buy' || o.side === 'sell' || o.side === 'sell_short' || o.side === 'buy_to_cover'
        ? o.side
        : 'buy';
    return {
      id: o.id,
      account: { brokerId: this.id, accountId: 'self' },
      legs: [
        {
          symbol: o.symbol,
          assetClass: mapAssetClass(o.asset_class),
          side,
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
