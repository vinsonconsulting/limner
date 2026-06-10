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
  DallePipeline,
  MidjourneyPipeline,
  RecraftPipeline,
  type PipelineRunner,
  type PipelineGenerateInput,
  type PipelineGenerateOutput,
  type PipelineContext,
} from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { Tool, ToolContext } from '../server.js';
import { McpRecraftTransport } from '../transports/mcp-recraft.js';

// ---------------- limner_generate_dalle ----------------

const dalleInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  model: z.enum(['gpt-image-1', 'dall-e-3', 'dall-e-2']).optional()
    .describe('OpenAI model id. Defaults to gpt-image-1.'),
  size: z.string().optional()
    .describe('Output size, e.g. "1024x1024", "1024x1536", or "auto" for gpt-image-1.'),
  quality: z.enum(['low', 'medium', 'high', 'auto', 'standard', 'hd']).optional()
    .describe('gpt-image-1: low|medium|high|auto. dall-e-3/2: ignored.'),
  outputFormat: z.enum(['png', 'jpeg', 'webp']).optional()
    .describe('gpt-image-1 only.'),
  background: z.enum(['auto', 'transparent', 'opaque']).optional()
    .describe('gpt-image-1 only. transparent requires outputFormat png/webp.'),
});

const generateDalle: Tool<z.infer<typeof dalleInputSchema>> = {
  name: 'limner_generate_dalle',
  description: 'Generate an image via OpenAI Images API (gpt-image-1 default; dall-e-3 / dall-e-2 also supported).',
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
});

const generateMidjourney: Tool<z.infer<typeof midjourneyInputSchema>> = {
  name: 'limner_generate_midjourney',
  description:
    'Compose a Midjourney prompt string (prompt-only; no image generation; downstream tool runs the HITL step).',
  inputSchema: midjourneyInputSchema,
  // Prompt-only string composition: no external call, deterministic.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) =>
    runPipeline(new MidjourneyPipeline(), { prompt: input.prompt, options: input }, ctx, 'midjourney'),
};

// ---------------- limner_generate_recraft ----------------

const recraftInputSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  mode: z.enum(['remote', 'local']).default('remote')
    .describe('"remote" hits mcp.recraft.ai (Bearer auth); "local" spawns npx @recraft-ai/mcp-recraft-server stdio — stdio transport only, unsupported on Workers.'),
  style: z.string().optional()
    .describe('e.g. "realistic_image", "digital_illustration", "vector_illustration".'),
  substyle: z.string().optional(),
  model: z.string().optional().describe('e.g. "recraftv3", "recraftv2".'),
  size: z.string().optional().describe('e.g. "1024x1024", "1365x1024", "1024x1365".'),
});

const generateRecraft: Tool<z.infer<typeof recraftInputSchema>> = {
  name: 'limner_generate_recraft',
  description:
    'Generate an image via Recraft (composed-MCP adapter per D-RA-14; calls Recraft\'s generate_image tool).',
  inputSchema: recraftInputSchema,
  // Calls a paid external service (Recraft) — open-world, non-idempotent.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    // r3: local mode spawns an npx subprocess over stdio — impossible in a
    // V8 isolate. Gate before connect() so the failure is a clear tool
    // error, not a runtime crash. Mirrors compose's cf-op gate pattern.
    if (input.mode === 'local' && ctx.bindings.kind === 'workers') {
      return {
        content: [{
          type: 'text',
          text: 'limner_generate_recraft: unsupported_in_workers — mode:"local" spawns a stdio subprocess and requires the stdio transport. Use mode:"remote".',
        }],
        isError: true,
      };
    }
    const transport = await McpRecraftTransport.connect(input.mode, ctx.secrets);
    try {
      const pipeline = new RecraftPipeline(input.mode, transport);
      return await runImagePipeline(
        pipeline,
        { prompt: input.prompt, options: input },
        ctx,
        'recraft',
      );
    } finally {
      await transport.close();
    }
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
  return formatImageOutput(out, pipelineId);
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
] as const;
