import type { BrokerId } from '@opentrader/broker-core';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useDataFeed, useRefreshDataFeed, useSetDataFeed } from '../lib/queries';

import './DataFeedDropdown.css';

interface Props {
  brokerId: BrokerId;
}

export function DataFeedDropdown({ brokerId }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const feedQ = useDataFeed(brokerId, open);
  const setFeed = useSetDataFeed(brokerId);
  const refreshFeed = useRefreshDataFeed(brokerId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const activeId = feedQ.data?.active;
  const activeLabel =
    feedQ.data?.feeds.find((f) => f.id === activeId)?.label ?? activeId ?? 'Data feed';

  return (
    <div className="data-feed-dropdown" ref={rootRef}>
      <button type="button" className="data-feed-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="data-feed-trigger-label">Data feed:</span>
        <span className="data-feed-trigger-active">{activeLabel}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="data-feed-popover" role="menu">
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
                title={f.description}
              >
                <span className="data-feed-item-check">
                  {isActive ? <Check size={12} /> : null}
                </span>
                <span className="data-feed-item-body">
                  <span className="data-feed-item-label">{f.label}</span>
                  {f.description && <span className="data-feed-item-desc">{f.description}</span>}
                </span>
                {!f.available && <span className="data-feed-item-tag">locked</span>}
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
            <span>
              {refreshFeed.isPending ? 'Re-probing entitlements…' : 'Refresh entitlements'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
