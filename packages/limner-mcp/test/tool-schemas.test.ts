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
import { composeTool, composeInputSchema } from '../src/tools/compose.js';
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
  test('all 16 tools are present', () => {
    expect(ALL_TOOLS).toHaveLength(16);
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

  // r4: the compose op surface lives in four hand-synced sites (strict
  // union, advertised schema, mcp switch, cma switch). The old sample-based
  // check (arrayContaining over 6 of 16 ops) let an op added to the union
  // but missed in the advertised enum pass CI and silently disappear — the
  // advertised-schema safeParse in registerTools rejects it before the
  // strict union ever runs. Exact-set equality closes that hole.
  test('compose advertised `op` enum EXACTLY equals the strict union op set', () => {
    const schema = toMcpInputSchema(composeTool.inputSchema) as {
      type?: string;
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(schema.type).toBe('object');
    const unionOps = composeInputSchema.options.map((v) => v.shape.op.value).sort();
    const advertisedOps = [...(schema.properties?.['op']?.enum ?? [])].sort();
    expect(advertisedOps).toEqual(unionOps);
    expect(unionOps).toHaveLength(16);
  });

  test('compose advertised property keys cover every strict-union variant key', () => {
    const schema = toMcpInputSchema(composeTool.inputSchema) as {
      properties?: Record<string, unknown>;
    };
    const advertisedKeys = Object.keys(schema.properties ?? {});
    const variantKeys = [...new Set(composeInputSchema.options.flatMap((v) => Object.keys(v.shape)))];
    for (const key of variantKeys) {
      expect(advertisedKeys, `advertised schema is missing variant key "${key}"`).toContain(key);
    }
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

  test('only the external-API tools are open-world', () => {
    const openWorld = ALL_TOOLS.filter((t) => t.annotations?.openWorldHint).map((t) => t.name).sort();
    expect(openWorld).toEqual(['limner_generate_dalle', 'limner_generate_recraft', 'limner_upscale']);
  });

  // r5: exactly the appending/external-effect tools are non-idempotent.
  // limner_record was corrected from an unconditional idempotentHint:true —
  // the sourceId upsert only applies when the caller supplies one; a plain
  // record appends a fresh entry every call (recordProjectNote precedent).
  test('exactly the appending/external tools are non-idempotent', () => {
    const nonIdempotent = ALL_TOOLS
      .filter((t) => t.annotations?.idempotentHint === false)
      .map((t) => t.name)
      .sort();
    expect(nonIdempotent).toEqual([
      'limner_generate_dalle',
      'limner_generate_recraft',
      'limner_record',
      'limner_record_project_note',
      'limner_upscale',
    ]);
  });
});
