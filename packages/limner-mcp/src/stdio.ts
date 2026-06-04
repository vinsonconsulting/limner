#!/usr/bin/env node
// Stdio entry point. For Claude Desktop, local dev, and the .mcpb
// bundle. Labeled "preview" at v1 per D-RA-05 amendment — the
// MCP 2026-07-28 final spec compatibility lands in a v1.1 refresh,
// not here.
//
// Refs: D-RA-05

import process from 'node:process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLocalBindings } from '@limner/core';

import { createServer, registerTools, type ToolContext } from './server.js';
import { pipelineTools } from './tools/pipelines.js';
import { composeTool } from './tools/compose.js';
import { memoryTools } from './tools/memory.js';
import { projectTools } from './tools/context.js';
import { metaTools } from './tools/meta.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Schema path lookup:
//   - LIMNER_SCHEMA_PATH overrides everything.
//   - Otherwise the published package's dist/ tree expects the schema
//     adjacent to it; in the workspace the schema is at the repo root.
function resolveSchemaPath(): string {
  if (process.env['LIMNER_SCHEMA_PATH']) return process.env['LIMNER_SCHEMA_PATH'];
  // dist/stdio.js -> packages/limner-mcp/dist -> packages/limner-mcp -> packages -> repo root.
  return resolve(__dirname, '../../../migrations/0001_initial_schema.sql');
}

function resolveDbPath(): string {
  if (process.env['LIMNER_DB_PATH']) return process.env['LIMNER_DB_PATH'];
  return `${homedir()}/.limner/limner.db`;
}

async function main(): Promise<void> {
  const bindings = createLocalBindings({
    dbPath: resolveDbPath(),
    schemaPath: resolveSchemaPath(),
  });

  const server = createServer('limner-mcp (preview)', '1.0.0');

  registerTools(
    server,
    [...pipelineTools, composeTool, ...memoryTools, ...projectTools, ...metaTools],
    (): ToolContext => ({
      bindings,
      secrets: Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => typeof v === 'string'),
      ) as Readonly<Record<string, string>>,
      // No IMAGES binding in stdio mode; compose's cf-* ops self-report
      // unsupported_in_stdio (see tools/compose.ts).
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive; StdioServerTransport doesn't auto-block.
  // The process exits when stdin closes (parent disconnects).
}

main().catch((err) => {
  process.stderr.write(`limner-mcp stdio: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
