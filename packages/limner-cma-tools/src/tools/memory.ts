// Memory tools: recall, record, forget, list_categories.
// Wrap @limner/core's MemoryStore. `requires: (env) => Boolean(env.DB)`
// gates each on the consuming Worker's D1 binding.
//
// Refs: D-RA-04, D-RA-12, D-RA-15

import type { D1Database } from '@cloudflare/workers-types';
import { createMemoryStore } from '@limner/core';
import { memoryTools as mcpMemoryTools } from '@limner/mcp';
import type { z } from 'zod';

import { defineTool, type CustomTool } from '../runtime.js';

function schemaFor(name: string): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const t = mcpMemoryTools.find((x) => x.name === name);
  if (!t) throw new Error(`cma-tools/memory: schema lookup failed for "${name}"`);
  return t.inputSchema as z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

function bindings(env: Record<string, unknown>) {
  return { kind: 'workers' as const, DB: env['DB'] as D1Database };
}

const recall: CustomTool = defineTool({
  name: 'recall',
  description: 'List memory entries matching q / category / since / until / limit / offset filters.',
  inputSchema: schemaFor('recall'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createMemoryStore(bindings(env));
    const entries = await store.recall(input as Parameters<typeof store.recall>[0]);
    return JSON.stringify({ entries, count: entries.length });
  },
});

const record: CustomTool = defineTool({
  name: 'record',
  description: 'Persist a new memory entry. Returns the assigned id + timestamps. Idempotent via sourceId.',
  inputSchema: schemaFor('record'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createMemoryStore(bindings(env));
    const entry = await store.record(input as Parameters<typeof store.record>[0]);
    return JSON.stringify({ entry });
  },
});

const forget: CustomTool = defineTool({
  name: 'forget',
  description: 'Delete a memory entry by id. Returns { deleted: boolean }.',
  inputSchema: schemaFor('forget'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createMemoryStore(bindings(env));
    const deleted = await store.forget(String((input as { id: string }).id));
    return JSON.stringify({ deleted });
  },
});

const listCategories: CustomTool = defineTool({
  name: 'list_categories',
  description: 'Return all memory categories with their entry counts.',
  inputSchema: schemaFor('list_categories'),
  requires: (env) => Boolean(env['DB']),
  run: async (_, { env }) => {
    const store = createMemoryStore(bindings(env));
    const categories = await store.listCategories();
    return JSON.stringify({ categories });
  },
});

export const memoryTools: readonly CustomTool[] = [recall, record, forget, listCategories] as const;
