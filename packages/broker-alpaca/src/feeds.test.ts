import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { probeAlpacaFeeds } from './feeds';
import { AlpacaApiError, AlpacaRest } from './rest';

const CREDS = { key: 'PKKEY', secret: 'PKSECRET', paper: true } as const;

function makeFetch(behavior: Record<string, 'ok' | 403 | 500>): typeof fetch {
  return vi.fn(async (input: URL | RequestInfo): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input as URL | Request).toString();
    const u = new URL(url);
    const feed = u.searchParams.get('feed') ?? 'unknown';
    const verdict = behavior[feed];
    if (verdict === 'ok') {
      return new Response(
        JSON.stringify({
          symbol: 'AAPL',
          bars: [{ t: '2026-04-22T13:30:00Z', o: 1, h: 1, l: 1, c: 1, v: 1 }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (verdict === 403) {
      return new Response('subscription does not permit querying recent SIP data', {
        status: 403,
      });
    }
    return new Response('boom', { status: 500 });
  }) as unknown as typeof fetch;
}

describe('probeAlpacaFeeds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T15:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks all three feeds available + sip preferred when entitled', async () => {
    vi.stubGlobal('fetch', makeFetch({ sip: 'ok', delayed_sip: 'ok', iex: 'ok' }));
    const rest = new AlpacaRest(CREDS);
    const feeds = await probeAlpacaFeeds(rest);
    expect(feeds.map((f) => f.id)).toEqual(['sip', 'delayed_sip', 'iex']);
    expect(feeds.every((f) => f.available)).toBe(true);
    expect(feeds.find((f) => f.isPreferred)?.id).toBe('sip');
  });

  it('falls back to delayed_sip preferred when SIP returns 403', async () => {
    vi.stubGlobal('fetch', makeFetch({ sip: 403, delayed_sip: 'ok', iex: 'ok' }));
    const feeds = await probeAlpacaFeeds(new AlpacaRest(CREDS));
    expect(feeds.find((f) => f.id === 'sip')?.available).toBe(false);
    expect(feeds.find((f) => f.id === 'delayed_sip')?.available).toBe(true);
    expect(feeds.find((f) => f.isPreferred)?.id).toBe('delayed_sip');
  });

  it('falls back to iex preferred when only iex is entitled', async () => {
    vi.stubGlobal('fetch', makeFetch({ sip: 403, delayed_sip: 403, iex: 'ok' }));
    const feeds = await probeAlpacaFeeds(new AlpacaRest(CREDS));
    expect(feeds.find((f) => f.isPreferred)?.id).toBe('iex');
    expect(feeds.find((f) => f.id === 'sip')?.available).toBe(false);
  });

  it('propagates non-403 errors so we do not silently mis-detect on a 500', async () => {
    vi.stubGlobal('fetch', makeFetch({ sip: 500, delayed_sip: 'ok', iex: 'ok' }));
    await expect(probeAlpacaFeeds(new AlpacaRest(CREDS))).rejects.toBeInstanceOf(AlpacaApiError);
  });
});
