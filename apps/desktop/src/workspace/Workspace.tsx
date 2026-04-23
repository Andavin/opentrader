import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import { useState } from 'react';

import { ConnectAlpacaModal } from './ConnectAlpacaModal';
import { TopBar } from './TopBar';
import { widgetComponents } from '../widgets/registry';

import './Workspace.css';

export function Workspace() {
  const [api, setApi] = useState<DockviewApi | null>(null);

  function onReady(event: DockviewReadyEvent): void {
    setApi(event.api);
    event.api.addPanel({
      id: 'welcome-watchlist',
      component: 'watchlist',
      title: 'Watchlist',
    });
    event.api.addPanel({
      id: 'welcome-chart',
      component: 'chart',
      title: 'Chart',
      position: { referencePanel: 'welcome-watchlist', direction: 'right' },
    });
  }

  return (
    <div className="workspace-root">
      <TopBar dockviewApi={api} />
      <div className="workspace-aura" aria-hidden />
      <div className="workspace-dock">
        <DockviewReact
          className="opentrader-dockview"
          components={widgetComponents}
          onReady={onReady}
          singleTabMode="fullwidth"
        />
      </div>
      <ConnectAlpacaModal />
    </div>
  );
}
