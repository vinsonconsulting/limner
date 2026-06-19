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

export const prompts: readonly Prompt[] = [capabilityTour, midjourneyBuilder, dalleBuilder];

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
