// Memory tools: recall, record, forget, list_categories.
// Wrap @limner/core's MemoryStore (D1 + LocalSQLite parity-tested).
//
// Refs: D-RA-04, D-RA-15

import { z } from 'zod';
import { createMemoryStore } from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { Tool, ToolContext } from '../server.js';

function structured(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

const recallInputSchema = z.object({
  q: z.string().optional().describe('Substring match against memory.content.'),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
  since: z.number().int().optional().describe('Unix epoch (ms). Filter to entries created at/after.'),
  until: z.number().int().optional(),
});

const recall: Tool<z.infer<typeof recallInputSchema>> = {
  name: 'recall',
  description: 'List memory entries matching the given filters.',
  inputSchema: recallInputSchema,
  handler: async (input, ctx) => {
    const store = createMemoryStore(ctx.bindings);
    const entries = await store.recall(input);
    return structured({ entries, count: entries.length });
  },
};

const recordInputSchema = z.object({
  content: z.string().min(1),
  category: z.string().optional(),
  sourceId: z.string().optional().describe('Idempotency key — re-recording with the same sourceId upserts.'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const record: Tool<z.infer<typeof recordInputSchema>> = {
  name: 'record',
  description: 'Persist a new memory entry. Returns the assigned id + timestamps.',
  inputSchema: recordInputSchema,
  handler: async (input, ctx) => {
    const store = createMemoryStore(ctx.bindings);
    const entry = await store.record(input);
    return structured({ entry });
  },
};

const forgetInputSchema = z.object({
  id: z.string().min(1).describe('Memory entry id (ULID).'),
});

const forget: Tool<z.infer<typeof forgetInputSchema>> = {
  name: 'forget',
  description: 'Delete a memory entry by id. Returns { deleted: boolean }.',
  inputSchema: forgetInputSchema,
  handler: async (input, ctx) => {
    const store = createMemoryStore(ctx.bindings);
    const deleted = await store.forget(input.id);
    return structured({ deleted });
  },
};

const listCategories: Tool<Record<string, never>> = {
  name: 'list_categories',
  description: 'Return all memory categories with their entry counts.',
  inputSchema: z.object({}).strict(),
  handler: async (_, ctx) => {
    const store = createMemoryStore(ctx.bindings);
    const categories = await store.listCategories();
    return structured({ categories });
  },
};

export const memoryTools: readonly Tool[] = [recall, record, forget, listCategories] as const;
