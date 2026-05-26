// Meta / discovery tools: health, version, list_pipelines,
// pipeline_capabilities. No binding gates — pure tool surface
// reflection (matches Path B's meta surface).
//
// Refs: D-RA-12

import { DallePipeline, MidjourneyPipeline, RecraftPipeline } from '@limner/core';
import { metaTools as mcpMetaTools } from '@limner/mcp';
import type { z } from 'zod';

import { defineTool, type CustomTool } from '../runtime.js';

function schemaFor(name: string): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const t = mcpMetaTools.find((x) => x.name === name);
  if (!t) throw new Error(`cma-tools/meta: schema lookup failed for "${name}"`);
  return t.inputSchema as z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

const SERVER_VERSION = '0.0.1';

function pipelineList() {
  return [
    new MidjourneyPipeline(),
    new DallePipeline(),
    new RecraftPipeline('remote'),
  ];
}

const health: CustomTool = defineTool({
  name: 'health',
  description: 'Server health snapshot — surface flavor, version, timestamp.',
  inputSchema: schemaFor('health'),
  run: async (_, { env }) => {
    return JSON.stringify({
      status: 'ok',
      surface: 'cma-tools',
      hasDb: Boolean(env['DB']),
      hasBucket: Boolean(env['BUCKET']),
      hasImages: Boolean(env['IMAGES']),
      timestamp: new Date().toISOString(),
      version: SERVER_VERSION,
    });
  },
});

const version: CustomTool = defineTool({
  name: 'version',
  description: 'Return the @limner/cma-tools library version.',
  inputSchema: schemaFor('version'),
  run: async () => JSON.stringify({ version: SERVER_VERSION }),
});

const listPipelines: CustomTool = defineTool({
  name: 'list_pipelines',
  description: 'List the pipelines available to this surface. For each pipeline returns id, displayName, kind, and required secrets.',
  inputSchema: schemaFor('list_pipelines'),
  run: async () =>
    JSON.stringify({
      pipelines: pipelineList().map((p) => ({
        id: p.id,
        displayName: p.displayName,
        kind: p.kind,
        requiredSecrets: p.requiredSecrets,
        ...('transport' in p ? { transport: (p as { transport: string }).transport } : {}),
      })),
    }),
});

const pipelineCapabilities: CustomTool = defineTool({
  name: 'pipeline_capabilities',
  description: "Describe a specific pipeline's capability surface (kind / transport / required secrets / input options shape).",
  inputSchema: schemaFor('pipeline_capabilities'),
  run: async (input) => {
    const id = String((input as { id: string }).id);
    const found = pipelineList().find((p) => p.id === id);
    if (!found) return JSON.stringify({ error: `pipeline not found: ${id}` });
    return JSON.stringify({
      id: found.id,
      displayName: found.displayName,
      kind: found.kind,
      requiredSecrets: found.requiredSecrets,
      ...('transport' in found ? { transport: (found as { transport: string }).transport } : {}),
      inputDescription:
        'See generate_' + found.id + ' tool input schema for option details.',
    });
  },
});

export const metaTools: readonly CustomTool[] = [
  health,
  version,
  listPipelines,
  pipelineCapabilities,
] as const;
