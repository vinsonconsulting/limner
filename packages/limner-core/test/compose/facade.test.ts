import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compose } from '../../src/compose/index.js';
import { initJsquashForNode } from './helpers/jsquash-init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));

beforeAll(async () => {
  // jsquash decode in the round-trip test below needs WASM init.
  await initJsquashForNode();
}, 60_000);

describe('compose facade surface', () => {
  test.each([
    'resize',
    'crop',
    'brightness',
    'contrast',
    'blur',
    'sharpen',
    'watermark',
    'encode',
    'decode',
    'convert',
    'renderText',
    'ensureResvgInit',
    'cfTransform',
    'cfOverlay',
    'cfBlur',
    'cfSmartCrop',
    'cfBackgroundFill',
  ] as const)('exposes compose.%s as a function', (name) => {
    expect(typeof compose[name]).toBe('function');
  });
});

describe('compose facade round-trips through primitive boundaries', () => {
  test('compose.resize -> compose.decode round-trips dimensions', async () => {
    const resized = compose.resize(fixture('checker-64.png'), 32, 32, 'cover');
    const decoded = await compose.decode('png', resized);
    expect(decoded.width).toBe(32);
    expect(decoded.height).toBe(32);
  });

  test('compose.decode -> compose.encode roundtrips through PNG', async () => {
    const decoded = await compose.decode('png', fixture('checker-64.png'));
    const re = await compose.encode('png', decoded);
    expect(re).toBeInstanceOf(Uint8Array);
    expect(re.length).toBeGreaterThan(0);
  });

  test('compose.convert PNG -> WebP yields RIFF/WEBP-prefixed bytes', async () => {
    const out = await compose.convert(fixture('checker-64.png'), 'png', 'webp', {
      quality: 80,
    });
    expect(String.fromCharCode(out[0]!, out[1]!, out[2]!, out[3]!)).toBe('RIFF');
    expect(String.fromCharCode(out[8]!, out[9]!, out[10]!, out[11]!)).toBe('WEBP');
  });
});
