import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { A4_FRAMING } from '@limner/core';

import { extractGenerated, generatedBlock } from '../src/skill-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
// From test/ up one level to the package root, then into skills/.
const SKILL_PATH = resolve(here, '../skills/file-types/SKILL.md');

// Requires @limner/core to be built (the generator + this test both read the
// guidance source via @limner/core's dist). CI builds before test.
describe('skills drift-check: file-types SKILL.md', () => {
  test('committed generated block matches the guidance serializer (no drift)', () => {
    const committed = extractGenerated(readFileSync(SKILL_PATH, 'utf8'));
    const fresh = generatedBlock().trim();
    // Drift here means the guidance source changed but SKILL.md was not
    // regenerated. Fix:
    //   pnpm --filter @limner/core build
    //   pnpm --filter @limner/limner-agent build
    //   pnpm --filter @limner/limner-agent gen:skills
    expect(committed).toBe(fresh);
  });

  test('generated block carries the A4 framing and the file-types table', () => {
    const fresh = generatedBlock();
    expect(fresh).toContain(A4_FRAMING);
    expect(fresh).toContain('| Format | Compression | Alpha | Color model | Typical use |');
  });
});
