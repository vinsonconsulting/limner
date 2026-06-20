// Pipeline tools: limner_generate_dalle, limner_generate_midjourney, limner_generate_recraft.
// (compose lives in tools/compose.ts; see that file for D-RA-16 routing.)
//
// Each tool wraps a @limner/core PipelineRunner instance. The wrapper:
//   1. Parses zod input (handled by registerTools).
//   2. Builds a PipelineContext { secrets, abortSignal } from ToolContext.
//   3. Calls runner.generate().
//   4. Translates the PipelineGenerateOutput to an MCP CallToolResult:
//        - PipelineImageOutput with `data` -> image content block (base64)
//        - PipelineImageOutput with `url` only -> text content with the URL
//                                                  + metadata as structured content
//        - PipelineTextOutput -> text content
//
// Refs: D-RA-05, D-RA-14

import { z } from 'zod';
import {
  bytesToBase64,
  uploadArtifact,
  assertSecrets,
  DallePipeline,
  MidjourneyPipeline,
  RecraftPipeline,
  RestRecraftTransport,
  type PipelineRunner,
  type PipelineGenerateInput,
  type PipelineGenerateOutput,
  type PipelineContext,
  type RecraftGenerateResult,
} from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { Tool, ToolContext } from '../server.js';

// ---------------- limner_generate_dalle ----------------

const dalleInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  model: z.enum(['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2']).optional()
    .describe('OpenAI gpt-image model id. Defaults to gpt-image-1.'),
  size: z.string().optional()
    .describe('Output size, e.g. "1024x1024", "1024x1536", "1536x1024", or "auto".'),
  quality: z.enum(['low', 'medium', 'high', 'auto']).optional()
    .describe('Detail vs. cost/latency: low|medium|high|auto. Sent only when set.'),
  outputFormat: z.enum(['png', 'jpeg', 'webp']).optional()
    .describe('Output image format. Defaults to png server-side.'),
  background: z.enum(['auto', 'transparent', 'opaque']).optional()
    .describe('transparent requires outputFormat png/webp.'),
  image: z.string().url().optional()
    .describe('Source image URL for a likeness-preserving edit/restyle (gpt-image-1 image-edits). Pass a fetchable URL — e.g. an artifact URL from a prior generate — not inline base64.'),
});

const generateDalle: Tool<z.infer<typeof dalleInputSchema>> = {
  name: 'limner_generate_dalle',
  description: 'Generate or edit an image via OpenAI Images API (gpt-image-1 default; pass `image` to restyle a source). Paid API — each call bills your OpenAI account.',
  inputSchema: dalleInputSchema,
  // Calls a paid external API (OpenAI) — open-world, non-idempotent.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) =>
    runImagePipeline(new DallePipeline(), { prompt: input.prompt, options: input }, ctx, 'dalle'),
};

// ---------------- limner_generate_midjourney ----------------

const midjourneyInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  aspectRatio: z.string().optional().describe('e.g. "16:9", "1:1", "9:16"'),
  stylize: z.number().int().min(0).max(1000).optional()
    .describe('Midjourney --stylize value, 0-1000. Default 100.'),
  chaos: z.number().int().min(0).max(100).optional(),
  modelVersion: z.string().optional().describe('e.g. "6", "7"'),
  seed: z.number().int().optional(),
  image: z.string().url().optional()
    .describe('Image-prompt URL, composed at the start of the prompt. Use a fetchable URL.'),
  imageWeight: z.number().min(0).max(3).optional()
    .describe('Midjourney --iw image weight, 0-3 (default 1). Applies to `image`.'),
  styleRef: z.string().url().optional()
    .describe('Style-reference URL → --sref.'),
  omniRef: z.string().url().optional()
    .describe('Omni-reference URL (v7 subject/character consistency) → --oref.'),
});

const generateMidjourney: Tool<z.infer<typeof midjourneyInputSchema>> = {
  name: 'limner_generate_midjourney',
  description:
    'Compose a Midjourney prompt string (prompt-only; no image generation; downstream tool runs the HITL step). Supports image-prompt + --sref/--oref reference URLs.',
  inputSchema: midjourneyInputSchema,
  // Prompt-only string composition: no external call, deterministic.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) =>
    runPipeline(new MidjourneyPipeline(), { prompt: input.prompt, options: input }, ctx, 'midjourney'),
};

// ---------------- limner_generate_recraft ----------------

const recraftInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  style: z.string().optional()
    .describe('e.g. "realistic_image", "digital_illustration", "vector_illustration".'),
  substyle: z.string().optional(),
  model: z.string().optional().describe('e.g. "recraftv3", "recraftv2".'),
  size: z.string().optional().describe('e.g. "1024x1024", "1365x1024", "1024x1365".'),
  image: z.string().url().optional()
    .describe('Source image URL for image-to-image. Pass a fetchable URL, not inline base64.'),
  strength: z.number().min(0).max(1).optional()
    .describe('Image-to-image strength 0-1 (lower = closer to the source). Default 0.5. Used only with `image`.'),
});

const generateRecraft: Tool<z.infer<typeof recraftInputSchema>> = {
  name: 'limner_generate_recraft',
  description:
    'Generate or restyle an image via Recraft\'s REST API (external.api.recraft.ai; pass `image` for image-to-image). Paid API — each call bills your Recraft account.',
  inputSchema: recraftInputSchema,
  // Calls a paid external service (Recraft) — open-world, non-idempotent.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    // D-RA-25: direct REST. RecraftPipeline.generate() asserts RECRAFT_API_KEY
    // before the transport is used, so an absent key surfaces as a clean
    // missing_credential tool error rather than an auth failure downstream.
    const transport = new RestRecraftTransport(ctx.secrets['RECRAFT_API_KEY'] ?? '');
    const pipeline = new RecraftPipeline(transport);
    return runImagePipeline(pipeline, { prompt: input.prompt, options: input }, ctx, 'recraft');
  },
};

// ---------------- limner_upscale ----------------

const upscaleInputSchema = z.object({
  image: z.string().url()
    .describe('Source image URL to upscale. Pass a fetchable URL (e.g. an artifact URL from a prior generate), not inline base64.'),
});

const upscale: Tool<z.infer<typeof upscaleInputSchema>> = {
  name: 'limner_upscale',
  description:
    'Upscale a raster image (crisp: sharpen + enlarge toward print scale) via Recraft\'s REST API. Returns a larger raster image (PNG or WebP, depending on what the endpoint returns; the output mime reflects the actual bytes). Paid API — each call bills your Recraft account.',
  inputSchema: upscaleInputSchema,
  // Calls a paid external service (Recraft) — open-world, non-idempotent.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    // Assert the secret first so an absent key surfaces as a clean
    // missing-credential tool error, mirroring the recraft generate path.
    assertSecrets('recraft', ['RECRAFT_API_KEY'], ctx.secrets);
    const transport = new RestRecraftTransport(ctx.secrets['RECRAFT_API_KEY'] ?? '');
    // Request bytes (b64_json) so we re-host to a durable capability URL (PR D)
    // instead of passing through Recraft's transient hosted URL.
    const result = await transport.upscaleImage({ image: input.image, responseFormat: 'b64_json' });
    return deliverTransform(result, ctx, 'recraft-upscale', 'image/png');
  },
};

// ---------------- limner_vectorize ----------------

const vectorizeInputSchema = z.object({
  image: z.string().url()
    .describe('Source raster image URL to vectorize. Pass a fetchable URL (e.g. an artifact URL from a prior generate), not inline base64.'),
});

const vectorize: Tool<z.infer<typeof vectorizeInputSchema>> = {
  name: 'limner_vectorize',
  description:
    'Vectorize a raster image into a scalable SVG via Recraft\'s REST API. Returns an SVG. Paid API — each call bills your Recraft account.',
  inputSchema: vectorizeInputSchema,
  // Calls a paid external service (Recraft) — open-world, non-idempotent.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    assertSecrets('recraft', ['RECRAFT_API_KEY'], ctx.secrets);
    const transport = new RestRecraftTransport(ctx.secrets['RECRAFT_API_KEY'] ?? '');
    const result = await transport.vectorizeImage({ image: input.image, responseFormat: 'b64_json' });
    return deliverTransform(result, ctx, 'recraft-vectorize', 'image/svg+xml');
  },
};

// ---------------- Shared helpers ----------------

function buildPipelineContext(ctx: ToolContext): PipelineContext {
  return {
    secrets: ctx.secrets,
    abortSignal: ctx.abortSignal,
  };
}

async function runImagePipeline(
  runner: PipelineRunner,
  input: PipelineGenerateInput,
  ctx: ToolContext,
  pipelineId: string,
): Promise<CallToolResult> {
  const out = await runner.generate(input, buildPipelineContext(ctx));
  return formatImageOutput(await maybeDeliver(out, ctx, pipelineId), pipelineId);
}

// PR D: when a delivery store is configured (Workers GENERATED_BUCKET +
// ARTIFACT_BASE_URL), upload inline image bytes and return a URL instead —
// large base64 outputs (e.g. gpt-image-1) exceed the MCP message-size ceiling.
// No-op for text output, URL-only output (already a link), or stdio/local
// (no delivery store) — those keep their existing inline/url behavior.
async function maybeDeliver(
  out: PipelineGenerateOutput,
  ctx: ToolContext,
  pipelineId: string,
): Promise<PipelineGenerateOutput> {
  if (out.kind !== 'image' || !out.data || !ctx.delivery) return out;
  const url = await uploadArtifact(ctx.delivery, out.data, out.mimeType, pipelineId);
  // Drop the bytes; formatImageOutput then returns the URL form.
  return { ...out, data: undefined, url };
}

// Adapt a transform result (upscale/vectorize — no PipelineRunner, just a
// RecraftGenerateResult) onto the shared image-delivery path: re-host bytes to
// a capability URL when a delivery store is configured, else return inline.
// `defaultMime` stamps the output when the transport returned a hosted url only.
async function deliverTransform(
  result: RecraftGenerateResult,
  ctx: ToolContext,
  pipelineId: string,
  defaultMime: string,
): Promise<CallToolResult> {
  const out: PipelineGenerateOutput = {
    kind: 'image',
    ...(result.url ? { url: result.url } : {}),
    ...(result.data ? { data: result.data } : {}),
    mimeType: result.mimeType ?? defaultMime,
    metadata: { pipeline: pipelineId },
  };
  return formatImageOutput(await maybeDeliver(out, ctx, pipelineId), pipelineId);
}

async function runPipeline(
  runner: PipelineRunner,
  input: PipelineGenerateInput,
  ctx: ToolContext,
  pipelineId: string,
): Promise<CallToolResult> {
  const out = await runner.generate(input, buildPipelineContext(ctx));
  return formatGenericOutput(out, pipelineId);
}

function formatGenericOutput(out: PipelineGenerateOutput, pipelineId: string): CallToolResult {
  if (out.kind === 'text') {
    return {
      content: [{ type: 'text', text: out.content }],
      structuredContent: { pipeline: pipelineId, ...(out.metadata ?? {}) },
    };
  }
  return formatImageOutput(out, pipelineId);
}

function formatImageOutput(out: PipelineGenerateOutput, pipelineId: string): CallToolResult {
  if (out.kind === 'text') {
    return {
      content: [{ type: 'text', text: out.content }],
      structuredContent: { pipeline: pipelineId, ...(out.metadata ?? {}) },
    };
  }
  // Image output: prefer data over url so MCP clients get bytes
  // inline (no follow-up fetch). When only url is present, return
  // a text content block with the URL plus structured metadata so
  // callers can fetch it themselves.
  const meta: Record<string, unknown> = {
    pipeline: pipelineId,
    mimeType: out.mimeType,
    ...(out.width !== undefined ? { width: out.width } : {}),
    ...(out.height !== undefined ? { height: out.height } : {}),
    ...(out.url ? { url: out.url } : {}),
    ...(out.metadata ?? {}),
  };
  if (out.data) {
    return {
      content: [{ type: 'image', data: bytesToBase64(out.data), mimeType: out.mimeType }],
      structuredContent: meta,
    };
  }
  // URL-only fallback.
  return {
    content: [{ type: 'text', text: out.url ?? '(no image returned)' }],
    structuredContent: meta,
  };
}

// ---------------- Exported registry ----------------

export const pipelineTools: readonly Tool[] = [
  generateDalle,
  generateMidjourney,
  generateRecraft,
  upscale,
  vectorize,
] as const;
