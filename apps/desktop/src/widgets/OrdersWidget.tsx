import type { OrderStatus } from '@opentrader/broker-core';
import type { IDockviewPanelProps } from 'dockview-react';
import { X } from 'lucide-react';

import { fmtNum, fmtUsd } from '../lib/format';
import { useBrokerStatus, useCancelOrder, useOrders } from '../lib/queries';
import { selectActiveAccountRef, useWorkspaceStore } from '../store/workspace';

import './OrdersWidget.css';

const OPEN_STATUSES: OrderStatus[] = ['open', 'pending', 'partial'];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  open: 'Working',
  partial: 'Partial',
  filled: 'Filled',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'is-pending',
  open: 'is-open',
  partial: 'is-partial',
  filled: 'is-filled',
  cancelled: 'is-cancelled',
  rejected: 'is-rejected',
  expired: 'is-expired',
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function OrdersWidget(_props: IDockviewPanelProps) {
  const accountRef = useWorkspaceStore(selectActiveAccountRef);
  const setActiveSymbol = useWorkspaceStore((s) => s.setActiveSymbol);
  const activeSymbol = useWorkspaceStore((s) => s.activeSymbol);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);
  const status = useBrokerStatus(dataBroker);
  const isConnected = status.data?.connected === true;
  const orders = useOrders(accountRef, isConnected);
  const cancelOrder = useCancelOrder();

  if (!isConnected || !accountRef) {
    return (
      <div className="orders-widget">
        <div className="orders-empty">Connect a broker to see recent orders.</div>
      </div>
    );
  }

  const rows = orders.data ?? [];

  return (
    <div className="orders-widget">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Status</th>
            <th>Side</th>
            <th>Type</th>
            <th>Qty</th>
            <th>Filled</th>
            <th>Limit</th>
            <th>Avg fill</th>
            <th>Time</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="orders-empty-row">
                No recent orders.
              </td>
            </tr>
          ) : (
            rows.map((o) => {
              const leg = o.legs[0];
              const symbol = leg?.symbol ?? '—';
              const side = leg?.side ?? '—';
              const isOpen = OPEN_STATUSES.includes(o.status);
              return (
                <tr
                  key={o.id}
                  className={symbol === activeSymbol ? 'is-active' : ''}
                  onClick={() => symbol !== '—' && setActiveSymbol(symbol)}
                >
                  <td className="orders-symbol">{symbol}</td>
                  <td>
                    <span className={`orders-status ${STATUS_CLASS[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className={`orders-side ${side === 'buy' ? 'price-up' : 'price-down'}`}>
                    {side.toUpperCase()}
                  </td>
                  <td>{o.orderType}</td>
                  <td className="tabular">{fmtNum(o.qty)}</td>
                  <td className="tabular">{fmtNum(o.filledQty)}</td>
                  <td className="tabular">{o.limitPrice != null ? fmtUsd(o.limitPrice) : '—'}</td>
                  <td className="tabular">
                    {o.avgFillPrice != null ? fmtUsd(o.avgFillPrice) : '—'}
                  </td>
                  <td className="orders-time tabular">{fmtTime(o.submittedAt)}</td>
                  <td className="orders-row-actions">
                    {isOpen ? (
                      <button
                        type="button"
                        title="Cancel order"
                        aria-label={`Cancel ${o.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelOrder.mutate({ account: accountRef, orderId: o.id });
                        }}
                        disabled={cancelOrder.isPending}
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
