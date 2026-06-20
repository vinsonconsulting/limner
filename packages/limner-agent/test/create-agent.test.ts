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
  SKILL_MANIFEST,
  assertA4,
  buildAgentPlan,
  buildSkillUpload,
  buildSkillUploadPlans,
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

describe('create-agent: multi-skill manifest', () => {
  test('lists all wave-1 + wave-2 skills in attach order with valid titles', () => {
    expect(SKILL_MANIFEST.map((s) => s.skillDir)).toEqual([
      'file-types',
      'external-tools',
      'midjourney',
      'dalle',
      'recraft',
      'illuminated-manuscript',
      'pipeline-router',
      'brand-stamp',
      'multi-size-export',
      'captioned-graphic',
      'iterate-on-asset',
      'style-from-images',
      'brand-kit',
      'art-research',
      'vectorize',
      'print-ready',
    ]);
    for (const { displayTitle } of SKILL_MANIFEST) {
      expect(displayTitle.length).toBeGreaterThan(0);
      expect(displayTitle.length).toBeLessThanOrEqual(64);
      // A4: no Anthropic/Claude product implication in the public display title.
      expect(displayTitle.toLowerCase()).not.toContain('anthropic');
      expect(displayTitle.toLowerCase()).not.toContain('claude');
    }
  });

  test('file-types entry reuses the existing title/root constants (back-compat)', () => {
    const ft = SKILL_MANIFEST[0];
    expect(ft.skillDir).toBe(FILE_TYPES_SKILL_ROOT);
    expect(ft.displayTitle).toBe(FILE_TYPES_SKILL_TITLE);
  });
});

describe('create-agent: multi-skill upload plans', () => {
  const validMd = (name: string): string =>
    `---\nname: ${name}\ndescription: ok description\nlicense: Apache-2.0\n---\n\n# body\n`;

  test('builds one plan per skill with SKILL.md at each skill root', () => {
    const plans = buildSkillUploadPlans([
      { skillDir: 'file-types', displayTitle: 'Limner file types', skillMd: validMd('file-types') },
      { skillDir: 'dalle', displayTitle: 'Limner DALL·E recipe', skillMd: validMd('dalle') },
    ]);
    expect(plans).toHaveLength(2);
    expect(plans[0].files[0].path).toBe('file-types/SKILL.md');
    expect(plans[1].files[0].path).toBe('dalle/SKILL.md');
    expect(plans[1].displayTitle).toBe('Limner DALL·E recipe');
  });

  test('chooses the create vs version endpoint per existingSkillId', () => {
    const plans = buildSkillUploadPlans([
      {
        skillDir: 'file-types',
        displayTitle: 'Limner file types',
        skillMd: validMd('file-types'),
        existingSkillId: 'skill_abc',
      },
      { skillDir: 'dalle', displayTitle: 'Limner DALL·E recipe', skillMd: validMd('dalle') },
    ]);
    expect(plans[0].endpoint).toBe('POST /v1/skills/skill_abc/versions');
    expect(plans[0].existingSkillId).toBe('skill_abc');
    expect(plans[1].endpoint).toBe('POST /v1/skills');
    expect(plans[1].existingSkillId).toBeUndefined();
  });

  test('validates each skill frontmatter (rejects a bad name)', () => {
    expect(() =>
      buildSkillUploadPlans([
        { skillDir: 'x', displayTitle: 'Limner x', skillMd: validMd('Bad_Name') },
      ]),
    ).toThrow(/1-64 chars/);
  });
});
