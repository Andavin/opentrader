import type {
  AccountRef,
  BrokerId,
  CandleInterval,
  OrderLeg,
  OrderType,
} from '@opentrader/broker-core';
import { create } from 'zustand';

export type Aura = 'regular' | 'extended' | 'profit' | 'loss' | 'focus';

export interface ActiveAccount {
  brokerId: BrokerId | 'demo';
  brokerLabel: string;
  accountId: string;
  name: string;
}

/**
 * Order-ticket draft state. Ticket is open iff this is non-null. Legs
 * accumulate as the user clicks bid/ask in an Options Chain widget;
 * adapters reject mixed equity+option leg sets but the UI calls them
 * out before submission.
 */
export interface OrderTicketDraft {
  legs: OrderLeg[];
  orderType?: OrderType;
  /** Net debit (positive = pay) / credit (negative = receive) limit. */
  limitPrice?: number;
  qty?: number;
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
  orderTicketOpen: OrderTicketDraft | null;
  /**
   * Per-leg snapshot cache populated when a leg is added from the
   * Options Chain widget so the ticket can show net Greeks without
   * re-fetching. Stale snapshots are tolerated; they refresh on next
   * chain reload.
   */
  optionLegSnapshots: Record<
    string,
    { delta?: number; gamma?: number; theta?: number; vega?: number; iv?: number }
  >;
  /**
   * Per-widget data-source override. Maps a dockview panel id to a
   * specific broker; widgets fall back to `dataBroker` when no override
   * is set. Lets you (e.g.) keep account-positions on Robinhood while
   * pulling charts from Alpaca's higher-quality feed.
   */
  widgetDataSources: Record<string, BrokerId>;
  setActiveSymbol: (symbol: string | null) => void;
  setActiveAccount: (account: ActiveAccount) => void;
  setDataBroker: (id: BrokerId) => void;
  setChartInterval: (i: CandleInterval) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  setAura: (aura: Aura) => void;
  openConnectModal: (id: BrokerId | null) => void;
  openOrderTicket: (draft: OrderTicketDraft | null) => void;
  /** Append a leg to the open ticket (or open with this single leg). */
  appendOrderTicketLeg: (
    leg: OrderLeg,
    snapshot?: { delta?: number; gamma?: number; theta?: number; vega?: number; iv?: number },
  ) => void;
  /** Remove a leg by its index in the legs array; closes the ticket if empty. */
  removeOrderTicketLeg: (index: number) => void;
  /** Set or clear a per-widget data-source override. */
  setWidgetDataSource: (panelId: string, brokerId: BrokerId | null) => void;
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
  orderTicketOpen: null,
  optionLegSnapshots: {},
  widgetDataSources: {},
  setActiveSymbol: (activeSymbol) => set({ activeSymbol }),
  setActiveAccount: (activeAccount) => set({ activeAccount }),
  setDataBroker: (dataBroker) => set({ dataBroker }),
  setChartInterval: (chartInterval) => set({ chartInterval }),
  addToWatchlist: (symbol) =>
    set((s) =>
      s.watchlist.includes(symbol.toUpperCase())
        ? s
        : { watchlist: [...s.watchlist, symbol.toUpperCase()] },
    ),
  removeFromWatchlist: (symbol) =>
    set((s) => ({ watchlist: s.watchlist.filter((x) => x !== symbol) })),
  setAura: (aura) => set({ aura }),
  openConnectModal: (connectModalOpen) => set({ connectModalOpen }),
  openOrderTicket: (orderTicketOpen) => set({ orderTicketOpen }),
  appendOrderTicketLeg: (leg, snapshot) =>
    set((s) => {
      const current = s.orderTicketOpen ?? { legs: [] };
      const nextSnaps = snapshot
        ? { ...s.optionLegSnapshots, [leg.symbol]: snapshot }
        : s.optionLegSnapshots;
      return {
        orderTicketOpen: { ...current, legs: [...current.legs, leg] },
        optionLegSnapshots: nextSnaps,
      };
    }),
  removeOrderTicketLeg: (index) =>
    set((s) => {
      if (!s.orderTicketOpen) return {};
      const next = s.orderTicketOpen.legs.filter((_, i) => i !== index);
      if (next.length === 0) return { orderTicketOpen: null };
      return { orderTicketOpen: { ...s.orderTicketOpen, legs: next } };
    }),
  setWidgetDataSource: (panelId, brokerId) =>
    set((s) => {
      const next = { ...s.widgetDataSources };
      if (brokerId === null) delete next[panelId];
      else next[panelId] = brokerId;
      return { widgetDataSources: next };
    }),
}));

/**
 * Selector that returns the active account as an `AccountRef` only when
 * a real broker is wired in (i.e. not the demo placeholder). Widgets
 * can pass the result straight to broker hooks without narrowing.
 */
export function selectActiveAccountRef(state: WorkspaceState): AccountRef | null {
  if (state.activeAccount.brokerId === 'demo') return null;
  return {
    brokerId: state.activeAccount.brokerId,
    accountId: state.activeAccount.accountId,
  };
}

/**
 * Resolve which broker a widget should pull data from: its per-panel
 * override if set, else the workspace default.
 */
export function selectWidgetBroker(panelId: string) {
  return (state: WorkspaceState): BrokerId =>
    state.widgetDataSources[panelId] ?? state.dataBroker;
}
