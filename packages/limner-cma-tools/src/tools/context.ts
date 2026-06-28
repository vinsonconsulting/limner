// Project context tools: limner_create_project, limner_list_projects,
// limner_get_project_context, limner_record_project_note. Wrap @limner/core's
// ProjectStore. D1-gated.
//
// Refs: D-RA-04, D-RA-12, F5

import type { D1Database } from '@cloudflare/workers-types';
import { createProjectStore } from '@limner/core';
import { projectTools as mcpProjectTools } from '@limner/mcp';
import type { z } from 'zod';

import { defineTool, type CustomTool } from '../runtime.js';

function schemaFor(name: string): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const t = mcpProjectTools.find((x) => x.name === name);
  if (!t) throw new Error(`cma-tools/context: schema lookup failed for "${name}"`);
  return t.inputSchema as z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

function bindings(env: Record<string, unknown>) {
  return { kind: 'workers' as const, DB: env['DB'] as D1Database };
}

const createProject: CustomTool = defineTool({
  name: 'limner_create_project',
  description:
    'Create a project so notes and context can be attached to it. Returns the new project. Names are unique.',
  inputSchema: schemaFor('limner_create_project'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createProjectStore(bindings(env));
    const i = input as { name: string; description?: string; metadata?: Record<string, unknown> };
    // Report a unique-name collision cleanly (mirrors the MCP tool).
    if (await store.getByName(i.name)) {
      return JSON.stringify({ error: `project already exists: ${i.name}` });
    }
    const project = await store.create(i);
    return JSON.stringify({ project });
  },
});

const listProjects: CustomTool = defineTool({
  name: 'limner_list_projects',
  description: 'Return projects matching q / limit / offset filters.',
  inputSchema: schemaFor('limner_list_projects'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createProjectStore(bindings(env));
    const projects = await store.list(input as Parameters<typeof store.list>[0]);
    return JSON.stringify({ projects, count: projects.length });
  },
});

const getProjectContext: CustomTool = defineTool({
  name: 'limner_get_project_context',
  description: 'Return a project plus its recent notes. Identify by projectId or name.',
  inputSchema: schemaFor('limner_get_project_context'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createProjectStore(bindings(env));
    const i = input as { projectId?: string; name?: string; noteLimit?: number };
    const project = i.projectId ? await store.get(i.projectId) : await store.getByName(i.name!);
    if (!project) return JSON.stringify({ error: 'project not found' });
    const noteLimit = i.noteLimit ?? 10;
    const notes = noteLimit > 0 ? await store.listNotes(project.id, { limit: noteLimit }) : [];
    return JSON.stringify({ project, notes });
  },
});

const recordProjectNote: CustomTool = defineTool({
  name: 'limner_record_project_note',
  description: 'Append a note to a project. Returns the new note (id + timestamp).',
  inputSchema: schemaFor('limner_record_project_note'),
  requires: (env) => Boolean(env['DB']),
  run: async (input, { env }) => {
    const store = createProjectStore(bindings(env));
    const note = await store.addNote(input as Parameters<typeof store.addNote>[0]);
    return JSON.stringify({ note });
  },
});

export const projectTools: readonly CustomTool[] = [
  createProject,
  listProjects,
  getProjectContext,
  recordProjectNote,
] as const;
