import type { GuidanceEntry } from '../types.js';

/**
 * Concept #12: print-ready export. A reference-plus-handoff concept: the single
 * source shared by the print-ready resource (limner://reference/print-ready) and
 * the print-ready skill. It leans on limner_upscale to reach print resolution
 * and on the external-tools handoff for the press-specific steps. Limner stays
 * in RGB and does not write press containers, so the entry is deliberately
 * format-agnostic about the upscale output and frames the rest as a handoff.
 */
export const printReady: GuidanceEntry = {
  id: 'print-ready',
  title: 'Print-ready export',
  summary:
    'How to take a Limner asset toward print: upscaling to print resolution, then handing off for CMYK and press formats.',
  body: [
    {
      kind: 'paragraph',
      text: 'Preparing an asset for print is a finishing and handoff workflow, not a single Limner step. Limner generates an RGB raster and enlarges it toward print resolution; the press-specific steps (CMYK color, bleed, and print containers such as TIFF or PDF/X) happen in a desktop print tool. This reference covers what Limner does and where it hands off.',
    },
    { kind: 'heading', level: 2, text: 'Resolution and scale' },
    {
      kind: 'bullets',
      items: [
        'Print targets about 300 dpi at final size, so the pixel size you need is the print size in inches times 300. A 5 by 7 inch print needs roughly 1500 by 2100 px.',
        'The generators top out around 1024 to 1536 px, below most print sizes. Use limner_upscale to enlarge the finished raster toward the pixel size the print needs.',
        'Upscale while the asset is still the working raster, before color conversion and export. For a flat logo, vectorize it instead, since a vector stays sharp at any size.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Where each step happens' },
    {
      kind: 'table',
      columns: ['Step', 'Where it happens'],
      rows: [
        ['Generate the artwork (RGB raster)', 'Limner image pipelines'],
        ['Enlarge toward 300 dpi at final size', 'Limner (limner_upscale)'],
        ['Convert RGB to CMYK', 'Desktop print tool (Limner stays in RGB)'],
        ['Add bleed, crop marks, and trim', 'Layout tool'],
        ['Export TIFF or PDF/X', 'Desktop print tool'],
      ],
    },
    { kind: 'heading', level: 2, text: 'The handoff' },
    {
      kind: 'bullets',
      items: [
        'Limner works in RGB and outputs PNG, JPEG, WebP, and SVG. It does not convert color spaces or write press containers, so the CMYK conversion and the TIFF or PDF/X export are done downstream.',
        'Hand the upscaled asset to a desktop editor (Affinity Photo or Publisher, or GIMP) for CMYK conversion, soft-proofing, bleed, and the final press export. The external-tools reference lists the handoff targets.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Confirm the printer’s requirements first (size, resolution, color profile, bleed, and file format), since they set the pixel size to upscale to and the container to export. Limner gives the print tool a clean, high-resolution RGB source; the press-ready file comes out of that tool, not Limner alone.',
    },
  ],
};
