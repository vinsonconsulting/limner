// Pipeline tools: limner_generate_dalle, limner_generate_midjourney, limner_generate_recraft.
//
// Wraps the Phase 4 zod schemas (re-imported from @limner/mcp) with
// CMA-side run handlers. Image-returning tools (dalle, recraft):
//   - call into @limner/core's PipelineRunner instances
//   - upload PNG bytes to R2 via uploadImageToR2
//   - return a JSON envelope string (`{url, mimeType, ...}`)
// Midjourney returns its composed prompt as a JSON envelope `{text, ...}`.
//
// `requires` predicates gate registration on the consuming Worker's
// bindings — DALL-E needs BUCKET + OPENAI_API_KEY; Midjourney has no
// binding requirement (prompt composition is offline).
//
// Refs: D-RA-12, D-RA-14

import type { z } from 'zod';
import type { R2Bucket } from '@cloudflare/workers-types';
import {
  DallePipeline,
  MidjourneyPipeline,
  RecraftPipeline,
  RestRecraftTransport,
  type PipelineGenerateInput,
} from '@limner/core';
import { pipelineTools as mcpPipelineTools } from '@limner/mcp';

import { defineTool, type CustomTool } from '../runtime.js';
import { uploadImageToR2, imageReturnEnvelope } from '../r2-upload.js';

/**
 * Look up an MCP tool's inputSchema by name. Keeps Phase 4 (Path B)
 * and Phase 5 (Path A) schemas single-source.
 */
function schemaFor(name: string): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const t = mcpPipelineTools.find((x) => x.name === name);
  if (!t) {
    throw new Error(
      `cma-tools/pipelines: schema lookup failed for "${name}"; expected an @limner/mcp pipelineTools entry`,
    );
  }
  return t.inputSchema as z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// Shared image-output handler: encode bytes to R2, return JSON envelope.
async function emitImage(
  env: Record<string, unknown>,
  data: Uint8Array,
  mimeType: string,
  prefix: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const bucket = env['BUCKET'] as R2Bucket;
  const url = await uploadImageToR2(bucket, data, mimeType, {
    prefix,
    publicBaseUrl: asString(env['LIMNER_BUCKET_PUBLIC_URL']),
  });
  return imageReturnEnvelope(url, mimeType, metadata);
}

// ---------------- limner_generate_dalle ----------------

export const generateDalleTool: CustomTool = defineTool({
  name: 'limner_generate_dalle',
  description: 'Generate an image via OpenAI Images API (gpt-image-1 default). Uploads result to R2 and returns the URL.',
  inputSchema: schemaFor('limner_generate_dalle'),
  requires: (env) => Boolean(env['BUCKET']) && Boolean(env['OPENAI_API_KEY']),
  run: async (input, { env }) => {
    const p = new DallePipeline();
    const pipelineInput: PipelineGenerateInput = {
      prompt: String((input as { prompt: string }).prompt),
      options: input as Record<string, unknown>,
    };
    const out = await p.generate(pipelineInput, {
      secrets: { OPENAI_API_KEY: String(env['OPENAI_API_KEY']) },
    });
    if (out.kind === 'text') {
      return JSON.stringify({ text: out.content, ...(out.metadata ?? {}) });
    }
    // Prefer in-band data; fall back to URL passthrough when the
    // pipeline returned a URL only (older DALL-E response shape).
    if (out.data) {
      return emitImage(env, out.data, out.mimeType, 'dalle', {
        width: out.width,
        height: out.height,
        ...(out.metadata ?? {}),
      });
    }
    return imageReturnEnvelope(out.url ?? '', out.mimeType, {
      width: out.width,
      height: out.height,
      ...(out.metadata ?? {}),
    });
  },
});

// ---------------- limner_generate_midjourney ----------------

export const generateMidjourneyTool: CustomTool = defineTool({
  name: 'limner_generate_midjourney',
  description:
    'Compose a Midjourney prompt string (prompt-only; no image generation; the agent runs the human-in-the-loop step).',
  inputSchema: schemaFor('limner_generate_midjourney'),
  // No binding requirement — prompt composition is offline.
  run: async (input) => {
    const p = new MidjourneyPipeline();
    const out = await p.generate(
      {
        prompt: String((input as { prompt: string }).prompt),
        options: input as Record<string, unknown>,
      },
      { secrets: {} },
    );
    if (out.kind !== 'text') {
      throw new Error('limner_generate_midjourney: unexpected non-text pipeline output');
    }
    return JSON.stringify({ text: out.content, ...(out.metadata ?? {}) });
  },
});

// ---------------- limner_generate_recraft ----------------

export const generateRecraftTool: CustomTool = defineTool({
  name: 'limner_generate_recraft',
  description:
    'Generate an image via Recraft\'s REST API (external.api.recraft.ai). Uploads the result to R2 and returns its URL.',
  inputSchema: schemaFor('limner_generate_recraft'),
  requires: (env) => Boolean(env['BUCKET']) && Boolean(env['RECRAFT_API_KEY']),
  run: async (input, { env }) => {
    const secrets: Record<string, string> = {};
    if (env['RECRAFT_API_KEY']) secrets['RECRAFT_API_KEY'] = String(env['RECRAFT_API_KEY']);
    const transport = new RestRecraftTransport(secrets['RECRAFT_API_KEY'] ?? '');
    const pipeline = new RecraftPipeline(transport);
    const out = await pipeline.generate(
      {
        prompt: String((input as { prompt: string }).prompt),
        options: input as Record<string, unknown>,
      },
      { secrets },
    );
    if (out.kind === 'text') {
      return JSON.stringify({ text: out.content, ...(out.metadata ?? {}) });
    }
    if (out.data) {
      return emitImage(env, out.data, out.mimeType, 'recraft', {
        width: out.width,
        height: out.height,
        ...(out.metadata ?? {}),
      });
    }
    return imageReturnEnvelope(out.url ?? '', out.mimeType, {
      width: out.width,
      height: out.height,
      ...(out.metadata ?? {}),
    });
  },
});

// Exported registry — index.ts spreads this into LIMNER_TOOLS.
export const pipelineTools: readonly CustomTool[] = [
  generateDalleTool,
  generateMidjourneyTool,
  generateRecraftTool,
] as const;
