import { describe, expect, test, vi } from 'vitest';

import { deriveRateLimitKey, withRateLimit, type RateLimitedEnv } from '../src/rate-limit.js';

const ctx = {} as ExecutionContext;

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://limner.example/mcp', { method: 'POST', headers });
}

// A RateLimit stub whose outcome the test controls.
function limiter(success: boolean) {
  return { limit: vi.fn(async (_opts: { key: string }) => ({ success })) };
}

describe('deriveRateLimitKey', () => {
  test('prefers the OAuth bearer token (per-client fairness)', () => {
    expect(deriveRateLimitKey(req({ authorization: 'Bearer abc123' }))).toBe('tok:abc123');
  });

  test('is case-insensitive on the Bearer scheme', () => {
    expect(deriveRateLimitKey(req({ authorization: 'bearer ZZ' }))).toBe('tok:ZZ');
  });

  test('falls back to the connecting IP when no bearer token', () => {
    expect(deriveRateLimitKey(req({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('ip:203.0.113.7');
  });

  test('falls back to a shared anon bucket as a last resort', () => {
    expect(deriveRateLimitKey(req())).toBe('anon');
  });
});

describe('withRateLimit', () => {
  test('returns HTTP 429 with a JSON-RPC error body when the limiter rejects', async () => {
    const inner = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };
    const env = { RATE_LIMITER: limiter(false) } as unknown as RateLimitedEnv;

    const res = await withRateLimit(inner).fetch(req({ authorization: 'Bearer t' }), env, ctx);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    const body = (await res.json()) as { jsonrpc: string; error: { code: number } };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32029);
    expect(inner.fetch).not.toHaveBeenCalled();
    // Keyed on the bearer token derived from the request.
    expect((env.RATE_LIMITER as ReturnType<typeof limiter>).limit).toHaveBeenCalledWith({ key: 'tok:t' });
  });

  test('delegates to the inner handler when the limiter allows', async () => {
    const inner = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };
    const env = { RATE_LIMITER: limiter(true) } as unknown as RateLimitedEnv;

    const res = await withRateLimit(inner).fetch(req(), env, ctx);

    expect(res.status).toBe(200);
    expect(inner.fetch).toHaveBeenCalledOnce();
  });

  test('fails open (delegates) when the RATE_LIMITER binding is absent', async () => {
    const inner = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };

    const res = await withRateLimit(inner).fetch(req(), {} as RateLimitedEnv, ctx);

    expect(res.status).toBe(200);
    expect(inner.fetch).toHaveBeenCalledOnce();
  });

  test('fails open when the limiter itself throws (outage must not brick the API)', async () => {
    const inner = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };
    const env = {
      RATE_LIMITER: { limit: vi.fn(async () => { throw new Error('limiter down'); }) },
    } as unknown as RateLimitedEnv;

    const res = await withRateLimit(inner).fetch(req({ authorization: 'Bearer t' }), env, ctx);

    expect(res.status).toBe(200);
    expect(inner.fetch).toHaveBeenCalledOnce();
  });
});
