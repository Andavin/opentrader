import type {
  Account,
  AccountBalances,
  AccountRef,
  BrokerCapabilities,
  BrokerId,
  Candle,
  CandleInterval,
  DataFeed,
  OptionsChain,
  Order,
  OrderRequest,
  Position,
  Quote,
  SymbolSnapshot,
} from '@opentrader/broker-core';

import { sidecarFetch } from './sidecarClient';

export interface BrokerStatus {
  id: BrokerId;
  label: string;
  capabilities: BrokerCapabilities;
  connected: boolean;
}

export interface DataFeedState {
  feeds: DataFeed[];
  active: string;
}

export const brokerClient = {
  status: (brokerId: BrokerId) => sidecarFetch<BrokerStatus>(`/broker/${brokerId}/status`),

  connect: (brokerId: BrokerId, credentials: object) =>
    sidecarFetch<{ connected: true }>(`/broker/${brokerId}/connect`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  disconnect: (brokerId: BrokerId) =>
    sidecarFetch<{ connected: false }>(`/broker/${brokerId}/disconnect`, { method: 'POST' }),

  listAccounts: (brokerId: BrokerId) => sidecarFetch<Account[]>(`/broker/${brokerId}/accounts`),

  getBalances: (ref: AccountRef) =>
    sidecarFetch<AccountBalances>(`/broker/${ref.brokerId}/balances/${ref.accountId}`),

  listPositions: (ref: AccountRef) =>
    sidecarFetch<Position[]>(`/broker/${ref.brokerId}/positions/${ref.accountId}`),

  listOrders: (ref: AccountRef) =>
    sidecarFetch<Order[]>(`/broker/${ref.brokerId}/orders/${ref.accountId}`),

  placeOrder: (req: OrderRequest) =>
    sidecarFetch<Order>(`/broker/${req.account.brokerId}/orders`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  cancelOrder: (ref: AccountRef, orderId: string) =>
    sidecarFetch<{ cancelled: true }>(
      `/broker/${ref.brokerId}/orders/${ref.accountId}/${orderId}/cancel`,
      { method: 'POST' },
    ),

  getQuote: (brokerId: BrokerId, symbol: string) =>
    sidecarFetch<Quote>(`/broker/${brokerId}/quote/${encodeURIComponent(symbol)}`),

  getCandles: (
    brokerId: BrokerId,
    req: { symbol: string; interval: CandleInterval; from: number; to: number },
  ) => sidecarFetch<Candle[]>(`/broker/${brokerId}/candles`, { query: req }),

  getDataFeed: (brokerId: BrokerId) =>
    sidecarFetch<DataFeedState>(`/broker/${brokerId}/data-feed`),

  setDataFeed: (brokerId: BrokerId, feed: string) =>
    sidecarFetch<{ active: string }>(`/broker/${brokerId}/data-feed`, {
      method: 'POST',
      body: JSON.stringify({ feed }),
    }),

  refreshDataFeed: (brokerId: BrokerId) =>
    sidecarFetch<DataFeedState>(`/broker/${brokerId}/data-feed/refresh`, { method: 'POST' }),

  getSnapshot: (brokerId: BrokerId, symbol: string) =>
    sidecarFetch<SymbolSnapshot>(`/broker/${brokerId}/snapshot/${encodeURIComponent(symbol)}`),

  getOptionsChain: (
    brokerId: BrokerId,
    req: { underlying: string; expiration?: string },
  ) =>
    sidecarFetch<OptionsChain>(
      `/broker/${brokerId}/options/${encodeURIComponent(req.underlying)}`,
      { query: { expiration: req.expiration } },
    ),
};

