import { describe, expect, test, vi } from 'vitest';

import {
  checkRateLimit,
  deriveRateLimitKey,
  withRateLimit,
  type RateLimitedEnv,
} from '../src/rate-limit.js';

const ctx = {} as ExecutionContext;

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://limner.example/mcp', { method: 'POST', headers });
}

// A RateLimit stub whose outcome the test controls.
function limiter(success: boolean) {
  return { limit: vi.fn(async (_opts: { key: string }) => ({ success })) };
}

describe('deriveRateLimitKey', () => {
  // r5: bearer tokens are hashed (32-bit FNV-1a, hex) before becoming
  // rate-limit keys — the raw credential must never flow into the
  // limiter binding or diagnostics around it. Expected literals were
  // generated with:
  //   node -e "function f(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(16).padStart(8,'0')};console.log(f('abc123'))"
  test('prefers the OAuth bearer token, hashed (per-client fairness)', () => {
    expect(deriveRateLimitKey(req({ authorization: 'Bearer abc123' }))).toBe('tok:38b29a05');
  });

  test('never embeds the raw token in the key', () => {
    const key = deriveRateLimitKey(req({ authorization: 'Bearer abc123' }));
    expect(key).not.toContain('abc123');
    expect(key).toMatch(/^tok:[0-9a-f]{8}$/);
  });

  test('is deterministic and distinct across tokens', () => {
    const a1 = deriveRateLimitKey(req({ authorization: 'Bearer token-a' }));
    const a2 = deriveRateLimitKey(req({ authorization: 'Bearer token-a' }));
    const b = deriveRateLimitKey(req({ authorization: 'Bearer token-b' }));
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  test('is case-insensitive on the Bearer scheme', () => {
    expect(deriveRateLimitKey(req({ authorization: 'bearer ZZ' }))).toBe('tok:37181735');
  });

  test('falls back to the connecting IP when no bearer token', () => {
    expect(deriveRateLimitKey(req({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('ip:203.0.113.7');
  });

  test('falls back to a shared anon bucket as a last resort', () => {
    expect(deriveRateLimitKey(req())).toBe('anon');
  });
});

describe('checkRateLimit', () => {
  test('true when the limiter allows', async () => {
    const env = { RATE_LIMITER: limiter(true) } as unknown as RateLimitedEnv;
    expect(await checkRateLimit(req(), env)).toBe(true);
  });

  test('false when the limiter rejects', async () => {
    const env = { RATE_LIMITER: limiter(false) } as unknown as RateLimitedEnv;
    expect(await checkRateLimit(req({ authorization: 'Bearer t' }), env)).toBe(false);
    expect((env.RATE_LIMITER as ReturnType<typeof limiter>).limit).toHaveBeenCalledWith({ key: 'tok:f10c3da3' });
  });

  test('fails open (true) when the RATE_LIMITER binding is absent', async () => {
    expect(await checkRateLimit(req(), {} as RateLimitedEnv)).toBe(true);
  });

  test('fails open (true) when the limiter throws', async () => {
    const env = {
      RATE_LIMITER: { limit: vi.fn(async () => { throw new Error('down'); }) },
    } as unknown as RateLimitedEnv;
    expect(await checkRateLimit(req(), env)).toBe(true);
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
    // Keyed on the HASHED bearer token derived from the request (fnv1a('t')).
    expect((env.RATE_LIMITER as ReturnType<typeof limiter>).limit).toHaveBeenCalledWith({ key: 'tok:f10c3da3' });
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
