import type { GuidanceEntry } from '../types.js';

/**
 * Concept #16 — external editor reference. Limner generates and composes, but
 * hands off to a desktop editor when a task wants manual retouching, vector
 * authoring, or print prep. This entry is the shared source for the editor
 * handoff guidance consumed by the export/handoff concepts (#12/#13).
 */
export const externalTools: GuidanceEntry = {
  id: 'external-tools',
  title: 'External editors & handoff targets',
  summary:
    'Reference for the desktop editors Limner hands off to — GIMP, the Affinity suite, Inkscape, and Krita — and the task each is suited to.',
  body: [
    {
      kind: 'paragraph',
      text: 'Limner produces and composes assets, then hands off to a desktop editor when a task needs manual work it does not perform itself: pixel-level retouching, precise vector authoring, multi-page print layout, or natural-media painting. Pick the target by the job, then export from Limner in the format that editor reads best (see the file-types reference).',
    },
    {
      kind: 'table',
      columns: ['Editor', 'Kind', 'Best for', 'Reads / writes', 'Cost'],
      rows: [
        [
          'GIMP',
          'Raster',
          'Photo retouching, masking, filters, format conversion',
          'PNG, JPEG, WebP, TIFF, native XCF',
          'Free / open source',
        ],
        [
          'Affinity Photo',
          'Raster',
          'Professional photo editing and compositing with CMYK + print output',
          'PNG, JPEG, TIFF, PSD, PDF, native .afphoto',
          'Paid (one-time)',
        ],
        [
          'Affinity Designer',
          'Vector + raster',
          'Brand/logo work, illustration, print-ready vector with CMYK',
          'SVG, PDF, EPS, PSD, native .afdesign',
          'Paid (one-time)',
        ],
        [
          'Inkscape',
          'Vector',
          'SVG authoring and cleanup, path editing, icons and diagrams',
          'SVG (native), PDF, EPS, PNG export',
          'Free / open source',
        ],
        [
          'Krita',
          'Raster (paint)',
          'Digital painting and natural-media illustration with brush engines',
          'PNG, JPEG, TIFF, PSD, native .kra',
          'Free / open source',
        ],
      ],
    },
    {
      kind: 'bullets',
      items: [
        'Need pixels touched up or a photo composited? Hand off to GIMP (free) or Affinity Photo (print/CMYK).',
        'Need a logo, icon, or diagram refined as paths? Hand off to Inkscape (free) or Affinity Designer (CMYK print).',
        'Need hand-painted illustration on top of a generation? Hand off to Krita.',
        'Match the export format to the target: SVG for vector editors, layered PSD/TIFF for raster compositing, PDF for print prep.',
      ],
    },
  ],
};
