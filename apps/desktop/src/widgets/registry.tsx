import type { IDockviewPanelProps } from 'dockview-react';

import { AccountSummaryWidget } from './AccountSummaryWidget';
import { ChartWidget } from './ChartWidget';
import { OrdersWidget } from './OrdersWidget';
import { PlaceholderWidget } from './PlaceholderWidget';
import { PositionsWidget } from './PositionsWidget';
import { WatchlistWidget } from './WatchlistWidget';

export const widgetComponents: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  placeholder: PlaceholderWidget,
  chart: ChartWidget,
  watchlist: WatchlistWidget,
  positions: PositionsWidget,
  orders: OrdersWidget,
  accountSummary: AccountSummaryWidget,
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
];
