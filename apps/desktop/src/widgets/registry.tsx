import type { IDockviewPanelProps } from 'dockview-react';

import { AccountSummaryWidget } from './AccountSummaryWidget';
import { ChartWidget } from './ChartWidget';
import { OptionsChainWidget } from './OptionsChainWidget';
import { OrdersWidget } from './OrdersWidget';
import { PlaceholderWidget } from './PlaceholderWidget';
import { PositionsWidget } from './PositionsWidget';
import { SnapshotWidget } from './SnapshotWidget';
import { WatchlistWidget } from './WatchlistWidget';

export const widgetComponents: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  placeholder: PlaceholderWidget,
  chart: ChartWidget,
  watchlist: WatchlistWidget,
  positions: PositionsWidget,
  orders: OrdersWidget,
  accountSummary: AccountSummaryWidget,
  snapshot: SnapshotWidget,
  optionsChain: OptionsChainWidget,
};

export interface WidgetCatalogEntry {
  id: string;
  label: string;
  defaultTitle: string;
}

export const widgetCatalog: WidgetCatalogEntry[] = [
  { id: 'chart', label: 'Chart', defaultTitle: 'Chart' },
  { id: 'watchlist', label: 'Watchlist', defaultTitle: 'Watchlist' },
  { id: 'positions', label: 'Positions', defaultTitle: 'Positions' },
  { id: 'orders', label: 'Orders', defaultTitle: 'Orders' },
  { id: 'accountSummary', label: 'Account summary', defaultTitle: 'Account' },
  { id: 'snapshot', label: 'Snapshot', defaultTitle: 'Snapshot' },
  { id: 'optionsChain', label: 'Options chain', defaultTitle: 'Options' },
];
