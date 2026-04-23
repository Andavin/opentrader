import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';

import { Popover } from '../lib/Popover';
import { useConnectedBrokers } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';
import { DataFeedDropdown } from './DataFeedDropdown';

import './AccountDropdown.css';

const KNOWN_BROKER_LABELS: Record<string, string> = {
  alpaca: 'Alpaca',
  robinhood: 'Robinhood',
  fidelity: 'Fidelity',
};

/**
 * Top-bar account dropdown:
 *   - shows the active account
 *   - lets the user toggle the data feed (Algo Trader Plus / IEX / etc.)
 *     for the currently-active broker
 *   - lets the user connect any registered broker that isn't connected
 *     yet (the "Add broker" UX)
 *   - lists every connected broker so the user can switch the active
 *     data broker
 */
export function AccountDropdown() {
  const activeAccount = useWorkspaceStore((s) => s.activeAccount);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const setDataBroker = useWorkspaceStore((s) => s.setDataBroker);
  const openConnectModal = useWorkspaceStore((s) => s.openConnectModal);
  const brokersQ = useConnectedBrokers(true);

  const [open, setOpen] = useState(false);

  const allBrokers = brokersQ.data ?? [];
  const connectedBrokers = allBrokers.filter((b) => b.connected);
  const disconnectedBrokers = allBrokers.filter((b) => !b.connected);
  const activeBrokerEntry = allBrokers.find((b) => b.id === dataBroker);
  const activeIsConnected = activeBrokerEntry?.connected === true;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      className="account-dropdown-popover"
      trigger={
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
      }
    >
      <div className="account-dropdown-header">
        <span className="account-dropdown-broker-tag">{dataBroker}</span>
        <span
          className={[
            'account-dropdown-conn',
            activeIsConnected ? 'is-connected' : 'is-disconnected',
          ].join(' ')}
        >
          {activeIsConnected ? '● connected' : '● not connected'}
        </span>
      </div>

      {activeIsConnected ? (
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
          Connect {KNOWN_BROKER_LABELS[dataBroker] ?? dataBroker}
        </button>
      )}

      {connectedBrokers.length > 1 && (
        <>
          <div className="account-dropdown-divider" />
          <div className="account-dropdown-section-title">Switch active broker</div>
          {connectedBrokers.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`account-dropdown-broker-row${b.id === dataBroker ? ' is-active' : ''}`}
              onClick={() => {
                setDataBroker(b.id);
                setOpen(false);
              }}
            >
              <span className="account-dropdown-broker-label">{b.label}</span>
              <span className="account-dropdown-broker-status">●</span>
            </button>
          ))}
        </>
      )}

      {disconnectedBrokers.length > 0 && (
        <>
          <div className="account-dropdown-divider" />
          <div className="account-dropdown-section-title">Connect a broker</div>
          {disconnectedBrokers.map((b) => (
            <button
              key={b.id}
              type="button"
              className="account-dropdown-broker-row is-add"
              onClick={() => {
                setOpen(false);
                openConnectModal(b.id);
              }}
            >
              <Plus size={11} />
              <span className="account-dropdown-broker-label">{b.label}</span>
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}
