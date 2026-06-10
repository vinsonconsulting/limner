// r5: shared base64 codecs (src/base64.ts). The chunked encode replaced
// four duplicated per-byte loops across the mcp + cma tool layers — the
// chunk boundary (0x8000) is the interesting edge.

import { describe, expect, test } from 'vitest';

import { bytesToBase64, base64ToBytes } from '../src/base64.js';

// Deterministic pseudo-random bytes (no Math.random — reproducible runs).
function pseudoRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  let state = 0x12345678;
  for (let i = 0; i < n; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    out[i] = state & 0xff;
  }
  return out;
}

describe('base64 round-trip', () => {
  test('empty input', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });

  test('small buffer round-trips', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  test.each([0x8000 - 1, 0x8000, 0x8000 + 1])(
    'chunk-boundary length %i round-trips',
    (n) => {
      const bytes = pseudoRandomBytes(n);
      const round = base64ToBytes(bytesToBase64(bytes));
      expect(round.length).toBe(n);
      expect(round).toEqual(bytes);
    },
  );

  test('multi-chunk 100 KB buffer round-trips and matches Buffer encoding', () => {
    const bytes = pseudoRandomBytes(100_000);
    const encoded = bytesToBase64(bytes);
    // Cross-check against Node's canonical encoder.
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
    expect(base64ToBytes(encoded)).toEqual(bytes);
  });
});
