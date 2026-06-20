// MCP prompts registry (D-RA-24). Sibling to tools/: the prompt message
// derives from the @limner/core guidance source, so it cannot drift.
// registerPrompts installs prompts/list + prompts/get on a Server; both
// transports call it alongside registerTools.
//
// The `prompts` capability is declared in createServer (server.ts) — without
// it the SDK client refuses prompts/* calls (assertCapabilityForMethod).
//
// Refs: D-RA-24

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getGuidance, serializeGuidance } from '@limner/core';

export type PromptArgument = {
  name: string;
  description?: string;
  required?: boolean;
};

type PromptMessage = {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
};

export type Prompt = {
  /** Prompt name advertised in prompts/list. */
  name: string;
  /** One-line description for prompts/list. */
  description: string;
  /** Declared arguments (surfaced in prompts/list). */
  arguments: PromptArgument[];
  /** Build the message list from supplied arguments. */
  build: (args: Record<string, string>) => PromptMessage[];
};

// capability-tour — concept #11, derived from the capabilities-overview
// guidance entry. The optional `focus` arg narrows the tour.
const capabilityTour: Prompt = {
  name: 'capability-tour',
  description: getGuidance('capabilities-overview')!.summary,
  arguments: [
    {
      name: 'focus',
      description: 'Optional capability area to emphasize (e.g. "compose", "memory").',
      required: false,
    },
  ],
  build: (args) => {
    const base = serializeGuidance(getGuidance('capabilities-overview')!);
    const focus = args['focus'];
    const text = focus ? `${base}\n(Focus requested: ${focus})\n` : base;
    return [{ role: 'user', content: { type: 'text', text } }];
  },
};

// midjourney-builder — concept #2. Serializes the midjourney-recipe guidance
// verbatim, then frames a build request from the supplied subject and knobs.
// The guidance slice stays byte-identical to the serializer; only the request
// lines below it vary with the arguments.
const midjourneyBuilder: Prompt = {
  name: 'midjourney-builder',
  description: getGuidance('midjourney-recipe')!.summary,
  arguments: [
    { name: 'subject', description: 'The concrete subject to depict.', required: true },
    {
      name: 'style',
      description: 'Optional style and medium direction (e.g. "cinematic, 35mm, volumetric light").',
      required: false,
    },
    { name: 'aspect', description: 'Optional aspect ratio (e.g. "16:9").', required: false },
    {
      name: 'version',
      description: 'Optional Midjourney version (e.g. "v7", "niji-6").',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('midjourney-builder requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('midjourney-recipe')!);
    const knobs = [
      args['style'] && `Style direction: ${args['style']}`,
      args['aspect'] && `Aspect ratio: ${args['aspect']}`,
      args['version'] && `Version: ${args['version']}`,
    ].filter(Boolean);
    const request = [`Using the recipe above, build a Midjourney prompt for: ${subject}`, ...knobs].join(
      '\n',
    );
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${request}\n` } }];
  },
};

// dalle-builder — concept #3. Serializes the dalle-recipe guidance verbatim,
// then frames a build request from the supplied subject and knobs.
const dalleBuilder: Prompt = {
  name: 'dalle-builder',
  description: getGuidance('dalle-recipe')!.summary,
  arguments: [
    { name: 'subject', description: 'The concrete subject to depict.', required: true },
    { name: 'size', description: 'Optional size (e.g. "1024x1024", "1024x1536").', required: false },
    { name: 'quality', description: 'Optional quality (low, medium, high, auto).', required: false },
    {
      name: 'background',
      description: 'Optional background (auto, transparent, opaque).',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('dalle-builder requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('dalle-recipe')!);
    const knobs = [
      args['size'] && `Size: ${args['size']}`,
      args['quality'] && `Quality: ${args['quality']}`,
      args['background'] && `Background: ${args['background']}`,
    ].filter(Boolean);
    const request = [`Using the recipe above, write a DALL·E prompt for: ${subject}`, ...knobs].join(
      '\n',
    );
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${request}\n` } }];
  },
};

// recraft-builder — concept #4. Serializes the recraft-recipe guidance
// verbatim, then frames a build request from the supplied subject and knobs.
const recraftBuilder: Prompt = {
  name: 'recraft-builder',
  description: getGuidance('recraft-recipe')!.summary,
  arguments: [
    { name: 'subject', description: 'The concrete subject to depict.', required: true },
    {
      name: 'style',
      description: 'Optional style family (digital_illustration, vector_illustration, realistic_image).',
      required: false,
    },
    {
      name: 'substyle',
      description: 'Optional substyle within the chosen style (omit when unsure).',
      required: false,
    },
    { name: 'size', description: 'Optional size (e.g. "1024x1024", "1365x1024").', required: false },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('recraft-builder requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('recraft-recipe')!);
    const knobs = [
      args['style'] && `Style: ${args['style']}`,
      args['substyle'] && `Substyle: ${args['substyle']}`,
      args['size'] && `Size: ${args['size']}`,
    ].filter(Boolean);
    const request = [`Using the recipe above, write a Recraft prompt for: ${subject}`, ...knobs].join(
      '\n',
    );
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${request}\n` } }];
  },
};

// illuminated-manuscript — concept #18, the flagship. A thin launcher: it
// serializes the illuminated-manuscript reference verbatim and frames the
// full research-to-delivery loop around the supplied subject. The procedure
// lives in the illuminated-manuscript skill the agent then loads.
const illuminatedManuscriptPrompt: Prompt = {
  name: 'illuminated-manuscript',
  description: getGuidance('illuminated-manuscript')!.summary,
  arguments: [
    { name: 'subject', description: 'The scene or text the page should illuminate.', required: true },
    {
      name: 'tradition',
      description: 'Optional tradition to research (e.g. "13th-century Gothic", "Insular").',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('illuminated-manuscript requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('illuminated-manuscript')!);
    const lines = [
      `Using the reference above, produce an illuminated manuscript page for: ${subject}`,
      'Run the full loop: research the tradition, generate the elements, compose them, and deliver one page.',
    ];
    if (args['tradition']) {
      lines.push(`Tradition to research: ${args['tradition']}`);
    }
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${lines.join('\n')}\n` } }];
  },
};

// pipeline-router — concept #1. A thin router: it serializes the
// pipeline-router reference verbatim, then asks for a routed recommendation for
// the supplied asset goal. The routing procedure lives in the pipeline-router
// skill the agent loads next; this prompt only frames the decision.
const pipelineRouterPrompt: Prompt = {
  name: 'pipeline-router',
  description: getGuidance('pipeline-router')!.summary,
  arguments: [
    {
      name: 'subject',
      description:
        'The asset you need, stated as a goal (e.g. "a scalable app icon", "a painterly hero image").',
      required: true,
    },
    {
      name: 'priorities',
      description:
        'Optional constraints to weigh (e.g. "cost-sensitive", "must be vector", "needed today").',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('pipeline-router requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('pipeline-router')!);
    const lines = [
      `Using the routing reference above, recommend a pipeline (and any finishing steps) for: ${subject}`,
    ];
    if (args['priorities']) {
      lines.push(`Priorities: ${args['priorities']}`);
    }
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${lines.join('\n')}\n` } }];
  },
};

// brand-stamp — concept #5. Serializes the brand-stamp guidance verbatim, then
// frames a stamping request from the supplied image and optional mark, placement,
// and treatment. The compositing procedure lives in the brand-stamp skill.
const brandStampPrompt: Prompt = {
  name: 'brand-stamp',
  description: getGuidance('brand-stamp')!.summary,
  arguments: [
    { name: 'subject', description: 'The image to stamp, as a description or a URL.', required: true },
    {
      name: 'mark',
      description: 'Optional brand mark: a logo description or URL, or watermark text such as "DRAFT".',
      required: false,
    },
    {
      name: 'placement',
      description: 'Optional placement (e.g. "bottom-right corner", "centered").',
      required: false,
    },
    {
      name: 'treatment',
      description: 'Optional treatment (e.g. "faded", "small, 15% of width").',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('brand-stamp requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('brand-stamp')!);
    const lines = [`Using the guidance above, stamp a brand mark or watermark onto: ${subject}`];
    if (args['mark']) {
      lines.push(`Mark: ${args['mark']}`);
    }
    if (args['placement']) {
      lines.push(`Placement: ${args['placement']}`);
    }
    if (args['treatment']) {
      lines.push(`Treatment: ${args['treatment']}`);
    }
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${lines.join('\n')}\n` } }];
  },
};

// multi-size-export — concept #6. Serializes the multi-size-export guidance
// verbatim, then frames an export request from the supplied image and optional
// targets and formats. The resize/convert procedure lives in the skill.
const multiSizeExportPrompt: Prompt = {
  name: 'multi-size-export',
  description: getGuidance('multi-size-export')!.summary,
  arguments: [
    { name: 'subject', description: 'The image to export, as a description or a URL.', required: true },
    {
      name: 'targets',
      description: 'Optional destinations or sizes (e.g. "web hero, square social post, app icon").',
      required: false,
    },
    {
      name: 'formats',
      description: 'Optional format preferences (e.g. "WebP for web, PNG for the icon").',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('multi-size-export requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('multi-size-export')!);
    const lines = [
      `Using the guidance above, export this image at the sizes and formats it needs: ${subject}`,
    ];
    if (args['targets']) {
      lines.push(`Targets: ${args['targets']}`);
    }
    if (args['formats']) {
      lines.push(`Formats: ${args['formats']}`);
    }
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${lines.join('\n')}\n` } }];
  },
};

// captioned-graphic — concept #7. Serializes the captioned-graphic guidance
// verbatim, then frames a request from the supplied text and optional base
// image, placement, and style. The renderText + composite procedure lives in
// the skill.
const captionedGraphicPrompt: Prompt = {
  name: 'captioned-graphic',
  description: getGuidance('captioned-graphic')!.summary,
  arguments: [
    {
      name: 'subject',
      description: 'The text to set on the image (a headline, caption, or quote).',
      required: true,
    },
    {
      name: 'image',
      description: 'Optional base image to caption, as a description or a URL.',
      required: false,
    },
    {
      name: 'placement',
      description: 'Optional placement (e.g. "bottom band", "centered title").',
      required: false,
    },
    {
      name: 'style',
      description: 'Optional type style (e.g. "large headline, white on a dark band").',
      required: false,
    },
  ],
  build: (args) => {
    const subject = args['subject'];
    if (!subject) {
      throw new Error('captioned-graphic requires a "subject" argument');
    }
    const base = serializeGuidance(getGuidance('captioned-graphic')!);
    const lines = [`Using the guidance above, make a captioned graphic with this text: ${subject}`];
    if (args['image']) {
      lines.push(`Base image: ${args['image']}`);
    }
    if (args['placement']) {
      lines.push(`Placement: ${args['placement']}`);
    }
    if (args['style']) {
      lines.push(`Style: ${args['style']}`);
    }
    return [{ role: 'user', content: { type: 'text', text: `${base}\n${lines.join('\n')}\n` } }];
  },
};

export const prompts: readonly Prompt[] = [
  capabilityTour,
  pipelineRouterPrompt,
  brandStampPrompt,
  multiSizeExportPrompt,
  captionedGraphicPrompt,
  midjourneyBuilder,
  dalleBuilder,
  recraftBuilder,
  illuminatedManuscriptPrompt,
];

/**
 * Wire prompt definitions into a Server. Installs two handlers:
 *   - prompts/list -> enumerates name/description/arguments
 *   - prompts/get  -> builds the message list from supplied arguments
 */
export function registerPrompts(server: Server, list: readonly Prompt[]): void {
  const byName = new Map<string, Prompt>(list.map((p) => [p.name, p]));

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: list.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const prompt = byName.get(req.params.name);
    if (!prompt) {
      throw new Error(`prompt not found: ${req.params.name}`);
    }
    return {
      description: prompt.description,
      messages: prompt.build(req.params.arguments ?? {}),
    };
  });
}
