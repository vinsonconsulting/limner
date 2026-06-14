import type { GuidanceEntry } from '../types.js';

/**
 * Concept #4 — Recraft prompt recipe. The single source shared by the Recraft
 * concept's prompt and skill. Knob names and values mirror @limner/core's
 * RecraftOptions (pipelines/recraft.ts), a composed-MCP adapter over Recraft's
 * first-party tools. Recraft is the pipeline that generates true vector (SVG)
 * art from scratch.
 */
export const recraftRecipe: GuidanceEntry = {
  id: 'recraft-recipe',
  title: 'Recraft prompt recipe',
  summary:
    'How to drive Limner’s Recraft pipeline — choosing style vs. substyle and generating vector (SVG) art from scratch with brand-consistent control.',
  body: [
    {
      kind: 'paragraph',
      text: 'Recraft is Limner’s brand-and-vector pipeline: it generates raster or true vector (SVG) art and supports fine style control. Its defining feature is vector-from-scratch — pick a vector style and Recraft produces resolution-independent SVG you can refine in a vector editor (see the external-tools reference). Style is the broad family; substyle narrows it.',
    },
    { kind: 'heading', level: 2, text: 'Parameters' },
    {
      kind: 'table',
      columns: ['Knob', 'Values', 'Effect'],
      rows: [
        [
          'style',
          'digital_illustration, vector_illustration, realistic_image',
          'Broad output family; vector_illustration yields SVG',
        ],
        [
          'substyle',
          'style-specific string (e.g. pixel_art, hand_drawn, line_art)',
          'Narrows the chosen style; must be valid for that style',
        ],
        ['model', 'recraftv3 (default-era), recraftv2', 'Generation model version'],
        ['size', '1024x1024, 1365x1024, 1024x1365', 'Output dimensions / orientation'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Vector from scratch' },
    {
      kind: 'bullets',
      items: [
        'Choose style `vector_illustration` to get SVG output rather than a raster — ideal for logos, icons, and scalable brand art.',
        'Pick `style` first (the family), then a `substyle` that exists within it; an unmatched substyle is rejected upstream.',
        'For brand consistency, keep style/substyle fixed across a set and vary only the prompt subject.',
        'Hand the SVG off to Inkscape or Affinity Designer for path cleanup and print prep.',
      ],
    },
  ],
};
