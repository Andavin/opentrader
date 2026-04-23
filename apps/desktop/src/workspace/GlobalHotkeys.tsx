import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { HOTKEY_BY_ID } from '../lib/hotkeys';
import {
  useBrokerStatus,
  usePlaceOrder,
  usePositions,
  useQuote,
} from '../lib/queries';
import { selectActiveAccountRef, useWorkspaceStore } from '../store/workspace';
import { ShortcutsModal } from './ShortcutsModal';

/**
 * Headless component that binds the Legend-grammar global hotkeys.
 * Renders the ShortcutsModal so it can manage its own open state.
 */
export function GlobalHotkeys() {
  const symbol = useWorkspaceStore((s) => s.activeSymbol);
  const accountRef = useWorkspaceStore(selectActiveAccountRef);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const closeOrderTicket = useWorkspaceStore((s) => s.openOrderTicket);
  const closeConnectModal = useWorkspaceStore((s) => s.openConnectModal);
  const status = useBrokerStatus(dataBroker);
  const isConnected = status.data?.connected === true;
  const quote = useQuote(dataBroker, symbol, isConnected);
  const positions = usePositions(accountRef, isConnected);
  const placeOrder = usePlaceOrder();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  function placeQuick(side: 'buy' | 'sell', orderType: 'market' | 'limit', limitPrice?: number) {
    if (!symbol || !accountRef) return;
    placeOrder.mutate({
      account: accountRef,
      legs: [{ symbol, assetClass: 'equity', side }],
      orderType,
      qty: 1,
      limitPrice,
      timeInForce: 'day',
    });
  }

  useHotkeys(HOTKEY_BY_ID.buyMarket!.combo, () => placeQuick('buy', 'market'), {
    preventDefault: true,
    enabled: isConnected,
  });
  useHotkeys(HOTKEY_BY_ID.sellMarket!.combo, () => placeQuick('sell', 'market'), {
    preventDefault: true,
    enabled: isConnected,
  });
  useHotkeys(
    HOTKEY_BY_ID.buyLimitAsk!.combo,
    () => placeQuick('buy', 'limit', quote.data?.ask),
    { preventDefault: true, enabled: isConnected && !!quote.data?.ask },
  );
  useHotkeys(
    HOTKEY_BY_ID.sellLimitBid!.combo,
    () => placeQuick('sell', 'limit', quote.data?.bid),
    { preventDefault: true, enabled: isConnected && !!quote.data?.bid },
  );
  useHotkeys(
    HOTKEY_BY_ID.flattenPosition!.combo,
    () => {
      if (!symbol || !accountRef) return;
      const open = positions.data?.find((p) => p.symbol === symbol && p.qty !== 0);
      if (!open) return;
      placeOrder.mutate({
        account: accountRef,
        legs: [
          {
            symbol,
            assetClass: 'equity',
            side: open.qty > 0 ? 'sell' : 'buy',
          },
        ],
        orderType: 'market',
        qty: Math.abs(open.qty),
        timeInForce: 'day',
      });
    },
    { preventDefault: true, enabled: isConnected },
  );
  useHotkeys(HOTKEY_BY_ID.openShortcuts!.combo, () => setShortcutsOpen(true), {
    preventDefault: true,
  });
  useHotkeys(HOTKEY_BY_ID.closeModal!.combo, () => {
    if (shortcutsOpen) {
      setShortcutsOpen(false);
      return;
    }
    closeOrderTicket(null);
    closeConnectModal(null);
  });

  return <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />;
}
