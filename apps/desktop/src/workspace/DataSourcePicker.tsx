import type { BrokerId } from '@opentrader/broker-core';
import { Check, ChevronDown, Database } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useWorkspaceStore } from '../store/workspace';

import './DataSourcePicker.css';

/** Brokers we let the user route widget data through. */
const SUPPORTED_BROKERS: Array<{ id: BrokerId; label: string }> = [
  { id: 'alpaca', label: 'Alpaca' },
  { id: 'robinhood', label: 'Robinhood' },
  { id: 'fidelity', label: 'Fidelity' },
];

interface Props {
  /** Dockview panel id — the override is keyed by this. */
  panelId: string;
  /** True when this widget needs market data only (chart, snapshot, chain). */
  enabled?: boolean;
}

/**
 * Tiny popover that overrides a single widget's data broker. Lets you
 * pull a chart or options chain through Alpaca even when your active
 * account lives on Robinhood, etc.
 */
export function DataSourcePicker({ panelId, enabled = true }: Props) {
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const override = useWorkspaceStore((s) => s.widgetDataSources[panelId]);
  const setOverride = useWorkspaceStore((s) => s.setWidgetDataSource);
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

  if (!enabled) return null;

  const active = override ?? dataBroker;
  const activeLabel = SUPPORTED_BROKERS.find((b) => b.id === active)?.label ?? active;

  return (
    <div className="data-source-picker" ref={rootRef}>
      <button
        type="button"
        className="data-source-trigger"
        onClick={() => setOpen((v) => !v)}
        title={`Data source: ${activeLabel}${override ? ' (override)' : ' (default)'}`}
      >
        <Database size={11} />
        <span>{activeLabel}</span>
        {override && <span className="data-source-pin" aria-label="Pinned" />}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="data-source-popover" role="menu">
          <button
            type="button"
            className={`data-source-item${!override ? ' is-active' : ''}`}
            onClick={() => {
              setOverride(panelId, null);
              setOpen(false);
            }}
          >
            <span className="data-source-check">{!override ? <Check size={11} /> : null}</span>
            Use workspace default ({SUPPORTED_BROKERS.find((b) => b.id === dataBroker)?.label})
          </button>
          <div className="data-source-divider" />
          {SUPPORTED_BROKERS.map((b) => {
            const isActive = override === b.id;
            return (
              <button
                key={b.id}
                type="button"
                className={`data-source-item${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  setOverride(panelId, b.id);
                  setOpen(false);
                }}
              >
                <span className="data-source-check">{isActive ? <Check size={11} /> : null}</span>
                Pin to {b.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
