import type { GuidanceEntry } from '../types.js';

/**
 * Concept #2: Midjourney prompt recipe. The single source shared by the
 * Midjourney concept's prompt and skill. Knob names and ranges mirror
 * @limner/core's MidjourneyOptions (pipelines/midjourney.ts), which composes
 * the final prompt string the user pastes into Midjourney; Limner does not
 * call an upstream API for this pipeline.
 */
export const midjourneyRecipe: GuidanceEntry = {
  id: 'midjourney-recipe',
  title: 'Midjourney prompt recipe',
  summary:
    'How to build a Midjourney prompt with Limner: subject and style first, then the parameter flags (--ar, --stylize, --chaos, --seed) the pipeline appends.',
  body: [
    {
      kind: 'paragraph',
      text: 'Midjourney rewards a concrete subject plus a style direction, followed by parameter flags. Limner composes the prompt string for you from the subject and the options below; you paste the result into Midjourney. Lead with the subject, add medium and mood, then let the flags tune ratio and variation.',
    },
    { kind: 'heading', level: 2, text: 'Structure' },
    {
      kind: 'bullets',
      items: [
        'Subject: the concrete thing, stated plainly ("a weathered brass compass on a sea chart").',
        'Style & medium: art movement, lighting, lens, palette ("cinematic, volumetric light, 35mm").',
        'Negatives: terms to exclude, emitted as `--no a, b` (merged from the negative prompt and the `no` list).',
        'Parameters: the flags below, appended automatically in a stable order.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Parameters' },
    {
      kind: 'table',
      columns: ['Knob', 'Flag', 'Range / values', 'Effect'],
      rows: [
        ['aspectRatio', '--ar', 'N:N (e.g. 16:9, 1:1, 3:2)', 'Output proportions'],
        [
          'version',
          '--v / --niji',
          'v5, v5.1, v5.2, v6, v6.1, v7, niji-5, niji-6',
          'Model; niji-* routes to the anime-tuned --niji',
        ],
        [
          'style',
          '--style',
          'raw, cute, expressive, original, scenic (or freeform)',
          'Aesthetic preset; raw reduces Midjourney’s default styling',
        ],
        ['stylize', '--stylize', '0-1000', 'Strength of Midjourney’s house aesthetic'],
        ['chaos', '--chaos', '0-100', 'Variation across the initial grid'],
        ['weird', '--weird', '0-3000', 'Unconventional, experimental aesthetics'],
        ['quality', '--q', '0.25, 0.5, 1, 2', 'Render effort vs. speed/cost'],
        ['tile', '--tile', 'on/off', 'Seamless repeating pattern'],
        ['seed', '--seed', 'integer', 'Reproducibility; reuse a seed to vary one image'],
      ],
    },
    {
      kind: 'bullets',
      items: [
        'Start at default stylize and chaos; raise stylize for more polish, chaos for more divergent options.',
        'Pin a seed once you find a composition you like, then iterate other knobs around it.',
        'The option-level seed wins over the generic seed when both are set.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Image reference' },
    {
      kind: 'paragraph',
      text: 'Midjourney can take an existing image as part of the prompt. Pass a fetchable URL, not inline data. An image URL leads the prompt as an image prompt, while the reference flags below point at separate URLs for style or character.',
    },
    {
      kind: 'table',
      columns: ['Knob', 'Flag', 'Value', 'Effect'],
      rows: [
        [
          'image',
          '(image prompt)',
          'URL',
          'Composed at the start of the prompt to steer subject and composition',
        ],
        [
          'imageWeight',
          '--iw',
          '0-3 (default 1)',
          'How strongly the image prompt counts against the text',
        ],
        [
          'styleRef',
          '--sref',
          'URL',
          'Style reference: borrow palette, texture, and rendering from another image',
        ],
        [
          'omniRef',
          '--oref',
          'URL (v7)',
          'Omni reference: carry a character or object across generations (version 7)',
        ],
      ],
    },
    {
      kind: 'bullets',
      items: [
        'Lead with an image prompt to anchor composition, then raise or lower --iw to trade the image against the text.',
        'Use --sref to transfer a look without copying content, and --oref (v7) to keep a recurring character or object consistent.',
        'There is no --iref flag: style and character references are --sref and --oref.',
      ],
    },
  ],
};
