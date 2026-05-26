// Local `CustomTool` type mirroring the cloudflare/claude-managed-agents
// template's `defineTool` shape. The template is a template repo (fork
// and customize), not a published npm package — we declare the type
// locally and let consuming Workers import `LIMNER_TOOLS` to populate
// their template's `CUSTOM_TOOLS` array.
//
// Reference: src/tools/custom-tools-runtime.ts in cloudflare/claude-managed-agents.
//
// Refs: D-RA-12 (Path A successor target after dogfood)

import type { z } from 'zod';

/**
 * Minimal run context our tools require. The CMA template passes more
 * (session metadata, abortSignal); we keep the local type narrow so
 * future expansion is opt-in.
 *
 * `env` is the Worker env handed in by the template's tool dispatcher;
 * its shape depends on the consuming Worker's wrangler bindings.
 * Tools narrow the type via their `requires` predicate.
 */
export type CustomToolRunContext = {
  env: Record<string, unknown>;
};

/**
 * Single source of truth for the CMA custom-tool shape. The template's
 * dispatcher invokes `run(parsedInput, ctx)` and expects a `string`
 * return (or a thrown error). For Limner's image-returning tools the
 * string is a JSON envelope containing an R2 URL.
 *
 * `requires` is an optional predicate that hides the tool from the
 * Anthropic catalog when its required bindings are missing — useful
 * for image tools that need `env.BUCKET` (R2) and the consuming
 * Worker hasn't wired it.
 */
export type CustomTool<TIn = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<TIn, z.ZodTypeDef, unknown>;
  requires?: (env: Record<string, unknown>) => boolean;
  run: (input: TIn, ctx: CustomToolRunContext) => Promise<string>;
};

/**
 * Identity helper that captures the tool's input type for type
 * inference. Mirrors the CMA template's `defineTool` so callers can
 * import either name interchangeably.
 */
export function defineTool<TIn>(tool: CustomTool<TIn>): CustomTool<TIn> {
  return tool;
}
