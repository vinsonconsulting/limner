import type { GuidanceEntry } from '../types.js';

/**
 * Concept #18: illuminated manuscript. The wave-1 flagship. Unlike the
 * per-pipeline recipes, this entry is reference knowledge for a multi-step
 * workflow: it names the visual elements of an illuminated page, the pipeline
 * that makes each, and the research-to-delivery loop. It is the single source
 * shared by the illuminated-manuscript skill (the orchestration procedure) and
 * its thin launch prompt.
 */
export const illuminatedManuscript: GuidanceEntry = {
  id: 'illuminated-manuscript',
  title: 'Illuminated manuscript',
  summary:
    'Reference for producing an illuminated manuscript page with Limner: the visual elements, the pipeline that makes each, and the research-to-delivery loop that assembles them.',
  body: [
    {
      kind: 'paragraph',
      text: 'An illuminated manuscript page pairs lettered text with painted decoration: a central illustration, an ornamented opening initial, a foliate border, and figures in the margins, often heightened with gold. Producing one with Limner is the worked example of the research-to-generation loop, not a single prompt. You research the conventions of a tradition, generate each element, compose them into one page, render the text, and deliver the result as a single asset.',
    },
    { kind: 'heading', level: 2, text: 'Visual elements' },
    {
      kind: 'table',
      columns: ['Element', 'What it is', 'How Limner makes it'],
      rows: [
        ['Miniature', 'The central painted illustration or scene', 'Midjourney or DALL·E generation'],
        [
          'Historiated initial',
          'An enlarged opening letter enclosing a figure or scene',
          'Recraft or DALL·E, usually on a transparent background',
        ],
        [
          'Border',
          'A decorative frame of foliate vines, acanthus, or interlace',
          'Recraft vector art or a generated raster, framed in compose',
        ],
        [
          'Marginalia',
          'Small figures and drolleries set in the margins',
          'Small generations composited around the text block',
        ],
        ['Text block', 'The lettered body in a period script', 'renderText with a server-side font'],
        [
          'Gilding',
          'Gold-leaf highlights on initials and accents',
          'Prompted into the generation, reinforced in compose',
        ],
      ],
    },
    { kind: 'heading', level: 2, text: 'The research-to-delivery loop' },
    {
      kind: 'bullets',
      items: [
        'Research the tradition first: period, region, script, palette, and motif vocabulary. What you find steers every prompt that follows.',
        'Generate the elements: the miniature and initial from the image pipelines, the border and marginalia as vector or raster decoration. Reuse a generated element as image input to keep a motif consistent.',
        'Compose the page: place the miniature, initial, and border, then render the text block over the layout in a chosen font.',
        'Deliver one page: emit the composed image through its capability URL so the result is a single fetchable asset.',
      ],
    },
    {
      kind: 'paragraph',
      text: 'Hold the researched palette and motifs fixed across the elements so the page reads as one work rather than separate generations stacked together.',
    },
  ],
};
