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
    ['brand-stamp', 'offset from the top-left'],
    ['multi-size-export', 'cover and contain agree'],
    ['captioned-graphic', 'JSX-shaped'],
    ['aspect-ratio-crops', 'largest rectangle'],
    ['iterate-on-asset', 'does not save generations automatically'],
    ['style-from-images', 'provenance.source to style-from-images'],
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

  test('brand-stamp documents the watermark op without overclaiming opacity', () => {
    const md = serializeGuidance(getGuidance('brand-stamp')!);
    expect(md.startsWith('# Brand stamp and watermark')).toBe(true);
    expect(md).toContain('watermark op');
    expect(md).toContain('| base | The image to stamp |');
    // stays honest about the missing opacity knob on the local op
    expect(md).toContain('takes no opacity value');
  });

  test('multi-size-export covers resize/convert and the local cover-fit reality', () => {
    const md = serializeGuidance(getGuidance('multi-size-export')!);
    expect(md.startsWith('# Multi-size and format export')).toBe(true);
    expect(md).toContain('WebP');
    // the local fit behavior and the Workers-only letterbox path
    expect(md).toContain('cover fit');
    expect(md).toContain('contain or pad fit');
  });

  test('captioned-graphic renders text then composites over the image', () => {
    const md = serializeGuidance(getGuidance('captioned-graphic')!);
    expect(md.startsWith('# Captioned graphic')).toBe(true);
    expect(md).toContain('renderText');
    // the composite step that lands the text on the base image
    expect(md).toContain('watermark op');
    // honest single built-in font claim
    expect(md).toContain('IBM Plex Sans');
  });

  test('aspect-ratio-crops covers local crop and Workers smart crop', () => {
    const md = serializeGuidance(getGuidance('aspect-ratio-crops')!);
    expect(md.startsWith('# Aspect-ratio crop set')).toBe(true);
    expect(md).toContain('crop op');
    expect(md).toContain('9:16');
    // the Workers-only subject-aware path
    expect(md).toContain('cfSmartCrop');
  });

  test('iterate-on-asset is honest that generations are not auto-persisted', () => {
    const md = serializeGuidance(getGuidance('iterate-on-asset')!);
    expect(md.startsWith('# Iterate on a prior asset')).toBe(true);
    // recall depends on notes the agent records itself
    expect(md).toContain('limner_record');
    expect(md).toContain('limner_recall');
    expect(md).toContain('does not save generations automatically');
    // the capability-URL-as-image-input iteration path
    expect(md).toContain('image input');
  });

  test('style-from-images writes the shared style profile and uses image input', () => {
    const md = serializeGuidance(getGuidance('style-from-images')!);
    expect(md.startsWith('# Style from user images')).toBe(true);
    // writes into the shared style-profile (does not redefine the schema)
    expect(md).toContain('upsertStyleProfile');
    expect(md).toContain('provenance.source to style-from-images');
    // the native image-input matching path (#64)
    expect(md).toContain('image input');
  });
});
