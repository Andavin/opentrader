import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidecarError, sidecarFetch } from './sidecarClient';

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('sidecarFetch', () => {
  it('attaches the bearer token + json content-type by default', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    await sidecarFetch('/health');
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^Bearer /);
    expect(headers['content-type']).toBe('application/json');
  });

  it('serializes the query map into URL search params, dropping undefineds', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    );
    globalThis.fetch = fetchMock;
    await sidecarFetch('/foo', { query: { a: 'x', b: 5, c: undefined } });
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.searchParams.get('a')).toBe('x');
    expect(url.searchParams.get('b')).toBe('5');
    expect(url.searchParams.has('c')).toBe(false);
  });

  it('parses the JSON body on success', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ pong: true }), { status: 200 }),
    ) as unknown as typeof fetch;
    const out = await sidecarFetch<{ pong: boolean }>('/ping');
    expect(out).toEqual({ pong: true });
  });

  it('returns undefined for empty 200 responses (no JSON parse)', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('', { status: 200 }),
    ) as unknown as typeof fetch;
    const out = await sidecarFetch<undefined>('/empty');
    expect(out).toBeUndefined();
  });

  it('throws SidecarError with the structured error message on non-2xx', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(sidecarFetch('/x')).rejects.toThrowError(SidecarError);
    try {
      await sidecarFetch('/x');
    } catch (e) {
      expect(e).toBeInstanceOf(SidecarError);
      expect((e as SidecarError).status).toBe(403);
      expect((e as SidecarError).message).toBe('forbidden');
    }
  });

  it('falls back to status text when the error body is not JSON-shaped', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('boom', { status: 500, statusText: 'Internal' }),
    ) as unknown as typeof fetch;
    try {
      await sidecarFetch('/x');
      expect.fail('expected throw');
    } catch (e) {
      expect((e as SidecarError).status).toBe(500);
    }
  });
});
