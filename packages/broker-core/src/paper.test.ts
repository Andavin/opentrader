import { describe, expect, it, vi } from 'vitest';

import type {
  Account,
  AccountBalances,
  AccountRef,
  Broker,
  BrokerCapabilities,
  Candle,
  DataFeed,
  Order,
  OrderRequest,
  OptionsChain,
  Position,
  Quote,
} from './types';
import { PaperBroker } from './paper';

const ALPACA_REF: AccountRef = { brokerId: 'alpaca', accountId: 'X' };

function makeStubBroker(overrides: Partial<Broker> = {}): Broker {
  const caps: BrokerCapabilities = {
    options: false,
    multiLegOptions: false,
    extendedHours: true,
    level2: false,
    paperTrading: false,
    bracketOrders: false,
    streamingQuotes: false,
    interactiveLogin: false,
  };
  const base: Broker = {
    id: 'alpaca',
    label: 'Stub',
    capabilities: caps,
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    isConnected: vi.fn(() => true),
    listAccounts: vi.fn(async () => [] as Account[]),
    getBalances: vi.fn(async () => ({}) as AccountBalances),
    getQuote: vi.fn(async (s: string): Promise<Quote> => ({
      symbol: s,
      bid: 1,
      ask: 2,
      last: 1.5,
      asOf: '2026-04-23T00:00:00Z',
    })),
    getCandles: vi.fn(async () => [] as Candle[]),
    listPositions: vi.fn(async () => [] as Position[]),
    listOrders: vi.fn(async () => [] as Order[]),
    placeOrder: vi.fn(async (req: OrderRequest): Promise<Order> => ({
      id: 'real-order',
      account: req.account,
      legs: req.legs,
      orderType: req.orderType,
      qty: req.qty,
      filledQty: 0,
      status: 'open',
      timeInForce: req.timeInForce,
      submittedAt: 'now',
      updatedAt: 'now',
    })),
    cancelOrder: vi.fn(async () => undefined),
  };
  return { ...base, ...overrides };
}

describe('PaperBroker', () => {
  it('rebrands the inner broker label and toggles paperTrading capability', () => {
    const inner = makeStubBroker();
    const paper = new PaperBroker(inner);
    expect(paper.id).toBe(inner.id);
    expect(paper.label).toBe('Stub (paper)');
    expect(paper.capabilities.paperTrading).toBe(true);
    expect(paper.capabilities.extendedHours).toBe(true); // forwarded
  });

  it('forwards read-side methods to the inner broker', async () => {
    const inner = makeStubBroker();
    const paper = new PaperBroker(inner);
    await paper.connect({ key: 'k' } as never);
    expect(inner.connect).toHaveBeenCalledWith({ key: 'k' });
    await paper.getQuote('AAPL');
    expect(inner.getQuote).toHaveBeenCalledWith('AAPL');
    await paper.getCandles({ symbol: 'AAPL', interval: '1d', from: 0, to: 1 });
    expect(inner.getCandles).toHaveBeenCalled();
    await paper.disconnect();
    expect(inner.disconnect).toHaveBeenCalled();
  });

  it('blocks write-side methods until the simulated execution layer lands', async () => {
    const inner = makeStubBroker();
    const paper = new PaperBroker(inner);
    await expect(
      paper.placeOrder({
        account: ALPACA_REF,
        legs: [{ symbol: 'AAPL', assetClass: 'equity', side: 'buy' }],
        orderType: 'market',
        qty: 1,
        timeInForce: 'day',
      }),
    ).rejects.toThrow(/not implemented/i);
    expect(inner.placeOrder).not.toHaveBeenCalled();
    await expect(paper.cancelOrder(ALPACA_REF, 'x')).rejects.toThrow(/not implemented/i);
    expect(inner.cancelOrder).not.toHaveBeenCalled();
    await expect(paper.getBalances(ALPACA_REF)).rejects.toThrow(/not implemented/i);
  });

  it('returns empty positions and orders (paper ledger is empty until phase 2 fill engine)', async () => {
    const paper = new PaperBroker(makeStubBroker());
    await expect(paper.listPositions(ALPACA_REF)).resolves.toEqual([]);
    await expect(paper.listOrders(ALPACA_REF)).resolves.toEqual([]);
  });

  it('only binds optional methods (streamQuotes, getOptionsChain, data-feed) when the inner broker exposes them', () => {
    const innerWithoutOptional = makeStubBroker();
    const noOpt = new PaperBroker(innerWithoutOptional);
    expect(noOpt.streamQuotes).toBeUndefined();
    expect(noOpt.getOptionsChain).toBeUndefined();
    expect(noOpt.listDataFeeds).toBeUndefined();
    expect(noOpt.refreshDataFeeds).toBeUndefined();

    const stream = vi.fn(() => (async function* () {})());
    const chain = vi.fn(async () => ({ underlying: 'AAPL', expirations: [], contracts: [] }) as OptionsChain);
    const feedList: DataFeed[] = [{ id: 'sip', label: 'SIP', available: true }];
    const innerWithOptional = makeStubBroker({
      streamQuotes: stream,
      getOptionsChain: chain,
      listDataFeeds: () => feedList,
      getActiveDataFeed: () => 'sip',
      setActiveDataFeed: vi.fn(),
      refreshDataFeeds: vi.fn(async () => feedList),
    });
    const withOpt = new PaperBroker(innerWithOptional);
    expect(typeof withOpt.streamQuotes).toBe('function');
    expect(typeof withOpt.getOptionsChain).toBe('function');
    expect(typeof withOpt.listDataFeeds).toBe('function');
    expect(typeof withOpt.refreshDataFeeds).toBe('function');
    expect(withOpt.getActiveDataFeed?.()).toBe('sip');
    expect(withOpt.listDataFeeds?.()).toEqual(feedList);
  });
});
