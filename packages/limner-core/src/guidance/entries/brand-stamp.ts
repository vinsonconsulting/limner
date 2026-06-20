import type { GuidanceEntry } from '../types.js';

/**
 * Concept #5: brand stamp and watermark. The single source shared by the
 * brand-stamp prompt and skill. Facts mirror the compose stack's `watermark`
 * op (photon-ops.ts) and the Cloudflare Images draw path (cf-images-transform.ts):
 * the local op composites an overlay at a pixel offset with no opacity, scale,
 * or tiling knob, so the recipe is to size and fade the mark before compositing.
 */
export const brandStamp: GuidanceEntry = {
  id: 'brand-stamp',
  title: 'Brand stamp and watermark',
  summary:
    'How to stamp a logo or watermark onto an image with Limner’s compose stack: placing the overlay, sizing it, handling transparency, and delivering one asset.',
  body: [
    {
      kind: 'paragraph',
      text: 'A brand stamp places a logo or a watermark onto a finished image. Limner does this with the compose tool’s watermark op, which composites one image onto another at a pixel offset. The overlay keeps its own transparency, so a mark on a transparent background drops in cleanly. The op has no separate opacity, scale, or tiling control, so you size and fade the mark before compositing it.',
    },
    { kind: 'heading', level: 2, text: 'The watermark op' },
    {
      kind: 'table',
      columns: ['Field', 'Meaning'],
      rows: [
        ['base', 'The image to stamp'],
        ['overlay', 'The mark to place on top; its transparent areas let the base show through'],
        ['x', 'Horizontal offset from the top-left, in pixels (a negative value bleeds off the left)'],
        ['y', 'Vertical offset from the top-left, in pixels (a negative value bleeds off the top)'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Placing the mark' },
    {
      kind: 'bullets',
      items: [
        'Position is a pixel offset from the top-left, not a named corner. Compute the corner you want from the sizes: top-left is (margin, margin); bottom-right is (baseWidth minus overlayWidth minus margin, baseHeight minus overlayHeight minus margin).',
        'Size the mark first. The op places the overlay as-is, so resize the overlay with the compose resize op to the fraction of the base you want (a corner mark is usually 10 to 20 percent of the width).',
        'Keep the mark on a transparent background so only the logo shows, not a box around it. The op places the mark once; it does not tile a repeated pattern.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Transparency' },
    {
      kind: 'bullets',
      items: [
        'The overlay keeps its own alpha, so a logo exported on a transparent background composites cleanly over the base.',
        'For a faded watermark, bake the opacity into the mark before compositing (export the logo at reduced opacity), since the watermark op itself takes no opacity value.',
        'On Workers, the Cloudflare Images path (cfTransform with a draw layer) accepts an opacity from 0 to 1 if you need to fade at compose time. That path needs the Images binding and is not available in local runs.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Text watermarks' },
    {
      kind: 'paragraph',
      text: 'For a text watermark such as a DRAFT banner or a copyright line, render the text first with the renderText op onto a transparent canvas in a server-side font, then composite that result with the watermark op. Set a low-alpha color in the text style for a faded look.',
    },
    { kind: 'heading', level: 2, text: 'Delivering' },
    {
      kind: 'paragraph',
      text: 'Compose runs locally with no per-call cost and returns PNG by default. Convert the result to JPEG or WebP afterward if file size matters, then deliver it through its capability URL so the stamped image is a single fetchable asset. Keep the mark small and in a consistent corner across a set so it reads as a stamp rather than a focal point.',
    },
  ],
};
