import type { GuidanceEntry } from '../types.js';

/**
 * Concept #1: pipeline router. Routing judgment over the existing generation
 * pipelines and post-processing tools, with no new dependency. The single
 * source shared by the pipeline-router skill (the routing procedure) and its
 * thin launch prompt. Every fact here is drawn from the per-pipeline recipes
 * (midjourney/dalle/recraft) and the capabilities overview; this entry adds no
 * new capability, only the decision of which one to use.
 */
export const pipelineRouter: GuidanceEntry = {
  id: 'pipeline-router',
  title: 'Pipeline router',
  summary:
    'How to choose the right Limner pipeline for an asset, matching output kind, cost, and speed to Midjourney, DALL·E, or Recraft, then finishing with post-processing.',
  body: [
    {
      kind: 'paragraph',
      text: 'Limner exposes three generation pipelines and a set of post-processing tools behind one surface. The right choice depends on what the asset is, what it costs, and how fast you need it. Decide the output kind first (vector or raster, text in the image or not, transparent background or not); cost and speed break the ties.',
    },
    { kind: 'heading', level: 2, text: 'Pipelines at a glance' },
    {
      kind: 'table',
      columns: ['Pipeline', 'Best for', 'Output', 'Cost and speed'],
      rows: [
        [
          'Midjourney',
          'Stylized, painterly, art-directed imagery; mood and atmosphere',
          'A prompt string you run in your own Midjourney account',
          'No Limner API charge; you generate it in your Midjourney subscription and bring the result back by hand',
        ],
        [
          'DALL·E (gpt-image-1)',
          'Prompt-faithful images, legible text in the image, transparent-background marks, edits and restyles',
          'Raster (PNG, JPEG, or WebP) up to 1536 px',
          'Billed per call to OpenAI; returned directly',
        ],
        [
          'Recraft',
          'True vector (SVG) art, logos, icons, and brand-consistent sets',
          'Vector (SVG) or raster up to 1365 px',
          'Billed per call to Recraft; returned directly',
        ],
      ],
    },
    { kind: 'heading', level: 2, text: 'Choosing by requirement' },
    {
      kind: 'bullets',
      items: [
        'A scalable logo, icon, or editable vector: Recraft with the vector_illustration style.',
        'Readable words inside the image: DALL·E (gpt-image-1), which renders in-image text far better than the others.',
        'A transparent background: DALL·E or Recraft. Midjourney cannot return one.',
        'Painterly, art-directed mood when you have a Midjourney subscription to run: Midjourney, which also shifts the cost off the Limner API.',
        'Editing or restyling an existing image: all three accept an image by URL, so pick by output kind (a DALL·E edit, a Recraft image-to-image, or a Midjourney image prompt with --sref or --oref).',
      ],
    },
    { kind: 'heading', level: 2, text: 'Finishing the asset' },
    {
      kind: 'bullets',
      items: [
        'The generators top out around 1024 to 1536 px, so upscale a finished raster toward 300 dpi when it has to hold up at print scale.',
        'Vectorize a raster logo or icon into SVG when you need it crisp at any size or editable in a vector tool. When you can, generate vector directly in Recraft from the start instead.',
        'Compose converts formats, resizes, overlays, and sets text with no per-call cost, so reach for it before paying for another generation.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'When two pipelines both fit, prefer the one whose native output needs the least post-processing. A vector asked of Recraft beats a raster you then have to trace, and text rendered by DALL·E beats text you would otherwise composite by hand.',
    },
  ],
};
