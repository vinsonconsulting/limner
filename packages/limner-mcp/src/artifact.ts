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
  if (!env.GENERATED_BUCKET) return new Response('not found', { status: 404 });

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.slice(ARTIFACT_PATH_PREFIX.length));
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
  headers.set('cache-control', 'private, max-age=86400');
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}
