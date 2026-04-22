import type { IDockviewPanelProps } from 'dockview-react';
import { PlaceholderWidget } from './PlaceholderWidget';

export const widgetComponents: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  placeholder: PlaceholderWidget,
};
