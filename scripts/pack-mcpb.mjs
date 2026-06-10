#!/usr/bin/env node
// .mcpb pack flow (review r2).
//
// Packing straight from packages/limner-mcp/ never produced a bootable
// bundle under pnpm's isolated node_modules: `mcpb pack` dereferences the
// direct-dep symlinks but every transitive dep lives only in the root
// .pnpm store, so the packed server died at import time
// (ERR_MODULE_NOT_FOUND — first casualty: @cf-wasm/internals via
// @cf-wasm/photon). The fix is to pack a `pnpm deploy` output instead:
// a self-contained production install of @limner/mcp with the FULL
// dependency closure as real, flat (hoisted) directories — no symlinks
// for the pack walker to mangle, no devDependencies dead weight.
//
// Usage: node scripts/pack-mcpb.mjs <output.mcpb>

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/pack-mcpb.mjs <output.mcpb>');
  process.exit(2);
}
const outAbs = isAbsolute(out) ? out : resolve(process.cwd(), out);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(repoRoot, 'packages/limner-mcp');

if (!existsSync(join(pkgDir, 'dist/stdio.js'))) {
  console.error('pack-mcpb: packages/limner-mcp/dist is missing — run `pnpm -r build` first');
  process.exit(1);
}

const deployDir = mkdtempSync(join(tmpdir(), 'limner-mcpb-deploy-'));
try {
  // --legacy: pnpm v10 deploy without inject-workspace-packages.
  // node-linker=hoisted: flat real directories (npm-style), which is the
  // only layout that survives mcpb pack's symlink-dereferencing walker.
  execFileSync(
    'pnpm',
    ['--filter', '@limner/mcp', '--prod', 'deploy', '--legacy', deployDir],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, npm_config_node_linker: 'hoisted' },
    },
  );

  // pnpm deploy copies the package's `files:` set; the pack-time ignore
  // rules live outside it.
  copyFileSync(join(pkgDir, '.mcpbignore'), join(deployDir, '.mcpbignore'));

  execFileSync(
    join(pkgDir, 'node_modules/.bin/mcpb'),
    ['pack', deployDir, outAbs],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  console.log(`pack-mcpb: OK — ${outAbs}`);
} finally {
  rmSync(deployDir, { recursive: true, force: true });
}
