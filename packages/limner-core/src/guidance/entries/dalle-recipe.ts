import type { GuidanceEntry } from '../types.js';

/**
 * Concept #3 — DALL·E prompt recipe. The single source shared by the DALL·E
 * concept's prompt and skill. Knob names and constraints mirror @limner/core's
 * DalleOptions (pipelines/dalle.ts), which calls OpenAI's Images API. The
 * default model is gpt-image-1; several knobs (quality, outputFormat,
 * background) are gpt-image-1 only.
 */
export const dalleRecipe: GuidanceEntry = {
  id: 'dalle-recipe',
  title: 'DALL·E prompt recipe',
  summary:
    'How to drive Limner’s DALL·E pipeline — gpt-image-1 by default — covering background, output format, size, quality, and reliable text-in-image.',
  body: [
    {
      kind: 'paragraph',
      text: 'Limner’s DALL·E pipeline calls OpenAI’s Images API, defaulting to the gpt-image-1 model. Write a descriptive prompt — gpt-image-1 follows detailed instructions closely and renders legible text in the image far better than earlier models — then set the knobs below. Note that OpenAI’s 2025/2026 consolidation removed the legacy `style` and `response_format` parameters and dall-e-3’s quality values; Limner does not send them.',
    },
    { kind: 'heading', level: 2, text: 'Parameters' },
    {
      kind: 'table',
      columns: ['Knob', 'Values', 'Applies to', 'Notes'],
      rows: [
        [
          'model',
          'gpt-image-1 (default), dall-e-3, dall-e-2',
          'all',
          'gpt-image-1 has the best prompt-following and in-image text',
        ],
        [
          'size',
          '1024x1024, 1024x1536, 1536x1024, auto',
          'gpt-image-1',
          'dall-e-3: 1024x1024 / 1792x1024 / 1024x1792',
        ],
        ['quality', 'low, medium, high, auto', 'gpt-image-1 only', 'Detail vs. cost/latency'],
        ['outputFormat', 'png, jpeg, webp', 'gpt-image-1 only', 'Defaults to png server-side'],
        [
          'background',
          'auto, transparent, opaque',
          'gpt-image-1 only',
          'transparent requires outputFormat png or webp',
        ],
      ],
    },
    { kind: 'heading', level: 2, text: 'Text in image' },
    {
      kind: 'bullets',
      items: [
        'Quote the exact words to render and where they go ("the word OPEN in bold serif, centered").',
        'Keep rendered text short; long passages still degrade. Verify spelling in the result.',
        'For logos and UI mockups, pair transparent background with png/webp so the mark drops onto any surface.',
        'Choose webp or jpeg over png when file size matters and transparency is not needed.',
      ],
    },
  ],
};
