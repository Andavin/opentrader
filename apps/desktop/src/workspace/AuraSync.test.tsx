import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceStore } from '../store/workspace';
import { AuraSync } from './AuraSync';
import * as queries from '../lib/queries';
import * as marketClock from '../lib/marketClock';

const initial = useWorkspaceStore.getState();

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('AuraSync', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(initial, true);
    vi.spyOn(queries, 'useBrokerStatus').mockReturnValue({
      data: { id: 'alpaca', label: 'Alpaca', connected: true, capabilities: {} as never },
    } as never);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete document.documentElement.dataset.aura;
  });

  it('reflects the active aura on documentElement.dataset.aura', () => {
    vi.spyOn(queries, 'useBalances').mockReturnValue({ data: undefined } as never);
    vi.spyOn(marketClock, 'marketSession').mockReturnValue('regular');

    render(wrap(<AuraSync />));
    expect(document.documentElement.dataset.aura).toBe('regular');
  });

  it('switches to extended aura outside market hours', () => {
    vi.spyOn(queries, 'useBalances').mockReturnValue({ data: undefined } as never);
    vi.spyOn(marketClock, 'marketSession').mockReturnValue('after');

    render(wrap(<AuraSync />));
    expect(useWorkspaceStore.getState().aura).toBe('extended');
  });

  it('switches to profit aura when day P&L > $0.50', () => {
    vi.spyOn(queries, 'useBalances').mockReturnValue({ data: { dayPnL: 5 } } as never);
    vi.spyOn(marketClock, 'marketSession').mockReturnValue('regular');

    render(wrap(<AuraSync />));
    expect(useWorkspaceStore.getState().aura).toBe('profit');
  });

  it('switches to loss aura when day P&L < -$0.50', () => {
    vi.spyOn(queries, 'useBalances').mockReturnValue({ data: { dayPnL: -100 } } as never);
    vi.spyOn(marketClock, 'marketSession').mockReturnValue('regular');

    render(wrap(<AuraSync />));
    expect(useWorkspaceStore.getState().aura).toBe('loss');
  });

  it('respects the manual focus lock — does not auto-rotate', () => {
    vi.spyOn(queries, 'useBalances').mockReturnValue({ data: { dayPnL: 5 } } as never);
    vi.spyOn(marketClock, 'marketSession').mockReturnValue('regular');

    useWorkspaceStore.setState({ aura: 'focus' });
    render(wrap(<AuraSync />));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(useWorkspaceStore.getState().aura).toBe('focus');
  });

  it('uses a $0.50 deadband — tiny P&L stays "regular"', () => {
    vi.spyOn(queries, 'useBalances').mockReturnValue({ data: { dayPnL: 0.25 } } as never);
    vi.spyOn(marketClock, 'marketSession').mockReturnValue('regular');

    render(wrap(<AuraSync />));
    expect(useWorkspaceStore.getState().aura).toBe('regular');
  });
});
