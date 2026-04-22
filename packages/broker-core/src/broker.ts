import type {
  Account,
  AccountBalances,
  AccountRef,
  BrokerId,
  Candle,
  CandleInterval,
  Order,
  OrderRequest,
  OptionsChain,
  Position,
  Quote,
} from './types';

/**
 * Capabilities advertised by an adapter so the UI can hide/disable
 * broker-specific features. Filled in once at construction time.
 */
export interface BrokerCapabilities {
  options: boolean;
  multiLegOptions: boolean;
  extendedHours: boolean;
  level2: boolean;
  paperTrading: boolean;
  /** Bracket / OCO order types supported natively. */
  bracketOrders: boolean;
  /** Streaming quotes via persistent connection. */
  streamingQuotes: boolean;
  /** Connector requires a Playwright login window (vs API key entry). */
  interactiveLogin: boolean;
}

export interface BrokerConnectOptions {
  /** Forces re-auth even if a stored session exists. */
  forceLogin?: boolean;
}

/**
 * The contract every broker adapter must satisfy. Adapters live in
 * sibling packages (`@opentrader/broker-alpaca`, `-robinhood`, `-fidelity`)
 * and are instantiated by the sidecar. The frontend never imports adapters
 * directly — it goes through the IPC layer.
 */
export interface Broker {
  readonly id: BrokerId;
  readonly label: string;
  readonly capabilities: BrokerCapabilities;

  // session lifecycle
  connect(opts?: BrokerConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // accounts
  listAccounts(): Promise<Account[]>;
  getBalances(account: AccountRef): Promise<AccountBalances>;

  // market data
  getQuote(symbol: string): Promise<Quote>;
  streamQuotes?(symbols: string[]): AsyncIterable<Quote>;
  getCandles(req: {
    symbol: string;
    interval: CandleInterval;
    from: number;
    to: number;
  }): Promise<Candle[]>;
  getOptionsChain?(req: { underlying: string; expiration?: string }): Promise<OptionsChain>;

  // trading
  placeOrder(req: OrderRequest): Promise<Order>;
  cancelOrder(account: AccountRef, orderId: string): Promise<void>;
  listOrders(account: AccountRef, opts?: { since?: string; limit?: number }): Promise<Order[]>;
  listPositions(account: AccountRef): Promise<Position[]>;
}

/**
 * Adapter factory signature. Lets the sidecar lazy-instantiate brokers
 * and inject shared deps (logger, secret store, persistent context root).
 */
export type BrokerFactory = (deps: BrokerDeps) => Broker;

export interface BrokerDeps {
  /** OS-keychain-backed secret read/write. */
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  /** On-disk root for Playwright user-data dirs, app DB, etc. */
  dataDir: string;
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, meta?: object) => void;
}
