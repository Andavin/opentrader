import type { OptionContract } from '@opentrader/broker-core';
import type { IDockviewPanelProps } from 'dockview-react';
import { useEffect, useMemo, useState } from 'react';

import { fmtCompact, fmtNum, fmtUsd } from '../lib/format';
import { useOptionsChain } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';

import './OptionsChainWidget.css';

interface StrikeRow {
  strike: number;
  call?: OptionContract;
  put?: OptionContract;
}

function groupByStrike(contracts: OptionContract[]): StrikeRow[] {
  const map = new Map<number, StrikeRow>();
  for (const c of contracts) {
    const row = map.get(c.strike) ?? { strike: c.strike };
    if (c.type === 'call') row.call = c;
    else row.put = c;
    map.set(c.strike, row);
  }
  return [...map.values()].sort((a, b) => a.strike - b.strike);
}

export function OptionsChainWidget(_props: IDockviewPanelProps) {
  const symbol = useWorkspaceStore((s) => s.activeSymbol);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const appendLeg = useWorkspaceStore((s) => s.appendOrderTicketLeg);

  const [expiration, setExpiration] = useState<string | null>(null);

  const chain = useOptionsChain(dataBroker, { underlying: symbol, expiration: expiration ?? undefined });

  // Auto-pick the soonest expiration when the chain first loads / symbol changes.
  useEffect(() => {
    if (!expiration && chain.data?.expirations.length) {
      setExpiration(chain.data.expirations[0]!);
    }
  }, [chain.data, expiration]);

  // Reset expiration when symbol changes.
  useEffect(() => {
    setExpiration(null);
  }, [symbol]);

  const rows = useMemo(() => groupByStrike(chain.data?.contracts ?? []), [chain.data]);

  function clickLeg(contract: OptionContract, side: 'buy' | 'sell') {
    appendLeg(
      {
        symbol: contract.symbol,
        assetClass: 'option',
        side,
        ratio: 1,
      },
      {
        delta: contract.delta,
        gamma: contract.gamma,
        theta: contract.theta,
        vega: contract.vega,
        iv: contract.iv,
      },
    );
  }

  if (!symbol) {
    return (
      <div className="options-chain">
        <div className="options-chain-empty">Pick an underlying symbol to load its chain.</div>
      </div>
    );
  }

  return (
    <div className="options-chain">
      <header className="options-chain-header">
        <span className="options-chain-symbol">{symbol}</span>
        <select
          className="options-chain-exp"
          value={expiration ?? ''}
          onChange={(e) => setExpiration(e.target.value || null)}
          disabled={!chain.data?.expirations.length}
        >
          {chain.data?.expirations.length ? (
            chain.data.expirations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))
          ) : (
            <option value="">No expirations</option>
          )}
        </select>
        <span className="options-chain-status">
          {chain.isFetching ? 'loading…' : chain.error ? `error: ${(chain.error as Error).message}` : ''}
        </span>
      </header>

      <div className="options-chain-grid">
        <table className="options-chain-table">
          <thead>
            <tr>
              <th colSpan={5} className="options-chain-side-header is-call">
                CALLS
              </th>
              <th className="options-chain-strike-header">Strike</th>
              <th colSpan={5} className="options-chain-side-header is-put">
                PUTS
              </th>
            </tr>
            <tr>
              <th>Δ</th>
              <th>OI</th>
              <th>Vol</th>
              <th>Bid</th>
              <th>Ask</th>
              <th>—</th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Vol</th>
              <th>OI</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="options-chain-empty-row">
                  {chain.isFetching ? 'Loading chain…' : 'No contracts for this expiration.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.strike}>
                  <td className="tabular">{fmtNum(r.call?.delta)}</td>
                  <td className="tabular">{fmtCompact(r.call?.openInterest)}</td>
                  <td className="tabular">{fmtCompact(r.call?.volume)}</td>
                  <td
                    className="tabular options-chain-clickable"
                    onClick={() => r.call && clickLeg(r.call, 'sell')}
                    title="Sell to open at bid"
                  >
                    {fmtUsd(r.call?.bid)}
                  </td>
                  <td
                    className="tabular options-chain-clickable"
                    onClick={() => r.call && clickLeg(r.call, 'buy')}
                    title="Buy to open at ask"
                  >
                    {fmtUsd(r.call?.ask)}
                  </td>
                  <td className="tabular options-chain-strike">{fmtUsd(r.strike)}</td>
                  <td
                    className="tabular options-chain-clickable"
                    onClick={() => r.put && clickLeg(r.put, 'sell')}
                    title="Sell to open at bid"
                  >
                    {fmtUsd(r.put?.bid)}
                  </td>
                  <td
                    className="tabular options-chain-clickable"
                    onClick={() => r.put && clickLeg(r.put, 'buy')}
                    title="Buy to open at ask"
                  >
                    {fmtUsd(r.put?.ask)}
                  </td>
                  <td className="tabular">{fmtCompact(r.put?.volume)}</td>
                  <td className="tabular">{fmtCompact(r.put?.openInterest)}</td>
                  <td className="tabular">{fmtNum(r.put?.delta)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
