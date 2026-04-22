import { create } from 'zustand';

export type Aura = 'regular' | 'extended' | 'profit' | 'loss' | 'focus';

export interface ActiveAccount {
  brokerId: 'alpaca' | 'robinhood' | 'fidelity' | 'demo';
  brokerLabel: string;
  accountId: string;
  name: string;
}

interface WorkspaceState {
  activeSymbol: string | null;
  activeAccount: ActiveAccount;
  aura: Aura;
  setActiveSymbol: (symbol: string | null) => void;
  setActiveAccount: (account: ActiveAccount) => void;
  setAura: (aura: Aura) => void;
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
  aura: 'regular',
  setActiveSymbol: (activeSymbol) => set({ activeSymbol }),
  setActiveAccount: (activeAccount) => set({ activeAccount }),
  setAura: (aura) => set({ aura }),
}));
