/**
 * Robinhood session-token interception. Robinhood's mobile/web auth
 * grants a Bearer access_token + a long-lived device_token. We let the
 * user complete the full login flow in a real browser context (so MFA
 * device-approval flows, captchas, etc. all work as designed) and
 * snapshot the resulting tokens out of cookies + storage.
 *
 * THIS IS SCAFFOLDING — the actual cookie/header names need to be
 * confirmed against the live login flow, which I cannot do in the
 * build sandbox. Validate against the real site before relying on it
 * for trading.
 */

export interface RobinhoodSession {
  accessToken: string;
  refreshToken?: string;
  deviceToken?: string;
  expiresAt?: string;
}

const ROBINHOOD_HOSTS = ['robinhood.com', 'api.robinhood.com'] as const;

/** True when the URL is on a Robinhood domain we expect to inspect. */
export function isRobinhoodUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ROBINHOOD_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Try to extract auth tokens from a cookie jar / response payload. The
 * exact shape changes when Robinhood rotates their auth flow, so this
 * is a best-effort merge — the adapter logs a warning if we can't find
 * an access token and falls back to re-prompting login.
 */
export function extractSessionFromCookies(
  cookies: Array<{ name: string; value: string; domain?: string; expires?: number }>,
): Partial<RobinhoodSession> {
  const out: Partial<RobinhoodSession> = {};
  for (const c of cookies) {
    if (!c.domain || !ROBINHOOD_HOSTS.some((h) => c.domain!.endsWith(h))) continue;
    if (c.name === 'device_id' || c.name === 'rh_device_id') {
      out.deviceToken = c.value;
    }
    if (c.name === 'auth_token' && c.value.length > 16) {
      out.accessToken = c.value;
      if (c.expires && c.expires > 0) out.expiresAt = new Date(c.expires * 1000).toISOString();
    }
  }
  return out;
}
