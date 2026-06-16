// CMA agent create/version entry point (D-RA-24). Replaces the former
// documented stub now that the Managed Agents + Skills API is pinned (see
// agent-def.ts for the verified contract and doc links).
//
// DEFAULT = dry run: validate the system prompt + skill, build the request
// payloads, print them, and exit 0 — no network, no credentials. This is the
// only mode the test exercises and the only mode meant to run in CI.
//
// LIVE (--execute, requires ANTHROPIC_API_KEY): uploads/versions the file-types
// skill, then creates or versions the Limner agent with the system prompt +
// skill attached. Mutates production — run deliberately, never automatically.
//
// Run via: pnpm --filter @limner/limner-agent create-agent  (node dist/create-agent.js)
//
// Limner is an independent third-party project on Anthropic's CMA platform; this
// script *uses* the CMA API. It is not an Anthropic or Claude product.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import process from 'node:process';

import {
  BETA_AGENTS,
  BETA_SKILLS,
  FILE_TYPES_SKILL_ROOT,
  FILE_TYPES_SKILL_TITLE,
  buildAgentPlan,
  buildSkillUpload,
  type SkillAttachment,
} from './agent-def.js';

const here = dirname(fileURLToPath(import.meta.url));
// From dist/create-agent.js up to the package root, then into prompts/ + skills/.
const SYSTEM_PROMPT_PATH = resolve(here, '../prompts/system-prompt.md');
const SKILL_PATH = resolve(here, '../skills/file-types/SKILL.md');

interface Cli {
  execute: boolean;
  /** Version an existing agent (POST /v1/agents/{id}) instead of creating one. */
  agentId?: string;
  /** Version an existing skill (POST /v1/skills/{id}/versions) instead of creating one. */
  skillId?: string;
}

function parseArgs(argv: readonly string[]): Cli {
  const cli: Cli = { execute: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--execute') cli.execute = true;
    else if (arg === '--agent-id') cli.agentId = argv[++i];
    else if (arg === '--skill-id') cli.skillId = argv[++i];
  }
  cli.agentId ??= process.env.LIMNER_AGENT_ID;
  cli.skillId ??= process.env.LIMNER_SKILL_ID;
  return cli;
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const system = readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  const skillMd = readFileSync(SKILL_PATH, 'utf8');

  // Pure validation + plan building. Throws on A4 / frontmatter violations
  // before any network call is considered.
  const skillUpload = buildSkillUpload(skillMd, {
    displayTitle: FILE_TYPES_SKILL_TITLE,
    rootPath: FILE_TYPES_SKILL_ROOT,
  });

  if (!cli.execute) {
    const placeholder: SkillAttachment = {
      type: 'custom',
      skill_id: cli.skillId ?? '<skill_id assigned at upload>',
      version: 'latest',
    };
    const agentPlan = buildAgentPlan({ system, skills: [placeholder] });
    const preview = {
      mode: 'dry-run',
      betas: { agents: BETA_AGENTS, skills: BETA_SKILLS },
      skill: {
        endpoint: cli.skillId ? `POST /v1/skills/${cli.skillId}/versions` : 'POST /v1/skills',
        display_title: skillUpload.displayTitle,
        files: skillUpload.files.map((f) => ({
          path: f.path,
          bytes: Buffer.byteLength(f.content, 'utf8'),
          contentType: f.contentType,
        })),
      },
      agent: cli.agentId
        ? {
            // Versioning an existing agent updates ONLY skills; system / name /
            // model / tools / mcp_servers are omitted and therefore preserved.
            endpoint: `POST /v1/agents/${cli.agentId}`,
            mode: 'version existing (skills only)',
            skills: agentPlan.skills,
            preserves: ['system', 'name', 'model', 'tools', 'mcp_servers'],
          }
        : {
            endpoint: 'POST /v1/agents',
            mode: 'create new',
            name: agentPlan.name,
            model: agentPlan.model,
            skills: agentPlan.skills,
            systemPromptBytes: Buffer.byteLength(agentPlan.system, 'utf8'),
          },
    };
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    process.stdout.write(
      '\ncreate-agent: dry run only — no API calls made. ' +
        'Re-run with --execute (and ANTHROPIC_API_KEY set) to register.\n',
    );
    return;
  }

  // ---- LIVE ----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('create-agent --execute requires ANTHROPIC_API_KEY in the environment');
  }

  // SDK loaded only on the live path so the dry run needs neither it nor a key.
  // The SDK auto-applies the BETA_SKILLS / BETA_AGENTS headers for these calls.
  const { default: Anthropic, toFile } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const file = await toFile(Buffer.from(skillMd, 'utf8'), `${FILE_TYPES_SKILL_ROOT}/SKILL.md`, {
    type: 'text/markdown',
  });

  let skillId: string;
  let version: string;
  if (cli.skillId) {
    const v = await client.beta.skills.versions.create(cli.skillId, { files: [file] });
    skillId = cli.skillId;
    version = v.version;
  } else {
    const s = await client.beta.skills.create({
      display_title: skillUpload.displayTitle,
      files: [file],
    });
    skillId = s.id;
    version = s.latest_version ?? 'latest';
  }

  const attachment: SkillAttachment = { type: 'custom', skill_id: skillId, version };
  const plan = buildAgentPlan({ system, skills: [attachment] });
  let agent;
  if (cli.agentId) {
    // Version an EXISTING agent: update ONLY the skill attachment(s). `system`,
    // `name`, and `model` are deliberately omitted (as `tools`/`mcp_servers`
    // always are) so the CMA update — which leaves omitted fields untouched —
    // preserves the live agent's externally-managed system prompt and tool/MCP
    // wiring. Update mints a new version, so it needs the current version as an
    // optimistic-concurrency token: retrieve it first.
    const current = await client.beta.agents.retrieve(cli.agentId);
    agent = await client.beta.agents.update(cli.agentId, {
      version: current.version,
      skills: plan.skills,
    });
  } else {
    // Create a NEW agent from the full repo-defined plan. `tools`/`mcp_servers`
    // stay omitted by design (they couple to the consumer Worker).
    agent = await client.beta.agents.create({
      name: plan.name,
      model: plan.model,
      system: plan.system,
      skills: plan.skills,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      { mode: 'live', skill: { id: skillId, version }, agent: { id: agent.id } },
      null,
      2,
    )}\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`create-agent: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
