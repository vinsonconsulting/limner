// Guard: every tool's *advertised* MCP input_schema must be valid for the
// Anthropic tool API — i.e. `type: "object"` with NO top-level
// `oneOf`/`anyOf`/`allOf`. The Messages API rejects a top-level combinator
// ("input_schema does not support oneOf, allOf, or anyOf at the top level"),
// and through Managed Agents that rejection surfaces as an opaque
// `model_request_failed_error` (0 tokens) the instant the tool loads into a
// model request — the exact `vault_ids` failure fixed in PR #8.
//
// This is the test that would have caught the `limner_compose` discriminated-union
// schema before it ever shipped.

import { describe, expect, test } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { toMcpInputSchema } from '../src/server.js';
import { pipelineTools } from '../src/tools/pipelines.js';
import { composeTool } from '../src/tools/compose.js';
import { memoryTools } from '../src/tools/memory.js';
import { projectTools } from '../src/tools/context.js';
import { metaTools } from '../src/tools/meta.js';

const ALL_TOOLS = [
  ...pipelineTools,
  composeTool,
  ...memoryTools,
  ...projectTools,
  ...metaTools,
];

describe('tool input_schemas are valid for the Anthropic tool API', () => {
  test('all 15 Phase 4 tools are present', () => {
    expect(ALL_TOOLS).toHaveLength(15);
  });

  test.each(ALL_TOOLS.map((t) => [t.name, t] as const))(
    '%s: no top-level oneOf/anyOf/allOf (Path B advertised + Path A source)',
    (_name, tool) => {
      // Path B: the schema advertised via toMcpInputSchema.
      const advertised = toMcpInputSchema(tool.inputSchema) as Record<string, unknown>;
      expect(advertised['type']).toBe('object');
      expect(advertised['oneOf']).toBeUndefined();
      expect(advertised['anyOf']).toBeUndefined();
      expect(advertised['allOf']).toBeUndefined();
      // Path A safety: @limner/cma-tools reuses these source zod schemas and
      // the external CMA template converts them directly (no toMcpInputSchema),
      // so the raw zod->JSON must ALSO be free of a top-level combinator.
      const raw = zodToJsonSchema(tool.inputSchema) as Record<string, unknown>;
      expect(raw['type']).toBe('object');
      expect(raw['oneOf']).toBeUndefined();
      expect(raw['anyOf']).toBeUndefined();
      expect(raw['allOf']).toBeUndefined();
    },
  );

  test('compose advertises a flat object with an `op` enum (no top-level union)', () => {
    const schema = toMcpInputSchema(composeTool.inputSchema) as {
      type?: string;
      properties?: Record<string, { enum?: unknown[] }>;
    };
    expect(schema.type).toBe('object');
    // The op discriminator is exposed as an enum covering every op.
    const opEnum = schema.properties?.['op']?.enum ?? [];
    expect(opEnum).toEqual(
      expect.arrayContaining(['resize', 'crop', 'watermark', 'encode', 'renderText', 'cfTransform']),
    );
  });
});

describe('tool annotations (A5) — behavioral hints', () => {
  // The pure read / discovery surface. Everything else mutates state or
  // calls out to an external service.
  const READ_ONLY = new Set([
    'limner_recall',
    'limner_list_categories',
    'limner_list_projects',
    'limner_get_project_context',
    'limner_health',
    'limner_version',
    'limner_list_pipelines',
    'limner_pipeline_capabilities',
  ]);

  test.each(ALL_TOOLS.map((t) => [t.name, t] as const))(
    '%s: defines annotations whose readOnlyHint matches its category',
    (name, tool) => {
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations?.readOnlyHint).toBe('boolean');
      expect(tool.annotations?.readOnlyHint).toBe(READ_ONLY.has(name));
    },
  );

  test('exactly the 8 read/discovery tools are read-only', () => {
    const readOnly = ALL_TOOLS.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name).sort();
    expect(readOnly).toEqual([...READ_ONLY].sort());
  });

  test('limner_forget is the only destructive tool', () => {
    const destructive = ALL_TOOLS.filter((t) => t.annotations?.destructiveHint).map((t) => t.name);
    expect(destructive).toEqual(['limner_forget']);
  });

  test('only the external-API generate tools are open-world', () => {
    const openWorld = ALL_TOOLS.filter((t) => t.annotations?.openWorldHint).map((t) => t.name).sort();
    expect(openWorld).toEqual(['limner_generate_dalle', 'limner_generate_recraft']);
  });
});
