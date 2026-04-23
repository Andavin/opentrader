import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import { useState } from 'react';

import { AccountSync } from './AccountSync';
import { ConnectAlpacaModal } from './ConnectAlpacaModal';
import { OrderTicketModal } from './OrderTicketModal';
import { TopBar } from './TopBar';
import { widgetComponents } from '../widgets/registry';

import './Workspace.css';

export function Workspace() {
  const [api, setApi] = useState<DockviewApi | null>(null);

  function onReady(event: DockviewReadyEvent): void {
    setApi(event.api);
    // Default starter layout: Watchlist | Chart on top, Account+Positions+Orders below.
    event.api.addPanel({ id: 'welcome-watchlist', component: 'watchlist', title: 'Watchlist' });
    event.api.addPanel({
      id: 'welcome-chart',
      component: 'chart',
      title: 'Chart',
      position: { referencePanel: 'welcome-watchlist', direction: 'right' },
    });
    event.api.addPanel({
      id: 'welcome-account',
      component: 'accountSummary',
      title: 'Account',
      position: { referencePanel: 'welcome-watchlist', direction: 'below' },
    });
    event.api.addPanel({
      id: 'welcome-positions',
      component: 'positions',
      title: 'Positions',
      position: { referencePanel: 'welcome-account', direction: 'right' },
    });
    event.api.addPanel({
      id: 'welcome-orders',
      component: 'orders',
      title: 'Orders',
      position: { referencePanel: 'welcome-positions', direction: 'within' },
    });
  }

  return (
    <div className="workspace-root">
      <AccountSync />
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
      <OrderTicketModal />
    </div>
  );
}
