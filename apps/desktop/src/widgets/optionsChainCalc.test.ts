import { describe, expect, it } from 'vitest';

import type { OptionContract } from '@opentrader/broker-core';

import {
  buildExpirationMeta,
  calcAvgIv,
  calcBreakeven,
  calcDte,
  calcExpectedMove,
  calcNetChange,
  calcPctToBreakeven,
  calcRoc,
  dteDayLabel,
  expirationDateLabel,
  expirationDayOfWeek,
  groupByStrike,
  isCallItm,
  isPutItm,
  spotLineIndex,
} from './optionsChainCalc';

// helpers
function makeContract(overrides: Partial<OptionContract>): OptionContract {
  return {
    symbol: 'AAPL240419C00150000',
    underlying: 'AAPL',
    expiration: '2024-04-19',
    strike: 150,
    type: 'call',
    ...overrides,
  };
}

// ---- calcDte ----

describe('calcDte', () => {
  it('returns 0 for same-day expiration', () => {
    const today = new Date(2024, 3, 19); // Apr 19 2024
    expect(calcDte('2024-04-19', today)).toBe(0);
  });

  it('counts calendar days correctly across months', () => {
    const today = new Date(2024, 3, 19); // Apr 19
    expect(calcDte('2024-04-26', today)).toBe(7);
    expect(calcDte('2024-05-01', today)).toBe(12);
  });

  it('never returns negative', () => {
    const today = new Date(2024, 3, 20); // one day after expiry
    expect(calcDte('2024-04-19', today)).toBe(0);
  });
});

// ---- dteDayLabel ----

describe('dteDayLabel', () => {
  it('formats DTE as string with D suffix', () => {
    expect(dteDayLabel(0)).toBe('0D');
    expect(dteDayLabel(1)).toBe('1D');
    expect(dteDayLabel(30)).toBe('30D');
    expect(dteDayLabel(365)).toBe('365D');
  });
});

// ---- expirationDayOfWeek ----

describe('expirationDayOfWeek', () => {
  it('returns correct short day name', () => {
    // 2024-04-19 is a Friday
    expect(expirationDayOfWeek('2024-04-19')).toBe('Fri');
    // 2024-04-22 is a Monday
    expect(expirationDayOfWeek('2024-04-22')).toBe('Mon');
    // 2024-04-24 is a Wednesday
    expect(expirationDayOfWeek('2024-04-24')).toBe('Wed');
  });
});

// ---- expirationDateLabel ----

describe('expirationDateLabel', () => {
  it('formats as "Mon DD"', () => {
    expect(expirationDateLabel('2024-04-19')).toBe('Apr 19');
    expect(expirationDateLabel('2024-12-31')).toBe('Dec 31');
    expect(expirationDateLabel('2025-01-01')).toBe('Jan 1');
  });
});

// ---- calcAvgIv ----

describe('calcAvgIv', () => {
  it('returns null when no contracts have IV', () => {
    const contracts = [makeContract({ iv: undefined }), makeContract({ iv: undefined })];
    expect(calcAvgIv(contracts, 150)).toBeNull();
  });

  it('averages all IVs when no spot provided', () => {
    const contracts = [makeContract({ iv: 0.3 }), makeContract({ iv: 0.5 })];
    expect(calcAvgIv(contracts, null)).toBeCloseTo(0.4);
  });

  it('prefers ATM contracts (within 10% of spot) when spot is given', () => {
    const contracts = [
      makeContract({ strike: 100, iv: 0.2 }), // ATM-ish for spot=110
      makeContract({ strike: 110, iv: 0.4 }), // very ATM
      makeContract({ strike: 200, iv: 0.9 }), // deep OTM — outside 10%
    ];
    // spot=110: 10% band = [99, 121]; strikes 100 and 110 qualify
    const result = calcAvgIv(contracts, 110);
    expect(result).toBeCloseTo((0.2 + 0.4) / 2);
  });

  it('falls back to all contracts if no ATM candidates', () => {
    // spot=500, 10% band=[450,550]; all strikes are 100 which is outside
    const contracts = [
      makeContract({ strike: 100, iv: 0.3 }),
      makeContract({ strike: 110, iv: 0.5 }),
    ];
    expect(calcAvgIv(contracts, 500)).toBeCloseTo(0.4);
  });
});

// ---- calcExpectedMove ----

describe('calcExpectedMove', () => {
  it('computes 1-sigma move correctly', () => {
    // spot=100, iv=0.20, dte=365 → move = 100*0.20*1 = 20
    expect(calcExpectedMove(100, 0.2, 365)).toBeCloseTo(20);
  });

  it('scales with DTE', () => {
    // dte=91.25 (quarter year) → sqrt(91.25/365)=0.5 → move=100*0.20*0.5=10
    expect(calcExpectedMove(100, 0.2, 91.25)).toBeCloseTo(10);
  });

  it('returns null when inputs are missing or non-positive', () => {
    expect(calcExpectedMove(null, 0.3, 30)).toBeNull();
    expect(calcExpectedMove(100, null, 30)).toBeNull();
    expect(calcExpectedMove(100, 0.3, 0)).toBeNull();
    expect(calcExpectedMove(0, 0.3, 30)).toBeNull();
    expect(calcExpectedMove(100, 0, 30)).toBeNull();
  });
});

// ---- groupByStrike ----

describe('groupByStrike', () => {
  it('groups calls and puts by strike, sorted ascending', () => {
    const call = makeContract({ strike: 150, type: 'call' });
    const put = makeContract({ strike: 150, type: 'put' });
    const call2 = makeContract({ strike: 155, type: 'call' });

    const rows = groupByStrike([call, put, call2]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.strike).toBe(150);
    expect(rows[0]!.call).toBe(call);
    expect(rows[0]!.put).toBe(put);
    expect(rows[1]!.strike).toBe(155);
    expect(rows[1]!.call).toBe(call2);
    expect(rows[1]!.put).toBeUndefined();
  });

  it('handles empty input', () => {
    expect(groupByStrike([])).toEqual([]);
  });
});

// ---- isCallItm / isPutItm ----

describe('isCallItm', () => {
  it('is true when strike < spot', () => {
    expect(isCallItm(140, 150)).toBe(true);
  });

  it('is false when strike >= spot', () => {
    expect(isCallItm(150, 150)).toBe(false);
    expect(isCallItm(160, 150)).toBe(false);
  });

  it('returns false when spot is null', () => {
    expect(isCallItm(140, null)).toBe(false);
  });
});

describe('isPutItm', () => {
  it('is true when strike > spot', () => {
    expect(isPutItm(160, 150)).toBe(true);
  });

  it('is false when strike <= spot', () => {
    expect(isPutItm(150, 150)).toBe(false);
    expect(isPutItm(140, 150)).toBe(false);
  });

  it('returns false when spot is null', () => {
    expect(isPutItm(160, null)).toBe(false);
  });
});

// ---- calcBreakeven ----

describe('calcBreakeven', () => {
  it('call breakeven = strike + ask', () => {
    expect(calcBreakeven('call', 150, 3.5)).toBeCloseTo(153.5);
  });

  it('put breakeven = strike - ask', () => {
    expect(calcBreakeven('put', 150, 3.5)).toBeCloseTo(146.5);
  });

  it('returns null when ask is missing or zero', () => {
    expect(calcBreakeven('call', 150, null)).toBeNull();
    expect(calcBreakeven('call', 150, undefined)).toBeNull();
    expect(calcBreakeven('call', 150, 0)).toBeNull();
  });
});

// ---- calcRoc ----

describe('calcRoc', () => {
  it('returns 1.0 (100%) when ask is positive', () => {
    expect(calcRoc(3.5)).toBe(1.0);
    expect(calcRoc(0.01)).toBe(1.0);
  });

  it('returns null for missing/zero ask', () => {
    expect(calcRoc(null)).toBeNull();
    expect(calcRoc(undefined)).toBeNull();
    expect(calcRoc(0)).toBeNull();
  });
});

// ---- calcPctToBreakeven ----

describe('calcPctToBreakeven', () => {
  it('computes % to breakeven for a call', () => {
    // strike=150, ask=5, spot=150 → be=155 → (155/150)-1 = 0.0333…
    expect(calcPctToBreakeven('call', 150, 5, 150)).toBeCloseTo(0.0333, 3);
  });

  it('computes % to breakeven for a put', () => {
    // strike=150, ask=5, spot=150 → be=145 → (145/150)-1 = -0.0333…
    expect(calcPctToBreakeven('put', 150, 5, 150)).toBeCloseTo(-0.0333, 3);
  });

  it('returns null when spot or ask is missing', () => {
    expect(calcPctToBreakeven('call', 150, null, 150)).toBeNull();
    expect(calcPctToBreakeven('call', 150, 5, null)).toBeNull();
  });
});

// ---- calcNetChange ----

describe('calcNetChange', () => {
  it('returns last - prevClose', () => {
    expect(calcNetChange(5.0, 4.5)).toBeCloseTo(0.5);
    expect(calcNetChange(3.0, 3.5)).toBeCloseTo(-0.5);
  });

  it('returns null when either input is missing', () => {
    expect(calcNetChange(null, 3)).toBeNull();
    expect(calcNetChange(3, null)).toBeNull();
    expect(calcNetChange(undefined, 3)).toBeNull();
    expect(calcNetChange(3, undefined)).toBeNull();
  });
});

// ---- spotLineIndex ----

describe('spotLineIndex', () => {
  const rows = [
    { strike: 140 },
    { strike: 145 },
    { strike: 150 },
    { strike: 155 },
    { strike: 160 },
  ];

  it('returns index of highest strike <= spot', () => {
    expect(spotLineIndex(rows, 152)).toBe(2); // 150 <= 152 < 155
    expect(spotLineIndex(rows, 150)).toBe(2); // exact match
    expect(spotLineIndex(rows, 155)).toBe(3); // exact match at 155
  });

  it('returns -1 when spot is below all strikes', () => {
    expect(spotLineIndex(rows, 139)).toBe(-1);
  });

  it('returns last index when spot is above all strikes', () => {
    expect(spotLineIndex(rows, 200)).toBe(4);
  });

  it('returns -1 for null spot or empty rows', () => {
    expect(spotLineIndex(rows, null)).toBe(-1);
    expect(spotLineIndex([], 150)).toBe(-1);
  });
});

// ---- buildExpirationMeta ----

describe('buildExpirationMeta', () => {
  it('assembles all derived fields correctly', () => {
    const today = new Date(2024, 3, 15); // Apr 15 2024
    const contracts: OptionContract[] = [
      makeContract({ strike: 148, type: 'call', iv: 0.3 }),
      makeContract({ strike: 150, type: 'call', iv: 0.4 }),
      makeContract({ strike: 152, type: 'call', iv: 0.35 }),
    ];

    // '2024-04-19' is a Friday, dte from Apr 15 = 4
    const meta = buildExpirationMeta('2024-04-19', contracts, 150, today);

    expect(meta.expiration).toBe('2024-04-19');
    expect(meta.dte).toBe(4);
    expect(meta.dayOfWeek).toBe('Fri');
    expect(meta.dateLabel).toBe('Apr 19');
    expect(meta.avgIv).toBeCloseTo((0.3 + 0.4 + 0.35) / 3, 5);
    // expectedMove = 150 × avgIv × sqrt(4/365)
    const expectedMove = 150 * ((0.3 + 0.4 + 0.35) / 3) * Math.sqrt(4 / 365);
    expect(meta.expectedMove).toBeCloseTo(expectedMove, 3);
  });

  it('handles missing IV gracefully', () => {
    const today = new Date(2024, 3, 15);
    const contracts: OptionContract[] = [makeContract({ iv: undefined })];
    const meta = buildExpirationMeta('2024-04-19', contracts, 150, today);
    expect(meta.avgIv).toBeNull();
    expect(meta.expectedMove).toBeNull();
  });
});
