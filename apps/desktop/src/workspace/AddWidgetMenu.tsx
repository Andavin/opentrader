import type { DockviewApi } from 'dockview-react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Popover } from '../lib/Popover';
import { widgetCatalog } from '../widgets/registry';

import './AddWidgetMenu.css';

interface Props {
  api: DockviewApi | null;
}

/**
 * "+ Add widget" button + popover. New widgets are inserted as fresh
 * panes (split right-of-active), not as new tabs in the active group —
 * Legend's behavior is one-widget-per-tile, not stacks. Users can still
 * drop a panel onto another's tab strip to merge into tabs manually.
 */
export function AddWidgetMenu({ api }: Props) {
  const [open, setOpen] = useState(false);

  function addWidget(componentId: string, title: string) {
    setOpen(false);
    if (!api) return;
    const id = `${componentId}-${Date.now()}`;
    // Place to the right of the currently-active panel so the new
    // widget gets its own slice. Falls back to a top-level add when
    // there is no active panel (empty workspace).
    const reference = api.activePanel;
    api.addPanel({
      id,
      component: componentId,
      title,
      ...(reference ? { position: { referencePanel: reference.id, direction: 'right' } } : {}),
    });
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      className="add-widget-popover"
      trigger={
        <button
          type="button"
          className="topbar-action"
          onClick={() => setOpen((v) => !v)}
          disabled={!api}
        >
          <Plus size={14} />
          <span>Add widget</span>
        </button>
      }
    >
      {widgetCatalog.map((w) => (
        <button
          key={w.id}
          type="button"
          className="add-widget-item"
          onClick={() => addWidget(w.id, w.defaultTitle)}
        >
          {w.label}
        </button>
      ))}
    </Popover>
  );
}
