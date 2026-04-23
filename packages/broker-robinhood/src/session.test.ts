import { describe, expect, it } from 'vitest';

import { extractSessionFromCookies, isRobinhoodUrl } from './session';

describe('isRobinhoodUrl', () => {
  it('matches the public site and api subdomain', () => {
    expect(isRobinhoodUrl('https://robinhood.com/login')).toBe(true);
    expect(isRobinhoodUrl('https://api.robinhood.com/accounts/')).toBe(true);
  });
  it('rejects unrelated domains', () => {
    expect(isRobinhoodUrl('https://example.com/api')).toBe(false);
    expect(isRobinhoodUrl('https://robinhood.com.evil.com')).toBe(false);
  });
  it('returns false for malformed input rather than throwing', () => {
    expect(isRobinhoodUrl('not a url')).toBe(false);
  });
});

describe('extractSessionFromCookies', () => {
  it('pulls device + auth tokens off the right domain', () => {
    const session = extractSessionFromCookies([
      { name: 'device_id', value: 'dev-xyz', domain: '.robinhood.com' },
      { name: 'auth_token', value: 'eyJabc'.padEnd(40, 'a'), domain: '.robinhood.com', expires: 1800000000 },
      { name: 'unrelated', value: 'noop', domain: '.robinhood.com' },
    ]);
    expect(session.deviceToken).toBe('dev-xyz');
    expect(session.accessToken?.startsWith('eyJabc')).toBe(true);
    expect(session.expiresAt).toBeDefined();
  });

  it('ignores cookies from other domains', () => {
    const session = extractSessionFromCookies([
      { name: 'auth_token', value: 'aaaaaaaaaaaaaaaaaaaaaaaa', domain: '.example.com' },
    ]);
    expect(session.accessToken).toBeUndefined();
  });

  it('ignores too-short auth tokens (suspected stale/empty values)', () => {
    const session = extractSessionFromCookies([
      { name: 'auth_token', value: 'short', domain: '.robinhood.com' },
    ]);
    expect(session.accessToken).toBeUndefined();
  });
});
