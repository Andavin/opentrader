import type { BrokerId } from '@opentrader/broker-core';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Popover } from '../lib/Popover';
import { useDataFeed, useRefreshDataFeed, useSetDataFeed } from '../lib/queries';

import './DataFeedDropdown.css';

interface Props {
  brokerId: BrokerId;
}

/** Why a particular feed shows the "locked" tag — surfaced as the
 *  tooltip on the badge so the user isn't left guessing. */
function lockReason(feedId: string): string {
  switch (feedId) {
    case 'sip':
      return 'Real-time SIP requires the Algo Trader Plus subscription on Alpaca. Upgrade in your Alpaca dashboard, then click "Refresh entitlements".';
    case 'delayed_sip':
      return 'Delayed SIP is only available on certain endpoints (latest quote/trade) and your account does not currently have access via the historical-bars probe.';
    case 'iex':
      return 'IEX feed is unavailable for this account — unusual; contact your broker.';
    default:
      return 'This feed is not available on your subscription. Click "Refresh entitlements" if you have just upgraded.';
  }
}

export function DataFeedDropdown({ brokerId }: Props) {
  const [open, setOpen] = useState(false);

  const feedQ = useDataFeed(brokerId, open);
  const setFeed = useSetDataFeed(brokerId);
  const refreshFeed = useRefreshDataFeed(brokerId);

  const activeId = feedQ.data?.active;
  const activeLabel =
    feedQ.data?.feeds.find((f) => f.id === activeId)?.label ?? activeId ?? 'Data feed';

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="start"
      className="data-feed-popover"
      trigger={
        <button type="button" className="data-feed-trigger" onClick={() => setOpen((v) => !v)}>
          <span className="data-feed-trigger-label">Data feed:</span>
          <span className="data-feed-trigger-active">{activeLabel}</span>
          <ChevronDown size={12} />
        </button>
      }
    >
      {feedQ.isLoading && <div className="data-feed-status">Probing entitlements…</div>}
      {feedQ.error && (
        <div className="data-feed-status data-feed-error">{(feedQ.error as Error).message}</div>
      )}
      {feedQ.data?.feeds.map((f) => {
        const isActive = f.id === activeId;
        const disabled = !f.available;
        return (
          <button
            key={f.id}
            type="button"
            className={[
              'data-feed-item',
              isActive ? 'is-active' : '',
              disabled ? 'is-disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={disabled || setFeed.isPending}
            onClick={() => {
              if (disabled || isActive) return;
              setFeed.mutate(f.id, { onSuccess: () => setOpen(false) });
            }}
            title={disabled ? lockReason(f.id) : f.description}
          >
            <span className="data-feed-item-check">{isActive ? <Check size={12} /> : null}</span>
            <span className="data-feed-item-body">
              <span className="data-feed-item-label">{f.label}</span>
              {f.description && <span className="data-feed-item-desc">{f.description}</span>}
            </span>
            {!f.available && (
              <span className="data-feed-item-tag" title={lockReason(f.id)}>
                locked
              </span>
            )}
          </button>
        );
      })}
      <div className="data-feed-divider" />
      <button
        type="button"
        className="data-feed-refresh"
        onClick={() => refreshFeed.mutate()}
        disabled={refreshFeed.isPending}
      >
        <RefreshCw size={12} className={refreshFeed.isPending ? 'spin' : undefined} />
        <span>{refreshFeed.isPending ? 'Re-probing entitlements…' : 'Refresh entitlements'}</span>
      </button>
    </Popover>
  );
}
