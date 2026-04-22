/**
 * Core domain types shared across every broker adapter.
 *
 * Adapters convert their broker's wire format INTO these shapes; the rest
 * of the app only ever talks to these types. New brokers add themselves
 * to BrokerId and implement the Broker interface.
 */

export type BrokerId = 'alpaca' | 'robinhood' | 'fidelity';

export type AssetClass = 'equity' | 'option' | 'crypto' | 'future';

export type OrderSide = 'buy' | 'sell' | 'sell_short' | 'buy_to_cover';

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';

export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls';

export type OrderStatus =
  | 'pending'
  | 'open'
  | 'partial'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export type OptionType = 'call' | 'put';

export type Mode = 'paper' | 'live';

/** OCC-style option symbol metadata, parsed for display + math. */
export interface OptionLegSymbol {
  underlying: string;
  expiration: string; // YYYY-MM-DD
  strike: number;
  type: OptionType;
}

export interface AccountRef {
  brokerId: BrokerId;
  accountId: string;
}

export interface Account extends AccountRef {
  /** Display name like "Individual", "Roth IRA". */
  name: string;
  type: 'individual' | 'joint' | 'roth_ira' | 'trad_ira' | 'margin' | 'cash' | 'other';
  mode: Mode;
  currency: string;
}

export interface AccountBalances {
  equity: number;
  cash: number;
  buyingPower: number;
  optionBuyingPower?: number;
  dayPnL: number;
  dayPnLPct: number;
  marketValue: number;
  asOf: string; // ISO timestamp
}

export interface Quote {
  symbol: string;
  bid: number;
  bidSize?: number;
  ask: number;
  askSize?: number;
  last: number;
  lastSize?: number;
  prevClose?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  asOf: string;
}

export type CandleInterval =
  | '1m'
  | '2m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '1d'
  | '1w'
  | '1M';

export interface Candle {
  /** Bar open time (ms since epoch). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptionContract {
  symbol: string; // OCC symbol
  underlying: string;
  expiration: string;
  strike: number;
  type: OptionType;
  bid?: number;
  ask?: number;
  last?: number;
  mark?: number;
  volume?: number;
  openInterest?: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}

export interface OptionsChain {
  underlying: string;
  expirations: string[];
  contracts: OptionContract[];
}

export interface Position {
  symbol: string;
  assetClass: AssetClass;
  qty: number;
  avgEntryPrice: number;
  marketValue: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  dayPnL: number;
  dayPnLPct: number;
  /** Net option Greeks if assetClass === 'option'. */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    rho?: number;
  };
}

export interface OrderLeg {
  symbol: string;
  assetClass: AssetClass;
  side: OrderSide;
  /** Ratio for spreads; 1 for single-leg. */
  ratio?: number;
}

export interface OrderRequest {
  account: AccountRef;
  legs: OrderLeg[];
  orderType: OrderType;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  trailAmount?: number;
  trailPercent?: number;
  timeInForce: TimeInForce;
  extendedHours?: boolean;
  /** OCO/bracket bracket spec — additive vs Robinhood Legend. */
  bracket?: {
    takeProfitPrice?: number;
    stopLossPrice?: number;
    stopLossLimit?: number;
  };
  clientOrderId?: string;
}

export interface Order {
  id: string;
  account: AccountRef;
  legs: OrderLeg[];
  orderType: OrderType;
  qty: number;
  filledQty: number;
  avgFillPrice?: number;
  limitPrice?: number;
  stopPrice?: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  extendedHours?: boolean;
  submittedAt: string;
  updatedAt: string;
}
