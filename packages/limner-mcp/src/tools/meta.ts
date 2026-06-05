// Meta / discovery tools: limner_health, limner_version, limner_list_pipelines,
// limner_pipeline_capabilities. These don't touch durable state and are
// safe to call without authenticated scopes.
//
// Refs: D-RA-05

import { z } from 'zod';
import { DallePipeline, MidjourneyPipeline, RecraftPipeline } from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { type Tool, READ_ONLY } from '../server.js';
import { VERSION } from '../version.js';

const SERVER_VERSION = VERSION;

function structured(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

// Statically registered pipelines for discovery (the runtime list of
// PipelineRunner instances; matches Phase 2's @limner/core exports).
function pipelineList() {
  return [
    new MidjourneyPipeline(),
    new DallePipeline(),
    new RecraftPipeline('remote'),
  ];
}

const health: Tool<Record<string, never>> = {
  name: 'limner_health',
  description: 'Server health snapshot — bindings flavor, timestamp, version.',
  inputSchema: z.object({}).strict(),
  annotations: READ_ONLY,
  handler: async (_, ctx) => {
    return structured({
      status: 'ok',
      bindings: ctx.bindings.kind,
      hasImages: !!ctx.images,
      timestamp: new Date().toISOString(),
      version: SERVER_VERSION,
    });
  },
};

const version: Tool<Record<string, never>> = {
  name: 'limner_version',
  description: 'Return the @limner/mcp server version.',
  inputSchema: z.object({}).strict(),
  annotations: READ_ONLY,
  handler: async () => structured({ version: SERVER_VERSION }),
};

const listPipelines: Tool<Record<string, never>> = {
  name: 'limner_list_pipelines',
  description: 'List the pipelines registered with this server. For each pipeline returns id, displayName, kind, and required secrets.',
  inputSchema: z.object({}).strict(),
  annotations: READ_ONLY,
  handler: async () =>
    structured({
      pipelines: pipelineList().map((p) => ({
        id: p.id,
        displayName: p.displayName,
        kind: p.kind,
        requiredSecrets: p.requiredSecrets,
        ...('transport' in p ? { transport: (p as { transport: string }).transport } : {}),
      })),
    }),
};

const pipelineCapabilitiesInputSchema = z.object({
  id: z.string().describe('Pipeline id (e.g. "dalle", "midjourney", "recraft").'),
});

const pipelineCapabilities: Tool<z.infer<typeof pipelineCapabilitiesInputSchema>> = {
  name: 'limner_pipeline_capabilities',
  description:
    'Describe a specific pipeline\'s capability surface. Returns kind + transport + required secrets + the input options shape (heuristic; not a strict zod export).',
  inputSchema: pipelineCapabilitiesInputSchema,
  annotations: READ_ONLY,
  handler: async (input) => {
    const found = pipelineList().find((p) => p.id === input.id);
    if (!found) {
      return {
        content: [{ type: 'text', text: `pipeline not found: ${input.id}` }],
        isError: true,
      };
    }
    return structured({
      id: found.id,
      displayName: found.displayName,
      kind: found.kind,
      requiredSecrets: found.requiredSecrets,
      ...('transport' in found ? { transport: (found as { transport: string }).transport } : {}),
      // Note: per-pipeline option shapes live in the tool input schemas
      // (limner_generate_dalle / limner_generate_recraft / limner_generate_midjourney);
      // call tools/list for the full discovery surface.
      inputDescription:
        'See limner_generate_' + found.id + ' tool input schema for option details.',
    });
  },
};

export const metaTools: readonly Tool[] = [
  health,
  version,
  listPipelines,
  pipelineCapabilities,
] as const;
