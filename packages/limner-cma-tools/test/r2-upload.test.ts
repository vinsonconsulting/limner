import { describe, expect, test, vi } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';

import { uploadImageToR2, imageReturnEnvelope } from '../src/r2-upload.js';

function mockBucket(): { bucket: R2Bucket; put: ReturnType<typeof vi.fn> } {
  const put = vi.fn().mockResolvedValue({ key: 'x', etag: 'y' });
  return { bucket: { put } as unknown as R2Bucket, put };
}

describe('uploadImageToR2', () => {
  test('puts bytes under prefix/<uuid>.ext with correct mime', async () => {
    const { bucket, put } = mockBucket();
    const bytes = new Uint8Array([1, 2, 3]);
    const url = await uploadImageToR2(bucket, bytes, 'image/png', { prefix: 'dalle' });
    expect(put).toHaveBeenCalledOnce();
    const [key, body, opts] = put.mock.calls[0]!;
    expect(typeof key).toBe('string');
    expect(key).toMatch(/^dalle\/[a-f0-9-]+\.png$/);
    expect(body).toBe(bytes);
    expect((opts as { httpMetadata: { contentType: string } }).httpMetadata.contentType).toBe('image/png');
    expect(url).toBe(`r2://${key}`);
  });

  test('returns absolute URL when publicBaseUrl is set', async () => {
    const { bucket } = mockBucket();
    const url = await uploadImageToR2(bucket, new Uint8Array([1]), 'image/jpeg', {
      prefix: 'r',
      publicBaseUrl: 'https://r2.example.com/',
    });
    expect(url).toMatch(/^https:\/\/r2\.example\.com\/r\/[a-f0-9-]+\.jpg$/);
  });

  test.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
    ['image/avif', 'avif'],
    ['image/x-unknown', 'bin'],
  ])('mime %s maps to extension %s', async (mime, ext) => {
    const { bucket } = mockBucket();
    const url = await uploadImageToR2(bucket, new Uint8Array([1]), mime, { prefix: 'p' });
    expect(url).toMatch(new RegExp(`\\.${ext}$`));
  });
});

describe('imageReturnEnvelope', () => {
  test('returns JSON-stringified envelope with url + mimeType', () => {
    const out = imageReturnEnvelope('r2://x', 'image/png');
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({ url: 'r2://x', mimeType: 'image/png' });
  });

  test('merges extras into the envelope', () => {
    const out = imageReturnEnvelope('r2://x', 'image/png', { width: 100, height: 50, pipeline: 'dalle' });
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({ url: 'r2://x', mimeType: 'image/png', width: 100, height: 50, pipeline: 'dalle' });
  });
});
