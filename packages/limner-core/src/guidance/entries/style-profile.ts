import type { GuidanceEntry } from '../types.js';

/**
 * Concept (D-RA-24 cross-cutting) — describes the style-profile shape so the
 * brand-kit (#9), style-from-images (#15), and art-research (#17) skills author
 * against one schema. The field list here is kept in step with
 * @limner/core/src/style-profile/schema.ts.
 */
export const styleProfile: GuidanceEntry = {
  id: 'style-profile',
  title: 'Style profile',
  summary:
    'The shared, per-project style artifact — palette, descriptors, medium, pipeline preferences, references, and provenance — that brand-kit, style-from-images, and art-research all read and write.',
  body: [
    {
      kind: 'paragraph',
      text: 'A style profile is one validated object stored per project (under the project metadata). It is the single source of visual intent: several Limner surfaces produce it (a brand kit, an analysis of reference images, an art-research pass) and all of them read the same shape, so a profile authored by one flows into the next without re-describing it.',
    },
    { kind: 'heading', level: 2, text: 'Fields' },
    {
      kind: 'table',
      columns: ['Field', 'Type', 'Purpose'],
      rows: [
        ['version', 'number (1)', 'Schema tag for forward migration'],
        ['palette', 'array of { hex, name? }', 'Brand / art colors (hex, optionally named)'],
        ['descriptors', 'string[]', 'Style keywords ("cinematic", "flat", "noir")'],
        ['medium', 'string', 'Medium / technique notes ("watercolor wash", "isometric vector")'],
        [
          'pipelinePrefs',
          '{ preferred?, recraft?, midjourney? }',
          'Preferred pipeline + per-pipeline knob defaults',
        ],
        ['references', 'array of { ref, kind?, note? }', 'Exemplar asset pointers (URLs, ids)'],
        [
          'provenance',
          '{ source, note?, updatedAt? }',
          'Origin (brand-kit / style-from-images / art-research / manual) + timestamp',
        ],
      ],
    },
    {
      kind: 'bullets',
      items: [
        'Every field except `version` is optional — author a partial profile and fill it in over time.',
        'Read with readStyleProfile, update with the read/merge/write cycle (upsertStyleProfile); writes preserve other project metadata.',
        'Keep pipelinePrefs values consistent with the per-pipeline recipes (e.g. Recraft style/substyle).',
      ],
    },
  ],
};
