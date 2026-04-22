import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react';

import { TopBar } from './TopBar';
import { widgetComponents } from '../widgets/registry';

import './Workspace.css';

function onReady(event: DockviewReadyEvent): void {
  const api: DockviewApi = event.api;

  api.addPanel({
    id: 'welcome',
    component: 'placeholder',
    title: 'Daily Chart',
    params: {
      headline: 'opentrader',
      sub: 'Phase 0 scaffold — pick a widget from "Add widget" to get started.',
    },
  });
}

export function Workspace() {
  return (
    <div className="workspace-root">
      <TopBar />
      <div className="workspace-aura" aria-hidden />
      <div className="workspace-dock">
        <DockviewReact
          className="opentrader-dockview"
          components={widgetComponents}
          onReady={onReady}
          singleTabMode="fullwidth"
        />
      </div>
    </div>
  );
}
