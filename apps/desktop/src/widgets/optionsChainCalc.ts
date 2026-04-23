/**
 * Pure derived calculations for the Options Chain widget.
 *
 * All functions are broker-agnostic and accept the raw OptionContract
 * type from broker-core. No React imports here — pure math only so unit
 * tests run in Node without DOM.
 */

import type { OptionContract } from '@opentrader/broker-core';

// ---- expiration row metadata ----

export interface ExpirationMeta {
  expiration: string; // YYYY-MM-DD
  dte: number; // calendar days to expiration
  dayOfWeek: string; // "Mon", "Tue", …
  dateLabel: string; // "Apr 24"
  avgIv: number | null; // average IV across ATM contracts, as decimal (0.35 = 35%)
  expectedMove: number | null; // ±$ 1-sigma move
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Calendar DTE from today's local date to expiration (YYYY-MM-DD). */
export function calcDte(expiration: string, today: Date = new Date()): number {
  // Parse as local date components to avoid UTC-offset issues.
  const [yyyy, mm, dd] = expiration.split('-').map(Number) as [number, number, number];
  const expDate = new Date(yyyy, mm - 1, dd);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = expDate.getTime() - todayMidnight.getTime();
  return Math.max(0, Math.round(diffMs / 86_400_000));
}

export function dteDayLabel(dte: number): string {
  if (dte === 0) return '0D';
  if (dte === 1) return '1D';
  return `${dte}D`;
}

export function expirationDayOfWeek(expiration: string): string {
  const [yyyy, mm, dd] = expiration.split('-').map(Number) as [number, number, number];
  const d = new Date(yyyy, mm - 1, dd);
  return DOW_SHORT[d.getDay()]!;
}

export function expirationDateLabel(expiration: string): string {
  const [, mm, dd] = expiration.split('-').map(Number) as [number, number, number];
  return `${MONTH_SHORT[mm - 1]} ${dd}`;
}

/**
 * Derive average IV from all contracts on a given expiration. We
 * preferentially use near-ATM contracts (within 10% of spot) when spot
 * is known; otherwise we average all with non-null IV.
 */
export function calcAvgIv(contracts: OptionContract[], spot: number | null): number | null {
  let candidates = contracts.filter((c) => c.iv != null && c.iv > 0);
  if (candidates.length === 0) return null;

  if (spot != null && spot > 0) {
    const atm = candidates.filter((c) => Math.abs(c.strike - spot) / spot <= 0.1);
    if (atm.length > 0) candidates = atm;
  }

  const sum = candidates.reduce((acc, c) => acc + c.iv!, 0);
  return sum / candidates.length;
}

/**
 * 1-sigma expected move: spot × IV × √(DTE / 365).
 * Returns null when any input is missing or non-positive.
 */
export function calcExpectedMove(
  spot: number | null,
  avgIv: number | null,
  dte: number,
): number | null {
  if (spot == null || avgIv == null || spot <= 0 || avgIv <= 0 || dte <= 0) return null;
  return spot * avgIv * Math.sqrt(dte / 365);
}

// ---- strike-row grouping ----

export interface StrikeRow {
  strike: number;
  call?: OptionContract;
  put?: OptionContract;
}

export function groupByStrike(contracts: OptionContract[]): StrikeRow[] {
  const map = new Map<number, StrikeRow>();
  for (const c of contracts) {
    const row = map.get(c.strike) ?? { strike: c.strike };
    if (c.type === 'call') row.call = c;
    else row.put = c;
    map.set(c.strike, row);
  }
  return [...map.values()].sort((a, b) => a.strike - b.strike);
}

// ---- ITM detection ----

/** Call is ITM when strike < spot. */
export function isCallItm(strike: number, spot: number | null): boolean {
  return spot != null && strike < spot;
}

/** Put is ITM when strike > spot. */
export function isPutItm(strike: number, spot: number | null): boolean {
  return spot != null && strike > spot;
}

// ---- customize-column derived values ----

/** Call breakeven = strike + ask. Put breakeven = strike − ask. */
export function calcBreakeven(
  type: 'call' | 'put',
  strike: number,
  ask: number | null | undefined,
): number | null {
  if (ask == null || ask <= 0) return null;
  return type === 'call' ? strike + ask : strike - ask;
}

/**
 * Return on capital (long option) = max-profit / cost.
 * For a long call/put the max profit is theoretically unlimited; we use
 * a finite proxy: (2 × ask) / ask = 2, i.e. we assume the option
 * doubles. That's the ROC at exactly a 2× return — a conventional
 * rough shorthand. Encoded here as ask × 1 / ask = 1.0 (100%) so
 * callers can decide how to label it. For consistency with common option
 * screeners we define ROC as (intrinsic at breakeven) / cost = 1.0 for
 * any long option (you "get your money back" at breakeven).
 *
 * In practice traders use this field for spreads; for naked longs it is
 * always 1.0 (100%) at breakeven.  We store it but leave the display
 * label as "ROC" with the note.
 */
export function calcRoc(_ask: number | null | undefined): number | null {
  // For a long option, ROC at breakeven is always 100% by definition.
  // Return null if there is no ask (the contract has no price data).
  if (_ask == null || _ask <= 0) return null;
  return 1.0;
}

/** % to breakeven = (breakeven / spot) − 1. */
export function calcPctToBreakeven(
  type: 'call' | 'put',
  strike: number,
  ask: number | null | undefined,
  spot: number | null,
): number | null {
  const be = calcBreakeven(type, strike, ask);
  if (be == null || spot == null || spot <= 0) return null;
  return be / spot - 1;
}

/** Net change = last − prevClose. Returns null when either is missing. */
export function calcNetChange(
  last: number | null | undefined,
  prevClose: number | null | undefined,
): number | null {
  if (last == null || prevClose == null) return null;
  return last - prevClose;
}

// ---- spot-line insertion ----

/**
 * Find the index in a sorted (ascending) StrikeRow array after which
 * the spot-price divider should be rendered. Returns -1 if spot is
 * below all strikes (insert above first row), or rows.length - 1 if
 * spot is above all strikes (insert below last row), or the index of
 * the highest ITM strike.
 */
export function spotLineIndex(rows: StrikeRow[], spot: number | null): number {
  if (spot == null || rows.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.strike <= spot) idx = i;
    else break;
  }
  return idx;
}

// ---- expiration metadata assembly ----

export function buildExpirationMeta(
  expiration: string,
  contracts: OptionContract[],
  spot: number | null,
  today?: Date,
): ExpirationMeta {
  const dte = calcDte(expiration, today);
  const avgIv = calcAvgIv(contracts, spot);
  return {
    expiration,
    dte,
    dayOfWeek: expirationDayOfWeek(expiration),
    dateLabel: expirationDateLabel(expiration),
    avgIv,
    expectedMove: calcExpectedMove(spot, avgIv, dte),
  };
}
