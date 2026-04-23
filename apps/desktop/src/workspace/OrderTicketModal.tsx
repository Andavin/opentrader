import type { OrderLeg, OrderRequest, OrderType, TimeInForce } from '@opentrader/broker-core';
import { ArrowDown, ArrowRight, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { fmtNum, fmtSignedUsd, fmtUsd } from '../lib/format';
import { formatOcc } from '../lib/occ';
import { usePlaceOrder, useQuote } from '../lib/queries';
import { selectActiveAccountRef, useWorkspaceStore } from '../store/workspace';

import './OrderTicketModal.css';

type Side = 'buy' | 'sell';

const ORDER_TYPES_SINGLE: Array<{ id: OrderType; label: string }> = [
  { id: 'market', label: 'Market' },
  { id: 'limit', label: 'Limit' },
  { id: 'stop', label: 'Stop' },
  { id: 'stop_limit', label: 'Stop limit' },
];

/** Multi-leg only supports market/limit on Alpaca. */
const ORDER_TYPES_MULTI: Array<{ id: OrderType; label: string }> = [
  { id: 'limit', label: 'Limit' },
  { id: 'market', label: 'Market' },
];

const TIFS: Array<{ id: TimeInForce; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'gtc', label: 'GTC' },
];

function legSign(side: OrderLeg['side']): number {
  // Long-side legs contribute positively to net Greeks; sells flip sign.
  return side === 'buy' ? 1 : -1;
}

export function OrderTicketModal() {
  const draft = useWorkspaceStore((s) => s.orderTicketOpen);
  const close = useWorkspaceStore((s) => s.openOrderTicket);
  const removeLeg = useWorkspaceStore((s) => s.removeOrderTicketLeg);
  const snapshots = useWorkspaceStore((s) => s.optionLegSnapshots);
  const accountRef = useWorkspaceStore(selectActiveAccountRef);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);

  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [qty, setQty] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [tif, setTif] = useState<TimeInForce>('day');
  const [extendedHours, setExtendedHours] = useState(false);
  const [equitySide, setEquitySide] = useState<Side>('buy');
  // Bracket / OCO — single-equity only on Alpaca.
  const [bracketOn, setBracketOn] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [stopLossLimit, setStopLossLimit] = useState('');

  const isSingleEquity = !!draft && draft.legs.length === 1 && draft.legs[0]!.assetClass === 'equity';
  const isMultiLeg = !!draft && draft.legs.length > 1;
  const equitySymbol = isSingleEquity ? draft!.legs[0]!.symbol : null;
  const quote = useQuote(dataBroker, equitySymbol, !!draft);
  const placeOrder = usePlaceOrder();

  // Re-seed form whenever draft identity changes (open/swap).
  useEffect(() => {
    if (!draft) return;
    setOrderType(draft.orderType ?? (isMultiLeg ? 'limit' : 'limit'));
    if (draft.qty != null) setQty(String(draft.qty));
    if (draft.limitPrice != null) setLimitPrice(draft.limitPrice.toFixed(2));
    if (isSingleEquity) {
      const side = draft.legs[0]!.side === 'buy' ? 'buy' : 'sell';
      setEquitySide(side);
    }
    placeOrder.reset();
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill limit from current quote (single-equity) when not set.
  useEffect(() => {
    if (!quote.data || limitPrice || !isSingleEquity) return;
    setLimitPrice((equitySide === 'buy' ? quote.data.ask : quote.data.bid).toFixed(2));
  }, [quote.data, limitPrice, isSingleEquity, equitySide]);

  // Net Greeks derived from option-leg snapshots.
  const netGreeks = useMemo(() => {
    if (!draft) return null;
    const optionLegs = draft.legs.filter((l) => l.assetClass === 'option');
    if (optionLegs.length === 0) return null;
    const acc: Record<'delta' | 'gamma' | 'theta' | 'vega', number> = {
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
    };
    for (const leg of optionLegs) {
      const snap = snapshots[leg.symbol];
      if (!snap) continue;
      const ratio = leg.ratio ?? 1;
      const sign = legSign(leg.side);
      acc.delta += (snap.delta ?? 0) * ratio * sign;
      acc.gamma += (snap.gamma ?? 0) * ratio * sign;
      acc.theta += (snap.theta ?? 0) * ratio * sign;
      acc.vega += (snap.vega ?? 0) * ratio * sign;
    }
    return acc;
  }, [draft, snapshots]);

  if (!draft) return null;

  const qtyNum = Number(qty);
  const limitNum = Number(limitPrice);
  const stopNum = Number(stopPrice);
  const needsLimit = orderType === 'limit' || orderType === 'stop_limit';
  const needsStop = orderType === 'stop' || orderType === 'stop_limit';

  const valid =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    (!needsLimit || (Number.isFinite(limitNum) && (isMultiLeg ? true : limitNum > 0))) &&
    (!needsStop || (Number.isFinite(stopNum) && stopNum > 0)) &&
    !!accountRef &&
    draft.legs.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !accountRef || !draft) return;
    const legs: OrderLeg[] = isSingleEquity
      ? [{ ...draft.legs[0]!, side: equitySide }]
      : draft.legs;
    const tpNum = Number(takeProfit);
    const slNum = Number(stopLoss);
    const sllNum = Number(stopLossLimit);
    const bracket =
      isSingleEquity && bracketOn
        ? {
            takeProfitPrice: Number.isFinite(tpNum) && tpNum > 0 ? tpNum : undefined,
            stopLossPrice: Number.isFinite(slNum) && slNum > 0 ? slNum : undefined,
            stopLossLimit:
              Number.isFinite(sllNum) && sllNum > 0 ? sllNum : undefined,
          }
        : undefined;
    const req: OrderRequest = {
      account: accountRef,
      legs,
      orderType,
      qty: qtyNum,
      limitPrice: needsLimit ? limitNum : undefined,
      stopPrice: needsStop ? stopNum : undefined,
      timeInForce: tif,
      extendedHours: isSingleEquity ? extendedHours : undefined,
      bracket,
    };
    placeOrder.mutate(req, { onSuccess: () => close(null) });
  }

  // Single-equity reference price for cost preview.
  const referencePrice =
    isSingleEquity && orderType === 'market'
      ? equitySide === 'buy'
        ? quote.data?.ask
        : quote.data?.bid
      : needsLimit
        ? limitNum
        : stopNum;
  const estimatedCost =
    isSingleEquity && Number.isFinite(qtyNum) && referencePrice != null && Number.isFinite(referencePrice)
      ? qtyNum * referencePrice
      : null;

  const headlineSymbol = isSingleEquity
    ? draft.legs[0]!.symbol
    : isMultiLeg
      ? `${draft.legs.length}-leg ${draft.legs[0]?.symbol ? formatOcc(draft.legs[0]!.symbol).split(' ')[0] : ''}`
      : (draft.legs[0]?.symbol ?? '—');

  return (
    <div className="modal-backdrop" onMouseDown={() => close(null)}>
      <div
        className={`order-ticket ${isSingleEquity ? (equitySide === 'buy' ? 'is-buy' : 'is-sell') : 'is-multi'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="order-ticket-header">
          <div className="order-ticket-title">
            <span className="order-ticket-symbol">{headlineSymbol}</span>
            {isSingleEquity && quote.data && (
              <span className="order-ticket-quote tabular">
                bid {quote.data.bid.toFixed(2)} · ask {quote.data.ask.toFixed(2)}
              </span>
            )}
          </div>
          <button type="button" className="modal-close" onClick={() => close(null)} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {isSingleEquity && (
          <div className="order-ticket-tabs">
            <button
              type="button"
              className={`order-ticket-tab is-buy${equitySide === 'buy' ? ' is-active' : ''}`}
              onClick={() => setEquitySide('buy')}
            >
              Buy
            </button>
            <button
              type="button"
              className={`order-ticket-tab is-sell${equitySide === 'sell' ? ' is-active' : ''}`}
              onClick={() => setEquitySide('sell')}
            >
              Sell
            </button>
          </div>
        )}

        {!isSingleEquity && (
          <div className="order-ticket-legs">
            {draft.legs.map((leg, i) => (
              <div key={`${leg.symbol}-${i}`} className="order-ticket-leg">
                <span
                  className={`order-ticket-leg-side ${leg.side === 'buy' ? 'is-buy' : 'is-sell'}`}
                >
                  {leg.side === 'buy' ? 'BUY' : 'SELL'} {leg.ratio ?? 1}
                </span>
                <span className="order-ticket-leg-label">{formatOcc(leg.symbol)}</span>
                <button
                  type="button"
                  className="order-ticket-leg-remove"
                  onClick={() => removeLeg(i)}
                  aria-label="Remove leg"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <p className="order-ticket-leg-hint">
              <ArrowDown size={11} />
              <span>Click bid/ask in an Options Chain widget to add more legs.</span>
            </p>
          </div>
        )}

        <form className="order-ticket-body" onSubmit={handleSubmit}>
          <div className="order-ticket-row">
            <label className="order-ticket-field">
              <span>Order type</span>
              <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}>
                {(isMultiLeg ? ORDER_TYPES_MULTI : ORDER_TYPES_SINGLE).map((t) => (
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
            <span>{isSingleEquity ? 'Quantity (shares)' : 'Contracts (multiplier)'}</span>
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
              <span>{isMultiLeg ? 'Net debit / credit' : 'Limit price'}</span>
              <input
                type="number"
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
          {isSingleEquity && (
            <>
              <label className="order-ticket-checkbox">
                <input
                  type="checkbox"
                  checked={extendedHours}
                  onChange={(e) => setExtendedHours(e.target.checked)}
                />
                <span>Allow extended-hours fill</span>
              </label>
              <label className="order-ticket-checkbox">
                <input
                  type="checkbox"
                  checked={bracketOn}
                  onChange={(e) => setBracketOn(e.target.checked)}
                />
                <span>Add bracket / OCO (take-profit + stop-loss)</span>
              </label>
              {bracketOn && (
                <div className="order-ticket-bracket">
                  <label className="order-ticket-field">
                    <span>Take-profit limit</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="—"
                    />
                  </label>
                  <label className="order-ticket-field">
                    <span>Stop-loss stop</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="—"
                    />
                  </label>
                  <label className="order-ticket-field">
                    <span>Stop-loss limit (optional)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stopLossLimit}
                      onChange={(e) => setStopLossLimit(e.target.value)}
                      placeholder="—"
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {netGreeks && (
            <dl className="order-ticket-greeks">
              <div>
                <dt>Δ Delta</dt>
                <dd className="tabular">{fmtNum(netGreeks.delta * qtyNum)}</dd>
              </div>
              <div>
                <dt>Γ Gamma</dt>
                <dd className="tabular">{fmtNum(netGreeks.gamma * qtyNum)}</dd>
              </div>
              <div>
                <dt>Θ Theta</dt>
                <dd className="tabular">{fmtSignedUsd(netGreeks.theta * qtyNum * 100)}</dd>
              </div>
              <div>
                <dt>ν Vega</dt>
                <dd className="tabular">{fmtSignedUsd(netGreeks.vega * qtyNum * 100)}</dd>
              </div>
            </dl>
          )}

          {estimatedCost != null && (
            <dl className="order-ticket-summary">
              <div>
                <dt>Estimated {equitySide === 'buy' ? 'cost' : 'proceeds'}</dt>
                <dd className="tabular">{fmtUsd(estimatedCost)}</dd>
              </div>
            </dl>
          )}

          {placeOrder.isError && (
            <p className="order-ticket-error">{(placeOrder.error as Error).message}</p>
          )}

          <button
            type="submit"
            className={`order-ticket-submit ${isSingleEquity ? (equitySide === 'buy' ? 'is-buy' : 'is-sell') : 'is-multi'}`}
            disabled={!valid || placeOrder.isPending}
          >
            {placeOrder.isPending ? (
              'Submitting…'
            ) : (
              <>
                {isSingleEquity
                  ? `${equitySide === 'buy' ? 'Buy' : 'Sell'} ${headlineSymbol}`
                  : `Submit ${draft.legs.length}-leg order`}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
