#!/usr/bin/env node
// .mcpb boot smoke (review r2).
//
// CI used to validate + pack the bundle but never BOOT it, which let two
// end-user-fatal defects ship: the D1 schema resolved to a path outside
// the pack root (ENOENT on every install), and `mcpb pack`'s symlink
// dereferencing silently dropped transitive deps that live only in
// pnpm's .pnpm store (ERR_MODULE_NOT_FOUND at import time).
//
// This script is the missing gate: unzip the bundle to a temp dir OUTSIDE
// the repo (so the workspace's node_modules and migrations/ can't mask
// packaging holes), boot dist/stdio.js exactly like an MCP client would,
// and assert tools/list returns the full registry. Env deliberately
// excludes LIMNER_SCHEMA_PATH — the embedded-schema default must work.
//
// Usage: node scripts/smoke-mcpb.mjs <path-to-bundle.mcpb>

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const bundle = process.argv[2];
if (!bundle) {
  console.error('usage: node scripts/smoke-mcpb.mjs <path-to-bundle.mcpb>');
  process.exit(2);
}

// Resolve the MCP SDK through @limner/mcp's dependency graph — the root
// package has no direct dependency on it.
const mcpRequire = createRequire(
  new URL('../packages/limner-mcp/package.json', import.meta.url),
);
const { Client } = await import(
  mcpRequire.resolve('@modelcontextprotocol/sdk/client/index.js')
);
const { StdioClientTransport } = await import(
  mcpRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js')
);

const tmp = mkdtempSync(join(tmpdir(), 'limner-mcpb-smoke-'));
let failed = false;
try {
  execFileSync('unzip', ['-q', bundle, '-d', tmp]);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(tmp, 'dist/stdio.js')],
    env: {
      // NO LIMNER_SCHEMA_PATH: the packed bundle must boot on the
      // embedded schema, exactly like an end-user install.
      LIMNER_DB_PATH: join(tmp, 'limner.db'),
      PATH: process.env.PATH ?? '',
    },
    stderr: 'pipe',
  });
  // Surface the subprocess's stderr so a boot crash is diagnosable in CI.
  transport.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  const client = new Client({ name: 'mcpb-smoke', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    if (tools.length < 15) {
      throw new Error(`expected >= 15 tools, got ${tools.length}: ${names.join(', ')}`);
    }
    if (!names.includes('limner_compose')) {
      throw new Error(`limner_compose missing from tools/list: ${names.join(', ')}`);
    }
    console.log(`smoke-mcpb: OK — ${tools.length} tools listed from the packed bundle (db + embedded schema booted)`);
  } finally {
    await client.close();
  }
} catch (err) {
  failed = true;
  console.error(`smoke-mcpb: FAIL — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
