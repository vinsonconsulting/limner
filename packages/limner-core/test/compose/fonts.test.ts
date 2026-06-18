import { describe, expect, test } from 'vitest';

import {
  DEFAULT_FONT_ID,
  isFontId,
  listFontIds,
  fontDisplayName,
  resolveFontBytes,
} from '../../src/index.js';

describe('compose font registry', () => {
  test('the default font id is registered', () => {
    expect(isFontId(DEFAULT_FONT_ID)).toBe(true);
    expect(listFontIds()).toContain(DEFAULT_FONT_ID);
  });

  test('isFontId rejects unknown ids', () => {
    expect(isFontId('comic-sans')).toBe(false);
    expect(isFontId('')).toBe(false);
  });

  test('fontDisplayName returns the human name', () => {
    expect(fontDisplayName('ibm-plex-sans')).toBe('IBM Plex Sans');
  });

  test('resolveFontBytes returns decoded TrueType bytes (sfnt magic)', () => {
    const bytes = resolveFontBytes('ibm-plex-sans');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // TrueType sfnt version 0x00010000 — IBM Plex Sans Regular ships TrueType
    // outlines. This is the embedded font surviving the base64 round-trip.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
  });

  test('resolveFontBytes caches (same reference on repeat)', () => {
    const a = resolveFontBytes('ibm-plex-sans');
    const b = resolveFontBytes('ibm-plex-sans');
    expect(a).toBe(b);
  });
});
