import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decode,
  encode,
  convert,
  type Format,
} from '../../src/compose/jsquash-codecs.js';
import { initJsquashForNode } from './helpers/jsquash-init.js';

// Node has no automatic WASM resolution for jSquash codecs (Workers
// does via wrangler bundling). Init once before the suite runs.
beforeAll(async () => {
  await initJsquashForNode();
}, 60_000);

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));

describe('compose/jsquash-codecs.decode', () => {
  test('PNG -> { data, width, height } with 64*64*4 RGBA bytes', async () => {
    const out = await decode('png', fixture('checker-64.png'));
    expect(out.width).toBe(64);
    expect(out.height).toBe(64);
    expect(out.data).toBeInstanceOf(Uint8ClampedArray);
    expect(out.data.length).toBe(64 * 64 * 4);
  });
});

describe('compose/jsquash-codecs.encode', () => {
  test('encode PNG produces non-empty bytes', async () => {
    const decoded = await decode('png', fixture('checker-64.png'));
    const out = await encode('png', decoded);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(0);
  });

  test('encode JPEG with quality option', async () => {
    const decoded = await decode('png', fixture('checker-64.png'));
    const out = await encode('jpeg', decoded, { quality: 90 });
    // JPEG magic: FF D8 FF
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[2]).toBe(0xff);
  });

  test('encode WebP produces RIFF/WEBP bytes', async () => {
    const decoded = await decode('png', fixture('checker-64.png'));
    const out = await encode('webp', decoded, { quality: 80 });
    // WebP starts with "RIFF....WEBP"
    expect(String.fromCharCode(out[0]!, out[1]!, out[2]!, out[3]!)).toBe('RIFF');
    expect(String.fromCharCode(out[8]!, out[9]!, out[10]!, out[11]!)).toBe('WEBP');
  });

  test(
    'encode AVIF produces non-empty bytes',
    { timeout: 60_000 },
    async () => {
      // AVIF encode can take several seconds at 64x64; bump this single
      // test's timeout above Vitest's default 30s.
      const decoded = await decode('png', fixture('checker-64.png'));
      const out = await encode('avif', decoded, { quality: 50 });
      expect(out.length).toBeGreaterThan(0);
    },
  );
});

describe('compose/jsquash-codecs.convert', () => {
  test('PNG -> PNG roundtrip preserves dimensions', async () => {
    const out = await convert(fixture('checker-64.png'), 'png', 'png');
    const re = await decode('png', out);
    expect(re.width).toBe(64);
    expect(re.height).toBe(64);
  });

  test.each<readonly [Format, Format]>([
    ['png', 'jpeg'],
    ['png', 'webp'],
    ['jpeg', 'png'],
    ['webp', 'png'],
  ])('cross-format %s -> %s succeeds', async (from, to) => {
    // For non-PNG sources, encode a sample first using our own pipeline.
    const src =
      from === 'png'
        ? fixture('checker-64.png')
        : await convert(fixture('checker-64.png'), 'png', from);
    const out = await convert(src, from, to);
    expect(out.length).toBeGreaterThan(0);
  });

  test(
    'cross-format png -> avif succeeds',
    { timeout: 60_000 },
    async () => {
      const out = await convert(fixture('checker-64.png'), 'png', 'avif', { quality: 40 });
      expect(out.length).toBeGreaterThan(0);
    },
  );
});

describe('compose/jsquash-codecs error paths', () => {
  test('decode throws on a clearly-invalid byte stream', async () => {
    // 8 bytes of junk — not a valid PNG header.
    const junk = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(decode('png', junk)).rejects.toThrow();
  });
});
