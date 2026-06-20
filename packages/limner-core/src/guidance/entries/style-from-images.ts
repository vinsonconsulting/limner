import type { GuidanceEntry } from '../types.js';

/**
 * Concept #15: style from user images. The single source shared by the
 * style-from-images prompt and skill. It leans on two existing capabilities:
 * native image input on the generators (#64, image-by-URL) and the shared
 * style-profile schema (style-profile entry / style-profile/store.ts). It does
 * not redefine the profile shape; it references it and records into it with
 * provenance.source = 'style-from-images'.
 */
export const styleFromImages: GuidanceEntry = {
  id: 'style-from-images',
  title: 'Style from user images',
  summary:
    'How to capture the style of a user’s own reference images with Limner: describing them into a style profile and matching them with native image input.',
  body: [
    {
      kind: 'paragraph',
      text: 'When a user brings their own images (a moodboard, brand assets, sample work) and wants new work to match, Limner has two ways to carry the style across. You describe the references into a style profile so the look is reusable, and you pass a reference image to a generator directly so it borrows the look without words. Use them together: describe for a consistent batch, pass the image for a close one-off match.',
    },
    { kind: 'heading', level: 2, text: 'Describe the references into a profile' },
    {
      kind: 'bullets',
      items: [
        'Look at the user’s images and name what defines the style: the palette (a few hex colors), the descriptors (keywords such as flat, cinematic, noir), and the medium (watercolor wash, isometric vector).',
        'Write them to the project’s style profile with upsertStyleProfile, set provenance.source to style-from-images, and list the user’s images under references (kind image) so the origin is recorded.',
        'The profile is the shared shape the brand-kit and art-research surfaces also read, so a style captured here flows into later work without re-describing it.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Match with native image input' },
    {
      kind: 'bullets',
      items: [
        'Pass a reference image by URL straight to a generator to borrow its look: a Midjourney style reference (--sref), a DALL·E edit, or a Recraft image-to-image. Use a fetchable URL, not inline data.',
        'Image input matches a single reference closely; the described profile keeps a whole set consistent. For a batch in the user’s style, set the profile first, then generate each piece.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Generate in the captured style' },
    {
      kind: 'bullets',
      items: [
        'Shape each prompt from the profile’s descriptors and medium, and set pipelinePrefs (the preferred pipeline and its knob defaults) so the batch stays consistent.',
        'Hold the palette and descriptors fixed across the set and vary only the subject, the same discipline as a brand kit.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Reading the user’s images is a judgment step: capture the few attributes that actually define the look rather than every detail, since a tight profile generates more consistently than a long one.',
    },
  ],
};
