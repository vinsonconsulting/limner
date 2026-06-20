import type { GuidanceEntry } from '../types.js';

/**
 * Concept #17: art research. A skill-only concept: the single source for the
 * art-research skill. It leans on the agent's own web tools (the research step
 * the illuminated-manuscript skill also uses) and the shared style-profile
 * (style-profile entry / style-profile/store.ts), writing findings with
 * provenance.source = 'art-research'. Single-agent for now: the CMA multi-agent
 * research path is not yet available, so this is one research pass, not a fleet.
 */
export const artResearch: GuidanceEntry = {
  id: 'art-research',
  title: 'Art research',
  summary:
    'How to research an art style, movement, or technique with Limner and turn the findings into a style profile that steers generation.',
  body: [
    {
      kind: 'paragraph',
      text: 'Art research turns a question about a style, movement, or technique into visual direction you can generate from. The agent researches with its own web tools, distills what defines the look, and writes it to a style profile so the research steers every prompt that follows. This is the research-to-generation loop applied to art history rather than a single brief.',
    },
    { kind: 'heading', level: 2, text: 'Research the style' },
    {
      kind: 'bullets',
      items: [
        'Use your web tools (web search and fetch) to pin down the style: its period and origin, the palette, the signature motifs and composition, the medium and technique, and a few exemplar works or artists.',
        'This is a single research pass, not a research fleet. Stop once you can name the palette, the medium, and three or four signature traits; more reading rarely changes the prompts.',
        'Prefer primary or authoritative sources (museum and archive pages) over aggregators, and keep track of where each fact came from.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Distill into a style profile' },
    {
      kind: 'bullets',
      items: [
        'Write the findings to the project’s style profile with upsertStyleProfile: the palette (hex colors), the descriptors (the style keywords the research surfaced), and the medium. Set provenance.source to art-research and note the key sources in provenance.',
        'List exemplar works under references (kind url or note) so the profile points back at what it is based on.',
        'Keep the descriptors concrete and few; a tight profile generates more consistently than a long reading list.',
      ],
    },
    { kind: 'heading', level: 2, text: 'Generate from the research' },
    {
      kind: 'paragraph',
      text: 'Shape each prompt from the profile’s descriptors and medium, and set pipelinePrefs for the pipeline that best renders the style (vector work to Recraft, painterly work to Midjourney or DALL·E). The profile is the shared shape the brand-kit and style-from-images surfaces also read, so researched direction flows into a consistent batch.',
    },
  ],
};
