import { describe, expect, test, vi } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';

import { serveArtifact, isArtifactPath } from '../src/artifact.js';
import type { Env } from '../src/worker.js';

function r2Object(bytes: Uint8Array, contentType: string) {
  return {
    body: new Response(bytes).body,
    httpEtag: '"etag123"',
    writeHttpMetadata: (h: Headers) => h.set('content-type', contentType),
  };
}

function envWith(get: (key: string) => Promise<unknown>, signingKey?: string, baseUrl?: string): Env {
  return {
    GENERATED_BUCKET: { get: vi.fn(get) },
    ...(signingKey ? { ARTIFACT_SIGNING_KEY: signingKey } : {}),
    ...(baseUrl ? { ARTIFACT_BASE_URL: baseUrl } : {}),
  } as unknown as Env;
}

// Mint a valid signed artifact URL for KEY using the real clock, optionally
// shifting the signing clock to force expiry.
async function signedUrl(signingKey: string, ttlSeconds: number, now?: number): Promise<string> {
  const { uploadArtifact } = await import('@limner/core');
  const put = vi.fn().mockResolvedValue({});
  return uploadArtifact(
    { bucket: { put } as unknown as R2Bucket, baseUrl: 'https://mcp.limner.us', signingKey, ttlSeconds },
    new Uint8Array([1, 2, 3]),
    'image/png',
    'dalle',
    now,
  );
}

const KEY = 'generated/dalle/abc-123.png';
const urlFor = (key: string, q = ''): string => `https://mcp.limner.us/artifact/${key}${q}`;

describe('isArtifactPath', () => {
  test('matches /artifact/ paths only', () => {
    expect(isArtifactPath('/artifact/generated/x.png')).toBe(true);
    expect(isArtifactPath('/mcp')).toBe(false);
    expect(isArtifactPath('/')).toBe(false);
  });
});

describe('serveArtifact', () => {
  test('streams the stored object with its content-type', async () => {
    const env = envWith(async () => r2Object(new Uint8Array([1, 2, 3]), 'image/png'));
    const res = await serveArtifact(new Request(urlFor(KEY)), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  test('404 when GENERATED_BUCKET is absent', async () => {
    const res = await serveArtifact(new Request(urlFor(KEY)), {} as unknown as Env);
    expect(res.status).toBe(404);
  });

  test('404 for a key outside the generated/ prefix (no bucket read)', async () => {
    const get = vi.fn();
    const env = { GENERATED_BUCKET: { get } } as unknown as Env;
    const res = await serveArtifact(new Request(urlFor('secrets/dump.txt')), env);
    expect(res.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  test('404 when the object is missing', async () => {
    const env = envWith(async () => null);
    const res = await serveArtifact(new Request(urlFor(KEY)), env);
    expect(res.status).toBe(404);
  });

  test('405 for non-GET/HEAD', async () => {
    const env = envWith(async () => r2Object(new Uint8Array([1]), 'image/png'));
    const res = await serveArtifact(new Request(urlFor(KEY), { method: 'POST' }), env);
    expect(res.status).toBe(405);
  });

  test('HEAD returns headers without a body', async () => {
    const env = envWith(async () => r2Object(new Uint8Array([1, 2, 3]), 'image/png'));
    const res = await serveArtifact(new Request(urlFor(KEY), { method: 'HEAD' }), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  test('403 for a missing signature when ARTIFACT_SIGNING_KEY is set', async () => {
    const env = envWith(async () => r2Object(new Uint8Array([1]), 'image/png'), 'sek');
    const res = await serveArtifact(new Request(urlFor(KEY)), env); // no exp/sig
    expect(res.status).toBe(403);
  });

  test('serves a freshly signed URL when ARTIFACT_SIGNING_KEY is set', async () => {
    const signed = await signedUrl('sek', 600);
    const env = envWith(async () => r2Object(new Uint8Array([1, 2, 3]), 'image/png'), 'sek');
    const res = await serveArtifact(new Request(signed), env);
    expect(res.status).toBe(200);
  });

  test('403 for a tampered signature when ARTIFACT_SIGNING_KEY is set', async () => {
    const signed = await signedUrl('sek', 600);
    // Flip the last character of the sig param.
    const tampered = signed.endsWith('A') ? `${signed.slice(0, -1)}B` : `${signed.slice(0, -1)}A`;
    const env = envWith(async () => r2Object(new Uint8Array([1, 2, 3]), 'image/png'), 'sek');
    const res = await serveArtifact(new Request(tampered), env);
    expect(res.status).toBe(403);
  });

  test('403 for an expired signature when ARTIFACT_SIGNING_KEY is set', async () => {
    // Sign with a clock ~10h in the past and a 10m ttl → already expired.
    const signed = await signedUrl('sek', 600, Date.now() - 10 * 3600 * 1000);
    const env = envWith(async () => r2Object(new Uint8Array([1, 2, 3]), 'image/png'), 'sek');
    const res = await serveArtifact(new Request(signed), env);
    expect(res.status).toBe(403);
  });

  describe('fail-closed on a public origin (A4 hardening)', () => {
    test('503 when the origin is public https but no ARTIFACT_SIGNING_KEY is set', async () => {
      // Misconfig: prod base URL but the signing secret was never set. Refuse
      // to silently downgrade to unsigned capability URLs.
      const get = vi.fn(async () => r2Object(new Uint8Array([1]), 'image/png'));
      const env = envWith(get, undefined, 'https://mcp.limner.us');
      const res = await serveArtifact(new Request(urlFor(KEY)), env);
      expect(res.status).toBe(503);
      expect(get).not.toHaveBeenCalled();
    });

    test('serves unsigned on a local http origin without a signing key (dev)', async () => {
      const env = envWith(
        async () => r2Object(new Uint8Array([1, 2, 3]), 'image/png'),
        undefined,
        'http://localhost:8787',
      );
      const res = await serveArtifact(new Request(urlFor(KEY)), env);
      expect(res.status).toBe(200);
    });
  });
});
