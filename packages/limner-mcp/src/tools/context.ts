// Project context tools: list_projects, get_project_context,
// record_project_note. Wrap @limner/core's ProjectStore.
//
// Refs: D-RA-04, D-RA-15

import { z } from 'zod';
import { createProjectStore } from '@limner/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { Tool, ToolContext } from '../server.js';

function structured(payload: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

const listInputSchema = z.object({
  q: z.string().optional().describe('Substring match against project.name.'),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

const listProjects: Tool<z.infer<typeof listInputSchema>> = {
  name: 'list_projects',
  description: 'Return projects matching the given filters.',
  inputSchema: listInputSchema,
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
  name: 'get_project_context',
  description:
    'Return a project plus its recent notes. Identify by projectId or name.',
  inputSchema: getContextInputSchema,
  handler: async (input, ctx) => {
    const store = createProjectStore(ctx.bindings);
    const project = input.projectId
      ? await store.get(input.projectId)
      : await store.getByName(input.name!);
    if (!project) {
      return {
        content: [{ type: 'text', text: 'project not found' }],
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
  name: 'record_project_note',
  description: 'Append a note to a project. Returns the new note (id + timestamp).',
  inputSchema: recordNoteInputSchema,
  handler: async (input, ctx) => {
    const store = createProjectStore(ctx.bindings);
    const note = await store.addNote(input);
    return structured({ note });
  },
};

export const projectTools: readonly Tool[] = [
  listProjects,
  getProjectContext,
  recordProjectNote,
] as const;
