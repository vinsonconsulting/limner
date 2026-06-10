// r4: first direct coverage of the CMA-side compose dispatch
// (src/tools/compose.ts). Covers one photon op (resize), one codec op
// (convert), the cf-op IMAGES gate, and strict-union rejection — the
// {url, mimeType, op} envelope and the compose-<op> R2 key prefix are
// the contract the CMA agent consumes.

import { beforeAll, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { R2Bucket } from '@cloudflare/workers-types';

import { composeTool } from '../../src/tools/compose.js';

// jsquash WASM init helper from @limner/core's test tree — same
// cross-package precedent as @limner/mcp's compose tests. The codec ops
// (convert) need WASM init in Node; photon self-initializes.
import { initJsquashForNode } from '../../../limner-core/test/compose/helpers/jsquash-init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = new Uint8Array(
  readFileSync(resolve(__dirname, '../../../limner-core/test/compose/fixtures/checker-64.png')),
);

beforeAll(async () => {
  await initJsquashForNode();
}, 60_000);

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function mockBucket(): { bucket: R2Bucket; put: ReturnType<typeof vi.fn> } {
  const put = vi.fn().mockResolvedValue({ key: 'x', etag: 'y' });
  return { bucket: { put } as unknown as R2Bucket, put };
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

describe('cma compose dispatch — photon op (resize)', () => {
  test('uploads a PNG under compose-resize/ and returns the {url, mimeType, op} envelope', async () => {
    const { bucket, put } = mockBucket();
    const out = await composeTool.run(
      { op: 'resize', input: b64encode(fixture), width: 32, height: 32 },
      { env: { BUCKET: bucket } },
    );

    const envelope = JSON.parse(out) as { url: string; mimeType: string; op: string };
    expect(envelope.url).toMatch(/^r2:\/\/compose-resize\/[a-f0-9-]+\.png$/);
    expect(envelope.mimeType).toBe('image/png');
    expect(envelope.op).toBe('resize');

    expect(put).toHaveBeenCalledOnce();
    const [key, body] = put.mock.calls[0]!;
    expect(key).toMatch(/^compose-resize\/[a-f0-9-]+\.png$/);
    expect([...(body as Uint8Array).slice(0, 4)]).toEqual(PNG_MAGIC);
  });
});

describe('cma compose dispatch — codec op (convert)', () => {
  test('routes through jsquash and uploads image/jpeg under compose-convert/', async () => {
    const { bucket, put } = mockBucket();
    const out = await composeTool.run(
      { op: 'convert', input: b64encode(fixture), from: 'png', to: 'jpeg', quality: 80 },
      { env: { BUCKET: bucket } },
    );

    const envelope = JSON.parse(out) as {
      url: string;
      mimeType: string;
      op: string;
      from: string;
      to: string;
    };
    expect(envelope.url).toMatch(/^r2:\/\/compose-convert\/[a-f0-9-]+\.jpg$/);
    expect(envelope.mimeType).toBe('image/jpeg');
    expect(envelope.op).toBe('convert');
    expect(envelope.from).toBe('png');
    expect(envelope.to).toBe('jpeg');

    const [, body] = put.mock.calls[0]!;
    // JPEG magic: FF D8 FF
    const bytes = body as Uint8Array;
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
  });
});

describe('cma compose dispatch — cf-op gate', () => {
  test('cf op without the IMAGES binding throws the binding-guidance error', async () => {
    const { bucket } = mockBucket();
    await expect(
      composeTool.run(
        { op: 'cfBlur', input: b64encode(fixture), radius: 5 },
        { env: { BUCKET: bucket } },
      ),
    ).rejects.toThrow(/requires the IMAGES binding/);
  });

  test('requires predicate gates on BUCKET', () => {
    expect(composeTool.requires?.({})).toBe(false);
    expect(composeTool.requires?.({ BUCKET: mockBucket().bucket })).toBe(true);
  });
});

describe('cma compose dispatch — strict-union validation', () => {
  test('malformed args are rejected before dispatch', async () => {
    const { bucket, put } = mockBucket();
    await expect(
      // resize missing input/width/height — passes the loose advertised
      // schema, must die on the strict per-op union.
      composeTool.run({ op: 'resize' }, { env: { BUCKET: bucket } }),
    ).rejects.toThrow(/invalid arguments/);
    expect(put).not.toHaveBeenCalled();
  });

  test('unknown op is rejected', async () => {
    const { bucket } = mockBucket();
    await expect(
      composeTool.run({ op: 'no_such_op' }, { env: { BUCKET: bucket } }),
    ).rejects.toThrow(/invalid arguments/);
  });
});
