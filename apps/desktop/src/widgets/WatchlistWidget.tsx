import type { IDockviewPanelProps } from 'dockview-react';
import { Plug, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useBrokerStatus, useQuote } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';

import './WatchlistWidget.css';

export function WatchlistWidget(_props: IDockviewPanelProps) {
  const watchlist = useWorkspaceStore((s) => s.watchlist);
  const addToWatchlist = useWorkspaceStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useWorkspaceStore((s) => s.removeFromWatchlist);
  const setActiveSymbol = useWorkspaceStore((s) => s.setActiveSymbol);
  const activeSymbol = useWorkspaceStore((s) => s.activeSymbol);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const openConnectModal = useWorkspaceStore((s) => s.openConnectModal);

  const status = useBrokerStatus(dataBroker);
  const [draft, setDraft] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = draft.trim().toUpperCase();
    if (!sym) return;
    addToWatchlist(sym);
    setActiveSymbol(sym);
    setDraft('');
  }

  if (status.data && !status.data.connected) {
    return (
      <div className="watchlist-widget">
        <div className="watchlist-empty">
          <Plug size={24} />
          <p>Connect Alpaca to see live quotes.</p>
          <button
            type="button"
            className="watchlist-connect-btn"
            onClick={() => openConnectModal('alpaca')}
          >
            Connect Alpaca
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="watchlist-widget">
      <form className="watchlist-add" onSubmit={handleSubmit}>
        <input
          className="watchlist-input"
          placeholder="Add symbol (e.g. AAPL)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="watchlist-add-btn" aria-label="Add to watchlist">
          <Plus size={14} />
        </button>
      </form>
      {watchlist.length === 0 ? (
        <div className="watchlist-empty">
          <p>Watchlist is empty. Add a symbol above.</p>
        </div>
      ) : (
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Bid</th>
              <th>Ask</th>
              <th>Last</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {watchlist.map((sym) => (
              <WatchlistRow
                key={sym}
                symbol={sym}
                isActive={sym === activeSymbol}
                onSelect={() => setActiveSymbol(sym)}
                onRemove={() => removeFromWatchlist(sym)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function WatchlistRow(props: {
  symbol: string;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const q = useQuote(dataBroker, props.symbol);

  const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toFixed(2));

  return (
    <tr className={props.isActive ? 'is-active' : ''} onClick={props.onSelect}>
      <td className="watchlist-symbol">{props.symbol}</td>
      <td className="tabular">{fmt(q.data?.bid)}</td>
      <td className="tabular">{fmt(q.data?.ask)}</td>
      <td className="tabular">{fmt(q.data?.last)}</td>
      <td className="watchlist-row-actions">
        <button
          type="button"
          aria-label={`Remove ${props.symbol}`}
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove();
          }}
        >
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}
