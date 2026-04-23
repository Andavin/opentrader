/** Shared number/currency formatters. */

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdNoCentsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function fmtUsd(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return (opts.cents === false ? usdNoCentsFormatter : usdFormatter).format(n);
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return numFormatter.format(n);
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return compactFormatter.format(n);
}

export function fmtPct(n: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const formatted = `${(n * 100).toFixed(2)}%`;
  return opts.signed && n > 0 ? `+${formatted}` : formatted;
}

export function fmtSignedUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${usdFormatter.format(Math.abs(n))}`;
}

export function priceClass(n: number | null | undefined): 'price-up' | 'price-down' | 'text-muted' {
  if (n == null || n === 0) return 'text-muted';
  return n > 0 ? 'price-up' : 'price-down';
}
