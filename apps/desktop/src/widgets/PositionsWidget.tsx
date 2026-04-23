import type { IDockviewPanelProps } from 'dockview-react';

import { fmtNum, fmtPct, fmtSignedUsd, fmtUsd, priceClass } from '../lib/format';
import { useBrokerStatus, usePositions } from '../lib/queries';
import { selectActiveAccountRef, useWorkspaceStore } from '../store/workspace';

import './PositionsWidget.css';

export function PositionsWidget(_props: IDockviewPanelProps) {
  const accountRef = useWorkspaceStore(selectActiveAccountRef);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const setActiveSymbol = useWorkspaceStore((s) => s.setActiveSymbol);
  const activeSymbol = useWorkspaceStore((s) => s.activeSymbol);
  const openOrderTicket = useWorkspaceStore((s) => s.openOrderTicket);
  const status = useBrokerStatus(dataBroker);
  const isConnected = status.data?.connected === true;
  const positions = usePositions(accountRef, isConnected);

  if (!isConnected || !accountRef) {
    return (
      <div className="positions-widget">
        <div className="positions-empty">Connect a broker to see your positions.</div>
      </div>
    );
  }

  const rows = positions.data ?? [];

  return (
    <div className="positions-widget">
      <table className="positions-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Qty</th>
            <th>Mkt val</th>
            <th>Mark</th>
            <th>Avg price</th>
            <th>1D P&amp;L</th>
            <th>1D %</th>
            <th>Open P&amp;L</th>
            <th>Open %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="positions-empty-row">
                No open positions.
              </td>
            </tr>
          ) : (
            rows.map((p) => (
              <tr
                key={p.symbol}
                className={p.symbol === activeSymbol ? 'is-active' : ''}
                onClick={() => setActiveSymbol(p.symbol)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openOrderTicket({
                    symbol: p.symbol,
                    side: p.qty >= 0 ? 'sell' : 'buy',
                  });
                }}
              >
                <td className="positions-symbol">{p.symbol}</td>
                <td className="tabular">{fmtNum(p.qty)}</td>
                <td className="tabular">{fmtUsd(p.marketValue)}</td>
                <td className="tabular">{fmtUsd(p.currentPrice)}</td>
                <td className="tabular">{fmtUsd(p.avgEntryPrice)}</td>
                <td className={`tabular ${priceClass(p.dayPnL)}`}>{fmtSignedUsd(p.dayPnL)}</td>
                <td className={`tabular ${priceClass(p.dayPnLPct)}`}>
                  {fmtPct(p.dayPnLPct, { signed: true })}
                </td>
                <td className={`tabular ${priceClass(p.unrealizedPnL)}`}>
                  {fmtSignedUsd(p.unrealizedPnL)}
                </td>
                <td className={`tabular ${priceClass(p.unrealizedPnLPct)}`}>
                  {fmtPct(p.unrealizedPnLPct, { signed: true })}
                </td>
                <td className="positions-row-actions">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrderTicket({
                        symbol: p.symbol,
                        side: p.qty >= 0 ? 'sell' : 'buy',
                      });
                    }}
                  >
                    Trade
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
