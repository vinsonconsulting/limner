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
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
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

  // n1+n2: the bundle must be pure JS/WASM. A native addon anywhere in
  // the closure means a platform/ABI-specific dep (better-sqlite3, or
  // the `agents` graph's vite/rolldown/lightningcss peer chain) crept
  // back in, breaking installs on any OS other than the CI host's.
  const nativeAddons = readdirSync(tmp, { recursive: true })
    .filter((p) => String(p).endsWith('.node'));
  if (nativeAddons.length > 0) {
    throw new Error(`expected zero native addons in the bundle, found: ${nativeAddons.slice(0, 5).join(', ')}`);
  }

  // n2: `dependencies` must equal the stdio runtime closure. Workers-only
  // packages are bundled by wrangler from source at build time and live
  // in devDependencies — they must never ship in the .mcpb.
  const mustBeAbsent = ['agents', '@ai-sdk', '@cloudflare/workers-oauth-provider'];
  const mustBePresent = ['@modelcontextprotocol/sdk', 'zod', '@limner/core',
    '@cf-wasm/photon', '@jsquash/png', '@resvg/resvg-wasm', 'satori'];
  for (const dep of mustBeAbsent) {
    if (existsSync(join(tmp, 'node_modules', dep))) {
      throw new Error(`worker-only dep leaked into the bundle: ${dep}`);
    }
  }
  for (const dep of mustBePresent) {
    if (!existsSync(join(tmp, 'node_modules', dep))) {
      throw new Error(`stdio runtime dep missing from the bundle: ${dep}`);
    }
  }

  const topLevelDeps = readdirSync(join(tmp, 'node_modules'))
    .filter((d) => !d.startsWith('.')).length;
  console.log(`smoke-mcpb: bundle ${(statSync(bundle).size / 1048576).toFixed(1)} MiB, ${topLevelDeps} top-level packages in the closure`);

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
