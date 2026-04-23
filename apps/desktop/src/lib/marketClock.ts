/**
 * Market-session classifier — best-effort, no DST-aware dependency.
 * Uses Intl.DateTimeFormat in the America/New_York timezone to figure
 * out wall-clock NY time from the user's machine, then maps to the
 * standard equities session windows.
 *
 * pre:        04:00–09:30 ET
 * regular:    09:30–16:00 ET
 * after:      16:00–20:00 ET
 * overnight:  20:00–04:00 ET (or any weekend)
 *
 * Holidays aren't accounted for — a session calendar API can refine
 * this later. For aura coloring it's fine to be approximate.
 */
export type MarketSession = 'pre' | 'regular' | 'after' | 'overnight';

const NY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
});

interface NyParts {
  hour: number;
  minute: number;
  weekday: string;
}

function nyParts(at: Date): NyParts {
  const parts = NY_FORMATTER.formatToParts(at);
  const get = (k: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === k)?.value ?? '';
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: get('weekday'),
  };
}

export function marketSession(at: Date = new Date()): MarketSession {
  const { hour, minute, weekday } = nyParts(at);
  if (weekday === 'Sat' || weekday === 'Sun') return 'overnight';
  const minutes = hour * 60 + minute;
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return 'pre';
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return 'regular';
  if (minutes >= 16 * 60 && minutes < 20 * 60) return 'after';
  return 'overnight';
}
