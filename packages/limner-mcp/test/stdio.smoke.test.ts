import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STDIO_BIN = resolve(__dirname, '../dist/stdio.js');
const SCHEMA_PATH = resolve(__dirname, '../../../migrations/0001_initial_schema.sql');

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(`${tmpdir()}/limner-mcp-stdio-`);
  dbPath = `${tempDir}/limner.db`;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('stdio entry point smoke', () => {
  test(
    'spawned subprocess responds to tools/list with the full Phase 4 registry',
    { timeout: 30_000 },
    async () => {
      // Connect via StdioClientTransport — the same primitive Recraft's
      // adapter uses. The transport spawns the binary, frames JSON-RPC
      // over stdio, and exposes the standard MCP Client interface.
      const transport = new StdioClientTransport({
        command: 'node',
        args: [STDIO_BIN],
        env: {
          LIMNER_DB_PATH: dbPath,
          LIMNER_SCHEMA_PATH: SCHEMA_PATH,
          PATH: process.env['PATH'] ?? '',
        },
      });
      const client = new Client({ name: 'smoke-test', version: '0.0.1' }, { capabilities: {} });
      await client.connect(transport);
      try {
        const result = await client.listTools();
        // 18 tools total: 5 pipeline (incl. upscale + vectorize) + 1 compose + 4 memory + 4 project + 4 meta.
        const names = result.tools.map((t) => t.name).sort();
        expect(names).toEqual(
          [
            'limner_compose',
            'limner_create_project',
            'limner_forget',
            'limner_generate_dalle',
            'limner_generate_midjourney',
            'limner_generate_recraft',
            'limner_get_project_context',
            'limner_health',
            'limner_list_categories',
            'limner_list_pipelines',
            'limner_list_projects',
            'limner_pipeline_capabilities',
            'limner_recall',
            'limner_record',
            'limner_record_project_note',
            'limner_upscale',
            'limner_vectorize',
            'limner_version',
          ],
        );
        // A5: behavioral annotations round-trip through the wire. Read-only
        // tools advertise readOnlyHint; generate_* hit external APIs
        // (open-world); forget is destructive.
        const byName = new Map(result.tools.map((t) => [t.name, t]));
        expect(byName.get('limner_recall')?.annotations?.readOnlyHint).toBe(true);
        expect(byName.get('limner_generate_dalle')?.annotations?.readOnlyHint).toBe(false);
        expect(byName.get('limner_generate_dalle')?.annotations?.openWorldHint).toBe(true);
        expect(byName.get('limner_forget')?.annotations?.destructiveHint).toBe(true);
      } finally {
        await client.close();
      }
    },
  );

  test(
    'boots on the embedded schema when LIMNER_SCHEMA_PATH is unset (r2)',
    { timeout: 30_000 },
    async () => {
      // The packed .mcpb / published npm artifact has no migrations/
      // directory — the embedded INITIAL_SCHEMA_SQL default must carry
      // boot. (The packed-bundle equivalent runs in scripts/smoke-mcpb.mjs.)
      const transport = new StdioClientTransport({
        command: 'node',
        args: [STDIO_BIN],
        env: {
          LIMNER_DB_PATH: dbPath,
          PATH: process.env['PATH'] ?? '',
        },
      });
      const client = new Client({ name: 'smoke-test', version: '0.0.1' }, { capabilities: {} });
      await client.connect(transport);
      try {
        const result = await client.listTools();
        expect(result.tools.length).toBeGreaterThanOrEqual(15);
        // A real DB round-trip proves the schema actually applied.
        const recall = await client.callTool({ name: 'limner_recall', arguments: {} });
        expect(recall.isError).toBeFalsy();
      } finally {
        await client.close();
      }
    },
  );

  test(
    'health tool round-trip through stdio',
    { timeout: 30_000 },
    async () => {
      const transport = new StdioClientTransport({
        command: 'node',
        args: [STDIO_BIN],
        env: {
          LIMNER_DB_PATH: dbPath,
          LIMNER_SCHEMA_PATH: SCHEMA_PATH,
          PATH: process.env['PATH'] ?? '',
        },
      });
      const client = new Client({ name: 'smoke-test', version: '0.0.1' }, { capabilities: {} });
      await client.connect(transport);
      try {
        const result = await client.callTool({ name: 'limner_health', arguments: {} });
        const r = result as {
          content: Array<{ text?: string }>;
          structuredContent?: Record<string, unknown>;
        };
        const payload = r.structuredContent ?? JSON.parse(r.content[0]!.text!);
        expect(payload['status']).toBe('ok');
        expect(payload['bindings']).toBe('local');
        expect(payload['hasImages']).toBe(false);
      } finally {
        await client.close();
      }
    },
  );
});
