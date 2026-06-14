import type { GuidanceEntry } from '../types.js';

/**
 * Concept #14 — image/document file-type reference. This single entry feeds
 * BOTH the MCP resource (limner://reference/file-types) and the CMA file-types
 * skill, proving one guidance source can drive two surfaces without drift.
 */
export const fileTypes: GuidanceEntry = {
  id: 'file-types',
  title: 'Image & document file types',
  summary:
    'Reference matrix for the formats Limner reads and writes — compression, alpha, color model, and typical use.',
  body: [
    {
      kind: 'paragraph',
      text: 'Choosing an output format trades fidelity against size, transparency, and downstream tooling. This matrix covers the raster, vector, and document formats Limner handles.',
    },
    {
      kind: 'table',
      columns: ['Format', 'Compression', 'Alpha', 'Color model', 'Typical use'],
      rows: [
        [
          'PNG',
          'Lossless',
          'Yes',
          'RGB / RGBA',
          'UI assets, screenshots, line art — crisp edges or transparency',
        ],
        [
          'JPEG',
          'Lossy',
          'No',
          'RGB / CMYK',
          'Photographs where small size beats pixel-exactness',
        ],
        [
          'WebP',
          'Lossy or lossless',
          'Yes',
          'RGB / RGBA',
          'Web delivery — smaller than PNG/JPEG at similar quality',
        ],
        [
          'AVIF',
          'Lossy or lossless',
          'Yes',
          'RGB / RGBA',
          'Next-gen web delivery — best compression, newer decoder support',
        ],
        [
          'SVG',
          'Lossless (vector)',
          'Yes',
          'RGB',
          'Icons, logos, diagrams — resolution-independent markup',
        ],
        [
          'TIFF',
          'Lossless or lossy',
          'Yes',
          'RGB / CMYK / grayscale',
          'Print and archival masters; high bit-depth, CMYK separations',
        ],
        [
          'PDF',
          'Mixed (container)',
          'Yes',
          'RGB / CMYK / grayscale',
          'Multi-page, print-ready output: vector + raster + text',
        ],
      ],
    },
    {
      kind: 'bullets',
      items: [
        'Lossless (PNG, SVG, TIFF) preserves every pixel or path; lossy (JPEG) discards detail for size.',
        'Alpha/transparency is available everywhere except baseline JPEG.',
        'CMYK matters for print (JPEG, TIFF, PDF); the web formats are RGB only.',
        'Raster DPI is intrinsic to the pixel grid; SVG and PDF scale without DPI loss.',
      ],
    },
  ],
};
