// Memory tools: limner_recall, limner_record, limner_forget, limner_list_categories.
// Wrap @limner/core's MemoryStore (D1 + LocalSQLite parity-tested).
//
// Refs: D-RA-04, D-RA-15

import { z } from 'zod';
import { createMemoryStore } from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { type Tool, READ_ONLY } from '../server.js';

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
  name: 'limner_recall',
  description: 'List memory entries matching the given filters.',
  inputSchema: recallInputSchema,
  annotations: READ_ONLY,
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
  name: 'limner_record',
  description: 'Persist a new memory entry. Returns the assigned id + timestamps.',
  inputSchema: recordInputSchema,
  // Writes durable state. NOT idempotent in general: the sourceId upsert
  // only applies when the caller supplies one; a plain record appends a
  // fresh entry every call (precedent: recordProjectNote). r5 corrected
  // this from an unconditional idempotentHint: true.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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
  name: 'limner_forget',
  description: 'Delete a memory entry by id. Returns { deleted: boolean }.',
  inputSchema: forgetInputSchema,
  // Destructive (deletes), but idempotent — deleting an absent id is a no-op.
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const store = createMemoryStore(ctx.bindings);
    const deleted = await store.forget(input.id);
    return structured({ deleted });
  },
};

const listCategories: Tool<Record<string, never>> = {
  name: 'limner_list_categories',
  description: 'Return all memory categories with their entry counts.',
  inputSchema: z.object({}).strict(),
  annotations: READ_ONLY,
  handler: async (_, ctx) => {
    const store = createMemoryStore(ctx.bindings);
    const categories = await store.listCategories();
    return structured({ categories });
  },
};

export const memoryTools: readonly Tool[] = [recall, record, forget, listCategories] as const;
