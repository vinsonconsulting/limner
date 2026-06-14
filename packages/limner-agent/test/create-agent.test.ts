import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';
import { A4_FRAMING } from '@limner/core';

import {
  BETA_AGENTS,
  BETA_SKILLS,
  FILE_TYPES_SKILL_ROOT,
  FILE_TYPES_SKILL_TITLE,
  LIMNER_AGENT_MODEL,
  LIMNER_AGENT_NAME,
  assertA4,
  buildAgentPlan,
  buildSkillUpload,
  validateSkillFrontmatter,
  type SkillAttachment,
} from '../src/agent-def.js';

const here = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT_PATH = resolve(here, '../prompts/system-prompt.md');
const SKILL_PATH = resolve(here, '../skills/file-types/SKILL.md');

const system = readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
const skillMd = readFileSync(SKILL_PATH, 'utf8');

function frontmatter(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# body\n`;
}

describe('create-agent: beta headers', () => {
  test('match the documented (SDK auto-injected) values', () => {
    expect(BETA_AGENTS).toBe('managed-agents-2026-04-01');
    expect(BETA_SKILLS).toBe('skills-2025-10-02');
  });
});

describe('create-agent: skill frontmatter validation', () => {
  test('accepts the committed file-types SKILL.md', () => {
    const { name, description } = validateSkillFrontmatter(skillMd);
    expect(name).toBe('file-types');
    expect(description.length).toBeGreaterThan(0);
  });

  test('rejects a reserved word in the name', () => {
    expect(() => validateSkillFrontmatter(frontmatter('claude-helper', 'ok'))).toThrow(/reserved/);
  });

  test('rejects an invalid name (uppercase / underscore)', () => {
    expect(() => validateSkillFrontmatter(frontmatter('File_Types', 'ok'))).toThrow(/1-64 chars/);
  });

  test('rejects an empty description', () => {
    expect(() => validateSkillFrontmatter(frontmatter('ok', ''))).toThrow(/description/);
  });

  test('rejects an over-long description', () => {
    expect(() => validateSkillFrontmatter(frontmatter('ok', 'x'.repeat(1025)))).toThrow(/description/);
  });

  test('rejects missing frontmatter', () => {
    expect(() => validateSkillFrontmatter('# no frontmatter here')).toThrow(/frontmatter/);
  });
});

describe('create-agent: skill upload plan', () => {
  test('places SKILL.md at the root with the markdown content type', () => {
    const plan = buildSkillUpload(skillMd, {
      displayTitle: FILE_TYPES_SKILL_TITLE,
      rootPath: FILE_TYPES_SKILL_ROOT,
    });
    expect(plan.displayTitle).toBe(FILE_TYPES_SKILL_TITLE);
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0].path).toBe('file-types/SKILL.md');
    expect(plan.files[0].contentType).toBe('text/markdown');
    expect(plan.files[0].content).toBe(skillMd);
  });

  test('rejects an over-long display title', () => {
    expect(() =>
      buildSkillUpload(skillMd, { displayTitle: 'x'.repeat(65), rootPath: FILE_TYPES_SKILL_ROOT }),
    ).toThrow(/display_title/);
  });
});

describe('create-agent: A4 framing', () => {
  test('the committed system prompt carries the A4 framing', () => {
    expect(system).toContain(A4_FRAMING);
    expect(() => assertA4(system)).not.toThrow();
  });

  test('assertA4 throws when the framing is absent', () => {
    expect(() => assertA4('You are a helpful agent.')).toThrow(/A4 framing/);
  });
});

describe('create-agent: agent plan', () => {
  const attachment: SkillAttachment = { type: 'custom', skill_id: 'skill_test', version: 'latest' };

  test('builds a well-formed agent definition from the real system prompt', () => {
    const plan = buildAgentPlan({ system, skills: [attachment] });
    expect(plan.name).toBe(LIMNER_AGENT_NAME);
    expect(plan.model).toBe(LIMNER_AGENT_MODEL);
    expect(plan.system).toContain(A4_FRAMING);
    expect(plan.skills).toEqual([{ type: 'custom', skill_id: 'skill_test', version: 'latest' }]);
  });

  test('throws when the system prompt lacks the A4 framing', () => {
    expect(() => buildAgentPlan({ system: 'no framing', skills: [attachment] })).toThrow(/A4 framing/);
  });
});
