// Shared MCP server core: tool registry + dispatch. Transport-agnostic.
// stdio.ts and worker.ts each construct a Server, register tools, and
// bind it to their respective transport.
//
// Tool handlers return CallToolResult directly so they can yield either
// text content (JSON-stringified structured data) or image content
// (base64 + mimeType) without an extra adapter layer.
//
// Refs: D-RA-05, D-RA-06

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import { z, type ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { Bindings, ArtifactDelivery } from '@limner/core';
import type { CFImagesBinding } from '@limner/core';

export type ToolContext = {
  /** Bindings layer (D1 via Workers vs node:sqlite in local stdio). */
  bindings: Bindings;
  /** Cloudflare Images binding — only present in Workers transport.
   *  Stdio transport leaves this undefined; compose's cf-images ops
   *  throw a clear `unsupported_in_stdio` error when invoked there. */
  images?: CFImagesBinding;
  /** Pipeline API credentials. Workers: from `env.OPENAI_API_KEY` etc.
   *  Stdio: from `process.env`. Pipelines never read env directly. */
  secrets: Readonly<Record<string, string>>;
  /** Asset delivery (PR D) — present only when a Workers GENERATED_BUCKET +
   *  ARTIFACT_BASE_URL are configured. When set, image-returning tools upload
   *  bytes and return a URL instead of inline base64. Absent on stdio/local. */
  delivery?: ArtifactDelivery;
  /** Optional MCP cancellation signal forwarded to pipelines. */
  abortSignal?: AbortSignal;
};

// Variance: default `TIn` to `any` so a typed Tool<{prompt: string}> stays
// assignable to a `Tool[]` registry without casts. Runtime safety is preserved
// by the zod validation inside registerTools (safeParse before the handler
// call). `inputSchema` uses `ZodType<TIn, ZodTypeDef, any>` (not ZodSchema<TIn>)
// so .default() / .transform() / .preprocess() are allowed — those produce
// schemas where the input shape differs from the parsed output shape, which is
// exactly what handlers should consume. The two `any`s below are deliberate;
// the disables sit directly on their lines so they never go stale.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tool<TIn = any> = {
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: z.ZodType<TIn, z.ZodTypeDef, any>;
  /** MCP behavioral hints surfaced in tools/list (readOnlyHint,
   *  destructiveHint, idempotentHint, openWorldHint). Advisory only —
   *  they describe side-effect posture so clients can decide e.g. whether
   *  to auto-approve a call; the server enforces nothing from them. */
  annotations?: ToolAnnotations;
  /** Handler returns the full MCP CallToolResult so pipeline tools can
   *  yield image content directly without adapter wrapping. */
  handler: (input: TIn, ctx: ToolContext) => Promise<CallToolResult>;
};

export type ToolRegistry = ReadonlyMap<string, Tool>;

/** Shared annotation for pure-read tools: no mutation, repeat-safe,
 *  closed-world (no external/unpredictable side-effects). */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

// MCP and the Anthropic tool API both require every tool's
// `inputSchema.type` to be `'object'`. zod's `z.discriminatedUnion(...)`
// serializes via zod-to-json-schema to a top-level `anyOf` (no `type`).
//
// We must NOT pass that through as a top-level `oneOf`/`anyOf`/`allOf`:
// the Anthropic Messages API rejects a tool `input_schema` with a
// top-level combinator ("input_schema does not support oneOf, allOf, or
// anyOf at the top level"). Through Managed Agents that rejection
// surfaces as an opaque `model_request_failed_error` (0 tokens) the
// moment the tool loads into a model request — which is exactly how the
// `vault_ids` 0-token failure manifested (see PR #8, which fixed it).
//
// So we FLATTEN a discriminated union into a single object schema: union
// every variant's properties, collapse the discriminator's per-variant
// `const`s into an `enum`, and require only the fields required by every
// variant. Strict per-variant validation still happens at call time via
// the zod schema (`registerTools` calls `inputSchema.safeParse`), so this
// only loosens what's *advertised*, never what's *accepted*. Nested
// combinators (inside a property) are left untouched — the API allows
// those; only the top level is restricted.
function flattenUnionVariants(
  variants: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const constValues: Record<string, Set<unknown>> = {};
  const requiredSets: string[][] = [];
  for (const variant of variants) {
    const vProps = (variant.properties as Record<string, unknown>) ?? {};
    requiredSets.push((variant.required as string[]) ?? []);
    for (const [key, propSchema] of Object.entries(vProps)) {
      if (propSchema && typeof propSchema === 'object' && 'const' in (propSchema as object)) {
        (constValues[key] ??= new Set()).add((propSchema as { const: unknown }).const);
      } else if (!(key in properties)) {
        properties[key] = propSchema;
      }
    }
  }
  // A property that appears as a `const` (the discriminator) becomes an
  // `enum` of all its observed values.
  for (const [key, values] of Object.entries(constValues)) {
    properties[key] = { type: 'string', enum: [...values] };
  }
  // Required = fields required by EVERY variant (intersection).
  const required =
    requiredSets.length === 0
      ? []
      : requiredSets.reduce((acc, set) => acc.filter((field) => set.includes(field)));
  return { type: 'object', properties, required, additionalProperties: false };
}

export function toMcpInputSchema(schema: ZodTypeAny): Record<string, unknown> {
  const raw = zodToJsonSchema(schema) as Record<string, unknown> & {
    type?: string;
    anyOf?: unknown[];
    oneOf?: unknown[];
    allOf?: unknown[];
  };
  const variants = raw.anyOf ?? raw.oneOf;
  if (Array.isArray(variants)) {
    return flattenUnionVariants(variants as Array<Record<string, unknown>>);
  }
  return raw;
}

/**
 * Construct a typed MCP Server instance with the tools, prompts, and resources
 * capabilities declared. The capability set must be declared here (not at
 * registration time) because the SDK client gates prompts/* and resources/*
 * calls on what the server advertised during initialize
 * (assertCapabilityForMethod). Both transports build their Server via this
 * function, so both advertise the full set.
 */
export function createServer(name: string, version: string): Server {
  return new Server(
    { name, version },
    { capabilities: { tools: {}, prompts: {}, resources: {} } },
  );
}

/**
 * Wire a list of Tool definitions into a Server. Installs two handlers:
 *   - tools/list  -> enumerates the registry, mapping zod -> JSON Schema
 *   - tools/call  -> validates args, calls the handler, returns its CallToolResult
 *
 * The ctxFactory is invoked once per tools/call so transports can rebuild
 * the abort signal / secrets snapshot per-request without leaking across
 * concurrent requests.
 */
export function registerTools(
  server: Server,
  tools: readonly Tool[],
  ctxFactory: () => ToolContext,
): void {
  const byName = new Map<string, Tool>(tools.map((t) => [t.name, t]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: toMcpInputSchema(t.inputSchema as ZodTypeAny),
      ...(t.annotations ? { annotations: t.annotations } : {}),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = byName.get(req.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `tool not found: ${req.params.name}` }],
        isError: true,
      };
    }

    const parseResult = tool.inputSchema.safeParse(req.params.arguments ?? {});
    if (!parseResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: `invalid arguments for ${req.params.name}: ${JSON.stringify(
              parseResult.error.flatten(),
            )}`,
          },
        ],
        isError: true,
      };
    }

    const ctx = ctxFactory();
    try {
      return await tool.handler(parseResult.data, ctx);
    } catch (err) {
      // Surface errors as MCP error responses rather than propagating
      // to the transport layer. Caller can still distinguish via isError.
      // This message reaches clients verbatim: handlers must never throw
      // errors carrying credentials or foreign paths. PipelineError messages
      // are status-coded only — httpResponseToError logs the raw upstream body
      // server-side rather than embedding it here (L3).
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `${req.params.name} failed: ${message}` }],
        isError: true,
      };
    }
  });
}
