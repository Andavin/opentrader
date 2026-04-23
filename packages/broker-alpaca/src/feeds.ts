import type { DataFeed } from '@opentrader/broker-core';

import { AlpacaApiError, type AlpacaRest } from './rest';

export type AlpacaFeed = 'sip' | 'delayed_sip' | 'iex';

const FEED_META: Record<AlpacaFeed, Omit<DataFeed, 'available' | 'isPreferred'>> = {
  sip: {
    id: 'sip',
    label: 'Real-time SIP',
    description: 'Full consolidated NBBO across all US exchanges. Algo Trader Plus only.',
  },
  delayed_sip: {
    id: 'delayed_sip',
    label: 'Delayed SIP (15 min)',
    description: 'Full consolidated tape, 15-minute delayed. Free.',
  },
  iex: {
    id: 'iex',
    label: 'IEX only',
    description: 'IEX exchange only — ~2% of US volume. Free.',
  },
};

const ALL_FEEDS: AlpacaFeed[] = ['sip', 'delayed_sip', 'iex'];

/**
 * Probe each feed in parallel with a 1-bar request and infer the user's
 * tier from which feeds return 200. Non-403 errors propagate so we don't
 * silently mis-detect on a network blip.
 *
 * Alpaca has no subscription-tier endpoint — see project memo
 * project_alpaca_data_feeds.md for context.
 */
export async function probeAlpacaFeeds(rest: AlpacaRest): Promise<DataFeed[]> {
  const probeSymbol = 'AAPL';
  const start = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const end = new Date(Date.now() - 16 * 60 * 1000).toISOString();

  const probe = async (feed: AlpacaFeed): Promise<boolean> => {
    try {
      await rest.getBars({ symbol: probeSymbol, timeframe: '1Day', start, end, limit: 1, feed });
      return true;
    } catch (e) {
      // 403 = subscription doesn't permit; 400 = feed name not accepted for
      // this endpoint (e.g. `delayed_sip` is valid on /quotes/latest but
      // 400s on /bars). Both mean "unavailable for our purposes".
      if (e instanceof AlpacaApiError && (e.status === 403 || e.status === 400)) return false;
      throw e;
    }
  };

  const results = await Promise.all(ALL_FEEDS.map(probe));
  const availability: Record<AlpacaFeed, boolean> = {
    sip: results[0] ?? false,
    delayed_sip: results[1] ?? false,
    iex: results[2] ?? false,
  };

  const preferred: AlpacaFeed = availability.sip
    ? 'sip'
    : availability.delayed_sip
      ? 'delayed_sip'
      : 'iex';

  return ALL_FEEDS.map((id) => ({
    ...FEED_META[id],
    available: availability[id],
    isPreferred: id === preferred,
  }));
}
