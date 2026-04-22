import type { Broker, BrokerConnectOptions } from './broker';
import type {
  AccountBalances,
  AccountRef,
  Candle,
  CandleInterval,
  Order,
  OrderRequest,
  OptionsChain,
  Position,
  Quote,
} from './types';

/**
 * Wraps a real broker so reads pass through (positions, balances, quotes,
 * candles, chain) but writes route to a simulated execution layer.
 * Phase-0 stub — fill engine + persistence will land in phase 2.
 */
export class PaperBroker implements Broker {
  readonly id;
  readonly label;
  readonly capabilities;
  readonly streamQuotes?: (symbols: string[]) => AsyncIterable<Quote>;
  readonly getOptionsChain?: (req: {
    underlying: string;
    expiration?: string;
  }) => Promise<OptionsChain>;

  constructor(private readonly inner: Broker) {
    this.id = inner.id;
    this.label = `${inner.label} (paper)`;
    this.capabilities = { ...inner.capabilities, paperTrading: true };
    if (inner.streamQuotes) {
      this.streamQuotes = inner.streamQuotes.bind(inner);
    }
    if (inner.getOptionsChain) {
      this.getOptionsChain = inner.getOptionsChain.bind(inner);
    }
  }

  connect(opts?: BrokerConnectOptions): Promise<void> {
    return this.inner.connect(opts);
  }

  disconnect(): Promise<void> {
    return this.inner.disconnect();
  }

  isConnected(): boolean {
    return this.inner.isConnected();
  }

  listAccounts() {
    return this.inner.listAccounts();
  }

  getQuote(symbol: string): Promise<Quote> {
    return this.inner.getQuote(symbol);
  }

  getCandles(req: {
    symbol: string;
    interval: CandleInterval;
    from: number;
    to: number;
  }): Promise<Candle[]> {
    return this.inner.getCandles(req);
  }

  async getBalances(_account: AccountRef): Promise<AccountBalances> {
    throw new Error('PaperBroker.getBalances not implemented (phase 2)');
  }

  async placeOrder(_req: OrderRequest): Promise<Order> {
    throw new Error('PaperBroker.placeOrder not implemented (phase 2)');
  }

  async cancelOrder(_account: AccountRef, _orderId: string): Promise<void> {
    throw new Error('PaperBroker.cancelOrder not implemented (phase 2)');
  }

  async listOrders(_account: AccountRef): Promise<Order[]> {
    return [];
  }

  async listPositions(_account: AccountRef): Promise<Position[]> {
    return [];
  }
}
