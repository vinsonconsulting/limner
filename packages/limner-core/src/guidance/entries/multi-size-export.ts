import type { GuidanceEntry } from '../types.js';

/**
 * Concept #6: multi-size and format export. The single source shared by the
 * multi-size-export prompt and skill. Facts mirror the compose stack's resize
 * and convert ops (compose.ts): local resize fits with `cover` only (it fills
 * the box and crops overflow), formats are jpeg/png/webp/avif with a 1..100
 * quality, and the letterbox fits (contain/pad) live on the Workers Cloudflare
 * Images path. No new capability; this entry sequences existing ops into an
 * export set.
 */
export const multiSizeExport: GuidanceEntry = {
  id: 'multi-size-export',
  title: 'Multi-size and format export',
  summary:
    'How to export one image at the sizes and formats web, app, and social destinations need, using Limner’s compose resize and convert ops with the right fit and format per target.',
  body: [
    {
      kind: 'paragraph',
      text: 'A multi-size export turns one finished image into the set of sizes and formats each destination expects. Limner does this with the compose resize and convert ops, emitting each variant as its own asset. Decide the target sizes and the format for each destination, resize to each, convert, and deliver the set.',
    },
    { kind: 'heading', level: 2, text: 'Common targets' },
    {
      kind: 'table',
      columns: ['Destination', 'Typical size and aspect', 'Format'],
      rows: [
        ['Web hero or social card', '1200 x 630 (about 1.91:1)', 'WebP or JPEG'],
        ['Square social post', '1080 x 1080 (1:1)', 'JPEG or PNG'],
        ['Story or reel', '1080 x 1920 (9:16)', 'JPEG'],
        ['App icon', 'Square, exported at 1x and 2x (for example 512 and 1024)', 'PNG'],
        ['Favicon or thumbnail', 'Small square (for example 256 or 64)', 'PNG or WebP'],
      ],
    },
    {
      kind: 'paragraph',
      text: 'Treat these as starting points and confirm the current spec for each platform, since social dimensions change over time.',
    },
    { kind: 'heading', level: 2, text: 'Resizing and fit' },
    {
      kind: 'bullets',
      items: [
        'Local resize fills the target box and crops the overflow (the cover fit). Confirm the source aspect matches the target, or expect a crop at the edges.',
        'To keep the whole image without cropping (letterbox or pad), use the Cloudflare Images transform with the contain or pad fit. That path runs on Workers only.',
        'When the source aspect already matches the target, cover and contain agree, so the local resize is enough.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Choosing the format' },
    {
      kind: 'bullets',
      items: [
        'WebP or AVIF for the smallest web and app payloads.',
        'PNG when you need transparency or a crisp interface mark.',
        'JPEG for broad-compatibility photographs.',
        'Set the quality from 1 to 100 on convert to trade file size against fidelity: lower it for thumbnails, keep it high for hero images.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Delivering the set' },
    {
      kind: 'paragraph',
      text: 'Compose runs locally with no per-call cost. Resize from the largest size first so every smaller variant stays consistent, then emit each variant through its own capability URL named by destination and size, so the set is easy to hand off.',
    },
  ],
};
