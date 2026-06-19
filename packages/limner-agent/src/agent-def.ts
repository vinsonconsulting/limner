// CMA agent definition builders (D-RA-24). Pure, SDK-free, fs-free logic shared
// by the create/version entry point (create-agent.ts, which adds the I/O + the
// @anthropic-ai/sdk calls) and the dry-run test. Keeping this layer pure means
// the request shapes can be validated without credentials or a network.
//
// The contract these builders target is the CMA Managed Agents + Skills API,
// verified against the @anthropic-ai/sdk types and the platform docs:
//   - Agents:  POST /v1/agents      (beta managed-agents-2026-04-01)
//              https://platform.claude.com/docs/en/managed-agents/skills
//   - Skills:  POST /v1/skills      (beta skills-2025-10-02)
//              https://platform.claude.com/docs/en/build-with-claude/skills-guide
// The SDK auto-applies both beta headers for client.beta.agents / client.beta.skills.
//
// Limner is an independent third-party project on Anthropic's CMA platform; the
// script *uses* the CMA API. It is not an Anthropic or Claude product.

import { A4_FRAMING } from '@limner/core';

/** Beta header the Managed Agents endpoints require (SDK applies it automatically). */
export const BETA_AGENTS = 'managed-agents-2026-04-01';
/** Beta header the Skills endpoints require (SDK applies it automatically). */
export const BETA_SKILLS = 'skills-2025-10-02';

/** Agent name registered with the CMA API. */
export const LIMNER_AGENT_NAME = 'Limner';
/** Model the Limner agent runs on (matches the existing deployment). */
export const LIMNER_AGENT_MODEL = 'claude-sonnet-4-6';
/** Human-readable display title for the uploaded file-types skill (max 64). */
export const FILE_TYPES_SKILL_TITLE = 'Limner file types';
/** Top-level directory the uploaded skill files share (SKILL.md sits at its root). */
export const FILE_TYPES_SKILL_ROOT = 'file-types';

/** One skill the Limner agent carries: its directory (= upload root) and display title. */
export interface SkillManifestEntry {
  /** Directory under packages/limner-agent/skills/; also the upload root path. */
  skillDir: string;
  /** Human-readable display title for the uploaded skill (1-64 chars, A4-safe). */
  displayTitle: string;
}

/**
 * The wave-1 skills attached to the Limner agent, in attach order. file-types
 * reuses the original constants so the proven single-skill path is unchanged;
 * the rest were authored in wave-1. Adding a skill here (plus its SKILL.md and a
 * SKILL_SOURCES row for the generated region) is all create-agent needs to ship it.
 * Display titles stay A4-safe: descriptive, no Anthropic/Claude product implication.
 */
export const SKILL_MANIFEST: readonly SkillManifestEntry[] = [
  { skillDir: FILE_TYPES_SKILL_ROOT, displayTitle: FILE_TYPES_SKILL_TITLE },
  { skillDir: 'external-tools', displayTitle: 'Limner external tools' },
  { skillDir: 'midjourney', displayTitle: 'Limner Midjourney recipe' },
  { skillDir: 'dalle', displayTitle: 'Limner DALL·E recipe' },
  { skillDir: 'recraft', displayTitle: 'Limner Recraft recipe' },
  { skillDir: 'illuminated-manuscript', displayTitle: 'Limner illuminated manuscript' },
];

const RESERVED_WORDS = ['anthropic', 'claude'] as const;

/** One file in a skill upload (maps to a multipart files[] entry). */
export interface SkillUploadFile {
  /** Path within the upload's common root, e.g. "file-types/SKILL.md". */
  path: string;
  content: string;
  contentType: string;
}

/** A plan for POST /v1/skills (or POST /v1/skills/{id}/versions). */
export interface SkillUploadPlan {
  displayTitle: string;
  rootPath: string;
  files: SkillUploadFile[];
}

/** A custom-skill attachment in an agent's `skills` array. */
export interface SkillAttachment {
  type: 'custom';
  skill_id: string;
  /** Pinned version, or "latest". */
  version: string;
}

/** A plan for POST /v1/agents (or POST /v1/agents/{id} to version). */
export interface AgentPlan {
  name: string;
  model: string;
  system: string;
  skills: SkillAttachment[];
}

/** Parse the leading YAML frontmatter of a SKILL.md into flat key/value pairs. */
function parseFrontmatter(md: string): Record<string, string> {
  const block = md.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (block === undefined) {
    throw new Error('SKILL.md is missing its YAML frontmatter (--- ... ---)');
  }
  const fm: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv && kv[1] !== undefined && kv[2] !== undefined) {
      fm[kv[1]] = kv[2].trim();
    }
  }
  return fm;
}

/**
 * Validate a SKILL.md's frontmatter against the Skills API rules: `name` is
 * 1-64 chars of [a-z0-9-] with no reserved words, `description` is 1-1024 chars,
 * and neither contains angle brackets (no XML tags). Throws on any violation.
 */
export function validateSkillFrontmatter(md: string): { name: string; description: string } {
  const fm = parseFrontmatter(md);
  const name = fm.name ?? '';
  const description = fm.description ?? '';

  if (!/^[a-z0-9-]{1,64}$/.test(name)) {
    throw new Error(`skill name must be 1-64 chars of [a-z0-9-]; got ${JSON.stringify(name)}`);
  }
  for (const word of RESERVED_WORDS) {
    if (name.includes(word)) {
      throw new Error(`skill name must not contain the reserved word "${word}": ${name}`);
    }
  }
  if (description.length === 0 || description.length > 1024) {
    throw new Error(`skill description must be 1-1024 chars; got ${description.length}`);
  }
  if (/[<>]/.test(name) || /[<>]/.test(description)) {
    throw new Error('skill name/description must not contain XML tags (< or >)');
  }
  return { name, description };
}

/** Assert the system prompt carries the verbatim A4 third-party framing. */
export function assertA4(systemPrompt: string): void {
  if (!systemPrompt.includes(A4_FRAMING)) {
    throw new Error('system prompt is missing the A4 framing disclaimer');
  }
}

/**
 * Build the skill-upload plan from a SKILL.md. Validates the frontmatter and the
 * display title, and places SKILL.md at the root of the common upload directory.
 */
export function buildSkillUpload(
  skillMd: string,
  opts: { displayTitle: string; rootPath: string },
): SkillUploadPlan {
  validateSkillFrontmatter(skillMd);
  if (opts.displayTitle.length === 0 || opts.displayTitle.length > 64) {
    throw new Error(`skill display_title must be 1-64 chars; got ${opts.displayTitle.length}`);
  }
  return {
    displayTitle: opts.displayTitle,
    rootPath: opts.rootPath,
    files: [{ path: `${opts.rootPath}/SKILL.md`, content: skillMd, contentType: 'text/markdown' }],
  };
}

/** One skill to upload: its manifest entry plus its read SKILL.md and optional prior id. */
export interface SkillUploadInput {
  skillDir: string;
  displayTitle: string;
  skillMd: string;
  /** Existing skill id to version; absent → create a fresh skill. */
  existingSkillId?: string;
}

/** A per-skill upload plan tagged with its directory and the API endpoint it targets. */
export interface SkillUploadPlanEntry extends SkillUploadPlan {
  skillDir: string;
  existingSkillId?: string;
  /** POST /v1/skills (create) or POST /v1/skills/{id}/versions (version). */
  endpoint: string;
}

/**
 * Build the upload plan for each skill, choosing the create-vs-version endpoint
 * from whether a prior skill id is supplied. Validates every skill's frontmatter
 * (throws on the first violation) so a bad SKILL.md fails before any network call.
 */
export function buildSkillUploadPlans(
  inputs: readonly SkillUploadInput[],
): SkillUploadPlanEntry[] {
  return inputs.map((input) => {
    const plan = buildSkillUpload(input.skillMd, {
      displayTitle: input.displayTitle,
      rootPath: input.skillDir,
    });
    return {
      ...plan,
      skillDir: input.skillDir,
      existingSkillId: input.existingSkillId,
      endpoint: input.existingSkillId
        ? `POST /v1/skills/${input.existingSkillId}/versions`
        : 'POST /v1/skills',
    };
  });
}

/**
 * Build the agent-create/version plan. Asserts A4 framing on the system prompt.
 * Tools and MCP servers are intentionally omitted: they couple to the Phase-7
 * consumer Worker, whereas the agent definition (system prompt + skills)
 * registers independently.
 */
export function buildAgentPlan(opts: {
  system: string;
  skills: SkillAttachment[];
  name?: string;
  model?: string;
}): AgentPlan {
  assertA4(opts.system);
  return {
    name: opts.name ?? LIMNER_AGENT_NAME,
    model: opts.model ?? LIMNER_AGENT_MODEL,
    system: opts.system,
    skills: opts.skills,
  };
}
