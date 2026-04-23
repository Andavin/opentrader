import type { BrokerId, CandleInterval } from '@opentrader/broker-core';
import { create } from 'zustand';

export type Aura = 'regular' | 'extended' | 'profit' | 'loss' | 'focus';

export interface ActiveAccount {
  brokerId: BrokerId | 'demo';
  brokerLabel: string;
  accountId: string;
  name: string;
}

interface WorkspaceState {
  activeSymbol: string | null;
  activeAccount: ActiveAccount;
  /** Default broker for unscoped data widgets (chart, snapshot, etc.). */
  dataBroker: BrokerId;
  watchlist: string[];
  chartInterval: CandleInterval;
  aura: Aura;
  connectModalOpen: BrokerId | null;
  setActiveSymbol: (symbol: string | null) => void;
  setActiveAccount: (account: ActiveAccount) => void;
  setDataBroker: (id: BrokerId) => void;
  setChartInterval: (i: CandleInterval) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  setAura: (aura: Aura) => void;
  openConnectModal: (id: BrokerId | null) => void;
}

const DEMO_ACCOUNT: ActiveAccount = {
  brokerId: 'demo',
  brokerLabel: 'demo',
  accountId: 'demo-1',
  name: 'Individual',
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeSymbol: null,
  activeAccount: DEMO_ACCOUNT,
  dataBroker: 'alpaca',
  watchlist: [],
  chartInterval: '1d',
  aura: 'regular',
  connectModalOpen: null,
  setActiveSymbol: (activeSymbol) => set({ activeSymbol }),
  setActiveAccount: (activeAccount) => set({ activeAccount }),
  setDataBroker: (dataBroker) => set({ dataBroker }),
  setChartInterval: (chartInterval) => set({ chartInterval }),
  addToWatchlist: (symbol) =>
    set((s) =>
      s.watchlist.includes(symbol) ? s : { watchlist: [...s.watchlist, symbol.toUpperCase()] },
    ),
  removeFromWatchlist: (symbol) =>
    set((s) => ({ watchlist: s.watchlist.filter((x) => x !== symbol) })),
  setAura: (aura) => set({ aura }),
  openConnectModal: (connectModalOpen) => set({ connectModalOpen }),
}));
