import type { IDockviewPanelProps } from 'dockview-react';

import { ChartWidget } from './ChartWidget';
import { PlaceholderWidget } from './PlaceholderWidget';
import { WatchlistWidget } from './WatchlistWidget';

export const widgetComponents: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  placeholder: PlaceholderWidget,
  chart: ChartWidget,
  watchlist: WatchlistWidget,
};

export interface WidgetCatalogEntry {
  id: string;
  label: string;
  defaultTitle: string;
}

export const widgetCatalog: WidgetCatalogEntry[] = [
  { id: 'chart', label: 'Chart', defaultTitle: 'Chart' },
  { id: 'watchlist', label: 'Watchlist', defaultTitle: 'Watchlist' },
];
