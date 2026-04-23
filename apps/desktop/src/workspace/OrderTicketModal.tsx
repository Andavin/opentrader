import type { OrderRequest, OrderType, TimeInForce } from '@opentrader/broker-core';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fmtUsd } from '../lib/format';
import { usePlaceOrder, useQuote } from '../lib/queries';
import { selectActiveAccountRef, useWorkspaceStore } from '../store/workspace';

import './OrderTicketModal.css';

type Side = 'buy' | 'sell';

const ORDER_TYPES: Array<{ id: OrderType; label: string }> = [
  { id: 'market', label: 'Market' },
  { id: 'limit', label: 'Limit' },
  { id: 'stop', label: 'Stop' },
  { id: 'stop_limit', label: 'Stop limit' },
];

const TIFS: Array<{ id: TimeInForce; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'gtc', label: 'GTC' },
];

export function OrderTicketModal() {
  const seed = useWorkspaceStore((s) => s.orderTicketOpen);
  const close = useWorkspaceStore((s) => s.openOrderTicket);
  const accountRef = useWorkspaceStore(selectActiveAccountRef);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);

  const [side, setSide] = useState<Side>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [qty, setQty] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [tif, setTif] = useState<TimeInForce>('day');
  const [extendedHours, setExtendedHours] = useState(false);

  const symbol = seed?.symbol ?? null;
  const quote = useQuote(dataBroker, symbol, !!seed);
  const placeOrder = usePlaceOrder();

  // Re-seed form when ticket opens.
  useEffect(() => {
    if (!seed) return;
    setSide(seed.side);
    if (seed.limitPrice != null) {
      setLimitPrice(seed.limitPrice.toFixed(2));
    } else if (quote.data) {
      setLimitPrice((seed.side === 'buy' ? quote.data.ask : quote.data.bid).toFixed(2));
    }
    placeOrder.reset();
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!seed || !symbol) return null;

  const qtyNum = Number(qty);
  const limitNum = Number(limitPrice);
  const stopNum = Number(stopPrice);

  const needsLimit = orderType === 'limit' || orderType === 'stop_limit';
  const needsStop = orderType === 'stop' || orderType === 'stop_limit';

  const referencePrice =
    orderType === 'market'
      ? side === 'buy'
        ? quote.data?.ask
        : quote.data?.bid
      : needsLimit
        ? limitNum
        : stopNum;
  const estimatedCost =
    Number.isFinite(qtyNum) && referencePrice != null && Number.isFinite(referencePrice)
      ? qtyNum * referencePrice
      : null;

  const valid =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    (!needsLimit || (Number.isFinite(limitNum) && limitNum > 0)) &&
    (!needsStop || (Number.isFinite(stopNum) && stopNum > 0)) &&
    !!accountRef;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !symbol || !accountRef) return;
    const req: OrderRequest = {
      account: accountRef,
      legs: [{ symbol, assetClass: 'equity', side, ratio: 1 }],
      orderType,
      qty: qtyNum,
      limitPrice: needsLimit ? limitNum : undefined,
      stopPrice: needsStop ? stopNum : undefined,
      timeInForce: tif,
      extendedHours,
    };
    placeOrder.mutate(req, {
      onSuccess: () => {
        close(null);
      },
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div
        className={`order-ticket ${side === 'buy' ? 'is-buy' : 'is-sell'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="order-ticket-header">
          <div className="order-ticket-title">
            <span className="order-ticket-symbol">{symbol}</span>
            {quote.data && (
              <span className="order-ticket-quote tabular">
                bid {quote.data.bid.toFixed(2)} · ask {quote.data.ask.toFixed(2)}
              </span>
            )}
          </div>
          <button type="button" className="modal-close" onClick={() => close(null)} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="order-ticket-tabs">
          <button
            type="button"
            className={`order-ticket-tab is-buy${side === 'buy' ? ' is-active' : ''}`}
            onClick={() => setSide('buy')}
          >
            Buy
          </button>
          <button
            type="button"
            className={`order-ticket-tab is-sell${side === 'sell' ? ' is-active' : ''}`}
            onClick={() => setSide('sell')}
          >
            Sell
          </button>
        </div>

        <form className="order-ticket-body" onSubmit={handleSubmit}>
          <div className="order-ticket-row">
            <label className="order-ticket-field">
              <span>Order type</span>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}>
                {ORDER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="order-ticket-field">
              <span>Time in force</span>
              <select value={tif} onChange={(e) => setTif(e.target.value as TimeInForce)}>
                {TIFS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="order-ticket-field">
            <span>Quantity (shares)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </label>
          {needsLimit && (
            <label className="order-ticket-field">
              <span>Limit price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                required
              />
            </label>
          )}
          {needsStop && (
            <label className="order-ticket-field">
              <span>Stop price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                required
              />
            </label>
          )}
          <label className="order-ticket-checkbox">
            <input
              type="checkbox"
              checked={extendedHours}
              onChange={(e) => setExtendedHours(e.target.checked)}
            />
            <span>Allow extended-hours fill</span>
          </label>

          <dl className="order-ticket-summary">
            <div>
              <dt>Estimated {side === 'buy' ? 'cost' : 'proceeds'}</dt>
              <dd className="tabular">{fmtUsd(estimatedCost)}</dd>
            </div>
          </dl>

          {placeOrder.isError && (
            <p className="order-ticket-error">{(placeOrder.error as Error).message}</p>
          )}

          <button
            type="submit"
            className={`order-ticket-submit ${side === 'buy' ? 'is-buy' : 'is-sell'}`}
            disabled={!valid || placeOrder.isPending}
          >
            {placeOrder.isPending
              ? 'Submitting…'
              : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
          </button>
        </form>
      </div>
    </div>
  );
}
