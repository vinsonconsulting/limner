import type { GuidanceEntry } from '../types.js';

/**
 * Concept #3: DALL·E prompt recipe. The single source shared by the DALL·E
 * concept's prompt and skill. Knob names and constraints mirror @limner/core's
 * DalleOptions (pipelines/dalle.ts), which calls OpenAI's Images API. The
 * default model is gpt-image-1; the quality, outputFormat, and background
 * knobs apply across the gpt-image family.
 */
export const dalleRecipe: GuidanceEntry = {
  id: 'dalle-recipe',
  title: 'DALL·E prompt recipe',
  summary:
    'How to drive Limner’s DALL·E pipeline (gpt-image-1 by default), covering background, output format, size, quality, and reliable text-in-image.',
  body: [
    {
      kind: 'paragraph',
      text: 'Limner’s DALL·E pipeline calls OpenAI’s Images API, defaulting to the gpt-image-1 model. Write a descriptive prompt: gpt-image-1 follows detailed instructions closely and renders legible text in the image far better than earlier models. Then set the knobs below. Note that OpenAI’s 2025/2026 consolidation retired DALL·E 2/3 and removed the legacy `style` and `response_format` parameters; Limner does not send them.',
    },
    { kind: 'heading', level: 2, text: 'Parameters' },
    {
      kind: 'table',
      columns: ['Knob', 'Values', 'Applies to', 'Notes'],
      rows: [
        [
          'model',
          'gpt-image-1 (default), gpt-image-1-mini, gpt-image-1.5, gpt-image-2',
          'all',
          'gpt-image-1 has the best prompt-following and in-image text',
        ],
        [
          'size',
          '1024x1024, 1024x1536, 1536x1024, auto',
          'all',
          'Square, portrait, landscape, or auto',
        ],
        ['quality', 'low, medium, high, auto', 'all', 'Detail vs. cost/latency'],
        ['outputFormat', 'png, jpeg, webp', 'all', 'Defaults to png server-side'],
        [
          'background',
          'auto, transparent, opaque',
          'all',
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
    { kind: 'heading', level: 2, text: 'Image input' },
    {
      kind: 'paragraph',
      text: 'Pass a source image by URL to edit or restyle it instead of generating from scratch. Limner routes the request to the image-edit endpoint, which keeps the subject and layout while applying your prompt. Use a fetchable URL, not inline data.',
    },
    {
      kind: 'bullets',
      items: [
        'Provide the image as a URL (for example an artifact URL from a prior generation), then describe the change in the prompt.',
        'The edit preserves the source likeness and composition; use it to recolor, restyle, or extend an existing image rather than start over.',
        'The size, quality, output format, and background knobs apply to edits just as they do to fresh generations.',
      ],
    },
  ],
};
