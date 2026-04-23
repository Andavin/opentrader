import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { layoutsClient, SidecarError } from '../lib';
import { useDebouncedCallback } from '../lib/useDebounce';
import { AccountSync } from './AccountSync';
import { AuraSync } from './AuraSync';
import { ConnectAlpacaModal } from './ConnectAlpacaModal';
import { ErrorBoundary } from './ErrorBoundary';
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

/** Empty out dockview before re-seeding. Used after a corrupt restore
 *  so panel-id collisions don't bubble back as further errors. Snapshot
 *  the panels array first — removePanel mutates it during iteration. */
function safeClear(api: DockviewApi): void {
  const snapshot = [...api.panels];
  for (const panel of snapshot) {
    try {
      api.removePanel(panel);
    } catch {
      // best-effort — keep going so a single bad panel doesn't block
      // the rest of the cleanup
    }
  }
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
        try {
          event.api.fromJSON(saved.dockviewState as never);
        } catch (restoreErr) {
          // Saved layout is corrupt or references components we no
          // longer ship. Wipe it server-side so the next restart
          // doesn't replay the same crash, then seed fresh defaults.
          // eslint-disable-next-line no-console
          console.warn('saved layout failed to restore; wiping', restoreErr);
          await layoutsClient.delete(DEFAULT_LAYOUT_ID).catch(() => undefined);
          safeClear(event.api);
          seedDefaultPanels(event.api);
        }
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

  // The error-boundary onReset handler — called when the user clicks
  // "Reset and reload" after a crash. Wipes the persisted layout so
  // the next mount can seed fresh defaults instead of replaying the
  // bad state, then bounces the page.
  const handleReset = useCallback(() => {
    void layoutsClient
      .delete(DEFAULT_LAYOUT_ID)
      .catch(() => undefined)
      .then(() => {
        if (typeof window !== 'undefined') window.location.reload();
      });
  }, []);

  return (
    <ErrorBoundary scope="workspace" onReset={handleReset}>
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
    </ErrorBoundary>
  );
}
