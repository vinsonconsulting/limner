// PR D: public artifact proxy. Serves generated image bytes from
// GENERATED_BUCKET at GET /artifact/<key>. Keys are unguessable UUIDs
// (capability URLs); when ARTIFACT_SIGNING_KEY is set, the HMAC signature +
// expiry are verified. This route is intentionally OUTSIDE OAuth — the
// capability URL is the access grant, so the CMA agent (and any MCP client)
// can fetch the asset without a bearer token. The 30-day retention sweep
// (scheduled() in worker.ts) reaps these objects like the compose artifacts.

import {
  ARTIFACT_KEY_PREFIX,
  ARTIFACT_PATH_PREFIX,
  verifyArtifactSignature,
} from '@limner/core';
import { checkRateLimit } from './rate-limit.js';
import type { Env } from './worker.js';

export function isArtifactPath(pathname: string): boolean {
  return pathname.startsWith(ARTIFACT_PATH_PREFIX);
}

// A public origin (https, non-loopback host) is a production deployment and
// MUST sign artifact URLs. Local/dev origins (http://localhost) may serve
// capability-only URLs. Drives the fail-closed check in serveArtifact.
function requiresSignedArtifacts(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
}

export async function serveArtifact(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405 });
  }
  // Meter the public proxy per-caller (keys on IP — no bearer here) before any
  // R2 work. Reuses the /mcp limiter binding; fails open without it.
  if (!(await checkRateLimit(request, env))) {
    return new Response('rate limit exceeded', { status: 429, headers: { 'retry-after': '60' } });
  }
  if (!env.GENERATED_BUCKET) return new Response('not found', { status: 404 });

  const url = new URL(request.url);
  // A malformed percent-escape (e.g. /artifact/%zz) makes decodeURIComponent
  // throw URIError; this route runs pre-OAuth and outside any catch, so treat a
  // bad key as not-found rather than letting it surface as a 500 (L4).
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(ARTIFACT_PATH_PREFIX.length));
  } catch {
    return new Response('not found', { status: 404 });
  }
  // Only serve keys this worker writes. R2 keys are opaque (no filesystem, so
  // no `..` traversal), but bounding the prefix is cheap defense in depth.
  if (!key || !key.startsWith(`${ARTIFACT_KEY_PREFIX}/`)) {
    return new Response('not found', { status: 404 });
  }

  if (env.ARTIFACT_SIGNING_KEY) {
    const ok = await verifyArtifactSignature(key, url.searchParams, env.ARTIFACT_SIGNING_KEY);
    if (!ok) return new Response('forbidden', { status: 403 });
  } else if (requiresSignedArtifacts(env.ARTIFACT_BASE_URL)) {
    // Fail closed: a public https origin with no signing key configured is a
    // deploy misconfiguration. Refuse to serve rather than silently downgrade
    // to unsigned capability URLs.
    return new Response('artifact signing not configured', { status: 503 });
  }

  const obj = await env.GENERATED_BUCKET.get(key);
  if (!obj) return new Response('not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  // L6: cap the browser cache lifetime at the remaining signature lifetime so
  // a private-cached copy can't outlive the capability it's gating. Unsigned
  // (dev/local) keeps the 24h default.
  headers.set('cache-control', `private, max-age=${signedMaxAge(url.searchParams)}`);
  // H1: never let the browser MIME-sniff, and neutralize active content. SVG
  // (and any non-raster type) is served as a forced download under a no-script
  // sandbox CSP so it can't execute script in the same origin as the OAuth flow.
  headers.set('x-content-type-options', 'nosniff');
  if (!isInlineSafe(headers.get('content-type'))) {
    headers.set('content-disposition', 'attachment');
    headers.set('content-security-policy', "default-src 'none'; sandbox");
  }
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}

// Raster image types that are safe to render inline (browsers never execute
// script in these). Everything else — notably image/svg+xml — is treated as
// active content and hardened.
const INLINE_SAFE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
]);

function isInlineSafe(contentType: string | null): boolean {
  if (!contentType) return false;
  return INLINE_SAFE_TYPES.has(contentType.split(';')[0]!.trim().toLowerCase());
}

// Seconds of cache lifetime: the remaining signature lifetime when an `exp`
// (unix seconds) is present and valid, clamped to [0, 24h]. Falls back to 24h
// for unsigned capability URLs (no exp).
const DEFAULT_MAX_AGE = 86400;
function signedMaxAge(params: URLSearchParams): number {
  const exp = Number(params.get('exp'));
  if (!Number.isFinite(exp) || exp <= 0) return DEFAULT_MAX_AGE;
  const remaining = Math.floor(exp - Date.now() / 1000);
  return Math.max(0, Math.min(DEFAULT_MAX_AGE, remaining));
}
