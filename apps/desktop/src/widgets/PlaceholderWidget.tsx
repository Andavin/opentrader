import type { IDockviewPanelProps } from 'dockview-react';

import './PlaceholderWidget.css';

interface Params {
  headline?: string;
  sub?: string;
}

export function PlaceholderWidget(props: IDockviewPanelProps<Params>) {
  const headline = props.params?.headline ?? 'Empty panel';
  const sub =
    props.params?.sub ?? 'Replace this widget with the chart, options chain, or any other tile.';

  return (
    <div className="placeholder-widget">
      <h2 className="placeholder-headline">{headline}</h2>
      <p className="placeholder-sub">{sub}</p>
    </div>
  );
}
