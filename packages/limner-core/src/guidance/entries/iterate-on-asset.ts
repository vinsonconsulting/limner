import type { GuidanceEntry } from '../types.js';

/**
 * Concept #10: iterate on a prior asset. A skill-only concept: the single
 * source for the iterate-on-asset skill. Facts mirror the memory/project tools
 * (tools/memory.ts, tools/context.ts) and the URL-based image input on the
 * generators (#64). The honest constraint that shapes the whole concept:
 * generations are NOT auto-persisted (no generations table, no fetch-prior tool),
 * so recall depends on notes the agent records itself.
 */
export const iterateOnAsset: GuidanceEntry = {
  id: 'iterate-on-asset',
  title: 'Iterate on a prior asset',
  summary:
    'How to recall a previous generation and vary, restyle, or post-process it with Limner, using the memory and project notes you record as you go.',
  body: [
    {
      kind: 'paragraph',
      text: 'Iterating means taking a generation you made earlier and producing the next version: a variation, a restyle, or a finished export. Two facts shape how this works in Limner. First, every generation returns a fetchable capability URL, so a prior asset can feed straight back into a generator as image input. Second, Limner does not save generations automatically, so to recall one later you record it yourself as a note. The discipline of recording is what makes iteration possible.',
    },
    { kind: 'heading', level: 2, text: 'Record as you generate' },
    {
      kind: 'bullets',
      items: [
        'After a generation worth keeping, write a note with limner_record (a memory entry) or limner_record_project_note (scoped to a project). Put the asset URL, the prompt, the pipeline, and the key parameters in the note so a later recall has everything it needs.',
        'Use a category on memory entries (for example "generation") so you can filter to them later, and give a project note its projectId so it lands in the right project.',
        'Nothing is recorded for you. A generation you do not note is not recoverable beyond the current turn.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Recall the prior asset' },
    {
      kind: 'bullets',
      items: [
        'For loose history, search memory with limner_recall by text query, category, or time window. For project work, read limner_get_project_context by project id or name to get the recent notes.',
        'Read the asset URL and the original prompt and parameters back out of the note. There is no structured generation record, so you parse what you recorded.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Vary, restyle, or finish' },
    {
      kind: 'bullets',
      items: [
        'To vary or restyle, pass the recalled URL as image input to a generator (a DALL·E edit, a Recraft image-to-image, or a Midjourney image prompt) and describe the change. The URL is fetchable on its own, so the generator pulls it directly.',
        'To make a small change in the same style, re-run the same pipeline with the recalled prompt and parameters, adjusting only what should change. Reusing a Midjourney seed, for example, holds the composition while you vary other knobs.',
        'To finish rather than change, post-process the recalled asset: upscale it for print, vectorize it to SVG, or compose a crop, caption, or stamp.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Close the loop' },
    {
      kind: 'paragraph',
      text: 'Record the new asset the same way, noting that it derives from the prior one, so the next iteration can recall it in turn. A short, consistent note format (URL, prompt, pipeline, parameters) keeps a project’s history easy to walk.',
    },
  ],
};
