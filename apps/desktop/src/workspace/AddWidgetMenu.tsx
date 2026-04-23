import type { DockviewApi } from 'dockview-react';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { widgetCatalog } from '../widgets/registry';

import './AddWidgetMenu.css';

interface Props {
  api: DockviewApi | null;
}

export function AddWidgetMenu({ api }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function addWidget(componentId: string, title: string) {
    setOpen(false);
    if (!api) return;
    const id = `${componentId}-${Date.now()}`;
    api.addPanel({ id, component: componentId, title });
  }

  return (
    <div className="add-widget-menu" ref={rootRef}>
      <button
        type="button"
        className="topbar-action"
        onClick={() => setOpen((v) => !v)}
        disabled={!api}
      >
        <Plus size={14} />
        <span>Add widget</span>
      </button>
      {open && (
        <div className="add-widget-popover" role="menu">
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
        </div>
      )}
    </div>
  );
}
