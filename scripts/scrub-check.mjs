#!/usr/bin/env node
// Pre-public scrub gate (launch S0). Greps every git-tracked file for the
// maintainer's forbidden-string list and fails loudly on any hit.
//
// The pattern list lives in .scrub-patterns at the repo root — one fixed
// string per line, `#` comments and blank lines ignored. That file is
// deliberately gitignored: committing the list would reintroduce the exact
// strings it exists to keep out of the repo. Each maintainer keeps a local
// copy (and a backup outside the repo).
//
// Scope is tracked files only (`git grep`), matching what a public clone
// would actually contain; local untracked files (.env, migrations/generated/)
// are out of scope by design.
//
// Exit codes: 0 clean · 1 forbidden string found · 2 pattern list missing.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const patternFile = join(repoRoot, '.scrub-patterns');

let raw;
try {
  raw = readFileSync(patternFile, 'utf8');
} catch {
  console.error('scrub-check: no .scrub-patterns file at the repo root.');
  console.error(
    'Create it (gitignored) with one forbidden string per line; `#` starts a comment.',
  );
  process.exit(2);
}

const patterns = raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

if (patterns.length === 0) {
  console.error('scrub-check: .scrub-patterns contains no patterns.');
  process.exit(2);
}

let hits = 0;
for (const pattern of patterns) {
  const res = spawnSync(
    'git',
    ['grep', '-I', '-n', '-i', '--fixed-strings', pattern, '--', '.'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  // git grep exits 1 on no match, >1 on error.
  if (res.status !== null && res.status > 1) {
    console.error(`scrub-check: git grep failed for a pattern: ${res.stderr}`);
    process.exit(2);
  }
  if (res.status === 0) {
    hits++;
    // Mask the pattern in output so terminal logs don't echo the full string.
    const masked =
      pattern.length > 8
        ? `${pattern.slice(0, 4)}…${pattern.slice(-2)}`
        : `${pattern.slice(0, 2)}…`;
    console.error(`\nFORBIDDEN STRING (${masked}) found in tracked files:`);
    console.error(res.stdout.trimEnd());
  }
}

if (hits > 0) {
  console.error(`\nscrub-check: ${hits} of ${patterns.length} patterns matched. FAILING.`);
  process.exit(1);
}

console.log(`scrub-check: clean (${patterns.length} patterns, 0 hits).`);
