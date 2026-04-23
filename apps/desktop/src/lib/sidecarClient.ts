/**
 * Thin HTTP wrapper for the local sidecar. Picks up base URL + bearer
 * token from Vite env, falling back to dev defaults so a fresh checkout
 * just works after `pnpm dev`.
 *
 * The Tauri prod build will inject these via `vite-plugin-tauri` env
 * forwarding once we wire the random-port-per-launch flow.
 */

const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL ?? 'http://127.0.0.1:1421';
const SIDECAR_TOKEN = import.meta.env.VITE_SIDECAR_TOKEN ?? 'dev-token-change-in-prod';

export class SidecarError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export async function sidecarFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(path, SIDECAR_URL);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${SIDECAR_TOKEN}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text();
  let body: unknown = undefined;
  if (text.length) {
    try {
      body = JSON.parse(text);
    } catch {
      // Server returned a non-JSON body (Hono error before the JSON
      // formatter ran, or a CDN/proxy in the way). Treat as raw text.
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `${res.status} ${res.statusText || 'Request failed'}`;
    throw new SidecarError(msg, res.status, body);
  }
  return body as T;
}
