import { useEffect } from 'react';

import { useBalances, useBrokerStatus } from '../lib/queries';
import { marketSession } from '../lib/marketClock';
import { useActiveAccountRef, useWorkspaceStore } from '../store/workspace';

/**
 * Side-effect-only component that auto-rotates the workspace aura.
 *
 * Priority (most-specific first):
 *   1. focus  — never auto-set; only manual via /aura command
 *   2. profit / loss — based on day P&L sign (>$0.50 / <-$0.50)
 *   3. extended — pre/after-hours / overnight
 *   4. regular — fallback during market hours
 */
export function AuraSync() {
  const setAura = useWorkspaceStore((s) => s.setAura);
  const aura = useWorkspaceStore((s) => s.aura);
  const accountRef = useActiveAccountRef();
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const status = useBrokerStatus(dataBroker);
  const isConnected = status.data?.connected === true;
  const balances = useBalances(accountRef, isConnected);

  useEffect(() => {
    if (aura === 'focus') return; // user-locked

    const tick = () => {
      const session = marketSession();
      const dayPnL = balances.data?.dayPnL;
      let next: typeof aura;
      if (dayPnL != null && dayPnL > 0.5) next = 'profit';
      else if (dayPnL != null && dayPnL < -0.5) next = 'loss';
      else if (session !== 'regular') next = 'extended';
      else next = 'regular';
      if (next !== aura) setAura(next);
    };

    tick();
    const handle = setInterval(tick, 30_000);
    return () => clearInterval(handle);
  }, [aura, balances.data?.dayPnL, setAura]);

  // Reflect the aura on the document root so theme.css's [data-aura=…]
  // overrides apply without each component opting in.
  useEffect(() => {
    document.documentElement.dataset.aura = aura;
    return () => {
      delete document.documentElement.dataset.aura;
    };
  }, [aura]);

  return null;
}
