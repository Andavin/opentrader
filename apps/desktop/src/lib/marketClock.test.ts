import { describe, expect, it } from 'vitest';

import { marketSession } from './marketClock';

/**
 * Times here are UTC; the function converts to America/New_York so the
 * expectations assume EST or EDT depending on date. We pick fixed dates
 * inside the EDT window (April → 4-hour offset) for predictable conversion:
 *   UTC 13:00 → ET 09:00  (pre)
 *   UTC 14:30 → ET 10:30  (regular)
 *   UTC 21:00 → ET 17:00  (after)
 *   UTC 02:00 next day → ET 22:00 (overnight)
 */
describe('marketSession (EDT-window weekdays)', () => {
  it('classifies pre-market', () => {
    expect(marketSession(new Date('2026-04-22T13:00:00Z'))).toBe('pre');
  });
  it('classifies regular session', () => {
    expect(marketSession(new Date('2026-04-22T14:30:00Z'))).toBe('regular');
  });
  it('classifies after-hours', () => {
    expect(marketSession(new Date('2026-04-22T21:00:00Z'))).toBe('after');
  });
  it('classifies overnight (after the after-hours cutoff)', () => {
    expect(marketSession(new Date('2026-04-23T01:00:00Z'))).toBe('overnight');
  });
  it('classifies weekend as overnight regardless of time', () => {
    expect(marketSession(new Date('2026-04-25T18:00:00Z'))).toBe('overnight'); // Saturday
    expect(marketSession(new Date('2026-04-26T15:00:00Z'))).toBe('overnight'); // Sunday
  });
});
