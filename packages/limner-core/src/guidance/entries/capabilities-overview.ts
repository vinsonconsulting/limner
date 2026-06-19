import type { GuidanceEntry } from '../types.js';

/**
 * Concept #11: capability overview. Feeds the MCP `capability-tour` prompt.
 * An A4-framed summary of the rasa surface.
 */
export const capabilitiesOverview: GuidanceEntry = {
  id: 'capabilities-overview',
  title: 'Limner capability overview',
  summary:
    'A guided tour of what Limner can do: image generation, composition, and project memory.',
  body: [
    {
      kind: 'paragraph',
      text: 'Limner is an image-generation toolkit exposed over the Model Context Protocol. It wraps third-party generation backends and a self-contained composition stack behind a single tool surface, and remembers context across a project.',
    },
    { kind: 'heading', level: 2, text: 'Generation pipelines' },
    {
      kind: 'bullets',
      items: [
        'Midjourney: stylized, painterly image generation.',
        'DALL·E: OpenAI image generation from text prompts.',
        'Recraft: vector and raster generation with brand-style control.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Each pipeline also accepts an existing image as input by URL, so you can vary or restyle prior work instead of generating from text alone. Midjourney takes it as an image prompt or a style or character reference, DALL·E as an edit or restyle, and Recraft as image-to-image.',
    },
    { kind: 'heading', level: 2, text: 'Composition' },
    {
      kind: 'paragraph',
      text: 'A WASM-backed compose stack handles decode/encode across formats, resizing and fitting, typographic overlays (Satori + resvg), and Cloudflare Images transforms, with no native binaries required.',
    },
    { kind: 'heading', level: 2, text: 'Post-processing' },
    {
      kind: 'bullets',
      items: [
        'Upscale: enlarge and sharpen a raster image toward print scale. The generators top out around 1024 to 1536 px, so upscaling lifts a finished asset to a size that holds up at 300 dpi.',
        'Vectorize: trace a raster image into a scalable SVG, so a logo or icon stays crisp at any size and is ready for editing in a vector tool.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Memory & projects' },
    {
      kind: 'paragraph',
      text: 'Memory and project stores persist notes, recalls, and per-project context (D1 in Workers, local SQLite for stdio) so successive requests build on earlier work.',
    },
    { kind: 'heading', level: 2, text: 'Going deeper' },
    {
      kind: 'bullets',
      items: [
        'Per-pipeline prompt recipes cover the knobs in detail: Midjourney (--ar / --stylize / --chaos / --seed), DALL·E (background / format / size / quality, text-in-image), and Recraft (style vs. substyle, vector-from-scratch). Each recipe also covers passing an existing image as input.',
        'For manual retouching, vector authoring, or print prep, Limner hands off to desktop editors: GIMP, the Affinity suite, Inkscape, and Krita.',
        'The file-types reference helps pick the right output format for each downstream tool.',
      ],
    },
  ],
};
