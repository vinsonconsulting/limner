import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLocalBindings, type Bindings } from '@limner/core';

import { createServer, registerTools, type Tool, type ToolContext } from '../../src/server.js';
import { memoryTools } from '../../src/tools/memory.js';
import { projectTools } from '../../src/tools/context.js';
import { metaTools } from '../../src/tools/meta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// limner-mcp/test/tools -> limner-mcp/test -> limner-mcp -> packages -> repo root.
const SCHEMA_PATH = resolve(__dirname, '../../../../migrations/0001_initial_schema.sql');

let bindings: Bindings;

beforeEach(() => {
  bindings = createLocalBindings({ schemaPath: SCHEMA_PATH });
});

afterEach(() => {
  if (bindings.kind === 'local') bindings.db.close();
});

async function connectedPair(tools: readonly Tool[]) {
  const ctx: ToolContext = { bindings, secrets: {} };
  const server = createServer('test', '0.0.1');
  registerTools(server, tools, () => ctx);
  const [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  const client = new Client({ name: 'test-client', version: '0.0.1' }, { capabilities: {} });
  await client.connect(c);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function parseStructured(result: unknown): Record<string, unknown> {
  const r = result as { structuredContent?: Record<string, unknown>; content: Array<{ text?: string }> };
  if (r.structuredContent) return r.structuredContent;
  return JSON.parse(r.content[0]!.text!);
}

// ---------------- Memory ----------------

describe('memory tools', () => {
  test('record + recall round-trip via MCP', async () => {
    const { client, close } = await connectedPair(memoryTools);
    try {
      const recorded = await client.callTool({
        name: 'record',
        arguments: { content: 'project decision: use D1', category: 'adr' },
      });
      const recordedPayload = parseStructured(recorded);
      const entry = (recordedPayload['entry'] as { id: string; content: string });
      expect(entry.id).toBeTruthy();
      expect(entry.content).toBe('project decision: use D1');

      const recalled = await client.callTool({
        name: 'recall',
        arguments: { category: 'adr' },
      });
      const payload = parseStructured(recalled);
      expect(payload['count']).toBe(1);
      expect((payload['entries'] as Array<{ id: string }>)[0]!.id).toBe(entry.id);
    } finally {
      await close();
    }
  });

  test('forget removes the entry', async () => {
    const { client, close } = await connectedPair(memoryTools);
    try {
      const recorded = await client.callTool({
        name: 'record',
        arguments: { content: 'forgettable' },
      });
      const entry = (parseStructured(recorded)['entry'] as { id: string });

      const forgotten = await client.callTool({ name: 'forget', arguments: { id: entry.id } });
      expect(parseStructured(forgotten)['deleted']).toBe(true);

      const after = await client.callTool({ name: 'recall', arguments: {} });
      expect(parseStructured(after)['count']).toBe(0);
    } finally {
      await close();
    }
  });

  test('list_categories returns counts per category', async () => {
    const { client, close } = await connectedPair(memoryTools);
    try {
      for (const cat of ['adr', 'adr', 'note']) {
        await client.callTool({
          name: 'record',
          arguments: { content: `entry for ${cat}`, category: cat },
        });
      }
      const result = await client.callTool({ name: 'list_categories', arguments: {} });
      const payload = parseStructured(result);
      const categories = payload['categories'] as Array<{ category: string; count: number }>;
      const adr = categories.find((c) => c.category === 'adr');
      const note = categories.find((c) => c.category === 'note');
      expect(adr?.count).toBe(2);
      expect(note?.count).toBe(1);
    } finally {
      await close();
    }
  });
});

// ---------------- Projects ----------------

describe('project tools', () => {
  test('list_projects returns recorded projects', async () => {
    const { createProjectStore } = await import('@limner/core');
    const store = createProjectStore(bindings);
    await store.create({ name: 'rasa' });
    await store.create({ name: 'pixel' });

    const { client, close } = await connectedPair(projectTools);
    try {
      const result = await client.callTool({ name: 'list_projects', arguments: {} });
      const payload = parseStructured(result);
      expect(payload['count']).toBe(2);
      const names = (payload['projects'] as Array<{ name: string }>).map((p) => p.name);
      expect(names).toContain('rasa');
      expect(names).toContain('pixel');
    } finally {
      await close();
    }
  });

  test('get_project_context returns project + recent notes', async () => {
    const { createProjectStore } = await import('@limner/core');
    const store = createProjectStore(bindings);
    const rasa = await store.create({ name: 'rasa', description: 'foundation' });
    await store.addNote({ projectId: rasa.id, content: 'first note' });
    await store.addNote({ projectId: rasa.id, content: 'second note' });

    const { client, close } = await connectedPair(projectTools);
    try {
      const result = await client.callTool({
        name: 'get_project_context',
        arguments: { name: 'rasa' },
      });
      const payload = parseStructured(result);
      expect((payload['project'] as { name: string }).name).toBe('rasa');
      expect((payload['notes'] as unknown[]).length).toBe(2);
    } finally {
      await close();
    }
  });

  test('get_project_context returns isError when project missing', async () => {
    const { client, close } = await connectedPair(projectTools);
    try {
      const result = await client.callTool({
        name: 'get_project_context',
        arguments: { name: 'does-not-exist' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });

  test('record_project_note appends to a project', async () => {
    const { createProjectStore } = await import('@limner/core');
    const store = createProjectStore(bindings);
    const rasa = await store.create({ name: 'rasa' });

    const { client, close } = await connectedPair(projectTools);
    try {
      const result = await client.callTool({
        name: 'record_project_note',
        arguments: { projectId: rasa.id, content: 'a new note' },
      });
      const payload = parseStructured(result);
      expect((payload['note'] as { content: string }).content).toBe('a new note');
    } finally {
      await close();
    }
  });
});

// ---------------- Meta ----------------

describe('meta tools', () => {
  test('health returns bindings flavor + ok status', async () => {
    const { client, close } = await connectedPair(metaTools);
    try {
      const result = await client.callTool({ name: 'health', arguments: {} });
      const payload = parseStructured(result);
      expect(payload['status']).toBe('ok');
      expect(payload['bindings']).toBe('local');
      expect(payload['hasImages']).toBe(false);
      expect(typeof payload['timestamp']).toBe('string');
    } finally {
      await close();
    }
  });

  test('version returns the server version', async () => {
    const { client, close } = await connectedPair(metaTools);
    try {
      const result = await client.callTool({ name: 'version', arguments: {} });
      const payload = parseStructured(result);
      expect(typeof payload['version']).toBe('string');
    } finally {
      await close();
    }
  });

  test('list_pipelines returns the three rasa pipelines', async () => {
    const { client, close } = await connectedPair(metaTools);
    try {
      const result = await client.callTool({ name: 'list_pipelines', arguments: {} });
      const payload = parseStructured(result);
      const pipelines = payload['pipelines'] as Array<{ id: string; kind: string }>;
      const ids = pipelines.map((p) => p.id).sort();
      expect(ids).toEqual(['dalle', 'midjourney', 'recraft']);
    } finally {
      await close();
    }
  });

  test('pipeline_capabilities for a known pipeline', async () => {
    const { client, close } = await connectedPair(metaTools);
    try {
      const result = await client.callTool({
        name: 'pipeline_capabilities',
        arguments: { id: 'recraft' },
      });
      const payload = parseStructured(result);
      expect(payload['id']).toBe('recraft');
      expect(payload['kind']).toBe('mcp-adapter');
      expect(payload['requiredSecrets']).toEqual(['RECRAFT_API_KEY']);
    } finally {
      await close();
    }
  });

  test('pipeline_capabilities for an unknown pipeline -> isError', async () => {
    const { client, close } = await connectedPair(metaTools);
    try {
      const result = await client.callTool({
        name: 'pipeline_capabilities',
        arguments: { id: 'nonsense' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await close();
    }
  });
});
