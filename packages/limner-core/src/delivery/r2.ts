// Asset delivery (PR D / D-RA-20 extension): store generated image bytes in R2
// and return a fetchable URL instead of inline base64. Large inline outputs
// (e.g. gpt-image-1 base64) exceed the MCP message-size ceiling; a stored URL
// sidesteps that. Keys are unguessable UUIDs (capability URLs). When a signing
// key is configured, URLs are additionally HMAC-signed with an expiry; without
// one, the unguessable key is the capability.

import type { R2Bucket } from '@cloudflare/workers-types';

export type ArtifactDelivery = {
  bucket: R2Bucket;
  /** Absolute base for artifact URLs, e.g. https://mcp.limner.us (no path). */
  baseUrl: string;
  /** Optional HMAC-SHA256 secret. When set, URLs are signed + time-limited. */
  signingKey?: string;
  /** Signed-URL lifetime in seconds (default 3600). Ignored without signingKey. */
  ttlSeconds?: number;
};

/** Key prefix + URL path segment the worker proxy serves from. */
export const ARTIFACT_KEY_PREFIX = 'generated';
export const ARTIFACT_PATH_PREFIX = '/artifact/';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function extFor(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

/**
 * Upload image bytes under `generated/<pipeline>/<uuid>.<ext>` and return an
 * absolute, fetchable URL pointing at the worker's `/artifact/` proxy. `now`
 * is injectable for deterministic signing in tests.
 */
export async function uploadArtifact(
  delivery: ArtifactDelivery,
  bytes: Uint8Array,
  mimeType: string,
  pipelineId: string,
  now: number = Date.now(),
): Promise<string> {
  const key = `${ARTIFACT_KEY_PREFIX}/${pipelineId}/${crypto.randomUUID()}.${extFor(mimeType)}`;
  await delivery.bucket.put(key, bytes, { httpMetadata: { contentType: mimeType } });
  const base = delivery.baseUrl.replace(/\/+$/, '');
  let url = `${base}${ARTIFACT_PATH_PREFIX}${key}`;
  if (delivery.signingKey) {
    const exp = Math.floor(now / 1000) + (delivery.ttlSeconds ?? 3600);
    const sig = await signArtifact(key, exp, delivery.signingKey);
    url += `?exp=${exp}&sig=${sig}`;
  }
  return url;
}

/**
 * Verify a signed artifact request. Returns true when the signature is valid
 * and unexpired. Capability-URL mode (no signing key configured) is handled by
 * the caller — this only runs when a key is present.
 */
export async function verifyArtifactSignature(
  key: string,
  params: URLSearchParams,
  signingKey: string,
  now: number = Date.now(),
): Promise<boolean> {
  const exp = Number(params.get('exp'));
  const sig = params.get('sig');
  if (!sig || !Number.isFinite(exp)) return false;
  if (exp * 1000 < now) return false;
  const expected = await signArtifact(key, exp, signingKey);
  return timingSafeEqual(sig, expected);
}

async function signArtifact(key: string, exp: number, secret: string): Promise<string> {
  const mac = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', mac, new TextEncoder().encode(`${key}:${exp}`));
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Constant-time string compare so signature verification doesn't leak via
// early-exit timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
