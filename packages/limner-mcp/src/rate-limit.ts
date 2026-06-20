// Native Cloudflare rate limiting for the /mcp surface (RT-1).
//
// The default export in worker.ts wraps LimnerMCP.serve('/mcp') with
// withRateLimit(), so every authenticated tool-call request is metered
// against a per-caller key before it reaches the Durable Object / D1 /
// pipeline layer. Backed by the Workers Rate Limiting binding
// (`[[ratelimits]]` in wrangler.toml) — counters are per-Cloudflare
// location, shared across instances by namespace_id.
//
// Design choices:
//   - Key prefers the OAuth bearer token (per-client fairness on the
//     resource-consuming surface), then the connecting IP, then a shared
//     anon bucket. The OAuthProvider has already validated the token by
//     the time this wrapper runs, so the token is a stable client id.
//   - FAIL OPEN: if the binding is absent (stdio / local / tests) or the
//     limiter call throws (platform outage), requests pass through. A
//     rate limiter must never be the reason the API goes dark; the cap is
//     a guardrail against abuse, not a correctness dependency.
//
// Ref: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

import type { RateLimit } from '@cloudflare/workers-types';

export interface RateLimitedEnv {
  /** Workers Rate Limiting binding; optional so non-Workers transports
   *  (stdio) and tests run without it. */
  RATE_LIMITER?: RateLimit;
}

export interface FetchHandler<E> {
  fetch(request: Request, env: E, ctx: ExecutionContext): Promise<Response>;
}

// 32-bit FNV-1a. Not cryptographic — the requirement is a stable,
// well-distributed bucket key that does NOT embed the raw credential
// (r5: keys flow into the rate-limiter binding and any diagnostics
// around it; a bearer token has no business living there in plaintext).
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Derive the rate-limit key for a request. Prefers the OAuth bearer
 * token (hashed — never the raw credential), falls back to the
 * Cloudflare connecting IP, then a shared `anon` bucket. Never throws.
 */
export function deriveRateLimitKey(request: Request): string {
  const auth = request.headers.get('authorization');
  if (auth && auth.slice(0, 7).toLowerCase() === 'bearer ') {
    return `tok:${fnv1a(auth.slice(7).trim())}`;
  }
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) return `ip:${ip}`;
  return 'anon';
}

/**
 * Check a request against the per-caller rate limit. Returns true when the
 * request is allowed. Fails OPEN (returns true) when the binding is absent or
 * the limiter call throws — a limiter outage must never be the reason the API
 * goes dark. Shared by the /mcp + /authorize wrapper (withRateLimit) and the
 * /artifact proxy, which builds its own response.
 */
export async function checkRateLimit<E extends RateLimitedEnv>(request: Request, env: E): Promise<boolean> {
  const limiter = env.RATE_LIMITER;
  if (!limiter) return true;
  const key = deriveRateLimitKey(request);
  try {
    const outcome = await limiter.limit({ key });
    return outcome.success;
  } catch (err) {
    console.error('rate limiter error; failing open', err);
    return true;
  }
}

/**
 * Wrap a fetch handler with a per-caller rate limit. On rejection,
 * returns HTTP 429 with a JSON-RPC-shaped error body. Fails open when
 * the binding is absent or the limiter call throws.
 */
export function withRateLimit<E extends RateLimitedEnv>(inner: FetchHandler<E>): FetchHandler<E> {
  return {
    async fetch(request, env, ctx) {
      if (!(await checkRateLimit(request, env))) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32029, message: 'Rate limit exceeded. Please retry later.' },
          }),
          {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '60' },
          },
        );
      }
      return inner.fetch(request, env, ctx);
    },
  };
}
