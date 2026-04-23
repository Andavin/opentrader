import type { BrokerCapabilities, BrokerId } from '@opentrader/broker-core';
import { Check, ChevronDown, Database } from 'lucide-react';
import { useState } from 'react';

import { Popover } from '../lib/Popover';
import { useConnectedBrokers } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';

import './DataSourcePicker.css';

interface Props {
  /** Dockview panel id — the override is keyed by this. */
  panelId: string;
  /** True when this widget needs market data only (chart, snapshot, chain). */
  enabled?: boolean;
}

interface BrokerEntry {
  id: BrokerId;
  label: string;
  connected: boolean;
}

const FALLBACK_LABELS: Record<BrokerId, string> = {
  alpaca: 'Alpaca',
  robinhood: 'Robinhood',
  fidelity: 'Fidelity',
};

/**
 * Tiny popover that overrides a single widget's data broker. Lets you
 * pull a chart or options chain through Alpaca even when your active
 * account lives on Robinhood, etc. Lists only brokers that are
 * currently connected (plus the workspace default option).
 */
export function DataSourcePicker({ panelId, enabled = true }: Props) {
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const override = useWorkspaceStore((s) => s.widgetDataSources[panelId]);
  const setOverride = useWorkspaceStore((s) => s.setWidgetDataSource);
  const [open, setOpen] = useState(false);

  const brokersQ = useConnectedBrokers(open);
  const brokers: BrokerEntry[] = (brokersQ.data ?? []).map(
    (b: { id: BrokerId; label: string; connected: boolean; capabilities: BrokerCapabilities }) => ({
      id: b.id,
      label: b.label,
      connected: b.connected,
    }),
  );

  if (!enabled) return null;

  const active = override ?? dataBroker;
  const activeLabel =
    brokers.find((b) => b.id === active)?.label ?? FALLBACK_LABELS[active] ?? active;
  const defaultLabel =
    brokers.find((b) => b.id === dataBroker)?.label ?? FALLBACK_LABELS[dataBroker] ?? dataBroker;
  const connectedBrokers = brokers.filter((b) => b.connected);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      className="data-source-popover"
      trigger={
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
      }
    >
      <button
        type="button"
        className={`data-source-item${!override ? ' is-active' : ''}`}
        onClick={() => {
          setOverride(panelId, null);
          setOpen(false);
        }}
      >
        <span className="data-source-check">{!override ? <Check size={11} /> : null}</span>
        Use workspace default ({defaultLabel})
      </button>
      <div className="data-source-divider" />
      {brokersQ.isLoading && !brokersQ.data && (
        <div className="data-source-status">Loading brokers…</div>
      )}
      {connectedBrokers.length === 0 && brokersQ.data && (
        <div className="data-source-status">
          No connected brokers — use the account dropdown to connect one.
        </div>
      )}
      {connectedBrokers.map((b) => {
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
    </Popover>
  );
}
