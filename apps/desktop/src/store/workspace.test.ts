import { beforeEach, describe, expect, it } from 'vitest';

import { selectActiveAccountRef, useWorkspaceStore } from './workspace';

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

  it('order-ticket and connect-modal openers store the seed value', () => {
    const { openOrderTicket, openConnectModal } = useWorkspaceStore.getState();
    openOrderTicket({ symbol: 'AAPL', side: 'buy', limitPrice: 150 });
    openConnectModal('alpaca');
    const s = useWorkspaceStore.getState();
    expect(s.orderTicketOpen).toEqual({ symbol: 'AAPL', side: 'buy', limitPrice: 150 });
    expect(s.connectModalOpen).toBe('alpaca');
  });
});
