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

/**
 * Derive the rate-limit key for a request. Prefers the OAuth bearer
 * token, falls back to the Cloudflare connecting IP, then a shared
 * `anon` bucket. Never throws.
 */
export function deriveRateLimitKey(request: Request): string {
  const auth = request.headers.get('authorization');
  if (auth && auth.slice(0, 7).toLowerCase() === 'bearer ') {
    return `tok:${auth.slice(7).trim()}`;
  }
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) return `ip:${ip}`;
  return 'anon';
}

/**
 * Wrap a fetch handler with a per-caller rate limit. On rejection,
 * returns HTTP 429 with a JSON-RPC-shaped error body. Fails open when
 * the binding is absent or the limiter call throws.
 */
export function withRateLimit<E extends RateLimitedEnv>(inner: FetchHandler<E>): FetchHandler<E> {
  return {
    async fetch(request, env, ctx) {
      const limiter = env.RATE_LIMITER;
      if (limiter) {
        const key = deriveRateLimitKey(request);
        let allowed = true;
        try {
          const outcome = await limiter.limit({ key });
          allowed = outcome.success;
        } catch (err) {
          // Fail open: a limiter outage must not take down the API.
          console.error('rate limiter error; failing open', err);
        }
        if (!allowed) {
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
      }
      return inner.fetch(request, env, ctx);
    },
  };
}
