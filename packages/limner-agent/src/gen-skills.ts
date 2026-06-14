// Skill generator (D-RA-24). The ONLY file in this package that touches
// node:fs. Reads skills/file-types/SKILL.md, splices in the guidance-derived
// block, and writes it back.
//
// Run via `pnpm --filter @limner/limner-agent gen:skills`, which executes the
// BUILT dist/gen-skills.js — the source uses `.js` import specifiers (repo
// convention), which only resolve once compiled. @limner/core must be built
// first (it is, under `pnpm -r build`).
//
// Not exported from src/index.ts: keeps node:fs out of the package's public
// surface and out of any consumer bundle.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { generatedBlock, spliceGenerated } from './skill-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
// From dist/gen-skills.js up one level to the package root, then into skills/.
const SKILL_PATH = resolve(here, '../skills/file-types/SKILL.md');

const existing = readFileSync(SKILL_PATH, 'utf8');
const next = spliceGenerated(existing, generatedBlock());

if (next !== existing) {
  writeFileSync(SKILL_PATH, next);
  process.stdout.write(`gen:skills: updated ${SKILL_PATH}\n`);
} else {
  process.stdout.write(`gen:skills: ${SKILL_PATH} already up to date\n`);
}
