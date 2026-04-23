import { beforeEach, describe, expect, it } from 'vitest';

import { selectActiveAccountRef, selectWidgetBroker, useWorkspaceStore } from './workspace';

const initial = useWorkspaceStore.getState();

describe('workspace store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(initial, true);
  });

  it('starts with the demo account, alpaca data broker, and empty watchlist', () => {
    const s = useWorkspaceStore.getState();
    expect(s.activeAccount.brokerId).toBe('demo');
    expect(s.dataBroker).toBe('alpaca');
    expect(s.watchlist).toEqual([]);
    expect(s.connectModalOpen).toBeNull();
    expect(s.orderTicketOpen).toBeNull();
    expect(s.aura).toBe('regular');
  });

  it('addToWatchlist uppercases and de-dupes', () => {
    const { addToWatchlist } = useWorkspaceStore.getState();
    addToWatchlist('aapl');
    addToWatchlist('AAPL');
    addToWatchlist('msft');
    expect(useWorkspaceStore.getState().watchlist).toEqual(['AAPL', 'MSFT']);
  });

  it('removeFromWatchlist drops the symbol', () => {
    const { addToWatchlist, removeFromWatchlist } = useWorkspaceStore.getState();
    addToWatchlist('AAPL');
    addToWatchlist('TSLA');
    removeFromWatchlist('AAPL');
    expect(useWorkspaceStore.getState().watchlist).toEqual(['TSLA']);
  });

  it('selectActiveAccountRef returns null while demo and a real ref once promoted', () => {
    expect(selectActiveAccountRef(useWorkspaceStore.getState())).toBeNull();
    useWorkspaceStore
      .getState()
      .setActiveAccount({ brokerId: 'alpaca', brokerLabel: 'alpaca', accountId: 'A1', name: 'Individual' });
    expect(selectActiveAccountRef(useWorkspaceStore.getState())).toEqual({
      brokerId: 'alpaca',
      accountId: 'A1',
    });
  });

  it('order-ticket and connect-modal openers store the draft value', () => {
    const { openOrderTicket, openConnectModal } = useWorkspaceStore.getState();
    openOrderTicket({
      legs: [{ symbol: 'AAPL', assetClass: 'equity', side: 'buy' }],
      orderType: 'limit',
      limitPrice: 150,
    });
    openConnectModal('alpaca');
    const s = useWorkspaceStore.getState();
    expect(s.orderTicketOpen?.legs).toHaveLength(1);
    expect(s.orderTicketOpen?.limitPrice).toBe(150);
    expect(s.connectModalOpen).toBe('alpaca');
  });

  it('appendOrderTicketLeg adds a leg (opening the ticket if closed) and stores option snapshot', () => {
    const { appendOrderTicketLeg } = useWorkspaceStore.getState();
    appendOrderTicketLeg(
      { symbol: 'AAPL241220C00150000', assetClass: 'option', side: 'buy', ratio: 1 },
      { delta: 0.5, theta: -0.04 },
    );
    const s = useWorkspaceStore.getState();
    expect(s.orderTicketOpen?.legs).toHaveLength(1);
    expect(s.optionLegSnapshots['AAPL241220C00150000']).toEqual({ delta: 0.5, theta: -0.04 });
  });

  it('removeOrderTicketLeg pulls a leg by index and closes the ticket when last is removed', () => {
    const { appendOrderTicketLeg, removeOrderTicketLeg } = useWorkspaceStore.getState();
    appendOrderTicketLeg({ symbol: 'A', assetClass: 'option', side: 'buy', ratio: 1 });
    appendOrderTicketLeg({ symbol: 'B', assetClass: 'option', side: 'sell', ratio: 1 });
    removeOrderTicketLeg(0);
    expect(useWorkspaceStore.getState().orderTicketOpen?.legs.map((l) => l.symbol)).toEqual(['B']);
    removeOrderTicketLeg(0);
    expect(useWorkspaceStore.getState().orderTicketOpen).toBeNull();
  });

  it('selectWidgetBroker returns the override or falls back to workspace default', () => {
    const select = selectWidgetBroker('chart-1');
    expect(select(useWorkspaceStore.getState())).toBe('alpaca');
    useWorkspaceStore.getState().setWidgetDataSource('chart-1', 'robinhood');
    expect(select(useWorkspaceStore.getState())).toBe('robinhood');
    useWorkspaceStore.getState().setWidgetDataSource('chart-1', null);
    expect(select(useWorkspaceStore.getState())).toBe('alpaca');
  });

  it('setWidgetDataSource is panel-scoped — different panels keep independent overrides', () => {
    const { setWidgetDataSource } = useWorkspaceStore.getState();
    setWidgetDataSource('chart-1', 'robinhood');
    setWidgetDataSource('chart-2', 'fidelity');
    expect(selectWidgetBroker('chart-1')(useWorkspaceStore.getState())).toBe('robinhood');
    expect(selectWidgetBroker('chart-2')(useWorkspaceStore.getState())).toBe('fidelity');
  });
});
