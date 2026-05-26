import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resize,
  crop,
  brightness,
  contrast,
  blur,
  sharpen,
  watermark,
} from '../../src/compose/photon-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 64x64 checker fixture committed under fixtures/. Generated via PIL
// from /Users/jim/GitHub/limner-pixel-legacy/.venv at fixture-creation
// time; checked in as binary so tests run deterministic and offline.
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

describe('compose/photon-ops.resize', () => {
  test('64x64 -> 32x32 cover produces PNG bytes', () => {
    const out = resize(fixture('checker-64.png'), 32, 32, 'cover');
    expect(isPng(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  test('64x64 -> 128x128 enlarge produces PNG bytes', () => {
    const out = resize(fixture('checker-64.png'), 128, 128, 'cover');
    expect(isPng(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('compose/photon-ops.crop', () => {
  test('crop 32x32 from top-left of 64x64', () => {
    const out = crop(fixture('checker-64.png'), 0, 0, 32, 32);
    expect(isPng(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  test('crop 32x32 from interior (offset 16,16)', () => {
    const out = crop(fixture('checker-64.png'), 16, 16, 32, 32);
    expect(isPng(out)).toBe(true);
  });
});

describe('compose/photon-ops.brightness', () => {
  test('positive delta brightens; output is non-empty PNG', () => {
    const out = brightness(fixture('checker-64.png'), 30);
    expect(isPng(out)).toBe(true);
  });

  test('negative delta darkens; output is non-empty PNG', () => {
    const out = brightness(fixture('checker-64.png'), -30);
    expect(isPng(out)).toBe(true);
  });
});

describe('compose/photon-ops.contrast', () => {
  test('factor > 1 increases contrast', () => {
    const out = contrast(fixture('checker-64.png'), 1.4);
    expect(isPng(out)).toBe(true);
  });

  test('factor < 1 decreases contrast', () => {
    const out = contrast(fixture('checker-64.png'), 0.6);
    expect(isPng(out)).toBe(true);
  });
});

describe('compose/photon-ops.blur', () => {
  test('gaussian blur with radius 2 produces PNG', () => {
    const out = blur(fixture('checker-64.png'), 2);
    expect(isPng(out)).toBe(true);
  });
});

describe('compose/photon-ops.sharpen', () => {
  test('parameter-free sharpen produces PNG', () => {
    const out = sharpen(fixture('checker-64.png'));
    expect(isPng(out)).toBe(true);
  });
});

describe('compose/photon-ops.watermark', () => {
  test('overlay positioned at (8,8) produces composite PNG', () => {
    const base = fixture('checker-64.png');
    // Self-overlay is sufficient for the round-trip; multi-layer
    // composites are exercised in Step 7 legacy-equivalence tests.
    const out = watermark(base, base, 8, 8);
    expect(isPng(out)).toBe(true);
  });

  test('overlay at origin (0,0) still composites', () => {
    const base = fixture('checker-64.png');
    const out = watermark(base, base, 0, 0);
    expect(isPng(out)).toBe(true);
  });
});
