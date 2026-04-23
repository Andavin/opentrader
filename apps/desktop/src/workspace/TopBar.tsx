import type { DockviewApi } from 'dockview-react';
import { Bell, Maximize2, Search, Settings, User } from 'lucide-react';

import { AccountDropdown } from './AccountDropdown';
import { AddWidgetMenu } from './AddWidgetMenu';
import { useQuote } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';

import './TopBar.css';

interface Props {
  dockviewApi: DockviewApi | null;
}

export function TopBar({ dockviewApi }: Props) {
  const symbol = useWorkspaceStore((s) => s.activeSymbol);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const quote = useQuote(dataBroker, symbol);

  const last = quote.data?.last;
  const change = last !== undefined && quote.data?.bid !== undefined ? last - quote.data.bid : undefined;
  const changeClass = change === undefined ? 'text-muted' : change >= 0 ? 'price-up' : 'price-down';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-icon-btn" aria-label="Search symbol">
          <Search size={16} />
        </button>
        <span className="topbar-symbol tabular">{symbol ?? '—'}</span>
        <span className="topbar-price tabular">{last !== undefined ? `$${last.toFixed(2)}` : '$0.00'}</span>
        <span className={`topbar-change tabular ${changeClass}`}>
          {change !== undefined ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}` : '—'}
        </span>
      </div>

      <div className="topbar-center">
        <button type="button" className="topbar-pill" aria-pressed="false">
          <span className="topbar-pill-dot" />
          Extended hours
        </button>
      </div>

      <div className="topbar-right">
        <AddWidgetMenu api={dockviewApi} />
        <AccountDropdown />
        <button type="button" className="topbar-icon-btn" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <button type="button" className="topbar-icon-btn" aria-label="Profile">
          <User size={16} />
        </button>
        <button type="button" className="topbar-icon-btn" aria-label="Settings">
          <Settings size={16} />
        </button>
        <button type="button" className="topbar-icon-btn" aria-label="Toggle fullscreen">
          <Maximize2 size={16} />
        </button>
      </div>
    </header>
  );
}
