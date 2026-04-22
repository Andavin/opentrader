import { Bell, Maximize2, Plus, Search, Settings, User } from 'lucide-react';

import { AccountDropdown } from './AccountDropdown';

import './TopBar.css';

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-icon-btn" aria-label="Search symbol">
          <Search size={16} />
        </button>
        <span className="topbar-symbol tabular">—</span>
        <span className="topbar-price tabular">$0.00</span>
        <span className="topbar-change tabular text-muted">—</span>
      </div>

      <div className="topbar-center">
        <button type="button" className="topbar-pill" aria-pressed="false">
          <span className="topbar-pill-dot" />
          Extended hours
        </button>
      </div>

      <div className="topbar-right">
        <button type="button" className="topbar-action">
          <Plus size={14} />
          <span>Add widget</span>
        </button>
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
