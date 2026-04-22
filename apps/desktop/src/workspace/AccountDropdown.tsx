import { ChevronDown } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspace';

import './AccountDropdown.css';

export function AccountDropdown() {
  const activeAccount = useWorkspaceStore((s) => s.activeAccount);

  return (
    <button type="button" className="account-dropdown" aria-haspopup="menu">
      <span className="account-dropdown-broker">{activeAccount.brokerLabel}</span>
      <span className="account-dropdown-name">{activeAccount.name}</span>
      <ChevronDown size={14} />
    </button>
  );
}
