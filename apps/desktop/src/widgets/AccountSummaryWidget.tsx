import type { IDockviewPanelProps } from 'dockview-react';
import { ArrowDown, ArrowUp, Plug } from 'lucide-react';

import { fmtPct, fmtSignedUsd, fmtUsd, priceClass } from '../lib/format';
import { useBalances, useBrokerStatus } from '../lib/queries';
import { selectActiveAccountRef, useWorkspaceStore } from '../store/workspace';

import './AccountSummaryWidget.css';

export function AccountSummaryWidget(_props: IDockviewPanelProps) {
  const account = useWorkspaceStore((s) => s.activeAccount);
  const accountRef = useWorkspaceStore(selectActiveAccountRef);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const openConnectModal = useWorkspaceStore((s) => s.openConnectModal);
  const status = useBrokerStatus(dataBroker);
  const isConnected = status.data?.connected === true;
  const balances = useBalances(accountRef, isConnected);

  if (!isConnected || !accountRef) {
    return (
      <div className="account-summary-widget">
        <div className="account-summary-empty">
          <Plug size={24} />
          <p>Connect a broker to see your account.</p>
          <button
            type="button"
            className="account-summary-connect-btn"
            onClick={() => openConnectModal('alpaca')}
          >
            Connect Alpaca
          </button>
        </div>
      </div>
    );
  }

  const b = balances.data;
  const dayPnL = b?.dayPnL ?? null;
  const dayPnLPct = b?.dayPnLPct ?? null;
  const dirIcon =
    dayPnL == null ? null : dayPnL >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />;

  return (
    <div className="account-summary-widget">
      <div className="account-summary-header">
        <span className="account-summary-name">{account.name}</span>
        <span className="account-summary-broker-tag">{account.brokerLabel}</span>
      </div>
      <div className="account-summary-equity tabular">{fmtUsd(b?.equity)}</div>
      <div className={`account-summary-pnl tabular ${priceClass(dayPnL)}`}>
        {dirIcon}
        <span>{fmtSignedUsd(dayPnL)}</span>
        <span className="account-summary-pnl-pct">{fmtPct(dayPnLPct, { signed: true })}</span>
        <span className="account-summary-pnl-period">Today</span>
      </div>
      <dl className="account-summary-grid">
        <div>
          <dt>Cash</dt>
          <dd className="tabular">{fmtUsd(b?.cash)}</dd>
        </div>
        <div>
          <dt>Buying power</dt>
          <dd className="tabular">{fmtUsd(b?.buyingPower)}</dd>
        </div>
        <div>
          <dt>Options BP</dt>
          <dd className="tabular">{fmtUsd(b?.optionBuyingPower)}</dd>
        </div>
        <div>
          <dt>Market value</dt>
          <dd className="tabular">{fmtUsd(b?.marketValue)}</dd>
        </div>
      </dl>
    </div>
  );
}
