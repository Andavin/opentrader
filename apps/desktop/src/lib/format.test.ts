import { describe, expect, it } from 'vitest';

import { fmtCompact, fmtNum, fmtPct, fmtSignedUsd, fmtUsd, priceClass } from './format';

describe('format helpers', () => {
  describe('fmtUsd', () => {
    it('formats positive numbers as USD with two decimals', () => {
      expect(fmtUsd(1234.5)).toBe('$1,234.50');
      expect(fmtUsd(0)).toBe('$0.00');
    });
    it('returns the em-dash placeholder for null/undefined/NaN', () => {
      expect(fmtUsd(null)).toBe('—');
      expect(fmtUsd(undefined)).toBe('—');
      expect(fmtUsd(Number.NaN)).toBe('—');
    });
    it('respects cents:false to drop minor units', () => {
      expect(fmtUsd(1234.5, { cents: false })).toBe('$1,235');
    });
  });

  describe('fmtSignedUsd', () => {
    it('prefixes a + on positive and a unicode minus on negative', () => {
      expect(fmtSignedUsd(123.45)).toBe('+$123.45');
      expect(fmtSignedUsd(-123.45)).toBe('−$123.45');
    });
    it('renders zero without sign', () => {
      expect(fmtSignedUsd(0)).toBe('$0.00');
    });
    it('handles null', () => {
      expect(fmtSignedUsd(null)).toBe('—');
    });
  });

  describe('fmtPct', () => {
    it('multiplies by 100 and adds a percent sign', () => {
      expect(fmtPct(0.05)).toBe('5.00%');
      expect(fmtPct(-0.075)).toBe('-7.50%');
    });
    it('signed:true prefixes + on positives only', () => {
      expect(fmtPct(0.02, { signed: true })).toBe('+2.00%');
      expect(fmtPct(-0.02, { signed: true })).toBe('-2.00%');
      expect(fmtPct(0, { signed: true })).toBe('0.00%');
    });
    it('returns em-dash for nullish', () => {
      expect(fmtPct(null)).toBe('—');
    });
  });

  describe('fmtNum', () => {
    it('formats with two decimals + thousands separators', () => {
      expect(fmtNum(1234.5)).toBe('1,234.50');
    });
    it('em-dash for nullish', () => {
      expect(fmtNum(undefined)).toBe('—');
    });
  });

  describe('fmtCompact', () => {
    it('uses compact notation for large numbers', () => {
      expect(fmtCompact(1500)).toBe('1.5K');
      expect(fmtCompact(2_500_000)).toBe('2.5M');
    });
  });

  describe('priceClass', () => {
    it('returns price-up / price-down based on sign and text-muted on zero/nullish', () => {
      expect(priceClass(1)).toBe('price-up');
      expect(priceClass(-1)).toBe('price-down');
      expect(priceClass(0)).toBe('text-muted');
      expect(priceClass(null)).toBe('text-muted');
      expect(priceClass(undefined)).toBe('text-muted');
    });
  });
});
