#!/usr/bin/env node
// Stdio entry point. For Claude Desktop, local dev, and the .mcpb
// bundle. Labeled "preview" at v1 per D-RA-05 amendment — the
// MCP 2026-07-28 final spec compatibility lands in a v1.1 refresh,
// not here.
//
// Refs: D-RA-05

import process from 'node:process';
import { homedir } from 'node:os';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLocalBindings, INITIAL_SCHEMA_SQL } from '@limner/core';

import { createServer, registerTools, type ToolContext } from './server.js';
import { VERSION } from './version.js';
import { initComposeWasmNode } from './wasm-init-node.js';
import { pipelineTools } from './tools/pipelines.js';
import { composeTool } from './tools/compose.js';
import { memoryTools } from './tools/memory.js';
import { projectTools } from './tools/context.js';
import { metaTools } from './tools/meta.js';
import { resources, registerResources } from './resources/index.js';
import { prompts, registerPrompts } from './prompts/index.js';

// Schema selection (review r2):
//   - LIMNER_SCHEMA_PATH overrides everything (advanced/dev escape hatch).
//   - Default: the schema generated into @limner/core at build time.
//     The old default resolved a repo-relative path that exists in the
//     workspace but NOT in the packed .mcpb / published npm artifact —
//     ENOENT on every end-user install.
function schemaOption(): { schemaSql: string } | { schemaPath: string } {
  const override = process.env['LIMNER_SCHEMA_PATH'];
  if (override) return { schemaPath: override };
  return { schemaSql: INITIAL_SCHEMA_SQL };
}

function resolveDbPath(): string {
  if (process.env['LIMNER_DB_PATH']) return process.env['LIMNER_DB_PATH'];
  return `${homedir()}/.limner/limner.db`;
}

async function main(): Promise<void> {
  // Eager WASM init for compose's jsquash/resvg ops (review r1). A
  // resolution failure here is fatal-by-design: better a clear boot
  // error than a broken limner_compose at first invocation.
  await initComposeWasmNode();

  const bindings = createLocalBindings({
    dbPath: resolveDbPath(),
    ...schemaOption(),
  });

  const server = createServer('limner-mcp (preview)', VERSION);

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

  // Guidance-derived surfaces (D-RA-24). Pure data — no ToolContext needed.
  registerResources(server, resources);
  registerPrompts(server, prompts);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive; StdioServerTransport doesn't auto-block.
  // The process exits when stdin closes (parent disconnects).
}

main().catch((err) => {
  process.stderr.write(`limner-mcp stdio: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
