import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useBrokerStatus } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';
import { DataFeedDropdown } from './DataFeedDropdown';

import './AccountDropdown.css';

export function AccountDropdown() {
  const activeAccount = useWorkspaceStore((s) => s.activeAccount);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const openConnectModal = useWorkspaceStore((s) => s.openConnectModal);
  const status = useBrokerStatus(dataBroker);

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

  const isConnected = status.data?.connected === true;

  return (
    <div className="account-dropdown-root" ref={rootRef}>
      <button
        type="button"
        className="account-dropdown"
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="account-dropdown-broker">{activeAccount.brokerLabel}</span>
        <span className="account-dropdown-name">{activeAccount.name}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="account-dropdown-popover" role="menu">
          <div className="account-dropdown-header">
            <span className="account-dropdown-broker-tag">{dataBroker}</span>
            <span
              className={[
                'account-dropdown-conn',
                isConnected ? 'is-connected' : 'is-disconnected',
              ].join(' ')}
            >
              {isConnected ? '● connected' : '● not connected'}
            </span>
          </div>

          {isConnected ? (
            <div className="account-dropdown-section">
              <DataFeedDropdown brokerId={dataBroker} />
            </div>
          ) : (
            <button
              type="button"
              className="account-dropdown-cta"
              onClick={() => {
                setOpen(false);
                openConnectModal(dataBroker);
              }}
            >
              Connect {dataBroker}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
