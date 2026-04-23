import type { OptionContract } from '@opentrader/broker-core';
import type { IDockviewPanelProps } from 'dockview-react';
import { ChevronDown, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { fmtCompact, fmtNum, fmtPct, fmtSignedUsd, fmtUsd, priceClass } from '../lib/format';
import { useOptionsChain, useSnapshot } from '../lib/queries';
import { selectWidgetBroker, useWorkspaceStore } from '../store/workspace';
import { DataSourcePicker } from '../workspace/DataSourcePicker';
import {
  buildExpirationMeta,
  calcBreakeven,
  calcNetChange,
  calcPctToBreakeven,
  calcRoc,
  dteDayLabel,
  groupByStrike,
  isCallItm,
  isPutItm,
  spotLineIndex,
  type StrikeRow,
} from './optionsChainCalc';

import './OptionsChainWidget.css';

// ---- types ----

type ChainTab = 'chain' | 'simulated';

type CustomColumn =
  | 'last'
  | 'prevClose'
  | 'netChange'
  | 'volume'
  | 'openInterest'
  | 'breakeven'
  | 'roc'
  | 'pctToBreakeven';

type ColKey = 'bid' | 'ask' | 'delta' | 'theta' | CustomColumn;

const CUSTOM_COL_LABELS: Record<CustomColumn, string> = {
  last: 'Last',
  prevClose: 'Previous close',
  netChange: 'Net change',
  volume: 'Volume',
  openInterest: 'Open interest',
  breakeven: 'Breakeven',
  roc: 'Return on capital',
  pctToBreakeven: '% to breakeven',
};

const COL_HEADER: Record<ColKey, string> = {
  bid: 'Bid',
  ask: 'Ask',
  delta: 'Δ',
  theta: 'Θ',
  last: 'Last',
  prevClose: 'Prev',
  netChange: 'Change',
  volume: 'Vol',
  openInterest: 'OI',
  breakeven: 'Breakeven',
  roc: 'ROC',
  pctToBreakeven: '% BE',
};

// ---- per-cell renderers ----
// Each returns a <td> with the appropriate class and content.
// itm determines the ITM background tint.

interface CellProps {
  contract: OptionContract;
  col: ColKey;
  side: 'call' | 'put';
  isItm: boolean;
  spot: number | null;
  onLegClick: (c: OptionContract, s: 'buy' | 'sell') => void;
}

function OptionCell({ contract, col, side, isItm, spot, onLegClick }: CellProps) {
  const itmCls = isItm ? (side === 'call' ? ' is-itm-call' : ' is-itm-put') : '';

  switch (col) {
    case 'bid':
      return (
        <td
          className={`ocw-td ocw-td--num ocw-clickable${itmCls}`}
          onClick={() => onLegClick(contract, 'sell')}
          title="Sell to open at bid"
        >
          {fmtUsd(contract.bid)}
        </td>
      );
    case 'ask':
      return (
        <td
          className={`ocw-td ocw-td--num ocw-clickable${itmCls}`}
          onClick={() => onLegClick(contract, 'buy')}
          title="Buy to open at ask"
        >
          {fmtUsd(contract.ask)}
        </td>
      );
    case 'delta':
      return <td className={`ocw-td ocw-td--num${itmCls}`}>{fmtNum(contract.delta)}</td>;
    case 'theta':
      return (
        <td className={`ocw-td ocw-td--num ${priceClass(contract.theta)}${itmCls}`}>
          {fmtNum(contract.theta)}
        </td>
      );
    case 'last':
      return <td className={`ocw-td ocw-td--num${itmCls}`}>{fmtUsd(contract.last)}</td>;
    case 'prevClose':
      return <td className={`ocw-td ocw-td--num${itmCls}`}>—</td>;
    case 'netChange': {
      const nc = calcNetChange(contract.last, undefined);
      return (
        <td className={`ocw-td ocw-td--num ${priceClass(nc)}${itmCls}`}>{fmtSignedUsd(nc)}</td>
      );
    }
    case 'volume':
      return <td className={`ocw-td ocw-td--num${itmCls}`}>{fmtCompact(contract.volume)}</td>;
    case 'openInterest':
      return <td className={`ocw-td ocw-td--num${itmCls}`}>{fmtCompact(contract.openInterest)}</td>;
    case 'breakeven': {
      const be = calcBreakeven(side, contract.strike, contract.ask);
      return <td className={`ocw-td ocw-td--num${itmCls}`}>{fmtUsd(be)}</td>;
    }
    case 'roc': {
      const roc = calcRoc(contract.ask);
      return <td className={`ocw-td ocw-td--num${itmCls}`}>{fmtPct(roc)}</td>;
    }
    case 'pctToBreakeven': {
      const pct = calcPctToBreakeven(side, contract.strike, contract.ask, spot);
      return (
        <td className={`ocw-td ocw-td--num ${priceClass(pct)}${itmCls}`}>
          {fmtPct(pct, { signed: true })}
        </td>
      );
    }
  }
}

// ---- sub-components ----

interface ExpirationRowProps {
  expiration: string;
  dte: number;
  dayOfWeek: string;
  dateLabel: string;
  avgIv: number | null;
  expectedMove: number | null;
  isExpanded: boolean;
  onToggle: () => void;
}

function ExpirationRow({
  expiration,
  dte,
  dayOfWeek,
  dateLabel,
  avgIv,
  expectedMove,
  isExpanded,
  onToggle,
}: ExpirationRowProps) {
  return (
    <div
      className={`ocw-exp-row${isExpanded ? ' is-expanded' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      aria-expanded={isExpanded}
      data-expiration={expiration}
    >
      <span className="ocw-exp-chevron">
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </span>
      <span className="ocw-exp-dte">{dteDayLabel(dte)}</span>
      <span className="ocw-exp-dow">{dayOfWeek}</span>
      <span className="ocw-exp-date">{dateLabel}</span>
      <span className="ocw-exp-iv">{avgIv != null ? `${(avgIv * 100).toFixed(1)}%` : '—'}</span>
      <span className="ocw-exp-move">
        {expectedMove != null ? `±${fmtUsd(expectedMove)}` : '—'}
      </span>
    </div>
  );
}

interface StrikesTableProps {
  contracts: OptionContract[];
  spot: number | null;
  customCols: CustomColumn[];
  onLegClick: (contract: OptionContract, side: 'buy' | 'sell') => void;
}

function StrikesTable({ contracts, spot, customCols, onLegClick }: StrikesTableProps) {
  const rows: StrikeRow[] = useMemo(() => groupByStrike(contracts), [contracts]);
  const dividerIdx = useMemo(() => spotLineIndex(rows, spot), [rows, spot]);

  if (rows.length === 0) {
    return <p className="ocw-empty-row">No contracts for this expiration.</p>;
  }

  const baseCols: ColKey[] = ['bid', 'ask', 'delta', 'theta'];
  const allCols: ColKey[] = [...baseCols, ...customCols];
  // Call headers reversed so ask is closest to the Strike column
  const callCols: ColKey[] = [...allCols].reverse();
  const totalCols = allCols.length * 2 + 1;

  return (
    <div className="ocw-strikes-wrap">
      <table className="ocw-strikes-table">
        <thead>
          <tr>
            <th colSpan={allCols.length} className="ocw-th ocw-th--calls">
              Calls
            </th>
            <th className="ocw-th ocw-th--strike">Strike</th>
            <th colSpan={allCols.length} className="ocw-th ocw-th--puts">
              Puts
            </th>
          </tr>
          <tr>
            {callCols.map((col) => (
              <th key={`ch-${col}`} className="ocw-th ocw-th--col">
                {COL_HEADER[col]}
              </th>
            ))}
            <th className="ocw-th ocw-th--strike-sub">—</th>
            {allCols.map((col) => (
              <th key={`ph-${col}`} className="ocw-th ocw-th--col">
                {COL_HEADER[col]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const callItm = isCallItm(row.strike, spot);
            const putItm = isPutItm(row.strike, spot);
            return (
              <>
                <tr key={row.strike} className="ocw-strike-row">
                  {callCols.map((col) =>
                    row.call ? (
                      <OptionCell
                        key={`c-${col}`}
                        contract={row.call}
                        col={col}
                        side="call"
                        isItm={callItm}
                        spot={spot}
                        onLegClick={onLegClick}
                      />
                    ) : (
                      <td
                        key={`c-${col}`}
                        className={`ocw-td ocw-td--num${callItm ? ' is-itm-call' : ''}`}
                      />
                    ),
                  )}
                  <td className="ocw-td ocw-td--strike">{fmtUsd(row.strike, { cents: false })}</td>
                  {allCols.map((col) =>
                    row.put ? (
                      <OptionCell
                        key={`p-${col}`}
                        contract={row.put}
                        col={col}
                        side="put"
                        isItm={putItm}
                        spot={spot}
                        onLegClick={onLegClick}
                      />
                    ) : (
                      <td
                        key={`p-${col}`}
                        className={`ocw-td ocw-td--num${putItm ? ' is-itm-put' : ''}`}
                      />
                    ),
                  )}
                </tr>

                {/* Spot price divider — rendered after the last ITM row */}
                {dividerIdx === idx && spot != null && (
                  <tr key={`spot-divider-${idx}`} className="ocw-spot-divider">
                    <td colSpan={totalCols} className="ocw-spot-divider-cell">
                      <span className="ocw-spot-label">{fmtUsd(spot)} spot</span>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface CustomizeColumnsPanelProps {
  enabled: CustomColumn[];
  onChange: (cols: CustomColumn[]) => void;
}

function CustomizeColumnsPanel({ enabled, onChange }: CustomizeColumnsPanelProps) {
  const all = Object.entries(CUSTOM_COL_LABELS) as Array<[CustomColumn, string]>;

  function toggle(col: CustomColumn) {
    onChange(enabled.includes(col) ? enabled.filter((c) => c !== col) : [...enabled, col]);
  }

  return (
    <div className="ocw-customize-panel">
      <p className="ocw-customize-title">Customize columns</p>
      {all.map(([col, label]) => (
        <label key={col} className="ocw-customize-item">
          <input
            type="checkbox"
            checked={enabled.includes(col)}
            onChange={() => toggle(col)}
            className="ocw-customize-check"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

// ---- main widget ----

export function OptionsChainWidget(props: IDockviewPanelProps) {
  const symbol = useWorkspaceStore((s) => s.activeSymbol);
  const broker = useWorkspaceStore(selectWidgetBroker(props.api.id));
  const appendLeg = useWorkspaceStore((s) => s.appendOrderTicketLeg);

  const [activeTab, setActiveTab] = useState<ChainTab>('chain');
  const [expandedExp, setExpandedExp] = useState<string | null>(null);
  const [customCols, setCustomCols] = useState<CustomColumn[]>([]);
  const [showCustomize, setShowCustomize] = useState(false);

  const snap = useSnapshot(broker, symbol);
  const spot = snap.data?.last ?? null;

  // Fetch all contracts across all expirations in one call.
  const chain = useOptionsChain(broker, { underlying: symbol });

  // Auto-expand the nearest expiration on first load.
  useEffect(() => {
    if (!expandedExp && chain.data?.expirations.length) {
      setExpandedExp(chain.data.expirations[0]!);
    }
  }, [chain.data, expandedExp]);

  // Reset on symbol change.
  useEffect(() => {
    setExpandedExp(null);
  }, [symbol]);

  // Derive per-expiration metadata (IV, expected move, etc.).
  const expirationMetas = useMemo(() => {
    if (!chain.data) return [];
    return chain.data.expirations.map((exp) => {
      const contracts = chain.data!.contracts.filter((c) => c.expiration === exp);
      return buildExpirationMeta(exp, contracts, spot);
    });
  }, [chain.data, spot]);

  function clickLeg(contract: OptionContract, side: 'buy' | 'sell') {
    appendLeg(
      { symbol: contract.symbol, assetClass: 'option', side, ratio: 1 },
      {
        delta: contract.delta,
        gamma: contract.gamma,
        theta: contract.theta,
        vega: contract.vega,
        iv: contract.iv,
      },
    );
  }

  function toggleExpiration(exp: string) {
    setExpandedExp((prev) => (prev === exp ? null : exp));
  }

  if (!symbol) {
    return (
      <div className="ocw-root">
        <header className="ocw-topbar">
          <div className="ocw-tabs">
            <button type="button" className="ocw-tab is-active">
              Chain
            </button>
            <button type="button" className="ocw-tab">
              Simulated Returns
            </button>
          </div>
          <div className="ocw-topbar-right">
            <DataSourcePicker panelId={props.api.id} />
          </div>
        </header>
        <div className="ocw-empty-state">
          <p>Select a symbol to load its options chain.</p>
        </div>
      </div>
    );
  }

  const change = snap.data?.change;
  const changePct = snap.data?.changePct;

  return (
    <div className="ocw-root">
      {/* top tab bar */}
      <header className="ocw-topbar">
        <div className="ocw-tabs">
          <button
            type="button"
            className={`ocw-tab${activeTab === 'chain' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('chain')}
          >
            Chain
          </button>
          <button
            type="button"
            className={`ocw-tab${activeTab === 'simulated' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('simulated')}
          >
            Simulated Returns
          </button>
        </div>
        <div className="ocw-topbar-right">
          <DataSourcePicker panelId={props.api.id} />
        </div>
      </header>

      {activeTab === 'simulated' ? (
        <div className="ocw-simulated-placeholder">
          <p>Simulated Returns — TBD</p>
        </div>
      ) : (
        <div className="ocw-body">
          {/* symbol / price bar */}
          <div className="ocw-symbol-bar">
            <span className="ocw-symbol">{symbol}</span>
            {snap.data && (
              <>
                <span className="ocw-price tabular">{fmtUsd(snap.data.last)}</span>
                <span className={`ocw-change tabular ${priceClass(change)}`}>
                  {fmtSignedUsd(change)}{' '}
                  <span className="ocw-change-pct">({fmtPct(changePct, { signed: true })})</span>
                </span>
              </>
            )}
            <span className="ocw-spacer" />
            {chain.isFetching && (
              <span className="ocw-loading-indicator" aria-label="Loading">
                <Loader2 size={12} className="ocw-spin" />
              </span>
            )}
            {chain.error && (
              <span className="ocw-error" title={(chain.error as Error).message}>
                Error loading chain
              </span>
            )}
          </div>

          {/* columns header + customize toggle */}
          <div className="ocw-cols-header">
            <span className="ocw-cols-calls">Calls</span>
            <span className="ocw-cols-strike">Strike</span>
            <span className="ocw-cols-puts">Puts</span>
            <button
              type="button"
              className={`ocw-customize-btn${showCustomize ? ' is-active' : ''}`}
              onClick={() => setShowCustomize((v) => !v)}
              title="Customize columns"
            >
              <Settings2 size={13} />
            </button>
          </div>

          <div className="ocw-content-area">
            <div className="ocw-accordion">
              {chain.isPending && !chain.data ? (
                <div className="ocw-loading-state">
                  <Loader2 size={20} className="ocw-spin" />
                  <span>Loading chain…</span>
                </div>
              ) : expirationMetas.length === 0 ? (
                <div className="ocw-empty-state">
                  <p>No expirations available.</p>
                </div>
              ) : (
                expirationMetas.map((meta) => {
                  const isExp = expandedExp === meta.expiration;
                  const contracts = chain.data!.contracts.filter(
                    (c) => c.expiration === meta.expiration,
                  );
                  return (
                    <div key={meta.expiration} className="ocw-accordion-item">
                      <ExpirationRow
                        expiration={meta.expiration}
                        dte={meta.dte}
                        dayOfWeek={meta.dayOfWeek}
                        dateLabel={meta.dateLabel}
                        avgIv={meta.avgIv}
                        expectedMove={meta.expectedMove}
                        isExpanded={isExp}
                        onToggle={() => toggleExpiration(meta.expiration)}
                      />
                      {isExp && (
                        <div className="ocw-strikes-section">
                          <StrikesTable
                            contracts={contracts}
                            spot={spot}
                            customCols={customCols}
                            onLegClick={clickLeg}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {showCustomize && (
              <CustomizeColumnsPanel enabled={customCols} onChange={setCustomCols} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
