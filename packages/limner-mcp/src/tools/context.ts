// Project context tools: limner_create_project, limner_list_projects,
// limner_get_project_context, limner_record_project_note. Wrap @limner/core's
// ProjectStore.
//
// Refs: D-RA-04, D-RA-15, F5

import { z } from 'zod';
import { createProjectStore } from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { type Tool, READ_ONLY } from '../server.js';

function structured(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

const createInputSchema = z.object({
  name: z.string().min(1).describe('Unique project name (the human-facing key).'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createProject: Tool<z.infer<typeof createInputSchema>> = {
  name: 'limner_create_project',
  description:
    'Create a project so notes and context can be attached to it. Returns the new project (id + timestamps). Names are unique.',
  inputSchema: createInputSchema,
  // Inserts a new row — non-idempotent (a duplicate name is rejected), non-destructive.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const store = createProjectStore(ctx.bindings);
    // Report a unique-name collision cleanly instead of letting the UNIQUE
    // constraint surface as a raw D1_ERROR (mirrors get_project_context's
    // tool-layer error shaping).
    if (await store.getByName(input.name)) {
      return {
        content: [{ type: 'text', text: `project already exists: ${input.name}` }],
        isError: true,
      };
    }
    const project = await store.create(input);
    return structured({ project });
  },
};

const listInputSchema = z.object({
  q: z.string().optional().describe('Substring match against project.name.'),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const listProjects: Tool<z.infer<typeof listInputSchema>> = {
  name: 'limner_list_projects',
  description: 'Return projects matching the given filters.',
  inputSchema: listInputSchema,
  annotations: READ_ONLY,
  handler: async (input, ctx) => {
    const store = createProjectStore(ctx.bindings);
    const projects = await store.list(input);
    return structured({ projects, count: projects.length });
  },
};

const getContextInputSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().optional(),
  noteLimit: z.number().int().min(0).max(500).optional()
    .describe('Number of recent notes to include. Defaults to 10.'),
}).refine((d) => d.projectId !== undefined || d.name !== undefined, {
  message: 'Either projectId or name is required.',
});

const getProjectContext: Tool<z.infer<typeof getContextInputSchema>> = {
  name: 'limner_get_project_context',
  description:
    'Return a project plus its recent notes. Identify by projectId or name.',
  inputSchema: getContextInputSchema,
  annotations: READ_ONLY,
  handler: async (input, ctx) => {
    const store = createProjectStore(ctx.bindings);
    const project = input.projectId
      ? await store.get(input.projectId)
      : await store.getByName(input.name!);
    if (!project) {
      return {
        content: [{ type: 'text', text: `project not found: ${input.projectId ?? input.name}` }],
        isError: true,
      };
    }
    const noteLimit = input.noteLimit ?? 10;
    const notes = noteLimit > 0
      ? await store.listNotes(project.id, { limit: noteLimit })
      : [];
    return structured({ project, notes });
  },
};

const recordNoteInputSchema = z.object({
  projectId: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const recordProjectNote: Tool<z.infer<typeof recordNoteInputSchema>> = {
  name: 'limner_record_project_note',
  description: 'Append a note to a project. Returns the new note (id + timestamp).',
  inputSchema: recordNoteInputSchema,
  // Appends a new note each call — not idempotent, but non-destructive.
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const store = createProjectStore(ctx.bindings);
    const note = await store.addNote(input);
    return structured({ note });
  },
};

export const projectTools: readonly Tool[] = [
  createProject,
  listProjects,
  getProjectContext,
  recordProjectNote,
] as const;
