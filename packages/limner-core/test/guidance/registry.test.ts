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
