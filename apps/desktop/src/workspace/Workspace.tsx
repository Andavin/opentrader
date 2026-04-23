import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { layoutsClient, SidecarError } from '../lib';
import { useDebouncedCallback } from '../lib/useDebounce';
import { AccountSync } from './AccountSync';
import { AuraSync } from './AuraSync';
import { ConnectAlpacaModal } from './ConnectAlpacaModal';
import { GlobalHotkeys } from './GlobalHotkeys';
import { OrderTicketModal } from './OrderTicketModal';
import { TopBar } from './TopBar';
import { widgetComponents } from '../widgets/registry';

import './Workspace.css';

const DEFAULT_LAYOUT_ID = 'default';

function seedDefaultPanels(api: DockviewApi): void {
  api.addPanel({ id: 'welcome-watchlist', component: 'watchlist', title: 'Watchlist' });
  api.addPanel({
    id: 'welcome-chart',
    component: 'chart',
    title: 'Chart',
    position: { referencePanel: 'welcome-watchlist', direction: 'right' },
  });
  api.addPanel({
    id: 'welcome-account',
    component: 'accountSummary',
    title: 'Account',
    position: { referencePanel: 'welcome-watchlist', direction: 'below' },
  });
  api.addPanel({
    id: 'welcome-positions',
    component: 'positions',
    title: 'Positions',
    position: { referencePanel: 'welcome-account', direction: 'right' },
  });
  api.addPanel({
    id: 'welcome-orders',
    component: 'orders',
    title: 'Orders',
    position: { referencePanel: 'welcome-positions', direction: 'within' },
  });
}

export function Workspace() {
  const [api, setApi] = useState<DockviewApi | null>(null);
  /** True once we've finished initial load — prevents the first render
   *  from triggering an immediate auto-save. */
  const restored = useRef(false);

  const persist = useCallback(async (apiInstance: DockviewApi) => {
    try {
      await layoutsClient.save(DEFAULT_LAYOUT_ID, {
        name: 'Default',
        position: 0,
        dockviewState: apiInstance.toJSON() as unknown as Record<string, unknown>,
      });
    } catch (err) {
      // Swallow — layout persistence isn't critical to trading.
      // eslint-disable-next-line no-console
      console.warn('layout save failed', err);
    }
  }, []);

  const debouncedSave = useDebouncedCallback(persist, 1000);

  function onReady(event: DockviewReadyEvent): void {
    setApi(event.api);
    void (async () => {
      try {
        const saved = await layoutsClient.get(DEFAULT_LAYOUT_ID);
        // dockview accepts the same shape it produces from toJSON.
        event.api.fromJSON(saved.dockviewState as never);
      } catch (err) {
        if (!(err instanceof SidecarError && err.status === 404)) {
          // eslint-disable-next-line no-console
          console.warn('layout load failed; falling back to default', err);
        }
        seedDefaultPanels(event.api);
      } finally {
        restored.current = true;
      }
    })();
  }

  useEffect(() => {
    if (!api) return;
    const sub = api.onDidLayoutChange(() => {
      if (!restored.current) return;
      debouncedSave(api);
    });
    return () => sub.dispose();
  }, [api, debouncedSave]);

  return (
    <div className="workspace-root">
      <AccountSync />
      <AuraSync />
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
      <GlobalHotkeys />
    </div>
  );
}
