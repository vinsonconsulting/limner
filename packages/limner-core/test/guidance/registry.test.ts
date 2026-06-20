import { describe, expect, test } from 'vitest';

import {
  A4_FRAMING,
  getGuidance,
  listGuidance,
  serializeGuidance,
} from '../../src/guidance/index.js';

describe('guidance registry', () => {
  test('looks up the canonical entries by id', () => {
    expect(getGuidance('file-types')?.id).toBe('file-types');
    expect(getGuidance('capabilities-overview')?.id).toBe('capabilities-overview');
  });

  test('returns undefined for an unknown id', () => {
    expect(getGuidance('does-not-exist')).toBeUndefined();
  });

  test('lists at least the two canonical entries with unique ids', () => {
    const entries = listGuidance();
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('guidance serializer', () => {
  test('renders the title heading, A4 framing, and the file-types table', () => {
    const md = serializeGuidance(getGuidance('file-types')!);
    expect(md.startsWith('# Image & document file types')).toBe(true);
    expect(md).toContain(A4_FRAMING);
    // table header + a couple of representative rows
    expect(md).toContain('| Format | Compression | Alpha | Color model | Typical use |');
    expect(md).toContain('| --- | --- | --- | --- | --- |');
    expect(md).toContain('PNG');
    expect(md).toContain('AVIF');
  });

  test('is deterministic and ends with exactly one trailing newline', () => {
    const entry = getGuidance('capabilities-overview')!;
    expect(serializeGuidance(entry)).toBe(serializeGuidance(entry));
    const md = serializeGuidance(entry);
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});

describe('wave-1 guidance entries (D-RA-24)', () => {
  // [id, a substring that must appear in the serialized markdown]
  const WAVE_1: ReadonlyArray<readonly [string, string]> = [
    ['external-tools', 'Inkscape'],
    ['midjourney-recipe', '--stylize'],
    ['dalle-recipe', 'gpt-image-1'],
    ['recraft-recipe', 'vector_illustration'],
    ['illuminated-manuscript', 'Historiated initial'],
  ];

  test('registers and looks up every wave-1 entry by id', () => {
    for (const [id] of WAVE_1) {
      expect(getGuidance(id)?.id).toBe(id);
    }
  });

  test('lists all entries (canonical + wave-1) with unique ids', () => {
    const ids = listGuidance().map((e) => e.id);
    for (const [id] of WAVE_1) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('serializes each entry: A4 framing, signature content, one trailing newline', () => {
    for (const [id, marker] of WAVE_1) {
      const md = serializeGuidance(getGuidance(id)!);
      expect(md).toContain(A4_FRAMING);
      expect(md).toContain(marker);
      expect(md.endsWith('\n')).toBe(true);
      expect(md.endsWith('\n\n')).toBe(false);
      // deterministic
      expect(serializeGuidance(getGuidance(id)!)).toBe(md);
    }
  });

  test('capabilities-overview gains the recipe + external-tools cross-references', () => {
    const md = serializeGuidance(getGuidance('capabilities-overview')!);
    expect(md).toContain('Going deeper');
    expect(md).toContain('Recraft');
    expect(md).toContain('GIMP');
  });

  test('capabilities-overview reflects native image-input (PR #64)', () => {
    const md = serializeGuidance(getGuidance('capabilities-overview')!);
    expect(md).toContain('image as input');
  });

  test('capabilities-overview surfaces the post-processing tools (wave-2)', () => {
    const md = serializeGuidance(getGuidance('capabilities-overview')!);
    expect(md).toContain('Post-processing');
    expect(md).toContain('Upscale');
    expect(md).toContain('Vectorize');
  });
});

describe('wave-2 guidance entries (D-RA-24)', () => {
  // [id, a substring that must appear in the serialized markdown]
  const WAVE_2: ReadonlyArray<readonly [string, string]> = [
    ['pipeline-router', 'least post-processing'],
  ];

  test('registers and looks up every wave-2 entry by id', () => {
    for (const [id] of WAVE_2) {
      expect(getGuidance(id)?.id).toBe(id);
    }
  });

  test('lists all entries with unique ids', () => {
    const ids = listGuidance().map((e) => e.id);
    for (const [id] of WAVE_2) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('serializes each entry: A4 framing, signature content, one trailing newline', () => {
    for (const [id, marker] of WAVE_2) {
      const md = serializeGuidance(getGuidance(id)!);
      expect(md).toContain(A4_FRAMING);
      expect(md).toContain(marker);
      expect(md.endsWith('\n')).toBe(true);
      expect(md.endsWith('\n\n')).toBe(false);
      // deterministic
      expect(serializeGuidance(getGuidance(id)!)).toBe(md);
    }
  });

  test('pipeline-router routes by output kind, cost, and the three pipelines', () => {
    const md = serializeGuidance(getGuidance('pipeline-router')!);
    expect(md.startsWith('# Pipeline router')).toBe(true);
    expect(md).toContain('Midjourney');
    expect(md).toContain('DALL·E');
    expect(md).toContain('Recraft');
    // the cost asymmetry that drives the routing decision
    expect(md).toContain('No Limner API charge');
  });
});
