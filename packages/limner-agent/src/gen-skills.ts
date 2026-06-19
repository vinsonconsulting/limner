// Skill generator (D-RA-24). The ONLY file in this package that touches
// node:fs. For each entry in SKILL_SOURCES, reads skills/<skillDir>/SKILL.md,
// splices in the guidance-derived block, and writes it back if changed.
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

import { generatedBlock, spliceGenerated, SKILL_SOURCES } from './skill-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
// From dist/gen-skills.js up one level to the package root, then into skills/.
const skillsDir = resolve(here, '../skills');

for (const { skillDir, guidanceId } of SKILL_SOURCES) {
  const skillPath = resolve(skillsDir, skillDir, 'SKILL.md');
  const existing = readFileSync(skillPath, 'utf8');
  const next = spliceGenerated(existing, generatedBlock(guidanceId), guidanceId);
  if (next !== existing) {
    writeFileSync(skillPath, next);
    process.stdout.write(`gen:skills: updated ${skillPath}\n`);
  } else {
    process.stdout.write(`gen:skills: ${skillPath} already up to date\n`);
  }
}
