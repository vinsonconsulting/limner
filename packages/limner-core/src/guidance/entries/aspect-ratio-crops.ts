import type { GuidanceEntry } from '../types.js';

/**
 * Concept #8: aspect-ratio crop set. A prompt-only concept (no skill): the
 * single source for the aspect-ratio-crops prompt. Facts mirror the compose
 * stack's crop op (photon-ops.ts, a rectangle from the top-left), the resize
 * cover fit, and the Workers-only cfSmartCrop (cf-images-transform.ts). No new
 * capability; it sequences existing crops into a placement set.
 */
export const aspectRatioCrops: GuidanceEntry = {
  id: 'aspect-ratio-crops',
  title: 'Aspect-ratio crop set',
  summary:
    'How to produce one image at several aspect ratios for different placements with Limner, cropping locally or with Workers subject-aware crop.',
  body: [
    {
      kind: 'paragraph',
      text: 'An aspect-ratio crop set takes one image and produces it at the ratios different placements expect: square for posts, vertical for stories, wide for video, portrait for feeds. Limner crops with the compose crop op, where you choose the rectangle, or on Workers with cfSmartCrop, which keeps the subject automatically.',
    },
    { kind: 'heading', level: 2, text: 'Common ratios' },
    {
      kind: 'table',
      columns: ['Ratio', 'Shape', 'Typical placement'],
      rows: [
        ['1:1', 'Square', 'Feed posts, avatars, thumbnails'],
        ['4:5', 'Portrait', 'Portrait feed posts'],
        ['9:16', 'Tall', 'Stories, reels, vertical video'],
        ['16:9', 'Wide', 'Video, slides, headers'],
        ['1.91:1', 'Wide card', 'Link previews and social cards'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Cropping locally' },
    {
      kind: 'bullets',
      items: [
        'The crop op takes a rectangle (x, y, width, height) from the top-left. Compute the largest rectangle of the target ratio that fits the source, then offset it to keep the focal point; centering is the safe default.',
        'To change the ratio and set a pixel size in one step, the resize op fills a target box (the cover fit) and crops the overflow. Use it when you also want a specific output size.',
        'The crop op does not choose the subject for you. Set x and y so the focal point survives the crop, since a tall crop of a wide photo drops the sides and a wide crop of a tall photo drops the top and bottom.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Subject-aware cropping (Workers)' },
    {
      kind: 'paragraph',
      text: 'On Workers, cfSmartCrop takes a target width and height and chooses a content-aware crop that keeps the main subject in frame. It needs the Cloudflare Images binding and is not available in local runs, so reach for it when the subject sits off-center and a fixed rectangle would clip it.',
    },
    { kind: 'heading', level: 2, text: 'Delivering the set' },
    {
      kind: 'paragraph',
      text: 'Compose runs locally with no per-call cost. Crop from the highest-resolution source so each ratio keeps as much detail as possible, then emit each crop through its own capability URL named by ratio so the set is easy to place.',
    },
  ],
};
