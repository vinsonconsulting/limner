import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { A4_FRAMING } from '@limner/core';

import { extractGenerated, generatedBlock, SKILL_SOURCES } from '../src/skill-gen.js';

const here = dirname(fileURLToPath(import.meta.url));
// From test/ up one level to the package root, then into skills/.
const skillsDir = resolve(here, '../skills');

// Requires @limner/core to be built (the generator + this test both read the
// guidance source via @limner/core's dist). CI builds before test.
describe('skills drift-check (D-RA-24)', () => {
  test.each(SKILL_SOURCES)(
    '$skillDir SKILL.md matches the guidance serializer (no drift)',
    ({ skillDir, guidanceId }) => {
      const skillPath = resolve(skillsDir, skillDir, 'SKILL.md');
      const committed = extractGenerated(readFileSync(skillPath, 'utf8'), guidanceId);
      const fresh = generatedBlock(guidanceId).trim();
      // Drift here means the guidance source changed but SKILL.md was not
      // regenerated. Fix:
      //   pnpm --filter @limner/core build
      //   pnpm --filter @limner/limner-agent build
      //   pnpm --filter @limner/limner-agent gen:skills
      expect(committed).toBe(fresh);
    },
  );

  test.each(SKILL_SOURCES)('$skillDir generated block carries the A4 framing', ({ guidanceId }) => {
    expect(generatedBlock(guidanceId)).toContain(A4_FRAMING);
  });

  test('file-types generated block carries the format table', () => {
    expect(generatedBlock('file-types')).toContain(
      '| Format | Compression | Alpha | Color model | Typical use |',
    );
  });

  // Skills upload to the Skills API, which parses the frontmatter as strict
  // YAML. A ": " (colon-space) inside a plain scalar is read as a nested
  // mapping and fails ingestion, so frontmatter values must avoid it.
  test.each(SKILL_SOURCES)('$skillDir frontmatter is strict-YAML safe', ({ skillDir }) => {
    const md = readFileSync(resolve(skillsDir, skillDir, 'SKILL.md'), 'utf8');
    const block = md.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    expect(block).not.toBe('');
    for (const line of block.split('\n')) {
      const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
      if (!kv) continue;
      expect(kv[2]).not.toContain(': ');
    }
  });
});
