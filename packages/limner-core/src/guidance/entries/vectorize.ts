import type { GuidanceEntry } from '../types.js';

/**
 * Concept #13: vectorize. The single source shared by the vectorize prompt and
 * skill. It wraps the limner_vectorize tool (tools/pipelines.ts ->
 * RestRecraftTransport.vectorizeImage), a paid Recraft call that takes a source
 * image by URL and returns an SVG through a capability URL. Verified with a live
 * vectorize smoke during authoring.
 */
export const vectorize: GuidanceEntry = {
  id: 'vectorize',
  title: 'Vectorize a raster image',
  summary:
    'How to trace a raster image into a scalable SVG with Limner’s vectorize tool, and when a vector beats a raster.',
  body: [
    {
      kind: 'paragraph',
      text: 'Vectorizing traces a raster image (a PNG or JPEG) into a scalable SVG made of paths, so a logo, icon, or flat illustration stays crisp at any size and can be edited in a vector tool. Limner does this with the limner_vectorize tool, a paid Recraft call: it takes a source image by URL and returns an SVG.',
    },
    { kind: 'heading', level: 2, text: 'When to vectorize' },
    {
      kind: 'bullets',
      items: [
        'Vectorize flat graphics: logos, icons, monograms, simple illustrations, and line art. These trace cleanly into a small set of paths.',
        'Do not vectorize photographs or richly shaded images. Tracing them yields a heavy, messy SVG that is larger and worse than the raster; upscale those instead.',
        'When you control the source, prefer generating vector from the start with Recraft (the vector_illustration style) rather than tracing a raster afterward. Vectorize is for rasters you already have.',
      ],
    },
    { kind: 'heading', level: 2, text: 'How it works' },
    {
      kind: 'bullets',
      items: [
        'Pass the source image by URL (for example an artifact URL from a prior generation), not inline data. The tool fetches it server-side.',
        'The result is an SVG delivered through its capability URL, ready to refine in a vector editor or drop into a UI.',
        'It is a paid Recraft call, so vectorize once you have the raster you want, not on every draft.',
      ],
    },
    { kind: 'heading', level: 2, text: 'After vectorizing' },
    {
      kind: 'paragraph',
      text: 'Hand the SVG off to a vector editor (Inkscape, Affinity Designer) for path cleanup, or use it directly where scalability matters: favicons, app icons, and print. For a raster export at a fixed size, render the SVG back out through compose.',
    },
  ],
};
