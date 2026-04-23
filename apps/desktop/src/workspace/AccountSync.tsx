import { useEffect } from 'react';

import { useAccounts, useBrokerStatus } from '../lib/queries';
import { useWorkspaceStore } from '../store/workspace';

/**
 * Side-effect-only component: when the active data broker reports
 * connected, fetch its accounts and auto-promote the first one to be
 * the active account (replacing the demo placeholder). When it goes
 * disconnected, fall back to demo. No DOM output.
 */
export function AccountSync() {
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const setActiveAccount = useWorkspaceStore((s) => s.setActiveAccount);
  const activeAccount = useWorkspaceStore((s) => s.activeAccount);

  const status = useBrokerStatus(dataBroker);
  const isConnected = status.data?.connected === true;
  const accounts = useAccounts(dataBroker, isConnected);

  useEffect(() => {
    if (isConnected && accounts.data && accounts.data.length > 0) {
      const first = accounts.data[0]!;
      // Avoid resetting if already pointing at this account (prevents re-renders).
      if (
        activeAccount.brokerId !== first.brokerId ||
        activeAccount.accountId !== first.accountId
      ) {
        setActiveAccount({
          brokerId: first.brokerId,
          brokerLabel: status.data?.label?.toLowerCase() ?? first.brokerId,
          accountId: first.accountId,
          name: first.name,
        });
      }
    } else if (!isConnected && activeAccount.brokerId !== 'demo') {
      setActiveAccount({
        brokerId: 'demo',
        brokerLabel: 'demo',
        accountId: 'demo-1',
        name: 'Individual',
      });
    }
  }, [isConnected, accounts.data, status.data?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
