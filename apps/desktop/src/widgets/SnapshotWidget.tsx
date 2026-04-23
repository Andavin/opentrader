import type { IDockviewPanelProps } from 'dockview-react';
import { useState } from 'react';

import { fmtCompact, fmtPct, fmtSignedUsd, fmtUsd, priceClass } from '../lib/format';
import { useSnapshot } from '../lib/queries';
import { selectWidgetBroker, useWorkspaceStore } from '../store/workspace';
import { DataSourcePicker } from '../workspace/DataSourcePicker';

import './SnapshotWidget.css';

type Tab = 'summary' | 'volatility' | 'fundamentals';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'volatility', label: 'Volatility' },
  { id: 'fundamentals', label: 'Fundamentals' },
];

export function SnapshotWidget(props: IDockviewPanelProps) {
  const symbol = useWorkspaceStore((s) => s.activeSymbol);
  const broker = useWorkspaceStore(selectWidgetBroker(props.api.id));
  const snap = useSnapshot(broker, symbol);
  const [tab, setTab] = useState<Tab>('summary');

  if (!symbol) {
    return (
      <div className="snapshot-widget">
        <div className="snapshot-empty">Pick a symbol to see its snapshot.</div>
      </div>
    );
  }

  const data = snap.data;
  const change = data?.change;
  const changePct = data?.changePct;

  return (
    <div className="snapshot-widget">
      <header className="snapshot-header">
        <div className="snapshot-title">
          <span className="snapshot-symbol">{symbol}</span>
          {data?.name && <span className="snapshot-name">{data.name}</span>}
          <span className="snapshot-spacer" />
          <DataSourcePicker panelId={props.api.id} />
        </div>
        <div className="snapshot-price-row">
          <span className="snapshot-price tabular">{fmtUsd(data?.last)}</span>
          <span className={`snapshot-change tabular ${priceClass(change)}`}>
            {fmtSignedUsd(change)} {fmtPct(changePct, { signed: true })}
          </span>
        </div>
      </header>

      <nav className="snapshot-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`snapshot-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="snapshot-body">
        {tab === 'summary' && (
          <dl className="snapshot-grid">
            <div>
              <dt>Bid</dt>
              <dd className="tabular">{fmtUsd(data?.bid)}</dd>
            </div>
            <div>
              <dt>Ask</dt>
              <dd className="tabular">{fmtUsd(data?.ask)}</dd>
            </div>
            <div>
              <dt>Open</dt>
              <dd className="tabular">{fmtUsd(data?.open)}</dd>
            </div>
            <div>
              <dt>Prev close</dt>
              <dd className="tabular">{fmtUsd(data?.prevClose)}</dd>
            </div>
            <div>
              <dt>Day high</dt>
              <dd className="tabular">{fmtUsd(data?.high)}</dd>
            </div>
            <div>
              <dt>Day low</dt>
              <dd className="tabular">{fmtUsd(data?.low)}</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd className="tabular">{fmtCompact(data?.volume)}</dd>
            </div>
            <div>
              <dt>Prev volume</dt>
              <dd className="tabular">{fmtCompact(data?.prevVolume)}</dd>
            </div>
          </dl>
        )}
        {tab === 'volatility' && (
          <p className="snapshot-deferred">
            Implied volatility, IV rank/percentile, term structure — wires in once we have OPRA
            options data flowing through. Phase 3.5.
          </p>
        )}
        {tab === 'fundamentals' && (
          <p className="snapshot-deferred">
            P/E, EPS, market cap, ex-dividend date — Alpaca doesn't expose these directly. Will pull
            from a free fundamentals provider in phase 7.
          </p>
        )}
      </div>
    </div>
  );
}
