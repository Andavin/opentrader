import type { Chart } from 'klinecharts';
import { Activity, Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { selectChartIndicators, useWorkspaceStore } from '../store/workspace';

import './ChartIndicatorsMenu.css';

/** The main candle pane id used by KLineChart v10. */
const CANDLE_PANE_ID = 'candle_pane';

interface IndicatorDef {
  name: string;
  label: string;
  /** Overlay indicators draw on the price pane; subplots get their own stacked pane. */
  kind: 'overlay' | 'subplot';
}

const OVERLAY_INDICATORS: IndicatorDef[] = [
  { name: 'MA', label: 'MA — Moving Average', kind: 'overlay' },
  { name: 'EMA', label: 'EMA — Exp. Moving Average', kind: 'overlay' },
  { name: 'SMA', label: 'SMA — Smoothed MA', kind: 'overlay' },
  { name: 'BOLL', label: 'BOLL — Bollinger Bands', kind: 'overlay' },
  { name: 'VWAP', label: 'VWAP', kind: 'overlay' },
  { name: 'SAR', label: 'SAR — Parabolic SAR', kind: 'overlay' },
];

const SUBPLOT_INDICATORS: IndicatorDef[] = [
  { name: 'VOL', label: 'VOL — Volume', kind: 'subplot' },
  { name: 'RSI', label: 'RSI — Rel. Strength Index', kind: 'subplot' },
  { name: 'MACD', label: 'MACD', kind: 'subplot' },
  { name: 'KDJ', label: 'KDJ — Stochastic Oscillator', kind: 'subplot' },
  { name: 'MFI', label: 'MFI — Money Flow Index', kind: 'subplot' },
  { name: 'ATR', label: 'ATR — Avg. True Range', kind: 'subplot' },
  { name: 'OBV', label: 'OBV — On-Balance Volume', kind: 'subplot' },
];

const ALL_INDICATORS: IndicatorDef[] = [...OVERLAY_INDICATORS, ...SUBPLOT_INDICATORS];

interface Props {
  panelId: string;
  chartRef: React.RefObject<Chart | null>;
}

export function ChartIndicatorsMenu({ panelId, chartRef }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeNames = useWorkspaceStore(useShallow(selectChartIndicators(panelId)));
  const setChartIndicators = useWorkspaceStore((s) => s.setChartIndicators);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle(def: IndicatorDef) {
    const chart = chartRef.current;
    if (!chart) return;

    const isActive = activeNames.includes(def.name);

    if (isActive) {
      chart.removeIndicator({ name: def.name });
      setChartIndicators(
        panelId,
        activeNames.filter((n) => n !== def.name),
      );
    } else {
      if (def.kind === 'overlay') {
        // Stack on the price pane
        chart.createIndicator(def.name, true, { id: CANDLE_PANE_ID });
      } else {
        // Separate stacked subplot pane
        chart.createIndicator(def.name, false);
      }
      setChartIndicators(panelId, [...activeNames, def.name]);
    }
  }

  // Count active beyond the defaults so badge only appears when user has
  // explicitly added indicators (avoiding a permanent "1" for VOL).
  const activeCount = activeNames.length;

  return (
    <div className="chart-indicators-menu" ref={rootRef}>
      <button
        type="button"
        className={`chart-indicators-trigger${activeCount > 0 ? ' has-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Toggle chart indicators"
      >
        <Activity size={11} />
        <span>Indicators</span>
        {activeCount > 0 && <span className="chart-indicators-badge">{activeCount}</span>}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="chart-indicators-popover" role="menu">
          <div className="chart-indicators-group-label">Overlays</div>
          {OVERLAY_INDICATORS.map((def) => {
            const isActive = activeNames.includes(def.name);
            return (
              <button
                key={def.name}
                type="button"
                className={`chart-indicators-item${isActive ? ' is-active' : ''}`}
                onClick={() => toggle(def)}
              >
                <span className="chart-indicators-check">{isActive && <Check size={9} />}</span>
                {def.label}
              </button>
            );
          })}
          <div className="chart-indicators-divider" />
          <div className="chart-indicators-group-label">Subplots</div>
          {SUBPLOT_INDICATORS.map((def) => {
            const isActive = activeNames.includes(def.name);
            return (
              <button
                key={def.name}
                type="button"
                className={`chart-indicators-item${isActive ? ' is-active' : ''}`}
                onClick={() => toggle(def)}
              >
                <span className="chart-indicators-check">{isActive && <Check size={9} />}</span>
                {def.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Exported for use by ChartWidget's seeding loop and for tests. */
export { ALL_INDICATORS, CANDLE_PANE_ID, OVERLAY_INDICATORS, SUBPLOT_INDICATORS };
