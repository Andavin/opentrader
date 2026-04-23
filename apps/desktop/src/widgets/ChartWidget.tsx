import type { BrokerId, CandleInterval } from '@opentrader/broker-core';
import type { IDockviewPanelProps } from 'dockview-react';
import {
  dispose,
  init,
  type Chart,
  type DataLoader,
  type Period,
  type PeriodType,
} from 'klinecharts';
import { useEffect, useRef } from 'react';

import { brokerClient } from '../lib/brokerClient';
import { useWorkspaceStore } from '../store/workspace';

import './ChartWidget.css';

const INTERVAL_TO_PERIOD: Record<CandleInterval, Period> = {
  '1m': { type: 'minute', span: 1 },
  '2m': { type: 'minute', span: 2 },
  '5m': { type: 'minute', span: 5 },
  '15m': { type: 'minute', span: 15 },
  '30m': { type: 'minute', span: 30 },
  '1h': { type: 'hour', span: 1 },
  '2h': { type: 'hour', span: 2 },
  '4h': { type: 'hour', span: 4 },
  '1d': { type: 'day', span: 1 },
  '1w': { type: 'week', span: 1 },
  '1M': { type: 'month', span: 1 },
};

/** Approximate bar duration in ms — used to size the requested window. */
const BAR_MS: Record<PeriodType, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_628_000_000,
  year: 31_536_000_000,
};

const HISTORY_WINDOW_BARS = 500;

/** Build a DataLoader that pulls bars from the sidecar via brokerClient. */
function makeDataLoader(getBroker: () => BrokerId, getInterval: () => CandleInterval): DataLoader {
  return {
    getBars: async ({ type, timestamp, period, symbol, callback }) => {
      const intervalKey = getInterval();
      const broker = getBroker();
      const barMs = BAR_MS[period.type] * period.span;
      const windowMs = HISTORY_WINDOW_BARS * barMs;
      let to: number;
      let from: number;
      if (type === 'init') {
        to = Date.now();
        from = to - windowMs;
      } else if (type === 'forward') {
        // older data
        to = (timestamp ?? Date.now()) - barMs;
        from = to - windowMs;
      } else {
        // 'backward' or 'update' — fetch newest
        from = timestamp ?? Date.now() - windowMs;
        to = Date.now();
      }
      try {
        const candles = await brokerClient.getCandles(broker, {
          symbol: symbol.ticker,
          interval: intervalKey,
          from,
          to,
        });
        callback(
          candles.map((c) => ({
            timestamp: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
          { backward: type === 'init', forward: type === 'init' || type === 'forward' },
        );
      } catch (err) {
        console.warn('chart loader failed', err);
        callback([]);
      }
    },
  };
}

export function ChartWidget(_props: IDockviewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const symbol = useWorkspaceStore((s) => s.activeSymbol);
  const interval = useWorkspaceStore((s) => s.chartInterval);
  const setInterval = useWorkspaceStore((s) => s.setChartInterval);
  const dataBroker = useWorkspaceStore((s) => s.dataBroker);

  // Keep current broker/interval reachable inside the data-loader closure
  // without re-creating the loader on every render.
  const intervalRef = useRef(interval);
  const brokerRef = useRef(dataBroker);
  intervalRef.current = interval;
  brokerRef.current = dataBroker;

  // Init / dispose chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = init(el);
    if (!chart) return;
    chartRef.current = chart;
    chart.createIndicator('VOL', false, { id: 'pane-volume' });
    chart.setStyles({
      grid: { horizontal: { color: '#211c25' }, vertical: { color: '#211c25' } },
      candle: {
        bar: {
          upColor: '#00c805',
          downColor: '#ff3b3b',
          noChangeColor: '#7e7686',
          upBorderColor: '#00c805',
          downBorderColor: '#ff3b3b',
          upWickColor: '#00c805',
          downWickColor: '#ff3b3b',
        },
      },
      yAxis: { axisLine: { color: '#2d2730' }, tickText: { color: '#b8b1be' } },
      xAxis: { axisLine: { color: '#2d2730' }, tickText: { color: '#b8b1be' } },
      crosshair: {
        horizontal: { line: { color: '#443c4a' }, text: { color: '#f0ecef' } },
        vertical: { line: { color: '#443c4a' }, text: { color: '#f0ecef' } },
      },
    });
    chart.setDataLoader(
      makeDataLoader(
        () => brokerRef.current,
        () => intervalRef.current,
      ),
    );
    return () => {
      dispose(el);
      chartRef.current = null;
    };
  }, []);

  // React to symbol / period changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (symbol) {
      chart.setSymbol({ ticker: symbol, pricePrecision: 2, volumePrecision: 0 });
      chart.setPeriod(INTERVAL_TO_PERIOD[interval]);
    }
  }, [symbol, interval]);

  const intervals: Array<{ id: CandleInterval; label: string }> = [
    { id: '1m', label: '1m' },
    { id: '5m', label: '5m' },
    { id: '15m', label: '15m' },
    { id: '1h', label: '1h' },
    { id: '1d', label: '1D' },
    { id: '1w', label: '1W' },
  ];

  const openOrderTicket = useWorkspaceStore((s) => s.openOrderTicket);

  return (
    <div className="chart-widget">
      <div className="chart-toolbar">
        <button
          type="button"
          className="chart-trade-btn is-buy"
          disabled={!symbol}
          onClick={() =>
            symbol &&
            openOrderTicket({
              legs: [{ symbol, assetClass: 'equity', side: 'buy' }],
              orderType: 'limit',
            })
          }
        >
          Buy
        </button>
        <button
          type="button"
          className="chart-trade-btn is-sell"
          disabled={!symbol}
          onClick={() =>
            symbol &&
            openOrderTicket({
              legs: [{ symbol, assetClass: 'equity', side: 'sell' }],
              orderType: 'limit',
            })
          }
        >
          Sell
        </button>
        <span className="chart-symbol tabular">{symbol ?? '—'}</span>
        <div className="chart-intervals">
          {intervals.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`chart-interval-btn${i.id === interval ? ' is-active' : ''}`}
              onClick={() => setInterval(i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      {!symbol ? (
        <div className="chart-empty">
          <p>Pick a symbol from the watchlist to load a chart.</p>
        </div>
      ) : (
        <div ref={containerRef} className="chart-canvas" />
      )}
    </div>
  );
}
