import { describe, expect, it } from 'vitest';

import { formatOcc, parseOcc } from './occ';

describe('parseOcc', () => {
  it('parses a vanilla call', () => {
    expect(parseOcc('AAPL241220C00150000')).toEqual({
      underlying: 'AAPL',
      expiration: '2024-12-20',
      type: 'call',
      strike: 150,
    });
  });

  it('parses a put with fractional strike', () => {
    expect(parseOcc('SPY260417P00425500')).toEqual({
      underlying: 'SPY',
      expiration: '2026-04-17',
      type: 'put',
      strike: 425.5,
    });
  });

  it('returns null for non-OCC symbols', () => {
    expect(parseOcc('AAPL')).toBeNull();
    expect(parseOcc('not-a-symbol')).toBeNull();
    expect(parseOcc('AAPL241220C00150')).toBeNull(); // wrong strike width
  });
});

describe('formatOcc', () => {
  it('renders a friendly label for valid OCC', () => {
    expect(formatOcc('AAPL241220C00150000')).toBe("AAPL Dec 20 '24 $150 Call");
    expect(formatOcc('SPY260417P00425500')).toBe("SPY Apr 17 '26 $425.5 Put");
  });

  it('falls back to the raw symbol for non-OCC input', () => {
    expect(formatOcc('AAPL')).toBe('AAPL');
  });
});
