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
  }

  const obj = await env.GENERATED_BUCKET.get(key);
  if (!obj) return new Response('not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'private, max-age=86400');
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}
