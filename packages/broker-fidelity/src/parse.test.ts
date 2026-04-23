import { describe, expect, it } from 'vitest';

import { parseMoney, parsePercent, parseQty } from './parse';

describe('parseMoney', () => {
  it('parses standard currency strings', () => {
    expect(parseMoney('$12,345.67')).toBe(12345.67);
    expect(parseMoney('$0.00')).toBe(0);
  });
  it('treats parens as negative', () => {
    expect(parseMoney('($1,234.50)')).toBe(-1234.5);
  });
  it('returns null for blanks / garbage', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('—')).toBeNull();
    expect(parseMoney('not-a-number')).toBeNull();
  });
});

describe('parsePercent', () => {
  it('handles signed percentages', () => {
    expect(parsePercent('+1.23%')).toBeCloseTo(0.0123);
    expect(parsePercent('-0.04%')).toBeCloseTo(-0.0004);
    expect(parsePercent('5%')).toBeCloseTo(0.05);
  });
  it('returns null on bad input', () => {
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('abc%')).toBeNull();
  });
});

describe('parseQty', () => {
  it('handles formatted integers', () => {
    expect(parseQty('12,345')).toBe(12345);
    expect(parseQty('0')).toBe(0);
  });
  it('returns null on bad input', () => {
    expect(parseQty('')).toBeNull();
    expect(parseQty('foo')).toBeNull();
  });
});
