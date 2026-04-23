/**
 * Parse an OCC-formatted option symbol into its components.
 *
 * Format: <UNDERLYING><YYMMDD><C|P><STRIKE*1000 padded to 8 digits>
 * Example: AAPL241220C00150000  →  AAPL, 2024-12-20, call, $150
 *
 * Returns null if the input doesn't look like an OCC symbol — we leave
 * it to callers to fall back to displaying the raw symbol.
 */
export interface ParsedOcc {
  underlying: string;
  expiration: string; // YYYY-MM-DD
  type: 'call' | 'put';
  strike: number;
}

const OCC_REGEX = /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/;

export function parseOcc(symbol: string): ParsedOcc | null {
  const m = OCC_REGEX.exec(symbol);
  if (!m) return null;
  const [, underlying, ymd, kind, strikeRaw] = m;
  const yy = Number(ymd!.slice(0, 2));
  const mm = ymd!.slice(2, 4);
  const dd = ymd!.slice(4, 6);
  // OCC YYMMDD uses two-digit year — assume 20YY (matches OPRA convention).
  const yyyy = 2000 + yy;
  return {
    underlying: underlying!,
    expiration: `${yyyy}-${mm}-${dd}`,
    type: kind === 'C' ? 'call' : 'put',
    strike: Number(strikeRaw) / 1000,
  };
}

/** Compact human-readable label, e.g. "AAPL Dec 20'24 $150 Call". */
export function formatOcc(symbol: string): string {
  const parsed = parseOcc(symbol);
  if (!parsed) return symbol;
  const [yyyy, mm, dd] = parsed.expiration.split('-');
  const monthName = [
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
  ][Number(mm) - 1];
  const yy = yyyy!.slice(-2);
  return `${parsed.underlying} ${monthName} ${Number(dd)} '${yy} $${parsed.strike} ${parsed.type === 'call' ? 'Call' : 'Put'}`;
}
