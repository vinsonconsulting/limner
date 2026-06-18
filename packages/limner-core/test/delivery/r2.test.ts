import { describe, expect, test, vi } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';

import { uploadArtifact, verifyArtifactSignature } from '../../src/index.js';

function mockBucket(): { bucket: R2Bucket; put: ReturnType<typeof vi.fn> } {
  const put = vi.fn().mockResolvedValue({ key: 'x', etag: 'y' });
  return { bucket: { put } as unknown as R2Bucket, put };
}

const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('uploadArtifact', () => {
  test('stores under generated/<pipeline>/<uuid>.<ext> and returns a capability URL', async () => {
    const { bucket, put } = mockBucket();
    const url = await uploadArtifact(
      { bucket, baseUrl: 'https://mcp.limner.us' },
      BYTES,
      'image/png',
      'dalle',
    );
    expect(put).toHaveBeenCalledOnce();
    const [key, body, opts] = put.mock.calls[0]!;
    expect(key).toMatch(/^generated\/dalle\/[0-9a-f-]+\.png$/);
    expect(body).toBe(BYTES);
    expect(opts).toEqual({ httpMetadata: { contentType: 'image/png' } });
    // Capability URL: base + /artifact/ + key, no query string.
    expect(url).toBe(`https://mcp.limner.us/artifact/${key}`);
  });

  test('maps mime to extension and trims a trailing slash on the base', async () => {
    const { bucket, put } = mockBucket();
    const url = await uploadArtifact(
      { bucket, baseUrl: 'https://x/' },
      BYTES,
      'image/jpeg',
      'recraft',
    );
    const key = put.mock.calls[0]![0] as string;
    expect(key).toMatch(/\.jpg$/);
    expect(url).toBe(`https://x/artifact/${key}`);
  });

  test('signs the URL with exp + sig when a signing key is set', async () => {
    const { bucket, put } = mockBucket();
    const now = 1_700_000_000_000;
    const url = await uploadArtifact(
      { bucket, baseUrl: 'https://x', signingKey: 'sek', ttlSeconds: 600 },
      BYTES,
      'image/png',
      'dalle',
      now,
    );
    const u = new URL(url);
    expect(u.searchParams.get('exp')).toBe(String(Math.floor(now / 1000) + 600));
    expect(u.searchParams.get('sig')).toBeTruthy();
    const key = put.mock.calls[0]![0] as string;
    // A freshly signed URL verifies against the same key + time.
    expect(await verifyArtifactSignature(key, u.searchParams, 'sek', now)).toBe(true);
  });
});

describe('verifyArtifactSignature', () => {
  async function signedUrl(now: number) {
    const { bucket, put } = mockBucket();
    const url = await uploadArtifact(
      { bucket, baseUrl: 'https://x', signingKey: 'sek', ttlSeconds: 600 },
      BYTES,
      'image/png',
      'dalle',
      now,
    );
    const key = put.mock.calls[0]![0] as string;
    return { params: new URL(url).searchParams, key };
  }

  test('rejects an expired signature', async () => {
    const signedAt = 1_700_000_000_000;
    const { params, key } = await signedUrl(signedAt);
    const afterExpiry = signedAt + 601_000; // ttl 600s elapsed
    expect(await verifyArtifactSignature(key, params, 'sek', afterExpiry)).toBe(false);
  });

  test('rejects a tampered key', async () => {
    const now = 1_700_000_000_000;
    const { params } = await signedUrl(now);
    expect(
      await verifyArtifactSignature('generated/dalle/other.png', params, 'sek', now),
    ).toBe(false);
  });

  test('rejects the wrong signing key', async () => {
    const now = 1_700_000_000_000;
    const { params, key } = await signedUrl(now);
    expect(await verifyArtifactSignature(key, params, 'different', now)).toBe(false);
  });

  test('rejects when sig or exp is missing', async () => {
    expect(
      await verifyArtifactSignature('generated/dalle/x.png', new URLSearchParams(), 'sek'),
    ).toBe(false);
  });
});
