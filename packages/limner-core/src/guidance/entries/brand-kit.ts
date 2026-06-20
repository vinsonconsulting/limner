import type { GuidanceEntry } from '../types.js';

/**
 * Concept #9: brand kit. A skill-only concept: the single source for the
 * brand-kit skill. It reads and writes the shared style-profile (style-profile
 * entry / style-profile/store.ts) with provenance.source = 'brand-kit'; it does
 * not redefine the profile shape. No new capability; it is the discipline of
 * setting the brand once and generating against it.
 */
export const brandKit: GuidanceEntry = {
  id: 'brand-kit',
  title: 'Brand kit',
  summary:
    'How to set a project’s brand as a style profile and generate a consistent, on-brand batch with Limner.',
  body: [
    {
      kind: 'paragraph',
      text: 'A brand kit is the set of choices that make a series look like one brand: the palette, the recurring descriptors, the medium, and the pipeline that renders them. In Limner a brand kit is a style profile stored on the project, so you set it once and every later generation reads the same shape. Establish the kit, then generate each asset against it rather than re-deciding the look each time.',
    },
    { kind: 'heading', level: 2, text: 'Set the kit' },
    {
      kind: 'bullets',
      items: [
        'Write the brand into the project’s style profile with upsertStyleProfile: the palette (brand hex colors, named), the descriptors (the recurring style keywords), and the medium. Set provenance.source to brand-kit.',
        'Record the preferred pipeline and its knob defaults in pipelinePrefs so the batch renders the same way each time, for example a fixed Recraft style and substyle.',
        'List approved exemplars under references so the kit points at the assets that define it.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Generate on brand' },
    {
      kind: 'bullets',
      items: [
        'Read the profile with readStyleProfile at the start of each request, then shape the prompt from its descriptors and medium and apply pipelinePrefs.',
        'Hold the palette, descriptors, and pipeline settings fixed across the set and vary only the subject. Consistency is the point of a kit.',
        'For a brand mark on each asset, hand off to the brand-stamp workflow; for a per-platform set, hand off to multi-size export.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Keep the kit current' },
    {
      kind: 'paragraph',
      text: 'When the brand evolves, update the profile with the read, merge, write cycle (upsertStyleProfile preserves the rest of the project metadata) and note the change in provenance. A profile authored elsewhere, by an analysis of user images or an art-research pass, can seed the kit, since all of them share one shape; merge it in rather than overwrite.',
    },
  ],
};
