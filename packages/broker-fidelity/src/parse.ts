/**
 * DOM-scrape helpers for Fidelity. The site has no public JSON API,
 * so the adapter ends up parsing strings off the active-trader pages.
 * These helpers keep the adapter free of regex spaghetti and let us
 * unit-test the parsing in isolation against snapshot strings.
 */

/** Parse a money cell like "$12,345.67" or "($1,234.50)" → number. */
export function parseMoney(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const stripped = trimmed.replace(/[$,()\s]/g, '');
  const n = Number(stripped);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Parse a percentage cell like "+1.23%" or "-0.04%" → 0.0123 / -0.0004. */
export function parsePercent(input: string): number | null {
  if (!input) return null;
  const stripped = input.replace(/[%\s]/g, '');
  const n = Number(stripped);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

/** Parse "12,345" into 12345; returns null on bad input. */
export function parseQty(input: string): number | null {
  if (!input) return null;
  const n = Number(input.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
