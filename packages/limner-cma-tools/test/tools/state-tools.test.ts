import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';

import { memoryTools } from '../../src/tools/memory.js';
import { projectTools } from '../../src/tools/context.js';
import { metaTools } from '../../src/tools/meta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../../../migrations/0001_initial_schema.sql');

let mf: Miniflare;
let db: D1Database;

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch: () => new Response("ok") };',
    d1Databases: ['DB'],
  });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
  const sql = readFileSync(SCHEMA_PATH, 'utf8');
  // D1's bulk runner needs single statements split on ; and stripped of PRAGMAs.
  const statements = sql
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith('PRAGMA'));
  for (const stmt of statements) await db.prepare(stmt).run();
});

afterEach(async () => {
  await mf.dispose();
});

function toolByName(name: string, registry: readonly { name: string }[]) {
  const t = registry.find((x) => x.name === name);
  if (!t) throw new Error(`tool not found: ${name}`);
  return t as unknown as {
    name: string;
    run: (input: unknown, ctx: { env: Record<string, unknown> }) => Promise<string>;
  };
}

const env = () => ({ DB: db });

// ---------------- Memory ----------------

describe('memory cma-tools', () => {
  test('record returns the new entry id + timestamps', async () => {
    const recordTool = toolByName('limner_record', memoryTools);
    const out = await recordTool.run({ content: 'project decision: use D1', category: 'adr' }, { env: env() });
    const parsed = JSON.parse(out);
    expect(parsed.entry.id).toBeTruthy();
    expect(parsed.entry.content).toBe('project decision: use D1');
  });

  test('recall lists matching entries', async () => {
    const recordTool = toolByName('limner_record', memoryTools);
    const recallTool = toolByName('limner_recall', memoryTools);
    await recordTool.run({ content: 'entry 1', category: 'note' }, { env: env() });
    await recordTool.run({ content: 'entry 2', category: 'note' }, { env: env() });
    const out = await recallTool.run({ category: 'note' }, { env: env() });
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(2);
  });

  test('forget deletes the entry', async () => {
    const recordTool = toolByName('limner_record', memoryTools);
    const forgetTool = toolByName('limner_forget', memoryTools);
    const created = JSON.parse(await recordTool.run({ content: 'forgettable' }, { env: env() }));
    const out = await forgetTool.run({ id: created.entry.id }, { env: env() });
    expect(JSON.parse(out).deleted).toBe(true);
  });

  test('list_categories returns counts', async () => {
    const recordTool = toolByName('limner_record', memoryTools);
    const listCategoriesTool = toolByName('limner_list_categories', memoryTools);
    for (const c of ['adr', 'adr', 'note']) {
      await recordTool.run({ content: 'e', category: c }, { env: env() });
    }
    const out = await listCategoriesTool.run({}, { env: env() });
    const cats = JSON.parse(out).categories as Array<{ category: string; count: number }>;
    expect(cats.find((x) => x.category === 'adr')?.count).toBe(2);
    expect(cats.find((x) => x.category === 'note')?.count).toBe(1);
  });
});

// ---------------- Projects ----------------

describe('project cma-tools', () => {
  test('list_projects after a few inserts', async () => {
    const { createProjectStore } = await import('@limner/core');
    const store = createProjectStore({ kind: 'workers', DB: db } as never);
    await store.create({ name: 'rasa' });
    await store.create({ name: 'pixel' });

    const listTool = toolByName('limner_list_projects', projectTools);
    const out = await listTool.run({}, { env: env() });
    const parsed = JSON.parse(out);
    expect(parsed.count).toBe(2);
  });

  test('get_project_context returns project + notes', async () => {
    const { createProjectStore } = await import('@limner/core');
    const store = createProjectStore({ kind: 'workers', DB: db } as never);
    const rasa = await store.create({ name: 'rasa', description: 'foundation' });
    await store.addNote({ projectId: rasa.id, content: 'first note' });

    const getTool = toolByName('limner_get_project_context', projectTools);
    const out = await getTool.run({ name: 'rasa' }, { env: env() });
    const parsed = JSON.parse(out);
    expect(parsed.project.name).toBe('rasa');
    expect(parsed.notes).toHaveLength(1);
  });

  test('record_project_note appends', async () => {
    const { createProjectStore } = await import('@limner/core');
    const store = createProjectStore({ kind: 'workers', DB: db } as never);
    const rasa = await store.create({ name: 'rasa' });
    const recordNoteTool = toolByName('limner_record_project_note', projectTools);
    const out = await recordNoteTool.run({ projectId: rasa.id, content: 'a note' }, { env: env() });
    expect(JSON.parse(out).note.content).toBe('a note');
  });
});

// ---------------- Meta ----------------

describe('meta cma-tools', () => {
  test('health reports surface = cma-tools + binding flags', async () => {
    const tool = toolByName('limner_health', metaTools);
    const out = await tool.run({}, { env: env() });
    const parsed = JSON.parse(out);
    expect(parsed.status).toBe('ok');
    expect(parsed.surface).toBe('cma-tools');
    expect(parsed.hasDb).toBe(true);
    expect(parsed.hasBucket).toBe(false);
  });

  test('list_pipelines returns the three rasa pipelines', async () => {
    const tool = toolByName('limner_list_pipelines', metaTools);
    const out = await tool.run({}, { env: env() });
    const parsed = JSON.parse(out);
    const ids = parsed.pipelines.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual(['dalle', 'midjourney', 'recraft']);
  });

  test('pipeline_capabilities returns details for a known pipeline', async () => {
    const tool = toolByName('limner_pipeline_capabilities', metaTools);
    const out = await tool.run({ id: 'recraft' }, { env: env() });
    const parsed = JSON.parse(out);
    expect(parsed.id).toBe('recraft');
    expect(parsed.kind).toBe('api');
  });

  test('pipeline_capabilities returns error for unknown pipeline', async () => {
    const tool = toolByName('limner_pipeline_capabilities', metaTools);
    const out = await tool.run({ id: 'nonsense' }, { env: env() });
    expect(JSON.parse(out).error).toMatch(/not found/);
  });
});
